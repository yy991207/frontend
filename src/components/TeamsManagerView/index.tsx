import { useEffect, useState } from 'react'
import List from 'antd/es/list'
import Button from 'antd/es/button'
import Form from 'antd/es/form'
import Input from 'antd/es/input'
import Select from 'antd/es/select'
import Space from 'antd/es/space'
import Tag from 'antd/es/tag'
import Popconfirm from 'antd/es/popconfirm'
import message from 'antd/es/message'
import Typography from 'antd/es/typography'
import Divider from 'antd/es/divider'
import Card from 'antd/es/card'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  ArrowLeftOutlined,
  CrownOutlined,
} from '@ant-design/icons'
import { getConfig } from '@/config/appConfig'
import {
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  listMembers,
  addMembers,
  updateMemberRole,
  removeMember,
  transferOwner,
  type Team,
  type TeamMember,
} from '@/services/teamService'

const { Title, Text } = Typography

export default function TeamsManagerView() {
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const [membersLoading, setMembersLoading] = useState(false)
  const [editing, setEditing] = useState<Team | null>(null)
  const [managingTeam, setManagingTeam] = useState<Team | null>(null)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm<{
    name: string
    description?: string
    avatar_url?: string
  }>()
  const [memberForm] = Form.useForm<{ user_ids: string }>()

  const loadMembers = async (team: Team) => {
    setMembersLoading(true)
    try {
      setMembers(await listMembers(team.team_id))
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载成员失败')
    } finally {
      setMembersLoading(false)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      setTeams(await listTeams())
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (managingTeam) void loadMembers(managingTeam)
  }, [managingTeam])

  const submit = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await updateTeam(editing.team_id, values)
        message.success('已更新团队')
      } else {
        await createTeam(values.name, values.description, values.avatar_url)
        message.success('已创建团队')
      }
      setCreating(false)
      setEditing(null)
      form.resetFields()
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleDelete = async (teamId: string) => {
    try {
      await deleteTeam(teamId)
      message.success('已删除团队')
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const openMembers = (team: Team) => {
    setCreating(false)
    setEditing(null)
    setManagingTeam(team)
  }

  const closeMembers = () => {
    setManagingTeam(null)
    setMembers([])
    memberForm.resetFields()
  }

  const parseUserIds = (value: string) =>
    value
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean)

  const handleAddMembers = async () => {
    if (!managingTeam) return
    const values = await memberForm.validateFields()
    const userIds = parseUserIds(values.user_ids)
    if (userIds.length === 0) {
      message.warning('请输入要添加的用户 ID')
      return
    }
    try {
      await addMembers(userIds, managingTeam.team_id)
      message.success('已添加成员')
      memberForm.resetFields()
      await loadMembers(managingTeam)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '添加成员失败')
    }
  }

  const handleUpdateRole = async (member: TeamMember, role: 'admin' | 'member') => {
    if (!managingTeam) return
    try {
      await updateMemberRole(member.user_id, role, managingTeam.team_id)
      message.success('已调整角色')
      await loadMembers(managingTeam)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '调整角色失败')
    }
  }

  const handleRemoveMember = async (member: TeamMember) => {
    if (!managingTeam) return
    try {
      await removeMember(member.user_id, managingTeam.team_id)
      message.success('已移除成员')
      await loadMembers(managingTeam)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '移除成员失败')
    }
  }

  const handleTransferOwner = async (member: TeamMember) => {
    if (!managingTeam) return
    try {
      await transferOwner(member.user_id, managingTeam.team_id)
      message.success('已转让 Owner')
      await Promise.all([load(), loadMembers(managingTeam)])
    } catch (err) {
      message.error(err instanceof Error ? err.message : '转让 Owner 失败')
    }
  }

  const startEdit = (t: Team) => {
    setEditing(t)
    setCreating(true)
    form.setFieldsValue({
      name: t.name,
      description: t.description ?? '',
      avatar_url: t.avatar_url ?? '',
    })
  }

  const startCreate = () => {
    setEditing(null)
    setCreating(true)
    form.resetFields()
  }

  return (
    <div style={{ padding: '24px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>
          <TeamOutlined style={{ marginRight: 8 }} />
          团队管理
        </Title>
      </div>

      <Card
        title={
          managingTeam ? (
            <Space>
              <Button
                type="text"
                size="small"
                icon={<ArrowLeftOutlined />}
                onClick={closeMembers}
              />
              <span>{managingTeam.name} - 成员管理</span>
            </Space>
          ) : creating ? (
            editing ? '编辑团队' : '新建团队'
          ) : (
            '团队管理'
          )
        }
        extra={
          !creating && !managingTeam && (
            <Button type="primary" icon={<PlusOutlined />} onClick={startCreate}>
              新建团队
            </Button>
          )
        }
      >
        {!creating && !managingTeam && (
          <List
            loading={loading}
            dataSource={teams}
            locale={{ emptyText: '暂无团队' }}
            renderItem={(t) => (
              <List.Item
                actions={[
                  <Button
                    key="m"
                    type="link"
                    size="small"
                    icon={<TeamOutlined />}
                    onClick={() => openMembers(t)}
                  >
                    成员管理
                  </Button>,
                  <Button
                    key="e"
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => startEdit(t)}
                  >
                    编辑
                  </Button>,
                  <Popconfirm
                    key="d"
                    title="删除该团队？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => handleDelete(t.team_id)}
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontWeight: 500 }}>{t.name}</span>
                      {t.team_id === getConfig().team_id && <Tag color="blue">当前</Tag>}
                      {t.owner_id === getConfig().user_id && <Tag>我是负责人</Tag>}
                    </Space>
                  }
                  description={t.description || t.team_id}
                />
              </List.Item>
            )}
          />
        )}

        {managingTeam && (
          <>
            <div style={{ marginBottom: 24, padding: '0 12px' }}>
              <Form form={memberForm} layout="vertical">
                <Form.Item
                  name="user_ids"
                  label="添加成员"
                  rules={[{ required: true, message: '请输入用户 ID' }]}
                  extra="多个用户 ID 用逗号、中文逗号、空格或换行分隔"
                >
                  <Input.TextArea rows={2} placeholder="user_456, user_789" />
                </Form.Item>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddMembers}>
                  添加成员
                </Button>
              </Form>
            </div>
            <Divider />
            <List
              loading={membersLoading}
              dataSource={members}
              locale={{ emptyText: '暂无成员' }}
              renderItem={(member) => {
                const isOwner = member.role === 'owner'
                const isSelf = member.user_id === getConfig().user_id
                return (
                  <List.Item
                    actions={[
                      isOwner ? (
                        <Tag key="owner" icon={<CrownOutlined />} color="gold">
                          Owner
                        </Tag>
                      ) : (
                        <Select
                          key="role"
                          size="small"
                          value={member.role === 'admin' ? 'admin' : 'member'}
                          style={{ width: 100 }}
                          options={[
                            { label: '管理员', value: 'admin' },
                            { label: '成员', value: 'member' },
                          ]}
                          onChange={(role: 'admin' | 'member') => handleUpdateRole(member, role)}
                        />
                      ),
                      !isOwner && (
                        <Popconfirm
                          key="transfer"
                          title="转让 Owner？"
                          description={`确定把团队 Owner 转让给 ${member.user_id} 吗？`}
                          okText="转让"
                          cancelText="取消"
                          onConfirm={() => handleTransferOwner(member)}
                        >
                          <Button type="link" size="small">
                            转让 Owner
                          </Button>
                        </Popconfirm>
                      ),
                      !isOwner && (
                        <Popconfirm
                          key="remove"
                          title={isSelf ? '退出该团队？' : '移除该成员？'}
                          okText={isSelf ? '退出' : '移除'}
                          cancelText="取消"
                          onConfirm={() => handleRemoveMember(member)}
                        >
                          <Button type="link" size="small" danger>
                            {isSelf ? '退出' : '移除'}
                          </Button>
                        </Popconfirm>
                      ),
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span style={{ fontWeight: 500 }}>{member.user_id}</span>
                          {isSelf && <Tag color="blue">我</Tag>}
                        </Space>
                      }
                      description={
                        <Space split={<Divider type="vertical" />}>
                          <Text type="secondary">
                            {isOwner ? 'Owner' : member.role === 'admin' ? '管理员' : '成员'}
                          </Text>
                          <Text type="secondary">
                            {member.joined_at ? `加入时间：${member.joined_at.slice(0, 10)}` : '暂无加入时间'}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )
              }}
            />
          </>
        )}

        {creating && (
          <div style={{ maxWidth: 600, padding: '12px' }}>
            <Form form={form} layout="vertical">
              <Form.Item name="name" label="团队名称" rules={[{ required: true }]}>
                <Input maxLength={100} placeholder="请输入团队名称" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={4} maxLength={500} placeholder="请输入团队描述" />
              </Form.Item>
              <Form.Item name="avatar_url" label="头像URL">
                <Input placeholder="https://..." />
              </Form.Item>
              <Space size="middle" style={{ marginTop: 12 }}>
                <Button type="primary" onClick={submit}>
                  {editing ? '更新团队' : '立即创建'}
                </Button>
                <Button
                  onClick={() => {
                    setCreating(false)
                    setEditing(null)
                    form.resetFields()
                  }}
                >
                  取消
                </Button>
              </Space>
            </Form>
          </div>
        )}
      </Card>
    </div>
  )
}
