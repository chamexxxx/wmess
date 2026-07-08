import { useEffect, useState } from 'react'
import { apiClient } from '../api'
import { FormModal, ConfirmDialog } from './WorkspaceModals'
import { ContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { BoardsIcon, DocsIcon, FolderIcon, HomeIcon, PencilIcon, PlusIcon, SearchIcon, TablesIcon, TrashIcon } from '../workspace/icons'

interface FolderItem {
  id: number
  name: string
  updatedAt?: string
}

interface DocItem {
  id: number
  title: string
  type?: string
  updatedAt?: string
}

type RenameTarget = { kind: 'folder'; id: number; name: string } | { kind: 'doc'; id: number; name: string }
type DeleteTarget = RenameTarget

interface LibraryExplorerProps {
  projectId: number
  folderId: number | null
  onNavigateFolder: (id: number | null) => void
  onOpenDocument: (id: number, title: string, type?: string) => void
}

function formatDate(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function LibraryExplorer({ projectId, folderId, onNavigateFolder, onOpenDocument }: LibraryExplorerProps) {
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [path, setPath] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [searchFolders, setSearchFolders] = useState<FolderItem[]>([])
  const [searchDocs, setSearchDocs] = useState<DocItem[]>([])
  const searching = query.trim().length > 0

  const [createKind, setCreateKind] = useState<'folder' | 'doc' | 'board' | 'table' | null>(null)
  // Папка, в которой создаётся документ (через контекстное меню папки); null — текущая папка.
  const [createDocFolderId, setCreateDocFolderId] = useState<number | null>(null)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragItem, setDragItem] = useState<{ kind: 'folder' | 'doc'; id: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<number | 'root' | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)

  const loadContents = async () => {
    // Намеренно НЕ ставим loading=true при переходах: иначе список на миг заменяется на
    // «Загрузка…» и контейнер дёргается. Лоадер показываем только для самой первой загрузки
    // (loading инициализирован в true); дальше новый список плавно подменяет старый на месте.
    try {
      const res = await apiClient.library.getFolderContents(projectId, {
        folderId: folderId ?? undefined,
      })
      const data = res.data
      setFolders((data?.folders ?? []).map((f) => ({ id: Number(f.id), name: f.name ?? '', updatedAt: f.updatedAt })))
      setDocuments(
        (data?.items ?? []).map((d) => ({ id: Number(d.id), title: d.title ?? 'Без названия', type: d.type, updatedAt: d.updatedAt })),
      )
      setPath((data?.path ?? []).map((p) => ({ id: Number(p.id), name: p.name ?? '' })))
    } catch (error) {
      console.error('Failed to load folder contents:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, folderId])

  // Поиск по проекту с дебаунсом (серверный).
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSearchFolders([])
      setSearchDocs([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.library.searchLibrary(projectId, { query: q })
        setSearchFolders((res.data?.folders ?? []).map((f) => ({ id: Number(f.id), name: f.name ?? '' })))
        setSearchDocs((res.data?.items ?? []).map((d) => ({ id: Number(d.id), title: d.title ?? 'Без названия', type: d.type })))
      } catch (error) {
        console.error('Failed to search:', error)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, projectId])

  const createFolder = async (name: string) => {
    setBusy(true)
    try {
      await apiClient.library.createFolder({ projectId, parentFolderId: folderId, name })
      setCreateKind(null)
      await loadContents()
    } catch (error) {
      console.error('Failed to create folder:', error)
    } finally {
      setBusy(false)
    }
  }

  const createDocument = async (title: string) => {
    setBusy(true)
    try {
      const res = await apiClient.library.createDocument({ projectId, folderId: createDocFolderId, title })
      setCreateKind(null)
      setCreateDocFolderId(null)
      if (res.data?.id != null) {
        onOpenDocument(Number(res.data.id), res.data.title ?? title, 'document')
      }
    } catch (error) {
      console.error('Failed to create document:', error)
    } finally {
      setBusy(false)
    }
  }

  const createBoard = async (title: string) => {
    setBusy(true)
    try {
      const res = await apiClient.library.createBoard({ projectId, folderId: createDocFolderId, title })
      setCreateKind(null)
      setCreateDocFolderId(null)
      if (res.data?.id != null) {
        onOpenDocument(Number(res.data.id), res.data.title ?? title, 'board')
      }
    } catch (error) {
      console.error('Failed to create board:', error)
    } finally {
      setBusy(false)
    }
  }

  const createTable = async (title: string) => {
    setBusy(true)
    try {
      const res = await apiClient.library.createTable({ projectId, folderId: createDocFolderId, title })
      setCreateKind(null)
      setCreateDocFolderId(null)
      if (res.data?.id != null) {
        onOpenDocument(Number(res.data.id), res.data.title ?? title, 'table')
      }
    } catch (error) {
      console.error('Failed to create table:', error)
    } finally {
      setBusy(false)
    }
  }

  const rename = async (name: string) => {
    if (!renameTarget) return
    setBusy(true)
    try {
      if (renameTarget.kind === 'folder') {
        await apiClient.library.updateFolder(renameTarget.id, { name })
      } else {
        await apiClient.library.updateItem(renameTarget.id, { title: name })
      }
      setRenameTarget(null)
      await loadContents()
    } catch (error) {
      console.error('Failed to rename:', error)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      if (deleteTarget.kind === 'folder') {
        await apiClient.library.deleteFolder(deleteTarget.id)
      } else {
        await apiClient.library.deleteItem(deleteTarget.id)
      }
      setDeleteTarget(null)
      await loadContents()
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setBusy(false)
    }
  }

  // Перемещение перетаскиванием: в папку (target=id) или в предка через крошки (target=id|null).
  const moveInto = async (target: number | null) => {
    const item = dragItem
    setDragItem(null)
    setDropTarget(null)
    if (!item) return
    if (item.kind === 'folder' && item.id === target) return
    try {
      if (item.kind === 'folder') {
        await apiClient.library.moveFolder(item.id, { parentFolderId: target })
      } else {
        await apiClient.library.moveItem(item.id, { folderId: target })
      }
      await loadContents()
    } catch (error) {
      console.error('Failed to move:', error)
    }
  }

  const rowBase =
    'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-hovered'
  const iconBtn =
    'h-8 w-8 rounded-[9px] flex items-center justify-center text-muted cursor-pointer hover:bg-hovered'

  // Контекстное меню (правая кнопка) — действия вместо иконок при наведении.
  const openFolderMenu = (e: React.MouseEvent, f: FolderItem) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Создать документ',
          icon: <DocsIcon size={15} className="text-doc" />,
          onClick: () => {
            setCreateDocFolderId(f.id)
            setCreateKind('doc')
          },
        },
        {
          label: 'Создать доску',
          icon: <BoardsIcon size={15} className="text-board" />,
          onClick: () => {
            setCreateDocFolderId(f.id)
            setCreateKind('board')
          },
        },
        {
          label: 'Создать таблицу',
          icon: <TablesIcon size={15} className="text-table" />,
          onClick: () => {
            setCreateDocFolderId(f.id)
            setCreateKind('table')
          },
        },
        {
          label: 'Переименовать',
          icon: <PencilIcon size={15} />,
          onClick: () => setRenameTarget({ kind: 'folder', id: f.id, name: f.name }),
        },
        {
          label: 'Удалить',
          icon: <TrashIcon size={15} />,
          danger: true,
          onClick: () => setDeleteTarget({ kind: 'folder', id: f.id, name: f.name }),
        },
      ],
    })
  }

  const openDocMenu = (e: React.MouseEvent, d: DocItem) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Переименовать',
          icon: <PencilIcon size={15} />,
          onClick: () => setRenameTarget({ kind: 'doc', id: d.id, name: d.title }),
        },
        {
          label: 'Удалить',
          icon: <TrashIcon size={15} />,
          danger: true,
          onClick: () => setDeleteTarget({ kind: 'doc', id: d.id, name: d.title }),
        },
      ],
    })
  }

  // Меню для пустой области списка — создание в текущей папке (folderId).
  const openEmptyMenu = (e: React.MouseEvent) => {
    if (searching) return
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Создать папку',
          icon: <FolderIcon size={15} className="text-folder" />,
          onClick: () => setCreateKind('folder'),
        },
        {
          label: 'Создать документ',
          icon: <DocsIcon size={15} className="text-doc" />,
          onClick: () => {
            setCreateDocFolderId(folderId)
            setCreateKind('doc')
          },
        },
        {
          label: 'Создать доску',
          icon: <BoardsIcon size={15} className="text-board" />,
          onClick: () => {
            setCreateDocFolderId(folderId)
            setCreateKind('board')
          },
        },
        {
          label: 'Создать таблицу',
          icon: <TablesIcon size={15} className="text-table" />,
          onClick: () => {
            setCreateDocFolderId(folderId)
            setCreateKind('table')
          },
        },
      ],
    })
  }

  // Перетаскивание включаем только в обычном просмотре (withMeta), не в результатах поиска,
  // где элементы лежат плоским списком из разных папок.
  const folderRow = (f: FolderItem, withMeta: boolean) => {
    const isDragOver = dropTarget === f.id
    const isDragging = dragItem?.kind === 'folder' && dragItem.id === f.id
    const canDrop = withMeta && !!dragItem && !(dragItem.kind === 'folder' && dragItem.id === f.id)
    return (
    <div
      key={`f-${f.id}`}
      className={`${rowBase} ${isDragOver ? 'bg-accent-soft ring-1 ring-inset ring-accent/40' : ''} ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => onNavigateFolder(f.id)}
      onContextMenu={(e) => openFolderMenu(e, f)}
      draggable={withMeta}
      onDragStart={
        withMeta
          ? (e) => {
              e.dataTransfer.effectAllowed = 'move'
              setDragItem({ kind: 'folder', id: f.id })
            }
          : undefined
      }
      onDragEnd={
        withMeta
          ? () => {
              setDragItem(null)
              setDropTarget(null)
            }
          : undefined
      }
      onDragOver={
        withMeta
          ? (e) => {
              if (!dragItem) return
              e.stopPropagation()
              if (!canDrop) {
                e.dataTransfer.dropEffect = 'none'
                if (dropTarget === f.id) setDropTarget(null)
                return
              }
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (dropTarget !== f.id) setDropTarget(f.id)
            }
          : undefined
      }
      onDragLeave={
        withMeta
          ? () => {
              if (dropTarget === f.id) setDropTarget(null)
            }
          : undefined
      }
      onDrop={
        withMeta
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
              if (canDrop) moveInto(f.id)
            }
          : undefined
      }
    >
      <FolderIcon size={18} className="text-folder shrink-0" />
      <span className="flex-1 min-w-0 text-[13.5px] text-ink truncate">{f.name}</span>
      {withMeta && <span className="shrink-0 w-28 text-right text-[12px] text-faint">{formatDate(f.updatedAt)}</span>}
    </div>
    )
  }

  const docRow = (d: DocItem, withMeta: boolean) => {
    const isDragging = dragItem?.kind === 'doc' && dragItem.id === d.id
    return (
    <div
      key={`d-${d.id}`}
      className={`${rowBase} ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => onOpenDocument(d.id, d.title, d.type)}
      onContextMenu={(e) => openDocMenu(e, d)}
      draggable={withMeta}
      onDragStart={
        withMeta
          ? (e) => {
              e.dataTransfer.effectAllowed = 'move'
              setDragItem({ kind: 'doc', id: d.id })
            }
          : undefined
      }
      onDragEnd={
        withMeta
          ? () => {
              setDragItem(null)
              setDropTarget(null)
            }
          : undefined
      }
    >
      {d.type === 'board' ? (
        <BoardsIcon size={18} className="text-board shrink-0" />
      ) : d.type === 'table' ? (
        <TablesIcon size={18} className="text-table shrink-0" />
      ) : (
        <DocsIcon size={18} className="text-doc shrink-0" />
      )}
      <span className="flex-1 min-w-0 text-[13.5px] text-ink truncate">{d.title}</span>
      {withMeta && <span className="shrink-0 w-28 text-right text-[12px] text-faint">{formatDate(d.updatedAt)}</span>}
    </div>
    )
  }

  const isEmpty = !searching && folders.length === 0 && documents.length === 0
  const noResults = searching && searchFolders.length === 0 && searchDocs.length === 0

  // Крошки как зоны сброса: перенос в предка (c.id) или в корень (Home → null).
  const breadcrumbDnd = (target: number | 'root') => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragItem) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      if (dropTarget !== target) setDropTarget(target)
    },
    onDragLeave: () => {
      if (dropTarget === target) setDropTarget(null)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      moveInto(target === 'root' ? null : target)
    },
  })

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-[52px] shrink-0 flex items-center gap-3 px-5">
        <nav className="flex items-center gap-1.5 text-[14px] min-w-0">
          <button
            type="button"
            className={`shrink-0 w-7 h-7 -ml-1 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              dropTarget === 'root'
                ? 'bg-accent-soft text-accent ring-1 ring-inset ring-accent/40'
                : 'text-muted hover:bg-hovered hover:text-accent'
            }`}
            title="Все файлы"
            onClick={() => onNavigateFolder(null)}
            {...(path.length === 0 ? {} : breadcrumbDnd('root'))}
          >
            <HomeIcon size={16} />
          </button>
          {path.map((c, i) => {
            // Последний пункт — текущая папка: не ссылка, без подсветки и не цель для переноса.
            const isCurrent = i === path.length - 1
            return (
              <span key={c.id} className="flex items-center gap-1.5 min-w-0">
                <span className="text-faintest shrink-0">/</span>
                {isCurrent ? (
                  <span className="truncate px-1 -mx-1 text-ink font-medium">{c.name}</span>
                ) : (
                  <button
                    type="button"
                    className={`transition-colors truncate cursor-pointer rounded px-1 -mx-1 ${
                      dropTarget === c.id
                        ? 'bg-accent-soft text-accent ring-1 ring-inset ring-accent/40'
                        : 'text-muted hover:text-accent'
                    }`}
                    onClick={() => onNavigateFolder(c.id)}
                    {...breadcrumbDnd(c.id)}
                  >
                    {c.name}
                  </button>
                )}
              </span>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по проекту"
              className="h-8 w-52 pl-8 pr-2 text-[13px] bg-white border border-line rounded-[9px] text-ink placeholder:text-faint focus:outline-none focus:border-accent"
            />
          </div>
          <button type="button" className={iconBtn} title="Новая папка" onClick={() => setCreateKind('folder')}>
            <FolderIcon size={16} />
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-[9px] bg-accent text-white text-[13px] font-semibold hover:bg-accent-deep cursor-pointer flex items-center gap-1.5"
            onClick={() => {
              setCreateDocFolderId(folderId)
              setCreateKind('doc')
            }}
          >
            <PlusIcon size={15} strokeWidth={2} />
            Документ
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-[9px] bg-accent text-white text-[13px] font-semibold hover:bg-accent-deep cursor-pointer flex items-center gap-1.5"
            onClick={() => {
              setCreateDocFolderId(folderId)
              setCreateKind('board')
            }}
          >
            <PlusIcon size={15} strokeWidth={2} />
            Доска
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-[9px] bg-accent text-white text-[13px] font-semibold hover:bg-accent-deep cursor-pointer flex items-center gap-1.5"
            onClick={() => {
              setCreateDocFolderId(folderId)
              setCreateKind('table')
            }}
          >
            <PlusIcon size={15} strokeWidth={2} />
            Таблица
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto wm-scroll px-3 pt-4 pb-2" onContextMenu={openEmptyMenu}>
        {loading ? (
          <div className="px-3 py-4 text-[13px] text-faint">Загрузка…</div>
        ) : searching ? (
          noResults ? (
            <div className="px-3 py-4 text-[13px] text-faint">Ничего не найдено</div>
          ) : (
            <>
              {searchFolders.map((f) => folderRow(f, false))}
              {searchDocs.map((d) => docRow(d, false))}
            </>
          )
        ) : isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-[48px] h-[48px] rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
              <FolderIcon size={22} strokeWidth={1.6} />
            </div>
            <div className="text-[13.5px] text-muted max-w-[320px] leading-[1.5]">
              {path.length > 0 ? 'Папка пуста.' : 'Здесь пока ничего нет.'} Создайте элемент или папку.
            </div>
          </div>
        ) : (
          <>
            {folders.map((f) => folderRow(f, true))}
            {documents.map((d) => docRow(d, true))}
          </>
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
            setCreateDocFolderId(null)
          }}
        />
      )}
      {createKind === 'board' && (
        <FormModal
          title="Новая доска"
          label="Название доски"
          submitLabel="Создать"
          busy={busy}
          onSubmit={createBoard}
          onClose={() => {
            setCreateKind(null)
            setCreateDocFolderId(null)
          }}
        />
      )}
      {createKind === 'table' && (
        <FormModal
          title="Новая таблица"
          label="Название таблицы"
          submitLabel="Создать"
          busy={busy}
          onSubmit={createTable}
          onClose={() => {
            setCreateKind(null)
            setCreateDocFolderId(null)
          }}
        />
      )}
      {renameTarget && (
        <FormModal
          title={renameTarget.kind === 'folder' ? 'Переименовать папку' : 'Переименовать элемент'}
          label={renameTarget.kind === 'folder' ? 'Название папки' : 'Название'}
          submitLabel="Сохранить"
          busy={busy}
          initialValue={renameTarget.name}
          onSubmit={rename}
          onClose={() => setRenameTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.kind === 'folder' ? 'Удалить папку?' : 'Удалить элемент?'}
          message={
            deleteTarget.kind === 'folder' ? (
              <>Папка «{deleteTarget.name}» будет удалена. Вложенные элементы останутся без папки.</>
            ) : (
              <>Элемент «{deleteTarget.name}» будет удалён без возможности восстановления.</>
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
