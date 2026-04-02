import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('partner name modal input does not save on enter', async () => {
  const content = await readFile(new URL('../src/pages/Partner/PartnerPage.tsx', import.meta.url), 'utf8')

  assert.match(content, /value=\{nameDraft\}/)
  assert.match(content, /className=\{styles\.nameModalInput\}/)
  assert.doesNotMatch(content, /value=\{nameDraft\}[\s\S]*onKeyDown=\{\(event\) => \{[\s\S]*handleConfirmName\(\)/)
})
