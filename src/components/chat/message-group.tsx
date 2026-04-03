import {
  ApartmentOutlined,
  BookOutlined,
  BulbOutlined,
  CaretUpOutlined,
  CopyOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useMemo, useState } from 'react'

import type { CourseItem, Message, MessageGroup, SkillOutputItem, ToolCall } from '../../core/messages/types'
import {
  extractAssistantOutputText,
  extractReasoningContentFromMessage,
  extractSubagentLabelFromMessage,
  extractTextFromMessage,
} from '../../core/messages/utils'
import styles from '../../pages/Chat/chat.module.less'
import artifactStyles from './artifacts.module.less'
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtSearchResult, ChainOfThoughtSearchResults, ChainOfThoughtStep } from './chain-of-thought'
import { MarkdownContent } from './markdown-content'
import { ToolCallStep } from './tool-call'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SkillOutputCard({
  item,
  onOpenFile,
}: {
  item: SkillOutputItem
  onOpenFile?: (filepath: string, originalUrl?: string) => void
}) {
  const extension = item.filename.split('.').pop()?.toLocaleLowerCase() || ''
  const displayName = extension ? extension.toUpperCase() : 'FILE'

  return (
    <div
      className={artifactStyles.inlineFileCard}
      onClick={() => onOpenFile?.(item.url, item.url)}
    >
      <div className={artifactStyles.inlineFileCardIcon}>
        <FileTextOutlined />
      </div>
      <div className={artifactStyles.inlineFileCardInfo}>
        <div className={artifactStyles.inlineFileCardName}>{item.filename}</div>
        <div className={artifactStyles.inlineFileCardType}>
          {displayName} 文件 · {formatFileSize(item.size)}
        </div>
      </div>
      <div className={artifactStyles.inlineFileCardAction}>点击预览 →</div>
    </div>
  )
}

type MessageGroupSectionProps = {
  group: MessageGroup
  copiedMessageId: string | null
  assistantCopyTargets: Record<string, string>
  onCopy: (messageId: string, content: string) => void
  getToolDisplayTitle: (toolCall: ToolCall) => string
  getToolDisplaySummary: (toolCall: ToolCall) => string
  onOpenFile?: (filepath: string, originalUrl?: string) => void
}

type ProcessStep =
  | {
      id: string
      type: 'reasoning'
      reasoning: string
    }
  | {
      id: string
      type: 'subagent'
      label: string
    }
  | {
      id: string
      type: 'tool'
      toolCall: ToolCall
      messageId: string
    }
  | {
      id: string
      type: 'courses'
      courses: CourseItem[]
    }

function renderCopyAction(messageId: string, content: string, copiedMessageId: string | null, onCopy: MessageGroupSectionProps['onCopy']) {
  return (
    <button type="button" className={styles.inlineAction} onClick={() => onCopy(messageId, content)}>
      <CopyOutlined />
      <span>{copiedMessageId === messageId ? '已复制' : '复制'}</span>
    </button>
  )
}

function buildProcessSteps(message: Message): ProcessStep[] {
  const steps: ProcessStep[] = []
  const reasoning = extractReasoningContentFromMessage(message)
  const subagentLabel = extractSubagentLabelFromMessage(message)

  if (reasoning) {
    steps.push({
      id: `${message.id}-reasoning`,
      type: 'reasoning',
      reasoning,
    })
  }

  if (subagentLabel) {
    steps.push({
      id: `${message.id}-subagent`,
      type: 'subagent',
      label: subagentLabel,
    })
  }

  for (const toolCall of message.tool_calls) {
    steps.push({
      id: toolCall.runId,
      type: 'tool',
      toolCall,
      messageId: message.id,
    })
  }

  if (message.courses.length) {
    steps.push({
      id: `${message.id}-courses`,
      type: 'courses',
      courses: message.courses,
    })
  }

  return steps
}

