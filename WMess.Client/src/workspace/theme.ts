// Design tokens taken from the Claude Design export (green accent workspace).
// Shared across the team rail, project sidebar and modals.

export const c = {
  appBg: '#F7F6F2',
  panelBg: '#FBFAF7',
  railBg: '#EFEDE7',
  sidebarBg: '#F2F1EC',
  border: '#E4E2DA',
  borderSoft: '#EDEBE3',
  text: '#2B2A26',
  textBody: '#3A3833',
  textMuted: '#6E6B62',
  textFaint: '#9B978C',
  textFaintest: '#A8A498',
  hoverBg: '#E7E5DD',
  white: '#fff',
  danger: '#B5466B',
}

export const accent = {
  base: '#4FA47A',
  soft: '#E6F4EC',
  hover: '#3C8A63',
  ring: 'rgba(79,164,122,0.30)',
}

export const font = {
  sans: "'Hanken Grotesk', sans-serif",
  mono: "'JetBrains Mono', monospace",
}

// Avatar / swatch palette borrowed from the design's people colors.
const palette = [
  '#C2683D',
  '#3D6FC2',
  '#2E8B6B',
  '#8B5E2E',
  '#7A4FB5',
  '#B5466B',
  '#3D47BE',
  '#4FA47A',
]

/** Up to two-letter initials for an avatar tile. */
export function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Deterministic palette color so a team/project keeps the same hue. */
export function colorFor(key: string | number | undefined): string {
  const s = String(key ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}
