import type { TaskGroup, TaskItem } from '../../api/tasksApi'
import { PRIORITY_LABELS } from '../../api/tasksApi'
import { TaskPriorityIcon } from './TaskPriorityIcon'
import { Avatar } from '../Avatar'

interface TaskListViewProps {
  tasks: TaskItem[]
  groups: TaskGroup[]
  onSelect: (id: string) => void
}

const COLS = 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]'

export function TaskListView({ tasks, groups, onSelect }: TaskListViewProps) {
  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder)

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm p-8 text-center">
        Задач пока нет. Создайте первую кнопкой «Задача».
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className={`grid ${COLS} gap-0 text-[13px] font-ui sticky top-0 z-10 bg-panel border-b border-line text-faint text-[11px] uppercase tracking-wide`}>
        <div className="px-4 py-2 font-semibold">Название</div>
        <div className="px-4 py-2 font-semibold">Статус</div>
        <div className="px-4 py-2 font-semibold">Приоритет</div>
        <div className="px-4 py-2 font-semibold">Исполнители</div>
        <div className="px-4 py-2 font-semibold">Срок</div>
      </div>

      <div className="space-y-6 pt-4">
        {sortedGroups.map((group) => {
          const groupTasks = tasks.filter((t) => t.groupId === group.id)
          if (groupTasks.length === 0) return null

          return (
            <section key={group.id}>
              <div className="flex items-center gap-2 mb-2 px-4">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                <h3 className="text-[14px] font-bold text-ink font-ui">{group.name}</h3>
              </div>
              <div>
                {groupTasks.map((task) => {
                  const overdue =
                    task.dueDate && !task.isDoneColumn && new Date(task.dueDate) < new Date()
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelect(task.id)}
                      className={`grid ${COLS} border-t border-line hover:bg-sidebar cursor-pointer items-center`}
                    >
                      <div className="px-4 py-2.5 font-semibold text-ink truncate">{task.title}</div>
                      <div className="px-4 py-2.5">
                        <span
                          className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold text-white"
                          style={{ backgroundColor: task.columnColor }}
                        >
                          {task.columnName}
                        </span>
                      </div>
                      <div className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <TaskPriorityIcon priority={task.priority} />
                          <span className="text-muted text-[12px]">{PRIORITY_LABELS[task.priority]}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2.5">
                        <div className="flex -space-x-1">
                          {task.assignees.slice(0, 4).map((a) => (
                            <div
                              key={a.userId}
                              title={a.name || a.email}
                              className="rounded-full border border-white"
                            >
                              <Avatar
                                userId={a.userId}
                                name={a.name || a.email}
                                hasAvatar={a.hasAvatar}
                                size={24}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className={`px-4 py-2.5 ${overdue ? 'text-[#c44] font-semibold' : 'text-muted'}`}>
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
