import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'
import type { TeamMemberResponse, TeamPermissions } from '../api/generated/data-contracts'
import { TrashIcon } from '../workspace/icons'
import { ROLE_LABELS } from '../workspace/roles'

const ghostBtn =
  'h-[38px] px-4 rounded-[9px] border border-line bg-white text-muted font-semibold text-[13.5px] cursor-pointer hover:bg-sidebar font-ui'

const actionBtn =
  'h-[38px] px-[18px] rounded-[9px] border-none text-white font-semibold text-[13.5px] cursor-pointer font-ui disabled:opacity-60'

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 font-ui animate-[wmFade_.12s_ease]"
      onMouseDown={onClose}
    >
      <div
        className="w-[480px] max-w-[calc(100vw-32px)] max-h-[80vh] bg-white border border-line rounded-2xl p-[22px] text-ink shadow-[0_24px_60px_rgba(43,42,38,.24)] animate-[wmPop_.14s_ease] overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function getInitials(email: string): string {
  const part = email.split('@')[0]
  return part.slice(0, 2).toUpperCase()
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string; detail?: string } | undefined
    return data?.message || data?.detail || err.message || fallback
  }
  return fallback
}

interface TeamMembersModalProps {
  teamId: number
  // Готовые права текущего пользователя в команде (считает сервер).
  permissions?: TeamPermissions
  onClose: () => void
}

export function TeamMembersModal({ teamId, permissions, onClose }: TeamMembersModalProps) {
  const { user } = useAuth()
  const [members, setMembers] = useState<TeamMemberResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const canManage = permissions?.canManage ?? false
  const canChangeRoles = permissions?.canChangeRoles ?? false

  // Какое право нужно, чтобы удалить участника с данной ролью (0/1/2).
  function canRemoveRole(role: number): boolean {
    if (role === 2) return permissions?.canRemoveOwners ?? false
    if (role === 1) return permissions?.canRemoveAdmins ?? false
    return permissions?.canRemoveMembers ?? false
  }

  useEffect(() => {
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  async function loadMembers() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.teams.teamsMembersList(teamId)
      setMembers(res.data ?? [])
    } catch {
      setError('Не удалось загрузить участников')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || adding) return

    setAdding(true)
    setError(null)
    try {
      await apiClient.teams.teamsMembersCreate(teamId, { email: trimmed })
      setEmail('')
      await loadMembers()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось добавить участника'))
    } finally {
      setAdding(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: number) {
    setUpdating(userId)
    setError(null)
    try {
      await apiClient.teams.teamsMembersRoleUpdate(teamId, userId, { role: newRole })
      await loadMembers()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось изменить роль'))
    } finally {
      setUpdating(null)
    }
  }

  async function handleDelete(userId: string) {
    setDeleting(userId)
    setError(null)
    try {
      await apiClient.teams.teamsMembersDelete(teamId, userId)
      await loadMembers()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось удалить участника'))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-[17px] font-bold m-0 mb-4">Участники команды</h2>

      {canManage && (
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            type="email"
            placeholder="Email участника"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 h-10 px-3 rounded-[9px] border border-line bg-panel text-sm text-ink font-ui focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
            disabled={adding}
          />
          <button
            type="submit"
            className={`${actionBtn} bg-accent hover:bg-accent-deep`}
            disabled={!email.trim() || adding}
          >
            {adding ? 'Добавление...' : 'Добавить'}
          </button>
        </form>
      )}

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-danger/10 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto -mx-[22px] px-[22px]">
        {loading ? (
          <div className="text-center py-8 text-muted">Загрузка...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted">Нет участников</div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const isSelf = !!user?.email && member.email === user.email
              // Себя (выход) — всегда; иначе по праву для роли участника.
              const removable = isSelf || canRemoveRole(member.role ?? 0)
              return (
              <div
                key={member.userId}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-panel border border-line"
              >
                <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold text-sm">
                  {getInitials(member.email || '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{member.email}</div>
                </div>
                {canChangeRoles ? (
                  <select
                    value={member.role ?? 0}
                    onChange={(e) => handleRoleChange(member.userId!, Number(e.target.value))}
                    className="h-8 px-2 rounded-[6px] border border-line bg-white text-sm font-ui cursor-pointer focus:outline-none focus:border-accent"
                    disabled={updating === member.userId || deleting === member.userId}
                  >
                    <option value={0}>{ROLE_LABELS[0]}</option>
                    <option value={1}>{ROLE_LABELS[1]}</option>
                    <option value={2}>{ROLE_LABELS[2]}</option>
                  </select>
                ) : (
                  <span className="h-8 px-2 inline-flex items-center text-sm text-muted">
                    {ROLE_LABELS[member.role ?? 0]}
                  </span>
                )}
                {removable && (
                  <button
                    type="button"
                    onClick={() => handleDelete(member.userId!)}
                    className="p-1.5 rounded-[6px] text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                    disabled={updating === member.userId || deleting === member.userId}
                    title={isSelf ? 'Покинуть команду' : 'Удалить из команды'}
                  >
                    {deleting === member.userId ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <TrashIcon size={16} />
                    )}
                  </button>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2.5 mt-4">
        <button type="button" className={ghostBtn} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </Modal>
  )
}
