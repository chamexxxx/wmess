import { useState } from 'react'
import { isAxiosError } from 'axios'
import { Link, useNavigate } from 'react-router'
import { apiClient } from '../api'
import { AuthLayout, authError, authField, authLink, authPrimaryBtn } from '../components/AuthLayout'

export function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [login, setLogin] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await apiClient.register({ email, login, displayName, password })
      navigate('/login')
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError('Пользователь с таким email или логином уже существует')
      } else {
        setError('Ошибка регистрации. Проверьте правильность полей')
      }
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
            type="text"
            placeholder="Логин"
            className={authField}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            pattern="[a-zA-Z0-9_\-]{3,32}"
            title="3–32 символа: латиница, цифры, «_» или «-»"
            required
          />
          <p className="text-[11.5px] text-faint mt-[6px]">
            3–32 символа: латиница, цифры, «_» или «-»
          </p>
        </div>
        <input
          type="text"
          placeholder="Имя"
          className={authField}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={100}
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
