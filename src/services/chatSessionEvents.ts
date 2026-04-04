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
