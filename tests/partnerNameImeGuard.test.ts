import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('partner name modal input ignores enter while IME is composing', async () => {
  const content = await readFile(new URL('../src/pages/Partner/PartnerPage.tsx', import.meta.url), 'utf8')

  assert.match(
    content,
    /value=\{nameDraft\}[\s\S]*onKeyDown=\{\(event\) => \{[\s\S]*event\.nativeEvent\.isComposing[\s\S]*event\.nativeEvent\.keyCode === 229[\s\S]*handleConfirmName\(\)[\s\S]*className=\{styles\.nameModalInput\}/,
  )
})
