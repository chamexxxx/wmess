import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as Y from 'yjs'
import { SignalRProvider } from './SignalRProvider'
import { useAuth } from '../context/AuthContext'

export interface CollabUser {
  name: string
  color: string
}

interface TableContextValue {
  doc: Y.Doc
  awareness: SignalRProvider['awareness']
  connect: () => void
  disconnect: () => void
  isConnected: boolean
  isSynced: boolean
  users: CollabUser[]
  // email пользователя; undefined, пока авторизация не загрузилась (в presence не транслируем).
  username: string | undefined
  cursorColor: string
}

const TableContext = createContext<TableContextValue | null>(null)

export function useTable() {
  const context = useContext(TableContext)
  if (!context) {
    throw new Error('useTable must be used within a TableProvider')
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

interface TableProviderProps {
  tableId: number
  children: ReactNode
}

export function TableProvider({ tableId, children }: TableProviderProps) {
  const { user } = useAuth()
  // Никаких плейсхолдеров: либо реальный email, либо undefined (авторизация ещё грузится).
  // Presence с этим именем транслируется только когда оно есть (см. TableEditor).
  const username = user?.email
  const cursorColor = useMemo(() => colorFromString(username ?? ''), [username])

  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [users, setUsers] = useState<CollabUser[]>([])

  // Провайдер создаётся сразу: конструктор строит соединение, но НЕ стартует его до connect().
  // Так doc и awareness доступны из контекста ещё до подключения — это нужно TableEditor,
  // который навешивает binding TanStack Table ↔ Yjs на маунте.
  const provider = useMemo(
    () => new SignalRProvider(tableId, new Y.Doc(), '/hubs/table'),
    [tableId],
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
      // TableEditor кладёт имя/цвет во вложенное поле `user` (конвенция коллабораторов),
      // поэтому читаем оттуда, а не с верхнего уровня awareness-состояния.
      const states = Array.from(provider.awareness.getStates().values()) as Array<{
        user?: { name?: string; color?: string }
      }>
      setUsers(
        states
          .map((s) => s.user)
          .filter((u): u is { name: string; color?: string } => typeof u?.name === 'string')
          .map((u) => ({ name: u.name, color: u.color ?? '#888' })),
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

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>
}
