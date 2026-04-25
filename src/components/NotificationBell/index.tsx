import { useState, useEffect, useCallback } from 'react'
import Badge from 'antd/es/badge'
import Button from 'antd/es/button'
import Popover from 'antd/es/popover'
import List from 'antd/es/list'
import Typography from 'antd/es/typography'
import Empty from 'antd/es/empty'
import Segmented from 'antd/es/segmented'
import message from 'antd/es/message'
import Popconfirm from 'antd/es/popconfirm'
import { BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type ApiNotification,
} from '@/services/notificationService'

const { Text } = Typography

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ApiNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const refreshUnread = useCallback(async () => {
    try {
      const c = await getUnreadCount()
      setUnread(c)
    } catch {
      // ignore
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await listNotifications({
        pageSize: 30,
        isRead: filter === 'unread' ? false : undefined,
      })
      setItems(page.items ?? [])
      if (typeof page.unread_count === 'number') setUnread(page.unread_count)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载通知失败')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void refreshUnread()
    const timer = window.setInterval(refreshUnread, 60000)
    return () => window.clearInterval(timer)
  }, [refreshUnread])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const handleMarkRead = async (n: ApiNotification) => {
    try {
      await markNotificationRead(n.notification_id)
      setItems((prev) =>
        filter === 'unread'
          ? prev.filter((it) => it.notification_id !== n.notification_id)
          : prev.map((it) =>
              it.notification_id === n.notification_id
                ? { ...it, is_read: true }
                : it,
            ),
      )
      setUnread((c) => Math.max(0, c - 1))
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead()
      setItems((prev) =>
        filter === 'unread' ? [] : prev.map((it) => ({ ...it, is_read: true })),
      )
      setUnread(0)
      message.success('已全部标记为已读')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleDelete = async (n: ApiNotification) => {
    try {
      await deleteNotification(n.notification_id)
      setItems((prev) => prev.filter((it) => it.notification_id !== n.notification_id))
      if (!n.is_read) setUnread((c) => Math.max(0, c - 1))
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  const content = (
    <div style={{ width: 360 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 4px 8px',
          borderBottom: '1px solid #f0f1f5',
        }}
      >
        <Text strong>通知</Text>
        <Button type="link" size="small" onClick={handleMarkAll} disabled={unread === 0}>
          全部已读
        </Button>
      </div>
      <div style={{ padding: '8px 4px' }}>
        <Segmented
          size="small"
          value={filter}
          onChange={(v) => setFilter(v as 'all' | 'unread')}
          options={[
            { label: '全部', value: 'all' },
            { label: `未读 ${unread > 0 ? `(${unread})` : ''}`, value: 'unread' },
          ]}
          block
        />
      </div>
      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={loading ? '加载中...' : '暂无通知'}
          style={{ padding: '24px 0' }}
        />
      ) : (
        <List
          size="small"
          dataSource={items}
          style={{ maxHeight: 420, overflow: 'auto' }}
          renderItem={(n) => (
            <List.Item
              style={{
                alignItems: 'flex-start',
                background: n.is_read ? 'transparent' : '#f4f9ff',
              }}
              actions={[
                !n.is_read && (
                  <Button
                    key="read"
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => handleMarkRead(n)}
                  />
                ),
                <Popconfirm
                  key="del"
                  title="删除该通知？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => handleDelete(n)}
                >
                  <Button type="text" size="small" icon={<DeleteOutlined />} />
                </Popconfirm>,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={<Text strong={!n.is_read}>{n.title || n.type}</Text>}
                description={
                  <>
                    <div style={{ color: '#4e5969', fontSize: 12 }}>{n.content}</div>
                    <div style={{ color: '#86909c', fontSize: 11, marginTop: 2 }}>
                      {dayjs(n.created_at).format('MM-DD HH:mm')}
                    </div>
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )

  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      open={open}
      onOpenChange={setOpen}
      content={content}
      arrow={false}
    >
      <Badge count={unread} size="small" offset={[-2, 2]}>
        <Button type="text" size="small" icon={<BellOutlined />} />
      </Badge>
    </Popover>
  )
}
