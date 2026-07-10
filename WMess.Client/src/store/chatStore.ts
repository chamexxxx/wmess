import { create } from 'zustand'
import type { ChatResponse, MessageResponse } from '../api/generated/data-contracts'
import type { ReplyMode } from '../features/chat/chatApi'
import { belongsToThread, isFlatReply, isThreadMessage, threadRootId, type ChatMessage } from '../features/chat/types'

export interface ReplyTarget {
  message: MessageResponse
  mode: ReplyMode
}

interface ChatState {
  chats: ChatResponse[]
  activeChatId: number | null
  canManage: boolean
  messagesByChat: Record<number, MessageResponse[]>
  threadMessagesByRoot: Record<number, MessageResponse[]>
  pinnedMessageIds: Record<number, number[]>
  typingByChat: Record<number, string[]>
  replyTarget: ReplyTarget | null
  quoteTarget: MessageResponse | null
  threadRootId: number | null
  threadReplyCounts: Record<number, number>
  setChats: (chats: ChatResponse[]) => void
  setActiveChat: (chatId: number | null, canManage?: boolean) => void
  setMessages: (chatId: number, messages: MessageResponse[]) => void
  setThreadMessages: (rootId: number, messages: MessageResponse[]) => void
  prependMessages: (chatId: number, messages: MessageResponse[]) => void
  addMessage: (chatId: number, message: MessageResponse) => void
  addThreadMessage: (rootId: number, message: MessageResponse) => void
  updateMessage: (chatId: number, message: MessageResponse) => void
  removeMessage: (chatId: number, messageId: number) => void
  setPinnedIds: (chatId: number, ids: number[]) => void
  addPinned: (chatId: number, messageId: number) => void
  removePinned: (chatId: number, messageId: number) => void
  setTyping: (chatId: number, userId: string, typing: boolean) => void
  setReplyTarget: (target: ReplyTarget | null) => void
  setQuoteTarget: (message: MessageResponse | null) => void
  setThreadRootId: (id: number | null) => void
  setThreadReplyCount: (rootId: number, count: number) => void
  applyReaction: (
    chatId: number,
    messageId: number,
    userId: string,
    emoji: string,
    added: boolean,
  ) => void
}

function applyReactionToList(
  messages: MessageResponse[],
  messageId: number,
  userId: string,
  emoji: string,
  added: boolean,
): MessageResponse[] {
  return messages.map((m) => {
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
}

function upsertMessage(list: MessageResponse[], message: MessageResponse): MessageResponse[] {
  const id = Number(message.id)
  const idx = list.findIndex((m) => Number(m.id) === id)
  if (idx === -1) return [...list, message]
  const next = [...list]
  next[idx] = message
  return next
}

export const EMPTY_ARRAY: any[] = []

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  canManage: false,
  messagesByChat: {},
  threadMessagesByRoot: {},
  pinnedMessageIds: {},
  typingByChat: {},
  replyTarget: null,
  quoteTarget: null,
  threadRootId: null,
  threadReplyCounts: {},

  setChats: (chats) => set({ chats }),

  setActiveChat: (chatId, canManage = false) =>
    set({ activeChatId: chatId, canManage, replyTarget: null, quoteTarget: null }),

  setMessages: (chatId, messages) =>
    set((s) => ({ messagesByChat: { ...s.messagesByChat, [chatId]: messages } })),

  setThreadMessages: (rootId, messages) =>
    set((s) => ({
      threadMessagesByRoot: { ...s.threadMessagesByRoot, [rootId]: messages },
      threadReplyCounts: { ...s.threadReplyCounts, [rootId]: messages.length },
    })),

  prependMessages: (chatId, messages) =>
    set((s) => ({
      messagesByChat: {
        ...s.messagesByChat,
        [chatId]: [...messages, ...(s.messagesByChat[chatId] ?? [])],
      },
    })),

  addMessage: (chatId, message) =>
    set((s) => {
      const msg = message as ChatMessage
      if (isThreadMessage(msg)) {
        const rootId = threadRootId(msg)
        if (rootId == null) return s
        const prev = s.threadMessagesByRoot[rootId] ?? []
        const next = upsertMessage(prev, message)
        const isNew = !prev.some((m) => Number(m.id) === Number(message.id))
        return {
          threadMessagesByRoot: { ...s.threadMessagesByRoot, [rootId]: next },
          threadReplyCounts: isNew
            ? { ...s.threadReplyCounts, [rootId]: (s.threadReplyCounts[rootId] ?? prev.length) + 1 }
            : s.threadReplyCounts,
        }
      }

      if (isFlatReply(msg)) {
        for (const [rootIdStr, list] of Object.entries(s.threadMessagesByRoot)) {
          const rootId = Number(rootIdStr)
          const ids = new Set(list.map((m) => Number(m.id)))
          if (!belongsToThread(msg, ids, rootId)) continue
          const next = upsertMessage(list, message)
          const isNew = !list.some((m) => Number(m.id) === Number(message.id))
          return {
            threadMessagesByRoot: { ...s.threadMessagesByRoot, [rootId]: next },
            threadReplyCounts: isNew
              ? { ...s.threadReplyCounts, [rootId]: (s.threadReplyCounts[rootId] ?? list.length) + 1 }
              : s.threadReplyCounts,
          }
        }
      }

      return {
        messagesByChat: {
          ...s.messagesByChat,
          [chatId]: upsertMessage(s.messagesByChat[chatId] ?? [], message),
        },
      }
    }),

  addThreadMessage: (rootId, message) =>
    set((s) => {
      const prev = s.threadMessagesByRoot[rootId] ?? []
      const next = upsertMessage(prev, message)
      const isNew = !prev.some((m) => Number(m.id) === Number(message.id))
      return {
        threadMessagesByRoot: { ...s.threadMessagesByRoot, [rootId]: next },
        threadReplyCounts: isNew
          ? { ...s.threadReplyCounts, [rootId]: (s.threadReplyCounts[rootId] ?? prev.length) + 1 }
          : s.threadReplyCounts,
      }
    }),

  updateMessage: (chatId, message) =>
    set((s) => {
      const messageId = Number(message.id)
      const main = s.messagesByChat[chatId] ?? []
      if (main.some((m) => Number(m.id) === messageId)) {
        return {
          messagesByChat: {
            ...s.messagesByChat,
            [chatId]: upsertMessage(main, message),
          },
        }
      }

      const nextThread = { ...s.threadMessagesByRoot }
      for (const [rootId, list] of Object.entries(nextThread)) {
        if (list.some((m) => Number(m.id) === messageId)) {
          nextThread[Number(rootId)] = upsertMessage(list, message)
          return { threadMessagesByRoot: nextThread }
        }
      }
      return s
    }),

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
  setThreadReplyCount: (rootId, count) =>
    set((s) => ({ threadReplyCounts: { ...s.threadReplyCounts, [rootId]: count } })),

  applyReaction: (chatId, messageId, userId, emoji, added) =>
    set((s) => {
      const main = s.messagesByChat[chatId] ?? []
      if (main.some((m) => Number(m.id) === messageId)) {
        return {
          messagesByChat: {
            ...s.messagesByChat,
            [chatId]: applyReactionToList(main, messageId, userId, emoji, added),
          },
        }
      }

      const nextThread = { ...s.threadMessagesByRoot }
      for (const [rootId, list] of Object.entries(nextThread)) {
        if (list.some((m) => Number(m.id) === messageId)) {
          nextThread[Number(rootId)] = applyReactionToList(list, messageId, userId, emoji, added)
          return { threadMessagesByRoot: nextThread }
        }
      }
      return s
    }),
}))
