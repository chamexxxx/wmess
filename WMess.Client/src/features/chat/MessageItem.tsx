import type { MessageResponse } from '../../api/generated/data-contracts'
import { MessageAttachments } from './MessageAttachments'
import { VoicePlayer } from './VoicePlayer'
import { ReactionBar } from './ReactionBar'
import { CallInviteMessage } from './CallInviteMessage'
import { UserAvatar } from './UserAvatar'

function formatTime(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
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
  onQuote: () => void
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
  canManage,
  inThread = false,
  threadRootId,
  threadReplyCount = 0,
  onReply,
  onQuote,
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
      className={`group py-2 hover:bg-hovered/40 px-3 rounded-lg -mx-3 ${canOpenThread ? 'cursor-pointer' : ''}`}
      id={`msg-${message.id}`}
      onClick={(e) => {
        if (!canOpenThread || isInteractiveTarget(e.target)) return
        onOpenThread()
      }}
    >
      <div className="flex gap-3">
        <UserAvatar name={message.authorEmail} userId={message.authorId} size={36} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm text-ink">{message.authorEmail ?? 'Пользователь'}</span>
            <span className="text-[11px] text-faint">{formatTime(message.createdAt)}</span>
            {message.editedAt && <span className="text-[10px] text-faint">(ред.)</span>}
            {isPinned && <span className="text-[10px] text-accent">📌</span>}
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
              ↩ {parent.authorEmail}: {parent.content?.slice(0, 80) ?? '…'}
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

          <div
            className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[11px]"
            data-no-thread
          >
            <button type="button" onClick={onReply} className="text-muted hover:text-accent cursor-pointer">
              Ответить
            </button>
            <button type="button" onClick={onQuote} className="text-muted hover:text-accent cursor-pointer">
              Цитировать
            </button>
            {isOwn && (message.content || isVoiceMessage) && (
              <button type="button" onClick={onEdit} className="text-muted hover:text-accent cursor-pointer">
                {isVoiceMessage && !message.content ? 'Подпись' : 'Изменить'}
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={isPinned ? onUnpin : onPin}
                className="text-muted hover:text-accent cursor-pointer"
              >
                {isPinned ? 'Открепить' : 'Закрепить'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
