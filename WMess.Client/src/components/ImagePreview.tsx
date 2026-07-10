import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '../api'
import { ChevronRightIcon } from '../workspace/icons'

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico', 'jfif'])

// Определяет изображение по расширению из имени файла (title хранится с расширением).
export function isImageFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return IMAGE_EXT.has(name.slice(dot + 1).toLowerCase())
}

export interface PreviewImage {
  id: number
  title: string
}

interface ImagePreviewProps {
  images: PreviewImage[]
  index: number
  onClose: () => void
}

/**
 * Модалка-галерея для просмотра изображений папки. Тянет байты через axios (blob → object URL),
 * чтобы работали авторизация и refresh. Навигация: стрелки по бокам, клавиши ←/→ (по кругу).
 * Закрытие — клик по фону, крестик или Esc.
 */
export function ImagePreview({ images, index, onClose }: ImagePreviewProps) {
  const [current, setCurrent] = useState(index)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const urlRef = useRef<string | null>(null)

  const item = images[current]
  const many = images.length > 1

  const go = useCallback(
    (delta: number) => setCurrent((c) => (c + delta + images.length) % images.length),
    [images.length],
  )

  // Загрузка байтов текущего изображения. НЕ обнуляем url заранее — прежняя картинка
  // остаётся на экране, пока грузится новая, и плавно подменяется (без мигания «Загрузка…»).
  useEffect(() => {
    if (!item) return
    let cancelled = false
    setFailed(false)
    apiClient
      .fetchLibraryFile(item.id)
      .then((blob) => {
        if (cancelled) return
        const next = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = next
        setUrl(next)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [item])

  // Освобождаем последний object URL при закрытии просмотрщика.
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  // Клавиатура: Esc — закрыть, ←/→ — навигация.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && many) go(-1)
      else if (e.key === 'ArrowRight' && many) go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, go, many])

  if (!item) return null

  const navBtn =
    'absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 cursor-pointer'

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-6"
    >
      {/* Управление — закреплено в правом верхнем углу экрана */}
      <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => apiClient.downloadLibraryFile(item.id, item.title)}
          className="h-8 px-3 rounded-md bg-white/15 text-white text-[12.5px] font-medium hover:bg-white/25 cursor-pointer"
        >
          Скачать
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-8 px-3 rounded-md bg-white/15 text-white text-[12.5px] font-medium hover:bg-white/25 cursor-pointer"
        >
          Закрыть
        </button>
      </div>

      {/* Стрелки навигации по папке */}
      {many && (
        <>
          <button
            type="button"
            aria-label="Предыдущее"
            className={`${navBtn} left-4`}
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
          >
            <span className="rotate-180">
              <ChevronRightIcon size={22} />
            </span>
          </button>
          <button
            type="button"
            aria-label="Следующее"
            className={`${navBtn} right-4`}
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
          >
            <ChevronRightIcon size={22} />
          </button>
        </>
      )}

      {/* Картинка по центру + подпись под ней */}
      <div
        className="flex flex-col items-center gap-3 max-w-[80vw] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {failed ? (
          <div className="text-white/80 text-sm">Не удалось загрузить изображение</div>
        ) : url ? (
          <>
            <img
              key={url}
              src={url}
              alt={item.title}
              className="max-w-[80vw] max-h-[78vh] object-contain rounded-lg shadow-[0_20px_60px_rgba(0,0,0,.5)] animate-[wmFade_.2s_ease]"
            />
            <span className="max-w-[80vw] truncate text-white/90 text-[15px] font-medium">
              {item.title}
              {many && <span className="text-white/50 font-normal"> · {current + 1} из {images.length}</span>}
            </span>
          </>
        ) : (
          <div className="text-white/70 text-sm">Загрузка…</div>
        )}
      </div>
    </div>
  )
}
