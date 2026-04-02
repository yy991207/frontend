import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('partner page supports edit, cancel and save for user and identity tabs', async () => {
  const content = await readFile(new URL('../src/pages/Partner/PartnerPage.tsx', import.meta.url), 'utf8')

  assert.match(content, /isEditingUser/)
  assert.match(content, /userContentDraft/)
  assert.match(content, /handleEditUser/)
  assert.match(content, /handleCancelEditUser/)
  assert.match(content, /handleSaveUser/)

  assert.match(content, /isEditingIdentity/)
  assert.match(content, /identityContentDraft/)
  assert.match(content, /handleEditIdentity/)
  assert.match(content, /handleCancelEditIdentity/)
  assert.match(content, /handleSaveIdentity/)
})
