import { createBrowserRouter } from 'react-router'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ExcalidrawTestPage } from './pages/ExcalidrawTestPage'

export const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/teams/:teamId', element: <HomePage /> },
      { path: '/teams/:teamId/projects/:projectId', element: <HomePage /> },
      { path: '/teams/:teamId/projects/:projectId/:section', element: <HomePage /> },
      { path: '/teams/:teamId/projects/:projectId/library/:itemId', element: <HomePage /> },
      // Временный роут для тестирования Excalidraw
      { path: '/excalidraw-test', element: <ExcalidrawTestPage /> },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
])
