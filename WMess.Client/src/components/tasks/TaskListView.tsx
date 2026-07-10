import type { TaskItem } from '../../api/tasksApi'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../api/tasksApi'
import { initials, colorFor } from '../../workspace/theme'

interface TaskListViewProps {
  tasks: TaskItem[]
  onSelect: (id: string) => void
  onRefresh: () => void
}

export function TaskListView({ tasks, onSelect }: TaskListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm p-8 text-center">
        Задач пока нет. Создайте первую кнопкой «Задача».
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-left text-[13px] font-ui border-collapse">
        <thead className="sticky top-0 bg-sidebar text-faint text-[11px] uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2 font-semibold">Название</th>
            <th className="px-4 py-2 font-semibold">Колонка</th>
            <th className="px-4 py-2 font-semibold">Приоритет</th>
            <th className="px-4 py-2 font-semibold">Исполнители</th>
            <th className="px-4 py-2 font-semibold">Срок</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const overdue =
              task.dueDate && !task.isDoneColumn && new Date(task.dueDate) < new Date()
            return (
              <tr
                key={task.id}
                onClick={() => onSelect(task.id)}
                className="border-t border-line hover:bg-sidebar cursor-pointer"
              >
                <td className="px-4 py-2.5 font-semibold text-ink">{task.title}</td>
                <td className="px-4 py-2.5">
                  <span
                    className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold text-white"
                    style={{ backgroundColor: task.columnColor }}
                  >
                    {task.columnName}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span style={{ color: PRIORITY_COLORS[task.priority] }}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex -space-x-1">
                    {task.assignees.slice(0, 4).map((a) => (
                      <div
                        key={a.userId}
                        title={a.email}
                        className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center border border-white"
                        style={{ backgroundColor: colorFor(a.userId) }}
                      >
                        {initials(a.email)}
                      </div>
                    ))}
                  </div>
                </td>
                <td className={`px-4 py-2.5 ${overdue ? 'text-[#c44] font-semibold' : 'text-muted'}`}>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
