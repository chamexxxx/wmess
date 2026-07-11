import type { MessageResponse } from '../../api/generated/data-contracts'

export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

interface Props {
  message: MessageResponse
  currentUserId: string
  onToggle: (emoji: string) => void
}

/** Показывает только уже проставленные реакции; ничего не рендерит, если их нет. */
export function ReactionBar({ message, currentUserId, onToggle }: Props) {
  const reactions = message.reactions ?? []
  const grouped = new Map<string, { count: number; mine: boolean }>()
  for (const r of reactions) {
    const emoji = r.emoji ?? ''
    const cur = grouped.get(emoji) ?? { count: 0, mine: false }
    cur.count++
    if (r.userId === currentUserId) cur.mine = true
    grouped.set(emoji, cur)
  }

  if (grouped.size === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {Array.from(grouped.entries()).map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          className={`px-2 py-0.5 rounded-full text-xs border cursor-pointer ${
            mine ? 'bg-accent-soft border-accent text-accent-deep' : 'bg-tile border-line text-muted'
          }`}
        >
          {emoji} {count}
        </button>
      ))}
    </div>
  )
}
