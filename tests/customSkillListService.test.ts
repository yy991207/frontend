import test from 'node:test'
import assert from 'node:assert/strict'

import * as customSkillListService from '../src/services/customSkillListService.ts'

const { fetchCreatedSkills, parseCustomSkillListApiConfig } = customSkillListService

const CUSTOM_SKILL_LIST_CONFIG = `
user_id: 123456
url: http://192.168.30.238:8000/
skill_user_id_param: user_id
list_user_skills_path: /api/v1/skills/custom
del_user_skill_path: /api/v1/skills/custom/{skill_name}
`

test('parseCustomSkillListApiConfig 会从 config.yaml 读取我创建的技能接口配置', () => {
  const config = parseCustomSkillListApiConfig(CUSTOM_SKILL_LIST_CONFIG)

  assert.equal(config.userId, '123456')
  assert.equal(config.userIdParam, 'user_id')
  assert.equal(config.listEndpoint, 'http://192.168.30.238:8000/api/v1/skills/custom')
  assert.equal(config.deleteEndpointTemplate, 'http://192.168.30.238:8000/api/v1/skills/custom/{skill_name}')
})

test('fetchCreatedSkills 会请求我创建的技能列表，并提取 chinese_name 和 description', async () => {
  const originalFetch = globalThis.fetch
  let requestUrl = ''

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestUrl = String(input)

    return new Response(
      JSON.stringify({
        success: true,
        code: '200',
        msg: 'success',
        data: {
          skills: [
            {
              skill_id: 'skill_2039647357804478464',
              user_id: '123456',
              skill_name: 'tang-poetry',
              chinese_name: '唐诗五言绝句',
              description: '创作唐代五言绝句',
              source: 'created',
            },
          ],
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as typeof fetch

  try {
    const skills = await fetchCreatedSkills(parseCustomSkillListApiConfig(CUSTOM_SKILL_LIST_CONFIG))

    assert.match(requestUrl, /\/api\/v1\/skills\/custom\?user_id=123456$/)
    assert.deepEqual(skills, [
      {
        id: 'tang-poetry',
        skillName: 'tang-poetry',
        title: '唐诗五言绝句',
        description: '创作唐代五言绝句',
        template: '',
        isSelected: false,
      },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('deleteCreatedSkill 会用 skill_name 路径参数和 user_id 查询参数删除技能', async () => {
  const originalFetch = globalThis.fetch
  let requestUrl = ''
  let requestMethod = ''

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input)
    requestMethod = init?.method || 'GET'

    return new Response(
      JSON.stringify({
        success: true,
        code: '200',
        msg: '删除成功',
        data: null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as typeof fetch

  try {
    assert.equal(typeof customSkillListService.deleteCreatedSkill, 'function')

    await customSkillListService.deleteCreatedSkill?.(
      parseCustomSkillListApiConfig(CUSTOM_SKILL_LIST_CONFIG),
      'tang-poetry',
    )

    assert.equal(requestMethod, 'DELETE')
    assert.match(requestUrl, /\/api\/v1\/skills\/custom\/tang-poetry\?user_id=123456$/)
    assert.doesNotMatch(requestUrl, /skill_name=/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
