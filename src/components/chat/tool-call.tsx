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
}

type ToolDisplayItem = Record<string, unknown>

type SearchResultItem = {
  title: string
  url: string
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

  const outputRecord = readRecord(toolCall.output)
  const outputItems = Array.isArray(toolCall.output) ? toolCall.output : readArrayField(outputRecord, ['results', 'items'])

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

  const outputRecord = readRecord(toolCall.output)
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

function renderReadFileResult(toolCall: ToolCall, isLast = false) {
  const description = readStringField(toolCall.input, ['description']) || '读取文件'
  const path = readStringField(toolCall.input, ['path', 'file_path', 'filepath'])

  return (
    <ChainOfThoughtStep
      label={description}
      icon={<FileTextOutlined />}
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

function renderWriteFileResult(toolCall: ToolCall, isLast = false) {
  const description = readStringField(toolCall.input, ['description']) || '写入文件'
  const path = readStringField(toolCall.input, ['path', 'file_path', 'filepath'])

  return (
    <ChainOfThoughtStep
      label={description}
      icon={<EditOutlined />}
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
}: ToolCallStepProps) {
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
    return renderReadFileResult(toolCall, isLast)
  }

  if (toolCall.name === 'write_file' || toolCall.name === 'edit_file' || toolCall.name === 'str_replace') {
    return renderWriteFileResult(toolCall, isLast)
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