function renderCourseStep(step: Extract<ProcessStep, { type: 'courses' }>, isLast = false) {
  return (
    <ChainOfThoughtStep
      key={step.id}
      label={`课程推荐 (${step.courses.length})`}
      icon={<BookOutlined />}
      isLast={isLast}
    >
      <ChainOfThoughtSearchResults>
        {step.courses.slice(0, 6).map((course, index) => (
          <ChainOfThoughtSearchResult key={`${course.resourceId || course.title}-${index}`}>
            {course.url ? (
              <a href={course.url} target="_blank" rel="noreferrer">
                {course.title}
              </a>
            ) : (
              course.title
            )}
          </ChainOfThoughtSearchResult>
        ))}
      </ChainOfThoughtSearchResults>
    </ChainOfThoughtStep>
  )
}

function renderProcessStep(
  step: ProcessStep,
  isLast: boolean,
  getToolDisplayTitle: MessageGroupSectionProps['getToolDisplayTitle'],
  onOpenFile?: MessageGroupSectionProps['onOpenFile'],
) {
  if (step.type === 'reasoning') {
    return (
      <ChainOfThoughtStep
        key={step.id}
        label={<MarkdownContent className={styles.chainOfThoughtReasoning} content={step.reasoning} />}
        isLast={isLast}
      />
    )
  }

  if (step.type === 'subagent') {
    return (
      <ChainOfThoughtStep
        key={step.id}
        label={`子任务：${step.label}`}
        icon={<ApartmentOutlined />}
        isLast={isLast}
      />
    )
  }

  if (step.type === 'courses') {
    return renderCourseStep(step, isLast)
  }

  return (
    <ToolCallStep
      key={step.id}
      toolCall={step.toolCall}
      messageId={step.messageId}
      isLast={isLast}
      getToolDisplayTitle={getToolDisplayTitle}
      onOpenFile={onOpenFile}
    />
  )
}

function ProcessingMessage({
  message,
  getToolDisplayTitle,
  onOpenFile,
}: {
  message: Message
  getToolDisplayTitle: MessageGroupSectionProps['getToolDisplayTitle']
  onOpenFile?: MessageGroupSectionProps['onOpenFile']
}) {
  const [showAbove, setShowAbove] = useState(true)
  const [showLastThinking, setShowLastThinking] = useState(true)
  const steps = useMemo(() => buildProcessSteps(message), [message])

  const lastActionStep = useMemo(() => {
    const actionSteps = steps.filter((step) => step.type !== 'reasoning')
    return actionSteps[actionSteps.length - 1] ?? null
  }, [steps])

  const aboveLastActionSteps = useMemo(() => {
    if (!lastActionStep) {
      return []
    }

    const index = steps.indexOf(lastActionStep)
    return index > 0 ? steps.slice(0, index) : []
  }, [lastActionStep, steps])

  const lastReasoningStep = useMemo(() => {
    if (lastActionStep) {
      const index = steps.indexOf(lastActionStep)
      return steps.slice(index + 1).find((step) => step.type === 'reasoning') ?? null
    }

    const reasoningSteps = steps.filter((step) => step.type === 'reasoning')
    return reasoningSteps[reasoningSteps.length - 1] ?? null
  }, [lastActionStep, steps])

  return (
    <div className={styles.processingPanel}>
      <ChainOfThought open={true}>
        {aboveLastActionSteps.length ? (
          <button
            type="button"
            className={styles.chainOfThoughtToggle}
            onClick={() => setShowAbove((value) => !value)}
          >
            <ChainOfThoughtStep
              label={<span className={styles.chainOfThoughtToggleLabel}>{showAbove ? '隐藏步骤' : `查看其他 ${aboveLastActionSteps.length} 个步骤`}</span>}
              icon={
                <CaretUpOutlined
                  className={showAbove ? styles.chainOfThoughtToggleIconOpen : styles.chainOfThoughtToggleIcon}
                />
              }
              isLast={true}
            />
          </button>
        ) : null}

        {lastActionStep ? (
          <ChainOfThoughtContent>
            {showAbove ? aboveLastActionSteps.map((step, index) => renderProcessStep(
              step,
              index === aboveLastActionSteps.length - 1 && !lastReasoningStep,
              getToolDisplayTitle,
              onOpenFile,
            )) : null}
            {renderProcessStep(lastActionStep, !lastReasoningStep, getToolDisplayTitle, onOpenFile)}
          </ChainOfThoughtContent>
        ) : null}

        {lastReasoningStep ? (
          <>
            <button
              type="button"
              className={styles.chainOfThoughtToggle}
              onClick={() => setShowLastThinking((value) => !value)}
            >
              <div className={styles.chainOfThoughtToggleRow}>
                <ChainOfThoughtStep
                  className={styles.chainOfThoughtThinkingStep}
                  label="思考"
                  icon={<BulbOutlined />}
                  isLast={true}
                />
                <CaretUpOutlined
                  className={showLastThinking ? styles.chainOfThoughtToggleIconOpen : styles.chainOfThoughtToggleIcon}
                />
              </div>
            </button>
            {showLastThinking ? (
              <ChainOfThoughtContent>
                {renderProcessStep(lastReasoningStep, true, getToolDisplayTitle, onOpenFile)}
              </ChainOfThoughtContent>
            ) : null}
          </>
        ) : null}
      </ChainOfThought>
    </div>
  )
}

