import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { apiClient } from '../api'
import { AuthLayout, authError, authField, authLink, authPrimaryBtn } from '../components/AuthLayout'

export function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await apiClient.register({ email, password })
      navigate('/login')
    } catch {
      setError('Ошибка регистрации')
    }
  }

  return (
    <AuthLayout
      title="Регистрация"
      subtitle="Создайте аккаунт, чтобы начать работу"
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/login" className={authLink}>
            Войти
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
        <div>
          <input
            type="password"
            placeholder="Пароль"
            className={authField}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <p className="text-[11.5px] text-faint mt-[6px]">Минимум 6 символов</p>
        </div>
        {error && <div className={authError}>{error}</div>}
        <button type="submit" className={authPrimaryBtn}>
          Зарегистрироваться
        </button>
      </form>
    </AuthLayout>
  )
}
