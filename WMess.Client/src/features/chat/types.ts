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

export function isFlatReply(msg: ChatMessage): boolean {
  const mode = msg.replyMode
  return mode === 'Flat' || mode === 1
}

export function belongsToThread(
  msg: ChatMessage,
  threadMessageIds: ReadonlySet<number>,
  rootId: number,
): boolean {
  if (isThreadMessage(msg) && threadRootId(msg) === rootId) return true
  if (!isFlatReply(msg) || msg.parentMessageId == null) return false
  const parentId = Number(msg.parentMessageId)
  if (parentId === rootId) return false
  return threadMessageIds.has(parentId)
}
