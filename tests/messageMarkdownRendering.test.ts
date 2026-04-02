import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('chat page renders assistant content through markdown renderer', async () => {
  const content = await readFile(new URL('../src/pages/Chat/ChatPage.tsx', import.meta.url), 'utf8')

  assert.match(content, /renderMessageMarkdown/)
  assert.match(content, /renderMessageMarkdown\(message\.content\)/)
})

test('partner page renders assistant content through markdown renderer', async () => {
  const content = await readFile(new URL('../src/pages/Partner/PartnerPage.tsx', import.meta.url), 'utf8')

  assert.match(content, /renderMessageMarkdown/)
  assert.match(content, /renderMessageMarkdown\(message\.content\)/)
})
