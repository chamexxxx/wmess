import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { DocumentProvider, useDocument } from '../providers/DocumentProvider'
import { BoardProvider, useBoard } from '../providers/BoardProvider'
import { TableProvider, useTable } from '../providers/TableProvider'
import { DocumentEditor } from './DocumentEditor'
import { BoardEditor } from './BoardEditor'
import { TableEditor } from './TableEditor'
import { LibrarySidebar } from './LibrarySidebar'
import { LibraryExplorer } from './LibraryExplorer'
import { useLibraryLive } from '../providers/useLibraryLive'
import { apiClient } from '../api'
import { toast } from '../store/toastStore'
import { describeError } from '../api/errorMessage'
import { ArrowLeftIcon, PencilIcon } from '../workspace/icons'

interface SelectedDoc {
  id: number
  title: string
  // Папка документа — чтобы при «назад» вернуться к ней в файловом менеджере.
  folderId?: number | null
  type?: string
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
      await apiClient.library.updateItem(doc.id, { title: newTitle })
      setEditingTitle(false)
      onTitleUpdate(newTitle)
    } catch (error) {
      console.error('Failed to update title:', error)
      toast.error(describeError(error, 'Не удалось переименовать'))
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
          title="К списку файлов"
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
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <DocumentEditor documentId={doc.id} />
      </div>
    </div>
  )
}

