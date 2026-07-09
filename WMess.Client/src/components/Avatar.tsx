import { useState } from 'react'
import { initials, colorFor } from '../workspace/theme'

interface AvatarProps {
  userId: string | undefined
  name: string | undefined
  hasAvatar: boolean | undefined
  // Меняется при обновлении аватарки — сбрасывает кэш <img>.
  version?: number
  size?: number
  className?: string
}

/**
 * Аватар пользователя: показывает загруженную картинку (через /api/user/{id}/avatar),
 * а при её отсутствии или ошибке загрузки — цветную плитку с инициалами имени.
 */
export function Avatar({ userId, name, hasAvatar, version = 0, size = 34, className = '' }: AvatarProps) {
  // Запоминаем URL, который не загрузился, а не булев флаг: при смене userId/version
  // src меняется и картинка снова пробует загрузиться — без эффекта-сброса.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const src = userId ? `/api/user/${userId}/avatar?v=${version}` : null
  const showImage = !!src && !!hasAvatar && failedSrc !== src

  if (showImage) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        onError={() => setFailedSrc(src)}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`rounded-full text-white flex items-center justify-center font-semibold font-ui ${className}`}
      style={{ width: size, height: size, backgroundColor: colorFor(userId ?? name), fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  )
}
