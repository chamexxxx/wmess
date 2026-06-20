import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
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

  if (loading) return null

  return <Outlet />
}
