import { useEffect, useMemo, useState } from 'react'
import { useMatch, useNavigate, useParams } from 'react-router'
import { apiClient } from '../api'
import type { ProjectResponse, TeamResponse, TeamDetailResponse } from '../api/generated/data-contracts'
import { ProjectSidebar } from '../components/ProjectSidebar'
import { LibrarySection } from '../components/LibrarySection'
import { ProjectSettings } from '../components/ProjectSettings'
import { TeamSettings } from '../components/TeamSettings'
import { ConfirmDialog, FormModal } from '../components/WorkspaceModals'
import { useWorkspace } from '../components/workspaceContext'
import { FolderIcon, PlusIcon, SettingsIcon } from '../workspace/icons'
import { ChatsSection } from '../features/chat/ChatsSection'
import { DEFAULT_SECTION, sectionById, type Section } from '../workspace/sections'


type ProjectModal = { mode: 'create' } | { mode: 'edit'; project: ProjectResponse }
type Confirm = { kind: 'team'; team: TeamResponse } | { kind: 'project'; project: ProjectResponse }

export function HomePage() {
  const navigate = useNavigate()
  // Команды/проекты и общие действия берём из каркаса рабочего пространства.
  const { teams, setTeams, projects, setProjects, openCreateTeam, setError } = useWorkspace()

  // Selection lives in the URL: /teams/:teamId/projects/:projectId/:section
  // Открытый документ — отдельный маршрут: /teams/:teamId/projects/:projectId/library/:itemId
  // Открытый чат — /teams/:teamId/projects/:projectId/chats/:chatId
  const { teamId: teamIdParam, projectId: projectIdParam, section: sectionParam, itemId: itemIdParam, chatId: chatIdParam } = useParams()
  const selectedTeamId = teamIdParam ? Number(teamIdParam) : null
  const selectedProjectId = projectIdParam ? Number(projectIdParam) : null
  // На маршруте документа/чата сегмент :section отсутствует — выводим нужный раздел.
  const sectionKey = itemIdParam != null ? 'library' : chatIdParam != null ? 'chats' : sectionParam
  // Страница настроек команды: /teams/:teamId/settings (отдельно от настроек проекта).
  const isTeamSettings = useMatch('/teams/:teamId/settings') != null

  const [projectModal, setProjectModal] = useState<ProjectModal | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [busy, setBusy] = useState(false)
  // Детали выбранной команды (включая права). Грузятся только на странице команды.
  const [teamDetail, setTeamDetail] = useState<TeamDetailResponse | null>(null)
  const [teamDetailRefresh, setTeamDetailRefresh] = useState(0)

  // Детали команды (с правами текущего пользователя) — только когда выбрана команда.
  // teamDetail не сбрасываем синхронно: ниже права берутся только при совпадении id.
  useEffect(() => {
    if (selectedTeamId == null) return
    let cancelled = false
    apiClient.teams
      .teamsDetail(selectedTeamId)
      .then((res) => {
        if (!cancelled) setTeamDetail(res.data)
      })
      .catch(() => {
        if (!cancelled) setTeamDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedTeamId, teamDetailRefresh])

  const selectedTeam = teams.find((t) => Number(t.id) === selectedTeamId)
  const teamProjects = useMemo(
    () => projects.filter((p) => Number(p.teamId) === selectedTeamId),
    [projects, selectedTeamId],
  )
  const selectedProject = teamProjects.find((p) => Number(p.id) === selectedProjectId)
  const section = sectionById(sectionKey)
  const isSettings = sectionKey === 'settings'

  // Права берём только из деталей текущей команды; до их загрузки действия скрыты (fail-safe).
  const perms = Number(teamDetail?.id) === selectedTeamId ? teamDetail?.permissions : undefined
  const canManage = perms?.canManage ?? false
  const canDelete = perms?.canDelete ?? false

  // Keep the URL pointing at something real: land on the first team, default to
  // the first section, and bounce off ids/sections that don't exist.
  useEffect(() => {
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
  }, [selectedTeamId, selectedProjectId, selectedProject, section, isSettings, teams, navigate])

  // ---- teams ----
  const updateTeam = async (id: number, name: string) => {
    setBusy(true)
    try {
      await apiClient.teams.teamsUpdate(id, { name })
      setTeams((prev) => prev.map((t) => (Number(t.id) === id ? { ...t, name } : t)))
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
    <>
      <ProjectSidebar
        team={selectedTeam}
        projects={teamProjects}
        selectedProjectId={selectedProjectId}
        selectedSectionId={isSettings ? 'settings' : section?.id}
        teamSettingsActive={isTeamSettings}
        onSelectProject={(id) =>
          navigate(`/teams/${selectedTeamId}/projects/${id}/${section?.id ?? DEFAULT_SECTION}`)
        }
        onSelectSection={(sectionId) =>
          navigate(`/teams/${selectedTeamId}/projects/${selectedProjectId}/${sectionId}`)
        }
        onCreateProject={() => setProjectModal({ mode: 'create' })}
        onEditProject={(project) => setProjectModal({ mode: 'edit', project })}
        onDeleteProject={(project) => setConfirm({ kind: 'project', project })}
        onOpenTeamSettings={() => selectedTeamId && navigate(`/teams/${selectedTeamId}/settings`)}
        canManage={canManage}
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
                  {isSettings ? 'Настройки проекта' : (section?.label ?? 'Проект')}
                </span>
              </nav>
              {canManage && (
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
              )}
            </>
          ) : isTeamSettings && selectedTeam ? (
            <nav className="flex items-center gap-2 min-w-0 text-[14px]">
              <button
                type="button"
                className="font-semibold text-ink truncate hover:text-accent transition-colors cursor-pointer"
                onClick={() => navigate(`/teams/${selectedTeamId}`)}
              >
                {selectedTeam.name}
              </button>
              <span className="text-faintest shrink-0">/</span>
              <span className="text-muted truncate">Настройки команды</span>
            </nav>
          ) : (
            <div className="text-base font-bold truncate">{title}</div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {teams.length === 0 ? (
            <EmptyState
              text="У вас пока нет команд. Создайте первую, чтобы начать работу."
              action={{ label: 'Создать команду', onClick: openCreateTeam }}
            />
          ) : !selectedTeam ? null : isTeamSettings ? (
            <TeamSettings
              team={selectedTeam}
              permissions={perms}
              busy={busy}
              canManage={canManage}
              canDelete={canDelete}
              onRename={(name) => updateTeam(selectedTeamId!, name)}
              onDelete={() => setConfirm({ kind: 'team', team: selectedTeam })}
              onMembersChanged={() => setTeamDetailRefresh((n) => n + 1)}
            />
          ) : !selectedProject ? (
            <EmptyState
              text="Выберите проект слева или создайте новый в этой команде."
              action={{ label: 'Новый проект', onClick: () => setProjectModal({ mode: 'create' }) }}
            />
          ) : isSettings ? (
            <ProjectSettings
              project={selectedProject}
              busy={busy}
              canManage={canManage}
              onRename={(name) => updateProject(selectedProject, name)}
              onDelete={() => setConfirm({ kind: 'project', project: selectedProject })}
            />
          ) : section?.id === 'library' ? (
            <LibrarySection projectId={selectedProjectId!} />
          ) : section?.id === 'chats' ? (
            <ChatsSection projectId={selectedProjectId!} teamId={selectedTeamId!} />
          ) : section ? (
            <SectionPlaceholder section={section} />
          ) : null}
        </div>
      </div>

      {/* MODALS */}
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
    </>
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
