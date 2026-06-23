import { useState } from 'react'
import { DocumentProvider, useDocument } from '../providers/DocumentProvider'
import { DocumentEditor } from './DocumentEditor'
import { DocumentsSidebar } from './DocumentsSidebar'
import { PermissionsPanel } from './PermissionsPanel'
import { DocsIcon } from '../workspace/icons'

interface SelectedDoc {
  id: number
  title: string
}

function ConnectedUsers() {
  const { users } = useDocument()
  if (users.length === 0) return null

  // Уникальные участники по имени (у одного пользователя может быть несколько вкладок).
  const unique = Array.from(new Map(users.map((u) => [u.name, u])).values())

  return (
    <div className="flex items-center -space-x-2">
      {unique.slice(0, 6).map((u, idx) => (
        <div
          key={idx}
          title={u.name}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold border-2 border-panel"
          style={{ backgroundColor: u.color }}
        >
          {u.name.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  )
}

function StatusBadge() {
  const { isConnected, isSynced } = useDocument()

  if (!isConnected) {
    return <span className="px-2 py-1 rounded-md bg-tile text-muted text-[11.5px] font-medium">Подключение…</span>
  }
  if (!isSynced) {
    return <span className="px-2 py-1 rounded-md bg-accent-soft text-accent text-[11.5px] font-medium">Синхронизация…</span>
  }
  return <span className="px-2 py-1 rounded-md bg-accent-soft text-accent text-[11.5px] font-medium">● Онлайн</span>
}

function DocumentWorkspace({ doc }: { doc: SelectedDoc }) {
  const [showPermissions, setShowPermissions] = useState(false)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-[46px] shrink-0 flex items-center justify-between gap-3 px-4 border-b border-line">
        <div className="text-[14px] font-semibold text-ink truncate">{doc.title}</div>
        <div className="flex items-center gap-3">
          <ConnectedUsers />
          <StatusBadge />
          <button
            type="button"
            onClick={() => setShowPermissions(true)}
            className="h-8 px-3 rounded-md border border-line bg-white text-muted text-[13px] font-medium hover:bg-sidebar cursor-pointer"
          >
            Доступ
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <DocumentEditor documentId={doc.id} />
      </div>

      {showPermissions && (
        <PermissionsPanel documentId={doc.id} onClose={() => setShowPermissions(false)} />
      )}
    </div>
  )
}

export function DocumentsSection({ projectId }: { projectId: number }) {
  const [selected, setSelected] = useState<SelectedDoc | null>(null)

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 bg-panel">
        {selected ? (
          <DocumentProvider key={selected.id} documentId={selected.id}>
            <DocumentWorkspace doc={selected} />
          </DocumentProvider>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-[52px] h-[52px] rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
              <DocsIcon size={24} strokeWidth={1.6} />
            </div>
            <div className="text-sm text-muted max-w-[340px] leading-[1.55]">
              Выберите документ справа или создайте новый, чтобы начать совместное редактирование.
            </div>
          </div>
        )}
      </div>

      <DocumentsSidebar
        projectId={projectId}
        selectedId={selected?.id ?? null}
        onSelect={(id, title) => setSelected({ id, title })}
        onDeleted={(id) => setSelected((prev) => (prev?.id === id ? null : prev))}
      />
    </div>
  )
}
