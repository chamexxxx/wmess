import { useRef } from 'react'
import { PaperclipIcon } from '../../workspace/icons'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function AttachmentUpload({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? [])
          if (list.length) onFiles(list)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:bg-hovered hover:text-ink disabled:opacity-40 cursor-pointer"
        title="Прикрепить файл"
      >
        <PaperclipIcon size={20} />
      </button>
    </>
  )
}
