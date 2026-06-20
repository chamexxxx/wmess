import { useState } from 'react'
import type { ProjectResponse, TeamResponse } from '../api/generated/data-contracts'
import { accent, c, colorFor, font } from '../workspace/theme'
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from '../workspace/icons'

interface ProjectSidebarProps {
  team: TeamResponse | undefined
  projects: ProjectResponse[]
  selectedProjectId: number | null
  onSelectProject: (id: number) => void
  onCreateProject: () => void
  onEditProject: (project: ProjectResponse) => void
  onDeleteProject: (project: ProjectResponse) => void
  onEditTeam: () => void
  onDeleteTeam: () => void
}

const sectionLabel: React.CSSProperties = {
  fontFamily: font.mono,
  fontSize: 10.5,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: c.textFaintest,
}

const headerIconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: c.textFaint,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const rowActionBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: c.textFaint,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
}

export function ProjectSidebar({
  team,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onEditTeam,
  onDeleteTeam,
}: ProjectSidebarProps) {
  const [query, setQuery] = useState('')

  const shell = (children: React.ReactNode) => (
    <div
      style={{
        width: 264,
        flex: 'none',
        background: c.sidebarBg,
        borderRight: `1px solid ${c.border}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  )

  if (!team) {
    return shell(
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          fontSize: 13,
          color: c.textFaint,
          lineHeight: 1.5,
        }}
      >
        Создайте команду в левой панели, чтобы добавлять проекты.
      </div>,
    )
  }

  const filtered = projects.filter((p) =>
    (p.name ?? '').toLowerCase().includes(query.trim().toLowerCase()),
  )

  return shell(
    <>
      {/* Team header with edit/delete actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '16px 14px 12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: c.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {team.name}
          </div>
          <div style={{ ...sectionLabel, textTransform: 'none', letterSpacing: 0, marginTop: 1 }}>
            {projects.length} проект(ов)
          </div>
        </div>
        <button
          type="button"
          className="wm-icon-btn"
          style={headerIconBtn}
          title="Переименовать команду"
          onClick={onEditTeam}
        >
          <PencilIcon size={15} />
        </button>
        <button
          type="button"
          className="wm-icon-btn"
          style={headerIconBtn}
          title="Удалить команду"
          onClick={onDeleteTeam}
        >
          <TrashIcon size={15} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: c.panelBg,
            border: `1px solid ${c.border}`,
            borderRadius: 9,
            padding: '7px 10px',
          }}
        >
          <SearchIcon size={15} color={c.textFaint} strokeWidth={1.8} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск проектов"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 13,
              color: c.text,
              fontFamily: font.sans,
            }}
          />
        </div>
      </div>

      {/* Projects section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px 4px',
        }}
      >
        <span style={sectionLabel}>Проекты</span>
        <button
          type="button"
          className="wm-icon-btn"
          style={{ ...headerIconBtn, width: 24, height: 24 }}
          title="Новый проект"
          onClick={onCreateProject}
        >
          <PlusIcon size={15} strokeWidth={1.8} />
        </button>
      </div>

      {/* Project list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: '20px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: c.textFaint, marginBottom: 12 }}>
              {projects.length === 0 ? 'Пока нет проектов' : 'Ничего не найдено'}
            </div>
            {projects.length === 0 && (
              <button
                type="button"
                onClick={onCreateProject}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 12px',
                  borderRadius: 9,
                  border: 'none',
                  background: accent.base,
                  color: c.white,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: font.sans,
                }}
              >
                <PlusIcon size={14} strokeWidth={2} />
                Создать проект
              </button>
            )}
          </div>
        ) : (
          filtered.map((project) => {
            const id = Number(project.id)
            const active = id === selectedProjectId
            return (
              <div
                key={id}
                className="wm-proj-row wm-hover"
                onClick={() => onSelectProject(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '7px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: active ? accent.soft : 'transparent',
                  color: active ? accent.hover : c.textMuted,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: colorFor(id),
                    flex: 'none',
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    color: active ? accent.hover : c.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {project.name}
                </span>
                <div className="wm-row-actions" style={{ display: 'flex', gap: 2 }}>
                  <button
                    type="button"
                    className="wm-icon-btn"
                    style={rowActionBtn}
                    title="Переименовать проект"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditProject(project)
                    }}
                  >
                    <PencilIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="wm-icon-btn"
                    style={rowActionBtn}
                    title="Удалить проект"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteProject(project)
                    }}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>,
  )
}
