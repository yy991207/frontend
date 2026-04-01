import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readPage(relativePath: string) {
  return readFile(new URL(`../src/pages/${relativePath}`, import.meta.url), 'utf8')
}

test('chat input enter handler ignores IME composing state', async () => {
  const content = await readPage('Chat/ChatPage.tsx')

  assert.match(content, /event\.nativeEvent\.isComposing/)
  assert.match(content, /event\.nativeEvent\.keyCode === 229/)
})

test('partner input enter handler ignores IME composing state', async () => {
  const content = await readPage('Partner/PartnerPage.tsx')

  assert.match(content, /event\.nativeEvent\.isComposing/)
  assert.match(content, /event\.nativeEvent\.keyCode === 229/)
})
