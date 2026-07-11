import type { UserResponse } from '../api/generated/data-contracts'

export interface User {
  id: string
  email: string
  displayName: string
  hasAvatar: boolean
  // Меняется при загрузке/удалении аватарки — используется для сброса кэша <img>.
  avatarVersion: number
}

// Ответ API (сгенерированные типы — все поля опциональны) → модель пользователя.
export function toUser(res: UserResponse, avatarVersion = 0): User {
  return {
    id: res.id ?? '',
    email: res.email ?? '',
    displayName: res.displayName ?? '',
    hasAvatar: res.hasAvatar ?? false,
    avatarVersion,
  }
}
