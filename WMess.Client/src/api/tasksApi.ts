import { apiClient } from './index'

const http = apiClient.teams.instance

export type TaskPriority = 0 | 1 | 2 | 3
export type ScheduleMode = 0 | 1

export interface TaskBoardColumn {
  id: string
  name: string
  sortOrder: number
  color: string
  isDoneColumn: boolean
}

export interface TaskLabel {
  id: string
  name: string
  color: string
}

export interface TaskItem {
  id: string
  title: string
  description?: string | null
  priority: TaskPriority
  columnId: string
  columnName: string
  columnColor: string
  isDoneColumn: boolean
  sortOrder: number
  startDate?: string | null
  dueDate?: string | null
  estimatedHours: number
  scheduleMode: ScheduleMode
  primaryAssigneeId?: string | null
  primaryAssigneeEmail?: string | null
  createdAt: string
  updatedAt: string
  projectId?: number | null
  teamId?: number | null
  assignedUserIds: string[]
  assignees: { userId: string; email: string }[]
  labels: TaskLabel[]
}

export interface TeamScheduleSettings {
  workingDays: number
  hoursPerDay: number
  timeZone: string
}

export interface TeamHoliday {
  id: string
  date: string
  name?: string | null
}

export const PRIORITY_LABELS = ['Низкий', 'Средний', 'Высокий', 'Критический'] as const
export const PRIORITY_COLORS = ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'] as const

export const tasksApi = {
  list(params: { projectId?: number; teamId?: number; scope?: string }) {
    return http.get<TaskItem[]>('/api/tasks', { params })
  },

  get(id: string) {
    return http.get<TaskItem>(`/api/tasks/${id}`)
  },

  create(body: Record<string, unknown>) {
    return http.post<TaskItem>('/api/tasks', body)
  },

  update(id: string, body: Record<string, unknown>) {
    return http.put(`/api/tasks/${id}`, body)
  },

  patch(id: string, body: Record<string, unknown>) {
    return http.patch<TaskItem>(`/api/tasks/${id}`, body)
  },

  remove(id: string) {
    return http.delete(`/api/tasks/${id}`)
  },

  getColumns(teamId: number) {
    return http.get<TaskBoardColumn[]>(`/api/teams/${teamId}/task-columns`)
  },

  createColumn(teamId: number, body: { name: string; color: string; isDoneColumn: boolean }) {
    return http.post<TaskBoardColumn>(`/api/teams/${teamId}/task-columns`, body)
  },

  updateColumn(teamId: number, columnId: string, body: { name: string; color: string; isDoneColumn: boolean }) {
    return http.put(`/api/teams/${teamId}/task-columns/${columnId}`, body)
  },

  deleteColumn(teamId: number, columnId: string, moveTo?: string) {
    return http.delete(`/api/teams/${teamId}/task-columns/${columnId}`, { params: { moveTo } })
  },

  reorderColumns(teamId: number, items: { id: string; sortOrder: number }[]) {
    return http.put(`/api/teams/${teamId}/task-columns/reorder`, { items })
  },

  getLabels(teamId: number) {
    return http.get<TaskLabel[]>(`/api/teams/${teamId}/task-labels`)
  },

  getScheduleSettings(teamId: number) {
    return http.get<TeamScheduleSettings>(`/api/teams/${teamId}/schedule-settings`)
  },

  updateScheduleSettings(teamId: number, body: TeamScheduleSettings) {
    return http.put(`/api/teams/${teamId}/schedule-settings`, body)
  },

  getHolidays(teamId: number) {
    return http.get<TeamHoliday[]>(`/api/teams/${teamId}/holidays`)
  },

  addHoliday(teamId: number, body: { date: string; name?: string }) {
    return http.post<TeamHoliday>(`/api/teams/${teamId}/holidays`, body)
  },

  deleteHoliday(teamId: number, holidayId: string) {
    return http.delete(`/api/teams/${teamId}/holidays/${holidayId}`)
  },

  recalculate(teamId: number, body?: { anchorDate?: string; projectId?: number }) {
    return http.post<{ updated: number }>(`/api/teams/${teamId}/schedule/recalculate`, body ?? {})
  },

  getComments(taskId: string) {
    return http.get<{ id: string; content: string; createdAt: string; userId: string; userEmail: string }[]>(
      `/api/tasks/${taskId}/comments`,
    )
  },

  addComment(taskId: string, content: string) {
    return http.post(`/api/tasks/${taskId}/comments`, { content })
  },
}
