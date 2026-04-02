import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('chat session history navigates to chat page with sessionId query', async () => {
  const content = await readFile(new URL('../src/components/ChatSessionHistory/ChatSessionHistory.tsx', import.meta.url), 'utf8')

  assert.match(content, /navigate\(`\/chat\?sessionId=\$\{sessionId\}`\)/)
})

test('chat page loads session detail and maps API messages into UI messages', async () => {
  const content = await readFile(new URL('../src/pages/Chat/ChatPage.tsx', import.meta.url), 'utf8')

  assert.match(content, /getChatSession/)
  assert.match(content, /initialSessionId/)
  assert.match(content, /message_id/)
  assert.match(content, /role: message\.role/)
  assert.match(content, /content: message\.content/)
  assert.match(content, /mapSessionDetailToMessages/)
})
