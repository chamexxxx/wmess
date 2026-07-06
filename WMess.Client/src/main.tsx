import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './fonts.css'
import './index.css'
import { router } from './router.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

// Путь для динамически подгружаемых шрифтов Excalidraw — задаём глобально (до рендера),
// чтобы он действовал для доски в любом месте приложения, а не только на тестовой странице.
// Шрифты раздаются локально из public/excalidraw-assets (см. scripts/copy-excalidraw-assets.mjs);
// иначе Excalidraw грузит их из /node_modules/.../dist/dev/fonts (медленно в dev, 404 в проде).
;(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
