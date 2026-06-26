import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $isCodeNode } from '@lexical/code'
import { $getNodeByKey } from 'lexical'
import { CheckIcon, ChevronDownIcon } from '../workspace/icons'
import { CODE_LANGUAGES } from './prismLanguages'

interface CodeLanguageSelectProps {
  editor: ReturnType<typeof useLexicalComposerContext>[0]
  nodeKey: string
  disabled?: boolean
}

export function CodeLanguageSelect({ editor, nodeKey, disabled }: CodeLanguageSelectProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const [label, setLabel] = useState('Не определен')
  const [currentLang, setCurrentLang] = useState<string>('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        const node = $getNodeByKey(nodeKey)
        if ($isCodeNode(node)) {
          const lang = node.getLanguage() || ''
          setCurrentLang(lang)
          const friendly = CODE_LANGUAGES.find(([value]) => value === lang)?.[1]
          setLabel(friendly ?? (lang || 'Не определен'))
        }
      })
    })
  }, [editor, nodeKey])

  useLayoutEffect(() => {
    if (!open) return
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, 180)
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
    const menuHeight = 320
    const top =
      r.bottom + 4 + menuHeight > window.innerHeight - 8 ? r.top - menuHeight - 4 : r.bottom + 4
    setPos({ left, top, width })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!menuRef.current?.contains(target) && !btnRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const close = () => setOpen(false)
    // Закрываем при скролле страницы/редактора (fixed-поповер иначе «уедет»), но НЕ при
    // скролле внутри самого списка — иначе длинный список невозможно прокрутить.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const handleSelect = (lang: string) => {
    setOpen(false)
    setFilter('')
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isCodeNode(node)) {
        node.setLanguage(lang || undefined)
      }
    })
  }

  const filtered = filter
    ? CODE_LANGUAGES.filter(
        ([value, name]) =>
          name.toLowerCase().includes(filter.toLowerCase()) ||
          value.toLowerCase().includes(filter.toLowerCase()),
      )
    : CODE_LANGUAGES

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="h-6 px-2 inline-flex items-center gap-1 rounded-md text-[11px] text-faint hover:text-muted hover:bg-sidebar font-ui cursor-pointer disabled:opacity-50 disabled:cursor-default focus:outline-none"
      >
        <span>{label}</span>
        <ChevronDownIcon
          size={12}
          className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          className="fixed z-[110] py-1 bg-white border border-line rounded-[10px] shadow-[0_12px_32px_rgba(43,42,38,.18)] font-ui animate-[wmPop_.1s_ease]"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
        >
          <div className="px-2 pb-1">
            <input
              type="text"
              placeholder="Поиск языка…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full h-7 px-2 text-[12px] bg-sidebar border border-line rounded-md focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto wm-scroll">
            {filtered.map(([lang, name]) => (
              <button
                key={lang}
                type="button"
                onClick={() => handleSelect(lang)}
                className={`w-full flex items-center gap-2 px-3 py-[6px] text-[13px] text-left cursor-pointer hover:bg-hovered ${
                  lang === currentLang ? 'text-accent-deep font-semibold' : 'text-ink-soft'
                }`}
              >
                <CheckIcon size={15} className={lang === currentLang ? 'text-accent' : 'opacity-0'} />
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
