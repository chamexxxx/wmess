import axios, { isAxiosError } from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { Bff } from './generated/Bff'
import { Library } from './generated/Library'
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
  public library: Library

  constructor(config: ApiConfig) {
    super(config)

    this.teams = new Teams(config)
    this.projects = new Projects(config)
    this.user = new User(config)
    this.library = new Library(config)

    attachAuthInterceptor(this.instance)
    attachAuthInterceptor(this.teams.instance)
    attachAuthInterceptor(this.projects.instance)
    attachAuthInterceptor(this.user.instance)
    attachAuthInterceptor(this.library.instance)
  }

  // Загрузка файлов с компьютера (multipart). Не входит в сгенерированный клиент,
  // т.к. тот не умеет FormData/файлы. Использует axios-инстанс библиотеки (куки + CSRF + refresh).
  uploadLibraryFiles(projectId: number, folderId: number | null, files: File[]) {
    const form = new FormData()
    form.append('projectId', String(projectId))
    if (folderId != null) {
      form.append('folderId', String(folderId))
    }
    for (const file of files) {
      form.append('files', file)
    }
    // Content-Type (multipart с boundary) axios выставит сам по FormData.
    return this.library.instance.post('/api/library-items/files', form)
  }

  // Байты загруженного файла как Blob (для предпросмотра изображений через object URL).
  async fetchLibraryFile(id: number): Promise<Blob> {
    const res = await this.library.instance.get(`/api/library-items/${id}/download`, {
      responseType: 'blob',
    })
    return res.data as Blob
  }

  // Скачивание загруженного файла: тянем blob и сохраняем под исходным именем.
  async downloadLibraryFile(id: number, fileName: string) {
    const res = await this.library.instance.get(`/api/library-items/${id}/download`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
}

export const apiClient = new WMessApiClient(config)
