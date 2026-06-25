// Подписи ролей для отображения. Решения о правах считает сервер и отдаёт готовыми
// флагами (TeamDetailResponse.permissions, TeamMemberResponse.canRemove) — на клиенте
// ролевой логики нет.
export const ROLE_LABELS: Record<number, string> = {
  0: 'Участник',
  1: 'Админ',
  2: 'Владелец',
}
