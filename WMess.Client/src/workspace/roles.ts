import type { TeamRole } from '../api/generated/data-contracts'

// TeamRole — числовой enum с бэкенда, упорядочен от меньших прав к большим.
export const TeamRoleValue = {
  Member: 0,
  Admin: 1,
  Owner: 2,
} as const

export const ROLE_LABELS: Record<number, string> = {
  [TeamRoleValue.Member]: 'Участник',
  [TeamRoleValue.Admin]: 'Админ',
  [TeamRoleValue.Owner]: 'Владелец',
}

// Owner или Admin — управление командой и проектами (политики TeamManage / ProjectManage).
export function canManageTeam(role: TeamRole | undefined): boolean {
  return role === TeamRoleValue.Admin || role === TeamRoleValue.Owner
}

// Только Owner — удаление команды (TeamDelete) и смена ролей участников (TeamChangeRole).
export function isTeamOwner(role: TeamRole | undefined): boolean {
  return role === TeamRoleValue.Owner
}
