import axios from 'axios'
import type { MessageResponse } from '../../api/generated/data-contracts'

export type ReplyMode = 'Thread' | 'Flat'

export interface SendMessagePayload {
  content?: string | null
  parentMessageId?: number | null
  replyMode?: ReplyMode | null
}

const api = axios.create({
  withCredentials: true,
  headers: { 'X-CSRF': '1' },
})

export async function getCurrentUserId(): Promise<string> {
  const res = await api.get<{ id: string }>('/api/user/me')
  return res.data.id
}

export async function sendTextMessage(
  chatId: number,
  payload: SendMessagePayload,
): Promise<MessageResponse> {
  const res = await api.post<MessageResponse>(`/api/chats/${chatId}/messages`, payload)
  return res.data
}

export async function sendMessageWithFiles(
  chatId: number,
  payload: SendMessagePayload,
  files: File[],
): Promise<MessageResponse> {
  const form = new FormData()
  if (payload.content) form.append('content', payload.content)
  if (payload.parentMessageId != null) {
    form.append('parentMessageId', String(payload.parentMessageId))
  }
  if (payload.replyMode) form.append('replyMode', payload.replyMode)
  for (const file of files) {
    form.append('files', file)
  }
  const res = await api.post<MessageResponse>(`/api/chats/${chatId}/messages`, form)
  return res.data
}

export function attachmentUrl(attachmentId: number): string {
  return `/api/chats/attachments/${attachmentId}`
}

export async function fetchAttachmentBlob(attachmentId: number): Promise<Blob> {
  const res = await api.get<Blob>(`/api/chats/attachments/${attachmentId}`, {
    responseType: 'blob',
  })
  return res.data
}
