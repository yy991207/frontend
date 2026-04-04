import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(relativePath: string) {
  return readFile(new URL(`../src/${relativePath}`, import.meta.url), 'utf8')
}

async function readFromSrc(relativePath: string) {
  return readFile(new URL(`../src/${relativePath}`, import.meta.url), 'utf8')
}

test('chat service forwards reasoning_content from stream and history payloads', async () => {
  const chatService = await read('services/chatService.ts')
  const chatSessionService = await read('services/chatSessionService.ts')

  assert.match(chatService, /onReasoningDelta\?: \(chunk: string\) => void/)
  assert.match(chatService, /reasoning_content\?: string/)
  assert.match(chatService, /const reasoningChunk =/)
  assert.ok(chatService.includes('options.onReasoningDelta?.(reasoningContent)'))
  assert.ok(chatService.includes('options.onReasoningDelta?.(output.reasoning_content)'))
  assert.match(chatSessionService, /reasoning_content\?: string \| null/)
})

test('chat and partner pages map reasoning_content into reasoningContent and append stream deltas', async () => {
  const chatPage = await read('pages/Chat/ChatPage.tsx')
  const partnerPage = await read('pages/Partner/PartnerPage.tsx')

  assert.match(chatPage, /reasoningContent: message\.reasoning_content \?\? null/)
  assert.match(chatPage, /onReasoningDelta\(chunk\)/)
  assert.match(chatPage, /reasoningContent: `\$\{message\.reasoningContent \?\? ''\}\$\{chunk\}`/)

  assert.match(partnerPage, /reasoningContent: message\.reasoning_content \?\? null/)
  assert.match(partnerPage, /onReasoningDelta\(chunk\)/)
  assert.match(partnerPage, /reasoningContent: `\$\{message\.reasoningContent \?\? ''\}\$\{chunk\}`/)
})

test('shared stream bridge forwards reasoning deltas so process panel can render think content during streaming', async () => {
  const streamBridgeService = await readFromSrc('services/chatStreamBridgeService.ts')
  const streamWorker = await readFromSrc('workers/chatStreamWorker.ts')

  assert.match(streamBridgeService, /reasoningContent\?: string \| null/)
  assert.match(streamWorker, /onReasoningDelta\(chunk\)/)
  assert.match(streamWorker, /reasoningContent: `\$\{message\.reasoningContent \?\? ''\}\$\{chunk\}`/)
})

test('streaming flow advances to a new assistant message when a new chat model round starts after tool steps', async () => {
  const chatService = await readFromSrc('services/chatService.ts')
  const streamWorker = await readFromSrc('workers/chatStreamWorker.ts')
  const chatPage = await readFromSrc('pages/Chat/ChatPage.tsx')
  const partnerPage = await readFromSrc('pages/Partner/PartnerPage.tsx')

  assert.match(chatService, /onChatModelStart\?: \(\) => void/)
  assert.match(chatService, /currentEvent === 'on_chat_model_start'/)
  assert.match(streamWorker, /onChatModelStart\(\)/)
  assert.match(streamWorker, /advanceAssistantMessageForNextModelPhase/)
  assert.match(chatPage, /onChatModelStart\(\)/)
  assert.match(chatPage, /advanceAssistantMessageForNextModelPhase/)
  assert.match(partnerPage, /onChatModelStart\(\)/)
  assert.match(partnerPage, /advanceAssistantMessageForNextModelPhase/)
})
