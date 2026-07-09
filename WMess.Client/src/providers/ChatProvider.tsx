import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChatSignalRConnection } from './ChatSignalRProvider'
import { useChatStore } from '../store/chatStore'

interface ChatContextValue {
  isConnected: boolean
  sendTyping: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatConnection() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatConnection must be used within ChatProvider')
  return ctx
}

interface ChatProviderProps {
  chatId: number
  children: ReactNode
}

export function ChatProvider({ chatId, children }: ChatProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const connRef = useRef<ChatSignalRConnection | null>(null)

  useEffect(() => {
    const conn = new ChatSignalRConnection({
      onMessage: (msg) => {
        if (msg.chatId != null) useChatStore.getState().addMessage(Number(msg.chatId), msg)
      },
      onMessageUpdated: (msg) => {
        if (msg.chatId != null) useChatStore.getState().updateMessage(Number(msg.chatId), msg)
      },
      onMessageDeleted: (cId, messageId) => useChatStore.getState().removeMessage(cId, messageId),
      onReaction: (cId, messageId, userId, emoji, added) =>
        useChatStore.getState().applyReaction(cId, messageId, userId, emoji, added),
      onPinned: (cId, messageId) => useChatStore.getState().addPinned(cId, messageId),
      onUnpinned: (cId, messageId) => useChatStore.getState().removePinned(cId, messageId),
      onTyping: (cId, userId) => {
        useChatStore.getState().setTyping(cId, userId, true)
        setTimeout(() => useChatStore.getState().setTyping(cId, userId, false), 3000)
      },
      onStatus: setIsConnected,
    })
    connRef.current = conn
    conn.connect(chatId)
    return () => {
      conn.disconnect()
      connRef.current = null
    }
  }, [chatId])


  const sendTyping = useCallback(() => {
    void connRef.current?.sendTyping()
  }, [])

  const value = useMemo(() => ({ isConnected, sendTyping }), [isConnected, sendTyping])

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
