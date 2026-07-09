import { useState } from 'react'
import type { TeamResponse } from '../api/generated/data-contracts'
import type { User } from '../context/AuthContext'
import { initials } from '../workspace/theme'
import { Avatar } from './Avatar'
import { LogoutIcon, SettingsIcon } from '../workspace/icons'

interface TeamRailProps {
  teams: TeamResponse[]
  selectedTeamId: number | null
  onSelect: (id: number) => void
  onCreate: () => void
  user: User | null
  onOpenProfile: () => void
  onLogout: () => void
}

const teamBtn =
  'w-10 h-10 rounded-[12px] flex items-center justify-center text-[13px] font-bold cursor-pointer font-ui transition hover:-translate-y-px'

export function TeamRail({
  teams,
  selectedTeamId,
  onSelect,
  onCreate,
  user,
  onOpenProfile,
  onLogout,
}: TeamRailProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const displayName = user?.displayName || user?.login || user?.email

  return (
    <div className="w-16 shrink-0 bg-rail border-r border-line flex flex-col items-center py-[14px] gap-2">
      <div className="w-9 h-9 rounded-[10px] bg-accent text-white flex items-center justify-center font-extrabold text-[18px] mb-2 tracking-[-.5px]">
        W
      </div>
      <div className="w-7 h-px bg-[#e0ddd3] mt-0.5 mb-1.5" />

      {teams.map((team) => {
        const id = Number(team.id)
        const active = id === selectedTeamId
        return (
          <button
            key={id}
            type="button"
            title={team.name}
            onClick={() => onSelect(id)}
            className={`${teamBtn} ${
              active ? 'bg-white text-accent-deep ring-2 ring-accent' : 'bg-tile text-muted'
            }`}
          >
            {initials(team.name)}
          </button>
        )
      })}

      <button
        type="button"
        title="Создать команду"
        onClick={onCreate}
        className="w-10 h-10 rounded-[12px] border border-dashed border-[#cfccc2] text-faint text-[20px] leading-none cursor-pointer flex items-center justify-center"
      >
        +
      </button>

      <div className="mt-auto relative">
        <button
          type="button"
          title={displayName}
          onClick={() => setMenuOpen((v) => !v)}
          className="cursor-pointer"
        >
          <Avatar
            userId={user?.id}
            name={displayName}
            hasAvatar={user?.hasAvatar}
            version={user?.avatarVersion}
            size={34}
          />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-11 bottom-0 w-[220px] bg-white border border-line rounded-xl shadow-[0_14px_36px_rgba(43,42,38,.16)] p-2 z-[41]">
              <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2.5">
                <Avatar
                  userId={user?.id}
                  name={displayName}
                  hasAvatar={user?.hasAvatar}
                  version={user?.avatarVersion}
                  size={34}
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink truncate">
                    {user?.displayName || user?.login}
                  </div>
                  <div className="text-[11.5px] text-faint truncate">{user?.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenProfile()
                }}
                className="w-full flex items-center gap-[9px] px-2 py-[9px] rounded-lg text-[13px] text-ink font-semibold cursor-pointer hover:bg-hovered font-ui"
              >
                <SettingsIcon size={16} />
                Профиль
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-[9px] px-2 py-[9px] rounded-lg text-[13px] text-danger font-semibold cursor-pointer hover:bg-hovered font-ui"
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
