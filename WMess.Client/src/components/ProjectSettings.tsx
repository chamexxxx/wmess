import { useState } from 'react'
import type { ProjectResponse } from '../api/generated/data-contracts'

interface ProjectSettingsProps {
  project: ProjectResponse
  busy: boolean
  // Owner/Admin команды — иначе настройки доступны только для просмотра.
  canManage: boolean
  onRename: (name: string) => void
  onDelete: () => void
}

const sectionLabel = 'font-mono text-[10.5px] tracking-[.06em] uppercase text-faintest'

export function ProjectSettings({ project, busy, canManage, onRename, onDelete }: ProjectSettingsProps) {
  const [name, setName] = useState(project.name ?? '')
  const trimmed = name.trim()
  const changed = trimmed.length > 0 && trimmed !== project.name

  return (
    <div className="px-6 py-6 max-w-[640px]">
      <div className={`${sectionLabel} mb-2`}>Общие</div>
      <div className="bg-white border border-line rounded-xl p-4 mb-6">
        <label className="block text-[12.5px] text-muted mb-2">Название проекта</label>
        <div className="flex gap-2">
          <input
            value={name}
            maxLength={100}
            disabled={!canManage}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && changed && !busy && canManage) onRename(trimmed)
            }}
            className="flex-1 min-w-0 h-10 px-3 rounded-[9px] border border-line bg-panel text-sm text-ink font-ui focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 disabled:opacity-60"
          />
          {canManage && (
            <button
              type="button"
              disabled={!changed || busy}
              onClick={() => onRename(trimmed)}
              className="h-10 px-[18px] rounded-[9px] bg-accent text-white text-[13.5px] font-semibold cursor-pointer hover:bg-accent-deep disabled:opacity-60 font-ui"
            >
              Сохранить
            </button>
          )}
        </div>
        {!canManage && (
          <div className="text-[12.5px] text-faint mt-2">
            Менять настройки проекта могут только владелец или администратор команды.
          </div>
        )}
      </div>

      {canManage && (
        <>
          <div className={`${sectionLabel} mb-2`}>Опасная зона</div>
          <div className="border border-danger/40 bg-danger/5 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-danger-deep">Удалить проект</div>
              <div className="text-[12.5px] text-danger-deep/80 mt-0.5">
                Проект и его содержимое будут удалены без возможности восстановления.
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="shrink-0 h-9 px-4 rounded-[9px] border border-danger text-danger-deep text-[13px] font-semibold cursor-pointer hover:bg-danger hover:text-white disabled:opacity-60 font-ui bg-white"
            >
              Удалить…
            </button>
          </div>
        </>
      )}
    </div>
  )
}
