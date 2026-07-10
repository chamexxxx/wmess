import { useEffect } from 'react'
import { BoardProvider } from '../providers/BoardProvider'
import { BoardEditor } from '../components/BoardEditor'

export function ExcalidrawTestPage() {
  useEffect(() => {
    // Шрифты Excalidraw подгружаются динамически от этого пути (Excalidraw дописывает fonts/...).
    // Раздаём их локально из public/excalidraw-assets (кладёт scripts/copy-excalidraw-assets.mjs),
    // чтобы не зависеть от внешнего CDN — стенд работает по локальной сети.
    ;(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH =
      '/excalidraw-assets/'
  }, [])

  // Временно используем тестовый boardId=1 для проверки синхронизации
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <BoardProvider boardId={1}>
        <BoardEditor />
      </BoardProvider>
    </div>
  )
}
