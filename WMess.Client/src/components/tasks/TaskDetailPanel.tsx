import { useEffect, useRef, useState } from 'react'

import {

  PRIORITY_LABELS,

  tasksApi,

  type TaskBoardColumn,

  type TaskGroup,

  type TaskItem,

} from '../../api/tasksApi'

import type { TeamMemberResponse } from '../../api/generated/data-contracts'

import { ConfirmDialog } from '../WorkspaceModals'

import { SettingsIcon } from '../../workspace/icons'

import { TaskPriorityIcon } from './TaskPriorityIcon'



interface TaskDetailPanelProps {
  taskId: string
  initialTask?: TaskItem | null
  columns: TaskBoardColumn[]
  groups: TaskGroup[]
  members: TeamMemberResponse[]
  refreshSignal?: number
  onClose: () => void
  onUpdated: (task: TaskItem) => void
  onDeleted: (taskId: string) => void
}



function formatDateTime(iso: string) {

  return new Date(iso).toLocaleString('ru-RU', {

    day: '2-digit',

    month: '2-digit',

    year: 'numeric',

    hour: '2-digit',

    minute: '2-digit',

  })

}



export function TaskDetailPanel({

  taskId,

  initialTask,

  columns,

  groups,

  members,

  refreshSignal = 0,

  onClose,

  onUpdated,

  onDeleted,

}: TaskDetailPanelProps) {

  const [task, setTask] = useState<TaskItem | null>(null)

  const [title, setTitle] = useState('')

  const [description, setDescription] = useState('')

  const [priority, setPriority] = useState<TaskItem['priority']>(1)

  const [columnId, setColumnId] = useState('')

  const [groupId, setGroupId] = useState('')

  const [estimatedHours, setEstimatedHours] = useState(8)

  const [assigned, setAssigned] = useState<string[]>([])

  const [assigneeOpen, setAssigneeOpen] = useState(false)

  const [comments, setComments] = useState<{ id: string; content: string; userEmail: string; createdAt: string }[]>([])

  const [commentText, setCommentText] = useState('')

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)

  const [deleting, setDeleting] = useState(false)

  const [menuOpen, setMenuOpen] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSave = useRef(true)
  const loadSeq = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const isEditingRef = useRef(false)
  const dirtyRef = useRef(false)
  const pendingRemoteRef = useRef(false)
  const lastRefreshSignal = useRef(refreshSignal)

  const applyTaskData = (
    t: TaskItem,
    commentsData: { id: string; content: string; userEmail: string; createdAt: string }[],
  ) => {
    setTask(t)
    setTitle(t.title)
    setDescription(t.description ?? '')
    setPriority(t.priority)
    setColumnId(t.columnId)
    setGroupId(t.groupId)
    setEstimatedHours(t.estimatedHours)
    setAssigned(t.assignedUserIds)
    setComments(commentsData)
    dirtyRef.current = false
    skipSave.current = true
  }

  const syncRemote = async () => {
    try {
      const [taskRes, commentsRes] = await Promise.all([
        tasksApi.get(taskId),
        tasksApi.getComments(taskId),
      ])
      setComments(commentsRes.data)
      if (!isEditingRef.current && !dirtyRef.current && !saveTimer.current) {
        const t = taskRes.data
        setTask(t)
        setTitle(t.title)
        setDescription(t.description ?? '')
        setPriority(t.priority)
        setColumnId(t.columnId)
        setGroupId(t.groupId)
        setEstimatedHours(t.estimatedHours)
        setAssigned(t.assignedUserIds)
        skipSave.current = true
      }
    } catch {
      // Тихий refetch — ошибку не показываем, пользователь не прерывает редактирование.
    }
  }

  const applyInitialTask = (t: TaskItem) => {
    setTask(t)
    setTitle(t.title)
    setDescription(t.description ?? '')
    setPriority(t.priority)
    setColumnId(t.columnId)
    setGroupId(t.groupId)
    setEstimatedHours(t.estimatedHours)
    setAssigned(t.assignedUserIds)
    skipSave.current = true
  }



  useEffect(() => {

    return () => {

      if (saveTimer.current) clearTimeout(saveTimer.current)

    }

  }, [])



  useEffect(() => {

    const onKey = (e: KeyboardEvent) => {

      if (e.key === 'Escape') {

        if (confirmDelete) return

        if (menuOpen) setMenuOpen(false)

        else onClose()

      }

    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)

  }, [onClose, confirmDelete, menuOpen])



  useEffect(() => {

    if (!menuOpen) return

    const onDoc = (e: MouseEvent) => {

      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)

    }

    document.addEventListener('mousedown', onDoc)

    return () => document.removeEventListener('mousedown', onDoc)

  }, [menuOpen])



  useEffect(() => {

    const seq = ++loadSeq.current

    skipSave.current = true

    dirtyRef.current = false

    pendingRemoteRef.current = false

    isEditingRef.current = false

    lastRefreshSignal.current = refreshSignal

    if (saveTimer.current) clearTimeout(saveTimer.current)



    if (initialTask) {

      applyInitialTask(initialTask)

      setLoading(false)

    } else {

      setLoading(true)

    }



    void (async () => {

      try {

        const [taskRes, commentsRes] = await Promise.all([

          tasksApi.get(taskId),

          tasksApi.getComments(taskId),

        ])

        if (seq !== loadSeq.current) return

        applyTaskData(taskRes.data, commentsRes.data)

      } finally {

        if (seq === loadSeq.current) setLoading(false)

      }

    })()



    return () => {

      loadSeq.current++

    }

  }, [taskId])



  useEffect(() => {

    if (refreshSignal === lastRefreshSignal.current) return

    lastRefreshSignal.current = refreshSignal

    if (isEditingRef.current || dirtyRef.current || saveTimer.current) {

      pendingRemoteRef.current = true

      return

    }

    void syncRemote()

  }, [refreshSignal, taskId])



  useEffect(() => {

    if (loading || skipSave.current) {

      skipSave.current = false

      return

    }

    if (saveTimer.current) clearTimeout(saveTimer.current)

    const savingId = taskId

    saveTimer.current = setTimeout(() => {

      saveTimer.current = null

      void (async () => {

        setSaving(true)

        try {

          const res = await tasksApi.patch(savingId, {

            title,

            description,

            priority,

            columnId,

            groupId,

            estimatedHours,

            assignedUserIds: assigned,

          })

          if (savingId === taskId) {
            onUpdated(res.data)
            dirtyRef.current = false
          }

        } finally {

          if (savingId === taskId) setSaving(false)

        }

      })()

    }, 500)

  }, [title, description, priority, columnId, groupId, estimatedHours, assigned, loading, taskId, onUpdated])



  async function addComment() {

    if (!commentText.trim()) return

    await tasksApi.addComment(taskId, commentText.trim())

    setCommentText('')

    const r = await tasksApi.getComments(taskId)

    setComments(r.data)

  }



  function addAssignee(userId: string) {

    dirtyRef.current = true

    if (!assigned.includes(userId)) setAssigned((prev) => [...prev, userId])

    setAssigneeOpen(false)

  }



  function removeAssignee(userId: string) {

    dirtyRef.current = true

    setAssigned((prev) => prev.filter((id) => id !== userId))

  }



  async function deleteTask() {

    setDeleting(true)

    try {

      await tasksApi.remove(taskId)

      onDeleted(taskId)

      onClose()

    } finally {

      setDeleting(false)

      setConfirmDelete(false)

    }

  }



  const availableMembers = members.filter((m) => m.userId && !assigned.includes(m.userId))



  return (

    <>

      <div

        className="fixed inset-0 bg-ink/10 z-40"

        onMouseDown={onClose}

        aria-hidden

      />

      <div

        ref={panelRef}

        className="fixed inset-y-0 right-0 w-[560px] max-w-full bg-white border-l border-line shadow-2xl z-50 flex flex-col font-ui"

        onMouseDown={(e) => e.stopPropagation()}

        onFocusCapture={() => {

          isEditingRef.current = true

        }}

        onBlurCapture={(e) => {

          if (panelRef.current?.contains(e.relatedTarget as Node)) return

          isEditingRef.current = false

          if (pendingRemoteRef.current) {

            pendingRemoteRef.current = false

            void syncRemote()

          }

        }}

      >

      <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-line">

        {loading || !task ? (

          <span className="flex-1 font-bold text-ink">Загрузка…</span>

        ) : (

          <input

            value={title}

            onChange={(e) => {

              dirtyRef.current = true

              setTitle(e.target.value)

            }}

            className="flex-1 min-w-0 text-lg font-bold border-0 bg-transparent px-0 py-0 focus:outline-none focus:ring-0 text-ink placeholder:text-faint"

            placeholder="Название задачи"

          />

        )}

        <div className="flex items-center gap-2 shrink-0">

          {saving && <span className="text-[11px] text-faint">Сохранение…</span>}

          {!loading && task && (

            <div className="relative" ref={menuRef}>

              <button

                type="button"

                onClick={() => setMenuOpen((v) => !v)}

                className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-sidebar"

                title="Настройки"

              >

                <SettingsIcon size={16} />

              </button>

              {menuOpen && (

                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-line rounded-lg shadow-lg py-1 z-10">

                  <button

                    type="button"

                    onClick={() => {

                      setMenuOpen(false)

                      setConfirmDelete(true)

                    }}

                    className="block w-full text-left px-3 py-2 text-[13px] text-[#c44] hover:bg-sidebar"

                  >

                    Удалить задачу

                  </button>

                </div>

              )}

            </div>

          )}

          <button type="button" onClick={onClose} className="text-muted hover:text-ink text-xl leading-none px-2">

            ×

          </button>

        </div>

      </div>



      {loading || !task ? (

        <div className="flex-1 flex items-center justify-center text-muted text-sm">Загрузка…</div>

      ) : (

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          <div>

            <label className="text-[11px] font-bold text-faint uppercase">Описание</label>

            <textarea

              value={description}

              onChange={(e) => {

                dirtyRef.current = true

                setDescription(e.target.value)

              }}

              rows={5}

              className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px] resize-y"

              placeholder="Markdown поддерживается…"

            />

          </div>



          <div className="grid grid-cols-2 gap-3">

            <div>

              <label className="text-[11px] font-bold text-faint uppercase">Статус</label>

              <select

                value={columnId}

                onChange={(e) => {

                  dirtyRef.current = true

                  setColumnId(e.target.value)

                }}

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

                onChange={(e) => {

                  dirtyRef.current = true

                  setGroupId(e.target.value)

                }}

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



          <div className="grid grid-cols-2 gap-3">

            <div>

              <label className="text-[11px] font-bold text-faint uppercase">Приоритет</label>

              <select

                value={priority}

                onChange={(e) => {

                  dirtyRef.current = true

                  setPriority(Number(e.target.value) as TaskItem['priority'])

                }}

                className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-[13px]"

              >

                {PRIORITY_LABELS.map((l, i) => (

                  <option key={l} value={i}>

                    {l}

                  </option>

                ))}

              </select>

              <div className="mt-1">

                <TaskPriorityIcon priority={priority} size={18} />

              </div>

            </div>

            <div>

              <label className="text-[11px] font-bold text-faint uppercase">Оценка, ч</label>

              <input

                type="number"

                min={0.5}

                step={0.5}

                value={estimatedHours}

                onChange={(e) => {

                  dirtyRef.current = true

                  setEstimatedHours(Number(e.target.value))

                }}

                className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-[13px]"

              />

            </div>

          </div>



          <div>

            <label className="text-[11px] font-bold text-faint uppercase">Автор</label>

            <div className="mt-1 text-[13px] text-muted">{task.createdByEmail || '—'}</div>

          </div>



          <div>

            <label className="text-[11px] font-bold text-faint uppercase">Исполнители</label>

            <div className="mt-2 flex flex-wrap gap-2">

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

                      onClick={() => removeAssignee(id)}

                      className="text-accent/70 hover:text-accent leading-none"

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

                className="w-full text-left border border-line rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-sidebar"

              >

                + Добавить исполнителя

              </button>

              {assigneeOpen && availableMembers.length > 0 && (

                <div className="absolute z-10 mt-1 w-full bg-white border border-line rounded-lg shadow-lg max-h-40 overflow-y-auto">

                  {availableMembers.map((m) => (

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

          </div>



          <div>

            <label className="text-[11px] font-bold text-faint uppercase">Комментарии</label>

            <textarea

              value={commentText}

              onChange={(e) => setCommentText(e.target.value)}

              rows={3}

              className="mt-2 w-full border border-line rounded-lg px-3 py-2 text-[13px] resize-y"

              placeholder="Написать комментарий…"

            />

            <button

              type="button"

              disabled={!commentText.trim()}

              onClick={() => void addComment()}

              className="mt-2 px-4 h-8 rounded-lg bg-accent text-white text-[12px] font-semibold disabled:opacity-50"

            >

              Отправить

            </button>

            <div className="mt-4 space-y-3">

              {comments.map((c) => (

                <div key={c.id} className="text-[12px] bg-sidebar rounded-lg p-3">

                  <div className="flex items-center justify-between gap-2 text-faint text-[10px]">

                    <span>{c.userEmail}</span>

                    <span>{formatDateTime(c.createdAt)}</span>

                  </div>

                  <div className="text-ink mt-1 whitespace-pre-wrap">{c.content}</div>

                </div>

              ))}

            </div>

          </div>

        </div>

      )}

      </div>



      {confirmDelete && (

        <ConfirmDialog

          title="Удалить задачу"

          message={

            <>

              Удалить «{title || task?.title || 'задачу'}»? Это действие нельзя отменить.

            </>

          }

          confirmLabel="Удалить"

          busy={deleting}

          onClose={() => setConfirmDelete(false)}

          onConfirm={() => void deleteTask()}

        />

      )}

    </>

  )

}

