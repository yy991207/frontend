import { useEffect, useState } from 'react'
import Dropdown from 'antd/es/dropdown'
import Button from 'antd/es/button'
import Tooltip from 'antd/es/tooltip'
import Tag from 'antd/es/tag'
import Spin from 'antd/es/spin'
import Empty from 'antd/es/empty'
import message from 'antd/es/message'
import { UserSwitchOutlined, CheckOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd/es/menu'
import { listMembers, listTeams, type Team, type TeamMember } from '@/services/teamService'
import { getConfig, switchCurrentTeam, switchCurrentUser } from '@/config/appConfig'

const roleColor: Record<TeamMember['role'], string> = {
  owner: 'gold',
  admin: 'blue',
  member: 'default',
}

const roleLabel: Record<TeamMember['role'], string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
}

export default function UserSwitcher() {
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || (members !== null && teams !== null)) return
    setLoading(true)
    Promise.all([members === null ? listMembers() : Promise.resolve(members), teams === null ? listTeams() : Promise.resolve(teams)])
      .then(([memberList, teamList]) => {
        setMembers(memberList)
        setTeams(teamList)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '加载切换列表失败'
        message.error(msg)
        setMembers([])
        setTeams([])
      })
      .finally(() => setLoading(false))
  }, [open, members, teams])

  const currentUserId = getConfig().user_id
  const currentTeamId = getConfig().team_id

  const handleSwitch = (userId: string) => {
    if (userId === currentUserId) {
      setOpen(false)
      return
    }
    message.success(`已切换到用户 ${userId},正在刷新...`)
    setTimeout(() => switchCurrentUser(userId), 300)
  }

  const handleSwitchTeam = (teamId: string) => {
    if (teamId === currentTeamId) {
      setOpen(false)
      return
    }
    message.success('已切换团队，正在刷新...')
    setTimeout(() => switchCurrentTeam(teamId), 300)
  }

  const items: MenuProps['items'] =
    loading || members === null || teams === null
      ? [
          {
            key: 'loading',
            label: (
              <div style={{ padding: '8px 16px', textAlign: 'center' }}>
                <Spin size="small" />
              </div>
            ),
            disabled: true,
          },
        ]
      : members.length === 0 && teams.length === 0
        ? [
            {
              key: 'empty',
              label: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无成员"
                  style={{ margin: 0 }}
                />
              ),
              disabled: true,
            },
          ]
        : [
            {
              key: 'team-header',
              type: 'group',
              label: '切换团队',
            },
            ...teams.map((team) => {
              const isCurrent = team.team_id === currentTeamId
              return {
                key: `team:${team.team_id}`,
                label: (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 220,
                    }}
                  >
                    <span style={{ width: 16, display: 'inline-flex' }}>
                      {isCurrent ? (
                        <CheckOutlined style={{ color: '#3370ff' }} />
                      ) : null}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>{team.name}</span>
                    {isCurrent ? (
                      <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                        当前
                      </Tag>
                    ) : null}
                  </div>
                ),
                onClick: () => handleSwitchTeam(team.team_id),
              }
            }),
            {
              key: 'header',
              type: 'group',
              label: '切换当前身份',
            },
            ...members.map((m) => {
              const isCurrent = m.user_id === currentUserId
              return {
                key: m.user_id,
                label: (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 200,
                    }}
                  >
                    <span style={{ width: 16, display: 'inline-flex' }}>
                      {isCurrent ? (
                        <CheckOutlined style={{ color: '#3370ff' }} />
                      ) : null}
                    </span>
                    <span style={{ flex: 1 }}>{m.user_id}</span>
                    <Tag color={roleColor[m.role]} style={{ marginInlineEnd: 0 }}>
                      {roleLabel[m.role]}
                    </Tag>
                  </div>
                ),
                onClick: () => handleSwitch(m.user_id),
              }
            }),
          ]

  return (
    <Tooltip title={`当前用户: ${currentUserId}`}>
      <Dropdown
        menu={{ items }}
        trigger={['click']}
        open={open}
        onOpenChange={setOpen}
        placement="bottomLeft"
      >
        <Button type="text" size="small" icon={<UserSwitchOutlined />} />
      </Dropdown>
    </Tooltip>
  )
}
