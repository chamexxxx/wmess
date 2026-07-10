import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'
import type { ProjectResponse, TeamResponse } from '../api/generated/data-contracts'
import { TeamRail } from './TeamRail'
import { FormModal } from './WorkspaceModals'
import type { WorkspaceContextValue } from './workspaceContext'

/**
 * Каркас рабочего пространства: слева постоянная полоса команд (TeamRail), справа —
 * контент страницы через <Outlet>. Команды и проекты грузятся один раз и передаются
 * страницам через контекст, поэтому переходы между страницами не перезагружают полосу.
 */
export function WorkspaceLayout() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const { teamId } = useParams()
  const selectedTeamId = teamId ? Number(teamId) : null

  const [teams, setTeams] = useState<TeamResponse[]>([])
  const [projects, setProjects] = useState<ProjectResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createTeamOpen, setCreateTeamOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([apiClient.teams.teamsList(), apiClient.projects.projectsList()])
      .then(([teamRes, projectRes]) => {
        setTeams(teamRes.data ?? [])
        setProjects(projectRes.data ?? [])
      })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false))
  }, [])

  // Автоскрытие тоста ошибки.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(t)
  }, [error])

  const handleLogout = async () => {
    try {
      await apiClient.logout()
    } catch {
      // выходим локально даже при ошибке
    }
    setUser(null)
    navigate('/login')
  }

  const createTeam = async (name: string) => {
    setBusy(true)
    try {
      const res = await apiClient.teams.teamsCreate({ name })
      setTeams((prev) => [...prev, res.data])
      setCreateTeamOpen(false)
      navigate(`/teams/${Number(res.data.id)}`)
    } catch {
      setError('Не удалось создать команду')
    } finally {
      setBusy(false)
    }
  }

  // Пока идёт начальная загрузка — полноэкранный лоадер (один раз за сессию каркаса).
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

  const context: WorkspaceContextValue = {
    teams,
    setTeams,
    projects,
    setProjects,
    openCreateTeam: () => setCreateTeamOpen(true),
    setError,
  }

  return (
    <div className="wm-scroll fixed inset-0 flex bg-app text-ink font-ui text-sm text-left antialiased">
      <TeamRail
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelect={(id) => navigate(`/teams/${id}`)}
        onCreate={() => setCreateTeamOpen(true)}
        user={user}
        onOpenProfile={() => navigate('/profile')}
        onLogout={handleLogout}
      />

      <Outlet context={context} />

      {createTeamOpen && (
        <FormModal
          title="Новая команда"
          label="Название команды"
          submitLabel="Создать"
          busy={busy}
          onSubmit={createTeam}
          onClose={() => setCreateTeamOpen(false)}
        />
      )}

      {error && (
        <div
          onClick={() => setError(null)}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#2a1215] text-[#ff9d8a] border border-[#5c2b2e] rounded-[10px] px-4 py-2.5 text-[13px] cursor-pointer z-[200] shadow-[0_10px_30px_rgba(0,0,0,.2)]"
        >
          {error}
        </div>
      )}
    </div>
  )
}
