import { useNavigate } from 'react-router'
import type { ChatResponse } from '../../api/generated/data-contracts'
import { PlusIcon } from '../../workspace/icons'

interface Props {
  chats: ChatResponse[]
  projectId: number
  teamId: number
  onCreate: () => void
}

export function ChatList({ chats, projectId, teamId, onCreate }: Props) {
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 border-b border-line flex items-center justify-between px-4 shrink-0">
        <span className="font-semibold">Чаты проекта</span>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer hover:bg-accent-deep"
        >
          <PlusIcon size={14} strokeWidth={2} />
          Новый чат
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {chats.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Нет чатов. Создайте первый.</div>
        ) : (
          chats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                navigate(`/teams/${teamId}/projects/${projectId}/chats/${Number(c.id)}`)
              }
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-hovered cursor-pointer mb-1"
            >
              <div className="font-semibold text-sm text-ink truncate">{c.name ?? `Чат #${c.id}`}</div>
              <div className="text-xs text-faint mt-0.5 truncate">
                {c.lastMessagePreview ? (
                  <>
                    {c.lastMessageAuthor && (
                      <span className="text-muted font-medium">{c.lastMessageAuthor}: </span>
                    )}
                    {c.lastMessagePreview}
                  </>
                ) : (
                  'Нет сообщений'
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
