import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('home and chat stabilize loadSkills with useCallback', async () => {
  const home = await readFile(new URL('../src/pages/Home/HomePage.tsx', import.meta.url), 'utf8')
  const chat = await readFile(new URL('../src/pages/Chat/ChatPage.tsx', import.meta.url), 'utf8')

  assert.match(home, /const fetchSkills = useCallback\(/)
  assert.match(chat, /const fetchSkills = useCallback\(/)
})

test('chat page fully renders shared attachment menu instead of legacy menu markup', async () => {
  const chat = await readFile(new URL('../src/pages/Chat/ChatPage.tsx', import.meta.url), 'utf8')

  assert.match(chat, /<AttachmentMenu/)
  assert.doesNotMatch(chat, /styles\.attachMenuLayer/)
  assert.doesNotMatch(chat, /styles\.skillSubmenu/)
  assert.doesNotMatch(chat, /styles\.toolSubmenu/)
})
