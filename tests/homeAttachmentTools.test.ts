import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('home page enables tools in shared attachment menu', async () => {
  const content = await readFile(new URL('../src/pages/Home/HomePage.tsx', import.meta.url), 'utf8')

  assert.match(content, /<AttachmentMenu[\s\S]*showTools/)
  assert.match(content, /onToggleWebSearch/)
  assert.match(content, /onToggleKnowledge/)
})
