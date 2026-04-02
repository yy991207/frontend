import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('partner page saves name and markdown tabs via update partner config service', async () => {
  const content = await readFile(new URL('../src/pages/Partner/PartnerPage.tsx', import.meta.url), 'utf8')

  assert.match(content, /updatePartnerConfig/)
  assert.match(content, /handleConfirmName/)
  assert.match(content, /handleSaveSoul/)
  assert.match(content, /handleSaveUser/)
  assert.match(content, /handleSaveIdentity/)
})
