import { useEffect, useState } from 'react'
import { apiClient } from '../api'
import { FormModal, ConfirmDialog } from './WorkspaceModals'
import { DocsIcon, FolderIcon, PencilIcon, PlusIcon, TrashIcon } from '../workspace/icons'

interface Folder {
  id: number
  parentFolderId: number | null
  name: string
}

interface Doc {
  id: number
  folderId: number | null
  title: string
}

type DeleteTarget = { kind: 'folder'; id: number; name: string } | { kind: 'doc'; id: number; name: string }
type DragItem = { kind: 'folder'; id: number; name: string } | { kind: 'doc'; id: number; name: string }

interface DocumentsSidebarProps {
  projectId: number
  selectedId: number | null
  onSelect: (id: number, title: string) => void
  onDeleted: (id: number) => void
}

export function DocumentsSidebar({ projectId, selectedId, onSelect, onDeleted }: DocumentsSidebarProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [documents, setDocuments] = useState<Doc[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  const [createKind, setCreateKind] = useState<'folder' | 'doc' | null>(null)
  const [createInFolder, setCreateInFolder] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [renameFolder, setRenameFolder] = useState<{ id: number; name: string } | null>(null)
  const [renameDoc, setRenameDoc] = useState<{ id: number; title: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragItem, setDragItem] = useState<DragItem | null>(null)
  const [dropTarget, setDropTarget] = useState<{ kind: 'folder' | 'root'; id: number | null } | null>(null)

  const loadData = async () => {
    try {
      const [foldersRes, docsRes] = await Promise.all([
        apiClient.documents.getProjectFolders(projectId),
        apiClient.documents.getProjectDocuments(projectId),
      ])
      setFolders(
        (foldersRes.data ?? []).map((f) => ({
          id: Number(f.id),
          parentFolderId: f.parentFolderId == null ? null : Number(f.parentFolderId),
          name: f.name ?? '',
        })),
      )
      setDocuments(
        (docsRes.data ?? []).map((d) => ({
          id: Number(d.id),
          folderId: d.folderId == null ? null : Number(d.folderId),
          title: d.title ?? 'Без названия',
        })),
      )
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const createFolder = async (name: string) => {
    setBusy(true)
    try {
      await apiClient.documents.createFolder({ projectId, parentFolderId: null, name })
      setCreateKind(null)
      await loadData()
    } catch (error) {
      console.error('Failed to create folder:', error)
    } finally {
      setBusy(false)
    }
  }

  const updateFolderName = async (name: string) => {
    if (!renameFolder) return
    setBusy(true)
    try {
      await apiClient.documents.updateFolder(renameFolder.id, { name })
      setRenameFolder(null)
      await loadData()
    } catch (error) {
      console.error('Failed to rename folder:', error)
    } finally {
      setBusy(false)
    }
  }

  const updateDocTitle = async (title: string) => {
    if (!renameDoc) return
    setBusy(true)
    try {
      await apiClient.documents.updateDocument(renameDoc.id, { title })
      const renamedId = renameDoc.id
      setRenameDoc(null)
      await loadData()
      // Обновляем заголовок в шапке только если переименован уже открытый документ,
      // иначе rename не должен переключать редактор на другой документ.
      if (selectedId === renamedId) {
        onSelect(renamedId, title)
      }
    } catch (error) {
      console.error('Failed to rename document:', error)
    } finally {
      setBusy(false)
    }
  }

  const createDocument = async (title: string) => {
    setBusy(true)
    const folderId = createInFolder
    try {
      const res = await apiClient.documents.createDocument({ projectId, folderId, title })
      setCreateKind(null)
      setCreateInFolder(null)
      await loadData()
      if (folderId !== null) {
        setExpanded((prev) => new Set(prev).add(folderId))
      }
      if (res.data?.id != null) {
        onSelect(Number(res.data.id), res.data.title ?? title)
      }
    } catch (error) {
      console.error('Failed to create document:', error)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      if (deleteTarget.kind === 'folder') {
        await apiClient.documents.deleteFolder(deleteTarget.id)
      } else {
        await apiClient.documents.deleteDocument(deleteTarget.id)
        onDeleted(deleteTarget.id)
      }
      setDeleteTarget(null)
      await loadData()
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setBusy(false)
    }
  }

  const toggleFolder = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const moveFolder = async (folderId: number, targetFolderId: number | null) => {
    try {
      await apiClient.documents.moveFolder(folderId, { parentFolderId: targetFolderId })
      await loadData()
      if (targetFolderId !== null) {
        setExpanded((prev) => new Set(prev).add(targetFolderId))
      }
    } catch (error) {
      console.error('Failed to move folder:', error)
    }
  }

  const moveDocument = async (docId: number, targetFolderId: number | null) => {
    try {
      await apiClient.documents.moveDocument(docId, { folderId: targetFolderId })
      await loadData()
      if (targetFolderId !== null) {
        setExpanded((prev) => new Set(prev).add(targetFolderId))
      }
    } catch (error) {
      console.error('Failed to move document:', error)
    }
  }

  const subFolders = (parentId: number | null) => folders.filter((f) => f.parentFolderId === parentId)
  const folderDocs = (folderId: number | null) => documents.filter((d) => d.folderId === folderId)

  // true, если folderId находится внутри (является потомком) ancestorId.
  const isDescendantOf = (folderId: number, ancestorId: number): boolean => {
    let currentId: number | null = folders.find((f) => f.id === folderId)?.parentFolderId ?? null
    while (currentId !== null) {
      if (currentId === ancestorId) return true
      currentId = folders.find((f) => f.id === currentId)?.parentFolderId ?? null
    }
    return false
  }

  // Можно ли бросить перетаскиваемый элемент в папку target.
  const canDropInto = (target: Folder): boolean => {
    if (!dragItem) return false
    if (dragItem.kind === 'folder') {
      return dragItem.id !== target.id && !isDescendantOf(target.id, dragItem.id)
    }
    return true
  }

  const rowBase =
    'group flex items-center justify-between gap-1 pr-2 py-1.5 rounded-md cursor-pointer hover:bg-hovered'

  const renderDoc = (doc: Doc, level: number) => {
    const isSelected = doc.id === selectedId
    return (
      <div
        key={`doc-${doc.id}`}
        className={`${rowBase} ${isSelected ? 'bg-accent-soft' : ''}`}
        style={{ paddingLeft: `${level * 14 + 10}px` }}
        onClick={() => onSelect(doc.id, doc.title)}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          setDragItem({ kind: 'doc', id: doc.id, name: doc.title })
        }}
        onDragEnd={() => {
          setDragItem(null)
          setDropTarget(null)
        }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <DocsIcon size={15} className={isSelected ? 'text-accent' : 'text-faint'} />
          <span className={`text-[13px] truncate ${isSelected ? 'text-accent font-medium' : 'text-ink-soft'}`}>
            {doc.title}
          </span>
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 text-faint hover:text-accent p-0.5 cursor-pointer"
            title="Переименовать документ"
            onClick={(e) => {
              e.stopPropagation()
              setRenameDoc({ id: doc.id, title: doc.title })
            }}
          >
            <PencilIcon size={14} />
          </button>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 text-faint hover:text-danger p-0.5 cursor-pointer"
            title="Удалить документ"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteTarget({ kind: 'doc', id: doc.id, name: doc.title })
            }}
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
    )
  }

  const renderFolder = (folder: Folder, level: number) => {
    const isOpen = expanded.has(folder.id)
    const isDragOver = dropTarget?.kind === 'folder' && dropTarget.id === folder.id
    const isDragging = dragItem?.kind === 'folder' && dragItem.id === folder.id
    return (
      <div key={`folder-${folder.id}`}>
        <div
          className={`${rowBase} ${isDragOver ? 'bg-hovered' : ''} ${isDragging ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${level * 14 + 10}px` }}
          onClick={() => toggleFolder(folder.id)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            setDragItem({ kind: 'folder', id: folder.id, name: folder.name })
          }}
          onDragEnd={() => {
            setDragItem(null)
            setDropTarget(null)
          }}
          onDragOver={(e) => {
            if (!dragItem) return
            // Всегда останавливаем всплытие, чтобы корневая зона не «перехватывала» дроп над папкой.
            e.stopPropagation()
            if (!canDropInto(folder)) {
              // Недопустимая цель: запрещаем drop (курсор «нельзя»), не подсвечиваем.
              e.dataTransfer.dropEffect = 'none'
              if (dropTarget) setDropTarget(null)
              return
            }
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDropTarget({ kind: 'folder', id: folder.id })
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => {
            // onDrop сработает только если onDragOver вызвал preventDefault (т.е. цель допустима).
            e.preventDefault()
            e.stopPropagation()
            if (dragItem && canDropInto(folder)) {
              if (dragItem.kind === 'folder') {
                moveFolder(dragItem.id, folder.id)
              } else {
                moveDocument(dragItem.id, folder.id)
              }
            }
            setDragItem(null)
            setDropTarget(null)
          }}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className={`text-faintest text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
            <FolderIcon size={15} className="text-faint" />
            <span className="text-[13px] text-ink-soft truncate">{folder.name}</span>
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-faint hover:text-accent p-0.5 cursor-pointer"
              title="Создать документ в папке"
              onClick={(e) => {
                e.stopPropagation()
                setCreateInFolder(folder.id)
                setCreateKind('doc')
              }}
            >
              <PlusIcon size={14} />
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-faint hover:text-accent p-0.5 cursor-pointer"
              title="Переименовать папку"
              onClick={(e) => {
                e.stopPropagation()
                setRenameFolder({ id: folder.id, name: folder.name })
              }}
            >
              <PencilIcon size={14} />
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-faint hover:text-danger p-0.5 cursor-pointer"
              title="Удалить папку"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget({ kind: 'folder', id: folder.id, name: folder.name })
              }}
            >
              <TrashIcon size={14} />
            </button>
          </div>
        </div>
        {isOpen && (
          <div>
            {subFolders(folder.id).map((f) => renderFolder(f, level + 1))}
            {folderDocs(folder.id).map((d) => renderDoc(d, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const iconBtn =
    'h-7 w-7 rounded-md border border-line bg-white flex items-center justify-center text-muted cursor-pointer hover:bg-sidebar'

  return (
    <div className="w-64 shrink-0 border-r border-line bg-sidebar flex flex-col h-full min-h-0">
      <div className="h-[46px] shrink-0 flex items-center justify-between px-3 border-b border-line">
        <span className="font-mono text-[10.5px] tracking-[.06em] uppercase text-faintest">Документы</span>
        <div className="flex gap-1.5">
          <button type="button" className={iconBtn} title="Новая папка" onClick={() => setCreateKind('folder')}>
            <FolderIcon size={14} />
          </button>
          <button type="button" className={iconBtn} title="Новый документ" onClick={() => setCreateKind('doc')}>
            <PlusIcon size={15} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto wm-scroll p-2"
        onDragOver={(e) => {
          e.preventDefault()
          if (dragItem) {
            setDropTarget({ kind: 'root', id: null })
          }
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => {
          e.preventDefault()
          if (dragItem) {
            if (dragItem.kind === 'folder') {
              moveFolder(dragItem.id, null)
            } else {
              moveDocument(dragItem.id, null)
            }
          }
          setDragItem(null)
          setDropTarget(null)
        }}
      >
        {loading ? (
          <div className="text-[13px] text-faint px-2 py-3">Загрузка…</div>
        ) : folders.length === 0 && documents.length === 0 ? (
          <div className="text-[13px] text-faint px-2 py-3 leading-relaxed">
            Пока нет документов. Создайте первый.
          </div>
        ) : (
          <div className={`${dropTarget?.kind === 'root' ? 'bg-hovered rounded-md' : ''}`}>
            {subFolders(null).map((f) => renderFolder(f, 0))}
            {folderDocs(null).map((d) => renderDoc(d, 0))}
          </div>
        )}
      </div>

      {createKind === 'folder' && (
        <FormModal
          title="Новая папка"
          label="Название папки"
          submitLabel="Создать"
          busy={busy}
          onSubmit={createFolder}
          onClose={() => setCreateKind(null)}
        />
      )}
      {createKind === 'doc' && (
        <FormModal
          title="Новый документ"
          label="Название документа"
          submitLabel="Создать"
          busy={busy}
          onSubmit={createDocument}
          onClose={() => {
            setCreateKind(null)
            setCreateInFolder(null)
          }}
        />
      )}
      {renameFolder && (
        <FormModal
          title="Переименовать папку"
          label="Название папки"
          submitLabel="Сохранить"
          busy={busy}
          initialValue={renameFolder.name}
          onSubmit={updateFolderName}
          onClose={() => setRenameFolder(null)}
        />
      )}
      {renameDoc && (
        <FormModal
          title="Переименовать документ"
          label="Название документа"
          submitLabel="Сохранить"
          busy={busy}
          initialValue={renameDoc.title}
          onSubmit={updateDocTitle}
          onClose={() => setRenameDoc(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.kind === 'folder' ? 'Удалить папку?' : 'Удалить документ?'}
          message={
            deleteTarget.kind === 'folder' ? (
              <>Папка «{deleteTarget.name}» будет удалена. Вложенные документы останутся без папки.</>
            ) : (
              <>Документ «{deleteTarget.name}» будет удалён без возможности восстановления.</>
            )
          }
          confirmLabel="Удалить"
          busy={busy}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
