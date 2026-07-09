import axios, { isAxiosError } from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { Bff } from './generated/Bff'
import { Chats } from './generated/Chats'
import { Documents } from './generated/Documents'
import { Projects } from './generated/Projects'
import { Teams } from './generated/Teams'
import { User } from './generated/User'
import type { ApiConfig } from './generated/http-client'

const AUTH_PATHS = ['/api/login', '/api/register']

let isRefreshing = false
let pendingRequests: Array<(success: boolean) => void> = []

function notifyPending(success: boolean) {
  pendingRequests.forEach((cb) => cb(success))
  pendingRequests = []
}

function attachAuthInterceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!isAxiosError(error) || error.response?.status !== 401) {
        return Promise.reject(error)
      }

      const url = error.config?.url ?? ''
      if (AUTH_PATHS.includes(url) || url === '/api/refresh') {
        return Promise.reject(error)
      }

      const config = error.config as AxiosRequestConfig & { _retry?: boolean }
      if (config._retry) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push((success) => {
            if (success) {
              config._retry = true
              resolve(instance.request(config))
            } else {
              reject(error)
            }
          })
        })
      }

      isRefreshing = true
      config._retry = true

      try {
        await axios.post('/api/refresh', null, {
          withCredentials: true,
          headers: { 'X-CSRF': '1' },
        })
        notifyPending(true)
        return instance.request(config)
      } catch {
        notifyPending(false)
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    },
  )
}

const config: ApiConfig = {
  withCredentials: true,
  headers: { 'X-CSRF': '1' },
}

class WMessApiClient extends Bff {
  public teams: Teams
  public projects: Projects
  public user: User
  public documents: Documents
  public chats: Chats

  constructor(config: ApiConfig) {
    super(config)

    this.teams = new Teams(config)
    this.projects = new Projects(config)
    this.user = new User(config)
    this.documents = new Documents(config)
    this.chats = new Chats(config)

    attachAuthInterceptor(this.instance)
    attachAuthInterceptor(this.teams.instance)
    attachAuthInterceptor(this.projects.instance)
    attachAuthInterceptor(this.user.instance)
    attachAuthInterceptor(this.documents.instance)
    attachAuthInterceptor(this.chats.instance)
  }
}

export const apiClient = new WMessApiClient(config)
