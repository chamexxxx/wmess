import { useEffect, useState } from 'react'
import type { MessageResponse } from '../../api/generated/data-contracts'
import type { ReplyTarget } from '../../store/chatStore'
import { AttachmentUpload } from './AttachmentUpload'
import { VoiceRecorder } from './VoiceRecorder'

interface Props {
  replyTarget: ReplyTarget | null
  quoteTarget: MessageResponse | null
  editTarget?: MessageResponse | null
  onSend: (text: string, files: File[], voiceWaveform?: string) => Promise<void>
  onSaveEdit?: (text: string) => Promise<void>
  onTyping: () => void
  onClearReply: () => void
  onClearQuote: () => void
  onClearEdit?: () => void
  disabled?: boolean
}

export function MessageInput({
  replyTarget,
  quoteTarget,
  editTarget = null,
  onSend,
  onSaveEdit,
  onTyping,
  onClearReply,
  onClearQuote,
  onClearEdit,
  disabled,
}: Props) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [voiceWaveform, setVoiceWaveform] = useState<string | undefined>()
  const [sending, setSending] = useState(false)

  const isEditing = editTarget != null
  const editingVoice = isEditing && (editTarget.attachments ?? []).some((a) => a.contentType?.startsWith('audio/'))

  useEffect(() => {
    if (editTarget) {
      setText(editTarget.content ?? '')
      setFiles([])
      setVoiceWaveform(undefined)
    }
  }, [editTarget])

  const handleSubmit = async () => {
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
      onClearQuote()
    } finally {
      setSending(false)
    }
  }

  const preview = !isEditing && quoteTarget
    ? `> ${quoteTarget.authorEmail}: ${quoteTarget.content?.slice(0, 120) ?? ''}\n\n`
    : ''

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
      {!isEditing && quoteTarget && (
        <div className="flex items-center justify-between mb-2 px-3 py-2 bg-accent-soft/50 rounded-lg text-xs border-l-2 border-accent">
          <span className="text-muted truncate">Цитата: {quoteTarget.content?.slice(0, 60)}</span>
          <button type="button" onClick={onClearQuote} className="text-faint hover:text-ink cursor-pointer ml-2">
            ✕
          </button>
        </div>
      )}
      {!isEditing && files.length > 0 && (
        <div className="text-xs text-muted mb-2">
          Файлов: {files.length}
          <button type="button" onClick={() => setFiles([])} className="ml-2 text-accent cursor-pointer">
            очистить
          </button>
        </div>
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
                    onClearQuote()
                  } finally {
                    setSending(false)
                  }
                })()
              }}
            />
          </>
        )}
        <textarea
          value={preview + text}
          onChange={(e) => {
            const v = e.target.value
            setText(!isEditing && quoteTarget ? v.slice(preview.length) : v)
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
          rows={2}
          disabled={disabled || sending}
          className="flex-1 resize-none rounded-lg border border-line px-3 py-2 text-sm bg-app text-ink focus:outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={disabled || sending || (isEditing ? !editingVoice && !text.trim() : !text.trim() && files.length === 0)}
          onClick={() => void handleSubmit()}
          className="h-10 px-4 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-40 cursor-pointer hover:bg-accent-deep"
        >
          {isEditing ? '✓' : '→'}
        </button>
      </div>
    </div>
  )
}
