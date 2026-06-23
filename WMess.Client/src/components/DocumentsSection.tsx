import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { DocumentProvider, useDocument } from '../providers/DocumentProvider'
import { DocumentEditor } from './DocumentEditor'
import { DocumentsSidebar } from './DocumentsSidebar'
import { DocumentExplorer } from './DocumentExplorer'
import { PermissionsPanel } from './PermissionsPanel'
import { apiClient } from '../api'
import { ArrowLeftIcon, PencilIcon } from '../workspace/icons'

interface SelectedDoc {
  id: number
  title: string
  // Папка документа — чтобы при «назад» вернуться к ней в файловом менеджере.
  folderId?: number | null
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

function DocumentWorkspace({
  doc,
  onBack,
  onTitleUpdate,
}: {
  doc: SelectedDoc
  onBack: () => void
  onTitleUpdate: (title: string) => void
}) {
  const [showPermissions, setShowPermissions] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(doc.title)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleTitleClick = () => {
    setEditingTitle(true)
    setTitleValue(doc.title)
  }

  useEffect(() => {
    if (editingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTitle])

  const handleTitleSave = async () => {
    const newTitle = titleValue.trim()
    if (!newTitle || newTitle === doc.title) {
      setEditingTitle(false)
      return
    }

    setSaving(true)
    try {
      await apiClient.documents.updateDocument(doc.id, { title: newTitle })
      setEditingTitle(false)
      onTitleUpdate(newTitle)
    } catch (error) {
      console.error('Failed to update title:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setEditingTitle(false)
      setTitleValue(doc.title)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-[46px] shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <button
          type="button"
          onClick={onBack}
          title="К списку документов"
          className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-hovered cursor-pointer"
        >
          <ArrowLeftIcon size={18} />
        </button>

        {editingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            disabled={saving}
            autoFocus
            className="flex-1 min-w-0 h-8 px-2 text-[14px] font-semibold text-ink bg-white border border-accent rounded outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={handleTitleClick}
            className="group flex items-center gap-1.5 min-w-0 px-2 py-1 rounded-md text-[14px] font-semibold text-ink hover:bg-hovered transition-colors cursor-text"
            title="Нажмите, чтобы переименовать"
          >
            <span className="truncate">{doc.title}</span>
            <PencilIcon size={13} className="shrink-0 text-faint group-hover:text-accent transition-colors" />
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
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
  // Документ — в пути (/docs/:docId), папка файлового менеджера — в ?folder.
  const { teamId, docId: docIdParam } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const docId = docIdParam ? Number(docIdParam) : null
  const folderParam = params.get('folder')
  const folderId = folderParam ? Number(folderParam) : null

  const docsBase = `/teams/${teamId}/projects/${projectId}/docs`

  const [openDoc, setOpenDoc] = useState<SelectedDoc | null>(null)
  const [docsRefresh, setDocsRefresh] = useState(0)

  // Резолвим документ при прямой загрузке/обновлении (id в пути; заголовок и папка ещё не известны).
  useEffect(() => {
    if (docId == null) {
      setOpenDoc(null)
      return
    }
    if (openDoc?.id === docId && openDoc.folderId !== undefined) return
    let cancelled = false
    apiClient.documents
      .getDocument(docId)
      .then((res) => {
        if (!cancelled && res.data) {
          setOpenDoc({
            id: docId,
            title: res.data.title ?? 'Без названия',
            folderId: res.data.folderId == null ? null : Number(res.data.folderId),
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  const folderPath = (id: number | null) => (id == null ? docsBase : `${docsBase}?folder=${id}`)

  const openDocument = (id: number, title: string) => {
    setOpenDoc({ id, title })
    navigate(`${docsBase}/${id}`)
  }

  const navigateFolder = (id: number | null) => navigate(folderPath(id))

  const backToFiles = () => navigate(folderPath(openDoc?.folderId ?? null))

  if (docId != null) {
    const doc = openDoc ?? { id: docId, title: 'Документ' }
    return (
      <div className="flex h-full min-h-0">
        <div className="flex-1 min-w-0 bg-panel">
          <DocumentProvider key={doc.id} documentId={doc.id}>
            <DocumentWorkspace
              doc={doc}
              onBack={backToFiles}
              onTitleUpdate={(title) => {
                setOpenDoc((prev) => (prev ? { ...prev, title } : { id: doc.id, title }))
                setDocsRefresh((n) => n + 1)
              }}
            />
          </DocumentProvider>
        </div>

        <DocumentsSidebar
          projectId={projectId}
          selectedId={doc.id}
          onSelect={(id, title) => openDocument(id, title)}
          onDeleted={(id) => {
            if (id === doc.id) backToFiles()
          }}
          onTitleUpdated={(id, title) => {
            if (id === doc.id) setOpenDoc((prev) => (prev ? { ...prev, title } : { id, title }))
          }}
          refreshSignal={docsRefresh}
        />
      </div>
    )
  }

  return (
    <DocumentExplorer
      projectId={projectId}
      folderId={folderId}
      onNavigateFolder={navigateFolder}
      onOpenDocument={openDocument}
    />
  )
}
