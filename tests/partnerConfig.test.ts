import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractPartnerConfig,
  parsePartnerApiConfig,
  buildPartnerConfigUpdatePayload,
} from '../src/services/partnerConfigService.ts'

test('parsePartnerApiConfig reads agent endpoint and user id from config', () => {
  const config = parsePartnerApiConfig([
    'user_id: 123456',
    'url: http://127.0.0.1:8000/',
    'view_partner_config_path: /api/v1/agent',
    'update_partner_config_path: /api/v1/agent',
  ].join('\n'))

  assert.equal(config.userId, '123456')
  assert.equal(config.viewConfigEndpoint, 'http://127.0.0.1:8000/api/v1/agent')
  assert.equal(config.updateConfigEndpoint, 'http://127.0.0.1:8000/api/v1/agent')
})

test('extractPartnerConfig maps agent name and markdown memories', () => {
  const config = extractPartnerConfig({
    success: true,
    code: '200',
    msg: 'success',
    data: {
      agent: {
        agent_name: 'guoren',
        avatar_url: 'string',
      },
      memories: {
        'SOUL.md': { content: '# soul' },
        'USER.md': { content: '# user' },
        'IDENTITY.md': { content: '# identity' },
      },
    },
  })

  assert.equal(config.agentName, 'guoren')
  assert.equal(config.soulContent, '# soul')
  assert.equal(config.userContent, '# user')
  assert.equal(config.identityContent, '# identity')
})

test('buildPartnerConfigUpdatePayload only includes edited field', () => {
  assert.deepEqual(buildPartnerConfigUpdatePayload('agent_name', '小智'), {
    agent_name: '小智',
  })

  assert.deepEqual(buildPartnerConfigUpdatePayload('USER.md', '# 用户信息'), {
    USER_md: '# 用户信息',
  })

  assert.deepEqual(buildPartnerConfigUpdatePayload('SOUL.md', '# SOUL'), {
    'SOUL.md': '# SOUL',
  })

  assert.deepEqual(buildPartnerConfigUpdatePayload('IDENTITY.md', '# IDENTITY'), {
    'IDENTITY.md': '# IDENTITY',
  })
})

test('partner config update uses user_id query parameter', async () => {
  const source = await import('../src/services/partnerConfigService.ts')
  const originalFetch = globalThis.fetch
  let requestUrl = ''

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestUrl = String(input)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    await source.updatePartnerConfig(
      {
        userId: '123456',
        viewConfigEndpoint: 'http://127.0.0.1:8000/api/v1/agent',
        updateConfigEndpoint: 'http://127.0.0.1:8000/api/v1/agent',
      },
      'agent_name',
      '小智',
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.match(requestUrl, /user_id=123456/)
})
