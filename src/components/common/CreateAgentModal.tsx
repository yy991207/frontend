import { useState, useEffect } from 'react'
import { Button, Input, Modal, Radio } from 'antd'
import {
  RobotOutlined,
  CustomerServiceOutlined,
  CodeOutlined,
  FileTextOutlined,
  BarChartOutlined,
  MailOutlined,
  CalendarOutlined,
  TranslationOutlined,
} from '@ant-design/icons'
import styles from './CreateAgentModal.module.less'

interface CreateAgentModalProps {
  visible: boolean
  onCancel: () => void
  onConfirm: (data: { name: string; description: string; icon: string }) => void
}

// 图标选项
const iconOptions = [
  { value: 'robot', label: '机器人', icon: RobotOutlined, color: '#1677ff' },
  { value: 'service', label: '客服', icon: CustomerServiceOutlined, color: '#52c41a' },
  { value: 'code', label: '代码', icon: CodeOutlined, color: '#722ed1' },
  { value: 'doc', label: '文档', icon: FileTextOutlined, color: '#fa8c16' },
  { value: 'chart', label: '数据', icon: BarChartOutlined, color: '#eb2f96' },
  { value: 'mail', label: '邮件', icon: MailOutlined, color: '#f5222d' },
  { value: 'calendar', label: '日程', icon: CalendarOutlined, color: '#13c2c2' },
  { value: 'translate', label: '翻译', icon: TranslationOutlined, color: '#faad14' },
]

export default function CreateAgentModal({ visible, onCancel, onConfirm }: CreateAgentModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('robot')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 弹窗打开时重置表单
  useEffect(() => {
    if (visible) {
      setName('')
      setDescription('')
      setSelectedIcon('robot')
      setIsSubmitting(false)
      // 禁止页面滚动
      document.body.style.overflow = 'hidden'
    } else {
      // 恢复页面滚动
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  const handleConfirm = async () => {
    if (!name.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm({
        name: name.trim(),
        description: description.trim(),
        icon: selectedIcon,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    onCancel()
  }

  return (
    <Modal
      open={visible}
      onCancel={handleCancel}
      footer={null}
      closable={false}
      centered
      width={480}
      className={styles.modal}
      wrapClassName={styles.modalWrapper}
      destroyOnClose
    >
      <div className={styles.container}>
        {/* 标题 */}
        <div className={styles.header}>
          <h3 className={styles.title}>创建智能体</h3>
          <p className={styles.subtitle}>配置您的专属 AI 智能体</p>
        </div>

        {/* 表单内容 */}
        <div className={styles.form}>
          {/* 技能名称 */}
          <div className={styles.formItem}>
            <label className={styles.label}>
              技能名称 <span className={styles.required}>*</span>
            </label>
            <Input
              placeholder="请输入技能名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              maxLength={50}
              showCount
            />
          </div>

          {/* 技能描述 */}
          <div className={styles.formItem}>
            <label className={styles.label}>技能描述</label>
            <Input.TextArea
              placeholder="请输入技能描述，帮助用户了解这个智能体的功能..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
              rows={4}
              maxLength={200}
              showCount
            />
          </div>

          {/* 技能图标 */}
          <div className={styles.formItem}>
            <label className={styles.label}>技能图标</label>
            <Radio.Group
              value={selectedIcon}
              onChange={(e) => setSelectedIcon(e.target.value)}
              className={styles.iconGroup}
            >
              {iconOptions.map((option) => {
                const IconComponent = option.icon
                const isSelected = selectedIcon === option.value
                return (
                  <Radio.Button
                    key={option.value}
                    value={option.value}
                    className={`${styles.iconButton} ${isSelected ? styles.iconButtonActive : ''}`}
                  >
                    <div
                      className={styles.iconWrapper}
                      style={{
                        backgroundColor: isSelected ? `${option.color}15` : '#f3f4f6',
                        color: isSelected ? option.color : '#9ca3af',
                      }}
                    >
                      <IconComponent className={styles.icon} />
                    </div>
                    <span className={styles.iconLabel}>{option.label}</span>
                  </Radio.Button>
                )
              })}
            </Radio.Group>
          </div>
        </div>

        {/* 按钮组 */}
        <div className={styles.footer}>
          <Button
            onClick={handleCancel}
            className={styles.cancelButton}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleConfirm}
            loading={isSubmitting}
            disabled={!name.trim()}
            className={styles.confirmButton}
          >
            确认创建
          </Button>
        </div>
      </div>
    </Modal>
  )
}
