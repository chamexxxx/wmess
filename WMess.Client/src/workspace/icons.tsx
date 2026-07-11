// Minimal stroke icons matching the design (1.6–1.8 stroke, 24×24 viewBox).
// Color comes from the parent's text color (stroke="currentColor"), so callers
// tint them with Tailwind text-* utilities.

export interface IconProps {
  size?: number
  strokeWidth?: number
  className?: string
}

function Svg({
  size = 18,
  strokeWidth = 1.7,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16 4l4 4-11 11-5 1 1-5z" />
  </Svg>
)

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Svg>
)

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </Svg>
)

export const LogoutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 4h3a1 1 0 011 1v14a1 1 0 01-1 1h-3M10 8l-4 4 4 4M6 12h11" />
  </Svg>
)

export const FolderIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7.5A1.5 1.5 0 015.5 6h3l2 2H18.5A1.5 1.5 0 0120 9.5v8a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z" />
  </Svg>
)

export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v8A1.5 1.5 0 0118.5 15H9l-4.5 4z" />
  </Svg>
)

export const DocsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3.5h6l4 4V20a.5.5 0 01-.5.5h-9A.5.5 0 017 20z" />
    <path d="M13 3.5v4h4" />
  </Svg>
)

// Загруженный файл (любой тип) — скрепка-вложение. Path Lucide-скрепки занимает почти весь
// viewBox, поэтому равномерно ужимаем его до 85% (штрих масштабируется вместе с геометрией —
// без залипания петель), чтобы визуальный размер совпадал с другими иконками.
export const FileIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={p.strokeWidth ?? 1.8}>
    <g transform="translate(12 12) scale(0.85) translate(-12 -12)">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </g>
  </Svg>
)

// Фильтр — воронка.
export const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5h16l-6.2 7.4V20l-3.6-1.8v-5.3z" />
  </Svg>
)

// Сортировка — строки разной длины.
export const SortIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 7h14M5 12h9M5 17h5" />
  </Svg>
)

// Слои — режим «все папки одним списком».
export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l8.5 4.5L12 12 3.5 7.5 12 3z" />
    <path d="M3.5 12L12 16.5 20.5 12" />
    <path d="M3.5 16.5L12 21l8.5-4.5" />
  </Svg>
)

// Загруженный файл-изображение — рамка с «горой» и солнцем.
export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <circle cx="8.8" cy="9" r="1.5" />
    <path d="M20.5 15.5l-4.7-4.7L6 20.5" />
  </Svg>
)

// Ссылка на внешний ресурс (ярлык) — стрелка из рамки. Иконка типа элемента библиотеки «ссылка».
export const ExternalLinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M10.5 13.5 20 4" />
    <path d="M18 13.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H11" />
  </Svg>
)

export const LibraryIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="1.8" />
    <path d="M8.5 3.5v17" />
  </Svg>
)

export const TasksIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <path d="M8.5 12.2l2.4 2.4 4.6-5" />
  </Svg>
)

// Доска для совместного рисования: рамка холста с рукописной волной внутри.
export const BoardsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M6.5 14c1.6-3 3.2-3 4.8 0s3.2 3 4.8 0" />
  </Svg>
)

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Svg>
)

export const TablesIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2.5" />
    <path d="M4 10h16M4 15h16M10 5.2v13.6" />
  </Svg>
)

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 10.5 12 5l7 5.5V19a1 1 0 0 1-1 1h-3v-5h-6v5H6a1 1 0 0 1-1-1z" />
  </Svg>
)

export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
)

export const BulletListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Svg>
)

export const NumberedListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4 6h1v4M4 10h2" />
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
  </Svg>
)

export const QuoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 7h3v3c0 2-1 3.4-3 4" />
    <path d="M14 7h3v3c0 2-1 3.4-3 4" />
  </Svg>
)

export const CodeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
  </Svg>
)

export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Svg>
)

export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
)

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
)

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
)

export const CameraIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.8l1.2-2h7l1.2 2h1.8A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="13" r="3.2" />
  </Svg>
)

// Скрепка-вложение для панели ввода чата (Lucide paperclip, почти во весь viewBox).
export const PaperclipIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </Svg>
)

// Микрофон — запись голосового сообщения.
export const MicIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21M8.5 21h7" />
  </Svg>
)

// Отправка сообщения — бумажный самолётик (Lucide send).
export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4z" />
  </Svg>
)