// BoardWorkspace — хедер + редактор доски (использует useBoard для статуса/участников).
// На уровне модуля (как DocumentWorkspace): вложенный компонент пересоздавался бы на каждый
// рендер LibrarySection и ремонтировал бы BoardEditor (обрыв SignalR) при любом ресайзе/refresh.
function BoardWorkspace({
  board,
  onBack,
  onTitleUpdate,
}: {
  board: SelectedDoc
  onBack: () => void
  onTitleUpdate: (title: string) => void
}) {
  const { users, isConnected, isSynced } = useBoard()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(board.title)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleTitleClick = () => {
    setEditingTitle(true)
    setTitleValue(board.title)
  }

  useEffect(() => {
    if (editingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTitle])

  const handleTitleSave = async () => {
    const newTitle = titleValue.trim()
    if (!newTitle || newTitle === board.title) {
      setEditingTitle(false)
      return
    }

    setSaving(true)
    try {
      await apiClient.library.updateItem(board.id, { title: newTitle })
      setEditingTitle(false)
      onTitleUpdate(newTitle)
    } catch (error) {
      console.error('Failed to update title:', error)
      toast.error(describeError(error, 'Не удалось переименовать'))
    } finally {
      setSaving(false)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setEditingTitle(false)
      setTitleValue(board.title)
    }
  }

  // Уникальные участники по имени (как ConnectedUsers для документа)
  const uniqueUsers = Array.from(new Map(users.map((u) => [u.name, u])).values())

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-[46px] shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <button
          type="button"
          onClick={onBack}
          title="К списку файлов"
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
            <span className="truncate">{board.title}</span>
            <PencilIcon size={13} className="shrink-0 text-faint group-hover:text-accent transition-colors" />
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* ConnectedUsers для доски */}
          {uniqueUsers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {uniqueUsers.slice(0, 6).map((u, idx) => (
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
          )}

          {/* StatusBadge для доски */}
          {!isConnected ? (
            <span className="px-2 py-1 rounded-md bg-tile text-muted text-[11.5px] font-medium">Подключение…</span>
          ) : !isSynced ? (
            <span className="px-2 py-1 rounded-md bg-accent-soft text-accent text-[11.5px] font-medium">Синхронизация…</span>
          ) : (
            <span className="px-2 py-1 rounded-md bg-accent-soft text-accent text-[11.5px] font-medium">● Онлайн</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <BoardEditor />
      </div>
    </div>
  )
}

// TableWorkspace — хедер + редактор таблицы (использует useTable для статуса/участников).
function TableWorkspace({
  table,
  onBack,
  onTitleUpdate,
}: {
  table: SelectedDoc
  onBack: () => void
  onTitleUpdate: (title: string) => void
}) {
  const { users, isConnected, isSynced } = useTable()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(table.title)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleTitleClick = () => {
    setEditingTitle(true)
    setTitleValue(table.title)
  }

  useEffect(() => {
    if (editingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTitle])

  const handleTitleSave = async () => {
    const newTitle = titleValue.trim()
    if (!newTitle || newTitle === table.title) {
      setEditingTitle(false)
      return
    }

    setSaving(true)
    try {
      await apiClient.library.updateItem(table.id, { title: newTitle })
      setEditingTitle(false)
      onTitleUpdate(newTitle)
    } catch (error) {
      console.error('Failed to update title:', error)
      toast.error(describeError(error, 'Не удалось переименовать'))
    } finally {
      setSaving(false)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setEditingTitle(false)
      setTitleValue(table.title)
    }
  }

  const uniqueUsers = Array.from(new Map(users.map((u) => [u.name, u])).values())

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-[46px] shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <button
          type="button"
          onClick={onBack}
          title="К списку файлов"
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
            <span className="truncate">{table.title}</span>
            <PencilIcon size={13} className="shrink-0 text-faint group-hover:text-accent transition-colors" />
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {uniqueUsers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {uniqueUsers.slice(0, 6).map((u, idx) => (
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
          )}

          {!isConnected ? (
            <span className="px-2 py-1 rounded-md bg-tile text-muted text-[11.5px] font-medium">Подключение…</span>
          ) : !isSynced ? (
            <span className="px-2 py-1 rounded-md bg-accent-soft text-accent text-[11.5px] font-medium">Синхронизация…</span>
          ) : (
            <span className="px-2 py-1 rounded-md bg-accent-soft text-accent text-[11.5px] font-medium">● Онлайн</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <TableEditor />
      </div>
    </div>
  )
}

export function LibrarySection({ projectId }: { projectId: number }) {
  // Документ — в пути (/library/:itemId), папка файлового менеджера — в ?folder.
  const { teamId, itemId: itemIdParam } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const itemId = itemIdParam ? Number(itemIdParam) : null
  const folderParam = params.get('folder')
  const folderId = folderParam ? Number(folderParam) : null

  const libraryBase = `/teams/${teamId}/projects/${projectId}/library`

  const [openDoc, setOpenDoc] = useState<SelectedDoc | null>(null)
  const [docsRefresh, setDocsRefresh] = useState(0)
  // Realtime-сигнал: увеличивается, когда кто-то (или мы сами) меняет структуру библиотеки проекта.
  const liveSignal = useLibraryLive(projectId)
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  // Резолвим документ при прямой загрузке/обновлении (id в пути; заголовок и папка ещё не известны).
  useEffect(() => {
    if (itemId == null) {
      setOpenDoc(null)
      return
    }
    if (openDoc?.id === itemId && openDoc.folderId !== undefined) return
    let cancelled = false
    apiClient.library
      .getItem(itemId)
      .then((res) => {
        if (!cancelled && res.data) {
          setOpenDoc({
            id: itemId,
            title: res.data.title ?? 'Без названия',
            folderId: res.data.folderId == null ? null : Number(res.data.folderId),
            type: res.data.type,
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  const folderPath = (id: number | null) => (id == null ? libraryBase : `${libraryBase}?folder=${id}`)

  // type (когда известен, например из проводника) выставляем сразу, чтобы не мигал
  // редактор документа до резолва типа через getItem.
  const openDocument = (id: number, title: string, type?: string) => {
    setOpenDoc({ id, title, type })
    navigate(`${libraryBase}/${id}`)
  }

  const navigateFolder = (id: number | null) => navigate(folderPath(id))

  const backToFiles = () => navigate(folderPath(openDoc?.folderId ?? null))

  // Обработка ресайза сайдбара
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      setSidebarWidth(Math.min(Math.max(newWidth, 200), 500))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    // На время драга гасим выделение текста и фиксируем курсор «ресайза».
    const prevUserSelect = document.body.style.userSelect
    const prevCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = prevUserSelect
      document.body.style.cursor = prevCursor
    }
  }, [isResizing])

  if (itemId != null) {
    const doc = openDoc ?? { id: itemId, title: 'Документ' }
    const isBoard = doc.type === 'board'
    const isTable = doc.type === 'table'

    return (
      <div className="flex h-full min-h-0">
        <div className="flex-1 min-w-0 bg-panel">
          {doc.type == null ? (
            // Тип ещё резолвится (прямая загрузка/выбор из сайдбара) — нейтральный лоадер,
            // а не редактор документа, иначе на миг мелькает чужой (документный) воркспейс.
            <div className="h-full flex items-center justify-center text-[13px] text-faint">Загрузка…</div>
          ) : isBoard ? (
            <BoardProvider key={doc.id} boardId={doc.id}>
              <BoardWorkspace
                board={doc}
                onBack={backToFiles}
                onTitleUpdate={(title) => {
                  setOpenDoc((prev) => (prev ? { ...prev, title } : { id: doc.id, title }))
                  setDocsRefresh((n) => n + 1)
                }}
              />
            </BoardProvider>
          ) : isTable ? (
            <TableProvider key={doc.id} tableId={doc.id}>
              <TableWorkspace
                table={doc}
                onBack={backToFiles}
                onTitleUpdate={(title) => {
                  setOpenDoc((prev) => (prev ? { ...prev, title } : { id: doc.id, title }))
                  setDocsRefresh((n) => n + 1)
                }}
              />
            </TableProvider>
          ) : doc.type === 'file' ? (
            // Загруженный файл не открывается в редакторе — предлагаем скачать (прямой переход по URL).
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="text-[14px] text-muted max-w-[340px] leading-[1.5]">
                «{doc.title}» — загруженный файл, его нельзя открыть в редакторе.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={backToFiles}
                  className="h-9 px-4 rounded-[9px] bg-tile text-ink text-[13px] font-semibold hover:bg-hovered cursor-pointer"
                >
                  К списку файлов
                </button>
                <button
                  type="button"
                  onClick={() => apiClient.downloadLibraryFile(doc.id, doc.title)}
                  className="h-9 px-4 rounded-[9px] bg-accent text-white text-[13px] font-semibold hover:bg-accent-deep cursor-pointer"
                >
                  Скачать
                </button>
              </div>
            </div>
          ) : (
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
          )}
        </div>
        {!sidebarHidden && (
          <LibrarySidebar
            width={sidebarWidth}
            onResizeStart={handleMouseDown}
            projectId={projectId}
            selectedId={doc.id}
            onSelect={(id, title) => openDocument(id, title)}
            onDeleted={(id) => {
              if (id === doc.id) backToFiles()
            }}
            onTitleUpdated={(id, title) => {
              if (id === doc.id) setOpenDoc((prev) => (prev ? { ...prev, title } : { id, title }))
            }}
            refreshSignal={docsRefresh + liveSignal}
            onToggleVisibility={() => setSidebarHidden(true)}
          />
        )}

        {sidebarHidden && (
          <button
            type="button"
            onClick={() => setSidebarHidden(false)}
            title="Показать библиотеку"
            className="w-10 h-10 shrink-0 flex items-center justify-center text-muted hover:bg-hovered hover:text-ink transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <LibraryExplorer
      projectId={projectId}
      folderId={folderId}
      onNavigateFolder={navigateFolder}
      onOpenDocument={openDocument}
      refreshSignal={liveSignal}
    />
  )
}
