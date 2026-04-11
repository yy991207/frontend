import { useState, useEffect, useRef } from 'react'
import { Input, Spin } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { ArrowUpOutlined, CloseOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  loadCustomAgentApiConfig,
  generateAgentTemplate,
  getAgentTemplateTask,
  type AgentTemplateTaskResult,
} from '../../services/customAgentService'
import styles from './CreateAgentModal.module.less'

interface CreateAgentModalProps {
  visible: boolean
  onCancel: () => void
}

const templateTags = [
  ['企业财报解读专家', '图片生成助手', '产品/市场调研专家', '帮助文档写作助手'],
  ['任务日程助手', '数据分析专家', '会议总结助手', '飞书智能客服'],
]

const POLL_INTERVAL = 2000
const MAX_POLL_TIME = 120000

export default function CreateAgentModal({ visible, onCancel }: CreateAgentModalProps) {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [errorText, setErrorText] = useState('')
  const inputRef = useRef<TextAreaRef>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pollingTimeoutRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const clearTimers = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
    startTimeRef.current = null
  }

  const handleSuccess = (result: AgentTemplateTaskResult) => {
    setIsSubmitting(false)
    setHasError(false)
    setErrorText('')
    clearTimers()
    onCancel()
    navigate('/agent/create', {
      state: {
        generatedTemplate: {
          agentName: result.agent_name,
          description: result.description,
          agentPrompt: result.agent_prompt,
          presetQuestions: result.preset_questions,
        },
      },
    })
  }

  const handleError = (msg: string) => {
    setIsSubmitting(false)
    setHasError(true)
    setErrorText(msg)
    clearTimers()
  }

  const pollTaskStatus = async (taskId: string) => {
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now()
    }

    const elapsed = Date.now() - startTimeRef.current
    if (elapsed > MAX_POLL_TIME) {
      handleError('生成超时，请点击重试按钮重新生成')
      return
    }

    try {
      const config = await loadCustomAgentApiConfig()
      const taskResponse = await getAgentTemplateTask(config, taskId, abortControllerRef.current?.signal)
      
      if (taskResponse.success && taskResponse.data.is_completed && taskResponse.data.result) {
        handleSuccess(taskResponse.data.result)
        return
      }

      if (taskResponse.success && !taskResponse.data.is_completed) {
        abortControllerRef.current = new AbortController()
        pollingTimeoutRef.current = window.setTimeout(() => {
          pollTaskStatus(taskId)
        }, POLL_INTERVAL)
        return
      }

      if (!taskResponse.success || taskResponse.data.error) {
        handleError(taskResponse.data.error || taskResponse.msg || '生成失败，请重试')
        return
      }
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        handleError(err instanceof Error ? err.message : '请求失败，请重试')
      }
    }
  }

  const startGeneration = async () => {
    if (!inputValue.trim()) return

    setIsSubmitting(true)
    setHasError(false)
    setErrorText('')
    startTimeRef.current = Date.now()
    abortControllerRef.current = new AbortController()

    try {
      const config = await loadCustomAgentApiConfig()
      const response = await generateAgentTemplate(config, inputValue.trim(), abortControllerRef.current.signal)
      
      if (response.success && response.data.task_id) {
        abortControllerRef.current = new AbortController()
        await pollTaskStatus(response.data.task_id)
      } else {
        handleError(response.msg || '提交失败，请重试')
      }
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        handleError(err instanceof Error ? err.message : '请求失败，请重试')
      }
    }
  }

  const handleRetry = () => {
    startGeneration()
  }

  useEffect(() => {
    if (visible) {
      setInputValue('')
      setIsSubmitting(false)
      setHasError(false)
      setErrorText('')
      document.body.style.overflow = 'hidden'
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      document.body.style.overflow = ''
      clearTimers()
    }

    return () => {
      document.body.style.overflow = ''
      clearTimers()
    }
  }, [visible])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !isSubmitting) {
      e.preventDefault()
      startGeneration()
    }
  }

  const handleTagClick = () => {
    onCancel()
    navigate('/agent/create')
  }

  const handleClose = () => {
    clearTimers()
    setIsSubmitting(false)
    setHasError(false)
    setErrorText('')
    onCancel()
  }

  if (!visible) {
    return null
  }

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose}>
          <CloseOutlined />
        </button>

        <h2 className={styles.title}>你需要一个什么样的智能体？</h2>

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
            disabled={isSubmitting && !hasError}
          />
          {isSubmitting && !hasError ? (
            <div className={styles.loadingButton}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 16, color: '#fff' }} spin />} />
            </div>
          ) : (
            <button
              className={`${styles.sendButton} ${inputValue.trim() && !isSubmitting ? styles.sendButtonActive : ''}`}
              onClick={startGeneration}
              disabled={!inputValue.trim() || isSubmitting}
            >
              <ArrowUpOutlined />
            </button>
          )}
        </div>

        {isSubmitting && !hasError && (
          <div className={styles.loadingText}>
            <LoadingOutlined style={{ marginRight: 8 }} />
            正在努力生成中...
          </div>
        )}

        {hasError && (
          <div className={styles.errorContainer}>
            <div className={styles.errorText}>{errorText}</div>
            <button className={styles.retryButton} onClick={handleRetry}>
              <ReloadOutlined style={{ marginRight: 6 }} />
              重试
            </button>
          </div>
        )}

        {!isSubmitting && (
          <>
            <p className={styles.hint}>没有灵感？试试智能体模板~</p>
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
          </>
        )}
      </div>
    </div>
  )
}