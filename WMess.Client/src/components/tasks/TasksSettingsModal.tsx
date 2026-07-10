import { useEffect, useState } from 'react'
import { tasksApi, type TaskBoardColumn, type TaskGroup, type TeamHoliday, type TeamScheduleSettings } from '../../api/tasksApi'
import { TaskGroupSettingsPanel } from './TaskGroupSettingsPanel'
import { ConfirmDialog, FormModal } from '../WorkspaceModals'
import { PencilIcon, PlusIcon, TrashIcon } from '../../workspace/icons'

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

type SettingsTab = 'calendar' | 'statuses' | 'groups'

function ColorCirclePicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}) {
  return (
    <label className="relative w-8 h-8 shrink-0 cursor-pointer disabled:opacity-50">
      <span
        className="block w-full h-full rounded-full ring-1 ring-line"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
      />
    </label>
  )
}

function ColumnEditModal({
  initialName,
  initialColor,
  busy,
  onClose,
  onSubmit,
}: {
  initialName: string
  initialColor: string
  busy: boolean
  onClose: () => void
  onSubmit: (name: string, color: string) => void
}) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/30" onMouseDown={onClose}>
      <div
        className="w-[360px] bg-white rounded-2xl border border-line p-5 shadow-xl font-ui"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink">Изменить статус</h2>
        <label className="block mt-4 text-[11px] font-bold text-faint uppercase">Название</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
        />
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[11px] font-bold text-faint uppercase">Цвет</span>
          <ColorCirclePicker value={color} onChange={setColor} disabled={busy} />
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-lg border border-line text-[13px] font-semibold text-muted"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => onSubmit(name.trim(), color)}
            className="px-4 h-9 rounded-lg bg-accent text-white text-[13px] font-semibold disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

interface TasksSettingsModalProps {
  teamId: number
  columns: TaskBoardColumn[]
  groups: TaskGroup[]
  schedule: TeamScheduleSettings
  holidays: TeamHoliday[]
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onCalendarFromTodayChanged?: (value: boolean) => void
}

