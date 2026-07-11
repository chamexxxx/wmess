import { useCallback, useRef, useState } from 'react'
import { computeWaveformPeaks } from './VoicePlayer'
import { MicIcon } from '../../workspace/icons'

interface Props {
  onRecorded: (file: File, waveformJson: string) => void
  disabled?: boolean
}

export function VoiceRecorder({ onRecorded, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const peaks = await computeWaveformPeaks(blob)
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        onRecorded(file, JSON.stringify(peaks))
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      alert('Не удалось получить доступ к микрофону')
    }
  }, [onRecorded])

  const stop = useCallback(() => {
    mediaRef.current?.stop()
    setRecording(false)
  }, [])

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={recording ? stop : start}
      className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40 ${
        recording ? 'bg-red-100 text-red-600 animate-pulse' : 'text-muted hover:bg-hovered hover:text-ink'
      }`}
      title={recording ? 'Остановить запись' : 'Голосовое сообщение'}
    >
      <MicIcon size={20} />
    </button>
  )
}
