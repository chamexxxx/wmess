import { Bff } from './generated/Bff'
import { Projects } from './generated/Projects'
import { Teams } from './generated/Teams'
import { User } from './generated/User'
import type { ApiConfig } from './generated/http-client'

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
  }
}

export const apiClient = new WMessApiClient(config)
