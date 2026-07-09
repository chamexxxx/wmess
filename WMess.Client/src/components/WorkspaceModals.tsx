import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const ghostBtn =
  'h-[38px] px-4 rounded-[9px] border border-line bg-white text-muted font-semibold text-[13.5px] cursor-pointer hover:bg-sidebar font-ui'

const actionBtn =
  'h-[38px] px-[18px] rounded-[9px] border-none text-white font-semibold text-[13.5px] cursor-pointer font-ui disabled:opacity-60'

/** Overlay + centered card. Closes on Esc and on backdrop click. */
function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 font-ui animate-[wmFade_.12s_ease]"
      onMouseDown={onClose}
    >
      <div
        className="w-[380px] max-w-[calc(100vw-32px)] bg-white border border-line rounded-2xl p-[22px] text-ink shadow-[0_24px_60px_rgba(43,42,38,.24)] animate-[wmPop_.14s_ease]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

interface FormModalProps {
  title: string
  label: string
  initialValue?: string
  submitLabel: string
  busy?: boolean
  onSubmit: (value: string) => void
  onClose: () => void
}

/** Single-field create/edit dialog. Enter submits, empty input is blocked. */
export function FormModal({
  title,
  label,
  initialValue = '',
  submitLabel,
  busy,
  onSubmit,
  onClose,
}: FormModalProps) {
  const [value, setValue] = useState(initialValue)
  const trimmed = value.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed || busy) return
    onSubmit(trimmed)
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-[17px] font-bold m-0">{title}</h2>
      <form onSubmit={submit}>
        <label className="block font-ui font-semibold text-[10.5px] tracking-[.06em] uppercase text-faintest mt-[18px] mb-[7px]">
          {label}
        </label>
        <input
          autoFocus
          value={value}
          maxLength={100}
          onChange={(e) => setValue(e.target.value)}
          className="w-full h-10 px-3 rounded-[9px] border border-line bg-panel text-sm text-ink font-ui focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
        />
        <div className="flex justify-end gap-2.5 mt-[22px]">
          <button type="button" className={ghostBtn} onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            className={`${actionBtn} bg-accent hover:bg-accent-deep`}
            disabled={!trimmed || busy}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface LinkFormModalProps {
  title: string
  submitLabel: string
  initialName?: string
  initialUrl?: string
  busy?: boolean
  onSubmit: (name: string, url: string) => void
  onClose: () => void
}

/** Create/edit dialog for an external link: name + URL. Enter submits, both fields required. */
export function LinkFormModal({
  title,
  submitLabel,
  initialName = '',
  initialUrl = '',
  busy,
  onSubmit,
  onClose,
}: LinkFormModalProps) {
  const [name, setName] = useState(initialName)
  const [url, setUrl] = useState(initialUrl)
  const trimmedName = name.trim()
  const trimmedUrl = url.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmedName || !trimmedUrl || busy) return
    onSubmit(trimmedName, trimmedUrl)
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-[17px] font-bold m-0">{title}</h2>
      <form onSubmit={submit}>
        <label className="block font-ui font-semibold text-[10.5px] tracking-[.06em] uppercase text-faintest mt-[18px] mb-[7px]">
          Название
        </label>
        <input
          autoFocus
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-10 px-3 rounded-[9px] border border-line bg-panel text-sm text-ink font-ui focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
        />
        <label className="block font-ui font-semibold text-[10.5px] tracking-[.06em] uppercase text-faintest mt-[14px] mb-[7px]">
          Ссылка
        </label>
        <input
          value={url}
          maxLength={2000}
          placeholder="https://"
          onChange={(e) => setUrl(e.target.value)}
          className="w-full h-10 px-3 rounded-[9px] border border-line bg-panel text-sm text-ink font-ui placeholder:text-faint focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
        />
        <div className="flex justify-end gap-2.5 mt-[22px]">
          <button type="button" className={ghostBtn} onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            className={`${actionBtn} bg-accent hover:bg-accent-deep`}
            disabled={!trimmedName || !trimmedUrl || busy}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface ConfirmDialogProps {
  title: string
  message: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Destructive confirmation with a red action button. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal onClose={onClose}>
      <h2 className="text-[17px] font-bold m-0">{title}</h2>
      <p className="text-sm leading-[1.55] text-ink-soft mt-3.5">{message}</p>
      <div className="flex justify-end gap-2.5 mt-[22px]">
        <button type="button" className={ghostBtn} onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className={`${actionBtn} bg-danger hover:bg-danger-deep`}
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
