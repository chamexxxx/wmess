import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'
import type { TeamMemberResponse, TeamPermissions, TeamResponse } from '../api/generated/data-contracts'
import { TrashIcon } from '../workspace/icons'
import { ROLE_LABELS } from '../workspace/roles'
import { RoleSelect } from './RoleSelect'
import { ConfirmDialog } from './WorkspaceModals'

const sectionLabel = 'font-ui font-semibold text-[10.5px] tracking-[.06em] uppercase text-faintest'

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

interface TeamSettingsProps {
  team: TeamResponse
  // Готовые права текущего пользователя в команде (считает сервер).
  permissions?: TeamPermissions
  busy: boolean
  // Owner/Admin — иначе настройки доступны только для просмотра.
  canManage: boolean
  // Только Owner — удаление команды.
  canDelete: boolean
  onRename: (name: string) => void
  onDelete: () => void
  // Состав/роли изменились — родитель перечитывает права текущего пользователя.
  onMembersChanged?: () => void
}

export function TeamSettings({
  team,
  permissions,
  busy,
  canManage,
  canDelete,
  onRename,
  onDelete,
  onMembersChanged,
}: TeamSettingsProps) {
  const { user } = useAuth()
  const teamId = Number(team.id)

  const [name, setName] = useState(team.name ?? '')
  const trimmed = name.trim()
  const changed = trimmed.length > 0 && trimmed !== team.name

  const [members, setMembers] = useState<TeamMemberResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  // Участник, которого хотят назначить владельцем (ждёт подтверждения передачи владения).
  const [pendingOwner, setPendingOwner] = useState<TeamMemberResponse | null>(null)

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
    const value = email.trim()
    if (!value || adding) return

    setAdding(true)
    setError(null)
    try {
      await apiClient.teams.teamsMembersCreate(teamId, { email: value })
      setEmail('')
      await loadMembers()
      onMembersChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось добавить участника'))
    } finally {
      setAdding(false)
    }
  }

  async function applyRoleChange(userId: string, newRole: number) {
    setUpdating(userId)
    setError(null)
    try {
      await apiClient.teams.teamsMembersRoleUpdate(teamId, userId, { role: newRole })
      await loadMembers()
      onMembersChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось изменить роль'))
    } finally {
      setUpdating(null)
    }
  }

  function handleRoleChange(member: TeamMemberResponse, newRole: number) {
    // Назначение владельцем — это передача владения, подтверждаем отдельным окном.
    if (newRole === 2) {
      setPendingOwner(member)
      return
    }
    applyRoleChange(member.userId!, newRole)
  }

  async function confirmTransferOwnership() {
    if (!pendingOwner) return
    await applyRoleChange(pendingOwner.userId!, 2)
    setPendingOwner(null)
  }

  async function handleRemoveMember(userId: string) {
    setDeleting(userId)
    setError(null)
    try {
      await apiClient.teams.teamsMembersDelete(teamId, userId)
      await loadMembers()
      onMembersChanged?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось удалить участника'))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="px-6 py-6 max-w-[640px]">
      {/* Общие — переименование команды */}
      <div className={`${sectionLabel} mb-2`}>Общие</div>
      <div className="bg-white border border-line rounded-xl p-4 mb-6">
        <label className="block text-[12.5px] text-muted mb-2">Название команды</label>
        <div className="flex gap-2">
          <input
            value={name}
            maxLength={100}
            disabled={!canManage}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && changed && !busy && canManage) onRename(trimmed)
            }}
            className="flex-1 min-w-0 h-10 px-3 rounded-[9px] border border-line bg-panel text-sm text-ink font-ui focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 disabled:opacity-60"
          />
          {canManage && (
            <button
              type="button"
              disabled={!changed || busy}
              onClick={() => onRename(trimmed)}
              className="h-10 px-[18px] rounded-[9px] bg-accent text-white text-[13.5px] font-semibold cursor-pointer hover:bg-accent-deep disabled:opacity-60 font-ui"
            >
              Сохранить
            </button>
          )}
        </div>
        {!canManage && (
          <div className="text-[12.5px] text-faint mt-2">
            Менять настройки команды могут только владелец или администратор.
          </div>
        )}
      </div>

      {/* Участники */}
      <div className={`${sectionLabel} mb-2`}>Участники</div>
      <div className="bg-white border border-line rounded-xl p-4 mb-6">
        {canManage && (
          <form onSubmit={handleAdd} className="flex gap-2 mb-4">
            <input
              type="email"
              placeholder="Email участника"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={adding}
              className="flex-1 min-w-0 h-10 px-3 rounded-[9px] border border-line bg-panel text-sm text-ink font-ui focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={!email.trim() || adding}
              className="h-10 px-[18px] rounded-[9px] bg-accent text-white text-[13.5px] font-semibold cursor-pointer hover:bg-accent-deep disabled:opacity-60 font-ui"
            >
              {adding ? 'Добавление…' : 'Добавить'}
            </button>
          </form>
        )}

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-6 text-muted text-sm">Загрузка…</div>
        ) : members.length === 0 ? (
          <div className="text-center py-6 text-muted text-sm">Нет участников</div>
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
                  {canChangeRoles && !isSelf ? (
                    <RoleSelect
                      value={member.role ?? 0}
                      disabled={updating === member.userId || deleting === member.userId}
                      onChange={(role) => handleRoleChange(member, role)}
                    />
                  ) : (
                    <span className="h-8 px-2 inline-flex items-center text-sm text-muted">
                      {ROLE_LABELS[member.role ?? 0]}
                    </span>
                  )}
                  {removable && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.userId!)}
                      disabled={updating === member.userId || deleting === member.userId}
                      className="p-1.5 rounded-[6px] text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                      title={isSelf ? 'Покинуть команду' : 'Удалить из команды'}
                    >
                      {deleting === member.userId ? (
                        <span className="text-xs">…</span>
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

      {/* Опасная зона — удаление команды */}
      {canDelete && (
        <>
          <div className={`${sectionLabel} mb-2`}>Опасная зона</div>
          <div className="border border-danger/40 bg-danger/5 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-danger-deep">Удалить команду</div>
              <div className="text-[12.5px] text-danger-deep/80 mt-0.5">
                Команда и все её проекты будут удалены без возможности восстановления.
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="shrink-0 h-9 px-4 rounded-[9px] border border-danger text-danger-deep text-[13px] font-semibold cursor-pointer hover:bg-danger hover:text-white disabled:opacity-60 font-ui bg-white"
            >
              Удалить
            </button>
          </div>
        </>
      )}

      {pendingOwner && (
        <ConfirmDialog
          title="Сделать владельцем?"
          message={
            <>
              Назначить «{pendingOwner.email}» владельцем команды? Вы перестанете быть
              владельцем и станете администратором.
            </>
          }
          confirmLabel="Назначить владельцем"
          busy={updating === pendingOwner.userId}
          onConfirm={confirmTransferOwnership}
          onClose={() => setPendingOwner(null)}
        />
      )}
    </div>
  )
}
