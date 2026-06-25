import { useState } from 'react'
import type { ProjectResponse, TeamResponse } from '../api/generated/data-contracts'
import { colorFor } from '../workspace/theme'
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon, UsersIcon } from '../workspace/icons'
import { sections } from '../workspace/sections'

interface ProjectSidebarProps {
  team: TeamResponse | undefined
  projects: ProjectResponse[]
  selectedProjectId: number | null
  selectedSectionId: string | undefined
  onSelectProject: (id: number) => void
  onSelectSection: (sectionId: string) => void
  onCreateProject: () => void
  onEditProject: (project: ProjectResponse) => void
  onDeleteProject: (project: ProjectResponse) => void
  onEditTeam: () => void
  onDeleteTeam: () => void
  onManageMembers: () => void
  // Owner/Admin — управление командой и проектами; Owner — ещё и удаление команды.
  canManage: boolean
  canDelete: boolean
}

const sectionLabel = 'font-mono text-[10.5px] tracking-[.06em] uppercase text-faintest'
const iconBtn =
  'w-7 h-7 rounded-lg flex items-center justify-center text-faint cursor-pointer hover:bg-[#eae8e0]'

export function ProjectSidebar({
  team,
  projects,
  selectedProjectId,
  selectedSectionId,
  onSelectProject,
  onSelectSection,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onEditTeam,
  onDeleteTeam,
  onManageMembers,
  canManage,
  canDelete,
}: ProjectSidebarProps) {
  const [query, setQuery] = useState('')

  if (!team) {
    return (
      <div className="w-[264px] shrink-0 bg-sidebar border-r border-line flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6 text-center text-[13px] text-faint leading-[1.5]">
          Создайте команду в левой панели, чтобы добавлять проекты.
        </div>
      </div>
    )
  }

  const filtered = projects.filter((p) =>
    (p.name ?? '').toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div className="w-[264px] shrink-0 bg-sidebar border-r border-line flex flex-col">
      {/* Team header with edit/delete actions */}
      <div className="flex items-center gap-2 px-[14px] pt-4 pb-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-ink truncate">{team.name}</div>
          <div className="text-[10.5px] text-faintest mt-px">{projects.length} проект(ов)</div>
        </div>
        <button type="button" className={iconBtn} title="Участники команды" onClick={onManageMembers}>
          <UsersIcon size={15} />
        </button>
        {canManage && (
          <button type="button" className={iconBtn} title="Переименовать команду" onClick={onEditTeam}>
            <PencilIcon size={15} />
          </button>
        )}
        {canDelete && (
          <button type="button" className={iconBtn} title="Удалить команду" onClick={onDeleteTeam}>
            <TrashIcon size={15} />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pb-2.5">
        <div className="flex items-center gap-2 bg-panel border border-line rounded-[9px] px-2.5 py-[7px]">
          <SearchIcon size={15} strokeWidth={1.8} className="text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск проектов"
            className="flex-1 min-w-0 border-none bg-transparent outline-none text-[13px] text-ink font-ui"
          />
        </div>
      </div>

      {/* Projects section header */}
      <div className="flex items-center justify-between px-[14px] pt-2.5 pb-1">
        <span className={sectionLabel}>Проекты</span>
        {canManage && (
          <button
            type="button"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-faint cursor-pointer hover:bg-[#eae8e0]"
            title="Новый проект"
            onClick={onCreateProject}
          >
            <PlusIcon size={15} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Project list — the active project expands into its sections */}
      <div className="flex-1 overflow-y-auto px-3 pt-1 pb-3 flex flex-col gap-0.5">
        {filtered.length === 0 ? (
          <div className="px-2 py-5 text-center">
            <div className="text-[13px] text-faint mb-3">
              {projects.length === 0 ? 'Пока нет проектов' : 'Ничего не найдено'}
            </div>
            {projects.length === 0 && canManage && (
              <button
                type="button"
                onClick={onCreateProject}
                className="inline-flex items-center gap-[7px] px-3 py-[7px] rounded-[9px] bg-accent text-white text-[13px] font-semibold cursor-pointer hover:bg-accent-deep font-ui"
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
              <div key={id}>
                <div
                  onClick={() => onSelectProject(id)}
                  className={`group flex items-center gap-[9px] px-2 py-[7px] rounded-lg cursor-pointer ${
                    active ? 'bg-accent-soft' : 'hover:bg-hovered'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-[2px] shrink-0"
                    style={{ background: colorFor(id) }}
                  />
                  <span
                    className={`flex-1 min-w-0 text-[13px] truncate ${
                      active ? 'font-semibold text-accent-deep' : 'font-medium text-ink'
                    }`}
                  >
                    {project.name}
                  </span>
                  {canManage && (
                    <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-faint cursor-pointer hover:bg-[#eae8e0]"
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
                        className="w-6 h-6 rounded-md flex items-center justify-center text-faint cursor-pointer hover:bg-[#eae8e0]"
                        title="Удалить проект"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteProject(project)
                        }}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {active && (
                  <div className="flex flex-col gap-px mt-px mb-1">
                    {sections.map((s) => {
                      const on = s.id === selectedSectionId
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onSelectSection(s.id)}
                          className={`flex items-center gap-[9px] pl-[20px] pr-2 py-[6px] rounded-lg text-[13px] cursor-pointer font-ui ${
                            on
                              ? 'bg-accent-soft text-accent-deep font-semibold'
                              : 'text-muted hover:bg-hovered'
                          }`}
                        >
                          <s.Icon size={16} strokeWidth={1.6} />
                          <span className="flex-1 text-left truncate">{s.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
