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
  assert.match(content, /routeSessionId/)
  assert.match(content, /const session = await getChatSession\(config, routeSessionId, controller\.signal\)/)
  assert.match(content, /message_id/)
  assert.match(content, /role: message\.role/)
  assert.match(content, /content: message\.content/)
  assert.match(content, /mapSessionDetailToMessages/)
})

test('chat and partner pages drive a dedicated session loading skeleton while restoring history', async () => {
  const chatContent = await readFile(new URL('../src/pages/Chat/ChatPage.tsx', import.meta.url), 'utf8')
  const partnerContent = await readFile(new URL('../src/pages/Partner/PartnerPage.tsx', import.meta.url), 'utf8')

  assert.match(chatContent, /const \[sessionLoading, setSessionLoading\] = useState\(false\)/)
  assert.match(chatContent, /threadLoading=\{sessionLoading\}/)
  assert.match(chatContent, /setSessionLoading\(true\)/)
  assert.match(chatContent, /setSessionLoading\(false\)/)

  assert.match(partnerContent, /const \[sessionLoading, setSessionLoading\] = useState\(false\)/)
  assert.match(partnerContent, /threadLoading=\{sessionLoading\}/)
  assert.match(partnerContent, /setSessionLoading\(true\)/)
  assert.match(partnerContent, /setSessionLoading\(false\)/)
})
