import { useEffect, useState } from 'react'
import { tasksApi, type TaskGroup } from '../../api/tasksApi'
import { ConfirmDialog } from '../WorkspaceModals'
import { PencilIcon, PlusIcon, TrashIcon } from '../../workspace/icons'

interface TaskGroupSettingsPanelProps {
  teamId: number
  groups: TaskGroup[]
  canManage: boolean
  onChanged: () => void
}

function ColorCirclePicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}) {
  return (
    <label className="relative w-8 h-8 shrink-0 cursor-pointer disabled:opacity-50">
      <span
        className="block w-full h-full rounded-full ring-1 ring-line"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
      />
    </label>
  )
}

function GroupEditModal({
  initialName,
  initialColor,
  busy,
  onClose,
  onSubmit,
}: {
  initialName: string
  initialColor: string
  busy: boolean
  onClose: () => void
  onSubmit: (name: string, color: string) => void
}) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/30" onMouseDown={onClose}>
      <div
        className="w-[360px] bg-white rounded-2xl border border-line p-5 shadow-xl font-ui"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink">Изменить группу</h2>
        <label className="block mt-4 text-[11px] font-bold text-faint uppercase">Название</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
        />
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[11px] font-bold text-faint uppercase">Цвет</span>
          <ColorCirclePicker value={color} onChange={setColor} disabled={busy} />
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-lg border border-line text-[13px] font-semibold text-muted"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => onSubmit(name.trim(), color)}
            className="px-4 h-9 rounded-lg bg-accent text-white text-[13px] font-semibold disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateGroupModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean
  onClose: () => void
  onSubmit: (name: string, color: string) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6B7280')

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/30" onMouseDown={onClose}>
      <div
        className="w-[360px] bg-white rounded-2xl border border-line p-5 shadow-xl font-ui"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink">Новая группа</h2>
        <label className="block mt-4 text-[11px] font-bold text-faint uppercase">Название</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border border-line rounded-lg px-3 py-2 text-[13px]"
        />
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[11px] font-bold text-faint uppercase">Цвет</span>
          <ColorCirclePicker value={color} onChange={setColor} disabled={busy} />
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-lg border border-line text-[13px] font-semibold text-muted"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => onSubmit(name.trim(), color)}
            className="px-4 h-9 rounded-lg bg-accent text-white text-[13px] font-semibold disabled:opacity-50"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}

export function TaskGroupSettingsPanel({
  teamId,
  groups,
  canManage,
  onChanged,
}: TaskGroupSettingsPanelProps) {
  const [items, setItems] = useState(groups)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<TaskGroup | null>(null)
  const [deleting, setDeleting] = useState<TaskGroup | null>(null)

  useEffect(() => {
    setItems(groups)
  }, [groups])

  async function refresh() {
    const res = await tasksApi.getGroups(teamId)
    setItems(res.data)
    await onChanged()
  }

  async function addGroup(name: string, color: string) {
    setBusy(true)
    try {
      await tasksApi.createGroup(teamId, { name, color })
      setAdding(false)
      await refresh()
    } catch {
      setError('Не удалось создать группу')
    } finally {
      setBusy(false)
    }
  }

  async function saveGroup(name: string, color: string) {
    if (!editing) return
    if (name === editing.name && color === editing.color) {
      setEditing(null)
      return
    }
    setBusy(true)
    try {
      await tasksApi.updateGroup(teamId, editing.id, { name, color })
      setEditing(null)
      await refresh()
    } catch {
      setError('Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      const fallback = items.find((g) => g.id !== deleting.id)?.id
      await tasksApi.deleteGroup(teamId, deleting.id, fallback)
      setDeleting(null)
      await refresh()
    } catch {
      setError('Не удалось удалить группу')
    } finally {
      setBusy(false)
    }
  }

  async function moveUp(index: number) {
    if (index <= 0) return
    const next = [...items]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    const payload = next.map((g, i) => ({ id: g.id, sortOrder: i }))
    setItems(next.map((g, i) => ({ ...g, sortOrder: i })))
    await tasksApi.reorderGroups(teamId, payload)
    await refresh()
  }

  return (
    <div>
      <p className="text-[13px] text-muted">Группы задач на таймлайне и в Kanban.</p>
      {error && <p className="mt-2 text-[12px] text-[#c44]">{error}</p>}
      <ul className="mt-3 space-y-1.5">
        {items.map((g, i) => (
          <li
            key={g.id}
            className="flex items-center gap-2 py-2 px-2.5 rounded-lg border border-line bg-sidebar"
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
            <span className="flex-1 text-[13px] font-semibold truncate">{g.name}</span>
            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={i === 0 || busy}
                  onClick={() => void moveUp(i)}
                  className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-white disabled:opacity-30"
                  title="Выше"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(g)}
                  className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-white"
                  title="Изменить"
                >
                  <PencilIcon size={14} />
                </button>
                <button
                  type="button"
                  disabled={busy || items.length <= 1}
                  onClick={() => setDeleting(g)}
                  className="p-1.5 rounded-md text-muted hover:text-[#c44] hover:bg-white disabled:opacity-30"
                  title="Удалить"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-accent text-white text-[13px] font-semibold"
        >
          <PlusIcon size={14} /> Добавить группу
        </button>
      )}

      {adding && (
        <CreateGroupModal
          busy={busy}
          onClose={() => setAdding(false)}
          onSubmit={(name, color) => void addGroup(name, color)}
        />
      )}
      {editing && (
        <GroupEditModal
          initialName={editing.name}
          initialColor={editing.color}
          busy={busy}
          onClose={() => setEditing(null)}
          onSubmit={(name, color) => void saveGroup(name, color)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Удалить группу?"
          message={`Задачи из «${deleting.name}» будут перенесены в другую группу.`}
          confirmLabel="Удалить"
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  )
}
