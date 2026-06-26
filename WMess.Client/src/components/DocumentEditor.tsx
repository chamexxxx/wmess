import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin'
import { LexicalCollaboration } from '@lexical/react/LexicalCollaborationContext'
import { TRANSFORMERS } from '@lexical/markdown'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'
import { LinkNode } from '@lexical/link'
import { CodeNode, CodeHighlightNode } from '@lexical/code'
import { registerCodeHighlighting, PrismTokenizer } from '@lexical/code-prism'
import { EditorToolbar } from './EditorToolbar'
import { CodeBlockControlsPlugin } from './CodeBlockControlsPlugin'
import { useDocument } from '../providers/DocumentProvider'

function onError(error: Error) {
  console.error(error)
}

// Подсветка кода + корректная обработка клавиш (Enter/Tab/стрелки) внутри код-блоков.
// Без registerCodeHighlighting CodeNode ведёт себя некорректно — ломается перенос строк.
function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => registerCodeHighlighting(editor, { ...PrismTokenizer, defaultLanguage: null }), [editor])
  return null
}

const theme = {
  paragraph: 'mb-3 leading-relaxed',
  heading: {
    h1: 'text-3xl font-bold mb-4 mt-2',
    h2: 'text-2xl font-bold mb-3 mt-2',
    h3: 'text-xl font-bold mb-2 mt-2',
  },
  quote: 'border-l-4 border-line pl-4 italic text-muted my-3',
  list: {
    nested: { listitem: 'list-none' },
    ul: 'list-disc ml-6 mb-3',
    ol: 'list-decimal ml-6 mb-3',
    listitem: 'mb-1',
  },
  link: 'text-accent underline cursor-pointer',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-sidebar rounded px-1.5 py-0.5 font-mono text-[0.9em]',
  },
  code: 'block whitespace-pre-wrap bg-sidebar rounded-lg pt-3 px-3 pb-8 font-mono text-[0.9em] my-3 overflow-x-auto',
}

interface DocumentEditorProps {
  documentId: number
}

export function DocumentEditor({ documentId }: DocumentEditorProps) {
  const { providerFactory, username, cursorColor } = useDocument()

  const initialConfig = {
    namespace: 'WMessDocumentEditor',
    theme,
    onError,
    // Collaboration сам инициализирует состояние из Yjs — стартового editorState быть не должно.
    editorState: null,
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode, CodeHighlightNode],
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      {/* CollaborationPlugin (v0.45) требует провайдер CollaborationContext выше по дереву. */}
      <LexicalCollaboration>
        <div className="flex flex-col h-full min-h-0">
          <EditorToolbar />
          <div className="flex-1 min-h-0 overflow-y-auto wm-scroll">
            <div className="max-w-[820px] mx-auto px-8 py-6 relative">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable className="outline-none min-h-[60vh] text-ink" />
                }
                placeholder={
                  <div className="absolute top-6 left-8 text-faint pointer-events-none">
                    Начните печатать…
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>
          </div>
          <ListPlugin />
          <LinkPlugin />
          <CodeHighlightPlugin />
          <CodeBlockControlsPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <AutoFocusPlugin />
          <CollaborationPlugin
            id={String(documentId)}
            providerFactory={providerFactory}
            shouldBootstrap={true}
            username={username}
            cursorColor={cursorColor}
          />
        </div>
      </LexicalCollaboration>
    </LexicalComposer>
  )
}
