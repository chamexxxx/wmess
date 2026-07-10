import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../../api'
import { useTasksLive } from '../../providers/useTasksLive'
import {
  PRIORITY_LABELS,
  tasksApi,
  type TaskBoardColumn,
  type TaskGroup,
  type TaskItem,
  type TeamHoliday,
  type TeamScheduleSettings,
} from '../../api/tasksApi'
import type { TeamMemberResponse } from '../../api/generated/data-contracts'
import { TaskListView } from './TaskListView'
import { TaskKanbanView } from './TaskKanbanView'
import { TaskTimelineView } from './TaskTimelineView'
import { TaskDetailPanel } from './TaskDetailPanel'
import { TasksSettingsModal } from './TasksSettingsModal'
import { CreateTaskModal } from './CreateTaskModal'
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
  const liveSignal = useTasksLive(teamId)
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem('wmess-tasks-view') as ViewMode) || 'kanban')
  const [scope, setScope] = useState<ScopeMode>('project')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [columns, setColumns] = useState<TaskBoardColumn[]>([])
  const [groups, setGroups] = useState<TaskGroup[]>([])
  const [members, setMembers] = useState<TeamMemberResponse[]>([])
  const [schedule, setSchedule] = useState<TeamScheduleSettings | null>(null)
  const [holidays, setHolidays] = useState<TeamHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(taskId ?? null)
  const [showSettings, setShowSettings] = useState(false)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [calendarFromToday, setCalendarFromToday] = useState(
    () => localStorage.getItem(`wmess-calendar-from-today-${teamId}`) !== 'false',
  )

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const taskParams =
        scope === 'project'
          ? { projectId }
          : { teamId, scope: 'all' as const }

      const [tasksRes, colsRes, groupsRes, membersRes, schedRes, holRes] = await Promise.all([
        tasksApi.list(taskParams),
        tasksApi.getColumns(teamId),
        tasksApi.getGroups(teamId),
        apiClient.teams.teamsMembersList(teamId),
        tasksApi.getScheduleSettings(teamId),
        tasksApi.getHolidays(teamId),
      ])

      setTasks(tasksRes.data)
      setColumns(colsRes.data)
      setGroups(groupsRes.data)
      setMembers(membersRes.data ?? [])
      setSchedule(schedRes.data)
      setHolidays(holRes.data)
    } catch {
      setError('Не удалось загрузить задачи')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [teamId, projectId, scope])

  const reloadSilent = useCallback(() => load({ silent: true }), [load])

  const mergeTask = useCallback((updated: TaskItem) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === updated.id)
      if (idx < 0) return prev
      const next = [...prev]
      next[idx] = updated
      return next
    })
  }, [])

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (liveSignal === 0) return
    void load({ silent: true })
  }, [liveSignal, load])

  useEffect(() => {
    localStorage.setItem('wmess-tasks-view', view)
  }, [view])

  useEffect(() => {
    if (taskId) setSelectedId(taskId)
  }, [taskId])

  useEffect(() => {
    setCalendarFromToday(localStorage.getItem(`wmess-calendar-from-today-${teamId}`) !== 'false')
  }, [teamId])

  const matchesAssignee = (t: TaskItem, id: string) =>
    !id || t.assignedUserIds.includes(id) || t.primaryAssigneeId === id

  const visibleTasks = tasks.filter((t) => {
    if (!matchesAssignee(t, filterAssignee)) return false
    if (filterPriority !== '' && t.priority !== Number(filterPriority)) return false
    return true
  })

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
          disabled={false}
          onClick={() => setShowCreateTask(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-white text-[13px] font-semibold font-ui"
        >
          <PlusIcon size={14} /> Задача
        </button>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line bg-white text-[13px] font-semibold text-muted font-ui"
        >
          <SettingsIcon size={15} /> Настройки
        </button>
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-2 border-b border-line bg-white">
        <label className="flex items-center gap-2 text-[13px] text-muted font-ui">
          <span className="text-faint text-[11px] uppercase font-bold">Исполнитель</span>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="border border-line rounded-lg px-2 py-1 text-[13px] min-w-[140px]"
          >
            <option value="">Все</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId ?? ''}>
                {m.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted font-ui">
          <span className="text-faint text-[11px] uppercase font-bold">Приоритет</span>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="border border-line rounded-lg px-2 py-1 text-[13px] min-w-[120px]"
          >
            <option value="">Все</option>
            {PRIORITY_LABELS.map((l, i) => (
              <option key={l} value={i}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted text-sm">Загрузка…</div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-[#c44] text-sm">{error}</div>
        ) : view === 'list' ? (
          <TaskListView tasks={visibleTasks} groups={groups} onSelect={setSelectedId} />
        ) : view === 'kanban' ? (
          <TaskKanbanView
            tasks={visibleTasks}
            columns={columns}
            groups={groups}
            onSelect={setSelectedId}
            onTaskUpdated={mergeTask}
          />
        ) : (
          <TaskTimelineView
            tasks={tasks}
            filterAssignee={filterAssignee}
            filterPriority={filterPriority}
            groups={groups}
            members={members}
            schedule={schedule}
            holidays={holidays}
            teamId={teamId}
            projectId={scope === 'project' ? projectId : undefined}
            calendarFromToday={calendarFromToday}
            onSelect={setSelectedId}
            onTaskUpdated={mergeTask}
            onRefresh={reloadSilent}
          />
        )}
      </div>

      {selectedId && (
        <TaskDetailPanel
          key={selectedId}
          taskId={selectedId}
          initialTask={tasks.find((t) => t.id === selectedId) ?? null}
          columns={columns}
          groups={groups}
          members={members}
          refreshSignal={liveSignal}
          onClose={() => setSelectedId(null)}
          onUpdated={mergeTask}
          onDeleted={removeTask}
        />
      )}

      {showSettings && schedule && (
        <TasksSettingsModal
          teamId={teamId}
          columns={columns}
          groups={groups}
          schedule={schedule}
          holidays={holidays}
          canManage={canManage}
          onClose={() => setShowSettings(false)}
          onChanged={load}
          onCalendarFromTodayChanged={setCalendarFromToday}
        />
      )}

      {showCreateTask && (
        <CreateTaskModal
          columns={columns}
          groups={groups}
          members={members}
          scope={scope}
          projectId={projectId}
          teamId={teamId}
          onClose={() => setShowCreateTask(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}

export { PRIORITY_LABELS }
