import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { attachmentUrl } from './chatApi'
import type { AttachmentResponse } from '../../api/generated/data-contracts'

interface Props {
  attachment: AttachmentResponse
  waveformData?: string | null
}

export function VoicePlayer({ attachment, waveformData }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#c4b5fd',
      progressColor: '#7c3aed',
      height: 48,
      barWidth: 2,
      cursorWidth: 0,
    })
    wsRef.current = ws

    const url = attachmentUrl(Number(attachment.id))
    void ws.load(url)

    if (waveformData) {
      try {
        const peaks = JSON.parse(waveformData) as number[]
        if (Array.isArray(peaks) && peaks.length > 0) {
          ws.load(url, [peaks])
        }
      } catch {
        /* use default decode */
      }
    }

    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => setPlaying(false))

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [attachment.id, waveformData])

  return (
    <div className="flex items-center gap-2 max-w-md">
      <button
        type="button"
        onClick={() => wsRef.current?.playPause()}
        className="w-8 h-8 rounded-full bg-accent text-white text-sm cursor-pointer shrink-0"
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div ref={containerRef} className="flex-1 min-w-0" />
    </div>
  )
}

/** Считает пики амплитуды из AudioBuffer для WaveformData. */
export async function computeWaveformPeaks(blob: Blob, bars = 64): Promise<number[]> {
  const ctx = new AudioContext()
  const buffer = await blob.arrayBuffer()
  const audio = await ctx.decodeAudioData(buffer)
  const channel = audio.getChannelData(0)
  const block = Math.floor(channel.length / bars)
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
  await ctx.close()
  return peaks
}
