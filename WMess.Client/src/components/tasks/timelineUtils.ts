import type { TeamScheduleSettings } from '../../api/tasksApi'

const DAY_MS = 86400000
const HOUR_MS = 3600000

export function workStartHour(settings: TeamScheduleSettings) {
  return settings.workStartHour ?? 9
}

export function workPeriodStartForDay(day: Date, settings: TeamScheduleSettings) {
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  d.setHours(workStartHour(settings), 0, 0, 0)
  return d
}

export function normalizeToLocalWorkDayStart(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function dateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type DayKind = 'past' | 'today' | 'future'

export function getDayKind(d: Date): DayKind {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const t = day.getTime() - today.getTime()
  if (t < 0) return 'past'
  if (t === 0) return 'today'
  return 'future'
}

export function dayHeaderClasses(kind: DayKind, off: boolean) {
  if (kind === 'today') {
    return off
      ? 'bg-accent-soft/70 text-accent ring-1 ring-inset ring-accent/25'
      : 'bg-accent-soft text-accent'
  }
  if (kind === 'past') {
    return off ? 'bg-[#dfe6e1] text-faint' : 'bg-[#e8ede9] text-muted'
  }
  return off ? 'bg-[#f0eeea] text-faint' : 'text-ink'
}

export function dayGridClasses(kind: DayKind, off: boolean) {
  if (kind === 'today') {
    return off ? 'bg-accent-soft/35' : 'bg-accent-soft/50'
  }
  if (kind === 'past') {
    return off ? 'bg-[#dfe6e1]/80' : 'bg-[#e8ede9]/90'
  }
  return off ? 'bg-[#f0eeea]/70' : ''
}

export function isNonWorking(date: Date, workingDays: number, holidays: Set<string>) {
  if (holidays.has(dateKey(date))) return true
  return (workingDays & (1 << date.getDay())) === 0
}

export function skipToWorkingDay(
  dt: Date,
  workingDays: number,
  holidays: Set<string>,
  settings: TeamScheduleSettings,
) {
  const d = new Date(dt)
  while (isNonWorking(d, workingDays, holidays)) d.setDate(d.getDate() + 1)
  return workPeriodStartForDay(d, settings)
}

function advanceToNextWorkPeriod(current: Date, settings: TeamScheduleSettings, holidays: Set<string>) {
  const d = new Date(current)
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  while (isNonWorking(d, settings.workingDays, holidays)) d.setDate(d.getDate() + 1)
  return workPeriodStartForDay(d, settings)
}

export function addWorkingHours(
  start: Date,
  hours: number,
  settings: TeamScheduleSettings,
  holidays: Set<string>,
) {
  let remaining = hours
  const current = new Date(start)

  while (remaining > 0) {
    if (isNonWorking(current, settings.workingDays, holidays)) {
      const next = advanceToNextWorkPeriod(current, settings, holidays)
      current.setTime(next.getTime())
      continue
    }

    const periodStart = workPeriodStartForDay(current, settings)
    if (current.getTime() < periodStart.getTime()) current.setTime(periodStart.getTime())

    const hourInPeriod = (current.getTime() - periodStart.getTime()) / HOUR_MS
    if (hourInPeriod >= settings.hoursPerDay) {
      const next = advanceToNextWorkPeriod(current, settings, holidays)
      current.setTime(next.getTime())
      continue
    }

    const capacityToday = settings.hoursPerDay - hourInPeriod
    if (capacityToday <= 0) {
      const next = advanceToNextWorkPeriod(current, settings, holidays)
      current.setTime(next.getTime())
      continue
    }

    const use = Math.min(remaining, capacityToday)
    remaining -= use
    current.setTime(current.getTime() + use * HOUR_MS)
    if (remaining > 0) {
      const next = advanceToNextWorkPeriod(current, settings, holidays)
      current.setTime(next.getTime())
    }
  }
  return current
}

export interface WorkingDaySpan {
  day: Date
  hours: number
  hourOffset: number
}

/** Working-day portions of a task (weekends/holidays skipped). */
export function getWorkingDaySpans(
  start: Date,
  totalHours: number,
  settings: TeamScheduleSettings,
  holidays: Set<string>,
): WorkingDaySpan[] {
  const spans: WorkingDaySpan[] = []
  let remaining = totalHours
  const current = new Date(start)

  while (remaining > 0) {
    if (isNonWorking(current, settings.workingDays, holidays)) {
      const next = advanceToNextWorkPeriod(current, settings, holidays)
      current.setTime(next.getTime())
      continue
    }

    const periodStart = workPeriodStartForDay(current, settings)
    if (current.getTime() < periodStart.getTime()) current.setTime(periodStart.getTime())

    const dayStart = new Date(periodStart)
    dayStart.setHours(0, 0, 0, 0)
    const hourOffset = (current.getTime() - periodStart.getTime()) / HOUR_MS

    if (hourOffset >= settings.hoursPerDay) {
      const next = advanceToNextWorkPeriod(current, settings, holidays)
      current.setTime(next.getTime())
      continue
    }

    const capacityToday = settings.hoursPerDay - hourOffset
    if (capacityToday <= 0) {
      const next = advanceToNextWorkPeriod(current, settings, holidays)
      current.setTime(next.getTime())
      continue
    }

    const use = Math.min(remaining, capacityToday)
    if (use <= 0) break
    spans.push({ day: dayStart, hours: use, hourOffset })
    remaining -= use
    const next = advanceToNextWorkPeriod(current, settings, holidays)
    current.setTime(next.getTime())
  }

  return spans
}

export interface TimeInterval {
  start: Date
  end: Date
}

export function getTaskIntervals(
  start: Date,
  totalHours: number,
  settings: TeamScheduleSettings,
  holidays: Set<string>,
): TimeInterval[] {
  return getWorkingDaySpans(start, totalHours, settings, holidays).map((span) => {
    const periodStart = workPeriodStartForDay(span.day, settings)
    return {
      start: new Date(periodStart.getTime() + span.hourOffset * HOUR_MS),
      end: new Date(periodStart.getTime() + (span.hourOffset + span.hours) * HOUR_MS),
    }
  })
}

export interface BarSegment {
  left: number
  width: number
}

export function getBarSegments(
  start: Date,
  totalHours: number,
  timelineStart: Date,
  pxPerDay: number,
  settings: TeamScheduleSettings,
  holidays: Set<string>,
): BarSegment[] {
  const pxPerHour = pxPerDay / settings.hoursPerDay
  const spans = getWorkingDaySpans(start, totalHours, settings, holidays)

  return spans
    .filter((span) => !isNonWorking(span.day, settings.workingDays, holidays))
    .map((span) => {
      const dayIndex = dayIndexFromDate(span.day, timelineStart)
      const left = dayIndex * pxPerDay + span.hourOffset * pxPerHour
      const width = Math.max(span.hours * pxPerHour, pxPerHour * 0.5)
      return { left, width }
    })
    .filter((seg) => seg.left + seg.width > 0)
}

export function startFromSlotExact(
  dayIndex: number,
  hourOffset: number,
  timelineStart: Date,
  workingDays: number,
  holidays: Set<string>,
  settings: TeamScheduleSettings,
): Date | null {
  const day = dateFromDayIndex(dayIndex, timelineStart)
  if (isNonWorking(day, workingDays, holidays)) return null
  const periodStart = workPeriodStartForDay(day, settings)
  return new Date(periodStart.getTime() + hourOffset * HOUR_MS)
}

export function startFromSlot(
  dayIndex: number,
  hourOffset: number,
  timelineStart: Date,
  workingDays: number,
  holidays: Set<string>,
  settings: TeamScheduleSettings,
) {
  const exact = startFromSlotExact(dayIndex, hourOffset, timelineStart, workingDays, holidays, settings)
  if (exact) return exact
  let start = skipToWorkingDay(dateFromDayIndex(dayIndex, timelineStart), workingDays, holidays, settings)
  return new Date(start.getTime() + hourOffset * HOUR_MS)
}

export function slotFromLaneX(
  taskLeftPx: number,
  pxPerDay: number,
  hoursPerDay: number,
  days: number,
) {
  const pxPerHour = pxPerDay / hoursPerDay
  const dayIndex = Math.max(0, Math.min(days - 1, Math.floor(taskLeftPx / pxPerDay)))
  const hourOffset = Math.min(
    hoursPerDay - 1,
    Math.max(0, Math.floor((taskLeftPx % pxPerDay) / pxPerHour)),
  )
  return { dayIndex, hourOffset }
}

export function slotFromDate(date: Date, timelineStart: Date, settings: TeamScheduleSettings) {
  const dayIndex = dayIndexFromDate(date, timelineStart)
  const periodStart = workPeriodStartForDay(dateFromDayIndex(dayIndex, timelineStart), settings)
  const hourOffset = Math.min(
    Math.max(0, settings.hoursPerDay - 1),
    Math.max(0, Math.floor((date.getTime() - periodStart.getTime()) / HOUR_MS)),
  )
  return { dayIndex, hourOffset }
}

export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA
}

export function intervalsOverlap(a: TimeInterval[], b: TimeInterval[]) {
  for (const ia of a) {
    for (const ib of b) {
      if (rangesOverlap(ia.start, ia.end, ib.start, ib.end)) return true
    }
  }
  return false
}

export function isInPast(date: Date, now = new Date()) {
  return date.getTime() < now.getTime()
}

export function dayIndexFromDate(date: Date, timelineStart: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const t = new Date(timelineStart)
  t.setHours(0, 0, 0, 0)
  return Math.floor((d.getTime() - t.getTime()) / DAY_MS)
}

export function dateFromDayIndex(index: number, timelineStart: Date) {
  const d = new Date(timelineStart)
  d.setDate(d.getDate() + index)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatWorkHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

export function workEndHour(settings: TeamScheduleSettings) {
  return workStartHour(settings) + settings.hoursPerDay
}
