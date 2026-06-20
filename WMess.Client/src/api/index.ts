import { isAxiosError } from 'axios'
import type { AxiosInstance } from 'axios'
import { Bff } from './generated/Bff'
import { Projects } from './generated/Projects'
import { Teams } from './generated/Teams'
import { User } from './generated/User'
import type { ApiConfig } from './generated/http-client'

const AUTH_PATHS = ['/api/login', '/api/register']

function attachAuthInterceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (
        isAxiosError(error) &&
        error.response?.status === 401 &&
        !AUTH_PATHS.includes(error.config?.url ?? '')
      ) {
        window.location.href = '/login'
      }

      return Promise.reject(error)
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

  constructor(config: ApiConfig) {
    super(config)

    this.teams = new Teams(config)
    this.projects = new Projects(config)
    this.user = new User(config)

    attachAuthInterceptor(this.instance)
    attachAuthInterceptor(this.teams.instance)
    attachAuthInterceptor(this.projects.instance)
    attachAuthInterceptor(this.user.instance)
  }
}

export const apiClient = new WMessApiClient(config)
