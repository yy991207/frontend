import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('chat layout constrains message and composer width', async () => {
  const content = await readFile(new URL('../src/pages/Chat/chat.module.less', import.meta.url), 'utf8')

  assert.match(content, /\.messages\s*\{[\s\S]*align-items:\s*center;/)
  assert.match(content, /\.messageColumn\s*\{[\s\S]*max-width:\s*960px;/)
  assert.match(content, /\.composerArea\s*\{[\s\S]*display:\s*flex;/)
})

test('partner layout constrains message and composer width', async () => {
  const content = await readFile(new URL('../src/pages/Partner/partner.module.less', import.meta.url), 'utf8')

  assert.match(content, /\.messages\s*\{[\s\S]*align-items:\s*center;/)
  assert.match(content, /\.messageColumn\s*\{[\s\S]*max-width:\s*960px;/)
  assert.match(content, /\.composerArea\s*\{[\s\S]*display:\s*flex;/)
})
