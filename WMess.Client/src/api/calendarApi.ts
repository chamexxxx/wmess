import { apiClient } from './index'

const http = apiClient.teams.instance

export interface CalendarEvent {
  id: string
  title: string
  description?: string | null
  location?: string | null
  startUtc: string
  endUtc: string
  allDay: boolean
  projectId: number
  createdById: string
  createdByEmail: string
  createdAt: string
  updatedAt: string
}

export interface CreateCalendarEventBody {
  title: string
  description?: string
  location?: string
  startUtc: string
  endUtc: string
  allDay: boolean
  projectId: number
}

export interface UpdateCalendarEventBody {
  title: string
  description?: string
  location?: string
  startUtc: string
  endUtc: string
  allDay: boolean
}

export const calendarApi = {
  list(params: { projectId: number; from?: string; to?: string }) {
    return http.get<CalendarEvent[]>('/api/calendar-events', { params })
  },

  get(id: string) {
    return http.get<CalendarEvent>(`/api/calendar-events/${id}`)
  },

  create(body: CreateCalendarEventBody) {
    return http.post<CalendarEvent>('/api/calendar-events', body)
  },

  update(id: string, body: UpdateCalendarEventBody) {
    return http.put<CalendarEvent>(`/api/calendar-events/${id}`, body)
  },

  remove(id: string) {
    return http.delete(`/api/calendar-events/${id}`)
  },
}
