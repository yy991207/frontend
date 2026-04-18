import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AudioOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FileUnknownOutlined,
  LoadingOutlined,
  MenuOutlined,
  MoreOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { AppPageShell, AppSurfacePanel } from '../../components/layout/AppPageShell'
import { Button, Dropdown, Empty, Input, Pagination, Select, Spin, Table, Tag, message } from 'antd'
import type { MenuProps, TableColumnsType } from 'antd'
import styles from './library.module.less'
import { LibraryFilePreviewModal } from './LibraryFilePreviewModal'
import { saveToCloudDisk } from '../../services/libraryFileService'
import { API_PATHS, buildAbsoluteApiUrl } from '../../services/apiEndpoints'

type LibraryConfig = {
  baseUrl: string
  userId: string
  libraryPath: string
  token: string
}

type LibraryFileType = 'document' | 'image' | 'video' | 'audio' | 'other'

type LibraryAgentType = 'personal' | 'general' | 'custom'

type LibraryFileItem = {
  file_id: string
  file_name: string
  agent_name: string
  file_type: LibraryFileType
  file_path: string
  created_at: string
  session_id: string
  agent_id?: string
}

type LibraryResponse = {
  files?: LibraryFileItem[]
  total?: number
}

type FilterOption = {
  key: string
  label: string
  icon: ReactNode
}

type QueryState = {
  agentType: string
  fileType: string
  keyword: string
  agentName: string
}

type FilterCategoryKey = 'source' | 'type'

type FilterCategory = {
  key: FilterCategoryKey
  label: string
}

type SelectOption = {
  value: string
  label: ReactNode
}

const PAGE_SIZE = 8
const FILE_TYPE_ALL = 'all'
const SOURCE_ALL = 'all'

const FILE_TYPE_OPTIONS: FilterOption[] = [
  { key: FILE_TYPE_ALL, label: '全部', icon: <MenuOutlined /> },
  { key: 'document', label: '文档', icon: <FileTextOutlined /> },
  { key: 'image', label: '图片', icon: <FileImageOutlined /> },
  { key: 'video', label: '视频', icon: <VideoCameraOutlined /> },
  { key: 'audio', label: '音频', icon: <AudioOutlined /> },
  { key: 'other', label: '其他', icon: <FileUnknownOutlined /> },
]

const FILTER_CATEGORIES: FilterCategory[] = [
  { key: 'source', label: '来源' },
  { key: 'type', label: '类型' },
]

function parseSimpleYaml(rawText: string) {
  return rawText.split(/\r?\n/).reduce<Record<string, string>>((result, line) => {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      return result
    }

    const separatorIndex = trimmedLine.indexOf(':')
    if (separatorIndex === -1) {
      return result
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')

    if (key) {
      result[key] = value
    }

    return result
  }, {})
}

async function loadLibraryConfig(): Promise<LibraryConfig> {
  const response = await fetch('/config.yaml')

  if (!response.ok) {
    throw new Error('加载配置文件失败')
  }

  const rawText = await response.text()
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const userId = parsedConfig.user_id
  const token = parsedConfig.token

  if (!baseUrl || !userId) {
    throw new Error('config.yaml 缺少 url 或 user_id 配置')
  }

  return {
    baseUrl,
    userId,
    libraryPath: API_PATHS.library,
    token,
  }
}

function buildFileTypeQueryValue(value: string): string | null {
  if (!value || value === FILE_TYPE_ALL) {
    return null
  }

  return value
}

function buildAgentTypeQueryValue(value: string): LibraryAgentType | null {
  if (!value || value === 'all') {
    return null
  }

  if (value === 'personal' || value === 'general' || value === 'custom') {
    return value
  }

  return null
}

