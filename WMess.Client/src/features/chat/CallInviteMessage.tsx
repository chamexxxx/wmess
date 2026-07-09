import { useState } from 'react'
import type { MessageResponse } from '../../api/generated/data-contracts'
import { JitsiEmbed } from './JitsiEmbed'

interface Props {
  message: MessageResponse
}

export function CallInviteMessage({ message }: Props) {
  const [open, setOpen] = useState(false)
  const roomId = message.callRoomId ?? ''
  const isVideo = message.callType !== 'audio'

  return (
    <div className="inline-flex flex-col gap-2 p-4 rounded-xl bg-accent-soft border border-accent/20 max-w-sm">
      <div className="font-semibold text-sm text-ink">
        {isVideo ? '📹 Видеозвонок' : '📞 Аудиозвонок'}
      </div>
      <div className="text-xs text-muted">{message.content}</div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 px-4 rounded-lg bg-accent text-white text-sm font-semibold cursor-pointer hover:bg-accent-deep"
      >
        Присоединиться
      </button>
      {open && roomId && (
        <JitsiEmbed roomId={roomId} isVideo={isVideo} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}
