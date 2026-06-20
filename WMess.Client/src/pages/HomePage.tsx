import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'
import type { ProjectResponse, TeamResponse } from '../api/generated/data-contracts'
import { TeamRail } from '../components/TeamRail'
import { ProjectSidebar } from '../components/ProjectSidebar'
import { ConfirmDialog, FormModal } from '../components/WorkspaceModals'
import { colorFor, initials } from '../workspace/theme'
import { FolderIcon, PencilIcon, PlusIcon, TrashIcon } from '../workspace/icons'

type TeamModal = { mode: 'create' } | { mode: 'edit'; team: TeamResponse }
type ProjectModal = { mode: 'create' } | { mode: 'edit'; project: ProjectResponse }
type Confirm = { kind: 'team'; team: TeamResponse } | { kind: 'project'; project: ProjectResponse }

export function HomePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const [teams, setTeams] = useState<TeamResponse[]>([])
  const [projects, setProjects] = useState<ProjectResponse[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [teamModal, setTeamModal] = useState<TeamModal | null>(null)
  const [projectModal, setProjectModal] = useState<ProjectModal | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([apiClient.teams.teamsList(), apiClient.projects.projectsList()])
      .then(([teamRes, projectRes]) => {
        const teamList = teamRes.data ?? []
        setTeams(teamList)
        setProjects(projectRes.data ?? [])
        if (teamList.length > 0) setSelectedTeamId(Number(teamList[0].id))
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

  // Fall back to the first project when the explicit selection isn't in the
  // active team (after switching teams or deleting the selected project).
  const selectedProject =
    teamProjects.find((p) => Number(p.id) === selectedProjectId) ?? teamProjects[0]
  const activeProjectId = selectedProject ? Number(selectedProject.id) : null

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
      setSelectedTeamId(Number(res.data.id))
      setTeamModal(null)
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
      if (selectedTeamId === id) {
        setSelectedTeamId(remaining.length ? Number(remaining[0].id) : null)
      }
      setConfirm(null)
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
      setSelectedProjectId(Number(res.data.id))
      setProjectModal(null)
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
    } catch {
      setError('Не удалось удалить проект')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wm-scroll fixed inset-0 flex bg-app text-ink font-ui text-sm text-left antialiased">
      <TeamRail
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelect={setSelectedTeamId}
        onCreate={() => setTeamModal({ mode: 'create' })}
        userEmail={user?.email}
        onLogout={handleLogout}
      />

      <ProjectSidebar
        team={selectedTeam}
        projects={teamProjects}
        selectedProjectId={activeProjectId}
        onSelectProject={setSelectedProjectId}
        onCreateProject={() => setProjectModal({ mode: 'create' })}
        onEditProject={(project) => setProjectModal({ mode: 'edit', project })}
        onDeleteProject={(project) => setConfirm({ kind: 'project', project })}
        onEditTeam={() => selectedTeam && setTeamModal({ mode: 'edit', team: selectedTeam })}
        onDeleteTeam={() => selectedTeam && setConfirm({ kind: 'team', team: selectedTeam })}
      />

      {/* MAIN */}
      <div className="flex-1 min-w-0 flex flex-col bg-panel">
        <div className="h-[60px] shrink-0 border-b border-line flex items-center px-[22px]">
          <div className="min-w-0">
            <div className="font-mono text-[10.5px] text-faintest tracking-[.02em]">
              {selectedTeam ? selectedTeam.name : 'WMess'}
            </div>
            <div className="text-base font-bold mt-px truncate">
              {selectedProject ? selectedProject.name : selectedTeam ? 'Проекты' : 'Добро пожаловать'}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <EmptyState text="Загрузка…" />
          ) : teams.length === 0 ? (
            <EmptyState
              text="У вас пока нет команд. Создайте первую, чтобы начать работу."
              action={{ label: 'Создать команду', onClick: () => setTeamModal({ mode: 'create' }) }}
            />
          ) : !selectedProject ? (
            <EmptyState
              text="Выберите проект слева или создайте новый в этой команде."
              action={{ label: 'Новый проект', onClick: () => setProjectModal({ mode: 'create' }) }}
            />
          ) : (
            <ProjectDetail
              project={selectedProject}
              teamName={selectedTeam?.name}
              onEdit={() => setProjectModal({ mode: 'edit', project: selectedProject })}
              onDelete={() => setConfirm({ kind: 'project', project: selectedProject })}
            />
          )}
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

function ProjectDetail({
  project,
  teamName,
  onEdit,
  onDelete,
}: {
  project: ProjectResponse
  teamName: string | undefined
  onEdit: () => void
  onDelete: () => void
}) {
  const created = project.createdAt ? new Date(project.createdAt).toLocaleDateString('ru-RU') : '—'
  const metaBtn =
    'inline-flex items-center gap-[7px] h-[34px] px-[13px] rounded-[9px] border border-line bg-white text-[13px] font-semibold cursor-pointer hover:bg-sidebar font-ui'

  return (
    <div className="px-8 pt-8 pb-[50px] max-w-[760px] mx-auto">
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl text-white flex items-center justify-center text-[18px] font-bold shrink-0"
          style={{ background: colorFor(Number(project.id)) }}
        >
          {initials(project.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] text-faintest">{teamName} / Проект</div>
          <h1 className="text-[28px] font-extrabold tracking-[-.5px] mt-1.5 mb-0">{project.name}</h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" className={metaBtn} onClick={onEdit}>
            <PencilIcon size={15} />
            Переименовать
          </button>
          <button type="button" className={`${metaBtn} text-danger`} onClick={onDelete}>
            <TrashIcon size={15} />
            Удалить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 my-7">
        <InfoCard label="Команда" value={teamName ?? '—'} />
        <InfoCard label="Создан" value={created} />
      </div>

      <div className="border border-line rounded-2xl bg-white px-6 py-7 text-center text-faint text-sm leading-[1.6]">
        Здесь появятся чат, документы и задачи проекта.
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line rounded-xl bg-white px-4 py-3.5">
      <div className="font-mono text-[10.5px] tracking-[.06em] uppercase text-faintest">{label}</div>
      <div className="text-[15px] font-semibold text-ink mt-[5px]">{value}</div>
    </div>
  )
}
