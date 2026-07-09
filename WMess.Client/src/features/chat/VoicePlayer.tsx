import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAttachmentBlob } from './chatApi'
import type { AttachmentResponse } from '../../api/generated/data-contracts'

interface Props {
  attachment: AttachmentResponse
  waveformData?: string | null
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const total = Math.floor(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function parsePeaks(waveformData?: string | null): number[] | null {
  if (!waveformData) return null
  try {
    const parsed = JSON.parse(waveformData) as number[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5h4v14H7V5zm6 0h4v14h-4V5z" />
    </svg>
  )
}

/** Считает пики амплитуды из AudioBuffer для WaveformData. */
export async function computeWaveformPeaks(blob: Blob, bars = 48): Promise<number[]> {
  const ctx = new AudioContext()
  try {
    const buffer = await blob.arrayBuffer()
    const audio = await ctx.decodeAudioData(buffer)
    const channel = audio.getChannelData(0)
    const block = Math.max(1, Math.floor(channel.length / bars))
    const peaks: number[] = []
    for (let i = 0; i < bars; i++) {
      let max = 0
      const start = i * block
      for (let j = 0; j < block; j++) {
        const v = Math.abs(channel[start + j] ?? 0)
        if (v > max) max = v
      }
      peaks.push(max)
    }
    return peaks
  } finally {
    await ctx.close()
  }
}

export function VoicePlayer({ attachment, waveformData }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [peaks, setPeaks] = useState<number[]>([])

  useEffect(() => {
    let cancelled = false
    const audio = new Audio()
    audioRef.current = audio

    void (async () => {
      try {
        const blob = await fetchAttachmentBlob(Number(attachment.id))
        if (cancelled) return

        const stored = parsePeaks(waveformData)
        const bars = stored ?? (await computeWaveformPeaks(blob))
        if (cancelled) return
        setPeaks(bars)

        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        audio.src = url
        audio.preload = 'metadata'
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    const onLoaded = () => {
      if (!cancelled && Number.isFinite(audio.duration)) {
        setDuration(audio.duration)
        setReady(true)
      }
    }
    const onTimeUpdate = () => {
      if (!cancelled) setCurrentTime(audio.currentTime)
    }
    const onEnded = () => {
      if (!cancelled) {
        setPlaying(false)
        setCurrentTime(0)
      }
    }
    const onError = () => {
      if (!cancelled) setFailed(true)
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      cancelled = true
      audio.pause()
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audioRef.current = null
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [attachment.id, waveformData])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !ready) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      void audio.play()
      setPlaying(true)
    }
  }, [playing, ready])

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current
      if (!audio || !ready || duration <= 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      audio.currentTime = ratio * duration
      setCurrentTime(audio.currentTime)
    },
    [duration, ready],
  )

  const progress = duration > 0 ? currentTime / duration : 0
  const timeLabel = playing
    ? formatDuration(Math.max(0, duration - currentTime))
    : formatDuration(duration)

  const maxPeak = Math.max(...peaks, 0.001)

  return (
    <div
      className="inline-flex items-center gap-3 rounded-2xl bg-accent-soft/70 border border-accent/20 px-3 py-2.5 max-w-[min(100%,300px)] select-none"
      data-no-thread
    >
      <button
        type="button"
        disabled={!ready || failed}
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-accent-deep transition-colors disabled:opacity-40 shadow-sm"
        title={failed ? 'Не удалось загрузить' : playing ? 'Пауза' : 'Воспроизвести'}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {failed ? (
          <span className="text-xs text-muted">Голосовое недоступно</span>
        ) : (
          <div
            className={`flex items-center gap-[2px] h-9 ${ready ? 'cursor-pointer' : 'opacity-50'}`}
            onClick={seek}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            aria-label="Прогресс воспроизведения"
          >
            {(peaks.length > 0 ? peaks : Array.from({ length: 32 }, () => 0.15)).map((peak, i) => {
              const barProgress = (i + 1) / (peaks.length || 32)
              const active = barProgress <= progress
              const height = Math.max(4, Math.round((peak / maxPeak) * 28))
              return (
                <div
                  key={i}
                  className={`w-[3px] rounded-full transition-colors ${
                    active ? 'bg-accent' : 'bg-accent/25'
                  }`}
                  style={{ height }}
                />
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-end text-[10px] text-muted leading-none">
          <span className="font-mono tabular-nums text-ink-soft">
            {ready ? timeLabel : '--:--'}
          </span>
        </div>
      </div>
    </div>
  )
}
