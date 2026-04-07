import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('home page enables tools in shared attachment menu', async () => {
  const content = await readFile(new URL('../src/pages/Home/HomePage.tsx', import.meta.url), 'utf8')

  assert.match(content, /<AttachmentMenu[\s\S]*showTools/)
  assert.match(content, /onToggleWebSearch/)
  assert.match(content, /onToggleKnowledge/)
})

test('attachment menu uses an opaque overlay surface above home cards', async () => {
  const style = await readFile(new URL('../src/components/common/AttachmentMenu.module.less', import.meta.url), 'utf8')

  assert.match(style, /\.root\s*\{[^}]*z-index:\s*40;/s)
  assert.match(style, /\.menuSurface\s*\{[^}]*background:\s*#ffffff;/s)
  assert.match(style, /\.menuSurface\s*\{[^}]*z-index:\s*80;/s)
  assert.doesNotMatch(style, /\.menuSurface\s*\{[^}]*backdrop-filter:/s)
  assert.match(style, /\.submenu\s*\{[^}]*background:\s*#ffffff;/s)
  assert.match(style, /\.submenu\s*\{[^}]*z-index:\s*81;/s)
})
