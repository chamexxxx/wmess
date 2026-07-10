import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { isAxiosError } from 'axios'
import { apiClient } from '../api'
import { useAuth } from '../context/AuthContext'
import { toUser } from '../context/user'
import { Avatar } from '../components/Avatar'
import { AvatarCropper } from '../components/AvatarCropper'
import { ConfirmDialog } from '../components/WorkspaceModals'
import { authField } from '../components/AuthLayout'
import { CameraIcon } from '../workspace/icons'
import { toast } from '../store/toastStore'

const card = 'bg-white border border-line rounded-2xl shadow-[0_10px_30px_rgba(43,42,38,.05)]'
const label = 'text-[12.5px] font-semibold text-muted'
const hint = 'text-[11.5px] text-faint'
const primaryBtn =
  'h-[40px] px-5 rounded-[10px] bg-accent text-white font-semibold text-[13px] cursor-pointer hover:bg-accent-deep font-ui transition disabled:opacity-45 disabled:cursor-default'

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState(user?.email ?? '')
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

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!user) return null

  const dirty = email !== user.email || login !== user.login || displayName !== user.displayName

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await apiClient.user.userMeUpdate({ email, login, displayName })
      setUser(toUser(res.data, user.avatarVersion))
      toast.info('Профиль сохранён')
    } catch (err) {
      const code = isAxiosError(err)
        ? (err.response?.data as { code?: string } | undefined)?.code
        : undefined
      if (code === 'EmailTaken') {
        toast.error('Email уже занят другим пользователем')
      } else if (code === 'LoginTaken') {
        toast.error('Логин уже занят другим пользователем')
      } else {
        toast.error('Не удалось сохранить профиль. Проверьте email и логин')
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

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await apiClient.user.userMeDelete()
      await apiClient.logout().catch(() => {})
      setUser(null)
      navigate('/login')
    } catch {
      toast.error('Не удалось удалить аккаунт')
      setDeleting(false)
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
    <div className="wm-scroll flex-1 min-w-0 overflow-auto bg-app text-ink font-ui text-sm antialiased">
      <div className="max-w-[940px] px-6 py-10 flex flex-col gap-6">
        <h1 className="text-[24px] font-extrabold tracking-[-.5px]">Профиль</h1>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Справа (на десктопе): блок с аватаркой и удалением аккаунта */}
          <div className="w-full md:w-[264px] md:shrink-0 flex flex-col gap-3 order-first md:order-last">
          <div className={`${card} flex flex-col items-center text-center p-6`}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              title="Изменить фото"
              className="group relative rounded-full cursor-pointer disabled:cursor-default outline-none"
            >
              <Avatar
                userId={user.id}
                name={user.displayName || user.login}
                hasAvatar={user.hasAvatar}
                version={user.avatarVersion}
                size={112}
              />
              <div className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <CameraIcon size={28} className="text-white" />
              </div>
            </button>

            <div className="mt-4 text-[18px] font-bold tracking-[-.3px] leading-tight max-w-full truncate">
              {user.displayName || user.login}
            </div>
            <div className="mt-0.5 text-[13px] text-faint max-w-full truncate">{user.email}</div>
            {user.hasAvatar && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={avatarBusy}
                className="mt-3 text-[12.5px] text-danger font-medium cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-default"
              >
                Удалить фото
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFilePicked}
              className="hidden"
            />
          </div>

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full h-[40px] rounded-[10px] bg-danger text-white font-semibold text-[13px] cursor-pointer hover:bg-danger-deep transition"
          >
            Удалить аккаунт
          </button>
          </div>

          {/* Слева (на десктопе): остальные блоки */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
        {/* Личные данные */}
        <form onSubmit={handleSave} className={`${card} p-6`}>
          <h2 className="text-[15px] font-bold tracking-[-.2px] pb-4 mb-5 border-b border-line">
            Личные данные
          </h2>

          <label className="flex flex-col gap-1.5 mb-4">
            <span className={label}>Email</span>
            <input
              type="email"
              className={authField}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Логин</span>
              <input
                type="text"
                className={authField}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                pattern="[a-zA-Z0-9_\-]{3,32}"
                title="3–32 символа: латиница, цифры, «_» или «-»"
                required
              />
              <span className={hint}>3–32 символа: латиница, цифры, «_» или «-»</span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={label}>Имя</span>
              <input
                type="text"
                className={authField}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                required
              />
            </label>
          </div>

          <div className="flex justify-end mt-6">
            <button type="submit" className={primaryBtn} disabled={saving || !dirty}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>

        {/* Смена пароля */}
        <form onSubmit={handleChangePassword} className={`${card} p-6`}>
          <h2 className="text-[15px] font-bold tracking-[-.2px] pb-4 mb-5 border-b border-line">
            Смена пароля
          </h2>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Текущий пароль</span>
              <input
                type="password"
                className={authField}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={label}>Новый пароль</span>
                <input
                  type="password"
                  className={authField}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={label}>Подтвердите пароль</span>
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
            </div>
            <span className={hint}>Минимум 6 символов: заглавная, строчная, цифра и спецсимвол</span>
          </div>

          <div className="flex justify-end mt-6">
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
      </div>

      {pendingFile && (
        <AvatarCropper
          file={pendingFile}
          busy={avatarBusy}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить аккаунт?"
          message="Аккаунт и все связанные с ним данные будут удалены безвозвратно. Это действие нельзя отменить."
          confirmLabel={deleting ? 'Удаление…' : 'Удалить аккаунт'}
          busy={deleting}
          onConfirm={handleDeleteAccount}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
