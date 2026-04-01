import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readPage(relativePath: string) {
  return readFile(new URL(`../src/pages/${relativePath}`, import.meta.url), 'utf8')
}

test('chat footer hint is rendered after composerWrap', async () => {
  const content = await readPage('Chat/ChatPage.tsx')

  assert.match(content, /<div ref=\{composerRef\} className=\{styles\.composerWrap\}>[\s\S]*<\/div>\s*<div className=\{styles\.footerHint\}>/)
})

test('partner footer hint is rendered after composerWrap', async () => {
  const content = await readPage('Partner/PartnerPage.tsx')

  assert.match(content, /<div ref=\{composerRef\} className=\{styles\.composerWrap\}>[\s\S]*<\/div>\s*<div className=\{styles\.footerHint\}>/)
})

test('chat footer hint shares centered vertical composer stack', async () => {
  const content = await readFile(new URL('../src/pages/Chat/chat.module.less', import.meta.url), 'utf8')

  assert.match(content, /\.composerArea\s*\{[\s\S]*flex-direction:\s*column;/)
  assert.match(content, /\.footerHint\s*\{[\s\S]*width:\s*100%;/)
  assert.match(content, /\.footerHint\s*\{[\s\S]*max-width:\s*960px;/)
})

test('partner footer hint shares centered vertical composer stack', async () => {
  const content = await readFile(new URL('../src/pages/Partner/partner.module.less', import.meta.url), 'utf8')

  assert.match(content, /\.composerArea\s*\{[\s\S]*flex-direction:\s*column;/)
  assert.match(content, /\.footerHint\s*\{[\s\S]*width:\s*100%;/)
  assert.match(content, /\.footerHint\s*\{[\s\S]*max-width:\s*960px;/)
})
