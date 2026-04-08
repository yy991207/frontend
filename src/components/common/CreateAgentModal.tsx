import { useState, useEffect, useRef } from 'react'
import { Input } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { ArrowUpOutlined, CloseOutlined } from '@ant-design/icons'
import styles from './CreateAgentModal.module.less'

interface CreateAgentModalProps {
  visible: boolean
  onCancel: () => void
  onConfirm: (data: { name: string; description: string; icon: string }) => void
}

// 模板标签配置
const templateTags = [
  // 第一行
  ['企业财报解读专家', '图片生成助手', '产品/市场调研专家', '帮助文档写作助手'],
  // 第二行
  ['任务日程助手', '数据分析专家', '会议总结助手', '飞书智能客服'],
]

export default function CreateAgentModal({ visible, onCancel, onConfirm }: CreateAgentModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<TextAreaRef>(null)

  // 弹窗打开时重置表单
  useEffect(() => {
    if (visible) {
      setInputValue('')
      setIsSubmitting(false)
      // 禁止页面滚动
      document.body.style.overflow = 'hidden'
      // 自动聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      // 恢复页面滚动
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  const handleSubmit = async () => {
    if (!inputValue.trim() || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    try {
      // 从输入内容中提取名称（取前20个字符作为名称）
      const name = inputValue.trim().slice(0, 20)
      await onConfirm({
        name,
        description: inputValue.trim(),
        icon: 'robot',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTagClick = () => {
    // 先关闭弹窗
    onCancel()
    // 然后跳转到模板页面
    window.location.href = 'http://localhost:5173/agent/1'
  }

  const handleClose = () => {
    onCancel()
  }

  if (!visible) {
    return null
  }

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* 关闭按钮 */}
        <button className={styles.closeButton} onClick={handleClose}>
          <CloseOutlined />
        </button>

        {/* 标题 */}
        <h2 className={styles.title}>你需要一个什么样的智能体？</h2>

        {/* 输入框区域 */}
        <div className={styles.inputWrapper}>
          <Input.TextArea
            ref={inputRef}
            placeholder="比如：你想要一个财报分析助手，自动分析上市公司财报，提取关键财务指标，识别潜在风险和增长点，以通俗易懂的语言解释复杂的财务状况。"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.textarea}
            autoSize={{ minRows: 4, maxRows: 6 }}
            maxLength={500}
          />
          {/* 发送按钮 */}
          <button
            className={`${styles.sendButton} ${inputValue.trim() && !isSubmitting ? styles.sendButtonActive : ''}`}
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isSubmitting}
          >
            <ArrowUpOutlined />
          </button>
        </div>

        {/* 提示文字 */}
        <p className={styles.hint}>没有灵感？试试智能体模板~</p>

        {/* 模板标签 */}
        <div className={styles.tagsContainer}>
          {templateTags.map((row, rowIndex) => (
            <div key={rowIndex} className={styles.tagRow}>
              {row.map((tag) => (
                <button
                  key={tag}
                  className={styles.tagButton}
                  onClick={() => handleTagClick()}
                >
                  {tag}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
