import type { AttachmentResponse } from '../../api/generated/data-contracts'
import { attachmentUrl } from './chatApi'

function isImage(ct?: string) {
  return ct?.startsWith('image/') ?? false
}

function isVideo(ct?: string) {
  return ct?.startsWith('video/') ?? false
}

function isAudio(ct?: string) {
  return ct?.startsWith('audio/') ?? false
}

interface Props {
  attachments: AttachmentResponse[]
  onVoiceRecorded?: (attachmentId: number, waveform: string) => void
}

export function MessageAttachments({ attachments }: Props) {
  if (!attachments.length) return null

  return (
    <div className="flex flex-col gap-2 mt-2">
      {attachments.map((a) => {
        const id = Number(a.id)
        const url = attachmentUrl(id)
        if (isImage(a.contentType)) {
          return (
            <a key={id} href={url} target="_blank" rel="noreferrer" className="block max-w-sm">
              <img src={url} alt={a.fileName} className="rounded-lg max-h-64 object-cover" />
            </a>
          )
        }
        if (isVideo(a.contentType)) {
          return (
            <video key={id} src={url} controls className="rounded-lg max-w-md max-h-64" />
          )
        }
        if (isAudio(a.contentType)) {
          return null
        }
        return (
          <a
            key={id}
            href={url}
            download={a.fileName}
            className="text-accent text-sm hover:underline"
          >
            📎 {a.fileName}
          </a>
        )
      })}
    </div>
  )
}

export { isAudio, isImage, isVideo }
