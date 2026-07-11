import { useEffect, useRef, useState } from 'react'
import type { MessageResponse } from '../../api/generated/data-contracts'
import type { ReplyTarget } from '../../store/chatStore'
import { AttachmentUpload } from './AttachmentUpload'
import { VoiceRecorder } from './VoiceRecorder'
import { CheckIcon, SendIcon } from '../../workspace/icons'

const MAX_INPUT_HEIGHT = 160

interface Props {
  replyTarget: ReplyTarget | null
  editTarget?: MessageResponse | null
  onSend: (text: string, files: File[], voiceWaveform?: string) => Promise<void>
  onSaveEdit?: (text: string) => Promise<void>
  onTyping: () => void
  onClearReply: () => void
  onClearEdit?: () => void
  disabled?: boolean
}

function FilePreview({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f))
    setUrls(next)
    return () => next.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  if (!files.length) return null

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map((file, i) => {
        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        return (
          <div
            key={`${file.name}-${file.size}-${i}`}
            className="relative group rounded-lg border border-line bg-tile overflow-hidden w-20 h-20 shrink-0"
          >
            {isImage && urls[i] ? (
              <img src={urls[i]} alt={file.name} className="w-full h-full object-cover" />
            ) : isVideo && urls[i] ? (
              <video src={urls[i]} className="w-full h-full object-cover" muted />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center">
                <span className="text-lg">📎</span>
                <span className="text-[9px] text-muted truncate w-full px-0.5">{file.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-ink/70 text-white text-xs leading-none cursor-pointer opacity-0 group-hover:opacity-100"
              title="Убрать"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function MessageInput({
  replyTarget,
  editTarget = null,
  onSend,
  onSaveEdit,
  onTyping,
  onClearReply,
  onClearEdit,
  disabled,
}: Props) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [voiceWaveform, setVoiceWaveform] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isEditing = editTarget != null
  const editingVoice = isEditing && (editTarget.attachments ?? []).some((a) => a.contentType?.startsWith('audio/'))

  // Авто-высота как в Telegram: одна строка, растёт с текстом до предела, дальше — скролл.
  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }

  useEffect(() => {
    autoResize()
  }, [text])

  useEffect(() => {
    if (editTarget) {
      setText(editTarget.content ?? '')
      setFiles([])
      setVoiceWaveform(undefined)
      textareaRef.current?.focus()
    }
  }, [editTarget])

  const restoreFocus = () => {
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleSubmit = async () => {
    if (sending) return
    const trimmed = text.trim()
    if (isEditing) {
      if (!onSaveEdit) return
      if (!trimmed && !editingVoice) return
      setSending(true)
      try {
        await onSaveEdit(trimmed)
        setText('')
        onClearEdit?.()
      } finally {
        setSending(false)
        restoreFocus()
      }
      return
    }

    if (!trimmed && files.length === 0) return
    setSending(true)
    try {
      await onSend(trimmed, files, voiceWaveform)
      setText('')
      setFiles([])
      setVoiceWaveform(undefined)
      onClearReply()
    } finally {
      setSending(false)
      restoreFocus()
    }
  }

  return (
    <div className="border-t border-line p-3 bg-panel shrink-0">
      {isEditing && (
        <div className="flex items-center justify-between mb-2 px-3 py-2 bg-tile rounded-lg text-xs border-l-2 border-accent">
          <span className="text-muted truncate">
            {editingVoice ? 'Подпись к голосовому сообщению' : 'Редактирование сообщения'}
          </span>
          <button type="button" onClick={onClearEdit} className="text-faint hover:text-ink cursor-pointer ml-2">
            ✕
          </button>
        </div>
      )}
      {!isEditing && replyTarget && (
        <div className="flex items-center justify-between mb-2 px-3 py-2 bg-tile rounded-lg text-xs">
          <span className="text-muted truncate">
            {replyTarget.mode === 'Thread' ? 'Ответ в тред' : 'Ответ'}:{' '}
            {replyTarget.message.content?.slice(0, 60) ?? '…'}
          </span>
          <button type="button" onClick={onClearReply} className="text-faint hover:text-ink cursor-pointer ml-2">
            ✕
          </button>
        </div>
      )}
      {!isEditing && (
        <FilePreview
          files={files}
          onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
        />
      )}
      <div className="flex items-end gap-2">
        {!isEditing && (
          <>
            <AttachmentUpload onFiles={(f) => setFiles((prev) => [...prev, ...f])} disabled={disabled || sending} />
            <VoiceRecorder
              disabled={disabled || sending}
              onRecorded={(file, wf) => {
                void (async () => {
                  setSending(true)
                  try {
                    await onSend('', [file], wf)
                    onClearReply()
                  } finally {
                    setSending(false)
                    restoreFocus()
                  }
                })()
              }}
            />
          </>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (!isEditing) onTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSubmit()
            }
            if (e.key === 'Escape' && isEditing) {
              e.preventDefault()
              setText(editTarget?.content ?? '')
              onClearEdit?.()
            }
          }}
          placeholder={
            isEditing
              ? editingVoice
                ? 'Подпись к голосовому…'
                : 'Изменить сообщение…'
              : 'Написать сообщение…'
          }
          rows={1}
          disabled={disabled}
          style={{ maxHeight: MAX_INPUT_HEIGHT }}
          className="flex-1 resize-none overflow-y-auto rounded-lg border border-line px-3 py-2 text-sm leading-5 bg-app text-ink focus:outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={disabled || sending || (isEditing ? !editingVoice && !text.trim() : !text.trim() && files.length === 0)}
          onClick={() => void handleSubmit()}
          title={isEditing ? 'Сохранить' : 'Отправить'}
          className="w-10 h-10 shrink-0 rounded-lg bg-accent text-white flex items-center justify-center disabled:opacity-40 cursor-pointer hover:bg-accent-deep"
        >
          {isEditing ? <CheckIcon size={18} /> : <SendIcon size={18} />}
        </button>
      </div>
    </div>
  )
}
