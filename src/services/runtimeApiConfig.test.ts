import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { parseAgentFileApiConfig } from './agentFileUploadService'
import { parseChatApiConfig } from './chatService'
import { parseChatSessionConfig } from './chatSessionService'
import { parseCustomSkillListApiConfig } from './customSkillListService'
import { parsePartnerApiConfig } from './partnerConfigService'
import { parseSkillUploadApiConfig } from './skillUploadService'

const MINIMAL_CONFIG = `
user_id: 123456
url: http://192.168.30.238:8000/
`

describe('runtime api config', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('只保留 user_id 和 url 时，聊天接口会使用代码里的默认路径', () => {
    const config = parseChatApiConfig(MINIMAL_CONFIG)

    expect(config).toEqual({
      userId: '123456',
      createSessionEndpoint: 'http://192.168.30.238:8000/api/v1/chat/sessions',
      streamEndpointBase: 'http://192.168.30.238:8000/api/v1/chat/sessions',
    })
  })

  it('只保留 user_id 和 url 时，会话接口会使用代码里的默认路径', () => {
    const config = parseChatSessionConfig(MINIMAL_CONFIG)

    expect(config).toMatchObject({
      baseUrl: 'http://192.168.30.238:8000/',
      userId: '123456',
      viewChatSessionsPath: '/api/v1/chat/sessions',
      delChatSessionPath: '/api/v1/chat/sessions/{session_id}',
      getChatSessionPath: '/api/v1/chat/sessions/{session_id}',
      viewGeneratedCodePath: '/api/v1/chat/sessions/{session_id}/files/preview',
    })
  })

  it('只保留 user_id 和 url 时，技能上传接口会使用代码里的默认路径', () => {
    const config = parseSkillUploadApiConfig(MINIMAL_CONFIG)

    expect(config).toEqual({
      userId: '123456',
      userIdParam: 'user_id',
      uploadEndpoint: 'http://192.168.30.238:8000/api/v1/skills/custom/upload',
    })
  })

  it('只保留 user_id 和 url 时，我创建的技能接口会使用代码里的默认路径', () => {
    const config = parseCustomSkillListApiConfig(MINIMAL_CONFIG)

    expect(config).toEqual({
      userId: '123456',
      userIdParam: 'user_id',
      listEndpoint: 'http://192.168.30.238:8000/api/v1/skills/custom',
      deleteEndpointTemplate: 'http://192.168.30.238:8000/api/v1/skills/custom/{skill_name}',
    })
  })

  it('只保留 user_id 和 url 时，智能伙伴配置接口会使用代码里的默认路径', () => {
    const config = parsePartnerApiConfig(MINIMAL_CONFIG)

    expect(config).toEqual({
      userId: '123456',
      viewConfigEndpoint: 'http://192.168.30.238:8000/api/v1/agent',
      updateConfigEndpoint: 'http://192.168.30.238:8000/api/v1/agent',
    })
  })

  it('只保留 user_id 和 url 时，文档解析接口会使用代码里的默认路径', () => {
    const config = parseAgentFileApiConfig(MINIMAL_CONFIG)

    expect(config).toEqual({
      userId: '123456',
      uploadEndpoint: 'http://192.168.30.238:8000/api/v1/agent/files/upload',
      parseTaskEndpoint: 'http://192.168.30.238:8000/api/v1/parse/{task_id}',
    })
  })

  it('OSS token 暂时仍从 config.yaml 读取，后续可以统一接真实登录态', async () => {
    localStorage.setItem('SUPERSONIC_TOKEN', 'local-token')
    localStorage.setItem('SUPERSONIC_TENANT_ID', 'tenant-1000')

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'user_id: 123456\nurl: http://192.168.30.238:8000/\ntoken: yaml-token\n',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: 'https://oss.example.com/sign' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const { getUploadSignUrl } = await import('./ossUploadService')
    const result = await getUploadSignUrl('bucket-a', 'object-a.txt')

    expect(result).toBe('https://oss.example.com/sign')
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://test-guoren-api.grtcloud.net/jeecg-boot/open/aliyun/oss/v1/temp/url',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-access-token': 'yaml-token',
          'x-tenant-id': '123456',
        }),
      }),
    )
  })
})
