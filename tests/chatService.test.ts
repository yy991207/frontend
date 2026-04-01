import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractSessionId,
  extractCourseTableFilePath,
  extractReferences,
  parseCourseTableContent,
  parseChatApiConfig,
  readSseStream,
  resolveQuickActionToolType,
} from '../src/services/chatService.ts'

test('parseChatApiConfig builds session endpoints from config yaml', () => {
  const config = parseChatApiConfig([
    'user_id: user123',
    'url: http://127.0.0.1:8000/',
  ].join('\n'))

  assert.equal(config.userId, 'user123')
  assert.equal(config.createSessionEndpoint, 'http://127.0.0.1:8000/api/v1/chat/sessions')
  assert.equal(config.streamEndpointBase, 'http://127.0.0.1:8000/api/v1/chat/sessions')
})

test('extractSessionId prefers top-level session_id', () => {
  const sessionId = extractSessionId({
    session_id: 'user123_20260401_20392709',
    user_id: 'user123',
    message: '会话创建成功',
  })

  assert.equal(sessionId, 'user123_20260401_20392709')
})

test('readSseStream appends incremental assistant text chunks', async () => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          [
            'event: on_chat_model_stream\n',
            'data: {"data":{"chunk":{"content":"你好"}}}\n\n',
            'event: on_chat_model_stream\n',
            'data: {"data":{"chunk":{"content":"，世界"}}}\n\n',
          ].join(''),
        ),
      )
      controller.close()
    },
  })

  const chunks: string[] = []

  await readSseStream(stream, {
    onTextDelta(chunk) {
      chunks.push(chunk)
    },
  })

  assert.deepEqual(chunks, ['你好', '，世界'])
})

test('readSseStream reports tool start and end events', async () => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          [
            'event: on_tool_start\n',
            'data: {"name":"explore","run_id":"run-1","data":{"input":{"count":5}}}\n\n',
            'event: on_tool_end\n',
            'data: {"name":"explore","run_id":"run-1","data":{"output":{"ok":true},"tool_display":{"tool_label":"课程推荐","items":[{"title":"课程 A"}]}}}\n\n',
          ].join(''),
        ),
      )
      controller.close()
    },
  })

  const events: unknown[] = []

  await readSseStream(stream, {
    onToolStart(toolCall) {
      events.push({ type: 'start', toolCall })
    },
    onToolEnd(toolCall) {
      events.push({ type: 'end', toolCall })
    },
  })

  assert.deepEqual(events, [
    {
      type: 'start',
      toolCall: {
        name: 'explore',
        runId: 'run-1',
        status: 'running',
        input: { count: 5 },
      },
    },
    {
      type: 'end',
      toolCall: {
        name: 'explore',
        runId: 'run-1',
        status: 'completed',
        input: {},
        output: { ok: true },
        toolDisplay: {
          tool_label: '课程推荐',
          items: [{ title: '课程 A' }],
        },
      },
    },
  ])
})

test('resolveQuickActionToolType maps course planning prompt to explore', () => {
  assert.equal(resolveQuickActionToolType('帮我规划一个关于机器学习的课表，要求5门课程，总时长60分钟'), 'explore')
  assert.equal(resolveQuickActionToolType('写一份周报'), null)
})

test('readSseStream reports references from chain end event', async () => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          [
            'event: on_chain_end\n',
            'data: {"data":{"references":[{"title":"机器学习导论","url":"https://example.com/course"}]}}\n\n',
          ].join(''),
        ),
      )
      controller.close()
    },
  })

  const references: unknown[] = []

  await readSseStream(stream, {
    onReferences(nextReferences) {
      references.push(nextReferences)
    },
  })

  assert.deepEqual(references, [[{ title: '机器学习导论', url: 'https://example.com/course' }]])
})

test('extractCourseTableFilePath detects course_table json from tool input', () => {
  assert.equal(extractCourseTableFilePath({ input: { file_path: 'result/course_table.json' } }), 'result/course_table.json')
  assert.equal(extractCourseTableFilePath({ input: { file_path: 'result/notes.md' } }), null)
})

test('parseCourseTableContent parses fenced json course list', () => {
  const courses = parseCourseTableContent('```json\n{"courses":[{"title":"机器学习入门","description":"基础课程","duration":"12 分钟","resource_id":"res-1","url":"https://example.com/ml"}]}\n```')

  assert.deepEqual(courses, [
    {
      title: '机器学习入门',
      description: '基础课程',
      duration: '12 分钟',
      resourceId: 'res-1',
      url: 'https://example.com/ml',
    },
  ])
})

test('extractReferences returns empty list for invalid payload', () => {
  assert.deepEqual(extractReferences({ data: { references: 'bad-data' } }), [])
})
