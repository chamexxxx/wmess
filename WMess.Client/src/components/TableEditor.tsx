/**
 * TableEditor — совместная таблица (Excel-подобная) с синхронизацией через Yjs.
 *
 * Структура данных в Yjs:
 * - columns: Y.Array<Y.Map>  — колонка: { id: string, title: string }.
 *   Y.Map (а не plain-объект), чтобы переименование заголовка мержилось между
 *   пользователями, а не перезаписывало колонку целиком.
 * - rows: Y.Array<Y.Map>     — строка: ключ = column.id, значение = содержимое ячейки.
 *
 * Использование:
 * <TableProvider tableId={1}>
 *   <TableEditor />
 * </TableProvider>
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { useTable } from '../providers/TableProvider'
import { ContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { PlusIcon, TrashIcon } from '../workspace/icons'

interface ColumnView {
  id: string
  title: string
}

interface RowView {
  values: Record<string, string>
}

export function TableEditor() {
  const { doc, awareness, connect, disconnect, username, cursorColor } = useTable()

  // Колонки могут быть либо Y.Map (текущий формат), либо plain-объектом {id,title}
  // (ранняя версия редактора). Тип — unknown, разбираем через readColumn().
  const yColumns = useMemo(() => doc.getArray<unknown>('columns'), [doc])
  const yRows = useMemo(() => doc.getArray<Y.Map<unknown>>('rows'), [doc])

  // Читает колонку независимо от формата хранения (Y.Map или plain-объект).
  const readColumn = useCallback((c: unknown): ColumnView => {
    if (c instanceof Y.Map) {
      return { id: String(c.get('id') ?? ''), title: String(c.get('title') ?? '') }
    }
    const o = (c ?? {}) as { id?: unknown; title?: unknown }
    return { id: String(o.id ?? ''), title: String(o.title ?? '') }
  }, [])

  const [columns, setColumns] = useState<ColumnView[]>([])
  const [rows, setRows] = useState<RowView[]>([])
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)

  // Синхронизация Yjs → React-состояние + подключение к серверу на время жизни редактора.
  useEffect(() => {
    const syncColumns = () => {
      setColumns(yColumns.map((c) => readColumn(c)))
    }
    const syncRows = () => {
      setRows(
        yRows.map((r) => {
          const values: Record<string, string> = {}
          r.forEach((v, k) => {
            values[k] = v == null ? '' : String(v)
          })
          return { values }
        }),
      )
    }

    syncColumns()
    syncRows()
    yColumns.observeDeep(syncColumns)
    yRows.observeDeep(syncRows)

    connect()
    return () => {
      yColumns.unobserveDeep(syncColumns)
      yRows.unobserveDeep(syncRows)
      disconnect()
    }
  }, [yColumns, yRows, connect, disconnect, readColumn])

  // Транслируем свою личность (имя/цвет) в presence, когда известен реальный аккаунт.
  useEffect(() => {
    if (username) {
      awareness.setLocalStateField('user', { name: username, color: cursorColor })
    }
  }, [awareness, username, cursorColor])

  // ---- Операции над таблицей (пишем в Yjs, UI обновится через observeDeep) ----

  const addColumn = useCallback(() => {
    const col = new Y.Map<unknown>()
    col.set('id', `col_${Date.now()}_${Math.floor(Math.random() * 1e6)}`)
    col.set('title', `Колонка ${yColumns.length + 1}`)
    yColumns.push([col])
    // Если строк ещё нет — заводим первую, чтобы было куда вводить данные.
    if (yRows.length === 0) {
      yRows.push([new Y.Map<unknown>()])
    }
  }, [yColumns, yRows])

  const addRow = useCallback(() => {
    yRows.push([new Y.Map<unknown>()])
  }, [yRows])

  const renameColumn = useCallback(
    (index: number, title: string) => {
      const col = yColumns.get(index)
      if (col instanceof Y.Map) {
        col.set('title', title)
      } else if (col != null) {
        // legacy plain-объект переименовать нельзя — заменяем его на Y.Map (миграция формата).
        const { id } = readColumn(col)
        const m = new Y.Map<unknown>()
        m.set('id', id)
        m.set('title', title)
        doc.transact(() => {
          yColumns.delete(index, 1)
          yColumns.insert(index, [m])
        })
      }
    },
    [doc, yColumns, readColumn],
  )

  const setCell = useCallback(
    (rowIndex: number, colId: string, value: string) => {
      const row = yRows.get(rowIndex)
      if (row) row.set(colId, value)
    },
    [yRows],
  )

  const deleteColumn = useCallback(
    (index: number) => {
      const col = yColumns.get(index)
      const colId = col != null ? readColumn(col).id : null
      // Одна транзакция: и колонка, и её ячейки во всех строках уходят атомарно.
      doc.transact(() => {
        yColumns.delete(index, 1)
        if (colId) {
          yRows.forEach((r) => {
            if (r.has(colId)) r.delete(colId)
          })
        }
      })
    },
    [doc, yColumns, yRows, readColumn],
  )

  const deleteRow = useCallback(
    (index: number) => {
      yRows.delete(index, 1)
    },
    [yRows],
  )

  // ---- Клавиатурная навигация по ячейкам (Enter/стрелки), как в Excel ----

  const inputsRef = useRef<Map<string, HTMLInputElement | null>>(new Map())
  const pendingFocus = useRef<{ r: number; c: number } | null>(null)
  const cellKey = (r: number, c: number) => `${r}:${c}`

  const focusCell = useCallback((r: number, c: number) => {
    const el = inputsRef.current.get(cellKey(r, c))
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  // Фокус на ячейку, появившуюся после ре-рендера (например, новая строка по Enter).
  useEffect(() => {
    if (pendingFocus.current) {
      const { r, c } = pendingFocus.current
      pendingFocus.current = null
      focusCell(r, c)
    }
  }, [rows, focusCell])

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, r: number, c: number) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (r === rows.length - 1) {
          pendingFocus.current = { r: r + 1, c }
          addRow()
        } else {
          focusCell(r + 1, c)
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        focusCell(r + 1, c)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        focusCell(r - 1, c)
      }
    },
    [rows.length, addRow, focusCell],
  )

  // ---- Контекстные меню (правый клик по заголовку / номеру строки) ----

  const openColumnMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Удалить колонку',
          icon: <TrashIcon size={15} />,
          danger: true,
          onClick: () => deleteColumn(index),
        },
      ],
    })
  }

  const openRowMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Удалить строку',
          icon: <TrashIcon size={15} />,
          danger: true,
          onClick: () => deleteRow(index),
        },
      ],
    })
  }

  // ---- Рендер ----

  if (columns.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-[14px] text-muted">В таблице пока нет колонок</p>
        <button
          type="button"
          onClick={addColumn}
          className="h-9 px-4 rounded-[9px] bg-accent text-white text-[13px] font-semibold hover:bg-accent-deep cursor-pointer inline-flex items-center gap-1.5"
        >
          <PlusIcon size={15} strokeWidth={2} />
          Добавить колонку
        </button>
      </div>
    )
  }

  const cornerCls = 'sticky left-0 z-10 bg-sidebar border-b border-r border-line'

  return (
    <div className="h-full overflow-auto bg-panel">
      <table className="border-separate border-spacing-0 text-[13px] text-ink">
        <thead>
          <tr>
            {/* Угловая ячейка над номерами строк */}
            <th className={`${cornerCls} w-10 min-w-10`} />
            {columns.map((col, ci) => (
              <th
                key={col.id}
                onContextMenu={(e) => openColumnMenu(e, ci)}
                className="min-w-[160px] p-0 border-b border-r border-line bg-sidebar"
              >
                <input
                  type="text"
                  value={col.title}
                  onChange={(e) => renameColumn(ci, e.target.value)}
                  placeholder="Без названия"
                  title="Нажмите, чтобы переименовать · правый клик — удалить"
                  className="w-full px-2.5 py-1.5 bg-transparent font-semibold text-ink text-left outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-accent placeholder:text-faint placeholder:font-normal"
                />
              </th>
            ))}
            {/* Кнопка добавления колонки */}
            <th className="w-10 min-w-10 border-b border-line bg-sidebar p-0">
              <button
                type="button"
                onClick={addColumn}
                title="Добавить колонку"
                className="w-full h-full flex items-center justify-center py-1.5 text-faint hover:text-accent hover:bg-hovered cursor-pointer"
              >
                <PlusIcon size={16} strokeWidth={2} />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="group">
              {/* Номер строки */}
              <td
                onContextMenu={(e) => openRowMenu(e, ri)}
                title="Правый клик — удалить строку"
                className={`${cornerCls} border-b text-center text-[12px] text-faint select-none group-hover:bg-hovered`}
              >
                {ri + 1}
              </td>
              {columns.map((col, ci) => (
                <td key={col.id} className="p-0 border-b border-r border-line">
                  <input
                    ref={(el) => {
                      inputsRef.current.set(cellKey(ri, ci), el)
                    }}
                    type="text"
                    value={row.values[col.id] ?? ''}
                    onChange={(e) => setCell(ri, col.id, e.target.value)}
                    onKeyDown={(e) => handleCellKeyDown(e, ri, ci)}
                    className="w-full px-2.5 py-1.5 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-accent"
                  />
                </td>
              ))}
              <td className="border-b border-line" />
            </tr>
          ))}
          {/* Строка добавления */}
          <tr>
            <td
              colSpan={columns.length + 2}
              className="border-b border-line p-0"
            >
              <button
                type="button"
                onClick={addRow}
                title="Добавить строку"
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[12.5px] text-faint hover:text-accent hover:bg-hovered cursor-pointer"
              >
                <PlusIcon size={15} strokeWidth={2} />
                Строка
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  )
}
