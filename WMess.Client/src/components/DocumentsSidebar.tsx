import { useEffect, useRef, useState } from 'react'
import { apiClient } from '../api'
import { FormModal, ConfirmDialog } from './WorkspaceModals'
import { ContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { DocsIcon, FolderIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from '../workspace/icons'

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
  onTitleUpdated?: (id: number, title: string) => void
  // Меняется, когда заголовок документа правят вне сайдбара (в шапке редактора) —
  // сигнал тихо перезагрузить список.
  refreshSignal?: number
}

export function DocumentsSidebar({ projectId, selectedId, onSelect, onDeleted, onTitleUpdated, refreshSignal }: DocumentsSidebarProps) {
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
  const [searchQuery, setSearchQuery] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)

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

  // Тихий перезапрос при внешнем изменении заголовка (без спиннера, пропускаем первый рендер).
  const skipFirstRefresh = useRef(true)
  useEffect(() => {
    if (skipFirstRefresh.current) {
      skipFirstRefresh.current = false
      return
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal])

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
        onTitleUpdated?.(renamedId, title)
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

  // Из результатов поиска: сбрасываем запрос и раскрываем папку вместе с предками,
  // чтобы она стала видна в дереве.
  const revealFolder = (folderId: number) => {
    setSearchQuery('')
    setExpanded((prev) => {
      const next = new Set(prev)
      let id: number | null = folderId
      while (id !== null) {
        next.add(id)
        id = folders.find((f) => f.id === id)?.parentFolderId ?? null
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

  const filteredFolders = searchQuery
    ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : folders
  const filteredDocuments = searchQuery
    ? documents.filter((d) => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : documents

  const hasSearchResults = searchQuery && (filteredFolders.length > 0 || filteredDocuments.length > 0)

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
    'group flex items-center justify-between gap-1 px-2 py-1.5 rounded-md cursor-pointer hover:bg-hovered'

  // Контейнер вложенности: непрерывная вертикальная направляющая (border-left),
  // выровненная под шеврон родителя. Один бордер на уровень — одинаково на любой глубине.
  const childrenWrap = 'ml-[12px] pl-[8px] border-l-2 border-tile'

  // Контекстное меню (правая кнопка) — действия вместо иконок при наведении.
  const openFolderMenu = (e: React.MouseEvent, folder: Folder) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Создать документ',
          icon: <DocsIcon size={15} />,
          onClick: () => {
            setCreateInFolder(folder.id)
            setCreateKind('doc')
          },
        },
        {
          label: 'Переименовать',
          icon: <PencilIcon size={15} />,
          onClick: () => setRenameFolder({ id: folder.id, name: folder.name }),
        },
        {
          label: 'Удалить',
          icon: <TrashIcon size={15} />,
          danger: true,
          onClick: () => setDeleteTarget({ kind: 'folder', id: folder.id, name: folder.name }),
        },
      ],
    })
  }

  const openDocMenu = (e: React.MouseEvent, doc: Doc) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Переименовать',
          icon: <PencilIcon size={15} />,
          onClick: () => setRenameDoc({ id: doc.id, title: doc.title }),
        },
        {
          label: 'Удалить',
          icon: <TrashIcon size={15} />,
          danger: true,
          onClick: () => setDeleteTarget({ kind: 'doc', id: doc.id, name: doc.title }),
        },
      ],
    })
  }

  // Меню для пустой области дерева — создание в корне проекта.
  const openRootMenu = (e: React.MouseEvent) => {
    if (searchQuery) return
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Создать документ',
          icon: <DocsIcon size={15} />,
          onClick: () => {
            setCreateInFolder(null)
            setCreateKind('doc')
          },
        },
        {
          label: 'Создать папку',
          icon: <FolderIcon size={15} />,
          onClick: () => setCreateKind('folder'),
        },
      ],
    })
  }

  const renderDoc = (doc: Doc) => {
    const isSelected = doc.id === selectedId
    return (
      <div
        key={`doc-${doc.id}`}
        className={`${rowBase} ${isSelected ? 'bg-accent-soft' : ''}`}
        onClick={() => onSelect(doc.id, doc.title)}
        onContextMenu={(e) => openDocMenu(e, doc)}
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
          <span className="shrink-0 w-3" aria-hidden="true" />
          <DocsIcon size={15} className={isSelected ? 'text-accent' : 'text-doc'} />
          <span className={`text-[13px] truncate ${isSelected ? 'text-accent font-medium' : 'text-ink-soft'}`}>
            {doc.title}
          </span>
        </span>
      </div>
    )
  }

  const renderFolder = (folder: Folder) => {
    const isOpen = expanded.has(folder.id)
    const isDragOver = dropTarget?.kind === 'folder' && dropTarget.id === folder.id
    const isDragging = dragItem?.kind === 'folder' && dragItem.id === folder.id
    return (
      <div key={`folder-${folder.id}`}>
        <div
          className={`${rowBase} ${isDragOver ? 'bg-hovered' : ''} ${isDragging ? 'opacity-50' : ''}`}
          onClick={() => toggleFolder(folder.id)}
          onContextMenu={(e) => openFolderMenu(e, folder)}
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
            <span className={`shrink-0 w-3 text-center text-faintest text-[9px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
            <FolderIcon size={15} className="text-folder" />
            <span className="text-[13px] text-ink-soft truncate">{folder.name}</span>
          </span>
        </div>
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div className={childrenWrap}>
              {subFolders(folder.id).map((f) => renderFolder(f))}
              {folderDocs(folder.id).map((d) => renderDoc(d))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const iconBtn =
    'h-7 w-7 rounded-md border border-line bg-white flex items-center justify-center text-muted cursor-pointer hover:bg-sidebar'

  return (
    <div className="w-64 shrink-0 border-l border-line bg-sidebar flex flex-col h-full min-h-0">
      <div className="h-[46px] shrink-0 flex items-center justify-between px-3 border-b border-line">
        <span className="font-ui font-semibold text-[10.5px] tracking-[.06em] uppercase text-faintest">Документы</span>
        <div className="flex gap-1.5">
          <button type="button" className={iconBtn} title="Новая папка" onClick={() => setCreateKind('folder')}>
            <FolderIcon size={14} />
          </button>
          <button type="button" className={iconBtn} title="Новый документ" onClick={() => setCreateKind('doc')}>
            <PlusIcon size={15} />
          </button>
        </div>
      </div>

      <div className="shrink-0 px-2 py-2 border-b border-line">
        <div className="relative">
          <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-2 text-[13px] bg-panel border border-line rounded-md text-ink placeholder:text-faint focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto wm-scroll p-2"
        onContextMenu={openRootMenu}
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
        ) : searchQuery ? (
          hasSearchResults ? (
            <div className="space-y-0.5">
              {filteredFolders.map((f) => (
                <div
                  key={`search-folder-${f.id}`}
                  className={`${rowBase} pl-3`}
                  title="Показать папку в дереве"
                  onClick={() => revealFolder(f.id)}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FolderIcon size={15} className="text-folder" />
                    <span className="text-[13px] text-ink-soft truncate">{f.name}</span>
                  </span>
                </div>
              ))}
              {filteredDocuments.map((d) => {
                const isSelected = selectedId === d.id
                return (
                  <div
                    key={`search-doc-${d.id}`}
                    className={`${rowBase} pl-3 ${isSelected ? 'bg-accent-soft' : ''}`}
                    onClick={() => onSelect(d.id, d.title)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <DocsIcon size={15} className={isSelected ? 'text-accent' : 'text-doc'} />
                      <span className={`text-[13px] truncate ${isSelected ? 'text-accent font-medium' : 'text-ink-soft'}`}>
                        {d.title}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-[13px] text-faint px-2 py-3">Ничего не найдено</div>
          )
        ) : folders.length === 0 && documents.length === 0 ? (
          <div className="text-[13px] text-faint px-2 py-3 leading-relaxed">
            Пока нет документов. Создайте первый.
          </div>
        ) : (
          <div className={`${dropTarget?.kind === 'root' ? 'bg-hovered rounded-md' : ''}`}>
            {subFolders(null).map((f) => renderFolder(f))}
            {folderDocs(null).map((d) => renderDoc(d))}
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
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  )
}
