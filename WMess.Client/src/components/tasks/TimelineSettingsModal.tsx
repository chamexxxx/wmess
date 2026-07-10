import { useState } from 'react'
import { tasksApi, type TeamHoliday, type TeamScheduleSettings } from '../../api/tasksApi'

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

interface TimelineSettingsModalProps {
  teamId: number
  settings: TeamScheduleSettings
  holidays: TeamHoliday[]
  canManage: boolean
  onClose: () => void
  onChanged: () => void
}

export function TimelineSettingsModal({
  teamId,
  settings,
  holidays,
  canManage,
  onClose,
  onChanged,
}: TimelineSettingsModalProps) {
  const [workingDays, setWorkingDays] = useState(settings.workingDays)
  const [hoursPerDay, setHoursPerDay] = useState(settings.hoursPerDay)
  const [holidayList, setHolidayList] = useState(holidays)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  function toggleDay(dow: number) {
    if (!canManage) return
    setWorkingDays((prev) => prev ^ (1 << dow))
  }

  function isDayOn(dow: number) {
    return (workingDays & (1 << dow)) !== 0
  }

  async function saveSettings() {
    setBusy(true)
    try {
      await tasksApi.updateScheduleSettings(teamId, {
        workingDays,
        hoursPerDay,
        timeZone: settings.timeZone,
      })
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function addHoliday() {
    if (!newDate) return
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30" onMouseDown={onClose}>
      <div
        className="w-[440px] max-h-[85vh] overflow-y-auto bg-white rounded-2xl border border-line p-5 shadow-xl font-ui"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink">Календарь таймлайна</h2>

        <div className="mt-4">
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
          <label className="text-[11px] font-bold text-faint uppercase">Часов в рабочий день</label>
          <input
            type="number"
            min={1}
            max={24}
            disabled={!canManage}
            value={hoursPerDay}
            onChange={(e) => setHoursPerDay(Number(e.target.value))}
            className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
          />
        </div>

        {canManage && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveSettings()}
            className="mt-4 w-full h-9 rounded-lg bg-accent text-white font-semibold text-[13px]"
          >
            Сохранить настройки
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
                  <button
                    type="button"
                    onClick={() => void removeHoliday(h.id)}
                    className="text-[#c44] text-[12px]"
                  >
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

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full h-9 rounded-lg border border-line text-[13px] font-semibold text-muted"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}
