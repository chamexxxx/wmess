import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { accent, c, font } from '../workspace/theme'

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(43,42,38,.28)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  fontFamily: font.sans,
}

const cardStyle: React.CSSProperties = {
  width: 380,
  maxWidth: 'calc(100vw - 32px)',
  background: c.white,
  border: `1px solid ${c.border}`,
  borderRadius: 16,
  boxShadow: '0 24px 60px rgba(43,42,38,.24)',
  padding: 22,
  color: c.text,
}

const titleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  margin: 0,
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 22,
}

const ghostBtn: React.CSSProperties = {
  height: 38,
  padding: '0 16px',
  borderRadius: 9,
  border: `1px solid ${c.border}`,
  background: c.white,
  color: c.textMuted,
  fontWeight: 600,
  fontSize: 13.5,
  cursor: 'pointer',
  fontFamily: font.sans,
}

function primaryBtn(background: string): React.CSSProperties {
  return {
    height: 38,
    padding: '0 18px',
    borderRadius: 9,
    border: 'none',
    background,
    color: c.white,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: 'pointer',
    fontFamily: font.sans,
  }
}

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
    <div className="wm-overlay" style={overlayStyle} onMouseDown={onClose}>
      <div className="wm-card" style={cardStyle} onMouseDown={(e) => e.stopPropagation()}>
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
      <h2 style={titleStyle}>{title}</h2>
      <form onSubmit={submit}>
        <label
          style={{
            display: 'block',
            fontFamily: font.mono,
            fontSize: 10.5,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: c.textFaintest,
            margin: '18px 0 7px',
          }}
        >
          {label}
        </label>
        <input
          className="wm-input"
          autoFocus
          value={value}
          maxLength={100}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: '100%',
            height: 40,
            padding: '0 12px',
            borderRadius: 9,
            border: `1px solid ${c.border}`,
            background: c.panelBg,
            fontSize: 14,
            color: c.text,
            fontFamily: font.sans,
          }}
        />
        <div style={footerStyle}>
          <button type="button" className="wm-btn-ghost" style={ghostBtn} onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            className="wm-btn-primary"
            style={{ ...primaryBtn(accent.base), opacity: !trimmed || busy ? 0.6 : 1 }}
            disabled={!trimmed || busy}
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
      <h2 style={titleStyle}>{title}</h2>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: c.textBody, margin: '14px 0 0' }}>
        {message}
      </p>
      <div style={footerStyle}>
        <button type="button" className="wm-btn-ghost" style={ghostBtn} onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="wm-btn-danger"
          style={{ ...primaryBtn(c.danger), opacity: busy ? 0.6 : 1 }}
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
