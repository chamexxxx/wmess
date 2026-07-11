import { createBrowserRouter } from 'react-router'
import { ProtectedRoute } from './components/ProtectedRoute'
import { WorkspaceLayout } from './components/WorkspaceLayout'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { ProfilePage } from './pages/ProfilePage'
import { ExcalidrawTestPage } from './pages/ExcalidrawTestPage'

export const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      {
        // Общий каркас: постоянная полоса команд + контент через <Outlet>.
        element: <WorkspaceLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/teams/:teamId', element: <HomePage /> },
          { path: '/teams/:teamId/settings', element: <HomePage /> },
          { path: '/teams/:teamId/projects/:projectId', element: <HomePage /> },
          { path: '/teams/:teamId/projects/:projectId/:section', element: <HomePage /> },
          { path: '/teams/:teamId/projects/:projectId/library/:itemId', element: <HomePage /> },
          { path: '/teams/:teamId/projects/:projectId/chats/:chatId', element: <HomePage /> },
          { path: '/teams/:teamId/projects/:projectId/tasks/:taskId', element: <HomePage /> },
        ],
      },
      // Временный роут для тестирования Excalidraw (без каркаса рабочего пространства)
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
  {
    path: '/privacy',
    element: <PrivacyPage />,
  },
])
