import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as Y from 'yjs'
import type { Provider } from '@lexical/yjs'
import { SignalRProvider } from './SignalRProvider'
import { useAuth } from '../context/AuthContext'

export interface CollabUser {
  name: string
  color: string
}

interface DocumentContextValue {
  providerFactory: (id: string, yjsDocMap: Map<string, Y.Doc>) => Provider
  isConnected: boolean
  isSynced: boolean
  users: CollabUser[]
  username: string
  cursorColor: string
}

const DocumentContext = createContext<DocumentContextValue | null>(null)

export function useDocument() {
  const context = useContext(DocumentContext)
  if (!context) {
    throw new Error('useDocument must be used within a DocumentProvider')
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

interface DocumentProviderProps {
  documentId: number
  children: ReactNode
}

export function DocumentProvider({ documentId, children }: DocumentProviderProps) {
  const { user } = useAuth()
  const username = user?.email ?? 'Гость'
  const cursorColor = useMemo(() => colorFromString(username), [username])

  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [users, setUsers] = useState<CollabUser[]>([])
  const providerRef = useRef<SignalRProvider | null>(null)

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Y.Doc>) => {
      let doc = yjsDocMap.get(id)
      if (!doc) {
        doc = new Y.Doc()
        yjsDocMap.set(id, doc)
      }

      const provider = new SignalRProvider(documentId, doc)
      providerRef.current = provider

      provider.on('status', (event) => {
        const status = (event as { status: string }).status
        setIsConnected(status === 'connected')
      })

      provider.on('sync', (synced) => {
        setIsSynced(synced === true)
      })

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
      provider.awareness.on('change', updateUsers)

      // y-protocols Awareness шире, чем UserState из @lexical/yjs, — приводим тип явно.
      return provider as unknown as Provider
    },
    [documentId],
  )

  const value = useMemo(
    () => ({ providerFactory, isConnected, isSynced, users, username, cursorColor }),
    [providerFactory, isConnected, isSynced, users, username, cursorColor],
  )

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>
}
