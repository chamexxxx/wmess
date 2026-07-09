import type { MessageResponse } from '../../api/generated/data-contracts'

interface Props {
  pinnedMessages: MessageResponse[]
  onSelect: (id: number) => void
}

export function PinnedPanel({ pinnedMessages, onSelect }: Props) {
  if (!pinnedMessages.length) return null

  return (
    <div className="border-b border-line bg-accent-soft/30 px-4 py-2 shrink-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-accent mb-1">Закреплённое</div>
      <div className="flex flex-col gap-1">
        {pinnedMessages.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(Number(m.id))}
            className="text-left text-xs text-muted hover:text-ink truncate cursor-pointer"
          >
            📌 {m.authorEmail}: {m.content?.slice(0, 60) ?? 'вложение'}
          </button>
        ))}
      </div>
    </div>
  )
}
