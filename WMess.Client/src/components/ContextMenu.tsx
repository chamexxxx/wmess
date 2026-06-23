import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface ContextMenuItem {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

/**
 * Меню по правой кнопке мыши. Открывается у курсора (x/y), сдвигается внутрь
 * вьюпорта у краёв, закрывается по клику вне, Esc, скроллу или ресайзу.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Прижимаем меню к курсору, но не даём вылезти за правый/нижний край.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-[90] min-w-[186px] py-1 bg-white border border-line rounded-[10px] shadow-[0_12px_32px_rgba(43,42,38,.18)] font-ui animate-[wmPop_.1s_ease]"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          className={`w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] text-left cursor-pointer ${
            item.danger ? 'text-danger hover:bg-danger/10' : 'text-ink-soft hover:bg-hovered'
          }`}
          onClick={() => {
            onClose()
            item.onClick()
          }}
        >
          <span className={`shrink-0 ${item.danger ? 'text-danger' : 'text-faint'}`} aria-hidden="true">
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  )
}
