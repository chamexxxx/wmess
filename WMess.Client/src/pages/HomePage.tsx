import { useNavigate } from 'react-router'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'

export function HomePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await apiClient.logout()
    } catch {
      // logout failed, clear local state anyway
    }
    setUser(null)
    navigate('/login')
  }

  return (
    <div>
      <h1>Главная</h1>
      <p>Email: {user?.email}</p>
      <button onClick={handleLogout}>Выйти</button>
    </div>
  )
}
