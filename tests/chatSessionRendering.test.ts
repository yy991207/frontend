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

test('chat session history listens for refresh events and silently reloads sessions', async () => {
  const content = await readFile(new URL('../src/components/ChatSessionHistory/ChatSessionHistory.tsx', import.meta.url), 'utf8')

  assert.match(content, /loadSessions\(\{\s*silent:\s*true\s*\}\)/)
  assert.match(content, /CHAT_SESSION_HISTORY_REFRESH_EVENT/)
  assert.match(content, /addEventListener/)
  assert.match(content, /removeEventListener/)
})

test('chat and partner pages notify history refresh after reply lifecycle updates the session name', async () => {
  const chatContent = await readFile(new URL('../src/pages/Chat/ChatPage.tsx', import.meta.url), 'utf8')
  const partnerContent = await readFile(new URL('../src/pages/Partner/PartnerPage.tsx', import.meta.url), 'utf8')

  assert.match(chatContent, /notifyChatSessionHistoryRefresh/)
  assert.match(chatContent, /sessionId/)
  assert.match(partnerContent, /notifyChatSessionHistoryRefresh/)
  assert.match(partnerContent, /sessionId/)
})

test('chat and partner pages keep the message viewport scrolled to the latest content during session loading', async () => {
  const chatContent = await readFile(new URL('../src/pages/Chat/ChatPage.tsx', import.meta.url), 'utf8')
  const partnerContent = await readFile(new URL('../src/pages/Partner/PartnerPage.tsx', import.meta.url), 'utf8')
  const hookContent = await readFile(new URL('../src/components/chat/use-stick-to-bottom.ts', import.meta.url), 'utf8')

  assert.match(hookContent, /export function useStickToBottom/)
  assert.match(hookContent, /const containerRef = useRef<HTMLDivElement \| null>\(null\)/)
  assert.match(hookContent, /const \[isAtBottom, setIsAtBottom\] = useState\(true\)/)
  assert.match(hookContent, /scrollTo\(\{/)
  assert.match(hookContent, /top: container\.scrollHeight/)
  assert.match(hookContent, /behavior: smooth \? 'smooth' : 'auto'/)
  assert.match(hookContent, /Math\.abs\(container\.scrollHeight - container\.clientHeight - container\.scrollTop\)/)
  assert.match(hookContent, /setIsAtBottom\(distanceToBottom <= threshold\)/)
  assert.match(hookContent, /if \(!isAtBottom && !forceScroll\) \{/)
  assert.match(hookContent, /containerRef,\s*scrollToBottom,\s*isAtBottom/)

  assert.match(chatContent, /useStickToBottom\(\)/)
  assert.match(chatContent, /containerRef:\s*messagesViewportRef/)
  assert.match(chatContent, /scrollToBottom\(\{ smooth: true, forceScroll: sessionLoading \}\)/)
  assert.match(chatContent, /if \(isResponding \|\| sessionLoading \|\| stickToBottom\.isAtBottom\)/)

  assert.match(partnerContent, /useStickToBottom\(\)/)
  assert.match(partnerContent, /containerRef:\s*messagesViewportRef/)
  assert.match(partnerContent, /scrollToBottom\(\{ smooth: true, forceScroll: sessionLoading \}\)/)
  assert.match(partnerContent, /if \(isResponding \|\| sessionLoading \|\| stickToBottom\.isAtBottom\)/)
})
