import { useEffect, useState } from 'react'

// Заголовки разделов вида "1. …", "12. …" (но не "1.1. …").
const isSectionHeading = (line: string) => /^\d+\.\s+\D/.test(line)

type State =
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'missing' }

export function PrivacyPage() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetch('/legal/privacy.txt')
      .then(async (res) => {
        const contentType = res.headers.get('content-type') ?? ''
        const text = await res.text()
        // Если файла нет, статика отдаёт SPA-fallback (index.html) со статусом 200,
        // поэтому недостаточно проверить res.ok — отсеиваем HTML и пустой ответ.
        const looksLikeHtml =
          contentType.includes('text/html') || text.trimStart().startsWith('<')
        if (!res.ok || looksLikeHtml || text.trim() === '') {
          return { status: 'missing' as const }
        }
        return { status: 'ready' as const, text }
      })
      .catch(() => ({ status: 'missing' as const }))
      .then((next) => {
        if (!cancelled) setState(next)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <div className="min-h-screen bg-app" />
  }

  if (state.status === 'missing') {
    return (
      <div className="min-h-screen bg-app font-ui text-ink flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-[40px] font-extrabold text-faint">404</div>
          <p className="text-[14px] text-faint mt-2">Страница не найдена</p>
        </div>
      </div>
    )
  }

  const lines = state.text.trimEnd().split('\n')
  const title = lines[0]
  const body = lines.slice(1)

  return (
    <div className="min-h-screen bg-app font-ui text-ink">
      <div className="max-w-[820px] mx-auto px-5 py-10">
        <h1 className="text-[24px] font-extrabold tracking-[-.4px] mb-6">{title}</h1>

        <article className="flex flex-col gap-2 text-[14px] leading-[1.7] text-ink">
          {body.map((line, i) =>
            line.trim() === '' ? null : isSectionHeading(line) ? (
              <h2 key={i} className="text-[17px] font-bold mt-4 mb-1">
                {line}
              </h2>
            ) : (
              <p key={i} className="whitespace-pre-wrap">
                {line}
              </p>
            ),
          )}
        </article>
      </div>
    </div>
  )
}
