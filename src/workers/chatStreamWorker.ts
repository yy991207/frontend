/// <reference lib="webworker" />

import {
  downloadSessionFileContent,
  extractCourseTableFilePath,
  parseCourseTableContent,
  readSseStream,
  streamChatMessage,
  type ChatApiConfig,
  type ToolCall,
} from '../services/chatService'
import { appendTextDeltaToStreamMessages } from '../core/messages/streaming'
import type {
  StreamBridgeMessage,
  StreamBridgeSnapshot,
  StreamBridgeStatus,
} from '../services/chatStreamBridgeService'

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

type SessionState = {
  snapshot: StreamBridgeSnapshot
  config: ChatApiConfig
  loadingMessageId: string
  activeMessageId: string
  controller: AbortController | null
  subscribers: Set<MessagePort>
  cleanupTimer: number | null
}

declare const self: SharedWorkerGlobalScope

const FINAL_STATE_TTL_MS = 5 * 60 * 1000
const sessionStates = new Map<string, SessionState>()
const portSubscriptions = new Map<MessagePort, Set<string>>()

// SharedWorker 持有真正的 stream 连接，页面刷新后重新连回同一个 session 即可继续收消息。

function cloneMessages(messages: StreamBridgeMessage[]) {
  return messages.map((message) => ({
    ...message,
    toolCalls: message.toolCalls ? [...message.toolCalls] : undefined,
    references: message.references ? [...message.references] : undefined,
    courses: message.courses ? [...message.courses] : undefined,
    skillOutput: message.skillOutput ? [...message.skillOutput] : undefined,
  }))
}

function createSnapshot(
  sessionId: string,
  messages: StreamBridgeMessage[],
  status: StreamBridgeStatus,
  error?: string,
): StreamBridgeSnapshot {
  return {
    sessionId,
    messages: cloneMessages(messages),
    status,
    error,
  }
}

function upsertToolCall(message: StreamBridgeMessage, nextToolCall: ToolCall): StreamBridgeMessage {
  const toolCalls = message.toolCalls ?? []
  const existingToolCall = toolCalls.find((item) => item.runId === nextToolCall.runId)

  if (!existingToolCall) {
    return {
      ...message,
      toolCalls: [...toolCalls, nextToolCall],
    }
  }

  return {
    ...message,
    toolCalls: toolCalls.map((item) =>
      item.runId === nextToolCall.runId
        ? {
            ...item,
            ...nextToolCall,
            input: Object.keys(nextToolCall.input).length ? nextToolCall.input : item.input,
          }
        : item,
    ),
  }
}

function withMessageById(
  state: SessionState,
  messageId: string,
  updater: (message: StreamBridgeMessage) => StreamBridgeMessage,
) {
  state.snapshot = {
    ...state.snapshot,
    messages: state.snapshot.messages.map((message) =>
      message.id === messageId
        ? updater(message)
        : message,
    ),
  }
}

// 一轮流式响应里如果已经进入工具步骤，后续新的正文要落到新的 assistant 消息里，避免把工具前后的文字揉成一块。
function createFollowupAssistantMessage(
  baseMessage: StreamBridgeMessage,
  nextMessageId: string,
  timestamp: string,
): StreamBridgeMessage {
  return {
    ...baseMessage,
    id: nextMessageId,
    content: '',
    timestamp,
    loading: true,
    toolCalls: [],
    references: [],
    courses: [],
    skillOutput: [],
  }
}

function clearCleanupTimer(state: SessionState) {
  if (state.cleanupTimer !== null) {
    self.clearTimeout(state.cleanupTimer)
    state.cleanupTimer = null
  }
}

function scheduleCleanup(sessionId: string) {
  const state = sessionStates.get(sessionId)

  if (!state) {
    return
  }

  clearCleanupTimer(state)
  state.cleanupTimer = self.setTimeout(() => {
    const currentState = sessionStates.get(sessionId)

    if (!currentState || currentState.snapshot.status === 'streaming') {
      return
    }

    sessionStates.delete(sessionId)
  }, FINAL_STATE_TTL_MS)
}

function broadcastSnapshot(sessionId: string) {
  const state = sessionStates.get(sessionId)

  if (!state) {
    return
  }

  const payload = {
    type: 'snapshot' as const,
    sessionId,
    snapshot: createSnapshot(
      state.snapshot.sessionId,
      state.snapshot.messages,
      state.snapshot.status,
      state.snapshot.error,
    ),
  }

  for (const port of state.subscribers) {
    try {
      port.postMessage(payload)
    } catch {
      state.subscribers.delete(port)
      portSubscriptions.get(port)?.delete(sessionId)
    }
  }
}

function ensurePortSubscriptions(port: MessagePort) {
  let subscriptions = portSubscriptions.get(port)

  if (!subscriptions) {
    subscriptions = new Set<string>()
    portSubscriptions.set(port, subscriptions)
  }

  return subscriptions
}

function subscribePortToSession(port: MessagePort, sessionId: string) {
  const subscriptions = ensurePortSubscriptions(port)
  subscriptions.add(sessionId)

  const state = sessionStates.get(sessionId)
  if (state) {
    state.subscribers.add(port)
  }
}

function unsubscribePortFromSession(port: MessagePort, sessionId: string) {
  portSubscriptions.get(port)?.delete(sessionId)
  sessionStates.get(sessionId)?.subscribers.delete(port)
}

