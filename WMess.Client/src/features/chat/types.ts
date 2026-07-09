import type { MessageResponse } from '../../api/generated/data-contracts'

export type ChatMessage = MessageResponse & {
  replyMode?: 'Thread' | 'Flat' | number | null
}

export function isThreadMessage(msg: ChatMessage): boolean {
  const mode = msg.replyMode
  return mode === 'Thread' || mode === 0
}

export function threadRootId(msg: ChatMessage): number | null {
  if (!isThreadMessage(msg)) return null
  return msg.parentMessageId != null ? Number(msg.parentMessageId) : null
}
