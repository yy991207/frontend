import type { ChatApiConfig, ChatReference, CourseItem, SkillOutputItem, ToolCall } from './chatService'

export type StreamBridgeMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  loading?: boolean
  sessionId?: string
  toolCalls?: ToolCall[]
  references?: ChatReference[]
  courses?: CourseItem[]
  skillOutput?: SkillOutputItem[]
}

export type StreamBridgeStatus = 'streaming' | 'completed' | 'aborted' | 'error'

export type StreamBridgeSnapshot = {
  sessionId: string
  messages: StreamBridgeMessage[]
  status: StreamBridgeStatus
  error?: string
}

type StreamPayload = {
  message: string
  tool_type?: string | null
}

type SubscribeCommand = {
  type: 'subscribe'
  sessionId: string
}

type UnsubscribeCommand = {
  type: 'unsubscribe'
  sessionId: string
}

type StopStreamCommand = {
  type: 'stop-stream'
  sessionId: string
}

type StartStreamCommand = {
  type: 'start-stream'
  sessionId: string
  config: ChatApiConfig
  payload: StreamPayload
  messages: StreamBridgeMessage[]
  loadingMessageId: string
}

type WorkerCommand = SubscribeCommand | UnsubscribeCommand | StopStreamCommand | StartStreamCommand

type SnapshotEvent = {
  type: 'snapshot'
  sessionId: string
  snapshot: StreamBridgeSnapshot | null
}

type WorkerEvent = SnapshotEvent

export type ChatStreamBridge = {
  subscribe: (sessionId: string) => Promise<StreamBridgeSnapshot | null>
  unsubscribe: (sessionId: string) => void
  startStream: (command: Omit<StartStreamCommand, 'type'>) => Promise<void>
  stopStream: (sessionId: string) => boolean
  destroy: () => void
}

function isSnapshotEvent(data: unknown): data is SnapshotEvent {
  if (!data || typeof data !== 'object') {
    return false
  }

  const value = data as Partial<SnapshotEvent>
  return value.type === 'snapshot' && typeof value.sessionId === 'string' && 'snapshot' in value
}

export function createChatStreamBridge(
  onSnapshot: (snapshot: StreamBridgeSnapshot) => void,
): ChatStreamBridge | null {
  // 用 SharedWorker 托管进行中的 stream，同源刷新后新页面只需要重新订阅快照。
  if (typeof window === 'undefined' || typeof SharedWorker === 'undefined') {
    return null
  }

  let worker: SharedWorker

  try {
    worker = new SharedWorker(new URL('../workers/chatStreamWorker.ts', import.meta.url), {
      name: 'chat-stream-worker',
      type: 'module',
    })
  } catch {
    return null
  }

  const port = worker.port
  const pendingSnapshots = new Map<string, (snapshot: StreamBridgeSnapshot | null) => void>()

  const handleMessage = (event: MessageEvent<WorkerEvent>) => {
    const payload = event.data

    if (!isSnapshotEvent(payload)) {
      return
    }

    if (payload.snapshot) {
      onSnapshot(payload.snapshot)
    }

    const resolve = pendingSnapshots.get(payload.sessionId)
    if (resolve) {
      pendingSnapshots.delete(payload.sessionId)
      resolve(payload.snapshot)
    }
  }

  port.start()
  port.onmessage = handleMessage

  const postCommand = (command: WorkerCommand) => {
    port.postMessage(command)
  }

  return {
    async subscribe(sessionId) {
      // 订阅时先拿一份当前快照，刷新后的页面可以立刻恢复到最新流状态。
      return await new Promise<StreamBridgeSnapshot | null>((resolve) => {
        pendingSnapshots.set(sessionId, resolve)
        postCommand({
          type: 'subscribe',
          sessionId,
        })
      })
    },
    unsubscribe(sessionId) {
      pendingSnapshots.delete(sessionId)
      postCommand({
        type: 'unsubscribe',
        sessionId,
      })
    },
    async startStream(command) {
      postCommand({
        type: 'start-stream',
        ...command,
      })
    },
    stopStream(sessionId) {
      postCommand({
        type: 'stop-stream',
        sessionId,
      })
      return true
    },
    destroy() {
      pendingSnapshots.clear()
      port.onmessage = null
      port.close()
    },
  }
}
