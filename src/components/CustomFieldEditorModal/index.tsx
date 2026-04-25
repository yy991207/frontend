import { useState } from 'react'
import Modal from 'antd/es/modal'
import Form from 'antd/es/form'
import Input from 'antd/es/input'
import Select from 'antd/es/select'
import Button from 'antd/es/button'
import Tabs from 'antd/es/tabs'
import List from 'antd/es/list'
import Tag from 'antd/es/tag'
import Popconfirm from 'antd/es/popconfirm'
import Radio from 'antd/es/radio'
import Empty from 'antd/es/empty'
import message from 'antd/es/message'
import {
  DeleteOutlined,
  PlusOutlined,
  HolderOutlined,
  SearchOutlined,
  RightOutlined,
} from '@ant-design/icons'
import {
  createCustomField,
  updateCustomField,
  deleteCustomField,
  type ApiCustomField,
  type CustomFieldType,
  type FieldOption,
  type UpdateFieldOption,
} from '@/services/customFieldService'

interface DraftOption {
  key: string
  id?: string | null
  label: string
  color?: string | null
}

interface Props {
  open: boolean
  projectId: string
  initialType?: CustomFieldType
  initialTab?: 'new' | 'existing'
  initialDraft?: {
    name?: string
    options?: DraftOption[]
  } | null
  field?: ApiCustomField | null
  existingFields?: ApiCustomField[]
  onClose: () => void
  onSaved?: (field: ApiCustomField) => void
  onDeleted?: (fieldId: string) => void
  onPickExisting?: (field: ApiCustomField) => void
}

const TYPE_OPTIONS: { label: string; value: CustomFieldType }[] = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '日期', value: 'date' },
  { label: '单选', value: 'select' },
  { label: '多选', value: 'multi_select' },
  { label: '成员', value: 'member' },
]

const PRESET_COLORS = [
  '#3370ff', '#34c759', '#ff9500', '#ff3b30', '#af52de',
  '#5ac8fa', '#ffcc00', '#ff2d55', '#5856d6', '#a2845e',
]

function getEnabledFieldOptions(field?: ApiCustomField | null): FieldOption[] {
  return (field?.options ?? []).filter((option) => !(option.is_disabled === true))
}

function toEditableDraftOption(option: FieldOption, index: number): DraftOption {
  return {
    key: option.id ?? `existing-${index}`,
    id: option.id,
    label: option.label,
    color: option.color,
  }
}

