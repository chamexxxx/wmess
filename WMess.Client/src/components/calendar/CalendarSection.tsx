import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ruLocale from '@fullcalendar/core/locales/ru'
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { calendarApi, type CalendarEvent } from '../../api/calendarApi'
import { useCalendarLive } from '../../providers/useCalendarLive'
import { PlusIcon } from '../../workspace/icons'
import {
  defaultEventValues,
  eventToFormValues,
  EventDetailPanel,
  EventModal,
  formValuesToUtcRange,
  type EventFormValues,
} from './EventModal'
import './calendar.css'

type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

interface CalendarSectionProps {
  projectId: number
}

export function CalendarSection({ projectId }: CalendarSectionProps) {
  const liveSignal = useCalendarLive(projectId)
  const calendarRef = useRef<FullCalendar>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<CalendarView>(
    () => (localStorage.getItem('wmess-calendar-view') as CalendarView) || 'dayGridMonth',
  )
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [modal, setModal] = useState<
    | null
    | { mode: 'create'; initial: EventFormValues }
    | { mode: 'edit'; event: CalendarEvent; initial: EventFormValues }
  >(null)
  const [deleting, setDeleting] = useState(false)
  const rangeRef = useRef<{ from?: string; to?: string }>({})

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      setError(null)
      try {
        const res = await calendarApi.list({
          projectId,
          from: rangeRef.current.from,
          to: rangeRef.current.to,
        })
        setEvents(res.data)
      } catch {
        setError('Не удалось загрузить события')
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (liveSignal === 0) return
    void load({ silent: true })
  }, [liveSignal, load])

  useEffect(() => {
    localStorage.setItem('wmess-calendar-view', view)
    calendarRef.current?.getApi().changeView(view)
  }, [view])

  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((ev) => ({
        id: ev.id,
        title: ev.title,
        start: ev.startUtc,
        end: ev.endUtc,
        allDay: ev.allDay,
        extendedProps: { raw: ev },
      })),
    [events],
  )

  function handleDatesSet(arg: { start: Date; end: Date }) {
    rangeRef.current = {
      from: arg.start.toISOString(),
      to: arg.end.toISOString(),
    }
    void load({ silent: true })
  }

  function openCreate(start?: Date, end?: Date, allDay = false) {
    setModal({ mode: 'create', initial: defaultEventValues(start, end, allDay) })
  }

  function handleSelect(arg: DateSelectArg) {
    openCreate(arg.start, arg.end, arg.allDay)
    arg.view.calendar.unselect()
  }

  function handleEventClick(arg: EventClickArg) {
    const raw = arg.event.extendedProps.raw as CalendarEvent | undefined
    if (raw) setSelected(raw)
  }

  async function persistMove(id: string, start: Date, end: Date, allDay: boolean) {
    const ev = events.find((e) => e.id === id)
    if (!ev) return
    try {
      await calendarApi.update(id, {
        title: ev.title,
        description: ev.description ?? undefined,
        location: ev.location ?? undefined,
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        allDay,
      })
      await load({ silent: true })
    } catch {
      setError('Не удалось переместить событие')
      await load({ silent: true })
    }
  }

  function handleEventDrop(arg: EventDropArg) {
    const start = arg.event.start
    const end = arg.event.end ?? arg.event.start
    if (!start || !end) return
    void persistMove(arg.event.id, start, end, arg.event.allDay)
  }

  function handleEventResize(arg: EventResizeDoneArg) {
    const start = arg.event.start
    const end = arg.event.end
    if (!start || !end) return
    void persistMove(arg.event.id, start, end, arg.event.allDay)
  }

  async function handleCreate(values: EventFormValues) {
    const range = formValuesToUtcRange(values)
    await calendarApi.create({
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      location: values.location.trim() || undefined,
      ...range,
      allDay: values.allDay,
      projectId,
    })
    await load({ silent: true })
  }

  async function handleUpdate(eventId: string, values: EventFormValues) {
    const range = formValuesToUtcRange(values)
    await calendarApi.update(eventId, {
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      location: values.location.trim() || undefined,
      ...range,
      allDay: values.allDay,
    })
    await load({ silent: true })
    setSelected(null)
  }

  async function handleDelete(event: CalendarEvent) {
    setDeleting(true)
    try {
      await calendarApi.remove(event.id)
      setSelected(null)
      await load({ silent: true })
    } catch {
      setError('Не удалось удалить событие')
    } finally {
      setDeleting(false)
    }
  }

  const viewButtons: { id: CalendarView; label: string }[] = [
    { id: 'timeGridDay', label: 'День' },
    { id: 'timeGridWeek', label: 'Неделя' },
    { id: 'dayGridMonth', label: 'Месяц' },
  ]

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line bg-panel">
        <div className="flex rounded-lg border border-line overflow-hidden">
          {viewButtons.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`px-3 py-1.5 text-[13px] font-semibold font-ui ${
                view === v.id ? 'bg-accent text-white' : 'bg-white text-muted hover:bg-sidebar'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-white text-[13px] font-semibold font-ui"
        >
          <PlusIcon size={14} /> Событие
        </button>

        {loading && <span className="text-[12px] text-faint ml-2">Загрузка…</span>}
      </div>

      {error && (
        <div className="shrink-0 px-4 py-2 text-[13px] text-danger bg-danger/5 border-b border-line">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 p-3 bg-panel wmess-calendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          locale={ruLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          buttonText={{
            today: 'Сегодня',
          }}
          height="100%"
          events={fcEvents}
          editable
          selectable
          selectMirror
          dayMaxEvents
          nowIndicator
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot
          firstDay={1}
          datesSet={handleDatesSet}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
        />
      </div>

      {selected && !modal && (
        <EventDetailPanel
          event={selected}
          onClose={() => setSelected(null)}
          onEdit={() =>
            setModal({
              mode: 'edit',
              event: selected,
              initial: eventToFormValues(selected),
            })
          }
          onDelete={() => void handleDelete(selected)}
          deleting={deleting}
        />
      )}

      {modal?.mode === 'create' && (
        <EventModal
          title="Новое событие"
          submitLabel="Создать"
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSubmit={handleCreate}
        />
      )}

      {modal?.mode === 'edit' && (
        <EventModal
          title="Редактировать событие"
          submitLabel="Сохранить"
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSubmit={(values) => handleUpdate(modal.event.id, values)}
        />
      )}
    </div>
  )
}
