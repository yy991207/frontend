import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('chat page includes header dropdown delete flow with confirm dialog and redirect', async () => {
  const content = await readFile(new URL('../src/pages/Chat/ChatPage.tsx', import.meta.url), 'utf8')

  assert.match(content, /DeleteConfirmModal/)
  assert.match(content, /setDeleteConfirmOpen/)
  assert.match(content, /navigate\('\/'\)/)
  assert.match(content, /删除当前会话/)
  assert.match(content, /onConfirm=\{handleDeleteCurrentSession\}/)
})
