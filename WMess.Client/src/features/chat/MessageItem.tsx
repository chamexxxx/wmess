import type { MessageResponse } from '../../api/generated/data-contracts'
import { Avatar } from '../../components/Avatar'
import { MessageAttachments } from './MessageAttachments'
import { VoicePlayer } from './VoicePlayer'
import { QUICK_EMOJIS, ReactionBar } from './ReactionBar'
import { CallInviteMessage } from './CallInviteMessage'

function formatTime(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return timeStr

  return `${date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${timeStr}`
}

function displayName(name?: string | null, email?: string | null): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  if (email) return email.split('@')[0] || email
  return 'Пользователь'
}

function hasAudioAttachment(message: MessageResponse): boolean {
  return (message.attachments ?? []).some((a) => a.contentType?.startsWith('audio/'))
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean(
    (target as HTMLElement | null)?.closest(
      'button, a, video, audio, input, textarea, [data-no-thread]',
    ),
  )
}

interface Props {
  message: MessageResponse
  parent?: MessageResponse | null
  currentUserId: string
  canManage: boolean
  inThread?: boolean
  threadRootId?: number
  threadReplyCount?: number
  onReply: () => void
  onOpenThread: () => void
  onReaction: (emoji: string) => void
  onPin: () => void
  onUnpin: () => void
  onEdit: () => void
  onScrollTo: (id: number) => void
  isPinned: boolean
}

export function MessageItem({
  message,
  parent,
  currentUserId,
  canManage: _canManage,
  inThread = false,
  threadRootId,
  threadReplyCount = 0,
  onReply,
  onOpenThread,
  onReaction,
  onPin,
  onUnpin,
  onEdit,
  onScrollTo,
  isPinned,
}: Props) {
  const isOwn = message.authorId === currentUserId
  const isCall = Boolean(message.callRoomId)
  const isVoiceMessage = hasAudioAttachment(message)
  const canOpenThread = !inThread && !parent
  const authorLabel = displayName(message.authorName, message.authorEmail)
  const showParentReply =
    parent != null && (!inThread || (threadRootId != null && Number(parent.id) !== threadRootId))

  if (isCall) {
    return (
      <div className="group py-2">
        <CallInviteMessage message={message} />
      </div>
    )
  }

  return (
    <div
      className={`group relative py-1 hover:bg-hovered/40 px-3 rounded-lg -mx-3 ${canOpenThread ? 'cursor-pointer' : ''}`}
      id={`msg-${message.id}`}
      onClick={(e) => {
        if (!canOpenThread || isInteractiveTarget(e.target)) return
        onOpenThread()
      }}
    >
      {/* Плавающая панель действий — не занимает высоту, появляется по наведению */}
      <div
        data-no-thread
        className="absolute -top-2 right-3 z-10 hidden group-hover:flex items-center gap-0.5 rounded-lg border border-line bg-panel px-1 py-0.5 shadow-sm"
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReaction(emoji)}
            className="w-6 h-6 rounded-md text-sm hover:bg-hovered cursor-pointer"
            title={`Реакция ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <span className="mx-0.5 w-px h-4 bg-line" />
        <button
          type="button"
          onClick={onReply}
          className="px-1.5 h-6 rounded-md text-[11px] text-muted hover:bg-hovered hover:text-ink cursor-pointer"
        >
          Ответить
        </button>
        {isOwn && (message.content || isVoiceMessage) && (
          <button
            type="button"
            onClick={onEdit}
            className="px-1.5 h-6 rounded-md text-[11px] text-muted hover:bg-hovered hover:text-ink cursor-pointer"
          >
            {isVoiceMessage && !message.content ? 'Подпись' : 'Изменить'}
          </button>
        )}
        <button
          type="button"
          onClick={isPinned ? onUnpin : onPin}
          className="px-1.5 h-6 rounded-md text-[11px] text-muted hover:bg-hovered hover:text-ink cursor-pointer"
        >
          {isPinned ? 'Открепить' : 'Закрепить'}
        </button>
      </div>

      <div className="flex gap-3 min-w-0">
        <Avatar
          userId={message.authorId}
          name={authorLabel}
          hasAvatar={message.authorHasAvatar}
          size={36}
          className="shrink-0"
        />

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm text-ink truncate">{authorLabel}</span>
            <span className="text-[11px] text-faint shrink-0">{formatTime(message.createdAt)}</span>
            {message.editedAt && <span className="text-[10px] text-faint shrink-0">(ред.)</span>}
            {isPinned && <span className="text-[10px] text-accent shrink-0">📌</span>}
          </div>

          {showParentReply && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onScrollTo(Number(parent.id))
              }}
              className="mt-1 mb-1 pl-3 border-l-2 border-accent text-xs text-muted text-left cursor-pointer hover:text-ink max-w-full truncate block"
            >
              ↩ {displayName(parent.authorName, parent.authorEmail)}: {parent.content?.slice(0, 80) ?? '…'}
            </button>
          )}

          {message.content && (
            <div className="text-sm text-ink whitespace-pre-wrap break-words mt-0.5">{message.content}</div>
          )}

          {message.transcription && (
            <div className="text-xs text-muted mt-1 italic">📝 {message.transcription}</div>
          )}

          <MessageAttachments attachments={message.attachments ?? []} />
          {(message.attachments ?? [])
            .filter((a) => a.contentType?.startsWith('audio/'))
            .map((a) => (
              <div key={a.id} className="mt-2">
                <VoicePlayer attachment={a} waveformData={message.waveformData} />
              </div>
            ))}

          {canOpenThread && threadReplyCount > 0 && (
            <div className="mt-1 text-xs text-muted">
              💬 {threadReplyCount}{' '}
              {threadReplyCount === 1 ? 'ответ' : threadReplyCount < 5 ? 'ответа' : 'ответов'} в треде
            </div>
          )}

          <ReactionBar message={message} currentUserId={currentUserId} onToggle={onReaction} />
        </div>
      </div>
    </div>
  )
}
