import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  FORMAT_TEXT_COMMAND,
} from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import type { HeadingTagType } from '@lexical/rich-text'
import { $createCodeNode } from '@lexical/code'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { mergeRegister } from '@lexical/utils'
import { useCallback, useEffect, useState } from 'react'
import { BulletListIcon, CodeIcon, LinkIcon, NumberedListIcon, QuoteIcon } from '../workspace/icons'

type TextFormat = 'bold' | 'italic' | 'underline'

export function EditorToolbar() {
  const [editor] = useLexicalComposerContext()
  const [activeFormats, setActiveFormats] = useState<Record<TextFormat, boolean>>({
    bold: false,
    italic: false,
    underline: false,
  })
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  // Подсветка активных текстовых форматов по текущему выделению.
  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            setActiveFormats({
              bold: selection.hasFormat('bold'),
              italic: selection.hasFormat('italic'),
              underline: selection.hasFormat('underline'),
            })
          }
        })
      }),
    )
  }, [editor])

  const formatText = useCallback(
    (format: TextFormat) => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
    },
    [editor],
  )

  const formatHeading = useCallback(
    (headingType: HeadingTagType) => {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingType))
        }
      })
    },
    [editor],
  )

  const formatParagraph = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode())
      }
    })
  }, [editor])

  const formatQuote = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode())
      }
    })
  }, [editor])

  const formatCode = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createCodeNode())
      }
    })
  }, [editor])

  const insertBulletList = useCallback(() => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
  }, [editor])

  const insertNumberedList = useCallback(() => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
  }, [editor])

  const openLinkInput = useCallback(() => {
    setShowLinkInput((prev) => !prev)
    setLinkUrl('')
  }, [])

  const applyLink = useCallback(() => {
    const url = linkUrl.trim()
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url === '' ? null : url)
    setShowLinkInput(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  const btn =
    'h-8 min-w-8 px-2 rounded-md text-muted hover:bg-sidebar hover:text-ink transition-colors flex items-center justify-center text-sm cursor-pointer'
  const btnActive = 'bg-accent-soft text-accent'
  const divider = 'w-px h-5 bg-line mx-1'

  // preventDefault на mousedown сохраняет выделение в редакторе при клике по кнопке.
  const keepSelection = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className="shrink-0 border-b border-line bg-panel">
      <div className="flex items-center gap-0.5 px-3 py-2 flex-wrap">
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => formatText('bold')}
          className={`${btn} font-bold ${activeFormats.bold ? btnActive : ''}`}
          title="Жирный"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => formatText('italic')}
          className={`${btn} italic ${activeFormats.italic ? btnActive : ''}`}
          title="Курсив"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => formatText('underline')}
          className={`${btn} underline ${activeFormats.underline ? btnActive : ''}`}
          title="Подчёркнутый"
        >
          U
        </button>

        <div className={divider} />

        <button type="button" onMouseDown={keepSelection} onClick={() => formatHeading('h1')} className={`${btn} font-bold`} title="Заголовок 1">
          H1
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={() => formatHeading('h2')} className={`${btn} font-bold`} title="Заголовок 2">
          H2
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={() => formatHeading('h3')} className={`${btn} font-bold`} title="Заголовок 3">
          H3
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={formatParagraph} className={btn} title="Обычный текст">
          ¶
        </button>

        <div className={divider} />

        <button type="button" onMouseDown={keepSelection} onClick={insertBulletList} className={btn} title="Маркированный список">
          <BulletListIcon size={17} />
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={insertNumberedList} className={btn} title="Нумерованный список">
          <NumberedListIcon size={17} />
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={formatQuote} className={btn} title="Цитата">
          <QuoteIcon size={17} />
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={formatCode} className={btn} title="Блок кода">
          <CodeIcon size={17} />
        </button>

        <div className={divider} />

        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={openLinkInput}
          className={`${btn} ${showLinkInput ? btnActive : ''}`}
          title="Ссылка"
        >
          <LinkIcon size={17} />
        </button>
      </div>

      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyLink()
              if (e.key === 'Escape') setShowLinkInput(false)
            }}
            placeholder="https://… (пусто — убрать ссылку)"
            autoFocus
            className="flex-1 h-8 px-3 rounded-md border border-line bg-app text-ink text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-8 px-3 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent-deep cursor-pointer"
          >
            ОК
          </button>
        </div>
      )}
    </div>
  )
}
