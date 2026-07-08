/**
 * TableEditor — совместная таблица (Excel-подобная) с синхронизацией через Yjs.
 *
 * Сетка всегда заполняет всю видимую область: помимо реальных строк/колонок
 * (что уже есть в документе) рисуются «фантомные» ячейки до краёв вьюпорта.
 * Ввод в фантомную ячейку «материализует» недостающие строки/колонки в Yjs
 * (модель Google Sheets), поэтому пустая таблица выглядит как готовый лист.
 *
 * Структура данных в Yjs:
 * - columns: Y.Array<Y.Map>  — колонка: { id: string, title: string }.
 * - rows: Y.Array<Y.Map>     — строка: ключ = column.id, значение = ячейка.
 *
 * Использование:
 * <TableProvider tableId={1}><TableEditor /></TableProvider>
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { useTable } from '../providers/TableProvider'
import { ContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { TrashIcon } from '../workspace/icons'

interface ColumnView {
  id: string
  title: string
  width?: number
}

interface RowView {
  values: Record<string, string>
}

// Размеры ячеек сетки (px). CELL_W — ширина колонки по умолчанию (можно менять перетаскиванием).
const CELL_W = 150
const CELL_H = 32
const ROWNUM_W = 44
const HEADER_H = 33
const MIN_COL_W = 56

const genColId = () => `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`

export function TableEditor() {
  const { doc, awareness, connect, disconnect, username, cursorColor } = useTable()

  // Колонки могут быть Y.Map (текущий формат) или plain-объектом {id,title}
  // (ранняя версия редактора). Тип — unknown, разбираем через readColumn().
  const yColumns = useMemo(() => doc.getArray<unknown>('columns'), [doc])
  const yRows = useMemo(() => doc.getArray<Y.Map<unknown>>('rows'), [doc])

  const readColumn = useCallback((c: unknown): ColumnView => {
    if (c instanceof Y.Map) {
      const w = c.get('width')
      return {
        id: String(c.get('id') ?? ''),
        title: String(c.get('title') ?? ''),
        width: typeof w === 'number' ? w : undefined,
      }
    }
    const o = (c ?? {}) as { id?: unknown; title?: unknown; width?: unknown }
    return {
      id: String(o.id ?? ''),
      title: String(o.title ?? ''),
      width: typeof o.width === 'number' ? o.width : undefined,
    }
  }, [])

  const [columns, setColumns] = useState<ColumnView[]>([])
  const [rows, setRows] = useState<RowView[]>([])
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  // Буфер пустых строк/колонок за пределами видимой области — чтобы было куда
  // прокручивать. Растёт при подходе к краю (см. handleScroll), давая «бесконечную» сетку.
  const [extra, setExtra] = useState({ cols: 4, rows: 6 })
  // Живое перетаскивание границы колонки: { индекс колонки, текущая ширина }. Запись в Yjs — на отпускании.
  const [resize, setResize] = useState<{ col: number; width: number } | null>(null)

  // Синхронизация Yjs → React + подключение к серверу на время жизни редактора.
  useEffect(() => {
    const syncColumns = () => setColumns(yColumns.map((c) => readColumn(c)))
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

  // Presence: транслируем имя/цвет, когда известен реальный аккаунт.
  useEffect(() => {
    if (username) {
      awareness.setLocalStateField('user', { name: username, color: cursorColor })
    }
  }, [awareness, username, cursorColor])

  // Замер контейнера, чтобы понять, сколько строк/колонок нужно для заполнения области.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---- Операции над Yjs ----

  // Гарантирует, что колонок хотя бы (index+1) и строк хотя бы (rowIndex+1).
  // Недостающие создаются пустыми — так фантомная ячейка становится реальной.
  const ensure = useCallback(
    (rowIndex: number, colIndex: number) => {
      while (yColumns.length <= colIndex) {
        const col = new Y.Map<unknown>()
        col.set('id', genColId())
        col.set('title', '')
        yColumns.push([col])
      }
      while (yRows.length <= rowIndex) {
        yRows.push([new Y.Map<unknown>()])
      }
    },
    [yColumns, yRows],
  )

  const setCell = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      doc.transact(() => {
        ensure(rowIndex, colIndex)
        const colId = readColumn(yColumns.get(colIndex)).id
        yRows.get(rowIndex).set(colId, value)
      })
    },
    [doc, ensure, yColumns, yRows, readColumn],
  )

  // Возвращает Y.Map колонки по индексу, создавая недостающие (материализация фантомных)
  // и мигрируя legacy plain-объект в Y.Map. Вызывать внутри doc.transact.
  const ensureColumnMap = useCallback(
    (colIndex: number): Y.Map<unknown> => {
      while (yColumns.length <= colIndex) {
        const col = new Y.Map<unknown>()
        col.set('id', genColId())
        col.set('title', '')
        yColumns.push([col])
      }
      const cur = yColumns.get(colIndex)
      if (cur instanceof Y.Map) return cur
      const { id, title, width } = readColumn(cur)
      const m = new Y.Map<unknown>()
      m.set('id', id)
      m.set('title', title)
      if (width) m.set('width', width)
      yColumns.delete(colIndex, 1)
      yColumns.insert(colIndex, [m])
      return m
    },
    [yColumns, readColumn],
  )

  const setTitle = useCallback(
    (colIndex: number, title: string) => {
      doc.transact(() => ensureColumnMap(colIndex).set('title', title))
    },
    [doc, ensureColumnMap],
  )

  const setColumnWidth = useCallback(
    (colIndex: number, width: number) => {
      doc.transact(() => ensureColumnMap(colIndex).set('width', Math.max(MIN_COL_W, Math.round(width))))
    },
    [doc, ensureColumnMap],
  )

  const addRow = useCallback(() => yRows.push([new Y.Map<unknown>()]), [yRows])

  const deleteColumn = useCallback(
    (index: number) => {
      const col = yColumns.get(index)
      const colId = col != null ? readColumn(col).id : null
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

  const deleteRow = useCallback((index: number) => yRows.delete(index, 1), [yRows])

  // ---- Размеры сетки: max(реальные, сколько влезает в область) ----

  const realCols = columns.length
  const realRows = rows.length
  const fillCols = size.w > 0 ? Math.ceil((size.w - ROWNUM_W) / CELL_W) : 8
  const fillRows = size.h > 0 ? Math.ceil((size.h - HEADER_H) / CELL_H) : 20
  // Показываем максимум из «реальных данных» и «сколько влезает в область», плюс буфер для прокрутки.
  const displayCols = Math.max(realCols, fillCols, 1) + extra.cols
  const displayRows = Math.max(realRows, fillRows, 1) + extra.rows

  // Ширина колонки: во время перетаскивания — живое значение, иначе сохранённая (или дефолт).
  const columnWidth = useCallback(
    (c: number) => {
      if (resize && resize.col === c) return resize.width
      if (c < realCols && columns[c].width) return columns[c].width!
      return CELL_W
    },
    [resize, realCols, columns],
  )

  const tableWidth =
    ROWNUM_W + Array.from({ length: displayCols }, (_, c) => columnWidth(c)).reduce((a, b) => a + b, 0)

  // Старт перетаскивания правой границы колонки: слушаем мышь на окне до отпускания.
  const startResize = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = columnWidth(colIndex)
      let liveW = startW
      const onMove = (ev: MouseEvent) => {
        liveW = Math.max(MIN_COL_W, Math.round(startW + (ev.clientX - startX)))
        setResize({ col: colIndex, width: liveW })
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        setColumnWidth(colIndex, liveW)
        setResize(null)
      }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [columnWidth, setColumnWidth],
  )

  // При прокрутке к правому/нижнему краю доращиваем буфер — сетка «бесконечна» в обе стороны.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - CELL_W * 2) {
      setExtra((e) => ({ ...e, cols: e.cols + 4 }))
    }
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - CELL_H * 3) {
      setExtra((e) => ({ ...e, rows: e.rows + 10 }))
    }
  }, [])

  // ---- Клавиатурная навигация (Enter / стрелки), как в Excel ----

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
        if (r + 1 >= displayRows) {
          pendingFocus.current = { r: r + 1, c }
          addRow()
        } else {
          focusCell(r + 1, c)
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        focusCell(Math.min(r + 1, displayRows - 1), c)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        focusCell(Math.max(r - 1, 0), c)
      }
    },
    [displayRows, addRow, focusCell],
  )

  // ---- Контекстные меню (только для реальных строк/колонок) ----

  const openColumnMenu = (e: React.MouseEvent, index: number) => {
    if (index >= realCols) return
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Удалить колонку', icon: <TrashIcon size={15} />, danger: true, onClick: () => deleteColumn(index) },
      ],
    })
  }

  const openRowMenu = (e: React.MouseEvent, index: number) => {
    if (index >= realRows) return
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Удалить строку', icon: <TrashIcon size={15} />, danger: true, onClick: () => deleteRow(index) },
      ],
    })
  }

  // ---- Рендер ----

  const colIndexes = Array.from({ length: displayCols }, (_, i) => i)
  const rowIndexes = Array.from({ length: displayRows }, (_, i) => i)
  const headerCls =
    'sticky top-0 z-10 h-[33px] p-0 border-b border-r border-line bg-sidebar align-middle'

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-auto bg-panel">
      <table
        className="table-fixed border-separate border-spacing-0 text-[13px] text-ink"
        style={{ width: tableWidth }}
      >
        <colgroup>
          <col style={{ width: ROWNUM_W }} />
          {colIndexes.map((c) => (
            <col key={c} style={{ width: columnWidth(c) }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            {/* Угловая ячейка над номерами строк */}
            <th className={`${headerCls} sticky left-0 z-20`} />
            {colIndexes.map((c) => {
              const title = c < realCols ? columns[c].title : ''
              return (
                <th key={c} onContextMenu={(e) => openColumnMenu(e, c)} className={`${headerCls} relative`}>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(c, e.target.value)}
                    placeholder={c < realCols ? 'Без названия' : ''}
                    title="Заголовок колонки · правый клик — удалить"
                    className="w-full h-full px-2 bg-transparent font-semibold text-ink text-left outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-accent placeholder:text-faint placeholder:font-normal"
                  />
                  {/* Ручка изменения ширины: тянем правую границу колонки */}
                  <div
                    onMouseDown={(e) => startResize(e, c)}
                    onContextMenu={(e) => e.stopPropagation()}
                    title="Потяните, чтобы изменить ширину"
                    className="absolute top-0 right-0 z-20 h-full w-[6px] translate-x-1/2 cursor-col-resize hover:bg-accent/40"
                  />
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {rowIndexes.map((r) => (
            <tr key={r} className="group" style={{ height: CELL_H }}>
              {/* Номер строки */}
              <td
                onContextMenu={(e) => openRowMenu(e, r)}
                title="Правый клик — удалить строку"
                className="sticky left-0 z-10 border-b border-r border-line bg-sidebar text-center text-[12px] text-faint select-none group-hover:bg-hovered"
              >
                {r + 1}
              </td>
              {colIndexes.map((c) => {
                const colId = c < realCols ? columns[c].id : ''
                const value = c < realCols && r < realRows ? rows[r].values[colId] ?? '' : ''
                return (
                  <td key={c} className="p-0 border-b border-r border-line">
                    <input
                      ref={(el) => {
                        inputsRef.current.set(cellKey(r, c), el)
                      }}
                      type="text"
                      value={value}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, r, c)}
                      className="block w-full h-8 px-2 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-accent"
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  )
}
