import { useState } from 'react'
import type { AttachmentResponse } from '../../api/generated/data-contracts'
import { attachmentUrl, downloadAttachment, fetchAttachmentBlob } from './chatApi'
import { ImagePreview, type PreviewImage } from '../../components/ImagePreview'

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
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  if (!attachments.length) return null

  // Галерея изображений сообщения — для просмотрщика (навигация ←/→ по картинкам).
  const imageAttachments = attachments.filter((a) => isImage(a.contentType))
  const gallery: PreviewImage[] = imageAttachments.map((a) => ({
    id: Number(a.id),
    title: a.fileName ?? '',
  }))

  return (
    <div className="flex flex-col gap-2 mt-2">
      {attachments.map((a) => {
        const id = Number(a.id)
        const url = attachmentUrl(id)
        if (isImage(a.contentType)) {
          const galleryIndex = imageAttachments.findIndex((img) => Number(img.id) === id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPreviewIndex(galleryIndex)}
              className="block max-w-full sm:max-w-sm mt-1 cursor-zoom-in"
            >
              <img
                src={url}
                alt={a.fileName}
                className="rounded-lg max-h-64 max-w-full object-contain bg-tile"
                loading="lazy"
              />
            </button>
          )
        }
        if (isVideo(a.contentType)) {
          return (
            <video
              key={id}
              src={url}
              controls
              className="rounded-lg max-w-full sm:max-w-md max-h-64 mt-1"
            />
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

      {previewIndex !== null && gallery[previewIndex] && (
        <ImagePreview
          images={gallery}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          fetchBlob={fetchAttachmentBlob}
          onDownload={(img) => downloadAttachment(img.id, img.title)}
        />
      )}
    </div>
  )
}

export { isAudio, isImage, isVideo }
