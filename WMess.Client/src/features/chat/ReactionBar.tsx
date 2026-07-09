import type { MessageResponse } from '../../api/generated/data-contracts'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

interface Props {
  message: MessageResponse
  currentUserId: string
  onToggle: (emoji: string) => void
}

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
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {QUICK_EMOJIS.filter((e) => !grouped.has(e)).map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            className="text-sm hover:scale-110 cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
