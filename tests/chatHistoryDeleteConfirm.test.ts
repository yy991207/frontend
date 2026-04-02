import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('chat session history uses shared delete confirm modal before deleting', async () => {
  const content = await readFile(new URL('../src/components/ChatSessionHistory/ChatSessionHistory.tsx', import.meta.url), 'utf8')

  assert.match(content, /DeleteConfirmModal/)
  assert.match(content, /setDeleteTargetSession/)
  assert.match(content, /await deleteChatSession/)
})
