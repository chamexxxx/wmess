import { useEffect, useRef, useState } from 'react'

interface AvatarCropperProps {
  file: File
  busy?: boolean
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

const MAX_VIEW = 400 // максимальная сторона отображаемой картинки (px)
const OUTPUT = 256 // размер итоговой картинки (px)
const MIN_SIZE = 48 // минимальный диаметр круга (px, в координатах отображения)

type Corner = 'tl' | 'tr' | 'bl' | 'br'
type DragMode = 'move' | Corner

interface Loaded {
  img: HTMLImageElement
  dw: number // отображаемая ширина
  dh: number // отображаемая высота
}

interface Crop {
  x: number
  y: number
  size: number // диаметр = сторона квадрата, в который вписан круг
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Кадрировщик аватарки: картинка показывается целиком, поверх — круг выделения,
 * который двигают и ресайзят за угловые маркеры. Итог вырезается в квадрат OUTPUT×OUTPUT.
 */
export function AvatarCropper({ file, busy, onCancel, onConfirm }: AvatarCropperProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, size: 0 })
  const areaRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: DragMode; px: number; py: number; start: Crop; rect: DOMRect } | null>(null)

  // Загрузка файла через FileReader (data URL): без object URL — нет гонок и ошибок
  // ERR_FILE_NOT_FOUND при повторном запуске эффекта в StrictMode.
  useEffect(() => {
    let cancelled = false
    const reader = new FileReader()
    reader.onload = () => {
      if (cancelled) return
      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        const scale = Math.min(MAX_VIEW / img.width, MAX_VIEW / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        const size = Math.min(dw, dh) // круг по умолчанию — во всю меньшую сторону
        setLoaded({ img, dw, dh })
        setCrop({ x: (dw - size) / 2, y: (dh - size) / 2, size })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    return () => {
      cancelled = true
    }
  }, [file])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!loaded || !areaRef.current) return
    e.stopPropagation()
    areaRef.current.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode: e.currentTarget.dataset.mode as DragMode,
      px: e.clientX,
      py: e.clientY,
      start: crop,
      rect: areaRef.current.getBoundingClientRect(),
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d || !loaded) return
    const px = e.clientX - d.rect.left
    const py = e.clientY - d.rect.top
    const { dw, dh } = loaded
    const s = d.start

    if (d.mode === 'move') {
      setCrop({
        x: clamp(s.x + (e.clientX - d.px), 0, dw - s.size),
        y: clamp(s.y + (e.clientY - d.py), 0, dh - s.size),
        size: s.size,
      })
      return
    }

    // Ресайз: противоположный угол зафиксирован, круг остаётся квадратным.
    if (d.mode === 'br') {
      const ax = s.x
      const ay = s.y
      const size = clamp(Math.max(px - ax, py - ay), MIN_SIZE, Math.min(dw - ax, dh - ay))
      setCrop({ x: ax, y: ay, size })
    } else if (d.mode === 'tl') {
      const ax = s.x + s.size
      const ay = s.y + s.size
      const size = clamp(Math.max(ax - px, ay - py), MIN_SIZE, Math.min(ax, ay))
      setCrop({ x: ax - size, y: ay - size, size })
    } else if (d.mode === 'tr') {
      const ax = s.x
      const ay = s.y + s.size
      const size = clamp(Math.max(px - ax, ay - py), MIN_SIZE, Math.min(dw - ax, ay))
      setCrop({ x: ax, y: ay - size, size })
    } else if (d.mode === 'bl') {
      const ax = s.x + s.size
      const ay = s.y
      const size = clamp(Math.max(ax - px, py - ay), MIN_SIZE, Math.min(ax, dh - ay))
      setCrop({ x: ax - size, y: ay, size })
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    dragRef.current = null
    if (areaRef.current?.hasPointerCapture(e.pointerId)) {
      areaRef.current.releasePointerCapture(e.pointerId)
    }
  }

  function handleConfirm() {
    if (!loaded) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const toSource = loaded.img.width / loaded.dw // отображение → исходные пиксели
    ctx.drawImage(
      loaded.img,
      crop.x * toSource,
      crop.y * toSource,
      crop.size * toSource,
      crop.size * toSource,
      0,
      0,
      OUTPUT,
      OUTPUT,
    )

    canvas.toBlob((blob) => blob && onConfirm(blob), 'image/jpeg', 0.9)
  }

  const handle =
    'absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-accent shadow-[0_1px_3px_rgba(0,0,0,.4)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-ui">
      <div className="bg-[#201f1c] rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,.55)] p-4 flex flex-col gap-4">
        {loaded && (
          <div
            ref={areaRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative select-none touch-none"
            style={{ width: loaded.dw, height: loaded.dh }}
          >
            {/* Картинка + затемнение вне круга (клипуется по размеру картинки). */}
            <div className="absolute inset-0 overflow-hidden rounded-xl">
              <img
                src={loaded.img.src}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: crop.x,
                  top: crop.y,
                  width: crop.size,
                  height: crop.size,
                  boxShadow: '0 0 0 2000px rgba(0,0,0,.55)',
                }}
              />
            </div>

            {/* Круг выделения: перетаскивание + угловые маркеры для ресайза. */}
            <div
              data-mode="move"
              onPointerDown={handlePointerDown}
              className="absolute rounded-full border-2 border-white/90 cursor-move"
              style={{ left: crop.x, top: crop.y, width: crop.size, height: crop.size }}
            >
              <div data-mode="tl" className={`${handle} -left-1.5 -top-1.5 cursor-nwse-resize`} onPointerDown={handlePointerDown} />
              <div data-mode="tr" className={`${handle} -right-1.5 -top-1.5 cursor-nesw-resize`} onPointerDown={handlePointerDown} />
              <div data-mode="bl" className={`${handle} -left-1.5 -bottom-1.5 cursor-nesw-resize`} onPointerDown={handlePointerDown} />
              <div data-mode="br" className={`${handle} -right-1.5 -bottom-1.5 cursor-nwse-resize`} onPointerDown={handlePointerDown} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-[38px] px-4 rounded-[10px] text-[13px] font-semibold text-white/80 cursor-pointer hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-default"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !loaded}
            className="h-[38px] px-5 rounded-[10px] bg-accent text-white font-semibold text-[13px] cursor-pointer hover:bg-accent-deep transition disabled:opacity-50 disabled:cursor-default"
          >
            {busy ? 'Загрузка…' : 'Готово'}
          </button>
        </div>
      </div>
    </div>
  )
}
