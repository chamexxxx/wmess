// Helpers for per-item avatar/swatch colors. Static design tokens live in
// index.css (@theme) as Tailwind utilities; only these runtime-computed colors
// need to stay in JS.

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
