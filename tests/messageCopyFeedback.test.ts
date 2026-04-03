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
  assert.match(content, /resolveAssistantCopyTargets/)
  assert.match(content, /assistantCopyTargets=/)
})

test('partner page tracks copied message id and resets it after timeout', async () => {
  const content = await readPage('Partner/PartnerPage.tsx')

  assert.match(content, /copiedMessageId/)
  assert.match(content, /window\.setTimeout\(/)
  assert.match(content, /resolveAssistantCopyTargets/)
  assert.match(content, /assistantCopyTargets=/)
})
