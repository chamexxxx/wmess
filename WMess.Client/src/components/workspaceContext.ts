import { useOutletContext } from 'react-router'
import type { ProjectResponse, TeamResponse } from '../api/generated/data-contracts'

// Данные и действия рабочего пространства, общие для страниц под WorkspaceLayout.
export interface WorkspaceContextValue {
  teams: TeamResponse[]
  setTeams: React.Dispatch<React.SetStateAction<TeamResponse[]>>
  projects: ProjectResponse[]
  setProjects: React.Dispatch<React.SetStateAction<ProjectResponse[]>>
  openCreateTeam: () => void
  setError: (message: string | null) => void
}

export function useWorkspace() {
  return useOutletContext<WorkspaceContextValue>()
}
