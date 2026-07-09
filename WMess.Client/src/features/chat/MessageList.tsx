import { useEffect, useRef } from 'react'
import type { MessageResponse } from '../../api/generated/data-contracts'
import { MessageItem } from './MessageItem'

interface Props {
  messages: MessageResponse[]
  currentUserId: string
  canManage: boolean
  pinnedIds: number[]
  messageById: Map<number, MessageResponse>
  threadReplyCounts?: Record<number, number>
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onReply: (message: MessageResponse) => void
  onQuote: (message: MessageResponse) => void
  onOpenThread: (message: MessageResponse) => void
  onReaction: (messageId: number, emoji: string) => void
  onPin: (messageId: number) => void
  onUnpin: (messageId: number) => void
  onEdit: (message: MessageResponse) => void
}

export function MessageList({
  messages,
  currentUserId,
  canManage,
  pinnedIds,
  messageById,
  threadReplyCounts = {},
  loadingMore,
  hasMore,
  onLoadMore,
  onReply,
  onQuote,
  onOpenThread,
  onReaction,
  onPin,
  onUnpin,
  onEdit,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const scrollTo = (id: number) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {hasMore && (
        <div ref={topRef} className="text-center py-2">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="text-xs text-accent hover:underline cursor-pointer disabled:opacity-50"
          >
            {loadingMore ? 'Загрузка…' : 'Загрузить ранние сообщения'}
          </button>
        </div>
      )}
      {messages.map((m) => {
        const parentId = m.parentMessageId != null ? Number(m.parentMessageId) : null
        const parent = parentId != null ? messageById.get(parentId) : null
        const msgId = Number(m.id)
        return (
          <MessageItem
            key={m.id}
            message={m}
            parent={parent}
            currentUserId={currentUserId}
            canManage={canManage}
            isPinned={pinnedIds.includes(msgId)}
            threadReplyCount={threadReplyCounts[msgId] ?? 0}
            onReply={() => onReply(m)}
            onQuote={() => onQuote(m)}
            onOpenThread={() => onOpenThread(m)}
            onReaction={(emoji) => onReaction(msgId, emoji)}
            onPin={() => onPin(msgId)}
            onUnpin={() => onUnpin(msgId)}
            onEdit={() => onEdit(m)}
            onScrollTo={scrollTo}
          />
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
