import { useEffect, useRef, useState } from 'react'
import { tasksApi, type TaskBoardColumn, type TaskGroup, type TaskItem } from '../../api/tasksApi'
import { TaskPriorityIcon } from './TaskPriorityIcon'
import { Avatar } from '../Avatar'

interface TaskKanbanViewProps {
  tasks: TaskItem[]
  columns: TaskBoardColumn[]
  groups: TaskGroup[]
  onSelect: (id: string) => void
  onTaskUpdated: (task: TaskItem) => void
}

export function TaskKanbanView({ tasks, columns, groups, onSelect, onTaskUpdated }: TaskKanbanViewProps) {
  const [localTasks, setLocalTasks] = useState(tasks)
  const dragId = useRef<string | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  async function moveTask(taskId: string, columnId: string, groupId: string, sortOrder: number) {
    const prev = localTasks
    setLocalTasks((list) =>
      list.map((t) => (t.id === taskId ? { ...t, columnId, groupId, sortOrder } : t)),
    )
    try {
      const res = await tasksApi.patch(taskId, { columnId, groupId, sortOrder })
      onTaskUpdated(res.data)
    } catch {
      setLocalTasks(prev)
    }
  }

  function onDrop(columnId: string, groupId: string, index: number) {
    if (!dragId.current) return
    suppressClick.current = true
    void moveTask(dragId.current, columnId, groupId, index)
    dragId.current = null
  }

  const sortedColumns = [...columns].sort((a, b) => a.sortOrder - b.sortOrder)
  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder)
  const fluidColumns = sortedColumns.length <= 4

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {sortedGroups.map((group) => (
        <section key={group.id}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
            <h3 className="text-[14px] font-bold text-ink font-ui">{group.name}</h3>
          </div>
          <div className={fluidColumns ? 'w-full' : 'overflow-x-auto'}>
            <div className={`flex gap-3 ${fluidColumns ? 'w-full' : 'min-w-max'}`}>
              {sortedColumns.map((col) => {
                const colTasks = localTasks
                  .filter((t) => t.columnId === col.id && t.groupId === group.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder)

                return (
                  <div
                    key={col.id}
                    className={`shrink-0 flex flex-col bg-sidebar rounded-xl border border-line max-h-[calc(100vh-280px)] ${
                      fluidColumns ? 'flex-1 min-w-0' : 'w-[280px]'
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(col.id, group.id, colTasks.length)}
                  >
                    <div
                      className="px-3 py-2.5 font-bold text-[13px] font-ui flex items-center gap-2 border-b border-line"
                      style={{ borderTopColor: col.color, borderTopWidth: 3 }}
                    >
                      <span className="truncate">{col.name}</span>
                      <span className="ml-auto text-faint text-[11px]">{colTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
                      {colTasks.map((task, idx) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => {
                            dragId.current = task.id
                          }}
                          onDragEnd={() => {
                            dragId.current = null
                            setTimeout(() => {
                              suppressClick.current = false
                            }, 0)
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.stopPropagation()
                            onDrop(col.id, group.id, idx)
                          }}
                          onClick={() => {
                            if (suppressClick.current) return
                            onSelect(task.id)
                          }}
                          className="bg-white rounded-lg border border-line p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-start gap-2">
                            <TaskPriorityIcon priority={task.priority} size={14} className="shrink-0 mt-0.5" />
                            <div className="font-semibold text-[13px] text-ink leading-snug flex-1">{task.title}</div>
                          </div>
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <div className="flex -space-x-1">
                              {task.assignees.slice(0, 3).map((a) => (
                                <div
                                  key={a.userId}
                                  title={a.name || a.email}
                                  className="rounded-full border border-white"
                                >
                                  <Avatar
                                    userId={a.userId}
                                    name={a.name || a.email}
                                    hasAvatar={a.hasAvatar}
                                    size={20}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
