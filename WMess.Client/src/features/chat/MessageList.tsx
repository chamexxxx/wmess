import { type ReactNode } from 'react'
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
  onOpenThread: (message: MessageResponse) => void
  onReaction: (messageId: number, emoji: string) => void
  onPin: (messageId: number) => void
  onUnpin: (messageId: number) => void
  onEdit: (message: MessageResponse) => void
  onDelete: (messageId: number) => void
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
  onOpenThread,
  onReaction,
  onPin,
  onUnpin,
  onEdit,
  onDelete,
}: Props) {
  const scrollTo = (id: number) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const renderMessages = () => {
    const elements: ReactNode[] = []
    let lastDateStr = ''

    for (const m of messages) {
      const date = new Date(m.createdAt ?? '')
      const dateStr = date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

      if (dateStr !== lastDateStr) {
        elements.push(
          <div key={`date-${dateStr}`} className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[11px] font-bold text-faint uppercase tracking-wider">
              {dateStr}
            </span>
            <div className="flex-1 h-px bg-line" />
          </div>,
        )
        lastDateStr = dateStr
      }

      const parentId = m.parentMessageId != null ? Number(m.parentMessageId) : null
      const parent = parentId != null ? messageById.get(parentId) : null
      const msgId = Number(m.id)

      elements.push(
        <MessageItem
          key={m.id}
          message={m}
          parent={parent}
          currentUserId={currentUserId}
          canManage={canManage}
          isPinned={pinnedIds.includes(msgId)}
          threadReplyCount={threadReplyCounts[msgId] ?? 0}
          onReply={() => onReply(m)}
          onOpenThread={() => onOpenThread(m)}
          onReaction={(emoji) => onReaction(msgId, emoji)}
          onPin={() => onPin(msgId)}
          onUnpin={() => onUnpin(msgId)}
          onEdit={() => onEdit(m)}
          onDelete={() => onDelete(msgId)}
          onScrollTo={scrollTo}
        />,
      )
    }

    return elements
  }

  // flex-col-reverse: при открытии сразу видны последние сообщения, без JS-скролла
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col-reverse px-4 py-3">
      <div className="flex flex-col justify-end min-h-full">
        {hasMore && (
          <div className="text-center py-2">
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
        {renderMessages()}
      </div>
    </div>
  )
}
