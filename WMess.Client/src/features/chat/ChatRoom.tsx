import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiClient } from '../../api'
import { ChatProvider, useChatConnection } from '../../providers/ChatProvider'
import { useChatStore, EMPTY_ARRAY } from '../../store/chatStore'
import { sendMessageWithFiles, sendTextMessage, getCurrentUserId } from './chatApi'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { PinnedPanel } from './PinnedPanel'
import { ThreadPanel } from './ThreadPanel'
import { isThreadMessage, isFlatReply, type ChatMessage } from './types'
import { ArrowLeftIcon } from '../../workspace/icons'
import type { MessageResponse } from '../../api/generated/data-contracts'

interface Props {
  chatId: number
  projectId: number
  teamId: number
  chatName?: string | null
}

function ChatRoomInner({ chatId, projectId, teamId, chatName }: Props) {
  const navigate = useNavigate()
  const { sendTyping } = useChatConnection()
  const [userId, setUserId] = useState('')

  useEffect(() => {
    void getCurrentUserId().then(setUserId)
  }, [])

  const messages = useChatStore((s) => s.messagesByChat[chatId] ?? EMPTY_ARRAY)
  const threadMessagesByRoot = useChatStore((s) => s.threadMessagesByRoot)
  const mainMessages = useMemo(() => {
    const threadIds = new Set<number>()
    for (const list of Object.values(threadMessagesByRoot)) {
      for (const m of list) threadIds.add(Number(m.id))
    }
    return messages.filter((m) => {
      const msg = m as ChatMessage
      if (isThreadMessage(msg)) return false
      if (isFlatReply(msg) && msg.parentMessageId != null && threadIds.has(Number(msg.parentMessageId))) {
        return false
      }
      return true
    })
  }, [messages, threadMessagesByRoot])
  const canManage = useChatStore((s) => s.canManage)
  const pinnedIds = useChatStore((s) => s.pinnedMessageIds[chatId] ?? EMPTY_ARRAY)
  const typingUsers = useChatStore((s) => s.typingByChat[chatId] ?? EMPTY_ARRAY)
  const replyTarget = useChatStore((s) => s.replyTarget)
  const threadRootId = useChatStore((s) => s.threadRootId)
  const threadReplyCounts = useChatStore((s) => s.threadReplyCounts)

  const setReplyTarget = useChatStore((s) => s.setReplyTarget)
  const setThreadRootId = useChatStore((s) => s.setThreadRootId)
  const setThreadReplyCount = useChatStore((s) => s.setThreadReplyCount)
  const prependMessages = useChatStore((s) => s.prependMessages)
  const addMessage = useChatStore((s) => s.addMessage)
  const addPinned = useChatStore((s) => s.addPinned)
  const removePinned = useChatStore((s) => s.removePinned)

  const fetchedThreadCounts = useRef(new Set<number>())

  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [pinnedMessages, setPinnedMessages] = useState<MessageResponse[]>([])
  const [startingCall, setStartingCall] = useState(false)
  const [editTarget, setEditTarget] = useState<MessageResponse | null>(null)

  const findMessage = useCallback(
    (messageId: number): MessageResponse | undefined => {
      return (
        mainMessages.find((m) => Number(m.id) === messageId) ??
        Object.values(threadMessagesByRoot)
          .flat()
          .find((m) => Number(m.id) === messageId)
      )
    },
    [mainMessages, threadMessagesByRoot],
  )

  const loadMessages = useCallback(async () => {
    const res = await apiClient.chats.getMessages(chatId, { limit: 50 })
    const data = res.data ?? []
    useChatStore.getState().setMessages(chatId, data)
    setHasMore(data.length >= 50)
  }, [chatId])

  const reloadPins = useCallback(async () => {
    const res = await apiClient.chats.getPinnedMessages(chatId)
    const pins = res.data ?? []
    const ids = pins.map((p) => Number(p.messageId))
    useChatStore.getState().setPinnedIds(chatId, ids)
    setPinnedMessages(pins.map((p) => p.message).filter(Boolean) as MessageResponse[])
  }, [chatId])

  useEffect(() => {
    void loadMessages()
    void apiClient.chats.markChatRead(chatId)
    void reloadPins()
  }, [chatId, loadMessages, reloadPins])

  useEffect(() => {
    fetchedThreadCounts.current.clear()
  }, [chatId])

  useEffect(() => {
    for (const m of mainMessages) {
      const id = Number(m.id)
      if (fetchedThreadCounts.current.has(id)) continue
      fetchedThreadCounts.current.add(id)
      void apiClient.chats.getThreadInfo(chatId, id).then((res) => {
        setThreadReplyCount(id, res.data?.replyCount ?? 0)
      })
    }
  }, [mainMessages, chatId, setThreadReplyCount])

  // Синхронизация панели пинов при событиях SignalR (только ids в store)
  useEffect(() => {
    setPinnedMessages((prev) => {
      const next = pinnedIds
        .map((id) => prev.find((m) => Number(m.id) === id) ?? findMessage(id))
        .filter(Boolean) as MessageResponse[]
      if (next.length === pinnedIds.length) return next
      if (next.length < pinnedIds.length) {
        void reloadPins()
      }
      return next
    })
  }, [pinnedIds, findMessage, reloadPins])

  const messageById = useMemo(() => {
    const map = new Map<number, MessageResponse>()
    for (const m of mainMessages) map.set(Number(m.id), m)
    return map
  }, [mainMessages])

  const handleLoadMore = async () => {
    if (!mainMessages.length) return
    setLoadingMore(true)
    try {
      const before = Number(mainMessages[0].id)
      const res = await apiClient.chats.getMessages(chatId, { before, limit: 50 })
      const data = res.data ?? []
      prependMessages(chatId, data)
      setHasMore(data.length >= 50)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSend = async (text: string, files: File[], voiceWaveform?: string) => {
    const parentId = replyTarget ? Number(replyTarget.message.id) : null
    const mode = replyTarget?.mode ?? null

    let msg: MessageResponse
    if (files.length > 0) {
      msg = await sendMessageWithFiles(
        chatId,
        {
          content: text || null,
          parentMessageId: parentId,
          replyMode: mode,
        },
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

  const handleReaction = async (messageId: number, emoji: string) => {
    await apiClient.chats.toggleReaction(chatId, messageId, { emoji })
  }

  const handlePin = async (messageId: number) => {
    await apiClient.chats.pinMessage(chatId, messageId)
    addPinned(chatId, messageId)
    const msg = findMessage(messageId)
    if (msg) {
      setPinnedMessages((prev) =>
        prev.some((m) => Number(m.id) === messageId) ? prev : [...prev, msg],
      )
    } else {
      void reloadPins()
    }
  }

  const handleUnpin = async (messageId: number) => {
    await apiClient.chats.unpinMessage(chatId, messageId)
    removePinned(chatId, messageId)
    setPinnedMessages((prev) => prev.filter((m) => Number(m.id) !== messageId))
  }

  const handleEdit = (message: MessageResponse) => {
    setEditTarget(message)
    setReplyTarget(null)
  }

  const handleDelete = async (messageId: number) => {
    if (!window.confirm('Удалить сообщение? Это действие необратимо.')) return
    await apiClient.chats.deleteMessage(chatId, messageId)
    useChatStore.getState().removeMessage(chatId, messageId)
    if (threadRootId === messageId) setThreadRootId(null)
  }

  const handleSaveEdit = async (text: string) => {
    if (!editTarget) return
    await apiClient.chats.updateMessage(chatId, Number(editTarget.id), { content: text || null })
    useChatStore.getState().updateMessage(chatId, {
      ...editTarget,
      content: text || null,
      editedAt: new Date().toISOString(),
    })
    setEditTarget(null)
  }

  const handleStartCall = async () => {
    setStartingCall(true)
    try {
      await apiClient.chats.startCall(chatId, { callType: 'video' })
    } finally {
      setStartingCall(false)
    }
  }

  return (
    <div className="h-full flex min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-12 border-b border-line flex items-center gap-3 px-4 shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/teams/${teamId}/projects/${projectId}/chats`)}
            title="К списку чатов"
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-hovered cursor-pointer"
          >
            <ArrowLeftIcon size={18} />
          </button>
          <span className="font-semibold truncate">{chatName ?? `Чат #${chatId}`}</span>
          <div className="ml-auto">
            <button
              type="button"
              disabled={startingCall}
              onClick={() => void handleStartCall()}
              className="text-xs px-3 py-1.5 rounded-md bg-tile text-muted hover:bg-hovered cursor-pointer disabled:opacity-50"
            >
              Начать звонок
            </button>
          </div>
        </div>

        <PinnedPanel
          pinnedMessages={pinnedMessages}
          onSelect={(id) => document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth' })}
        />

        {typingUsers.length > 0 && (
          <div className="px-4 py-1 text-xs text-faint italic">печатает…</div>
        )}

        <MessageList
          messages={mainMessages}
          currentUserId={userId}
          canManage={canManage}
          pinnedIds={pinnedIds}
          messageById={messageById}
          threadReplyCounts={threadReplyCounts}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={() => void handleLoadMore()}
          onReply={(m) => setReplyTarget({ message: m, mode: 'Flat' })}
          onOpenThread={(m) => setThreadRootId(Number(m.id))}
          onReaction={(id, emoji) => void handleReaction(id, emoji)}
          onPin={(id) => void handlePin(id)}
          onUnpin={(id) => void handleUnpin(id)}
          onEdit={handleEdit}
          onDelete={(id) => void handleDelete(id)}
        />

        <MessageInput
          replyTarget={replyTarget}
          editTarget={editTarget}
          onSend={handleSend}
          onSaveEdit={handleSaveEdit}
          onTyping={sendTyping}
          onClearReply={() => setReplyTarget(null)}
          onClearEdit={() => setEditTarget(null)}
        />
      </div>

      {threadRootId != null && (
        <ThreadPanel
          chatId={chatId}
          rootId={threadRootId}
          currentUserId={userId}
          canManage={canManage}
          pinnedIds={pinnedIds}
          onClose={() => setThreadRootId(null)}
          onTyping={sendTyping}
          onReaction={(id, emoji) => void handleReaction(id, emoji)}
          onPin={(id) => void handlePin(id)}
          onUnpin={(id) => void handleUnpin(id)}
          onDelete={(id) => void handleDelete(id)}
        />
      )}
    </div>
  )
}

export function ChatRoom(props: Props) {
  return (
    <ChatProvider chatId={props.chatId}>
      <ChatRoomInner {...props} />
    </ChatProvider>
  )
}
