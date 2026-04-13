export const CHAT_SESSION_HISTORY_REFRESH_EVENT = 'chat-session-history-refresh'

export function notifyChatSessionHistoryRefresh(sessionId?: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(CHAT_SESSION_HISTORY_REFRESH_EVENT, {
    detail: {
      sessionId,
    },
  }))
}

export const AGENT_USAGE_LOG_REFRESH_EVENT = 'agent-usage-log-refresh'

export function notifyAgentUsageLogRefresh() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(AGENT_USAGE_LOG_REFRESH_EVENT))
}
