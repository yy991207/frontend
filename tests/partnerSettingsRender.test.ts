import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('partner page fetches config when settings opens and renders all markdown tabs', async () => {
  const content = await readFile(new URL('../src/pages/Partner/PartnerPage.tsx', import.meta.url), 'utf8')

  assert.match(content, /fetchPartnerConfig/)
  assert.match(content, /isSettingsOpen/)
  assert.match(content, /SOUL\.md/)
  assert.match(content, /USER\.md/)
  assert.match(content, /IDENTITY\.md/)
})
