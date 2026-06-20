import { useState } from 'react'
import type { TeamResponse } from '../api/generated/data-contracts'
import { accent, c, font, initials } from '../workspace/theme'
import { LogoutIcon } from '../workspace/icons'

interface TeamRailProps {
  teams: TeamResponse[]
  selectedTeamId: number | null
  onSelect: (id: number) => void
  onCreate: () => void
  userEmail: string | undefined
  onLogout: () => void
}

const teamBtnBase: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  color: c.textMuted,
  background: '#E2E0D8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: font.sans,
}

export function TeamRail({
  teams,
  selectedTeamId,
  onSelect,
  onCreate,
  userEmail,
  onLogout,
}: TeamRailProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      style={{
        width: 64,
        flex: 'none',
        background: c.railBg,
        borderRight: `1px solid ${c.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 0',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: accent.base,
          color: c.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 18,
          marginBottom: 8,
          letterSpacing: '-.5px',
        }}
      >
        W
      </div>
      <div style={{ width: 28, height: 1, background: '#E0DDD3', margin: '2px 0 6px' }} />

      {teams.map((team) => {
        const id = Number(team.id)
        const active = id === selectedTeamId
        return (
          <button
            key={id}
            type="button"
            className="wm-team-btn"
            title={team.name}
            onClick={() => onSelect(id)}
            style={
              active
                ? {
                    ...teamBtnBase,
                    background: c.white,
                    color: accent.hover,
                    boxShadow: `0 0 0 2px ${accent.base}`,
                  }
                : teamBtnBase
            }
          >
            {initials(team.name)}
          </button>
        )
      })}

      <button
        type="button"
        title="Создать команду"
        onClick={onCreate}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: '1px dashed #CFCCC2',
          background: 'transparent',
          color: c.textFaint,
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        +
      </button>

      <div style={{ marginTop: 'auto', position: 'relative' }}>
        <button
          type="button"
          title={userEmail}
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: 'none',
            background: '#3D6FC2',
            color: c.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: font.sans,
          }}
        >
          {initials(userEmail)}
        </button>

        {menuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
            <div
              style={{
                position: 'absolute',
                left: 44,
                bottom: 0,
                width: 220,
                background: c.white,
                border: `1px solid ${c.border}`,
                borderRadius: 12,
                boxShadow: '0 14px 36px rgba(43,42,38,.16)',
                padding: 8,
                zIndex: 41,
              }}
            >
              <div style={{ padding: '6px 8px 10px' }}>
                <div
                  style={{
                    fontFamily: font.mono,
                    fontSize: 10.5,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: c.textFaintest,
                  }}
                >
                  Аккаунт
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: c.text,
                    marginTop: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {userEmail}
                </div>
              </div>
              <button
                type="button"
                className="wm-hover"
                onClick={onLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '9px 8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: 8,
                  fontSize: 13,
                  color: c.danger,
                  fontWeight: 600,
                  fontFamily: font.sans,
                }}
              >
                <LogoutIcon size={16} />
                Выйти
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
