import { useRef } from 'react'

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
        className="w-9 h-9 rounded-lg text-muted hover:bg-hovered disabled:opacity-40 cursor-pointer"
        title="Прикрепить файл"
      >
        📎
      </button>
    </>
  )
}
