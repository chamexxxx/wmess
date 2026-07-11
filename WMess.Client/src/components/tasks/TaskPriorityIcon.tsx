import type { TaskPriority } from '../../api/tasksApi'

interface TaskPriorityIconProps {
  priority: TaskPriority
  size?: number
  className?: string
}

export function TaskPriorityIcon({ priority, size = 14, className = '' }: TaskPriorityIconProps) {
  const s = size

  if (priority === 3) {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" className={className} aria-label="Критический">
        <path d="M2 9 L8 3 L14 9" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 14 L8 8 L14 14" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (priority === 2) {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" className={className} aria-label="Высокий">
        <path d="M2 11 L8 5 L14 11" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (priority === 1) {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" className={className} aria-label="Средний">
        <path d="M2 6 H14" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" />
        <path d="M2 10 H14" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg width={s} height={s} viewBox="0 0 16 16" className={className} aria-label="Низкий">
      <path d="M2 7 L8 13 L14 7" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
