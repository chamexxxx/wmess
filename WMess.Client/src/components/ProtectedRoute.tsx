import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { user, setUser } = useAuth()
  const [loading, setLoading] = useState(!user)

  useEffect(() => {
    if (user) return

    apiClient
      .getUser()
      .then((res) => {
        setUser({ email: res.data.email! })
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-app">
        <div
          className="h-7 w-7 rounded-full border-2 border-line border-t-accent animate-spin"
          role="status"
          aria-label="Загрузка"
        />
      </div>
    )
  }

  // Инвариант защищённых страниц: без реального пользователя приватный контент не рендерим,
  // а уходим на логин. Раньше здесь рендерился <Outlet/> с user=null (полагаясь только на
  // редирект перехватчика 401), из-за чего при любом другом сбое getUser приложение
  // открывалось «гостем». Теперь пользователь гарантированно есть ниже по дереву.
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
