import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'
import { AuthLayout, authError, authField, authLink, authPrimaryBtn } from '../components/AuthLayout'

export function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const res = await apiClient.login({ email, password })
      setUser({ email: res.data.email! })
      navigate('/')
    } catch {
      setError('Неверный email или пароль')
    }
  }

  return (
    <AuthLayout
      title="Вход"
      subtitle="Войдите в свой аккаунт WMess"
      footer={
        <>
          Нет аккаунта?{' '}
          <Link to="/register" className={authLink}>
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          className={authField}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          className={authField}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className={authError}>{error}</div>}
        <button type="submit" className={authPrimaryBtn}>
          Войти
        </button>
      </form>
    </AuthLayout>
  )
}
