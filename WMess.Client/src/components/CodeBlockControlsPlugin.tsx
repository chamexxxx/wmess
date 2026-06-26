import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $isCodeNode } from '@lexical/code'
import { $getNodeByKey, $getRoot } from 'lexical'
import { CheckIcon, CopyIcon } from '../workspace/icons'
import { CodeLanguageSelect } from './CodeLanguageSelect'

interface Box {
  key: string
  top: number
  left: number
  width: number
  height: number
}

function CodeCopyButton({
  editor,
  nodeKey,
}: {
  editor: ReturnType<typeof useLexicalComposerContext>[0]
  nodeKey: string
}) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const handleCopy = async () => {
    const text = editor.getEditorState().read(() => {
      const node = $getNodeByKey(nodeKey)
      return $isCodeNode(node) ? node.getTextContent() : ''
    })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy code block', err)
    }
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleCopy}
      title={copied ? 'Скопировано' : 'Скопировать фрагмент'}
      className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-line bg-panel/90 backdrop-blur-sm text-muted hover:text-ink hover:bg-sidebar shadow-sm cursor-pointer transition-colors"
    >
      {copied ? <CheckIcon size={15} className="text-accent" /> : <CopyIcon size={15} />}
    </button>
  )
}

/**
 * Оверлей с контролами для блоков кода: кнопка копирования (по наведению, справа вверху)
 * и селект языка (всегда, справа внизу). Контролы нельзя класть внутрь <code> — это
 * contentEditable, Lexical снесёт чужой DOM, — поэтому рисуем отдельный слой и порталим
 * его в позиционированного родителя редактора, выравнивая по геометрии каждого блока.
 */
export function CodeBlockControlsPlugin() {
  const [editor] = useLexicalComposerContext()
  const [boxes, setBoxes] = useState<Box[]>([])
  const boxesRef = useRef<Box[]>([])
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [editable, setEditable] = useState(() => editor.isEditable())
  const [parent, setParent] = useState<HTMLElement | null>(null)

  useEffect(() => editor.registerEditableListener(setEditable), [editor])

  // Пересчёт геометрии всех блоков кода относительно позиционированного родителя.
  useEffect(() => {
    const measure = () => {
      editor.getEditorState().read(() => {
        const next: Box[] = []
        for (const child of $getRoot().getChildren()) {
          if (!$isCodeNode(child)) continue
          const el = editor.getElementByKey(child.getKey())
          if (el) {
            next.push({
              key: child.getKey(),
              top: el.offsetTop,
              left: el.offsetLeft,
              width: el.offsetWidth,
              height: el.offsetHeight,
            })
          }
        }
        boxesRef.current = next
        setBoxes(next)
      })
      setParent(editor.getRootElement()?.parentElement ?? null)
    }

    const rafId = requestAnimationFrame(measure)
    const unregisterUpdate = editor.registerUpdateListener(measure)

    const parentEl = editor.getRootElement()?.parentElement ?? null
    const resizeObserver = parentEl ? new ResizeObserver(measure) : null
    if (parentEl && resizeObserver) resizeObserver.observe(parentEl)

    const onWindowResize = () => measure()
    window.addEventListener('resize', onWindowResize)

    return () => {
      cancelAnimationFrame(rafId)
      unregisterUpdate()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', onWindowResize)
    }
  }, [editor])

  // Hover считаем по координатам относительно контейнера: курсор, заехавший на саму кнопку
  // копирования (она в оверлее-сиблинге, а не внутри <code>), остаётся «внутри» блока и не
  // сбрасывает hover — иначе кнопка исчезала бы раньше, чем по ней успеешь кликнуть.
  useEffect(() => {
    if (!parent) return
    const onPointerMove = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const hit = boxesRef.current.find(
        (b) => x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height,
      )
      setHoveredKey(hit ? hit.key : null)
    }
    const onPointerLeave = () => setHoveredKey(null)
    parent.addEventListener('pointermove', onPointerMove)
    parent.addEventListener('pointerleave', onPointerLeave)
    return () => {
      parent.removeEventListener('pointermove', onPointerMove)
      parent.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [parent])

  if (!parent) return null

  return createPortal(
    <div className="absolute inset-0 pointer-events-none z-10">
      {boxes.map((box) => (
        <div
          key={box.key}
          style={{
            position: 'absolute',
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
          className="pointer-events-none"
        >
          {hoveredKey === box.key && (
            <div className="absolute top-2 right-2 pointer-events-auto">
              <CodeCopyButton editor={editor} nodeKey={box.key} />
            </div>
          )}
          <div className="absolute bottom-1.5 right-2 pointer-events-auto">
            <CodeLanguageSelect editor={editor} nodeKey={box.key} disabled={!editable} />
          </div>
        </div>
      ))}
    </div>,
    parent,
  )
}
