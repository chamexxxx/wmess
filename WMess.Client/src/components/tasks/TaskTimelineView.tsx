import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  tasksApi,
  type TaskGroup,
  type TaskItem,
  type TeamHoliday,
  type TeamScheduleSettings,
} from '../../api/tasksApi'
import type { TeamMemberResponse } from '../../api/generated/data-contracts'
import { TaskPriorityIcon } from './TaskPriorityIcon'
import {
  addWorkingHours,
  dateFromDayIndex,
  dateKey,
  getBarSegments,
  getTaskIntervals,
  intervalsOverlap,
  isInPast,
  dayGridClasses,
  dayHeaderClasses,
  getDayKind,
  isNonWorking,
  slotFromDate,
  slotFromLaneX,
  startFromSlotExact,
} from './timelineUtils'

type Scale = 'day' | 'week' | 'month'

interface TaskTimelineViewProps {
  tasks: TaskItem[]
  filterAssignee: string
  filterPriority: string
  groups: TaskGroup[]
  members: TeamMemberResponse[]
  schedule: TeamScheduleSettings | null
  holidays: TeamHoliday[]
  teamId: number
  projectId?: number
  calendarFromToday?: boolean
  onSelect: (id: string) => void
  onTaskUpdated: (task: TaskItem) => void
  onRefresh: () => void
}

type DragPreview = {
  taskId: string
  groupId: string
  dayIndex: number
  hourOffset: number
  blocked: boolean
}

const POOL_WIDTH = 240
const LANE_LABEL_WIDTH = 108
const ROW_HEIGHT = 44
const DAY_MS = 86400000
const DRAG_THRESHOLD = 8

const SCALES: { id: Scale; label: string; px: number }[] = [
  { id: 'day', label: 'День', px: 72 },
  { id: 'week', label: 'Неделя', px: 40 },
  { id: 'month', label: 'Месяц', px: 14 },
]

function isScheduled(task: TaskItem) {
  return Boolean(task.startDate)
}

function taskLaneId(task: TaskItem) {
  return task.primaryAssigneeId ?? task.assignedUserIds[0] ?? '__none__'
}

function matchesAssignee(task: TaskItem, assignee: string) {
  if (!assignee) return true
  return task.assignedUserIds.includes(assignee) || task.primaryAssigneeId === assignee
}