export default function CustomFieldEditorModal({
  open,
  projectId,
  initialType,
  initialTab = 'new',
  initialDraft = null,
  field,
  existingFields = [],
  onClose,
  onSaved,
  onDeleted,
  onPickExisting,
}: Props) {
  const isEdit = !!field
  const [activeTab, setActiveTab] = useState<'new' | 'existing'>(field ? 'new' : initialTab)
  const [type, setType] = useState<CustomFieldType>(field?.field_type ?? initialType ?? 'text')
  const [name, setName] = useState(field?.name ?? initialDraft?.name ?? '')
  const [options, setOptions] = useState<DraftOption[]>(() =>
    field
      ? getEnabledFieldOptions(field).map(toEditableDraftOption)
      : (initialDraft?.options ?? []),
  )
  const [existingKeyword, setExistingKeyword] = useState('')
  const [selectedExistingFieldId, setSelectedExistingFieldId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const needsOptions = type === 'select' || type === 'multi_select'

  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      {
        key: `draft_${Date.now()}_${prev.length}`,
        label: '',
        color: PRESET_COLORS[prev.length % PRESET_COLORS.length],
      },
    ])
  }

  const updateOption = (idx: number, patch: Partial<DraftOption>) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)))
  }

  const removeOption = (idx: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      message.warning('请输入字段标题')
      return
    }
    if (needsOptions) {
      const valid = options.filter((o) => o.label.trim())
      if (valid.length === 0) {
        message.warning('请至少添加一个选项')
        return
      }
    }
    setSubmitting(true)
    try {
      const finalOptions: UpdateFieldOption[] | undefined = needsOptions
        ? options
            .filter((o) => o.label.trim())
            .map((o) => ({ id: o.id, label: o.label.trim(), color: o.color }))
        : undefined
      let saved: ApiCustomField
      if (isEdit && field) {
        saved = await updateCustomField(projectId, field.field_id, {
          name: trimmed,
          options: finalOptions,
        })
        message.success('已更新字段')
      } else {
        saved = await createCustomField(projectId, {
          name: trimmed,
          field_type: type,
          options: finalOptions,
        })
        message.success('已创建字段')
      }
      onSaved?.(saved)
      onClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCurrentField = async () => {
    if (!field) {
      return
    }
    try {
      await deleteCustomField(projectId, field.field_id)
      message.success('已删除字段')
      onDeleted?.(field.field_id)
      onClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const typeLabel = (t: CustomFieldType) =>
    TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t

  const filteredExistingFields = existingFields.filter((item) =>
    item.name.toLowerCase().includes(existingKeyword.trim().toLowerCase()),
  )

  const handleConfirmPickExisting = () => {
    if (!selectedExistingFieldId) {
      return
    }
    const targetField = existingFields.find((item) => item.field_id === selectedExistingFieldId)
    if (!targetField) {
      return
    }
    onPickExisting?.(targetField)
    onClose()
  }

  const newFieldForm = (
    <Form layout="vertical">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: 16,
        }}
      >
        <Form.Item label="字段标题" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入字段标题"
            maxLength={50}
          />
        </Form.Item>
        <Form.Item label="字段类型" required>
          <Select
            value={type}
            onChange={(v) => setType(v as CustomFieldType)}
            options={TYPE_OPTIONS}
            disabled={isEdit}
          />
        </Form.Item>
      </div>

      {needsOptions && (
        <Form.Item label="选项">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {options.map((opt, idx) => (
              <div
                key={opt.key}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <HolderOutlined style={{ color: '#86909c' }} />
                <input
                  type="color"
                  value={opt.color ?? '#3370ff'}
                  onChange={(e) => updateOption(idx, { color: e.target.value })}
                  style={{
                    width: 24,
                    height: 24,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
                <Input
                  value={opt.label}
                  onChange={(e) => updateOption(idx, { label: e.target.value })}
                  placeholder={`选项 ${idx + 1}`}
                  style={{ flex: 1 }}
                  maxLength={30}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeOption(idx)}
                />
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={addOption} block>
              添加选项
            </Button>
          </div>
        </Form.Item>
      )}
    </Form>
  )

  const existingList = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Input
        value={existingKeyword}
        onChange={(event) => setExistingKeyword(event.target.value)}
        placeholder="搜索已创建的字段"
        prefix={<SearchOutlined style={{ color: '#8f959e' }} />}
        allowClear
      />
      {filteredExistingFields.length > 0 ? (
        <List
          dataSource={filteredExistingFields}
          locale={{ emptyText: '暂无已创建字段' }}
          renderItem={(f) => {
            const selected = selectedExistingFieldId === f.field_id
            return (
              <List.Item
                style={{
                  padding: 0,
                  border: 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedExistingFieldId(f.field_id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 12px',
                    borderRadius: 10,
                    border: selected ? '1px solid #adc6ff' : '1px solid transparent',
                    background: selected ? '#f0f5ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Radio
                    checked={selected}
                    style={{ pointerEvents: 'none' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#1f2329',
                        fontSize: 14,
                        lineHeight: '22px',
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </span>
                      <Tag style={{ marginInlineEnd: 0 }}>{typeLabel(f.field_type)}</Tag>
                    </div>
                    {f.options && f.options.length > 0 ? (
                      <div
                        style={{
                          marginTop: 4,
                          color: '#646a73',
                          fontSize: 12,
                          lineHeight: '20px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {f.options.map((o) => o.label).join(' / ')}
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: '#8f959e',
                      fontSize: 12,
                      lineHeight: '20px',
                      flexShrink: 0,
                    }}
                  >
                    <RightOutlined />
                  </div>
                </button>
              </List.Item>
            )
          }}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无匹配字段"
          style={{ marginBlock: 32 }}
        />
      )}
    </div>
  )

  return (
    <Modal
      title={isEdit ? '编辑字段' : '添加自定义字段'}
      open={open}
      onCancel={onClose}
      footer={
        activeTab === 'existing' && !isEdit ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              onClick={handleConfirmPickExisting}
              disabled={!selectedExistingFieldId}
            >
              添加到清单
            </Button>
          </div>
        ) : activeTab === 'new' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {isEdit && (
              <Popconfirm
                title="删除该字段？"
                description="删除后当前清单和任务里的这个字段都会一起移除。"
                okText="删除字段"
                cancelText="取消"
                onConfirm={() => handleDeleteCurrentField()}
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除字段
                </Button>
              </Popconfirm>
            )}
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {isEdit ? '保存' : '创建字段'}
            </Button>
          </div>
        ) : null
      }
      width={640}
      zIndex={1100}
      destroyOnHidden
    >
      {isEdit ? (
        newFieldForm
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'new' | 'existing')}
          items={[
            { key: 'new', label: '新建字段', children: newFieldForm },
            { key: 'existing', label: '已创建字段', children: existingList },
          ]}
        />
      )}
    </Modal>
  )
}
