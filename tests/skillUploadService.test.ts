import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { parseSkillUploadApiConfig, uploadCustomSkill } from '../src/services/skillUploadService.ts'

const CUSTOM_UPLOAD_CONFIG = `
user_id: 1111
url: http://127.0.0.1:8000/
skill_user_id_param: user_id
upload_skill_path: /api/v1/skills/custom/upload
`

test('当前 config.yaml 里的上传请求参数名应该是 user_id', async () => {
  const rawConfig = await readFile(new URL('../config.yaml', import.meta.url), 'utf8')
  const config = parseSkillUploadApiConfig(rawConfig)

  assert.equal(config.userIdParam, 'user_id')
})

test('parseSkillUploadApiConfig 会从 config.yaml 读取上传地址和用户参数', () => {
  const config = parseSkillUploadApiConfig(CUSTOM_UPLOAD_CONFIG)

  assert.equal(config.userId, '1111')
  assert.equal(config.userIdParam, 'user_id')
  assert.equal(config.uploadEndpoint, 'http://127.0.0.1:8000/api/v1/skills/custom/upload')
})

test('uploadCustomSkill 会带上 query 参数并通过 FormData 上传文件', async () => {
  const originalFetch = globalThis.fetch
  let requestUrl = ''
  let requestBody: BodyInit | null | undefined

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input)
    requestBody = init?.body

    return new Response(
      JSON.stringify({
        success: true,
        code: '200',
        msg: 'Skill 上传成功',
        data: {
          skill_id: 'skill_2039644291860529152',
          skill_name: 'buddy-reroll',
          description: 'Reroll your Claude Code buddy.',
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
    const result = await uploadCustomSkill(
      parseSkillUploadApiConfig(CUSTOM_UPLOAD_CONFIG),
      new File(['skill-content'], 'buddy-reroll.skill', {
        type: 'text/plain',
      }),
    )

    assert.equal(result.success, true)
    assert.equal(result.msg, 'Skill 上传成功')
    assert.equal(result.data?.skillId, 'skill_2039644291860529152')
    assert.equal(result.data?.skillName, 'buddy-reroll')
    assert.equal(result.data?.description, 'Reroll your Claude Code buddy.')
    assert.match(requestUrl, /user_id=1111/)
    assert.ok(requestBody instanceof FormData)

    const uploadedFile = requestBody.get('file')
    assert.ok(uploadedFile instanceof File)
    assert.equal(uploadedFile.name, 'buddy-reroll.skill')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('uploadCustomSkill 会透传后端返回的失败 msg', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        success: false,
        code: '500',
        msg: '请上传 .zip、.skill 或 .md 文件',
        data: null,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )) as typeof fetch

  try {
    const result = await uploadCustomSkill(
      parseSkillUploadApiConfig(CUSTOM_UPLOAD_CONFIG),
      new File(['bad'], 'slides.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
    )

    assert.equal(result.success, false)
    assert.equal(result.code, '500')
    assert.equal(result.msg, '请上传 .zip、.skill 或 .md 文件')
    assert.equal(result.data, null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