export function MessageGroupSection({
  group,
  copiedMessageId,
  assistantCopyTargets,
  onCopy,
  getToolDisplayTitle,
  onOpenFile,
}: MessageGroupSectionProps) {
  switch (group.type) {
    case 'human':
      return (
        <>
          {group.messages.map((message) => (
            <div key={message.id} className={styles.userRow}>
              <div className={styles.userMessageWrap}>
                <div className={styles.userBubble}>{extractTextFromMessage(message)}</div>
                <div className={styles.userActions}>
                  <span>{message.timestamp}</span>
                  {renderCopyAction(message.id, extractTextFromMessage(message), copiedMessageId, onCopy)}
                </div>
              </div>
            </div>
          ))}
        </>
      )

    case 'assistant:processing':
      return (
        <>
          {group.messages.map((message) => (
            <div key={message.id} className={styles.assistantRow}>
              <ProcessingMessage
                message={message}
                getToolDisplayTitle={getToolDisplayTitle}
                onOpenFile={onOpenFile}
              />
            </div>
          ))}
        </>
      )

    case 'assistant:loading':
      return (
        <>
          {group.messages.map((message) => (
            <div key={message.id} className={styles.assistantRow}>
              <div className={styles.loadingDots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          ))}
        </>
      )

    case 'assistant:reasoning':
    case 'assistant:subagent':
      return (
        <>
          {group.messages.map((message) => (
            <div key={message.id} className={styles.assistantRow}>
              <ProcessingMessage
                message={message}
                getToolDisplayTitle={getToolDisplayTitle}
                onOpenFile={onOpenFile}
              />
            </div>
          ))}
        </>
      )

    case 'assistant':
      return (
        <>
          {group.messages.map((message) => {
            const textContent = extractAssistantOutputText(message)
            const copyContent = assistantCopyTargets[message.id]

            return (
              <div key={message.id} className={styles.assistantRow}>
                <div className={styles.assistantMessageWrap}>
                  <MarkdownContent
                    className={styles.assistantMarkdown}
                    content={textContent}
                    isStreaming={message.loading}
                  />
                  {message.skillOutput.length ? (
                    <div className={artifactStyles.fileList}>
                      {message.skillOutput.map((item, index) => (
                        <SkillOutputCard key={`${item.url}-${index}`} item={item} onOpenFile={onOpenFile} />
                      ))}
                    </div>
                  ) : null}
                  {copyContent ? (
                    <div className={styles.assistantFooter}>
                      {renderCopyAction(message.id, copyContent, copiedMessageId, onCopy)}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </>
      )
  }
}
