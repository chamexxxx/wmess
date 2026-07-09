import { useEffect, useRef, useState } from 'react'

interface AvatarCropperProps {
  file: File
  busy?: boolean
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

const VIEW = 300 // размер квадратной области кадрирования (px)
const OUTPUT = 256 // размер итоговой картинки (px)

interface Loaded {
  img: HTMLImageElement
  baseScale: number // масштаб, при котором картинка покрывает область (zoom = 1)
}

/**
 * Модальный кадрировщик аватарки: пользователь двигает и масштабирует картинку
 * внутри круга, затем результат вырезается в квадрат OUTPUT×OUTPUT и отдаётся как blob.
 */
export function AvatarCropper({ file, busy, onCancel, onConfirm }: AvatarCropperProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  // Загрузка выбранного файла в объект Image (setState — в колбэке onload, не в теле эффекта).
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const baseScale = Math.max(VIEW / img.width, VIEW / img.height)
      const dw = img.width * baseScale
      const dh = img.height * baseScale
      setLoaded({ img, baseScale })
      setZoom(1)
      setOffset({ x: (VIEW - dw) / 2, y: (VIEW - dh) / 2 }) // по центру
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const scale = loaded ? loaded.baseScale * zoom : 1
  const dw = loaded ? loaded.img.width * scale : 0
  const dh = loaded ? loaded.img.height * scale : 0

  // Ограничиваем смещение так, чтобы круг всегда был покрыт картинкой.
  function clamp(x: number, y: number, w: number, h: number) {
    return {
      x: Math.min(0, Math.max(VIEW - w, x)),
      y: Math.min(0, Math.max(VIEW - h, y)),
    }
  }

  function changeZoom(nextZoom: number) {
    if (!loaded) return
    const nextScale = loaded.baseScale * nextZoom
    // Держим точку в центре круга на месте при зуме.
    const cxImg = (VIEW / 2 - offset.x) / scale
    const cyImg = (VIEW / 2 - offset.y) / scale
    const nx = VIEW / 2 - cxImg * nextScale
    const ny = VIEW / 2 - cyImg * nextScale
    setZoom(nextZoom)
    setOffset(clamp(nx, ny, loaded.img.width * nextScale, loaded.img.height * nextScale))
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!loaded) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    setOffset(clamp(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py), dw, dh))
  }

  function onPointerUp(e: React.PointerEvent) {
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function handleConfirm() {
    if (!loaded) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Область круга в координатах исходной картинки.
    const sSize = VIEW / scale
    const sx = -offset.x / scale
    const sy = -offset.y / scale
    ctx.drawImage(loaded.img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT)

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob)
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 font-ui">
      <div className="bg-white border border-line rounded-2xl shadow-[0_24px_60px_rgba(43,42,38,.2)] p-6 animate-[wmPop_.14s_ease]">
        <h2 className="text-[17px] font-extrabold tracking-[-.3px] text-ink mb-4 text-center">
          Кадрирование
        </h2>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="relative overflow-hidden rounded-lg bg-[#1c1b19] cursor-grab active:cursor-grabbing select-none touch-none"
          style={{ width: VIEW, height: VIEW }}
        >
          {loaded && (
            <img
              src={loaded.img.src}
              alt=""
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{ left: offset.x, top: offset.y, width: dw, height: dh }}
            />
          )}
          {/* Затемнение вне круга + белое кольцо. */}
          <div
            className="absolute inset-0 pointer-events-none rounded-full"
            style={{ boxShadow: '0 0 0 2000px rgba(0,0,0,.5)', outline: '2px solid rgba(255,255,255,.85)' }}
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <span className="text-[12px] text-faint">−</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            className="flex-1 accent-accent cursor-pointer"
          />
          <span className="text-[12px] text-faint">+</span>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-[38px] px-4 rounded-[10px] border border-line bg-panel text-sm font-medium text-ink cursor-pointer hover:bg-hovered disabled:opacity-50 disabled:cursor-default"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !loaded}
            className="h-[38px] px-5 rounded-[10px] bg-accent text-white font-semibold text-sm cursor-pointer hover:bg-accent-deep disabled:opacity-50 disabled:cursor-default"
          >
            {busy ? 'Загрузка…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
