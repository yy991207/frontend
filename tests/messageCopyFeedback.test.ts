import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readPage(relativePath: string) {
  return readFile(new URL(`../src/pages/${relativePath}`, import.meta.url), 'utf8')
}

test('chat page tracks copied message id and resets it after timeout', async () => {
  const content = await readPage('Chat/ChatPage.tsx')

  assert.match(content, /copiedMessageId/)
  assert.match(content, /window\.setTimeout\(/)
  assert.match(content, /handleCopy\(message\.id, message\.content\)/)
  assert.match(content, /copiedMessageId === message\.id \? '已复制' : '复制'/)
})

test('partner page tracks copied message id and resets it after timeout', async () => {
  const content = await readPage('Partner/PartnerPage.tsx')

  assert.match(content, /copiedMessageId/)
  assert.match(content, /window\.setTimeout\(/)
  assert.match(content, /handleCopy\(message\.id, message\.content\)/)
  assert.match(content, /copiedMessageId === message\.id \? '已复制' : '复制'/)
})
