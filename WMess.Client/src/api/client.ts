import axios from 'axios'

export const api = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    'X-CSRF': '1',
  },
})

export interface Credentials {
  email: string
  password: string
}

export const login = (creds: Credentials) => api.post('/bff/login', creds)
export const register = (creds: Credentials) => api.post('/bff/register', creds)
export const logout = () => api.post('/bff/logout')
export const getUser = () => api.get('/bff/user')
