import type { ComponentType } from 'react'
import {
  CalendarIcon,
  ChatIcon,
  LibraryIcon,
  TasksIcon,
  type IconProps,
} from './icons'

export interface Section {
  id: string
  label: string
  Icon: ComponentType<IconProps>
}

// The sections every project gets. `id` doubles as the URL segment.
export const sections: Section[] = [
  { id: 'chats', label: 'Чаты', Icon: ChatIcon },
  { id: 'library', label: 'Библиотека', Icon: LibraryIcon },
  { id: 'tasks', label: 'Задачи', Icon: TasksIcon },
  { id: 'calendar', label: 'Календарь', Icon: CalendarIcon },
]

export const DEFAULT_SECTION = sections[0].id

export const sectionById = (id: string | undefined) => sections.find((s) => s.id === id)
