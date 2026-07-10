import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { apiClient } from '../../api'
import { useChatStore } from '../../store/chatStore'
import { FormModal } from '../../components/WorkspaceModals'
import { ChatList } from './ChatList'
import { ChatRoom } from './ChatRoom'

interface Props {
  projectId: number
  teamId: number
}

export function ChatsSection({ projectId, teamId }: Props) {
  const { chatId: chatIdParam } = useParams()
  const navigate = useNavigate()
  const chatId = chatIdParam ? Number(chatIdParam) : null

  const chats = useChatStore((s) => s.chats)
  const setChats = useChatStore((s) => s.setChats)

  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadChats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.chats.getProjectChats(projectId)
      setChats(res.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [projectId, setChats])

  useEffect(() => {
    void loadChats()
  }, [loadChats])

  useEffect(() => {
    if (chatId == null) {
      useChatStore.getState().setActiveChat(null)
      return
    }
    void apiClient.chats.getChat(chatId).then((res) => {
      useChatStore.getState().setActiveChat(chatId, res.data?.canManage ?? false)
    })
  }, [chatId])

  const handleCreate = async (name: string) => {
    setBusy(true)
    try {
      const res = await apiClient.chats.createChat({ name, projectId })
      setShowCreate(false)
      await loadChats()
      navigate(`/teams/${teamId}/projects/${projectId}/chats/${Number(res.data?.id)}`)
    } finally {
      setBusy(false)
    }
  }

  if (loading && chats.length === 0) {
    return <div className="p-8 text-sm text-muted">Загрузка чатов…</div>
  }

  const activeChat = chats.find((c) => Number(c.id) === chatId)

  if (chatId != null) {
    return (
      <ChatRoom
        chatId={chatId}
        projectId={projectId}
        teamId={teamId}
        chatName={activeChat?.name}
      />
    )
  }

  return (
    <>
      <ChatList
        chats={chats}
        projectId={projectId}
        teamId={teamId}
        onCreate={() => setShowCreate(true)}
      />
      {showCreate && (
        <FormModal
          title="Новый чат"
          label="Название чата"
          submitLabel="Создать"
          busy={busy}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  )
}
