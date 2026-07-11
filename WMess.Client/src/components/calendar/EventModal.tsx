import { useEffect, useState } from 'react'
import type { CalendarEvent } from '../../api/calendarApi'

export type EventFormValues = {
  title: string
  description: string
  location: string
  startLocal: string
  endLocal: string
  allDay: boolean
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function toDatetimeLocalValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function toDateLocalValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDatetimeLocal(value: string): Date {
  return new Date(value)
}

export function parseDateLocal(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function defaultEventValues(start?: Date, end?: Date, allDay = false): EventFormValues {
  const s = start ?? new Date()
  const e = end ?? new Date(s.getTime() + 60 * 60 * 1000)
  if (allDay) {
    return {
      title: '',
      description: '',
      location: '',
      startLocal: toDateLocalValue(s),
      endLocal: toDateLocalValue(e),
      allDay: true,
    }
  }
  return {
    title: '',
    description: '',
    location: '',
    startLocal: toDatetimeLocalValue(s),
    endLocal: toDatetimeLocalValue(e),
    allDay: false,
  }
}

export function eventToFormValues(ev: CalendarEvent): EventFormValues {
  const start = new Date(ev.startUtc)
  const end = new Date(ev.endUtc)
  if (ev.allDay) {
    const endInclusive = new Date(end)
    if (endInclusive.getTime() > start.getTime()) {
      endInclusive.setDate(endInclusive.getDate() - 1)
    }
    return {
      title: ev.title,
      description: ev.description ?? '',
      location: ev.location ?? '',
      startLocal: toDateLocalValue(start),
      endLocal: toDateLocalValue(endInclusive),
      allDay: true,
    }
  }
  return {
    title: ev.title,
    description: ev.description ?? '',
    location: ev.location ?? '',
    startLocal: toDatetimeLocalValue(start),
    endLocal: toDatetimeLocalValue(end),
    allDay: false,
  }
}

export function formValuesToUtcRange(values: EventFormValues): { startUtc: string; endUtc: string } {
  if (values.allDay) {
    const start = parseDateLocal(values.startLocal)
    start.setHours(0, 0, 0, 0)
    const end = parseDateLocal(values.endLocal)
    end.setHours(0, 0, 0, 0)
    end.setDate(end.getDate() + 1)
    return { startUtc: start.toISOString(), endUtc: end.toISOString() }
  }
  return {
    startUtc: parseDatetimeLocal(values.startLocal).toISOString(),
    endUtc: parseDatetimeLocal(values.endLocal).toISOString(),
  }
}

export function formatEventRange(ev: CalendarEvent): string {
  const start = new Date(ev.startUtc)
  const end = new Date(ev.endUtc)
  const dateFmt = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (ev.allDay) {
    const endInclusive = new Date(end)
    endInclusive.setDate(endInclusive.getDate() - 1)
    const sameDay =
      start.getFullYear() === endInclusive.getFullYear() &&
      start.getMonth() === endInclusive.getMonth() &&
      start.getDate() === endInclusive.getDate()
    if (sameDay) return `${dateFmt.format(start)}, весь день`
    return `${dateFmt.format(start)} — ${dateFmt.format(endInclusive)}, весь день`
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()

  if (sameDay) {
    return `${dateFmt.format(start)}, ${timeFmt.format(start)} — ${timeFmt.format(end)}`
  }
  return `${dateFmt.format(start)} ${timeFmt.format(start)} — ${dateFmt.format(end)} ${timeFmt.format(end)}`
}

interface EventModalProps {
  title: string
  submitLabel: string
  initial: EventFormValues
  busy?: boolean
  onClose: () => void
  onSubmit: (values: EventFormValues) => Promise<void>
}

export function EventModal({
  title,
  submitLabel,
  initial,
  busy,
  onClose,
  onSubmit,
}: EventModalProps) {
  const [values, setValues] = useState(initial)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setValues(initial)
  }, [initial])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.title.trim() || submitting || busy) return
    setSubmitting(true)
    try {
      await onSubmit(values)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30" onMouseDown={onClose}>
      <form
        className="w-[520px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-line p-5 shadow-xl font-ui"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => void submit(e)}
      >
        <h2 className="text-lg font-bold text-ink">{title}</h2>

        <label className="block text-[11px] font-bold text-faint uppercase mt-4">Название</label>
        <input
          autoFocus
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="Встреча, звонок, событие…"
          className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
        />

        <label className="block text-[11px] font-bold text-faint uppercase mt-3">Описание</label>
        <textarea
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          rows={4}
          placeholder="Повестка, заметки…"
          className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px] resize-y"
        />

        <label className="block text-[11px] font-bold text-faint uppercase mt-3">
          Место / ссылка на звонок
        </label>
        <input
          value={values.location}
          onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
          placeholder="Zoom, Google Meet, переговорная…"
          className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
        />

        <label className="flex items-center gap-2 mt-4 text-[13px] text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={values.allDay}
            onChange={(e) => setValues((v) => ({ ...v, allDay: e.target.checked }))}
            className="rounded border-line"
          />
          Весь день
        </label>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-[11px] font-bold text-faint uppercase">Начало</label>
            <input
              type={values.allDay ? 'date' : 'datetime-local'}
              value={values.startLocal}
              onChange={(e) => setValues((v) => ({ ...v, startLocal: e.target.value }))}
              className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-faint uppercase">Окончание</label>
            <input
              type={values.allDay ? 'date' : 'datetime-local'}
              value={values.endLocal}
              onChange={(e) => setValues((v) => ({ ...v, endLocal: e.target.value }))}
              className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-line text-[13px] font-semibold text-muted"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!values.title.trim() || submitting || busy}
            className="h-9 px-4 rounded-lg bg-accent text-white text-[13px] font-semibold disabled:opacity-50"
          >
            {submitting ? 'Сохранение…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

interface EventDetailPanelProps {
  event: CalendarEvent
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  deleting?: boolean
}

export function EventDetailPanel({ event, onClose, onEdit, onDelete, deleting }: EventDetailPanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-[90] w-[380px] max-w-full bg-white border-l border-line shadow-xl flex flex-col font-ui animate-[wmPop_.2s_ease]">
      <div className="shrink-0 flex items-start gap-3 px-5 py-4 border-b border-line">
        <div className="flex-1 min-w-0">
          <div className="text-[10.5px] tracking-[.06em] uppercase text-faintest font-bold">Событие</div>
          <h2 className="text-[17px] font-bold text-ink mt-1 break-words">{event.title}</h2>
          <div className="text-[13px] text-muted mt-1.5">{formatEventRange(event)}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg text-muted hover:bg-hovered shrink-0"
          title="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {event.location && (
          <div>
            <div className="text-[10.5px] tracking-[.06em] uppercase text-faintest font-bold">Место / звонок</div>
            <a
              href={event.location.startsWith('http') ? event.location : undefined}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-accent mt-1 block break-all"
            >
              {event.location}
            </a>
          </div>
        )}

        {event.description && (
          <div>
            <div className="text-[10.5px] tracking-[.06em] uppercase text-faintest font-bold">Описание</div>
            <p className="text-[13px] text-ink-soft mt-1 whitespace-pre-wrap leading-relaxed">
              {event.description}
            </p>
          </div>
        )}

        <div>
          <div className="text-[10.5px] tracking-[.06em] uppercase text-faintest font-bold">Создал</div>
          <div className="text-[13px] text-muted mt-1">{event.createdByEmail || '—'}</div>
        </div>
      </div>

      <div className="shrink-0 flex gap-2 px-5 py-4 border-t border-line">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 h-9 rounded-lg border border-line text-[13px] font-semibold text-muted hover:bg-sidebar"
        >
          Редактировать
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="h-9 px-4 rounded-lg bg-danger/10 text-danger text-[13px] font-semibold hover:bg-danger/15 disabled:opacity-50"
        >
          {deleting ? '…' : 'Удалить'}
        </button>
      </div>
    </div>
  )
}
