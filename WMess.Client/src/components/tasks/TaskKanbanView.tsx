import { useState } from 'react'
import { tasksApi, type TaskBoardColumn, type TaskItem } from '../../api/tasksApi'
import { PRIORITY_COLORS } from '../../api/tasksApi'
import { initials, colorFor } from '../../workspace/theme'

interface TaskKanbanViewProps {
  tasks: TaskItem[]
  columns: TaskBoardColumn[]
  onSelect: (id: string) => void
  onRefresh: () => void
}

export function TaskKanbanView({ tasks, columns, onSelect, onRefresh }: TaskKanbanViewProps) {
  const [dragId, setDragId] = useState<string | null>(null)

  async function moveTask(taskId: string, columnId: string, sortOrder: number) {
    try {
      await tasksApi.patch(taskId, { columnId, sortOrder })
      await onRefresh()
    } catch {
      /* ignore */
    }
  }

  function onDrop(columnId: string, index: number) {
    if (!dragId) return
    void moveTask(dragId, columnId, index)
    setDragId(null)
  }

  const sortedColumns = [...columns].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden p-4">
      <div className="flex gap-3 h-full min-w-max">
        {sortedColumns.map((col) => {
          const colTasks = tasks
            .filter((t) => t.columnId === col.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)

          return (
            <div
              key={col.id}
              className="w-[280px] shrink-0 flex flex-col bg-sidebar rounded-xl border border-line max-h-full"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(col.id, colTasks.length)}
            >
              <div
                className="px-3 py-2.5 font-bold text-[13px] font-ui flex items-center gap-2 border-b border-line"
                style={{ borderTopColor: col.color, borderTopWidth: 3 }}
              >
                <span className="truncate">{col.name}</span>
                <span className="ml-auto text-faint text-[11px]">{colTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
                {colTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDragId(task.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.stopPropagation()
                      onDrop(col.id, idx)
                    }}
                    onClick={() => onSelect(task.id)}
                    className="bg-white rounded-lg border border-line p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="font-semibold text-[13px] text-ink leading-snug">{task.title}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide"
                        style={{ color: PRIORITY_COLORS[task.priority] }}
                      >
                        P{task.priority}
                      </span>
                      <div className="flex -space-x-1">
                        {task.assignees.slice(0, 3).map((a) => (
                          <div
                            key={a.userId}
                            title={a.email}
                            className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center border border-white"
                            style={{ backgroundColor: colorFor(a.userId) }}
                          >
                            {initials(a.email)}
                          </div>
                        ))}
                      </div>
                    </div>
                    {task.labels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.labels.map((l) => (
                          <span
                            key={l.id}
                            className="text-[10px] px-1.5 py-0.5 rounded text-white font-semibold"
                            style={{ backgroundColor: l.color }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
