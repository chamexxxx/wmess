import { useEffect, useState } from 'react'
import {
  HubConnectionBuilder,
  HttpTransportType,
} from '@microsoft/signalr'

/**
 * Realtime-подписка на изменения трекера задач команды.
 * Слушает `TasksChanged` и возвращает счётчик для silent-refetch в TasksSection.
 */
export function useTasksLive(teamId: number): number {
  const [signal, setSignal] = useState(0)

  useEffect(() => {
    let cancelled = false
    const bump = () => setSignal((n) => n + 1)

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/tasks', {
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) =>
          Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000),
      })
      .build()

    connection.on('TasksChanged', (changedTeamId: number) => {
      if (changedTeamId === teamId) {
        bump()
      }
    })

    connection.onreconnected(async () => {
      try {
        await connection.invoke('JoinTeam', teamId)
        bump()
      } catch (error) {
        console.error('Failed to re-join tasks hub after reconnect:', error)
      }
    })

    const start = async () => {
      try {
        await connection.start()
        if (cancelled) {
          await connection.stop()
          return
        }
        await connection.invoke('JoinTeam', teamId)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to connect to tasks hub:', error)
        }
      }
    }
    void start()

    return () => {
      cancelled = true
      connection.stop().catch(() => {})
    }
  }, [teamId])

  return signal
}
