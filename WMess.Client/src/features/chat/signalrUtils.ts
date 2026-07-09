import type { AttachmentResponse, MessageResponse, ReactionResponse } from '../../api/generated/data-contracts'
import type { ChatMessage } from './types'

/** MessagePack отдаёт PascalCase; REST/JSON — camelCase. Нормализуем для store. */
export function normalizeMessageResponse(raw: Record<string, unknown>): ChatMessage {
  const attachments = (raw.attachments ?? raw.Attachments ?? []) as Record<string, unknown>[]
  const reactions = (raw.reactions ?? raw.Reactions ?? []) as Record<string, unknown>[]

  return {
    id: (raw.id ?? raw.Id) as MessageResponse['id'],
    chatId: (raw.chatId ?? raw.ChatId) as MessageResponse['chatId'],
    authorId: (raw.authorId ?? raw.AuthorId) as string,
    authorEmail: (raw.authorEmail ?? raw.AuthorEmail) as string | null | undefined,
    content: (raw.content ?? raw.Content) as string | null | undefined,
    parentMessageId: (raw.parentMessageId ?? raw.ParentMessageId) as MessageResponse['parentMessageId'],
    replyMode: (raw.replyMode ?? raw.ReplyMode) as ChatMessage['replyMode'],
    createdAt: (raw.createdAt ?? raw.CreatedAt) as string,
    editedAt: (raw.editedAt ?? raw.EditedAt) as string | null | undefined,
    transcription: (raw.transcription ?? raw.Transcription) as string | null | undefined,
    waveformData: (raw.waveformData ?? raw.WaveformData) as string | null | undefined,
    callRoomId: (raw.callRoomId ?? raw.CallRoomId) as string | null | undefined,
    callType: (raw.callType ?? raw.CallType) as string | null | undefined,
    attachments: attachments.map(
      (a): AttachmentResponse => ({
        id: (a.id ?? a.Id) as AttachmentResponse['id'],
        messageId: (a.messageId ?? a.MessageId) as AttachmentResponse['messageId'],
        fileName: (a.fileName ?? a.FileName) as string,
        contentType: (a.contentType ?? a.ContentType) as string,
        size: (a.size ?? a.Size) as AttachmentResponse['size'],
      }),
    ),
    reactions: reactions.map(
      (r): ReactionResponse => ({
        id: (r.id ?? r.Id) as ReactionResponse['id'],
        messageId: (r.messageId ?? r.MessageId) as ReactionResponse['messageId'],
        userId: (r.userId ?? r.UserId) as string,
        emoji: (r.emoji ?? r.Emoji) as string,
        createdAt: (r.createdAt ?? r.CreatedAt) as string,
      }),
    ),
    inlineEntities: (raw.inlineEntities ?? raw.InlineEntities ?? []) as MessageResponse['inlineEntities'],
  }
}
