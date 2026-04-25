import { useEffect, useState } from 'react'
import Modal from 'antd/es/modal'
import Form from 'antd/es/form'
import Input from 'antd/es/input'
import Select from 'antd/es/select'
import Button from 'antd/es/button'
import List from 'antd/es/list'
import Tag from 'antd/es/tag'
import Space from 'antd/es/space'
import Popconfirm from 'antd/es/popconfirm'
import message from 'antd/es/message'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  type ApiCustomField,
  type CustomFieldType,
  type FieldOption,
  type UpdateFieldOption,
} from '@/services/customFieldService'

interface Props {
  open: boolean
  projectId: string
  onClose: () => void
  onChanged?: () => void
}

const fieldTypeOptions: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
  { value: 'select', label: '单选' },
  { value: 'multi_select', label: '多选' },
  { value: 'member', label: '成员' },
]

export default function CustomFieldsModal({ open, projectId, onClose, onChanged }: Props) {
  const [items, setItems] = useState<ApiCustomField[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<ApiCustomField | null>(null)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm<{
    name: string
    field_type: CustomFieldType
    options?: string
  }>()

  const load = async () => {
    setLoading(true)
    try {
      const data = await listCustomFields(projectId)
      setItems(data)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && projectId) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId])

  const parseOptions = (
    raw?: string,
    sourceOptions?: FieldOption[] | null,
  ): UpdateFieldOption[] | undefined => {
    if (!raw) return undefined
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label, index) => ({
        id: sourceOptions?.[index]?.id,
        label,
        color: sourceOptions?.[index]?.color,
      }))
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const needOptions =
      values.field_type === 'select' || values.field_type === 'multi_select'
    const options = needOptions ? parseOptions(values.options, editing?.options) : undefined
    try {
      if (editing) {
        await updateCustomField(projectId, editing.field_id, {
          name: values.name,
          options,
        })
        message.success('已更新')
      } else {
        await createCustomField(projectId, {
          name: values.name,
          field_type: values.field_type,
          options,
        })
        message.success('已创建')
      }
      setCreating(false)
      setEditing(null)
      form.resetFields()
      await load()
      onChanged?.()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleDelete = async (fieldId: string) => {
    try {
      await deleteCustomField(projectId, fieldId)
      message.success('已删除')
      await load()
      onChanged?.()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const startEdit = (it: ApiCustomField) => {
    setEditing(it)
    setCreating(true)
    form.setFieldsValue({
      name: it.name,
      field_type: it.field_type,
      options: (it.options ?? []).map((o) => o.label).join('\n'),
    })
  }

  const startCreate = () => {
    setEditing(null)
    setCreating(true)
    form.resetFields()
    form.setFieldsValue({ field_type: 'text' })
  }

  return (
    <Modal
      title="自定义字段"
      open={open}
      onCancel={() => {
        onClose()
        setCreating(false)
        setEditing(null)
      }}
      footer={null}
      width={560}
    >
      {!creating && (
        <>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            onClick={startCreate}
            style={{ marginBottom: 12 }}
          >
            新建字段
          </Button>
          <List
            loading={loading}
            dataSource={items}
            locale={{ emptyText: '暂无自定义字段' }}
            renderItem={(it) => (
              <List.Item
                actions={[
                  <Button
                    key="e"
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => startEdit(it)}
                  />,
                  <Popconfirm
                    key="d"
                    title="删除该字段？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => handleDelete(it.field_id)}
                  >
                    <Button type="text" size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{it.name}</span>
                      <Tag>
                        {fieldTypeOptions.find((f) => f.value === it.field_type)?.label ??
                          it.field_type}
                      </Tag>
                      {it.required && <Tag color="red">必填</Tag>}
                    </Space>
                  }
                  description={
                    it.options && it.options.length > 0
                      ? it.options.map((o) => o.label).join(' / ')
                      : undefined
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
      {creating && (
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="字段名称" rules={[{ required: true }]}>
            <Input placeholder="例如：模块" maxLength={50} />
          </Form.Item>
          <Form.Item name="field_type" label="字段类型" rules={[{ required: true }]}>
            <Select options={fieldTypeOptions} disabled={!!editing} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, next) => prev.field_type !== next.field_type}
          >
            {({ getFieldValue }) => {
              const t = getFieldValue('field_type')
              return t === 'select' || t === 'multi_select' ? (
                <Form.Item
                  name="options"
                  label="选项（每行一个）"
                  rules={[{ required: true, message: '请填写至少一个选项' }]}
                >
                  <Input.TextArea rows={4} placeholder="前端&#10;后端&#10;测试" />
                </Form.Item>
              ) : null
            }}
          </Form.Item>
          <Space>
            <Button type="primary" onClick={handleSubmit}>
              保存
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
      )}
    </Modal>
  )
}
