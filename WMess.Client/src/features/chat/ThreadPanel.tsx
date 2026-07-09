import { useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '../../api'
import type { MessageResponse } from '../../api/generated/data-contracts'
import { useChatStore, EMPTY_ARRAY, type ReplyTarget } from '../../store/chatStore'
import { sendMessageWithFiles, sendTextMessage } from './chatApi'
import { MessageInput } from './MessageInput'
import { MessageItem } from './MessageItem'
import { usePanelResize } from './usePanelResize'

interface Props {
  chatId: number
  rootId: number
  currentUserId: string
  canManage: boolean
  pinnedIds: number[]
  onClose: () => void
  onTyping: () => void
  onReaction: (messageId: number, emoji: string) => void
  onPin: (messageId: number) => void
  onUnpin: (messageId: number) => void
}

export function ThreadPanel({
  chatId,
  rootId,
  currentUserId,
  canManage,
  pinnedIds,
  onClose,
  onTyping,
  onReaction,
  onPin,
  onUnpin,
}: Props) {
  const { width, onResizeStart } = usePanelResize('wmess-thread-panel-width', 320, 260, 560)
  const messages = useChatStore((s) => s.threadMessagesByRoot[rootId] ?? EMPTY_ARRAY)
  const rootMessage = useChatStore((s) =>
    (s.messagesByChat[chatId] ?? EMPTY_ARRAY).find((m) => Number(m.id) === rootId),
  )
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)

  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)
  const [quoteTarget, setQuoteTarget] = useState<MessageResponse | null>(null)
  const [editTarget, setEditTarget] = useState<MessageResponse | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiClient.chats
      .getMessages(chatId, { parentMessageId: rootId, limit: 100 })
      .then((res) => useChatStore.getState().setThreadMessages(rootId, res.data ?? EMPTY_ARRAY))
  }, [chatId, rootId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const messageById = useMemo(() => {
    const map = new Map<number, MessageResponse>()
    if (rootMessage) map.set(rootId, rootMessage)
    for (const m of messages) map.set(Number(m.id), m)
    return map
  }, [messages, rootMessage, rootId])

  const startEdit = (message: MessageResponse) => {
    setEditTarget(message)
    setReplyTarget(null)
    setQuoteTarget(null)
  }

  const handleSaveEdit = async (text: string) => {
    if (!editTarget) return
    await apiClient.chats.updateMessage(chatId, Number(editTarget.id), { content: text || null })
    updateMessage(chatId, {
      ...editTarget,
      content: text || null,
      editedAt: new Date().toISOString(),
    })
    setEditTarget(null)
  }

  const handleSend = async (text: string, files: File[], voiceWaveform?: string) => {
    const isNestedReply = replyTarget != null && Number(replyTarget.message.id) !== rootId
    const parentId = isNestedReply ? Number(replyTarget!.message.id) : rootId
    const mode = isNestedReply ? ('Flat' as const) : ('Thread' as const)
    const content = quoteTarget
      ? `> ${quoteTarget.authorEmail}: ${quoteTarget.content?.slice(0, 200) ?? ''}\n\n${text}`
      : text

    let msg: MessageResponse
    if (files.length > 0) {
      msg = await sendMessageWithFiles(
        chatId,
        { content: content || null, parentMessageId: parentId, replyMode: mode },
        files,
      )
    } else {
      msg = await sendTextMessage(chatId, {
        content,
        parentMessageId: parentId,
        replyMode: mode,
      })
    }

    if (voiceWaveform && msg.id != null) {
      await apiClient.chats.updateWaveform(chatId, Number(msg.id), { waveformData: voiceWaveform })
      msg = { ...msg, waveformData: voiceWaveform }
    }

    addMessage(chatId, msg)
  }

  const scrollTo = (id: number) => {
    document.getElementById(`thread-msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div style={{ width }} className="relative shrink-0 flex flex-col bg-panel min-h-0 border-l border-line">
      <div
        onMouseDown={onResizeStart}
        title="Потяните, чтобы изменить ширину"
        className="absolute left-0 top-0 bottom-0 w-1.5 z-10 cursor-col-resize hover:bg-accent/20"
      />

      <div className="h-12 border-b border-line flex items-center justify-between px-3 shrink-0">
        <span className="font-semibold text-sm">Тред · {messages.length}</span>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink cursor-pointer">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 min-h-0">
        {rootMessage && (
          <div className="border-b border-line pb-2 mb-2">
            <MessageItem
              message={rootMessage}
              currentUserId={currentUserId}
              canManage={canManage}
              isPinned={pinnedIds.includes(rootId)}
              inThread
              threadRootId={rootId}
              onReply={() => setReplyTarget({ message: rootMessage, mode: 'Thread' })}
              onQuote={() => setQuoteTarget(rootMessage)}
              onOpenThread={() => {}}
              onReaction={(emoji) => onReaction(rootId, emoji)}
              onPin={() => onPin(rootId)}
              onUnpin={() => onUnpin(rootId)}
              onEdit={() => startEdit(rootMessage)}
              onScrollTo={scrollTo}
            />
          </div>
        )}

        {messages.length === 0 ? (
          <div className="p-4 text-sm text-muted">Нет ответов в треде</div>
        ) : (
          messages.map((m) => {
            const msgId = Number(m.id)
            const parentId = m.parentMessageId != null ? Number(m.parentMessageId) : null
            const parent =
              parentId != null && parentId !== rootId ? messageById.get(parentId) ?? null : null
            return (
              <div key={m.id} id={`thread-msg-${m.id}`}>
                <MessageItem
                  message={m}
                  parent={parent}
                  currentUserId={currentUserId}
                  canManage={canManage}
                  isPinned={pinnedIds.includes(msgId)}
                  inThread
                  threadRootId={rootId}
                  onReply={() => setReplyTarget({ message: m, mode: 'Flat' })}
                  onQuote={() => setQuoteTarget(m)}
                  onOpenThread={() => {}}
                  onReaction={(emoji) => onReaction(msgId, emoji)}
                  onPin={() => onPin(msgId)}
                  onUnpin={() => onUnpin(msgId)}
                  onEdit={() => startEdit(m)}
                  onScrollTo={scrollTo}
                />
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        replyTarget={replyTarget}
        quoteTarget={quoteTarget}
        editTarget={editTarget}
        onSend={handleSend}
        onSaveEdit={handleSaveEdit}
        onTyping={onTyping}
        onClearReply={() => setReplyTarget(null)}
        onClearQuote={() => setQuoteTarget(null)}
        onClearEdit={() => setEditTarget(null)}
      />
    </div>
  )
}
