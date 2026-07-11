import { useState } from 'react'
import {
  PRIORITY_LABELS,
  tasksApi,
  type TaskBoardColumn,
  type TaskGroup,
  type TaskPriority,
} from '../../api/tasksApi'
import type { TeamMemberResponse } from '../../api/generated/data-contracts'
import { TaskPriorityIcon } from './TaskPriorityIcon'

interface CreateTaskModalProps {
  columns: TaskBoardColumn[]
  groups: TaskGroup[]
  members: TeamMemberResponse[]
  scope: 'project' | 'team'
  projectId: number
  teamId: number
  busy?: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateTaskModal({
  columns,
  groups,
  members,
  scope,
  projectId,
  teamId,
  busy,
  onClose,
  onCreated,
}: CreateTaskModalProps) {
  const defaultCol = columns.find((c) => !c.isDoneColumn) ?? columns[0]
  const defaultGroup = groups[0]

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>(1)
  const [columnId, setColumnId] = useState(defaultCol?.id ?? '')
  const [groupId, setGroupId] = useState(defaultGroup?.id ?? '')
  const [estimatedHours, setEstimatedHours] = useState(8)
  const [assigned, setAssigned] = useState<string[]>([])
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || submitting || busy) return
    setSubmitting(true)
    try {
      await tasksApi.create({
        title: title.trim(),
        description: description || undefined,
        priority,
        columnId,
        groupId,
        estimatedHours,
        projectId: scope === 'project' ? projectId : undefined,
        teamId: scope === 'team' ? teamId : undefined,
        assignedUserIds: assigned,
      })
      onClose()
      await onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  function addAssignee(userId: string) {
    if (!assigned.includes(userId)) setAssigned((prev) => [...prev, userId])
    setAssigneeOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30" onMouseDown={onClose}>
      <form
        className="w-[520px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-line p-5 shadow-xl font-ui"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => void submit(e)}
      >
        <h2 className="text-lg font-bold text-ink">Новая задача</h2>

        <label className="block text-[11px] font-bold text-faint uppercase mt-4">Название</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
        />

        <label className="block text-[11px] font-bold text-faint uppercase mt-3">Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px] resize-y"
        />

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-[11px] font-bold text-faint uppercase">Статус</label>
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-[13px]"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-faint uppercase">Группа</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-[13px]"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-[11px] font-bold text-faint uppercase">Приоритет</label>
            <div className="flex items-center gap-2 mt-1">
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as TaskPriority)}
                className="flex-1 border border-line rounded-lg px-2 py-1.5 text-[13px]"
              >
                {PRIORITY_LABELS.map((l, i) => (
                  <option key={l} value={i}>
                    {l}
                  </option>
                ))}
              </select>
              <TaskPriorityIcon priority={priority} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-faint uppercase">Оценка, ч</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
              className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-[13px]"
            />
          </div>
        </div>

        <label className="block text-[11px] font-bold text-faint uppercase mt-3">Исполнители</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {assigned.map((id) => {
            const m = members.find((x) => x.userId === id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent-soft text-accent text-[12px] font-semibold"
              >
                {m?.email ?? id}
                <button
                  type="button"
                  onClick={() => setAssigned((prev) => prev.filter((x) => x !== id))}
                  className="leading-none"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
        <div className="relative mt-2">
          <button
            type="button"
            onClick={() => setAssigneeOpen((v) => !v)}
            className="w-full text-left border border-line rounded-lg px-2 py-1.5 text-[13px] text-muted"
          >
            + Добавить исполнителя
          </button>
          {assigneeOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-line rounded-lg shadow-lg max-h-36 overflow-y-auto">
              {members
                .filter((m) => m.userId && !assigned.includes(m.userId))
                .map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => addAssignee(m.userId!)}
                    className="block w-full text-left px-3 py-2 text-[13px] hover:bg-sidebar"
                  >
                    {m.email}
                  </button>
                ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-line text-[13px] font-semibold text-muted">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!title.trim() || submitting || busy}
            className="h-9 px-4 rounded-lg bg-accent text-white text-[13px] font-semibold disabled:opacity-60"
          >
            {submitting ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
