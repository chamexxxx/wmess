import { create } from 'zustand'
import type { ChatResponse, MessageResponse } from '../api/generated/data-contracts'
import type { ReplyMode } from '../features/chat/chatApi'

export interface ReplyTarget {
  message: MessageResponse
  mode: ReplyMode
}

interface ChatState {
  chats: ChatResponse[]
  activeChatId: number | null
  canManage: boolean
  messagesByChat: Record<number, MessageResponse[]>
  pinnedMessageIds: Record<number, number[]>
  typingByChat: Record<number, string[]>
  replyTarget: ReplyTarget | null
  quoteTarget: MessageResponse | null
  threadRootId: number | null
  setChats: (chats: ChatResponse[]) => void
  setActiveChat: (chatId: number | null, canManage?: boolean) => void
  setMessages: (chatId: number, messages: MessageResponse[]) => void
  prependMessages: (chatId: number, messages: MessageResponse[]) => void
  addMessage: (chatId: number, message: MessageResponse) => void
  updateMessage: (chatId: number, message: MessageResponse) => void
  removeMessage: (chatId: number, messageId: number) => void
  setPinnedIds: (chatId: number, ids: number[]) => void
  addPinned: (chatId: number, messageId: number) => void
  removePinned: (chatId: number, messageId: number) => void
  setTyping: (chatId: number, userId: string, typing: boolean) => void
  setReplyTarget: (target: ReplyTarget | null) => void
  setQuoteTarget: (message: MessageResponse | null) => void
  setThreadRootId: (id: number | null) => void
  applyReaction: (
    chatId: number,
    messageId: number,
    userId: string,
    emoji: string,
    added: boolean,
  ) => void
}

function upsertMessage(list: MessageResponse[], message: MessageResponse): MessageResponse[] {
  const id = Number(message.id)
  const idx = list.findIndex((m) => Number(m.id) === id)
  if (idx === -1) return [...list, message]
  const next = [...list]
  next[idx] = message
  return next
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  canManage: false,
  messagesByChat: {},
  pinnedMessageIds: {},
  typingByChat: {},
  replyTarget: null,
  quoteTarget: null,
  threadRootId: null,

  setChats: (chats) => set({ chats }),

  setActiveChat: (chatId, canManage = false) =>
    set({ activeChatId: chatId, canManage, replyTarget: null, quoteTarget: null }),

  setMessages: (chatId, messages) =>
    set((s) => ({ messagesByChat: { ...s.messagesByChat, [chatId]: messages } })),

  prependMessages: (chatId, messages) =>
    set((s) => ({
      messagesByChat: {
        ...s.messagesByChat,
        [chatId]: [...messages, ...(s.messagesByChat[chatId] ?? [])],
      },
    })),

  addMessage: (chatId, message) =>
    set((s) => ({
      messagesByChat: {
        ...s.messagesByChat,
        [chatId]: upsertMessage(s.messagesByChat[chatId] ?? [], message),
      },
    })),

  updateMessage: (chatId, message) =>
    set((s) => ({
      messagesByChat: {
        ...s.messagesByChat,
        [chatId]: upsertMessage(s.messagesByChat[chatId] ?? [], message),
      },
    })),

  removeMessage: (chatId, messageId) =>
    set((s) => ({
      messagesByChat: {
        ...s.messagesByChat,
        [chatId]: (s.messagesByChat[chatId] ?? []).filter((m) => Number(m.id) !== messageId),
      },
    })),

  setPinnedIds: (chatId, ids) =>
    set((s) => ({ pinnedMessageIds: { ...s.pinnedMessageIds, [chatId]: ids } })),

  addPinned: (chatId, messageId) =>
    set((s) => {
      const cur = s.pinnedMessageIds[chatId] ?? []
      if (cur.includes(messageId)) return s
      return { pinnedMessageIds: { ...s.pinnedMessageIds, [chatId]: [...cur, messageId] } }
    }),

  removePinned: (chatId, messageId) =>
    set((s) => ({
      pinnedMessageIds: {
        ...s.pinnedMessageIds,
        [chatId]: (s.pinnedMessageIds[chatId] ?? []).filter((id) => id !== messageId),
      },
    })),

  setTyping: (chatId, userId, typing) =>
    set((s) => {
      const cur = new Set(s.typingByChat[chatId] ?? [])
      if (typing) cur.add(userId)
      else cur.delete(userId)
      return { typingByChat: { ...s.typingByChat, [chatId]: Array.from(cur) } }
    }),

  setReplyTarget: (replyTarget) => set({ replyTarget }),
  setQuoteTarget: (quoteTarget) => set({ quoteTarget }),
  setThreadRootId: (threadRootId) => set({ threadRootId }),

  applyReaction: (chatId, messageId, userId, emoji, added) =>
    set((s) => {
      const messages = s.messagesByChat[chatId] ?? []
      const next = messages.map((m) => {
        if (Number(m.id) !== messageId) return m
        const reactions = [...(m.reactions ?? [])]
        const idx = reactions.findIndex((r) => r.userId === userId && r.emoji === emoji)
        if (added && idx === -1) {
          reactions.push({ messageId, userId, emoji, createdAt: new Date().toISOString() })
        } else if (!added && idx !== -1) {
          reactions.splice(idx, 1)
        }
        return { ...m, reactions }
      })
      return { messagesByChat: { ...s.messagesByChat, [chatId]: next } }
    }),
}))
