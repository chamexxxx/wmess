import { useEffect } from 'react'
import { useToastStore } from '../store/toastStore'
import type { ToastItem } from '../store/toastStore'

function ToastRow({ id, kind, message }: ToastItem) {
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), 6000)
    return () => clearTimeout(timer)
  }, [id, dismiss])

  const accent = kind === 'error' ? 'bg-danger' : 'bg-accent'

  return (
    <div className="flex items-stretch w-[340px] max-w-[calc(100vw-32px)] bg-white border border-line rounded-[11px] shadow-[0_16px_40px_rgba(43,42,38,.22)] overflow-hidden animate-[wmPop_.14s_ease] font-ui pointer-events-auto">
      <div className={`w-1 shrink-0 ${accent}`} />
      <div className="flex-1 min-w-0 px-3.5 py-3 text-[13px] leading-[1.45] text-ink">{message}</div>
      <button
        type="button"
        onClick={() => dismiss(id)}
        title="Закрыть"
        className="shrink-0 w-9 flex items-center justify-center text-faint hover:text-ink cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}

/** Единая точка показа тостов. Монтируется один раз в корне приложения. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div className="fixed z-[200] bottom-4 right-4 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastRow key={t.id} {...t} />
      ))}
    </div>
  )
}
