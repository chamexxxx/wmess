import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'
import type { ProjectResponse, TeamResponse } from '../api/generated/data-contracts'
import { TeamRail } from '../components/TeamRail'
import { ProjectSidebar } from '../components/ProjectSidebar'
import { ConfirmDialog, FormModal } from '../components/WorkspaceModals'
import { accent, c, colorFor, font, initials } from '../workspace/theme'
import { FolderIcon, PencilIcon, PlusIcon, TrashIcon } from '../workspace/icons'
import '../workspace/workspace.css'

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
    <div
      className="wm-root"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        background: c.appBg,
        color: c.text,
        fontFamily: font.sans,
        fontSize: 14,
        textAlign: 'left',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: c.panelBg }}>
        <div
          style={{
            height: 60,
            flex: 'none',
            borderBottom: `1px solid ${c.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 22px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: font.mono, fontSize: 10.5, color: c.textFaintest, letterSpacing: '.02em' }}>
              {selectedTeam ? selectedTeam.name : 'WMess'}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedProject ? selectedProject.name : selectedTeam ? 'Проекты' : 'Добро пожаловать'}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#2a1215',
            color: '#ff9d8a',
            border: '1px solid #5c2b2e',
            borderRadius: 10,
            padding: '10px 16px',
            fontSize: 13,
            cursor: 'pointer',
            zIndex: 200,
            boxShadow: '0 10px 30px rgba(0,0,0,.2)',
          }}
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
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: accent.soft,
          color: accent.base,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FolderIcon size={24} strokeWidth={1.6} />
      </div>
      <div style={{ fontSize: 14, color: c.textMuted, maxWidth: 340, lineHeight: 1.55 }}>{text}</div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            height: 38,
            padding: '0 16px',
            borderRadius: 9,
            border: 'none',
            background: accent.base,
            color: c.white,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: font.sans,
          }}
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

  const metaBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    height: 34,
    padding: '0 13px',
    borderRadius: 9,
    border: `1px solid ${c.border}`,
    background: c.white,
    color: c.textMuted,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font.sans,
  }

  return (
    <div style={{ padding: '32px 32px 50px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: colorFor(Number(project.id)),
            color: c.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            flex: 'none',
          }}
        >
          {initials(project.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.mono, fontSize: 11, color: c.textFaintest }}>
            {teamName} / Проект
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.5px', margin: '6px 0 0' }}>
            {project.name}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <button type="button" className="wm-btn-ghost" style={metaBtn} onClick={onEdit}>
            <PencilIcon size={15} />
            Переименовать
          </button>
          <button
            type="button"
            className="wm-btn-ghost"
            style={{ ...metaBtn, color: c.danger }}
            onClick={onDelete}
          >
            <TrashIcon size={15} />
            Удалить
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          margin: '28px 0',
        }}
      >
        <InfoCard label="Команда" value={teamName ?? '—'} />
        <InfoCard label="Создан" value={created} />
      </div>

      <div
        style={{
          border: `1px solid ${c.border}`,
          borderRadius: 14,
          background: c.white,
          padding: '28px 24px',
          textAlign: 'center',
          color: c.textFaint,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        Здесь появятся чат, документы и задачи проекта.
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        background: c.white,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontFamily: font.mono,
          fontSize: 10.5,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: c.textFaintest,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: c.text, marginTop: 5 }}>{value}</div>
    </div>
  )
}
