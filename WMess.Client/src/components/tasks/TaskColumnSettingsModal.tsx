import { useState } from 'react'
import { tasksApi, type TaskBoardColumn } from '../../api/tasksApi'
import { ConfirmDialog, FormModal } from '../WorkspaceModals'

interface TaskColumnSettingsModalProps {
  teamId: number
  columns: TaskBoardColumn[]
  canManage: boolean
  onClose: () => void
  onChanged: () => void
}

export function TaskColumnSettingsModal({
  teamId,
  columns,
  canManage,
  onClose,
  onChanged,
}: TaskColumnSettingsModalProps) {
  const [items, setItems] = useState(columns)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [renamingColumn, setRenamingColumn] = useState<TaskBoardColumn | null>(null)
  const [deletingColumn, setDeletingColumn] = useState<TaskBoardColumn | null>(null)

  async function addColumn(name: string) {
    setBusy(true)
    try {
      await tasksApi.createColumn(teamId, { name, color: '#6B7280', isDoneColumn: false })
      setAddingColumn(false)
      await onChanged()
      onClose()
    } catch {
      setError('Не удалось создать колонку')
    } finally {
      setBusy(false)
    }
  }

  async function rename(name: string) {
    if (!renamingColumn || name === renamingColumn.name) {
      setRenamingColumn(null)
      return
    }
    setBusy(true)
    try {
      await tasksApi.updateColumn(teamId, renamingColumn.id, {
        name,
        color: renamingColumn.color,
        isDoneColumn: renamingColumn.isDoneColumn,
      })
      setItems((prev) =>
        prev.map((c) => (c.id === renamingColumn.id ? { ...c, name } : c)),
      )
      setRenamingColumn(null)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function remove(col: TaskBoardColumn, moveTo: string) {
    setBusy(true)
    try {
      await tasksApi.deleteColumn(teamId, col.id, moveTo)
      setDeletingColumn(null)
      await onChanged()
      onClose()
    } catch {
      setError('Не удалось удалить колонку')
    } finally {
      setBusy(false)
    }
  }

  function startDelete(col: TaskBoardColumn) {
    const others = items.filter((c) => c.id !== col.id)
    if (others.length === 0) {
      setError('Нельзя удалить последнюю колонку')
      return
    }
    setDeletingColumn(col)
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30" onMouseDown={onClose}>
        <div
          className="w-[400px] bg-white rounded-2xl border border-line p-5 shadow-xl font-ui"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold text-ink">Колонки Kanban</h2>
          <p className="text-[13px] text-muted mt-1">Переименуйте, добавьте или удалите колонки.</p>

          <ul className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {[...items]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((col) => (
                <li
                  key={col.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-line"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="flex-1 text-[13px] font-semibold truncate">{col.name}</span>
                  {col.isDoneColumn && (
                    <span className="text-[10px] text-faint uppercase">готово</span>
                  )}
                  {canManage && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRenamingColumn(col)}
                        className="text-[12px] text-accent font-semibold"
                      >
                        Изм.
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startDelete(col)}
                        className="text-[12px] text-[#c44] font-semibold"
                      >
                        Удал.
                      </button>
                    </>
                  )}
                </li>
              ))}
          </ul>

          {error && <p className="mt-2 text-[12px] text-[#c44]">{error}</p>}

          <div className="mt-4 flex gap-2 justify-end">
            {canManage && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAddingColumn(true)}
                className="px-4 h-9 rounded-lg bg-accent text-white text-[13px] font-semibold"
              >
                + Колонка
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-lg border border-line text-[13px] font-semibold text-muted"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>

      {addingColumn && (
        <FormModal
          title="Новая колонка"
          label="Название"
          submitLabel="Создать"
          busy={busy}
          onClose={() => setAddingColumn(false)}
          onSubmit={(name) => void addColumn(name)}
        />
      )}

      {renamingColumn && (
        <FormModal
          title="Переименовать колонку"
          label="Название"
          initialValue={renamingColumn.name}
          submitLabel="Сохранить"
          busy={busy}
          onClose={() => setRenamingColumn(null)}
          onSubmit={(name) => void rename(name)}
        />
      )}

      {deletingColumn && (
        <ConfirmDialog
          title="Удалить колонку"
          message={
            <>
              Удалить «{deletingColumn.name}»? Задачи перенесутся в «
              {items.filter((c) => c.id !== deletingColumn.id)[0]?.name}».
            </>
          }
          confirmLabel="Удалить"
          busy={busy}
          onClose={() => setDeletingColumn(null)}
          onConfirm={() => {
            const moveTo = items.find((c) => c.id !== deletingColumn.id)?.id
            if (moveTo) void remove(deletingColumn, moveTo)
          }}
        />
      )}
    </>
  )
}
