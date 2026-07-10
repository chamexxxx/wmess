import { useCallback, useEffect, useRef, useState } from 'react'

export function usePanelResize(
  storageKey: string,
  defaultWidth: number,
  min: number,
  max: number,
) {
  const [width, setWidth] = useState(() => {
    const raw = localStorage.getItem(storageKey)
    const n = raw ? Number(raw) : defaultWidth
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaultWidth
  })
  const [isResizing, setIsResizing] = useState(false)
  const widthRef = useRef(width)
  widthRef.current = width

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const onMove = (e: MouseEvent) => {
      setWidth(Math.min(max, Math.max(min, window.innerWidth - e.clientX)))
    }

    const onUp = () => {
      setIsResizing(false)
      localStorage.setItem(storageKey, String(widthRef.current))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    const prevUserSelect = document.body.style.userSelect
    const prevCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = prevUserSelect
      document.body.style.cursor = prevCursor
    }
  }, [isResizing, min, max, storageKey])

  return { width, isResizing, onResizeStart }
}
