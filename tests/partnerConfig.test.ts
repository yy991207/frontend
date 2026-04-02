import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractPartnerConfig,
  parsePartnerApiConfig,
} from '../src/services/partnerConfigService.ts'

test('parsePartnerApiConfig reads agent endpoint and user id from config', () => {
  const config = parsePartnerApiConfig([
    'user_id: 123456',
    'url: http://127.0.0.1:8000/',
    'view_partner_config_path: /api/v1/agent',
  ].join('\n'))

  assert.equal(config.userId, '123456')
  assert.equal(config.viewConfigEndpoint, 'http://127.0.0.1:8000/api/v1/agent')
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
