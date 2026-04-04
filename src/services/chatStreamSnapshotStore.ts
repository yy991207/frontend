import type { StreamBridgeSnapshot } from './chatStreamBridgeService'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const ACTIVE_STREAM_SNAPSHOT_KEY = 'chat-active-stream-snapshots'

type SnapshotRecord = StreamBridgeSnapshot & {
  savedAt: number
}

function getStorage(storage?: StorageLike | null) {
  if (storage) {
    return storage
  }

  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function readSnapshotMap(storage?: StorageLike | null): Record<string, SnapshotRecord> {
  const targetStorage = getStorage(storage)

  if (!targetStorage) {
    return {}
  }

  try {
    const rawValue = targetStorage.getItem(ACTIVE_STREAM_SNAPSHOT_KEY)

    if (!rawValue) {
      return {}
    }

    const parsedValue = JSON.parse(rawValue)
    return typeof parsedValue === 'object' && parsedValue !== null ? parsedValue as Record<string, SnapshotRecord> : {}
  } catch {
    return {}
  }
}

function writeSnapshotMap(snapshotMap: Record<string, SnapshotRecord>, storage?: StorageLike | null) {
  const targetStorage = getStorage(storage)

  if (!targetStorage) {
    return
  }

  const sessionIds = Object.keys(snapshotMap)

  if (sessionIds.length === 0) {
    targetStorage.removeItem(ACTIVE_STREAM_SNAPSHOT_KEY)
    return
  }

  targetStorage.setItem(ACTIVE_STREAM_SNAPSHOT_KEY, JSON.stringify(snapshotMap))
}

export function persistChatStreamSnapshot(snapshot: StreamBridgeSnapshot, storage?: StorageLike | null) {
  const snapshotMap = readSnapshotMap(storage)
  snapshotMap[snapshot.sessionId] = {
    ...snapshot,
    savedAt: Date.now(),
  }
  writeSnapshotMap(snapshotMap, storage)
}

export function loadChatStreamSnapshot(sessionId: string, storage?: StorageLike | null): StreamBridgeSnapshot | null {
  const snapshotMap = readSnapshotMap(storage)
  const snapshot = snapshotMap[sessionId]

  if (!snapshot) {
    return null
  }

  return {
    sessionId: snapshot.sessionId,
    messages: snapshot.messages,
    status: snapshot.status,
    error: snapshot.error,
    activeMessageId: snapshot.activeMessageId,
    lastEventSequence: snapshot.lastEventSequence,
  }
}

export function clearChatStreamSnapshot(sessionId: string, storage?: StorageLike | null) {
  const snapshotMap = readSnapshotMap(storage)

  if (!(sessionId in snapshotMap)) {
    return
  }

  delete snapshotMap[sessionId]
  writeSnapshotMap(snapshotMap, storage)
}
