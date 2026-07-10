import { useMemo, useState } from 'react'
import { tasksApi, type TaskItem, type TeamHoliday, type TeamScheduleSettings } from '../../api/tasksApi'
import type { TeamMemberResponse } from '../../api/generated/data-contracts'
import { PRIORITY_COLORS } from '../../api/tasksApi'
import { initials, colorFor } from '../../workspace/theme'

type Scale = 'day' | 'week' | 'month'

interface TaskTimelineViewProps {
  tasks: TaskItem[]
  members: TeamMemberResponse[]
  schedule: TeamScheduleSettings | null
  holidays: TeamHoliday[]
  onSelect: (id: string) => void
  onRefresh: () => void
}

const DAY_MS = 86400000
const SCALES: { id: Scale; label: string; px: number }[] = [
  { id: 'day', label: 'День', px: 48 },
  { id: 'week', label: 'Неделя', px: 20 },
  { id: 'month', label: 'Месяц', px: 8 },
]

function isNonWorking(date: Date, workingDays: number, holidays: Set<string>) {
  const key = date.toISOString().slice(0, 10)
  if (holidays.has(key)) return true
  const dow = date.getDay()
  return (workingDays & (1 << dow)) === 0
}

export function TaskTimelineView({
  tasks,
  members,
  schedule,
  holidays,
  onSelect,
  onRefresh,
}: TaskTimelineViewProps) {
  const [scale, setScale] = useState<Scale>('week')
  const pxPerDay = SCALES.find((s) => s.id === scale)!.px
  const workingDays = schedule?.workingDays ?? 0b0111110
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])

  const start = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const days = 60
  const dayHeaders = Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY_MS)
    return d
  })

  const lanes = useMemo(() => {
    const map = new Map<string, { id: string; label: string; tasks: TaskItem[] }>()
    map.set('__none__', { id: '__none__', label: 'Без исполнителя', tasks: [] })

    for (const m of members) {
      map.set(m.userId ?? '', { id: m.userId ?? '', label: m.email ?? '', tasks: [] })
    }

    for (const task of tasks) {
      const key = task.primaryAssigneeId ?? task.assignedUserIds[0] ?? '__none__'
      if (!map.has(key)) map.set(key, { id: key, label: task.primaryAssigneeEmail ?? key, tasks: [] })
      map.get(key)!.tasks.push(task)
    }

    return [...map.values()].filter((l) => l.tasks.length > 0 || l.id !== '__none__' || tasks.some((t) => !t.primaryAssigneeId && t.assignedUserIds.length === 0))
  }, [tasks, members])

  async function onBarDragEnd(task: TaskItem, deltaDays: number) {
    const s = task.startDate ? new Date(task.startDate) : new Date()
    const e = task.dueDate ? new Date(task.dueDate) : new Date(s.getTime() + DAY_MS)
    const dur = e.getTime() - s.getTime()
    const newStart = new Date(s.getTime() + deltaDays * DAY_MS)
    const newEnd = new Date(newStart.getTime() + dur)
    try {
      await tasksApi.patch(task.id, {
        startDate: newStart.toISOString(),
        dueDate: newEnd.toISOString(),
        scheduleMode: 1,
      })
      await onRefresh()
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 flex gap-2 px-4 py-2 border-b border-line">
        {SCALES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScale(s.id)}
            className={`px-2 py-1 rounded text-[12px] font-semibold font-ui ${
              scale === s.id ? 'bg-accent text-white' : 'text-muted hover:bg-sidebar'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          <div className="flex sticky top-0 z-10 bg-panel border-b border-line">
            <div className="w-44 shrink-0 px-3 py-2 text-[11px] font-bold text-faint uppercase" />
            {dayHeaders.map((d) => {
              const off = isNonWorking(d, workingDays, holidaySet)
              return (
                <div
                  key={d.toISOString()}
                  style={{ width: pxPerDay }}
                  className={`shrink-0 text-center text-[10px] py-1 border-l border-line ${
                    off ? 'bg-[#f0eeea] text-faint' : 'text-muted'
                  }`}
                >
                  {d.getDate()}
                </div>
              )
            })}
          </div>

          {lanes.map((lane) => (
            <div key={lane.id} className="flex border-b border-line min-h-[52px]">
              <div className="w-44 shrink-0 px-3 py-2 flex items-center gap-2 border-r border-line bg-sidebar">
                <div
                  className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                  style={{ backgroundColor: colorFor(lane.id) }}
                >
                  {initials(lane.label)}
                </div>
                <span className="text-[12px] font-semibold truncate">{lane.label.split('@')[0]}</span>
              </div>
              <div className="relative flex-1" style={{ width: days * pxPerDay }}>
                {dayHeaders.map((d, i) =>
                  isNonWorking(d, workingDays, holidaySet) ? (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 bg-[#f0eeea]/80 pointer-events-none"
                      style={{ left: i * pxPerDay, width: pxPerDay }}
                    />
                  ) : null,
                )}
                {lane.tasks.map((task) => {
                  const s = task.startDate ? new Date(task.startDate) : task.dueDate ? new Date(task.dueDate) : null
                  if (!s) return null
                  const e = task.dueDate ? new Date(task.dueDate) : new Date(s.getTime() + DAY_MS)
                  const left = ((s.getTime() - start.getTime()) / DAY_MS) * pxPerDay
                  const width = Math.max(((e.getTime() - s.getTime()) / DAY_MS) * pxPerDay, pxPerDay * 0.5)
                  const manual = task.scheduleMode === 1
                  return (
                    <button
                      key={task.id}
                      type="button"
                      title={task.title}
                      onClick={() => onSelect(task.id)}
                      onPointerDown={(ev) => {
                        const startX = ev.clientX
                        const onMove = (me: PointerEvent) => {
                          const delta = Math.round((me.clientX - startX) / pxPerDay)
                          if (Math.abs(delta) >= 1) {
                            window.removeEventListener('pointermove', onMove)
                            window.removeEventListener('pointerup', onUp)
                            void onBarDragEnd(task, delta)
                          }
                        }
                        const onUp = () => {
                          window.removeEventListener('pointermove', onMove)
                          window.removeEventListener('pointerup', onUp)
                        }
                        window.addEventListener('pointermove', onMove)
                        window.addEventListener('pointerup', onUp)
                      }}
                      className={`absolute top-2 h-8 rounded-md px-2 text-left text-[11px] font-semibold text-white truncate shadow-sm hover:brightness-110 ${
                        manual ? 'ring-2 ring-dashed ring-ink/40' : ''
                      }`}
                      style={{
                        left,
                        width,
                        backgroundColor: PRIORITY_COLORS[task.priority],
                      }}
                    >
                      {task.title}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
