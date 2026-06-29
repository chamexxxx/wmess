import type { ComponentType } from 'react'
import {
  BoardsIcon,
  CalendarIcon,
  ChatIcon,
  FolderIcon,
  LibraryIcon,
  TablesIcon,
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
  { id: 'boards', label: 'Доски', Icon: BoardsIcon },
  { id: 'calendar', label: 'Календарь', Icon: CalendarIcon },
  { id: 'tables', label: 'Таблицы', Icon: TablesIcon },
  { id: 'files', label: 'Файлы', Icon: FolderIcon },
]

export const DEFAULT_SECTION = sections[0].id

export const sectionById = (id: string | undefined) => sections.find((s) => s.id === id)
