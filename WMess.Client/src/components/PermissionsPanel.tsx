import { useEffect, useState } from 'react'
import { apiClient } from '../api'
import { TrashIcon } from '../workspace/icons'

interface Permission {
  id: number
  userId: string
  userEmail: string
  canView: boolean
  canEdit: boolean
  canManage: boolean
}

interface PermissionsPanelProps {
  documentId: number
  onClose: () => void
}

export function PermissionsPanel({ documentId, onClose }: PermissionsPanelProps) {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [level, setLevel] = useState<'view' | 'edit' | 'manage'>('edit')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const loadPermissions = async () => {
    try {
      const res = await apiClient.documents.getDocumentPermissions(documentId)
      setPermissions(
        (res.data ?? []).map((p) => ({
          id: Number(p.id),
          userId: p.userId ?? '',
          userEmail: p.userEmail ?? '',
          canView: p.canView ?? false,
          canEdit: p.canEdit ?? false,
          canManage: p.canManage ?? false,
        })),
      )
    } catch (error) {
      console.error('Failed to load permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadPermissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  const addPermission = async () => {
    const term = email.trim()
    if (!term) return
    setBusy(true)
    setFeedback(null)
    try {
      const usersRes = await apiClient.user.searchUsers({ email: term })
      const match = (usersRes.data ?? []).find((u) => u.email?.toLowerCase() === term.toLowerCase())
        ?? (usersRes.data ?? [])[0]
      if (!match?.id) {
        setFeedback('Пользователь не найден')
        return
      }

      await apiClient.documents.setDocumentPermission(documentId, {
        userId: match.id,
        canView: true,
        canEdit: level === 'edit' || level === 'manage',
        canManage: level === 'manage',
      })

      setEmail('')
      setLevel('edit')
      await loadPermissions()
    } catch (error) {
      console.error('Failed to add permission:', error)
      setFeedback('Не удалось выдать доступ')
    } finally {
      setBusy(false)
    }
  }

  const removePermission = async (userId: string) => {
    setBusy(true)
    try {
      await apiClient.documents.removeDocumentPermission(documentId, userId)
      await loadPermissions()
    } catch (error) {
      console.error('Failed to remove permission:', error)
    } finally {
      setBusy(false)
    }
  }

  const levelLabel = (p: Permission) =>
    p.canManage ? 'Управление' : p.canEdit ? 'Редактирование' : 'Просмотр'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 font-ui animate-[wmFade_.12s_ease]"
      onMouseDown={onClose}
    >
      <div
        className="w-[460px] max-w-[calc(100vw-32px)] bg-white border border-line rounded-2xl p-[22px] text-ink shadow-[0_24px_60px_rgba(43,42,38,.24)] animate-[wmPop_.14s_ease]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold m-0">Доступ к документу</h2>
          <button type="button" onClick={onClose} className="text-faint hover:text-ink cursor-pointer text-lg leading-none">
            ×
          </button>
        </div>

        <div className="mt-[18px] flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addPermission()
            }}
            placeholder="Email пользователя"
            className="flex-1 h-10 px-3 rounded-[9px] border border-line bg-panel text-sm text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
          />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as 'view' | 'edit' | 'manage')}
            className="h-10 px-2 rounded-[9px] border border-line bg-panel text-sm text-ink cursor-pointer focus:outline-none focus:border-accent"
          >
            <option value="view">Просмотр</option>
            <option value="edit">Редактирование</option>
            <option value="manage">Управление</option>
          </select>
          <button
            type="button"
            onClick={addPermission}
            disabled={busy || !email.trim()}
            className="h-10 px-4 rounded-[9px] bg-accent text-white text-sm font-semibold hover:bg-accent-deep cursor-pointer disabled:opacity-60"
          >
            Выдать
          </button>
        </div>
        {feedback && <div className="mt-2 text-[12.5px] text-danger">{feedback}</div>}

        <div className="mt-4 space-y-1.5 max-h-[44vh] overflow-y-auto wm-scroll">
          {loading ? (
            <div className="text-[13px] text-faint py-3 text-center">Загрузка…</div>
          ) : permissions.length === 0 ? (
            <div className="text-[13px] text-faint py-3 text-center">Доступ ещё никому не выдан</div>
          ) : (
            permissions.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 rounded-[9px] bg-panel border border-line-soft">
                <div className="min-w-0">
                  <div className="text-[13.5px] text-ink truncate">{p.userEmail}</div>
                  <div className="font-ui font-semibold text-[10.5px] tracking-[.04em] uppercase text-faintest mt-0.5">
                    {levelLabel(p)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePermission(p.userId)}
                  disabled={busy}
                  className="text-faint hover:text-danger p-1 cursor-pointer disabled:opacity-50"
                  title="Убрать доступ"
                >
                  <TrashIcon size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
