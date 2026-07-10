interface Props {
  roomId: string
  isVideo: boolean
  onClose: () => void
}

export function JitsiEmbed({ roomId, isVideo, onClose }: Props) {
  const domain = 'meet.jit.si'
  const url = `https://${domain}/${roomId}#config.startWithAudioMuted=false&config.startWithVideoMuted=${!isVideo}`

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-panel rounded-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-xl">
        <div className="h-12 border-b border-line flex items-center justify-between px-4 shrink-0">
          <span className="font-semibold text-sm">Созвон</span>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink cursor-pointer text-lg">
            ✕
          </button>
        </div>
        <iframe
          title="Jitsi Meet"
          src={url}
          allow="camera; microphone; fullscreen; display-capture"
          className="flex-1 w-full border-0"
        />
      </div>
    </div>
  )
}
