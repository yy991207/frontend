import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readPage(relativePath: string) {
  return readFile(new URL(`../src/pages/${relativePath}`, import.meta.url), 'utf8')
}

test('home page uses shared attachment menu component', async () => {
  const content = await readPage('Home/HomePage.tsx')
  assert.match(content, /AttachmentMenu.*components\/common\/AttachmentMenu/)
  assert.match(content, /<AttachmentMenu/)
})

test('chat page uses shared attachment menu component', async () => {
  const content = await readPage('Chat/ChatPage.tsx')
  assert.match(content, /AttachmentMenu.*components\/common\/AttachmentMenu/)
  assert.match(content, /<AttachmentMenu/)
})
