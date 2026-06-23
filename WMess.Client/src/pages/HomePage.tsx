import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'
import type { ProjectResponse, TeamResponse } from '../api/generated/data-contracts'
import { TeamRail } from '../components/TeamRail'
import { ProjectSidebar } from '../components/ProjectSidebar'
import { DocumentsSection } from '../components/DocumentsSection'
import { ProjectSettings } from '../components/ProjectSettings'
import { ConfirmDialog, FormModal } from '../components/WorkspaceModals'
import { FolderIcon, PlusIcon, SettingsIcon } from '../workspace/icons'
import { DEFAULT_SECTION, sectionById, type Section } from '../workspace/sections'

type TeamModal = { mode: 'create' } | { mode: 'edit'; team: TeamResponse }
type ProjectModal = { mode: 'create' } | { mode: 'edit'; project: ProjectResponse }
type Confirm = { kind: 'team'; team: TeamResponse } | { kind: 'project'; project: ProjectResponse }

export function HomePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  // Selection lives in the URL: /teams/:teamId/projects/:projectId/:section
  const { teamId: teamIdParam, projectId: projectIdParam, section: sectionParam } = useParams()
  const selectedTeamId = teamIdParam ? Number(teamIdParam) : null
  const selectedProjectId = projectIdParam ? Number(projectIdParam) : null

  const [teams, setTeams] = useState<TeamResponse[]>([])
  const [projects, setProjects] = useState<ProjectResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [teamModal, setTeamModal] = useState<TeamModal | null>(null)
  const [projectModal, setProjectModal] = useState<ProjectModal | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
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

  // Auto-dismiss the error toast.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(t)
  }, [error])

  const selectedTeam = teams.find((t) => Number(t.id) === selectedTeamId)
  const teamProjects = useMemo(
    () => projects.filter((p) => Number(p.teamId) === selectedTeamId),
    [projects, selectedTeamId],
  )
  const selectedProject = teamProjects.find((p) => Number(p.id) === selectedProjectId)
  const section = sectionById(sectionParam)
  const isSettings = sectionParam === 'settings'

  // Keep the URL pointing at something real: land on the first team, default to
  // the first section, and bounce off ids/sections that don't exist.
  useEffect(() => {
    if (loading) return
    if (selectedTeamId != null && !teams.some((t) => Number(t.id) === selectedTeamId)) {
      navigate('/', { replace: true })
    } else if (selectedTeamId == null && teams.length > 0) {
      navigate(`/teams/${Number(teams[0].id)}`, { replace: true })
    } else if (selectedProjectId != null && !selectedProject) {
      navigate(`/teams/${selectedTeamId}`, { replace: true })
    } else if (selectedProject && !section && !isSettings) {
      navigate(`/teams/${selectedTeamId}/projects/${selectedProjectId}/${DEFAULT_SECTION}`, {
        replace: true,
      })
    }
  }, [loading, selectedTeamId, selectedProjectId, selectedProject, section, isSettings, teams, navigate])

  const handleLogout = async () => {
    try {
      await apiClient.logout()
    } catch {
      // logout failed, clear local state anyway
    }
    setUser(null)
    navigate('/login')
  }

  // ---- teams ----
  const createTeam = async (name: string) => {
    setBusy(true)
    try {
      const res = await apiClient.teams.teamsCreate({ name })
      setTeams((prev) => [...prev, res.data])
      setTeamModal(null)
      navigate(`/teams/${Number(res.data.id)}`)
    } catch {
      setError('Не удалось создать команду')
    } finally {
      setBusy(false)
    }
  }

  const updateTeam = async (id: number, name: string) => {
    setBusy(true)
    try {
      await apiClient.teams.teamsUpdate(id, { name })
      setTeams((prev) => prev.map((t) => (Number(t.id) === id ? { ...t, name } : t)))
      setTeamModal(null)
    } catch {
      setError('Не удалось сохранить команду')
    } finally {
      setBusy(false)
    }
  }

  const deleteTeam = async (team: TeamResponse) => {
    const id = Number(team.id)
    setBusy(true)
    try {
      await apiClient.teams.teamsDelete(id)
      setProjects((prev) => prev.filter((p) => Number(p.teamId) !== id))
      const remaining = teams.filter((t) => Number(t.id) !== id)
      setTeams(remaining)
      setConfirm(null)
      navigate(remaining.length ? `/teams/${Number(remaining[0].id)}` : '/', { replace: true })
    } catch {
      setError('Не удалось удалить команду')
    } finally {
      setBusy(false)
    }
  }

  // ---- projects ----
  const createProject = async (name: string) => {
    if (selectedTeamId == null) return
    setBusy(true)
    try {
      const res = await apiClient.projects.projectsCreate({ name, teamId: selectedTeamId })
      setProjects((prev) => [...prev, res.data])
      setProjectModal(null)
      navigate(`/teams/${selectedTeamId}/projects/${Number(res.data.id)}/${DEFAULT_SECTION}`)
    } catch {
      setError('Не удалось создать проект')
    } finally {
      setBusy(false)
    }
  }

  const updateProject = async (project: ProjectResponse, name: string) => {
    setBusy(true)
    try {
      await apiClient.projects.projectsUpdate(Number(project.id), {
        name,
        teamId: Number(project.teamId),
      })
      setProjects((prev) =>
        prev.map((p) => (Number(p.id) === Number(project.id) ? { ...p, name } : p)),
      )
      setProjectModal(null)
    } catch {
      setError('Не удалось сохранить проект')
    } finally {
      setBusy(false)
    }
  }

  const deleteProject = async (project: ProjectResponse) => {
    setBusy(true)
    try {
      await apiClient.projects.projectsDelete(Number(project.id))
      setProjects((prev) => prev.filter((p) => Number(p.id) !== Number(project.id)))
      setConfirm(null)
      if (Number(project.id) === selectedProjectId) navigate(`/teams/${selectedTeamId}`)
    } catch {
      setError('Не удалось удалить проект')
    } finally {
      setBusy(false)
    }
  }

  const title = selectedTeam ? 'Проекты' : 'Добро пожаловать'

  return (
    <div className="wm-scroll fixed inset-0 flex bg-app text-ink font-ui text-sm text-left antialiased">
      <TeamRail
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelect={(id) => navigate(`/teams/${id}`)}
        onCreate={() => setTeamModal({ mode: 'create' })}
        userEmail={user?.email}
        onLogout={handleLogout}
      />

      <ProjectSidebar
        team={selectedTeam}
        projects={teamProjects}
        selectedProjectId={selectedProjectId}
        selectedSectionId={isSettings ? 'settings' : section?.id}
        onSelectProject={(id) =>
          navigate(`/teams/${selectedTeamId}/projects/${id}/${section?.id ?? DEFAULT_SECTION}`)
        }
        onSelectSection={(sectionId) =>
          navigate(`/teams/${selectedTeamId}/projects/${selectedProjectId}/${sectionId}`)
        }
        onCreateProject={() => setProjectModal({ mode: 'create' })}
        onEditProject={(project) => setProjectModal({ mode: 'edit', project })}
        onDeleteProject={(project) => setConfirm({ kind: 'project', project })}
        onEditTeam={() => selectedTeam && setTeamModal({ mode: 'edit', team: selectedTeam })}
        onDeleteTeam={() => selectedTeam && setConfirm({ kind: 'team', team: selectedTeam })}
      />

      {/* MAIN */}
      <div className="flex-1 min-w-0 flex flex-col bg-panel">
        <div className="h-[60px] shrink-0 border-b border-line flex items-center px-[22px] gap-3">
          {selectedProject ? (
            <>
              <nav className="flex items-center gap-2 min-w-0 text-[14px]">
                <button
                  type="button"
                  className="font-semibold text-ink truncate hover:text-accent transition-colors cursor-pointer"
                  onClick={() =>
                    navigate(`/teams/${selectedTeamId}/projects/${selectedProjectId}/${DEFAULT_SECTION}`)
                  }
                >
                  {selectedProject.name}
                </button>
                <span className="text-faintest shrink-0">/</span>
                <span className="text-muted truncate">
                  {isSettings ? 'Настройки' : (section?.label ?? 'Проект')}
                </span>
              </nav>
              <button
                type="button"
                className={`ml-auto w-9 h-9 rounded-[9px] flex items-center justify-center cursor-pointer transition-colors ${
                  isSettings
                    ? 'text-accent-deep bg-accent-soft'
                    : 'text-muted hover:bg-hovered'
                }`}
                title="Настройки проекта"
                onClick={() =>
                  navigate(`/teams/${selectedTeamId}/projects/${selectedProjectId}/settings`)
                }
              >
                <SettingsIcon size={17} />
              </button>
            </>
          ) : (
            <div className="text-base font-bold truncate">{title}</div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <EmptyState text="Загрузка…" />
          ) : teams.length === 0 ? (
            <EmptyState
              text="У вас пока нет команд. Создайте первую, чтобы начать работу."
              action={{ label: 'Создать команду', onClick: () => setTeamModal({ mode: 'create' }) }}
            />
          ) : !selectedTeam ? null : !selectedProject ? (
            <EmptyState
              text="Выберите проект слева или создайте новый в этой команде."
              action={{ label: 'Новый проект', onClick: () => setProjectModal({ mode: 'create' }) }}
            />
          ) : isSettings ? (
            <ProjectSettings
              project={selectedProject}
              busy={busy}
              onRename={(name) => updateProject(selectedProject, name)}
              onDelete={() => setConfirm({ kind: 'project', project: selectedProject })}
            />
          ) : section?.id === 'docs' ? (
            <DocumentsSection projectId={selectedProjectId!} />
          ) : section ? (
            <SectionPlaceholder section={section} />
          ) : null}
        </div>
      </div>

      {/* MODALS */}
      {teamModal &&
        (teamModal.mode === 'create' ? (
          <FormModal
            title="Новая команда"
            label="Название команды"
            submitLabel="Создать"
            busy={busy}
            onSubmit={createTeam}
            onClose={() => setTeamModal(null)}
          />
        ) : (
          <FormModal
            title="Переименовать команду"
            label="Название команды"
            initialValue={teamModal.team.name}
            submitLabel="Сохранить"
            busy={busy}
            onSubmit={(name) => updateTeam(Number(teamModal.team.id), name)}
            onClose={() => setTeamModal(null)}
          />
        ))}

      {projectModal &&
        (projectModal.mode === 'create' ? (
          <FormModal
            title="Новый проект"
            label={`Название проекта · ${selectedTeam?.name ?? ''}`}
            submitLabel="Создать"
            busy={busy}
            onSubmit={createProject}
            onClose={() => setProjectModal(null)}
          />
        ) : (
          <FormModal
            title="Переименовать проект"
            label="Название проекта"
            initialValue={projectModal.project.name}
            submitLabel="Сохранить"
            busy={busy}
            onSubmit={(name) => updateProject(projectModal.project, name)}
            onClose={() => setProjectModal(null)}
          />
        ))}

      {confirm &&
        (confirm.kind === 'team' ? (
          <ConfirmDialog
            title="Удалить команду?"
            message={
              <>
                Команда «{confirm.team.name}» и все её проекты будут удалены без возможности
                восстановления.
              </>
            }
            confirmLabel="Удалить"
            busy={busy}
            onConfirm={() => deleteTeam(confirm.team)}
            onClose={() => setConfirm(null)}
          />
        ) : (
          <ConfirmDialog
            title="Удалить проект?"
            message={<>Проект «{confirm.project.name}» будет удалён.</>}
            confirmLabel="Удалить"
            busy={busy}
            onConfirm={() => deleteProject(confirm.project)}
            onClose={() => setConfirm(null)}
          />
        ))}

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

function EmptyState({
  text,
  action,
}: {
  text: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-[52px] h-[52px] rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
        <FolderIcon size={24} strokeWidth={1.6} />
      </div>
      <div className="text-sm text-muted max-w-[340px] leading-[1.55]">{text}</div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-[7px] h-[38px] px-4 rounded-[9px] bg-accent text-white text-[13.5px] font-semibold cursor-pointer hover:bg-accent-deep font-ui"
        >
          <PlusIcon size={15} strokeWidth={2} />
          {action.label}
        </button>
      )}
    </div>
  )
}

function SectionPlaceholder({ section }: { section: Section }) {
  const { Icon, label } = section
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-[56px] h-[56px] rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
        <Icon size={26} strokeWidth={1.6} />
      </div>
      <div>
        <div className="text-[17px] font-bold text-ink">{label}</div>
        <div className="text-sm text-faint mt-1.5 max-w-[360px] leading-[1.55]">
          Раздел «{label}» в разработке — здесь появится его содержимое.
        </div>
      </div>
    </div>
  )
}