async function loadCourseTable(state: SessionState, toolCall: ToolCall, messageId: string) {
  const filePath = extractCourseTableFilePath(toolCall)

  if (!filePath || !state.controller || state.controller.signal.aborted) {
    return
  }

  try {
    const rawContent = await downloadSessionFileContent(
      state.config,
      state.snapshot.sessionId,
      filePath,
      state.controller.signal,
    )
    const courses = parseCourseTableContent(rawContent)

    if (!courses.length || state.controller.signal.aborted) {
      return
    }

    withMessageById(state, messageId, (message) => ({
      ...upsertToolCall(message, toolCall),
      courses,
    }))
    broadcastSnapshot(state.snapshot.sessionId)
  } catch {
    // 课程文件下载失败时保持普通工具卡展示，不阻断主回答。
  }
}

function finalizeStream(sessionId: string, status: StreamBridgeStatus, error?: string) {
  const state = sessionStates.get(sessionId)

  if (!state) {
    return
  }

  withMessageById(state, state.activeMessageId, (message) => ({
    ...message,
    loading: false,
    ...(status === 'error' && !message.content
      ? {
          content: '请求失败，请稍后重试。',
        }
      : {}),
  }))

  state.snapshot = {
    ...state.snapshot,
    status,
    error,
  }
  state.controller = null
  broadcastSnapshot(sessionId)
  scheduleCleanup(sessionId)
}

async function runStream(command: StartStreamCommand) {
  const state = sessionStates.get(command.sessionId)

  if (!state || !state.controller) {
    return
  }

  try {
    const stream = await streamChatMessage(
      command.config,
      command.sessionId,
      command.payload,
      state.controller.signal,
    )

    await readSseStream(stream, {
      onTextDelta(chunk) {
        const replyTime = new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

        const result = appendTextDeltaToStreamMessages(
          state.snapshot.messages,
          state.activeMessageId,
          chunk,
          replyTime,
          createFollowupAssistantMessage,
        )

        state.snapshot = {
          ...state.snapshot,
          messages: result.messages,
        }
        state.activeMessageId = result.activeMessageId
        broadcastSnapshot(command.sessionId)
      },
      onToolStart(toolCall) {
        const toolMessageId = state.activeMessageId
        withMessageById(state, toolMessageId, (message) => upsertToolCall(message, toolCall))
        broadcastSnapshot(command.sessionId)
      },
      onToolEnd(toolCall) {
        const toolMessageId = state.activeMessageId
        withMessageById(state, toolMessageId, (message) => upsertToolCall(message, toolCall))
        broadcastSnapshot(command.sessionId)
        void loadCourseTable(state, toolCall, toolMessageId)
      },
      onReferences(references) {
        withMessageById(state, state.activeMessageId, (message) => ({
          ...message,
          references,
        }))
        broadcastSnapshot(command.sessionId)
      },
      onSkillOutput(skillOutput) {
        withMessageById(state, state.activeMessageId, (message) => ({
          ...message,
          skillOutput,
        }))
        broadcastSnapshot(command.sessionId)
      },
    })

    if (state.controller.signal.aborted) {
      finalizeStream(command.sessionId, 'aborted')
      return
    }

    finalizeStream(command.sessionId, 'completed')
  } catch (error) {
    if (state.controller?.signal.aborted) {
      finalizeStream(command.sessionId, 'aborted')
      return
    }

    finalizeStream(
      command.sessionId,
      'error',
      error instanceof Error ? error.message : '请求失败，请稍后重试。',
    )
  }
}

function handleStartStream(port: MessagePort, command: StartStreamCommand) {
  const previousState = sessionStates.get(command.sessionId)
  previousState?.controller?.abort()

  // 同一个 session 只保留一条在途流，避免重复并发写入同一条 assistant 消息。
  const nextState: SessionState = {
    snapshot: createSnapshot(command.sessionId, command.messages, 'streaming'),
    config: command.config,
    loadingMessageId: command.loadingMessageId,
    activeMessageId: command.loadingMessageId,
    controller: new AbortController(),
    subscribers: new Set<MessagePort>(),
    cleanupTimer: null,
  }

  sessionStates.set(command.sessionId, nextState)
  subscribePortToSession(port, command.sessionId)
  clearCleanupTimer(nextState)
  broadcastSnapshot(command.sessionId)
  void runStream(command)
}

function handleSubscribe(port: MessagePort, sessionId: string) {
  subscribePortToSession(port, sessionId)

  const state = sessionStates.get(sessionId)
  port.postMessage({
    type: 'snapshot',
    sessionId,
    snapshot: state
      ? createSnapshot(
          state.snapshot.sessionId,
          state.snapshot.messages,
          state.snapshot.status,
          state.snapshot.error,
        )
      : null,
  })
}

function handlePortMessage(port: MessagePort, event: MessageEvent<WorkerCommand>) {
  const command = event.data

  if (!command || typeof command !== 'object' || typeof command.type !== 'string') {
    return
  }

  switch (command.type) {
    case 'subscribe':
      handleSubscribe(port, command.sessionId)
      return
    case 'unsubscribe':
      unsubscribePortFromSession(port, command.sessionId)
      return
    case 'stop-stream':
      sessionStates.get(command.sessionId)?.controller?.abort()
      return
    case 'start-stream':
      handleStartStream(port, command)
      return
  }
}

self.addEventListener('connect', (event) => {
  const [port] = event.ports

  port.start()
  port.onmessage = (messageEvent) => {
    handlePortMessage(port, messageEvent as MessageEvent<WorkerCommand>)
  }
})

export {}
