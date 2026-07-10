import { useEffect, useState } from 'react'
import {
  HubConnectionBuilder,
  HttpTransportType,
} from '@microsoft/signalr'

/**
 * Realtime-подписка на изменения структуры библиотеки проекта.
 *
 * Держит SignalR-соединение с `/hubs/library`, состоит в группе проекта и слушает событие
 * `LibraryChanged` (его шлёт контроллер после любой мутации: создание/переименование/
 * перемещение/удаление папок и элементов, загрузка файлов, ссылки). Возвращает счётчик,
 * который увеличивается на каждое изменение — компонент вешает на него эффект и перезапрашивает
 * текущий вид.
 *
 * Устойчивость к обрывам: соединение авто-реконнектится; после восстановления мы заново
 * входим в группу проекта и один раз инкрементим счётчик, чтобы подтянуть всё, что могло
 * измениться, пока связи не было.
 */
export function useLibraryLive(projectId: number): number {
  const [signal, setSignal] = useState(0)

  useEffect(() => {
    let cancelled = false
    const bump = () => setSignal((n) => n + 1)

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/library', {
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
      })
      .withAutomaticReconnect({
        // Лёгкое фоновое соединение только для уведомлений — переподключаемся бесконечно
        // (с экспоненциальным откатом до 30с), чтобы синхронизация возобновилась после
        // любого по длительности обрыва. На каждом успешном реконнекте делаем перезапрос.
        nextRetryDelayInMilliseconds: (retryContext) =>
          Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000),
      })
      .build()

    connection.on('LibraryChanged', (changedProjectId: number) => {
      if (changedProjectId === projectId) {
        bump()
      }
    })

    connection.onreconnected(async () => {
      try {
        await connection.invoke('JoinProject', projectId)
        // Подтягиваем всё, что могло измениться, пока соединения не было.
        bump()
      } catch (error) {
        console.error('Failed to re-join project library after reconnect:', error)
      }
    })

    const start = async () => {
      try {
        await connection.start()
        if (cancelled) {
          await connection.stop()
          return
        }
        await connection.invoke('JoinProject', projectId)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to connect to library hub:', error)
        }
      }
    }
    void start()

    return () => {
      cancelled = true
      connection.stop().catch(() => {})
    }
  }, [projectId])

  return signal
}