export function TaskTimelineView({
  tasks,
  filterAssignee,
  filterPriority,
  groups,
  members,
  schedule,
  holidays,
  teamId,
  projectId,
  calendarFromToday = true,
  onSelect,
  onTaskUpdated,
  onRefresh,
}: TaskTimelineViewProps) {
  const [scale, setScale] = useState<Scale>('week')
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)
  const [hovered, setHovered] = useState<{ id: string; title: string; x: number; y: number } | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const [busyGroup, setBusyGroup] = useState<string | null>(null)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRefs = useRef<HTMLDivElement[]>([])
  const dragPreviewRef = useRef<DragPreview | null>(null)
  const dragGrabOffsetRef = useRef(0)
  const dragSessionRef = useRef<{ pointerId: number; cleanup: () => void } | null>(null)

  const syncScrollLeft = useCallback((left: number, source?: HTMLDivElement) => {
    if (timelineScrollRef.current && timelineScrollRef.current !== source) {
      timelineScrollRef.current.scrollLeft = left
    }
    for (const el of bodyScrollRefs.current) {
      if (el && el !== source) el.scrollLeft = left
    }
  }, [])

  const pxPerDay = SCALES.find((s) => s.id === scale)!.px
  const workingDays = schedule?.workingDays ?? 0b0111110
  const hoursPerDay = schedule?.hoursPerDay ?? 8
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])

  const timelineStart = useMemo(() => {
    const d = new Date()
    if (!calendarFromToday) d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [calendarFromToday])

  const days = 60
  const timelineWidth = days * pxPerDay

  const dayHeaders = useMemo(
    () => Array.from({ length: days }, (_, i) => new Date(timelineStart.getTime() + i * DAY_MS)),
    [timelineStart, days],
  )

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.sortOrder - b.sortOrder), [groups])

  const settings = schedule ?? { workingDays, hoursPerDay, workStartHour: 9, timeZone: 'UTC' }

  const memberLabel = useCallback(
    (id: string) => {
      if (id === '__none__') return 'Без исполнителя'
      return members.find((m) => m.userId === id)?.email?.split('@')[0] ?? id
    },
    [members],
  )

  function lanesForGroup(groupId: string) {
    const groupTasks = tasks.filter(
      (t) => t.groupId === groupId && !t.isDoneColumn && isScheduled(t) && taskLaneId(t) !== '__none__',
    )
    const assigneeIds = new Set<string>()

    for (const t of groupTasks) {
      assigneeIds.add(taskLaneId(t))
    }

    return [...assigneeIds]
      .sort((a, b) => memberLabel(a).localeCompare(memberLabel(b), 'ru'))
      .map((id) => ({ id, label: memberLabel(id) }))
  }

  function poolTasksForGroup(groupId: string) {
    let list = tasks.filter((t) => {
      if (t.groupId !== groupId || t.isDoneColumn) return false
      if (taskLaneId(t) === '__none__') return true
      return !isScheduled(t)
    })
    if (filterAssignee) list = list.filter((t) => matchesAssignee(t, filterAssignee))
    if (filterPriority !== '') list = list.filter((t) => t.priority === Number(filterPriority))
    list.sort((a, b) => b.priority - a.priority)
    return list
  }

  function scheduledTasksForLane(groupId: string, laneId: string) {
    return tasks.filter((t) => t.groupId === groupId && isScheduled(t) && taskLaneId(t) === laneId)
  }

  async function distributeGroup(groupId: string) {
    setBusyGroup(groupId)
    try {
      await tasksApi.recalculate(teamId, {
        projectId,
        groupId,
        anchorLocalDate: dateKey(new Date()),
      })
      await onRefresh()
    } finally {
      setBusyGroup(null)
    }
  }

  async function placeAtSlot(task: TaskItem, dayIndex: number, hourOffset: number) {
    const start = startFromSlotExact(dayIndex, hourOffset, timelineStart, workingDays, holidaySet, settings)
    if (!start) return
    const end = addWorkingHours(start, task.estimatedHours || hoursPerDay, settings, holidaySet)
    const optimistic = { ...task, startDate: start.toISOString(), dueDate: end.toISOString() }
    onTaskUpdated(optimistic)
    try {
      const res = await tasksApi.patch(task.id, {
        startDate: start.toISOString(),
        dueDate: end.toISOString(),
      })
      onTaskUpdated(res.data)
    } catch {
      onTaskUpdated(task)
    }
  }

  function wouldOverlap(task: TaskItem, proposedStart: Date, excludeTaskId: string) {
    const hours = task.estimatedHours || hoursPerDay
    const proposed = getTaskIntervals(proposedStart, hours, settings, holidaySet)
    const laneId = taskLaneId(task)
    const others = tasks.filter(
      (t) =>
        t.groupId === task.groupId &&
        isScheduled(t) &&
        taskLaneId(t) === laneId &&
        t.id !== excludeTaskId,
    )
    for (const other of others) {
      const otherIntervals = getTaskIntervals(
        new Date(other.startDate!),
        other.estimatedHours || hoursPerDay,
        settings,
        holidaySet,
      )
      if (intervalsOverlap(proposed, otherIntervals)) return true
    }
    return false
  }

  function isBlockedSlot(dayIndex: number, hourOffset: number, task: TaskItem) {
    if (taskLaneId(task) === '__none__') return true
    const proposedStart = startFromSlotExact(dayIndex, hourOffset, timelineStart, workingDays, holidaySet, settings)
    if (!proposedStart) return true
    if (isInPast(proposedStart)) return true
    return wouldOverlap(task, proposedStart, task.id)
  }

  function laneHitFromPoint(clientX: number, clientY: number, grabOffsetPx: number) {
    const el = document.elementFromPoint(clientX, clientY)
    const laneEl = el?.closest('[data-timeline-lane]') as HTMLElement | null
    if (!laneEl) return null
    const rect = laneEl.getBoundingClientRect()
    const taskLeftPx = clientX - rect.left - grabOffsetPx
    const { dayIndex, hourOffset } = slotFromLaneX(taskLeftPx, pxPerDay, hoursPerDay, days)
    const day = dateFromDayIndex(dayIndex, timelineStart)
    return {
      groupId: laneEl.dataset.groupId!,
      laneId: laneEl.dataset.laneId!,
      dayIndex,
      hourOffset,
      isWorkingDay: !isNonWorking(day, workingDays, holidaySet),
    }
  }

  async function unscheduleTask(taskId: string) {
    try {
      const res = await tasksApi.patch(taskId, { clearSchedule: true })
      onTaskUpdated(res.data)
    } catch {
      /* ignore */
    }
  }

  const updatePreviewFromPoint = useCallback(
    (clientX: number, clientY: number, taskId: string, grabOffsetPx: number) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task || taskLaneId(task) === '__none__') return
      const hit = laneHitFromPoint(clientX, clientY, grabOffsetPx)
      if (!hit || hit.groupId !== task.groupId || hit.laneId !== taskLaneId(task)) {
        return
      }
      if (!hit.isWorkingDay) {
        return
      }
      const blocked = isBlockedSlot(hit.dayIndex, hit.hourOffset, task)
      const next = {
        taskId,
        groupId: hit.groupId,
        dayIndex: hit.dayIndex,
        hourOffset: hit.hourOffset,
        blocked,
      }
      dragPreviewRef.current = next
      setDragPreview(next)
    },
    [tasks, timelineStart, workingDays, holidaySet, pxPerDay, hoursPerDay, days],
  )

  const commitDropAtPoint = useCallback(
    async (clientX: number, clientY: number, taskId: string) => {
      const poolHit = document.elementFromPoint(clientX, clientY)?.closest('[data-pool-zone]')
      const task = tasks.find((t) => t.id === taskId)
      if (!task || taskLaneId(task) === '__none__') return

      if (poolHit && isScheduled(task)) {
        await unscheduleTask(task.id)
        return
      }

      const preview = dragPreviewRef.current
      if (!preview || preview.taskId !== taskId || preview.blocked) return

      await placeAtSlot(task, preview.dayIndex, preview.hourOffset)
    },
    [tasks, timelineStart, workingDays, holidaySet, onTaskUpdated],
  )

  function beginPointerDrag(taskId: string, e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()

    dragSessionRef.current?.cleanup()

    const target = e.currentTarget as HTMLElement
    const laneEl = target.closest('[data-timeline-lane]') as HTMLElement | null
    const task = tasks.find((t) => t.id === taskId)

    if (laneEl && task?.startDate) {
      const laneRect = laneEl.getBoundingClientRect()
      const barStart = new Date(task.startDate)
      const slot = slotFromDate(barStart, timelineStart, settings)
      const startLeftPx = slot.dayIndex * pxPerDay + slot.hourOffset * (pxPerDay / hoursPerDay)
      dragGrabOffsetRef.current = e.clientX - laneRect.left - startLeftPx
    } else {
      const barRect = target.getBoundingClientRect()
      dragGrabOffsetRef.current = e.clientX - barRect.left
    }

    const startX = e.clientX
    const startY = e.clientY
    let activated = false
    const pointerId = e.pointerId
    const grabOffset = dragGrabOffsetRef.current

    try {
      target.setPointerCapture(pointerId)
    } catch {
      /* ignore */
    }

    const endDrag = () => {
      dragPreviewRef.current = null
      setDragPreview(null)
      dragSessionRef.current = null
    }

    const onMove = (me: PointerEvent) => {
      if (me.pointerId !== pointerId) return
      if (!activated && Math.hypot(me.clientX - startX, me.clientY - startY) > DRAG_THRESHOLD) {
        activated = true
        updatePreviewFromPoint(me.clientX, me.clientY, taskId, grabOffset)
      } else if (activated) {
        updatePreviewFromPoint(me.clientX, me.clientY, taskId, grabOffset)
      }
    }

    const onEnd = (me: PointerEvent) => {
      if (me.pointerId !== pointerId) return
      cleanup()
      void (async () => {
        try {
          if (!activated) {
            onSelect(taskId)
          } else {
            await commitDropAtPoint(me.clientX, me.clientY, taskId)
          }
        } finally {
          endDrag()
        }
      })()
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onEnd, true)
      window.removeEventListener('pointercancel', onEnd, true)
      window.removeEventListener('blur', onBlur, true)
      try {
        if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
      } catch {
        /* ignore */
      }
    }

    const onBlur = () => {
      cleanup()
      endDrag()
    }

    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onEnd, true)
    window.addEventListener('pointercancel', onEnd, true)
    window.addEventListener('blur', onBlur, true)

    dragSessionRef.current = {
      pointerId,
      cleanup: () => {
        cleanup()
        endDrag()
      },
    }
  }

  useEffect(() => {
    return () => dragSessionRef.current?.cleanup()
  }, [])

  const monthSpans = useMemo(() => {
    const spans: { start: number; count: number; label: string }[] = []
    let i = 0
    while (i < dayHeaders.length) {
      const d = dayHeaders[i]
      const m = d.getMonth()
      const y = d.getFullYear()
      let count = 0
      while (
        i + count < dayHeaders.length &&
        dayHeaders[i + count].getMonth() === m &&
        dayHeaders[i + count].getFullYear() === y
      ) {
        count++
      }
      spans.push({
        start: i,
        count,
        label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
      })
      i += count
    }
    return spans
  }, [dayHeaders])

  function renderTaskBar(
    task: TaskItem,
    top: number,
    options: { preview?: boolean; hidden?: boolean },
  ) {
    const hours = task.estimatedHours || hoursPerDay
    const barStart = options.preview
      ? startFromSlotExact(
          dragPreview!.dayIndex,
          dragPreview!.hourOffset,
          timelineStart,
          workingDays,
          holidaySet,
          settings,
        )
      : new Date(task.startDate!)
    if (!barStart) return null
    const segments = getBarSegments(barStart, hours, timelineStart, pxPerDay, settings, holidaySet)
    if (segments.length === 0) return null

    const blocked = options.preview && dragPreview?.blocked
    const color = blocked ? '#EF4444' : task.columnColor || '#6B7280'
    const opacity = options.hidden ? 0.25 : options.preview ? 0.5 : 1
    const isHovered = hoveredTaskId === task.id

    if (options.preview) {
      return (
        <>
          {segments.map((seg, segIdx) => (
            <div
              key={`preview-${task.id}-${segIdx}`}
              className="absolute h-8 pointer-events-none z-10"
              style={{ left: seg.left, width: seg.width, top, opacity, backgroundColor: color }}
            />
          ))}
        </>
      )
    }

    return (
      <>
        {segments.map((seg, segIdx) => (
          <div
            key={`${task.id}-${segIdx}`}
            data-task-bar={task.id}
            role="button"
            tabIndex={0}
            className={`absolute h-8 cursor-grab active:cursor-grabbing touch-none select-none shadow-sm z-10 transition-[filter] ${
              isHovered ? 'brightness-110' : ''
            }`}
            style={{ left: seg.left, width: seg.width, top, opacity, backgroundColor: color }}
            onMouseEnter={(e) => {
              setHoveredTaskId(task.id)
              setHovered({
                id: task.id,
                title: task.title,
                x: e.clientX,
                y: e.clientY,
              })
            }}
            onMouseMove={(e) =>
              setHovered((h) =>
                h?.id === task.id ? { ...h, x: e.clientX, y: e.clientY } : h,
              )
            }
            onMouseLeave={(e) => {
              const related = e.relatedTarget as HTMLElement | null
              if (related?.closest(`[data-task-bar="${task.id}"]`)) return
              setHoveredTaskId((id) => (id === task.id ? null : id))
              setHovered((h) => (h?.id === task.id ? null : h))
            }}
            onPointerDown={(ev) => beginPointerDrag(task.id, ev)}
          />
        ))}
      </>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 font-ui">
      <div className="shrink-0 flex gap-2 px-4 py-2 border-b border-line">
        {SCALES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScale(s.id)}
            className={`px-2 py-1 rounded text-[12px] font-semibold ${
              scale === s.id ? 'bg-accent text-white' : 'text-muted hover:bg-sidebar'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex shrink-0">
        <div
          className="shrink-0 sticky left-0 z-30 bg-panel border-r border-b border-line px-3 flex flex-col justify-end"
          style={{ width: POOL_WIDTH }}
        >
          <div className="h-6" />
          <div className="h-9 flex items-center text-[11px] font-bold text-faint uppercase border-t border-line">
            Пул задач
          </div>
        </div>

        <div
          ref={timelineScrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden border-b border-line"
          onScroll={(e) => syncScrollLeft(e.currentTarget.scrollLeft, e.currentTarget)}
        >
          <div style={{ width: LANE_LABEL_WIDTH + timelineWidth }}>
            <div className="flex h-6 border-b border-line/60">
              <div
                className="shrink-0 sticky left-0 z-20 bg-panel border-r border-line"
                style={{ width: LANE_LABEL_WIDTH }}
              />
              <div className="relative shrink-0" style={{ width: timelineWidth, height: 24 }}>
                {monthSpans.map((m) => (
                  <div
                    key={`${m.start}-${m.label}`}
                    className="absolute top-0 h-6 flex items-center px-2 text-[11px] font-bold text-muted capitalize border-l border-line"
                    style={{ left: m.start * pxPerDay, width: m.count * pxPerDay }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex h-9">
              <div
                className="shrink-0 sticky left-0 z-20 bg-panel px-2 h-9 flex items-center text-[11px] font-bold text-faint uppercase border-r border-line"
                style={{ width: LANE_LABEL_WIDTH }}
              >
                Исполнитель
              </div>
              <div className="flex shrink-0">
                {dayHeaders.map((d) => {
                  const off = isNonWorking(d, workingDays, holidaySet)
                  const kind = getDayKind(d)
                  return (
                    <div
                      key={d.toISOString()}
                      style={{ width: pxPerDay }}
                      className={`shrink-0 h-9 flex flex-col items-center justify-center leading-none border-l border-line ${dayHeaderClasses(kind, off)} ${
                        kind === 'today' ? 'font-bold' : ''
                      }`}
                    >
                      <span className="text-[12px] font-semibold">{d.getDate()}</span>
                      <span className="text-[9px] font-normal text-muted mt-0.5">
                        {d.toLocaleDateString('ru-RU', { weekday: 'short' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {sortedGroups.map((group, groupIdx) => {
          const pool = poolTasksForGroup(group.id)
          const lanes = lanesForGroup(group.id)
          const sectionHeight = Math.max(lanes.length, 1) * ROW_HEIGHT
          const distributableCount = pool.filter((t) => taskLaneId(t) !== '__none__').length

          return (
            <section key={group.id} className="border-b border-line shrink-0">
              <div className="flex">
                <div
                  data-pool-zone
                  className="shrink-0 sticky left-0 z-20 flex flex-col border-r border-line bg-sidebar"
                  style={{ width: POOL_WIDTH, minHeight: sectionHeight }}
                >
                  <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 bg-sidebar border-b border-line">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                      <span className="text-[13px] font-bold text-ink truncate">{group.name}</span>
                    </div>
                    <button
                      type="button"
                      disabled={busyGroup === group.id || distributableCount === 0}
                      onClick={() => void distributeGroup(group.id)}
                      className="shrink-0 h-6 px-2 rounded bg-accent text-white text-[10px] font-semibold disabled:opacity-50"
                    >
                      {busyGroup === group.id ? '…' : 'Распределить'}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[80px]">
                    {pool.map((task) => (
                      <div
                        key={task.id}
                        onPointerDown={(e) => beginPointerDrag(task.id, e)}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-line bg-white cursor-grab active:cursor-grabbing hover:shadow-sm text-[11px] touch-none select-none"
                      >
                        <TaskPriorityIcon priority={task.priority} size={12} />
                        <span className="truncate font-semibold">{task.title}</span>
                      </div>
                    ))}
                    {pool.length === 0 && (
                      <div className="text-[10px] text-faint text-center py-2">
                        Пул пуст — перетащите сюда задачу с таймлайна
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="flex-1 overflow-x-auto"
                  ref={(el) => {
                    bodyScrollRefs.current[groupIdx] = el!
                  }}
                  onScroll={(e) => syncScrollLeft(e.currentTarget.scrollLeft, e.currentTarget)}
                >
                  <div style={{ width: LANE_LABEL_WIDTH + timelineWidth }}>
                    {lanes.map((lane) => {
                      const laneTasks = scheduledTasksForLane(group.id, lane.id)
                      const previewTask = dragPreview ? tasks.find((t) => t.id === dragPreview.taskId) : null
                      const showPreview =
                        dragPreview &&
                        previewTask &&
                        dragPreview.groupId === group.id &&
                        taskLaneId(previewTask) === lane.id

                      return (
                        <div
                          key={lane.id}
                          className="flex border-b border-line/60"
                          style={{ height: ROW_HEIGHT }}
                        >
                          <div
                            className="shrink-0 sticky left-0 z-10 flex items-center px-2 text-[11px] font-semibold text-muted bg-panel border-r border-line truncate"
                            style={{ width: LANE_LABEL_WIDTH }}
                            title={lane.label}
                          >
                            {lane.label}
                          </div>

                          <div
                            data-timeline-lane
                            data-group-id={group.id}
                            data-lane-id={lane.id}
                            className="relative shrink-0"
                            style={{ width: timelineWidth, height: ROW_HEIGHT }}
                          >
                            {dayHeaders.map((d, i) => {
                              const off = isNonWorking(d, workingDays, holidaySet)
                              const kind = getDayKind(d)
                              return (
                                <div
                                  key={i}
                                  className={`absolute top-0 bottom-0 border-l border-line/40 ${dayGridClasses(kind, off)} ${
                                    kind === 'today' ? 'ring-1 ring-inset ring-accent/20' : ''
                                  }`}
                                  style={{ left: i * pxPerDay, width: pxPerDay }}
                                />
                              )
                            })}

                            {laneTasks.map((task) =>
                              renderTaskBar(task, 6, {
                                hidden: dragPreview?.taskId === task.id,
                              }),
                            )}

                            {showPreview && previewTask && renderTaskBar(previewTask, 6, { preview: true })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {hovered && (
        <div
          className="fixed z-[60] pointer-events-none px-2 py-1 rounded-md bg-ink text-white text-[12px] font-semibold shadow-lg -translate-x-1/2 -translate-y-full"
          style={{ left: hovered.x, top: hovered.y - 8 }}
        >
          {hovered.title}
        </div>
      )}
    </div>
  )
}
