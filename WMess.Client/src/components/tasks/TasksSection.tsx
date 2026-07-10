import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../../api'
import { useAuth } from '../../context/AuthContext'
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  tasksApi,
  type TaskBoardColumn,
  type TaskItem,
  type TaskLabel,
  type TeamHoliday,
  type TeamScheduleSettings,
} from '../../api/tasksApi'
import type { TeamMemberResponse } from '../../api/generated/data-contracts'
import { TaskListView } from './TaskListView'
import { TaskKanbanView } from './TaskKanbanView'
import { TaskTimelineView } from './TaskTimelineView'
import { TaskDetailPanel } from './TaskDetailPanel'
import { TaskColumnSettingsModal } from './TaskColumnSettingsModal'
import { TimelineSettingsModal } from './TimelineSettingsModal'
import { FormModal } from '../WorkspaceModals'
import { PlusIcon, SettingsIcon } from '../../workspace/icons'

type ViewMode = 'list' | 'kanban' | 'timeline'
type ScopeMode = 'project' | 'team'

interface TasksSectionProps {
  teamId: number
  projectId: number
  canManage: boolean
  taskId?: string
}

export function TasksSection({ teamId, projectId, canManage, taskId }: TasksSectionProps) {
  const { user } = useAuth()
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem('wmess-tasks-view') as ViewMode) || 'kanban')
  const [scope, setScope] = useState<ScopeMode>('project')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [columns, setColumns] = useState<TaskBoardColumn[]>([])
  const [labels, setLabels] = useState<TaskLabel[]>([])
  const [members, setMembers] = useState<TeamMemberResponse[]>([])
  const [schedule, setSchedule] = useState<TeamScheduleSettings | null>(null)
  const [holidays, setHolidays] = useState<TeamHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(taskId ?? null)
  const [showColumns, setShowColumns] = useState(false)
  const [showTimelineSettings, setShowTimelineSettings] = useState(false)
  const [filterMine, setFilterMine] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const taskParams =
        scope === 'project'
          ? { projectId }
          : { teamId, scope: 'all' as const }

      const [tasksRes, colsRes, labelsRes, membersRes, schedRes, holRes] = await Promise.all([
        tasksApi.list(taskParams),
        tasksApi.getColumns(teamId),
        tasksApi.getLabels(teamId),
        apiClient.teams.teamsMembersList(teamId),
        tasksApi.getScheduleSettings(teamId),
        tasksApi.getHolidays(teamId),
      ])

      setTasks(tasksRes.data)
      setColumns(colsRes.data)
      setLabels(labelsRes.data)
      setMembers(membersRes.data ?? [])
      setSchedule(schedRes.data)
      setHolidays(holRes.data)
    } catch {
      setError('Не удалось загрузить задачи')
    } finally {
      setLoading(false)
    }
  }, [teamId, projectId, scope])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    localStorage.setItem('wmess-tasks-view', view)
  }, [view])

  useEffect(() => {
    if (taskId) setSelectedId(taskId)
  }, [taskId])

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null

  const visibleTasks = filterMine && user?.email
    ? tasks.filter((t) => t.assignees.some((a) => a.email === user.email))
    : tasks

  async function createTask(title: string) {
    setBusy(true)
    try {
      const defaultCol = columns.find((c) => !c.isDoneColumn) ?? columns[0]
      await tasksApi.create({
        title,
        projectId: scope === 'project' ? projectId : undefined,
        teamId: scope === 'team' ? teamId : undefined,
        columnId: defaultCol?.id,
      })
      setShowCreateTask(false)
      await load()
    } catch {
      setError('Не удалось создать задачу')
    } finally {
      setBusy(false)
    }
  }

  async function recalculate() {
    setBusy(true)
    try {
      await tasksApi.recalculate(teamId, { projectId: scope === 'project' ? projectId : undefined })
      await load()
    } catch {
      setError('Не удалось пересчитать расписание')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line bg-panel">
        <div className="flex rounded-lg border border-line overflow-hidden">
          {(['list', 'kanban', 'timeline'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-[13px] font-semibold font-ui ${
                view === v ? 'bg-accent text-white' : 'bg-white text-muted hover:bg-sidebar'
              }`}
            >
              {v === 'list' ? 'Список' : v === 'kanban' ? 'Kanban' : 'Таймлайн'}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-line overflow-hidden">
          <button
            type="button"
            onClick={() => setScope('project')}
            className={`px-3 py-1.5 text-[13px] font-semibold font-ui ${
              scope === 'project' ? 'bg-accent-soft text-accent' : 'bg-white text-muted'
            }`}
          >
            Проект
          </button>
          <button
            type="button"
            onClick={() => setScope('team')}
            className={`px-3 py-1.5 text-[13px] font-semibold font-ui ${
              scope === 'team' ? 'bg-accent-soft text-accent' : 'bg-white text-muted'
            }`}
          >
            Вся команда
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => setShowCreateTask(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-white text-[13px] font-semibold font-ui disabled:opacity-60"
        >
          <PlusIcon size={14} /> Задача
        </button>

        {view === 'kanban' && (
          <button
            type="button"
            onClick={() => setShowColumns(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line bg-white text-[13px] font-semibold text-muted font-ui"
          >
            <SettingsIcon size={15} /> Колонки
          </button>
        )}

        {view === 'timeline' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void recalculate()}
              className="h-8 px-3 rounded-lg border border-line bg-white text-[13px] font-semibold text-muted font-ui disabled:opacity-60"
            >
              Пересчитать
            </button>
            <button
              type="button"
              onClick={() => setShowTimelineSettings(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line bg-white text-[13px] font-semibold text-muted font-ui"
            >
              <SettingsIcon size={15} /> Календарь
            </button>
          </>
        )}

        <label className="ml-auto flex items-center gap-2 text-[13px] text-muted font-ui cursor-pointer">
          <input type="checkbox" checked={filterMine} onChange={(e) => setFilterMine(e.target.checked)} />
          Мои задачи
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted text-sm">Загрузка…</div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-[#c44] text-sm">{error}</div>
        ) : view === 'list' ? (
          <TaskListView
            tasks={visibleTasks}
            onSelect={setSelectedId}
            onRefresh={load}
          />
        ) : view === 'kanban' ? (
          <TaskKanbanView
            tasks={visibleTasks}
            columns={columns}
            onSelect={setSelectedId}
            onRefresh={load}
          />
        ) : (
          <TaskTimelineView
            tasks={visibleTasks}
            members={members}
            schedule={schedule}
            holidays={holidays}
            onSelect={setSelectedId}
            onRefresh={load}
          />
        )}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          columns={columns}
          labels={labels}
          members={members}
          teamId={teamId}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
        />
      )}

      {showColumns && (
        <TaskColumnSettingsModal
          teamId={teamId}
          columns={columns}
          canManage={canManage}
          onClose={() => setShowColumns(false)}
          onChanged={load}
        />
      )}

      {showTimelineSettings && schedule && (
        <TimelineSettingsModal
          teamId={teamId}
          settings={schedule}
          holidays={holidays}
          canManage={canManage}
          onClose={() => setShowTimelineSettings(false)}
          onChanged={load}
        />
      )}

      {showCreateTask && (
        <FormModal
          title="Новая задача"
          label="Название"
          submitLabel="Создать"
          busy={busy}
          onClose={() => setShowCreateTask(false)}
          onSubmit={(title) => void createTask(title)}
        />
      )}
    </div>
  )
}

export { PRIORITY_LABELS, PRIORITY_COLORS }
