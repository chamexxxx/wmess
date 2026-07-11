import { isAxiosError } from 'axios'

/**
 * Человекочитаемое сообщение об ошибке мутации для показа пользователю.
 * Отдельно распознаёт офлайн/недоступность сервера (сетевая ошибка без ответа),
 * права (403) и истёкшую сессию (401); иначе — сообщение сервера или переданный fallback.
 */
export function describeError(error: unknown, fallback: string): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Нет подключения к интернету. Изменение не сохранено — повторите, когда связь восстановится.'
  }
  if (isAxiosError(error)) {
    if (!error.response) {
      return 'Не удалось связаться с сервером. Изменение не сохранено — попробуйте ещё раз.'
    }
    const status = error.response.status
    if (status === 403) {
      return 'Недостаточно прав для этого действия.'
    }
    if (status === 401) {
      return 'Сессия истекла. Войдите заново.'
    }
    const data = error.response.data as { message?: string; errors?: string[] } | undefined
    if (data?.errors?.length) {
      return data.errors.join('; ')
    }
    if (data?.message) {
      return data.message
    }
  }
  return fallback
}
