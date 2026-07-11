import { useEffect, useState } from 'react'
import {
  HubConnectionBuilder,
  HttpTransportType,
} from '@microsoft/signalr'

/**
 * Realtime-подписка на изменения календаря проекта.
 * Слушает `CalendarChanged` и возвращает счётчик для silent-refetch в CalendarSection.
 */
export function useCalendarLive(projectId: number): number {
  const [signal, setSignal] = useState(0)

  useEffect(() => {
    let cancelled = false
    const bump = () => setSignal((n) => n + 1)

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/calendar', {
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) =>
          Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000),
      })
      .build()

    connection.on('CalendarChanged', (changedProjectId: number) => {
      if (changedProjectId === projectId) {
        bump()
      }
    })

    connection.onreconnected(async () => {
      try {
        await connection.invoke('JoinProject', projectId)
        bump()
      } catch (error) {
        console.error('Failed to re-join calendar hub after reconnect:', error)
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
          console.error('Failed to connect to calendar hub:', error)
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
