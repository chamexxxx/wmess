import { useEffect, useState } from 'react'
import {
  PRIORITY_LABELS,
  tasksApi,
  type TaskBoardColumn,
  type TaskItem,
  type TaskLabel,
} from '../../api/tasksApi'
import type { TeamMemberResponse } from '../../api/generated/data-contracts'
import { useAuth } from '../../context/AuthContext'

interface TaskDetailPanelProps {
  task: TaskItem
  columns: TaskBoardColumn[]
  labels: TaskLabel[]
  members: TeamMemberResponse[]
  teamId: number
  onClose: () => void
  onUpdated: () => void
}

export function TaskDetailPanel({
  task,
  columns,
  labels,
  members,
  onClose,
  onUpdated,
}: TaskDetailPanelProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [priority, setPriority] = useState(task.priority)
  const [columnId, setColumnId] = useState(task.columnId)
  const [estimatedHours, setEstimatedHours] = useState(task.estimatedHours)
  const [scheduleMode, setScheduleMode] = useState(task.scheduleMode)
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState(task.primaryAssigneeId ?? '')
  const [assigned, setAssigned] = useState<string[]>(task.assignedUserIds)
  const [selectedLabels, setSelectedLabels] = useState<string[]>(task.labels.map((l) => l.id))
  const [comments, setComments] = useState<{ id: string; content: string; userEmail: string; createdAt: string }[]>([])
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    tasksApi.getComments(task.id).then((r) => setComments(r.data)).catch(() => {})
  }, [task.id])

  async function save() {
    setSaving(true)
    try {
      await tasksApi.update(task.id, {
        title,
        description,
        priority,
        columnId,
        sortOrder: task.sortOrder,
        estimatedHours,
        scheduleMode,
        primaryAssigneeId: primaryAssigneeId || null,
        startDate: task.startDate,
        dueDate: task.dueDate,
        assignedUserIds: assigned,
        labelIds: selectedLabels,
      })
      await onUpdated()
    } finally {
      setSaving(false)
    }
  }

  async function addComment() {
    if (!commentText.trim()) return
    await tasksApi.addComment(task.id, commentText.trim())
    setCommentText('')
    const r = await tasksApi.getComments(task.id)
    setComments(r.data)
  }

  function toggleAssignee(userId: string) {
    setAssigned((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-white border-l border-line shadow-2xl z-50 flex flex-col font-ui">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <span className="font-bold text-ink">Задача</span>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink text-xl leading-none px-2">
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-lg font-bold border border-line rounded-lg px-3 py-2"
        />

        <div>
          <label className="text-[11px] font-bold text-faint uppercase">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px] resize-y"
            placeholder="Markdown поддерживается…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-faint uppercase">Колонка</label>
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
            <label className="text-[11px] font-bold text-faint uppercase">Приоритет</label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) as TaskItem['priority'])}
              className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-[13px]"
            >
              {PRIORITY_LABELS.map((l, i) => (
                <option key={l} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="text-[11px] font-bold text-faint uppercase">Расписание</label>
            <select
              value={scheduleMode}
              onChange={(e) => setScheduleMode(Number(e.target.value) as 0 | 1)}
              className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-[13px]"
            >
              <option value={0}>Авто</option>
              <option value={1}>Вручную</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-faint uppercase">Исполнители</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const id = m.userId ?? ''
              const on = assigned.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleAssignee(id)}
                  className={`px-2 py-1 rounded-lg text-[12px] border ${
                    on ? 'bg-accent text-white border-accent' : 'border-line text-muted'
                  }`}
                >
                  {m.email}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-faint uppercase">Основной на таймлайне</label>
          <select
            value={primaryAssigneeId}
            onChange={(e) => setPrimaryAssigneeId(e.target.value)}
            className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-[13px]"
          >
            <option value="">—</option>
            {assigned.map((id) => {
              const m = members.find((x) => x.userId === id)
              return (
                <option key={id} value={id}>
                  {m?.email ?? id}
                </option>
              )
            })}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-faint uppercase">Метки</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {labels.map((l) => {
              const on = selectedLabels.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() =>
                    setSelectedLabels((prev) =>
                      on ? prev.filter((x) => x !== l.id) : [...prev, l.id],
                    )
                  }
                  className="px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                  style={{
                    backgroundColor: l.color,
                    opacity: on ? 1 : 0.35,
                  }}
                >
                  {l.name}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-faint uppercase">Комментарии</label>
          <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="text-[12px] bg-sidebar rounded-lg p-2">
                <div className="text-faint text-[10px]">{c.userEmail}</div>
                <div className="text-ink mt-0.5">{c.content}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 border border-line rounded-lg px-2 py-1.5 text-[13px]"
              placeholder="Комментарий…"
              onKeyDown={(e) => e.key === 'Enter' && void addComment()}
            />
            <button
              type="button"
              onClick={() => void addComment()}
              className="px-3 rounded-lg bg-accent text-white text-[12px] font-semibold"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="shrink-0 p-4 border-t border-line flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="flex-1 h-10 rounded-lg bg-accent text-white font-semibold text-[13px] disabled:opacity-60"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        {user?.email && task.assignees.some((a) => a.email === user.email) && (
          <span className="text-[11px] text-faint self-center">вы в задаче</span>
        )}
      </div>
    </div>
  )
}
