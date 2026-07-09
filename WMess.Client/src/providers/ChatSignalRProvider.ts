import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
} from '@microsoft/signalr'
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack'
import type { MessageResponse } from '../api/generated/data-contracts'

export type ChatHubEvents = {
  onMessage: (message: MessageResponse) => void
  onMessageUpdated: (message: MessageResponse) => void
  onMessageDeleted: (chatId: number, messageId: number) => void
  onReaction: (chatId: number, messageId: number, userId: string, emoji: string, added: boolean) => void
  onPinned: (chatId: number, messageId: number) => void
  onUnpinned: (chatId: number, messageId: number) => void
  onTyping: (chatId: number, userId: string) => void
  onStatus: (connected: boolean) => void
}

export class ChatSignalRConnection {
  private connection: HubConnection
  private desired = false
  private op: Promise<void> = Promise.resolve()
  private chatId: number | null = null

  constructor(private readonly events: ChatHubEvents) {
    this.connection = new HubConnectionBuilder()
      .withUrl('/hubs/chat', {
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
      })
      .withHubProtocol(new MessagePackHubProtocol())
      .withAutomaticReconnect()
      .build()

    this.connection.on('ReceiveMessage', (msg: MessageResponse) => this.events.onMessage(msg))
    this.connection.on('MessageUpdated', (msg: MessageResponse) => this.events.onMessageUpdated(msg))
    this.connection.on('MessageDeleted', (chatId: number, messageId: number) =>
      this.events.onMessageDeleted(chatId, messageId),
    )
    this.connection.on(
      'ReceiveReaction',
      (chatId: number, messageId: number, userId: string, emoji: string, added: boolean) =>
        this.events.onReaction(chatId, messageId, userId, emoji, added),
    )
    this.connection.on('MessagePinned', (chatId: number, messageId: number) =>
      this.events.onPinned(chatId, messageId),
    )
    this.connection.on('MessageUnpinned', (chatId: number, messageId: number) =>
      this.events.onUnpinned(chatId, messageId),
    )
    this.connection.on('UserTyping', (chatId: number, userId: string) =>
      this.events.onTyping(chatId, userId),
    )

    this.connection.onreconnecting(() => this.events.onStatus(false))
    this.connection.onreconnected(() => {
      this.events.onStatus(true)
      if (this.chatId != null) void this.connection.invoke('JoinChat', this.chatId)
    })
    this.connection.onclose(() => this.events.onStatus(false))
  }

  connect(chatId: number): void {
    this.desired = true
    this.chatId = chatId
    this.op = this.op.then(() => this.reconcile())
  }

  disconnect(): void {
    this.desired = false
    this.op = this.op.then(() => this.reconcile())
  }

  async sendTyping(): Promise<void> {
    if (this.chatId == null || this.connection.state !== HubConnectionState.Connected) return
    await this.connection.invoke('UserTyping', this.chatId)
  }

  private async reconcile(): Promise<void> {
    if (this.desired) {
      if (this.connection.state === HubConnectionState.Disconnected) {
        await this.connection.start()
        this.events.onStatus(true)
      }
      if (this.chatId != null) {
        await this.connection.invoke('JoinChat', this.chatId)
      }
    } else if (this.connection.state !== HubConnectionState.Disconnected) {
      if (this.chatId != null) {
        try {
          await this.connection.invoke('LeaveChat', this.chatId)
        } catch {
          /* ignore */
        }
      }
      await this.connection.stop()
      this.events.onStatus(false)
      this.chatId = null
    }
  }
}
