import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { isAxiosError } from 'axios'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'
import { toUser } from '../context/user'
import { Avatar } from '../components/Avatar'
import { AvatarCropper } from '../components/AvatarCropper'
import { authField } from '../components/AuthLayout'
import { ArrowLeftIcon, CameraIcon } from '../workspace/icons'
import { toast } from '../store/toastStore'

const primaryBtn =
  'h-[42px] px-5 rounded-[10px] bg-accent text-white font-semibold text-sm cursor-pointer hover:bg-accent-deep font-ui disabled:opacity-50 disabled:cursor-default'

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [login, setLogin] = useState(user?.login ?? '')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  // Выбранный, но ещё не обрезанный файл — открывает модалку кадрирования.
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  if (!user) return null

  const dirty = login !== user.login || displayName !== user.displayName

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await apiClient.user.userMeUpdate({ login, displayName })
      setUser(toUser(res.data, user.avatarVersion))
      toast.info('Профиль сохранён')
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        toast.error('Логин уже занят другим пользователем')
      } else {
        toast.error('Не удалось сохранить профиль. Проверьте логин')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // позволяем выбрать тот же файл повторно
    if (file) setPendingFile(file)
  }

  const handleCropConfirm = async (blob: Blob) => {
    setAvatarBusy(true)
    try {
      const res = await apiClient.uploadAvatar(blob)
      setUser(toUser(res, user.avatarVersion + 1))
      setPendingFile(null)
    } catch {
      toast.error('Не удалось загрузить аватарку (нужна картинка до 2 МБ)')
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Новый пароль и подтверждение не совпадают')
      return
    }
    setChangingPassword(true)
    try {
      await apiClient.user.userMePasswordCreate({ currentPassword, newPassword })
      toast.info('Пароль изменён')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const code = isAxiosError(err)
        ? (err.response?.data as { code?: string } | undefined)?.code
        : undefined
      if (code === 'PasswordMismatch') {
        toast.error('Неверный текущий пароль')
      } else {
        toast.error('Не удалось изменить пароль. Проверьте требования к паролю')
      }
    } finally {
      setChangingPassword(false)
    }
  }

  const handleAvatarRemove = async () => {
    setAvatarBusy(true)
    try {
      const res = await apiClient.user.userMeAvatarDelete()
      setUser(toUser(res.data, user.avatarVersion + 1))
    } catch {
      toast.error('Не удалось удалить аватарку')
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <div className="wm-scroll fixed inset-0 overflow-auto bg-app text-ink font-ui text-sm antialiased">
      <div className="max-w-[560px] mx-auto px-5 py-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink cursor-pointer font-medium mb-6"
        >
          <ArrowLeftIcon size={16} />
          Назад
        </button>

        <h1 className="text-[22px] font-extrabold tracking-[-.4px] mb-7">Профиль</h1>

        <div className="bg-white border border-line rounded-2xl p-6 shadow-[0_10px_30px_rgba(43,42,38,.06)]">
          {/* Аватар: клик по кружку открывает выбор файла, при наведении — иконка камеры. */}
          <div className="flex items-center gap-4 pb-6 mb-6 border-b border-line">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              title="Изменить фото"
              className="group relative rounded-full cursor-pointer disabled:cursor-default"
            >
              <Avatar
                userId={user.id}
                name={user.displayName || user.login}
                hasAvatar={user.hasAvatar}
                version={user.avatarVersion}
                size={88}
              />
              <div className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <CameraIcon size={26} className="text-white" />
              </div>
            </button>
            <div className="flex flex-col gap-1">
              <div className="text-[15px] font-semibold text-ink">
                {user.displayName || user.login}
              </div>
              <div className="text-[12.5px] text-faint">Нажмите на фото, чтобы изменить</div>
              {user.hasAvatar && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={avatarBusy}
                  className="text-[12.5px] text-danger font-medium cursor-pointer hover:underline self-start mt-0.5 disabled:opacity-50 disabled:cursor-default"
                >
                  Удалить фото
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFilePicked}
              className="hidden"
            />
          </div>

          {/* Данные */}
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-muted">Email</span>
              <input type="email" className={`${authField} opacity-60`} value={user.email} disabled readOnly />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-muted">Логин</span>
              <input
                type="text"
                className={authField}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                pattern="[a-zA-Z0-9_\-]{3,32}"
                title="3–32 символа: латиница, цифры, «_» или «-»"
                required
              />
              <span className="text-[11.5px] text-faint">
                3–32 символа: латиница, цифры, «_» или «-»
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-muted">Имя</span>
              <input
                type="text"
                className={authField}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                required
              />
            </label>

            <div className="mt-2">
              <button type="submit" className={primaryBtn} disabled={saving || !dirty}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>

        {/* Смена пароля */}
        <div className="bg-white border border-line rounded-2xl p-6 shadow-[0_10px_30px_rgba(43,42,38,.06)] mt-5">
          <h2 className="text-[15px] font-bold text-ink mb-4">Смена пароля</h2>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-muted">Текущий пароль</span>
              <input
                type="password"
                className={authField}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-muted">Новый пароль</span>
              <input
                type="password"
                className={authField}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
              <span className="text-[11.5px] text-faint">
                Минимум 6 символов: заглавная, строчная, цифра и спецсимвол
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-muted">Подтвердите новый пароль</span>
              <input
                type="password"
                className={authField}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </label>

            <div className="mt-2">
              <button
                type="submit"
                className={primaryBtn}
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {changingPassword ? 'Сохранение…' : 'Изменить пароль'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {pendingFile && (
        <AvatarCropper
          file={pendingFile}
          busy={avatarBusy}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  )
}
