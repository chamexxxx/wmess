export const DEFAULT_EVENT_COLOR = '#4FA47A'

export const EVENT_COLORS = [
  '#4FA47A',
  '#3D6FC2',
  '#8A63C9',
  '#E0A82E',
  '#B5466B',
  '#2F9E8F',
  '#C2683D',
  '#7A4FB5',
] as const

export function normalizeEventColor(color?: string | null): string {
  if (!color) return DEFAULT_EVENT_COLOR
  const c = color.trim()
  return EVENT_COLORS.includes(c as (typeof EVENT_COLORS)[number]) ? c : DEFAULT_EVENT_COLOR
}

export function eventTextColor(bg: string): string {
  const hex = bg.replace('#', '')
  if (hex.length !== 6) return '#ffffff'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#2b2a26' : '#ffffff'
}
