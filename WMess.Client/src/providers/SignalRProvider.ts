import * as Y from 'yjs'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
} from '@microsoft/signalr'
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack'

type ProviderEvent = 'sync' | 'status' | 'update' | 'reload'

// Uint8Array → base64 чанками (spread целиком переполнил бы стек на больших снапшотах).
// Нужно для REST-флаша при выгрузке страницы: [FromBody] byte[] принимает base64-строку в JSON.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * Yjs-провайдер поверх SignalR, совместимый с интерфейсом @lexical/yjs `Provider`.
 *
 * Реализует стандартный sync-протокол Yjs (обмен векторами состояния) через хаб-реле,
 * а также пересылку awareness (курсоры/presence). Сервер не мержит CRDT — он лишь
 * рассылает апдейты между участниками и хранит снапшот для холодного старта.
 */
export type ContentType = 'documents' | 'boards'

export class SignalRProvider {
  public readonly doc: Y.Doc
  public readonly awareness: Awareness

  private readonly documentId: number
  private readonly connection: HubConnection
  private readonly contentType: ContentType
  private readonly listeners: Map<ProviderEvent, Set<(...args: unknown[]) => void>> = new Map()

  private synced = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private maxSaveTimer: ReturnType<typeof setTimeout> | null = null
  private desired = false
  private op: Promise<void> = Promise.resolve()

