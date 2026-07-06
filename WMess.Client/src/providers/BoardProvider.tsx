import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as Y from 'yjs'
import { SignalRProvider } from './SignalRProvider'
import { useAuth } from '../context/AuthContext'

export interface CollabUser {
  name: string
  color: string
}

interface BoardContextValue {
  doc: Y.Doc
  awareness: SignalRProvider['awareness']
  connect: () => void
  disconnect: () => void
  isConnected: boolean
  isSynced: boolean
  users: CollabUser[]
  username: string
  cursorColor: string
}

const BoardContext = createContext<BoardContextValue | null>(null)

export function useBoard() {
  const context = useContext(BoardContext)
  if (!context) {
    throw new Error('useBoard must be used within a BoardProvider')
  }
  return context
}

// Стабильный цвет курсора по строке (email) — одинаковый цвет в каждой сессии.
function colorFromString(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 50%)`
}

interface BoardProviderProps {
  boardId: number
  children: ReactNode
}

export function BoardProvider({ boardId, children }: BoardProviderProps) {
  const { user } = useAuth()
  const username = user?.email ?? 'Гость'
  const cursorColor = useMemo(() => colorFromString(username), [username])

  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [users, setUsers] = useState<CollabUser[]>([])

  // Провайдер создаётся сразу: конструктор строит соединение, но НЕ стартует его до connect().
  // Так doc и awareness доступны из контекста ещё до подключения — это нужно BoardEditor,
  // который навешивает binding Excalidraw ↔ Yjs на маунте.
  const provider = useMemo(
    () => new SignalRProvider(boardId, new Y.Doc(), '/hubs/board', 'boards'),
    [boardId],
  )

  useEffect(() => {
    const onStatus = (event: unknown) => {
      const status = (event as { status: string }).status
      setIsConnected(status === 'connected')
    }
    const onSync = (synced: unknown) => {
      setIsSynced(synced === true)
    }
    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values()) as Array<{
        name?: string
        color?: string
      }>
      setUsers(
        states
          .filter((s) => typeof s.name === 'string')
          .map((s) => ({ name: s.name as string, color: s.color ?? '#888' })),
      )
    }

    provider.on('status', onStatus)
    provider.on('sync', onSync)
    provider.awareness.on('change', updateUsers)

    return () => {
      provider.off('status', onStatus)
      provider.off('sync', onSync)
      provider.awareness.off('change', updateUsers)
    }
  }, [provider])

  const connect = useCallback(() => provider.connect(), [provider])
  const disconnect = useCallback(() => provider.disconnect(), [provider])

  const value = useMemo(
    () => ({
      doc: provider.doc,
      awareness: provider.awareness,
      connect,
      disconnect,
      isConnected,
      isSynced,
      users,
      username,
      cursorColor,
    }),
    [provider, connect, disconnect, isConnected, isSynced, users, username, cursorColor],
  )

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}
