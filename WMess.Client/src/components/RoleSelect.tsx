import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ROLE_LABELS } from '../workspace/roles'
import { CheckIcon, ChevronDownIcon } from '../workspace/icons'

const ROLE_VALUES = [0, 1, 2]

interface RoleSelectProps {
  value: number
  disabled?: boolean
  onChange: (role: number) => void
}

/**
 * Дропдаун выбора роли в стиле приложения. Нативный <select> не стилизуется
 * (выпадающий список рисует браузер), поэтому список — кастомный поповер.
 * Позиционируется fixed по кнопке, чтобы не обрезаться overflow модалки.
 */
export function RoleSelect({ value, disabled, onChange }: RoleSelectProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, 150)
    // Выравниваем по правому краю кнопки и прижимаем к вьюпорту.
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
    // Обычно раскрываем вниз, но если не помещается у нижнего края — вверх.
    const menuHeight = ROLE_VALUES.length * 32 + 8
    const top =
      r.bottom + 4 + menuHeight > window.innerHeight - 8 ? r.top - menuHeight - 4 : r.bottom + 4
    setPos({ left, top, width })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!menuRef.current?.contains(target) && !btnRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="h-8 pl-2.5 pr-1.5 inline-flex items-center gap-1 rounded-[7px] border border-line bg-white text-sm text-ink-soft font-ui cursor-pointer hover:bg-hovered disabled:opacity-50 disabled:cursor-default focus:outline-none focus:border-accent"
      >
        <span>{ROLE_LABELS[value]}</span>
        <ChevronDownIcon
          size={14}
          className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          className="fixed z-[110] py-1 bg-white border border-line rounded-[10px] shadow-[0_12px_32px_rgba(43,42,38,.18)] font-ui animate-[wmPop_.1s_ease]"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
        >
          {ROLE_VALUES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setOpen(false)
                if (r !== value) onChange(r)
              }}
              className={`w-full flex items-center gap-2 px-3 py-[7px] text-[13px] text-left cursor-pointer hover:bg-hovered ${
                r === value ? 'text-accent-deep font-semibold' : 'text-ink-soft'
              }`}
            >
              <CheckIcon size={15} className={r === value ? 'text-accent' : 'opacity-0'} />
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
