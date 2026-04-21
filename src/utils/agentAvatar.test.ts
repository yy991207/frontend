import { normalizeAgentAvatarUrl } from './agentAvatar'

describe('normalizeAgentAvatarUrl', () => {
  it('example 占位头像应视为无效头像', () => {
    expect(normalizeAgentAvatarUrl('example')).toBeNull()
    expect(normalizeAgentAvatarUrl('https://example.com/avatar.png')).toBeNull()
    expect(normalizeAgentAvatarUrl('https://cdn.example.com/avatar.png')).toBeNull()
  })

  it('真实头像地址应原样保留', () => {
    expect(normalizeAgentAvatarUrl('https://guoren.example-assets.com/avatar.png')).toBe('https://guoren.example-assets.com/avatar.png')
    expect(normalizeAgentAvatarUrl('https://guoren-skills-test.oss-cn-beijing.aliyuncs.com/avatar.png')).toBe('https://guoren-skills-test.oss-cn-beijing.aliyuncs.com/avatar.png')
  })
})