  constructor(
    documentId: number,
    doc: Y.Doc,
    serverUrl: string = '/hubs/document',
    contentType: ContentType = 'documents',
  ) {
    this.documentId = documentId
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.contentType = contentType

    this.connection = new HubConnectionBuilder()
      .withUrl(serverUrl, {
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
      })
      .withHubProtocol(new MessagePackHubProtocol())
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.elapsedMilliseconds < 60000) {
            return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 5000)
          }
          return null
        },
      })
      .build()

    this.registerConnectionHandlers()
    this.registerHubHandlers()
    this.registerLocalHandlers()
  }

  // ---- Provider event emitter ----

  on(type: ProviderEvent, cb: (...args: unknown[]) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(cb)
  }

  off(type: ProviderEvent, cb: (...args: unknown[]) => void): void {
    this.listeners.get(type)?.delete(cb)
  }

  private emit(type: ProviderEvent, ...args: unknown[]): void {
    this.listeners.get(type)?.forEach((cb) => {
      try {
        cb(...args)
      } catch (error) {
        console.error(`Error in "${type}" listener:`, error)
      }
    })
  }

  // ---- Connection lifecycle ----

  private registerConnectionHandlers() {
    this.connection.onreconnecting(() => this.emit('status', { status: 'connecting' }))
    this.connection.onreconnected(async () => {
      this.emit('status', { status: 'connected' })
      // После реконнекта переподключаемся к группе и заново синхронизируемся.
      try {
        await this.connection.invoke('JoinDocument', this.documentId)
        await this.sendSyncStep1()
        this.broadcastLocalAwareness()
      } catch (error) {
        console.error('Error re-joining document after reconnect:', error)
      }
    })
    this.connection.onclose(() => this.emit('status', { status: 'disconnected' }))
  }

  private registerHubHandlers() {
    // Стартовый снапшот: база для холодного старта (когда мы зашли первыми).
    this.connection.on('DocumentState', (state: Uint8Array) => {
      if (state && state.length > 0) {
        Y.applyUpdate(this.doc, state, this)
      }
      if (!this.synced) {
        this.synced = true
        this.emit('sync', true)
      }
    })

    // Шаг 1 sync-протокола от другого участника: отвечаем недостающими апдейтами адресно.
    this.connection.on('ReceiveSyncStep1', (_docId: number, stateVector: Uint8Array, fromConnectionId: string) => {
      const diff = Y.encodeStateAsUpdate(this.doc, stateVector)
      this.invoke('SyncStep2', this.documentId, diff, fromConnectionId)
    })

    this.connection.on('ReceiveSyncStep2', (_docId: number, update: Uint8Array) => {
      Y.applyUpdate(this.doc, update, this)
    })

    this.connection.on('ReceiveUpdate', (_docId: number, update: Uint8Array) => {
      Y.applyUpdate(this.doc, update, this)
    })

    this.connection.on('ReceiveAwareness', (_docId: number, update: Uint8Array) => {
      applyAwarenessUpdate(this.awareness, update, this)
    })
  }

  private registerLocalHandlers() {
    // Локальные изменения документа → рассылаем остальным + дебаунс-сохранение снапшота.
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== this) {
        this.invoke('SendUpdate', this.documentId, update)
        this.scheduleSnapshotSave()
      }
    })

    // Локальные изменения awareness (курсор/presence) → рассылаем остальным.
    this.awareness.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        if (origin === this) return
        const changed = added.concat(updated, removed)
        const update = encodeAwarenessUpdate(this.awareness, changed)
        this.invoke('SendAwareness', this.documentId, update)
      },
    )
  }

  // connect()/disconnect() — модель «намерения». CollaborationPlugin в React StrictMode (dev)
  // делает mount→unmount→mount и в cleanup дёргает disconnect; чтобы итог был корректным
  // независимо от порядка, мы храним желаемое состояние `desired` и сериализуем start/stop
  // в очередь `op`. connect() намеренно возвращает void (не Promise), иначе плагин навешивает
  // отложенный disconnect на промис connect() и рвёт уже переподключённое соединение.

  connect(): void {
    this.desired = true
    this.enqueueReconcile()
  }

  disconnect(): void {
    this.desired = false
    this.enqueueReconcile()
  }

  private enqueueReconcile(): void {
    this.op = this.op.then(() => this.reconcile()).catch((error) => {
      console.error('Connection reconcile error:', error)
    })
  }

  private async reconcile(): Promise<void> {
    if (this.desired) {
      if (this.connection.state === HubConnectionState.Disconnected) {
        await this.connection.start()
        this.emit('status', { status: 'connected' })
        // На время активной сессии вешаем флаш снапшота на выгрузку страницы (закрытие вкладки / F5).
        window.addEventListener('pagehide', this.handlePageHide)
        await this.connection.invoke('JoinDocument', this.documentId)
        // Снапшот придёт событием DocumentState; затем тянем недостающее у активных участников.
        await this.sendSyncStep1()
        this.broadcastLocalAwareness()
      }
    } else {
      window.removeEventListener('pagehide', this.handlePageHide)
      // Был ли отложенный снапшот (дебаунс / периодический автосейв), не успевший уйти в БД.
      const hadPendingSave = this.hasPendingSave()
      this.clearSaveTimers()
      if (this.connection.state === HubConnectionState.Connected) {
        // Дослать снапшот ДО отключения, иначе правки за последние <1.5с (дебаунс не успел
        // сработать) потеряются при уходе из документа в другой раздел.
        if (hadPendingSave) {
          try {
            await this.connection.invoke(
              'SaveDocumentState',
              this.documentId,
              Y.encodeStateAsUpdate(this.doc),
            )
          } catch (error) {
            console.error('Error flushing snapshot on disconnect:', error)
          }
        }
        // Сообщаем остальным, что наш курсор/presence ушёл, пока соединение ещё живо.
        removeAwarenessStates(this.awareness, [this.doc.clientID], 'local')
        try {
          await this.connection.invoke('LeaveDocument', this.documentId)
        } catch {
          // соединение могло уже закрыться — не критично
        }
      }
      if (this.connection.state !== HubConnectionState.Disconnected) {
        await this.connection.stop()
        this.emit('status', { status: 'disconnected' })
      }
    }
  }

  // ---- helpers ----

  private async sendSyncStep1(): Promise<void> {
    const stateVector = Y.encodeStateVector(this.doc)
    await this.invoke('SyncStep1', this.documentId, stateVector)
  }

  private broadcastLocalAwareness(): void {
    const localState = this.awareness.getLocalState()
    if (localState) {
      const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID])
      this.invoke('SendAwareness', this.documentId, update)
    }
  }

  private invoke(method: string, ...args: unknown[]): void {
    if (this.connection.state !== HubConnectionState.Connected) return
    this.connection.invoke(method, ...args).catch((error) => {
      console.error(`Error invoking ${method}:`, error)
    })
  }

  // При выгрузке страницы (закрытие вкладки / F5) SignalR-инвок долететь не успеет, поэтому
  // несохранённый снапшот дописываем REST-ом с keepalive (запрос переживёт выгрузку; BFF
  // подставит Bearer из HttpOnly-куки). Стрелка — стабильная ссылка для add/removeEventListener.
  private readonly handlePageHide = (): void => {
    if (!this.hasPendingSave()) return
    this.clearSaveTimers()
    void fetch(`/api/library/${this.contentType}/${this.documentId}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify(bytesToBase64(Y.encodeStateAsUpdate(this.doc))),
    }).catch(() => {})
  }

  private hasPendingSave(): boolean {
    return this.saveTimer !== null || this.maxSaveTimer !== null
  }

  private clearSaveTimers(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (this.maxSaveTimer !== null) {
      clearTimeout(this.maxSaveTimer)
      this.maxSaveTimer = null
    }
  }

  private scheduleSnapshotSave(): void {
    // Дебаунс: снапшот уходит в БД через 1.5с после паузы в правках.
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => this.flushSnapshotSave(), 1500)

    // Max-wait: при непрерывной печати дебаунс откладывался бы бесконечно и снапшот не
    // сохранялся бы вовсе. Гарантируем запись минимум раз в 10с — это ограничивает окно
    // возможной потери и снимает зависимость от 64КБ-лимита keepalive на больших документах.
    if (this.maxSaveTimer === null) {
      this.maxSaveTimer = setTimeout(() => this.flushSnapshotSave(), 10000)
    }
  }

  private flushSnapshotSave(): void {
    this.clearSaveTimers()
    this.invoke('SaveDocumentState', this.documentId, Y.encodeStateAsUpdate(this.doc))
  }
}
