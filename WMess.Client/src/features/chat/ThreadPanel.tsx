import { useEffect, useMemo, useState } from 'react'
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
  onDelete: (messageId: number) => void
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
  onDelete,
}: Props) {
  const { width, onResizeStart } = usePanelResize('wmess-thread-panel-width', 320, 260, 560)
  const messages = useChatStore((s) => s.threadMessagesByRoot[rootId] ?? EMPTY_ARRAY)
  const rootMessage = useChatStore((s) =>
    (s.messagesByChat[chatId] ?? EMPTY_ARRAY).find((m) => Number(m.id) === rootId),
  )
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)

  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)
  const [editTarget, setEditTarget] = useState<MessageResponse | null>(null)

  useEffect(() => {
    apiClient.chats
      .getMessages(chatId, { parentMessageId: rootId, limit: 100 })
      .then((res) => useChatStore.getState().setThreadMessages(rootId, res.data ?? EMPTY_ARRAY))
  }, [chatId, rootId])

  const messageById = useMemo(() => {
    const map = new Map<number, MessageResponse>()
    if (rootMessage) map.set(rootId, rootMessage)
    for (const m of messages) map.set(Number(m.id), m)
    return map
  }, [messages, rootMessage, rootId])

  const startEdit = (message: MessageResponse) => {
    setEditTarget(message)
    setReplyTarget(null)
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

    let msg: MessageResponse
    if (files.length > 0) {
      msg = await sendMessageWithFiles(
        chatId,
        { content: text || null, parentMessageId: parentId, replyMode: mode },
        files,
      )
    } else {
      msg = await sendTextMessage(chatId, {
        content: text,
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
    <div
      style={{ width }}
      className="relative shrink-0 flex flex-col bg-panel min-h-0 min-w-0 border-l border-line overflow-hidden"
    >
      <div
        onMouseDown={onResizeStart}
        title="Потяните, чтобы изменить ширину"
        className="absolute left-0 top-0 bottom-0 w-1.5 z-10 cursor-col-resize hover:bg-accent/20"
      />

      <div className="h-12 border-b border-line flex items-center justify-between px-3 shrink-0">
        <span className="font-semibold text-sm truncate">Тред · {messages.length}</span>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink cursor-pointer shrink-0">
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col-reverse px-2">
        <div className="flex flex-col justify-end min-h-full min-w-0">
          {rootMessage && (
            <div className="border-b border-line pb-2 mb-2 min-w-0">
              <MessageItem
                message={rootMessage}
                currentUserId={currentUserId}
                canManage={canManage}
                isPinned={pinnedIds.includes(rootId)}
                inThread
                threadRootId={rootId}
                onReply={() => setReplyTarget({ message: rootMessage, mode: 'Thread' })}
                onOpenThread={() => {}}
                onReaction={(emoji) => onReaction(rootId, emoji)}
                onPin={() => onPin(rootId)}
                onUnpin={() => onUnpin(rootId)}
                onEdit={() => startEdit(rootMessage)}
                onDelete={() => onDelete(rootId)}
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
                <div key={m.id} id={`thread-msg-${m.id}`} className="min-w-0">
                  <MessageItem
                    message={m}
                    parent={parent}
                    currentUserId={currentUserId}
                    canManage={canManage}
                    isPinned={pinnedIds.includes(msgId)}
                    inThread
                    threadRootId={rootId}
                    onReply={() => setReplyTarget({ message: m, mode: 'Flat' })}
                    onOpenThread={() => {}}
                    onReaction={(emoji) => onReaction(msgId, emoji)}
                    onPin={() => onPin(msgId)}
                    onUnpin={() => onUnpin(msgId)}
                    onEdit={() => startEdit(m)}
                    onDelete={() => onDelete(msgId)}
                    onScrollTo={scrollTo}
                  />
                </div>
              )
            })
          )}
        </div>
      </div>

      <MessageInput
        replyTarget={replyTarget}
        editTarget={editTarget}
        onSend={handleSend}
        onSaveEdit={handleSaveEdit}
        onTyping={onTyping}
        onClearReply={() => setReplyTarget(null)}
        onClearEdit={() => setEditTarget(null)}
      />
    </div>
  )
}