export function TasksSettingsModal({
  teamId,
  columns,
  groups,
  schedule,
  holidays,
  canManage,
  onClose,
  onChanged,
  onCalendarFromTodayChanged,
}: TasksSettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('calendar')
  const [columnItems, setColumnItems] = useState(columns)
  const [workingDays, setWorkingDays] = useState(schedule.workingDays)
  const [workStartHour, setWorkStartHour] = useState(schedule.workStartHour ?? 9)
  const [workEndHour, setWorkEndHour] = useState((schedule.workStartHour ?? 9) + schedule.hoursPerDay)
  const [holidayList, setHolidayList] = useState(holidays)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [editingColumn, setEditingColumn] = useState<TaskBoardColumn | null>(null)
  const [deletingColumn, setDeletingColumn] = useState<TaskBoardColumn | null>(null)
  const [applyFromToday, setApplyFromToday] = useState(
    () => localStorage.getItem(`wmess-calendar-from-today-${teamId}`) !== 'false',
  )

  useEffect(() => {
    setColumnItems(columns)
  }, [columns])

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'calendar', label: 'Календарь' },
    { id: 'statuses', label: 'Статусы' },
    { id: 'groups', label: 'Группы' },
  ]

  function toggleDay(dow: number) {
    if (!canManage) return
    setWorkingDays((prev) => prev ^ (1 << dow))
  }

  function isDayOn(dow: number) {
    return (workingDays & (1 << dow)) !== 0
  }

  function hourToTime(h: number) {
    return `${String(h).padStart(2, '0')}:00`
  }

  function timeToHour(value: string) {
    const h = Number.parseInt(value.split(':')[0] ?? '9', 10)
    return Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9
  }

  async function saveSettings() {
    setBusy(true)
    try {
      const hours = Math.max(1, workEndHour - workStartHour)
      localStorage.setItem(`wmess-calendar-from-today-${teamId}`, String(applyFromToday))
      await tasksApi.updateScheduleSettings(teamId, {
        workingDays,
        hoursPerDay: hours,
        workStartHour,
        timeZone: schedule.timeZone,
      })
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10)

  async function addHoliday() {
    if (!newDate) return
    if (applyFromToday && newDate < todayIso) return
    setBusy(true)
    try {
      const res = await tasksApi.addHoliday(teamId, { date: newDate, name: newName || undefined })
      setHolidayList((prev) => [...prev, res.data].sort((a, b) => a.date.localeCompare(b.date)))
      setNewDate('')
      setNewName('')
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function removeHoliday(id: string) {
    setBusy(true)
    try {
      await tasksApi.deleteHoliday(teamId, id)
      setHolidayList((prev) => prev.filter((h) => h.id !== id))
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function addColumn(name: string) {
    setBusy(true)
    setStatusError(null)
    try {
      await tasksApi.createColumn(teamId, { name, color: '#6B7280', isDoneColumn: false })
      setAddingColumn(false)
      await onChanged()
    } catch {
      setStatusError('Не удалось создать статус')
    } finally {
      setBusy(false)
    }
  }

  async function saveColumn(name: string, color: string) {
    if (!editingColumn) return
    if (name === editingColumn.name && color === editingColumn.color) {
      setEditingColumn(null)
      return
    }
    setBusy(true)
    try {
      await tasksApi.updateColumn(teamId, editingColumn.id, {
        name,
        color,
        isDoneColumn: editingColumn.isDoneColumn,
      })
      setColumnItems((prev) =>
        prev.map((c) => (c.id === editingColumn.id ? { ...c, name, color } : c)),
      )
      setEditingColumn(null)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function removeColumn(col: TaskBoardColumn, moveTo: string) {
    setBusy(true)
    try {
      await tasksApi.deleteColumn(teamId, col.id, moveTo)
      setDeletingColumn(null)
      await onChanged()
    } catch {
      setStatusError('Не удалось удалить статус')
    } finally {
      setBusy(false)
    }
  }

  function startDelete(col: TaskBoardColumn) {
    const others = columnItems.filter((c) => c.id !== col.id)
    if (others.length === 0) {
      setStatusError('Нельзя удалить последний статус')
      return
    }
    setDeletingColumn(col)
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30" onMouseDown={onClose}>
        <div
          className="w-[480px] max-h-[85vh] overflow-hidden flex flex-col bg-white rounded-2xl border border-line shadow-xl font-ui"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 p-5 border-b border-line">
            <h2 className="text-lg font-bold text-ink">Настройки задач</h2>
            <div className="mt-3 flex gap-1 rounded-lg border border-line overflow-hidden">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 px-2 py-1.5 text-[12px] font-semibold ${
                    tab === t.id ? 'bg-accent text-white' : 'bg-white text-muted hover:bg-sidebar'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {tab === 'calendar' && (
              <>
                <div>
                  <div className="text-[11px] font-bold text-faint uppercase">Рабочие дни</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DAY_NAMES.map((name, dow) => (
                      <button
                        key={name}
                        type="button"
                        disabled={!canManage}
                        onClick={() => toggleDay(dow)}
                        className={`w-10 h-10 rounded-lg text-[12px] font-bold border ${
                          isDayOn(dow) ? 'bg-accent text-white border-accent' : 'border-line text-muted'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-[11px] font-bold text-faint uppercase">Рабочее время</div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="flex-1 text-[12px] text-muted">
                      С
                      <input
                        type="time"
                        step={3600}
                        disabled={!canManage}
                        value={hourToTime(workStartHour)}
                        onChange={(e) => {
                          const start = timeToHour(e.target.value)
                          setWorkStartHour(start)
                          if (workEndHour <= start) setWorkEndHour(Math.min(24, start + 1))
                        }}
                        className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
                      />
                    </label>
                    <label className="flex-1 text-[12px] text-muted">
                      До
                      <input
                        type="time"
                        step={3600}
                        disabled={!canManage}
                        value={hourToTime(workEndHour)}
                        onChange={(e) => {
                          const end = timeToHour(e.target.value)
                          setWorkEndHour(Math.max(end, workStartHour + 1))
                        }}
                        className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
                      />
                    </label>
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted">
                    {Math.max(1, workEndHour - workStartHour)} ч. в день · распределение с первого рабочего часа
                  </p>
                </div>

                {canManage && (
                  <label className="mt-4 flex items-center gap-2 text-[13px] text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyFromToday}
                      onChange={(e) => {
                        const v = e.target.checked
                        setApplyFromToday(v)
                        localStorage.setItem(`wmess-calendar-from-today-${teamId}`, String(v))
                        onCalendarFromTodayChanged?.(v)
                      }}
                      className="rounded border-line"
                    />
                    Таймлайн и распределение с текущего дня (без прошлых дат)
                  </label>
                )}

                {canManage && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveSettings()}
                    className="mt-3 w-full h-9 rounded-lg bg-accent text-white font-semibold text-[13px]"
                  >
                    Сохранить календарь
                  </button>
                )}

                <div className="mt-6">
                  <div className="text-[11px] font-bold text-faint uppercase">Праздники</div>
                  <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {holidayList.map((h) => (
                      <li key={h.id} className="flex items-center gap-2 text-[13px]">
                        <span className="font-mono text-muted">{h.date}</span>
                        <span className="flex-1 truncate">{h.name ?? '—'}</span>
                        {canManage && (
                          <button type="button" onClick={() => void removeHoliday(h.id)} className="text-[#c44] text-[12px]">
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canManage && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="date"
                        value={newDate}
                        min={applyFromToday ? todayIso : undefined}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="flex-1 border border-line rounded-lg px-2 py-1.5 text-[13px]"
                      />
                      <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Название"
                        className="flex-1 border border-line rounded-lg px-2 py-1.5 text-[13px]"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void addHoliday()}
                        className="px-3 rounded-lg bg-sidebar font-semibold text-[12px]"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'statuses' && (
              <div>
                <p className="text-[13px] text-muted">Статусы задач на доске Kanban и в списке.</p>
                <ul className="mt-3 space-y-1.5">
                  {[...columnItems]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((col) => (
                      <li
                        key={col.id}
                        className="flex items-center gap-2 py-2 px-2.5 rounded-lg border border-line bg-sidebar"
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        <span className="flex-1 text-[13px] font-semibold truncate">{col.name}</span>
                        {col.isDoneColumn && (
                          <span className="text-[10px] text-faint uppercase shrink-0">готово</span>
                        )}
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setEditingColumn(col)}
                              className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-white"
                              title="Изменить"
                            >
                              <PencilIcon size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => startDelete(col)}
                              className="p-1.5 rounded-md text-muted hover:text-[#c44] hover:bg-white"
                              title="Удалить"
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
                {statusError && <p className="mt-2 text-[12px] text-[#c44]">{statusError}</p>}
                {canManage && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setAddingColumn(true)}
                    className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-accent text-white text-[13px] font-semibold"
                  >
                    <PlusIcon size={14} /> Добавить статус
                  </button>
                )}
              </div>
            )}

            {tab === 'groups' && (
              <TaskGroupSettingsPanel teamId={teamId} groups={groups} canManage={canManage} onChanged={onChanged} />
            )}
          </div>

          <div className="shrink-0 p-5 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="w-full h-9 rounded-lg border border-line text-[13px] font-semibold text-muted"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>

      {addingColumn && (
        <FormModal
          title="Новый статус"
          label="Название"
          submitLabel="Создать"
          busy={busy}
          onClose={() => setAddingColumn(false)}
          onSubmit={(name) => void addColumn(name)}
        />
      )}

      {editingColumn && (
        <ColumnEditModal
          initialName={editingColumn.name}
          initialColor={editingColumn.color}
          busy={busy}
          onClose={() => setEditingColumn(null)}
          onSubmit={(name, color) => void saveColumn(name, color)}
        />
      )}

      {deletingColumn && (
        <ConfirmDialog
          title="Удалить статус"
          message={
            <>
              Удалить «{deletingColumn.name}»? Задачи перенесутся в «
              {columnItems.filter((c) => c.id !== deletingColumn.id)[0]?.name}».
            </>
          }
          confirmLabel="Удалить"
          busy={busy}
          onClose={() => setDeletingColumn(null)}
          onConfirm={() => {
            const moveTo = columnItems.find((c) => c.id !== deletingColumn.id)?.id
            if (moveTo) void removeColumn(deletingColumn, moveTo)
          }}
        />
      )}
    </>
  )
}
