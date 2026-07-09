import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiClient } from '../../api'
import { ChatProvider, useChatConnection } from '../../providers/ChatProvider'
import { useChatStore, EMPTY_ARRAY } from '../../store/chatStore'
import { sendMessageWithFiles, sendTextMessage, getCurrentUserId } from './chatApi'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { PinnedPanel } from './PinnedPanel'
import { ThreadPanel } from './ThreadPanel'
import { isThreadMessage, type ChatMessage } from './types'
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
  const canManage = useChatStore((s) => s.canManage)
  const pinnedIds = useChatStore((s) => s.pinnedMessageIds[chatId] ?? EMPTY_ARRAY)
  const typingUsers = useChatStore((s) => s.typingByChat[chatId] ?? EMPTY_ARRAY)
  const replyTarget = useChatStore((s) => s.replyTarget)
  const quoteTarget = useChatStore((s) => s.quoteTarget)
  const threadRootId = useChatStore((s) => s.threadRootId)

  const setReplyTarget = useChatStore((s) => s.setReplyTarget)
  const setQuoteTarget = useChatStore((s) => s.setQuoteTarget)
  const setThreadRootId = useChatStore((s) => s.setThreadRootId)


  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [pinnedMessages, setPinnedMessages] = useState<MessageResponse[]>([])
  const [startingCall, setStartingCall] = useState(false)

  const loadMessages = useCallback(async () => {
    const res = await apiClient.chats.getMessages(chatId, { limit: 50 })
    const data = res.data ?? []
    useChatStore.getState().setMessages(chatId, data)
    setHasMore(data.length >= 50)
  }, [chatId])

  useEffect(() => {
    void loadMessages()
    void apiClient.chats.markChatRead(chatId)
    void apiClient.chats.getPinnedMessages(chatId).then((res) => {
      const pins = res.data ?? []
      const ids = pins.map((p) => Number(p.messageId))
      useChatStore.getState().setPinnedIds(chatId, ids)
      setPinnedMessages(pins.map((p) => p.message).filter(Boolean) as MessageResponse[])
    })
  }, [chatId, loadMessages])

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
    const content = quoteTarget
      ? `> ${quoteTarget.authorEmail}: ${quoteTarget.content?.slice(0, 200) ?? ''}\n\n${text}`
      : text

    let msg: MessageResponse
    if (files.length > 0) {
      msg = await sendMessageWithFiles(chatId, {
        content: content || null,
        parentMessageId: parentId,
        replyMode: mode,
      }, files)
    } else {
      msg = await sendTextMessage(chatId, {
        content,
        parentMessageId: parentId,
        replyMode: mode,
      })
    }

    if (voiceWaveform && msg.id != null) {
      await apiClient.chats.updateWaveform(chatId, Number(msg.id), { waveformData: voiceWaveform })
    }

    useChatStore.getState().addMessage(chatId, msg)
  }


    if (voiceWaveform && msg.id != null) {
      await apiClient.chats.updateWaveform(chatId, Number(msg.id), { waveformData: voiceWaveform })
    }

    addMessage(chatId, msg as ChatMessage)
    if (mode === 'Thread' && parentId != null) {
      setThreadRootId(parentId)
    }
  }

  const handleReaction = async (messageId: number, emoji: string) => {
    await apiClient.chats.toggleReaction(chatId, messageId, { emoji })
  }

  const handlePin = async (messageId: number) => {
    await apiClient.chats.pinMessage(chatId, messageId)
  }

  const handleUnpin = async (messageId: number) => {
    await apiClient.chats.unpinMessage(chatId, messageId)
  }

  const handleEdit = async (message: MessageResponse) => {
    const next = window.prompt('Новый текст', message.content ?? '')
    if (next == null) return
    await apiClient.chats.updateMessage(chatId, Number(message.id), { content: next })
  }

  const handleStartCall = async (video: boolean) => {
    setStartingCall(true)
    try {
      await apiClient.chats.startCall(chatId, { callType: video ? 'video' : 'audio' })
    } finally {
      setStartingCall(false)
    }
  }

  return (
    <div className="h-full flex min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-line flex items-center gap-3 px-4 shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/teams/${teamId}/projects/${projectId}/chats`)}
            className="text-muted hover:text-ink cursor-pointer"
          >
            ←
          </button>
          <span className="font-semibold truncate">{chatName ?? `Чат #${chatId}`}</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={startingCall}
              onClick={() => void handleStartCall(false)}
              className="text-xs px-2 py-1 rounded-md bg-tile text-muted hover:bg-hovered cursor-pointer disabled:opacity-50"
            >
              📞
            </button>
            <button
              type="button"
              disabled={startingCall}
              onClick={() => void handleStartCall(true)}
              className="text-xs px-2 py-1 rounded-md bg-tile text-muted hover:bg-hovered cursor-pointer disabled:opacity-50"
            >
              📹
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
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={() => void handleLoadMore()}
          onReply={(m, flat) => {
            setReplyTarget({ message: m, mode: flat ? 'Flat' : 'Thread' })
            if (!flat) setThreadRootId(Number(m.id))
          }}
          onQuote={setQuoteTarget}
          onOpenThread={(m) => setThreadRootId(Number(m.id))}
          onReaction={(id, emoji) => void handleReaction(id, emoji)}
          onPin={(id) => void handlePin(id)}
          onUnpin={(id) => void handleUnpin(id)}
          onEdit={(m) => void handleEdit(m)}
        />

        <MessageInput
          replyTarget={replyTarget}
          quoteTarget={quoteTarget}
          onSend={handleSend}
          onTyping={sendTyping}
          onClearReply={() => setReplyTarget(null)}
          onClearQuote={() => setQuoteTarget(null)}
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
          onReaction={(id, emoji) => void handleReaction(id, emoji)}
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
