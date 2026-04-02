import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('partner attachment submenus are absolutely positioned beside main menu', async () => {
  const content = await readFile(new URL('../src/pages/Partner/partner.module.less', import.meta.url), 'utf8')

  assert.match(content, /\.attachMenuLayer\s*\{[\s\S]*align-items:\s*stretch;/)
  assert.match(content, /\.toolSubmenu\s*\{[\s\S]*position:\s*absolute;/)
  assert.match(content, /\.toolSubmenu\s*\{[\s\S]*left:\s*calc\(268px \+ 6px\);/)
  assert.match(content, /\.skillSubmenu\s*\{[\s\S]*position:\s*absolute;/)
  assert.match(content, /\.skillSubmenu\s*\{[\s\S]*left:\s*calc\(268px \+ 6px\);/)
})
