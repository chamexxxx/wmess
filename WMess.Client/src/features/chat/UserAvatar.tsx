import { colorFor, initials } from '../../workspace/theme'

function displayName(email?: string | null): string {
  if (!email) return 'Пользователь'
  const local = email.split('@')[0]
  return local || email
}

interface Props {
  name?: string | null
  userId?: string | null
  size?: number
}

export function UserAvatar({ name, userId, size = 36 }: Props) {
  const label = displayName(name)
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center text-white font-semibold select-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.34)),
        backgroundColor: colorFor(userId ?? name ?? label),
      }}
      title={name ?? label}
    >
      {initials(label)}
    </div>
  )
}
