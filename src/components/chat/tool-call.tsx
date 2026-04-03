import {
  CodeOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  ToolOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'

import type { ToolCall } from '../../core/messages/types'
import styles from '../../pages/Chat/chat.module.less'
import artifactStyles from './artifacts.module.less'
import {
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from './chain-of-thought'

type ToolCallStepProps = {
  toolCall: ToolCall
  messageId?: string
  isLast?: boolean
  getToolDisplayTitle?: (toolCall: ToolCall) => string
  onOpenFile?: (filepath: string, originalUrl?: string) => void
}

type ToolDisplayItem = Record<string, unknown>

type SearchResultItem = {
  title: string
  url: string
}

type RagVideoResultItem = {
  resourceId: string
  courseTitle: string
  duration?: number | null
  score?: number | null
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function readArrayField(record: Record<string, unknown> | null, keys: string[]): unknown[] {
  if (!record) {
    return []
  }

  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function readStringField(record: Record<string, unknown> | null, keys: string[]): string {
  if (!record) {
    return ''
  }

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function readNumberField(record: Record<string, unknown> | null, keys: string[]): number | null {
  if (!record) {
    return null
  }

  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return null
}

// 某些工具结果会把 JSON 当成字符串塞进 output，这里统一先转回结构化对象，避免历史记录和流式渲染两套分支重复处理。
function normalizeToolOutput(output: unknown): unknown {
  if (typeof output !== 'string') {
    return output
  }

  const trimmedOutput = output.trim()

  if (!trimmedOutput || !/^[\[{]/.test(trimmedOutput)) {
    return output
  }

  try {
    return JSON.parse(trimmedOutput) as unknown
  } catch {
    return output
  }
}

function readToolDisplayItems(toolCall: ToolCall): ToolDisplayItem[] {
  const toolDisplay = readRecord(toolCall.toolDisplay)
  const items = toolDisplay?.items

  if (!Array.isArray(items)) {
    return []
  }

  return items.flatMap((item) => {
    const record = readRecord(item)
    return record ? [record] : []
  })
}

function getStepStatus(toolCall: ToolCall) {
  return toolCall.status === 'running' ? 'active' : 'complete'
}

function renderResultChips(items: SearchResultItem[]) {
  if (!items.length) {
    return null
  }

  return (
    <ChainOfThoughtSearchResults>
      {items.map((item, index) => (
        <ChainOfThoughtSearchResult key={`${item.url || item.title}-${index}`}>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </ChainOfThoughtSearchResult>
      ))}
    </ChainOfThoughtSearchResults>
  )
}

function renderInlineFileCard(filepath: string, onOpenFile?: (filepath: string, originalUrl?: string) => void, originalUrl?: string) {
  if (!onOpenFile) {
    return (
      <ChainOfThoughtSearchResults>
        <ChainOfThoughtSearchResult>{filepath}</ChainOfThoughtSearchResult>
      </ChainOfThoughtSearchResults>
    )
  }

  const fileName = filepath.split('/').pop() || filepath
  const extension = filepath.split('.').pop()?.toLocaleLowerCase() || ''
  const displayName = extension ? extension.toUpperCase() : 'FILE'

  return (
    <div className={artifactStyles.inlineFileCard} onClick={() => onOpenFile(filepath, originalUrl)}>
      <div className={artifactStyles.inlineFileCardIcon}>
        <FileTextOutlined />
      </div>
      <div className={artifactStyles.inlineFileCardInfo}>
        <div className={artifactStyles.inlineFileCardName}>{fileName}</div>
        <div className={artifactStyles.inlineFileCardType}>{displayName} 文件</div>
      </div>
      <div className={artifactStyles.inlineFileCardAction}>点击预览 →</div>
    </div>
  )
}

function readSearchResults(toolCall: ToolCall): SearchResultItem[] {
  const displayItems = readToolDisplayItems(toolCall).flatMap((item) => {
    const title = readStringField(item, ['title', 'name', 'label'])
    const url = readStringField(item, ['url', 'source_url', 'href'])

    if (!title && !url) {
      return []
    }

    return [{
      title: title || url,
      url,
    }]
  })

  if (displayItems.length) {
    return displayItems
  }

  const normalizedOutput = normalizeToolOutput(toolCall.output)
  const outputRecord = readRecord(normalizedOutput)
  const outputItems = Array.isArray(normalizedOutput) ? normalizedOutput : readArrayField(outputRecord, ['results', 'items'])

  return outputItems.flatMap((item) => {
    const record = readRecord(item)
    const title = readStringField(record, ['title', 'name', 'label'])
    const url = readStringField(record, ['url', 'source_url', 'href'])

    if (!title && !url) {
      return []
    }

    return [{
      title: title || url,
      url,
    }]
  })
}

function readTodoItems(toolCall: ToolCall): SearchResultItem[] {
  const displayItems = readToolDisplayItems(toolCall).flatMap((item) => {
    const title = readStringField(item, ['content', 'title', 'name', 'label'])

    if (!title) {
      return []
    }

    return [{
      title,
      url: '',
    }]
  })

  if (displayItems.length) {
    return displayItems
  }

  const outputRecord = readRecord(normalizeToolOutput(toolCall.output))
  const outputItems = readArrayField(outputRecord, ['todos', 'items'])

  return outputItems.flatMap((item) => {
    const record = readRecord(item)
    const title = readStringField(record, ['content', 'title', 'name', 'label'])

    if (!title) {
      return []
    }

    return [{
      title,
      url: '',
    }]
  })
}

function formatRagVideoMeta(duration?: number | null, score?: number | null): string {
  const meta: string[] = []

  if (typeof duration === 'number' && Number.isFinite(duration)) {
    meta.push(`${duration.toFixed(1)} 分钟`)
  }

  if (typeof score === 'number' && Number.isFinite(score)) {
    meta.push(`相关度 ${score.toFixed(3)}`)
  }

  return meta.join(' · ')
}

function readRagVideoItems(toolCall: ToolCall): RagVideoResultItem[] {
  const displayItems = readToolDisplayItems(toolCall).flatMap((item) => {
    const courseTitle = readStringField(item, ['course_title', 'title', 'name', 'label'])

    if (!courseTitle) {
      return []
    }

    return [{
      resourceId: readStringField(item, ['resource_id', 'resourceId', 'id']),
      courseTitle,
      duration: readNumberField(item, ['duration']),
      score: readNumberField(item, ['score']),
    }]
  })

  if (displayItems.length) {
    return displayItems
  }

  const normalizedOutput = normalizeToolOutput(toolCall.output)
  const outputRecord = readRecord(normalizedOutput)
  const outputItems = Array.isArray(normalizedOutput) ? normalizedOutput : readArrayField(outputRecord, ['results', 'items', 'videos'])

  return outputItems.flatMap((item) => {
    const record = readRecord(item)
    const courseTitle = readStringField(record, ['course_title', 'title', 'name', 'label'])

    if (!courseTitle) {
      return []
    }

    return [{
      resourceId: readStringField(record, ['resource_id', 'resourceId', 'id']),
      courseTitle,
      duration: readNumberField(record, ['duration']),
      score: readNumberField(record, ['score']),
    }]
  })
}

function readRagVideoSummary(toolCall: ToolCall): string {
  if (typeof toolCall.output === 'string' && toolCall.output.trim()) {
    return toolCall.output.trim()
  }

  const outputRecord = readRecord(normalizeToolOutput(toolCall.output))
  const count = readNumberField(outputRecord, ['count', 'total', 'found'])

  if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
    return `找到 ${count} 条视频结果`
  }

  return ''
}

function renderWebSearchResult(toolCall: ToolCall, isLast = false) {
  const query = typeof toolCall.input.query === 'string' ? toolCall.input.query : ''
  const label = query ? `在网络上搜索 “${query}”` : '搜索相关信息'
  const resultItems = readSearchResults(toolCall)

  return (
    <ChainOfThoughtStep
      label={label}
      icon={<SearchOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    >
      {renderResultChips(resultItems)}
    </ChainOfThoughtStep>
  )
}

function renderRagListVideosResult(toolCall: ToolCall, isLast = false) {
  const query = typeof toolCall.input.query === 'string' ? toolCall.input.query.trim() : ''
  const label = query ? `检索知识库视频 “${query}”` : '检索知识库视频'
  const resultItems = readRagVideoItems(toolCall)
  const summary = readRagVideoSummary(toolCall)

  return (
    <ChainOfThoughtStep
      label={label}
      icon={<SearchOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    >
      {resultItems.length ? (
        <ChainOfThoughtSearchResults>
          {resultItems.map((item, index) => {
            const meta = formatRagVideoMeta(item.duration, item.score)
            return (
              <ChainOfThoughtSearchResult key={`${item.resourceId || item.courseTitle}-${index}`}>
                {meta ? `${item.courseTitle} · ${meta}` : item.courseTitle}
              </ChainOfThoughtSearchResult>
            )
          })}
        </ChainOfThoughtSearchResults>
      ) : summary ? (
        <ChainOfThoughtSearchResults>
          <ChainOfThoughtSearchResult>{summary}</ChainOfThoughtSearchResult>
        </ChainOfThoughtSearchResults>
      ) : null}
    </ChainOfThoughtStep>
  )
}

function renderWebFetchResult(toolCall: ToolCall, isLast = false) {
  const url = readStringField(toolCall.input, ['url', 'href'])

  return (
    <ChainOfThoughtStep
      label="查看网页"
      icon={<GlobalOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    >
      {url ? (
        <ChainOfThoughtSearchResults>
          <ChainOfThoughtSearchResult>
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          </ChainOfThoughtSearchResult>
        </ChainOfThoughtSearchResults>
      ) : null}
    </ChainOfThoughtStep>
  )
}

function renderListFilesResult(toolCall: ToolCall, isLast = false) {
  const description = readStringField(toolCall.input, ['description']) || '列出文件夹'
  const path = readStringField(toolCall.input, ['path', 'file_path'])

  return (
    <ChainOfThoughtStep
      label={description}
      icon={<FolderOpenOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    >
      {path ? (
        <ChainOfThoughtSearchResults>
          <ChainOfThoughtSearchResult>{path}</ChainOfThoughtSearchResult>
        </ChainOfThoughtSearchResults>
      ) : null}
    </ChainOfThoughtStep>
  )
}

function renderReadFileResult(toolCall: ToolCall, isLast = false, onOpenFile?: ToolCallStepProps['onOpenFile']) {
  const description = readStringField(toolCall.input, ['description']) || '读取文件'
  const path = readStringField(toolCall.input, ['path', 'file_path', 'filepath'])

  return (
    <ChainOfThoughtStep
      label={description}
      icon={<FileTextOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    >
      {path ? renderInlineFileCard(path, onOpenFile, path) : null}
    </ChainOfThoughtStep>
  )
}

function renderWriteFileResult(toolCall: ToolCall, isLast = false, onOpenFile?: ToolCallStepProps['onOpenFile']) {
  const description = readStringField(toolCall.input, ['description']) || '写入文件'
  const path = readStringField(toolCall.input, ['path', 'file_path', 'filepath'])

  return (
    <ChainOfThoughtStep
      label={description}
      icon={<EditOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    >
      {path ? renderInlineFileCard(path, onOpenFile, path) : null}
    </ChainOfThoughtStep>
  )
}

function renderBashResult(toolCall: ToolCall, isLast = false) {
  const description = readStringField(toolCall.input, ['description']) || '执行命令'
  const command = readStringField(toolCall.input, ['command'])

  return (
    <ChainOfThoughtStep
      label={description}
      icon={<CodeOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    >
      {command ? <pre className={styles.chainOfThoughtCodeBlock}>{command}</pre> : null}
    </ChainOfThoughtStep>
  )
}

function renderTodoResult(toolCall: ToolCall, isLast = false) {
  const items = readTodoItems(toolCall)

  return (
    <ChainOfThoughtStep
      label="更新 To-do 列表"
      icon={<UnorderedListOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    >
      {renderResultChips(items)}
    </ChainOfThoughtStep>
  )
}

function renderAskClarificationResult(toolCall: ToolCall, isLast = false) {
  return (
    <ChainOfThoughtStep
      label="需要你的协助"
      icon={<QuestionCircleOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    />
  )
}

function renderGenericToolCall(toolCall: ToolCall, isLast = false, getToolDisplayTitle?: ToolCallStepProps['getToolDisplayTitle']) {
  const description =
    readStringField(toolCall.input, ['description']) ||
    getToolDisplayTitle?.(toolCall) ||
    `使用 “${toolCall.name}” 工具`

  return (
    <ChainOfThoughtStep
      label={description}
      icon={<ToolOutlined />}
      isLast={isLast}
      status={getStepStatus(toolCall)}
    />
  )
}

export function ToolCallStep({
  toolCall,
  isLast = false,
  getToolDisplayTitle,
  onOpenFile,
}: ToolCallStepProps) {
  if (toolCall.name === 'rag_list_videos') {
    return renderRagListVideosResult(toolCall, isLast)
  }

  if (toolCall.name === 'web_search') {
    return renderWebSearchResult(toolCall, isLast)
  }

  if (toolCall.name === 'web_fetch') {
    return renderWebFetchResult(toolCall, isLast)
  }

  if (toolCall.name === 'ls') {
    return renderListFilesResult(toolCall, isLast)
  }

  if (toolCall.name === 'read_file') {
    return renderReadFileResult(toolCall, isLast, onOpenFile)
  }

  if (toolCall.name === 'write_file' || toolCall.name === 'edit_file' || toolCall.name === 'str_replace') {
    return renderWriteFileResult(toolCall, isLast, onOpenFile)
  }

  if (toolCall.name === 'bash') {
    return renderBashResult(toolCall, isLast)
  }

  if (toolCall.name === 'ask_clarification') {
    return renderAskClarificationResult(toolCall, isLast)
  }

  if (toolCall.name === 'write_todos' || toolCall.name === 'update_plan' || toolCall.name.includes('todo')) {
    return renderTodoResult(toolCall, isLast)
  }

  return renderGenericToolCall(toolCall, isLast, getToolDisplayTitle)
}
