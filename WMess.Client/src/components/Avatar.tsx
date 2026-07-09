import { useEffect, useRef, useState } from 'react'
import { apiClient } from '../api'
import { initials, colorFor } from '../workspace/theme'

interface AvatarProps {
  userId: string | undefined
  name: string | undefined
  hasAvatar: boolean | undefined
  // Меняется при обновлении аватарки — форсирует перезагрузку.
  version?: number
  size?: number
  className?: string
}

/**
 * Аватар пользователя: тянет картинку через axios (blob → object URL), чтобы работали
 * авторизация и X-CSRF; при отсутствии/ошибке показывает цветную плитку с инициалами.
 */
export function Avatar({ userId, name, hasAvatar, version = 0, size = 34, className = '' }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId || !hasAvatar) return
    let cancelled = false
    apiClient
      .fetchUserAvatar(userId)
      .then((blob) => {
        if (cancelled) return
        const next = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = next
        setUrl(next)
      })
      .catch(() => {
        // 404/ошибка — остаёмся на инициалах.
      })
    return () => {
      cancelled = true
    }
  }, [userId, hasAvatar, version])

  // Освобождаем последний object URL при размонтировании.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  if (hasAvatar && url) {
    return (
      <img
        src={url}
        alt={name ?? ''}
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
