import { useEffect } from 'react'
import { apiClient } from '../../api'
import { useChatStore } from '../../store/chatStore'
import { MessageItem } from './MessageItem'

interface Props {
  chatId: number
  rootId: number
  currentUserId: string
  canManage: boolean
  pinnedIds: number[]
  onClose: () => void
  onReaction: (messageId: number, emoji: string) => void
}

export function ThreadPanel({
  chatId,
  rootId,
  currentUserId,
  canManage,
  pinnedIds,
  onClose,
  onReaction,
}: Props) {
  const messages = useChatStore((s) => s.threadMessagesByRoot[rootId] ?? [])
  const setThreadMessages = useChatStore((s) => s.setThreadMessages)

  useEffect(() => {
    apiClient.chats
      .getMessages(chatId, { parentMessageId: rootId, limit: 100 })
      .then((res) => setThreadMessages(rootId, res.data ?? []))
  }, [chatId, rootId, setThreadMessages])

  return (
    <div className="w-80 border-l border-line flex flex-col bg-panel shrink-0">
      <div className="h-12 border-b border-line flex items-center justify-between px-3 shrink-0">
        <span className="font-semibold text-sm">Тред · {messages.length}</span>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink cursor-pointer">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {messages.length === 0 ? (
          <div className="p-4 text-sm text-muted">Нет ответов в треде</div>
        ) : (
          messages.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              currentUserId={currentUserId}
              canManage={canManage}
              isPinned={pinnedIds.includes(Number(m.id))}
              onReply={() => {}}
              onQuote={() => {}}
              onOpenThread={() => {}}
              onReaction={(emoji) => onReaction(Number(m.id), emoji)}
              onPin={() => {}}
              onUnpin={() => {}}
              onEdit={() => {}}
              onScrollTo={() => {}}
            />
          ))
        )}
      </div>
    </div>
  )
}
