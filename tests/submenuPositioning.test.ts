import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readLess(relativePath: string) {
  return readFile(new URL(`../src/pages/${relativePath}`, import.meta.url), 'utf8')
}

test('chat submenu uses absolute positioning instead of flex flow', async () => {
  const content = await readLess('Chat/chat.module.less')

  assert.match(content, /\.attachMenuLayer\s*\{[\s\S]*position:\s*absolute;/)
  assert.match(content, /\.attachMenuLayer\s*\{[\s\S]*align-items:\s*stretch;/)
  assert.match(content, /\.toolSubmenu\s*\{[\s\S]*position:\s*absolute;/)
  assert.match(content, /\.skillSubmenu\s*\{[\s\S]*position:\s*absolute;/)
})

test('partner submenu uses absolute positioning instead of flex flow', async () => {
  const content = await readLess('Partner/partner.module.less')

  assert.match(content, /\.attachMenuLayer\s*\{[\s\S]*position:\s*absolute;/)
  assert.match(content, /\.attachMenuLayer\s*\{[\s\S]*align-items:\s*stretch;/)
  assert.match(content, /\.toolSubmenu\s*\{[\s\S]*position:\s*absolute;/)
  assert.match(content, /\.skillSubmenu\s*\{[\s\S]*position:\s*absolute;/)
})
