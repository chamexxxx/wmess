import { useEffect } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

export function ExcalidrawTestPage() {
  useEffect(() => {
    // Шрифты Excalidraw подгружаются динамически от этого пути (Excalidraw дописывает fonts/...).
    // Раздаём их локально из public/excalidraw-assets (кладёт scripts/copy-excalidraw-assets.mjs),
    // чтобы не зависеть от внешнего CDN — стенд работает по локальной сети.
    ;(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH =
      '/excalidraw-assets/'
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Excalidraw
        initialData={{
          elements: [],
          appState: {
            viewBackgroundColor: '#ffffff',
          },
        }}
      />
    </div>
  )
}