async function fetchLibraryFiles(config: LibraryConfig, query: QueryState, signal?: AbortSignal): Promise<LibraryResponse> {
  const requestUrl = new URL(buildAbsoluteApiUrl(config.baseUrl, config.libraryPath))
  requestUrl.searchParams.set('user_id', config.userId)

  const agentType = buildAgentTypeQueryValue(query.agentType)
  const fileType = buildFileTypeQueryValue(query.fileType)
  const keyword = query.keyword.trim()

  if (agentType) {
    requestUrl.searchParams.set('agent_type', agentType)
  }

  if (fileType) {
    requestUrl.searchParams.set('file_type', fileType)
  }

  if (keyword) {
    requestUrl.searchParams.set('keyword', keyword)
  }

  const response = await fetch(requestUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`获取文件库失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as LibraryResponse

  if (!query.agentName || query.agentName === SOURCE_ALL) {
    return data
  }

  const filteredFiles = (data.files ?? []).filter((item) => item.agent_name === query.agentName)
  return {
    ...data,
    files: filteredFiles,
    total: filteredFiles.length,
  }
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-')
}

function getAvatarLetter(name: string) {
  return name.trim().charAt(0).toUpperCase() || '库'
}

function getFileTypeText(fileType: LibraryFileType) {
  if (fileType === 'document') return '文档'
  if (fileType === 'image') return '图片'
  if (fileType === 'video') return '视频'
  if (fileType === 'audio') return '音频'
  return '其他'
}

function getFileTypeTagClass(fileType: LibraryFileType) {
  if (fileType === 'document') return styles.typeTagDocument
  if (fileType === 'image') return styles.typeTagImage
  if (fileType === 'video') return styles.typeTagVideo
  if (fileType === 'audio') return styles.typeTagAudio
  return styles.typeTagOther
}

function buildTypeOptionLabel(option: FilterOption) {
  return (
    <span className={styles.selectOptionLabel}>
      <span className={styles.selectOptionIcon}>{option.icon}</span>
      <span>{option.label}</span>
    </span>
  )
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState(FILE_TYPE_ALL)
  const [keyword, setKeyword] = useState('')
  const [selectedSource, setSelectedSource] = useState(SOURCE_ALL)
  const [primaryCategory, setPrimaryCategory] = useState<FilterCategoryKey>('source')
  const [secondarySource, setSecondarySource] = useState(SOURCE_ALL)
  const [secondaryType, setSecondaryType] = useState(FILE_TYPE_ALL)
  const [rawFiles, setRawFiles] = useState<LibraryFileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [config, setConfig] = useState<LibraryConfig | null>(null)

  const handleFilePreview = (fileId: string) => {
    setPreviewFileId(fileId)
    setPreviewVisible(true)
  }

  const handlePreviewClose = () => {
    setPreviewVisible(false)
    setPreviewFileId(null)
  }

  const handleViewSession = (item: LibraryFileItem) => {
    if (item.session_id) {
      if (item.agent_id) {
        navigate(`/agent/${item.agent_id}/chat?sessionId=${item.session_id}`)
      } else {
        navigate(`/chat?sessionId=${item.session_id}`)
      }
    }
  }

  const handleDownloadFile = async (item: LibraryFileItem) => {
    if (!config || !item.file_path) return

    try {
      const endpoint = buildAbsoluteApiUrl(config.baseUrl, API_PATHS.libraryFileDownloadUrl)
      const requestUrl = new URL(endpoint)
      requestUrl.searchParams.set('url', item.file_path)
      requestUrl.searchParams.set('expires', '3600')

      const response = await fetch(requestUrl.toString())
      if (!response.ok) throw new Error('获取下载链接失败')

      const data = await response.json()
      if (data.success && data.data?.url) {
        const link = document.createElement('a')
        link.href = data.data.url
        link.download = item.file_name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (downloadError) {
      console.error('下载失败:', downloadError)
      message.error('下载失败，请稍后重试')
    }
  }

  const handleSaveToCloudDisk = async (item: LibraryFileItem) => {
    if (!config || !item.file_path) return

    try {
      const result = await saveToCloudDisk(config.baseUrl, config.token, config.userId, {
        url: item.file_path,
      })
      if (result.success) {
        message.success('保存到云盘成功')
      } else {
        message.error(result.message || '保存到云盘失败')
      }
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : '保存到云盘失败')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const queryState: QueryState = {
      agentType: 'all',
      fileType: activeFilter,
      keyword,
      agentName: SOURCE_ALL,
    }

    async function loadFiles() {
      setLoading(true)
      setError('')

      try {
        const loadedConfig = await loadLibraryConfig()
        setConfig(loadedConfig)
        const response = await fetchLibraryFiles(loadedConfig, queryState, controller.signal)
        setRawFiles(response.files ?? [])
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return
        }
        setRawFiles([])
        setError(fetchError instanceof Error ? fetchError.message : '文件库加载失败')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadFiles()

    return () => {
      controller.abort()
    }
  }, [activeFilter, keyword])

  const sourceOptions = useMemo(() => {
    const names = Array.from(new Set(rawFiles.map((item) => item.agent_name).filter(Boolean)))
    return [{ value: SOURCE_ALL, label: '全部来源' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [rawFiles])

  useEffect(() => {
    if (secondarySource !== SOURCE_ALL && !sourceOptions.some((option) => option.value === secondarySource)) {
      setSecondarySource(SOURCE_ALL)
    }
  }, [secondarySource, sourceOptions])

  useEffect(() => {
    if (primaryCategory === 'source') {
      setSelectedSource(secondarySource)
      setActiveFilter(FILE_TYPE_ALL)
    } else {
      setActiveFilter(secondaryType)
      setSelectedSource(SOURCE_ALL)
    }
  }, [primaryCategory, secondarySource, secondaryType])

  const visibleFiles = useMemo(() => {
    if (selectedSource === SOURCE_ALL) {
      return rawFiles
    }
    return rawFiles.filter((item) => item.agent_name === selectedSource)
  }, [rawFiles, selectedSource])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeFilter, keyword, selectedSource, primaryCategory, secondarySource, secondaryType])

  const hasKeyword = keyword.trim().length > 0
  const total = visibleFiles.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pagedFiles = useMemo(() => {
    // 这里先继续保留前端分页切片，避免这次改造顺手改接口协议。
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return visibleFiles.slice(start, start + PAGE_SIZE)
  }, [safeCurrentPage, visibleFiles])
  const hasActiveFilters = activeFilter !== FILE_TYPE_ALL || selectedSource !== SOURCE_ALL || hasKeyword

  const secondaryFilterOptions = useMemo<SelectOption[]>(() => {
    if (primaryCategory === 'source') {
      return sourceOptions.map((option) => ({
        value: option.value,
        label: option.label,
      }))
    }

    return FILE_TYPE_OPTIONS.map((option) => ({
      value: option.key,
      label: buildTypeOptionLabel(option),
    }))
  }, [primaryCategory, sourceOptions])

  const columns: TableColumnsType<LibraryFileItem> = [
    {
      title: '名称',
      dataIndex: 'file_name',
      key: 'file_name',
      width: '34%',
      render: (_, item) => (
        <button
          type="button"
          className={styles.fileNameButton}
          onClick={() => handleFilePreview(item.file_id)}
        >
          <span className={styles.fileIcon}>
            <span className={styles.fileIconLetter}>{getAvatarLetter(item.file_name)}</span>
          </span>
          <span className={styles.fileMeta}>
            <span className={styles.fileName} title={item.file_name}>
              {item.file_name}
            </span>
          </span>
        </button>
      ),
    },
    {
      title: '来源',
      dataIndex: 'agent_name',
      key: 'agent_name',
      width: '18%',
      render: (value: string) => (
        <span className={styles.agentName} title={value}>
          {value || '-'}
        </span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'file_type',
      key: 'file_type',
      width: '12%',
      render: (value: LibraryFileType) => (
        <Tag className={`${styles.typeTag} ${getFileTypeTagClass(value)}`} bordered={false}>
          {getFileTypeText(value)}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '18%',
      render: (value: string) => <span className={styles.timeText}>{formatDateTime(value)}</span>,
    },
    {
      title: '查看',
      key: 'preview',
      width: 110,
      render: (_, item) => (
        <Button type="link" className={styles.viewButton} onClick={() => handleFilePreview(item.file_id)}>
          查看详情
        </Button>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 88,
      align: 'right',
      render: (_, item) => {
        const menuItems: MenuProps['items'] = [
          {
            key: 'view-session',
            icon: <EyeOutlined />,
            label: '查看对话',
          },
          {
            key: 'download',
            icon: <DownloadOutlined />,
            label: '下载',
          },
          {
            key: 'save-to-cloud',
            icon: <CloudUploadOutlined />,
            label: '保存到云盘',
          },
        ]

        return (
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: menuItems,
              onClick: ({ key }) => {
                if (key === 'view-session') {
                  handleViewSession(item)
                  return
                }
                if (key === 'download') {
                  void handleDownloadFile(item)
                  return
                }
                if (key === 'save-to-cloud') {
                  void handleSaveToCloudDisk(item)
                }
              },
            }}
          >
            <Button
              type="text"
              className={styles.actionButton}
              icon={<MoreOutlined />}
              aria-label="更多操作"
            />
          </Dropdown>
        )
      },
    },
  ]

  const emptyDescription = error || (hasActiveFilters ? '没有匹配结果，换个筛选条件试试吧' : '暂无文件内容')

  return (
    <AppPageShell>
      <AppSurfacePanel className={styles.panel}>
        <div className={styles.libraryPage}>
          <header className={styles.header}>
            <div className={styles.headerMain}>
              <h1 className={styles.title}>库</h1>
            </div>
          </header>

          <div className={styles.tools}>
            <div className={styles.cascadeFilterGroup}>
              <Select
                value={primaryCategory}
                className={styles.filterSelect}
                options={FILTER_CATEGORIES.map((category) => ({
                  value: category.key,
                  label: category.label,
                }))}
                onChange={(value) => setPrimaryCategory(value)}
              />
              <Select
                value={primaryCategory === 'source' ? secondarySource : secondaryType}
                className={styles.filterSelect}
                options={secondaryFilterOptions}
                onChange={(value) => {
                  if (primaryCategory === 'source') {
                    setSecondarySource(value)
                    return
                  }
                  setSecondaryType(value)
                }}
              />
            </div>

            <Input
              value={keyword}
              allowClear
              className={styles.searchInput}
              placeholder="搜索"
              prefix={<SearchOutlined className={styles.searchIcon} />}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>

          <div className={styles.content}>
            <div className={styles.tableWrap}>
              <Spin
                spinning={loading}
                indicator={<LoadingOutlined spin className={styles.feedbackIcon} />}
              >
                <Table<LibraryFileItem>
                  rowKey="file_id"
                  className={styles.libraryTable}
                  columns={columns}
                  dataSource={pagedFiles}
                  pagination={false}
                  scroll={{ x: 1080 }}
                  locale={{
                    emptyText: (
                      <div className={styles.emptyState}>
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={emptyDescription}
                        />
                      </div>
                    ),
                  }}
                />
              </Spin>

              <div className={styles.paginationRow}>
                <div className={styles.paginationSummary}>第 {safeCurrentPage}/{totalPages} 页，共 {total} 条</div>
                <Pagination
                  current={safeCurrentPage}
                  total={total}
                  pageSize={PAGE_SIZE}
                  size="small"
                  showSizeChanger={false}
                  disabled={loading || total === 0}
                  onChange={(page) => setCurrentPage(page)}
                />
              </div>
            </div>
          </div>
        </div>
      </AppSurfacePanel>

      <LibraryFilePreviewModal
        visible={previewVisible}
        fileId={previewFileId}
        baseUrl={config?.baseUrl ?? ''}
        onClose={handlePreviewClose}
      />
    </AppPageShell>
  )
}
