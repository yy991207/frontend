import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AudioOutlined,
  CloseCircleFilled,
  DownOutlined,
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
import { getUrlUserId, getConfigUrl } from '../../utils/urlParams'
import styles from './library.module.less'
import { LibraryFilePreviewModal } from './LibraryFilePreviewModal'

type LibraryConfig = {
  baseUrl: string
  userId: string
  libraryPath: string
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
  icon: React.ReactNode
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

const LIBRARY_PATH = '/api/v1/files/library'
const PAGE_SIZE = 8
const FILE_TYPE_ALL = 'all'
const SOURCE_ALL = 'all'
const FIXED_ROW_COUNT = 8

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

function buildAbsoluteUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function loadLibraryConfig(): Promise<LibraryConfig> {
  const response = await fetch(getConfigUrl())

  if (!response.ok) {
    throw new Error('加载配置文件失败')
  }

  const rawText = await response.text()
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const urlUserId = getUrlUserId()
  const userId = urlUserId || ''

  if (!baseUrl || !userId) {
    throw new Error('config.yaml 缺少 url 或 user_id 配置')
  }

  return {
    baseUrl,
    userId,
    libraryPath: LIBRARY_PATH,
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
  const requestUrl = new URL(buildAbsoluteUrl(config.baseUrl, config.libraryPath))
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

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages]
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages]
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [primaryDropdownOpen, setPrimaryDropdownOpen] = useState(false)
  const [secondaryDropdownOpen, setSecondaryDropdownOpen] = useState(false)
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [config, setConfig] = useState<LibraryConfig | null>(null)
  const menuWrapRef = useRef<HTMLDivElement | null>(null)
  const primaryDropdownRef = useRef<HTMLDivElement | null>(null)
  const secondaryDropdownRef = useRef<HTMLDivElement | null>(null)

  const handleFilePreview = (fileId: string) => {
    setPreviewFileId(fileId)
    setPreviewVisible(true)
  }

  const handlePreviewClose = () => {
    setPreviewVisible(false)
    setPreviewFileId(null)
  }

  const handleViewSession = (item: LibraryFileItem) => {
    setOpenMenuId(null)
    if (item.session_id) {
      if (item.agent_id) {
        navigate(`/agent/${item.agent_id}/chat?sessionId=${item.session_id}`)
      } else {
        navigate(`/chat?sessionId=${item.session_id}`)
      }
    }
  }

  const handleDownloadFile = async (item: LibraryFileItem) => {
    setOpenMenuId(null)
    if (!config || !item.file_path) return

    try {
      const endpoint = buildAbsoluteUrl(config.baseUrl, '/api/v1/chat/files/download-url')
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
    } catch (error) {
      console.error('下载失败:', error)
    }
  }

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-action-menu-root="true"]')) {
        setOpenMenuId(null)
      }
      if (!primaryDropdownRef.current?.contains(event.target as Node)) {
        setPrimaryDropdownOpen(false)
      }
      if (!secondaryDropdownRef.current?.contains(event.target as Node)) {
        setSecondaryDropdownOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

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
  const pageNumbers = buildPageNumbers(safeCurrentPage, totalPages)
  const pagedFiles = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return visibleFiles.slice(start, start + PAGE_SIZE)
  }, [safeCurrentPage, visibleFiles])
  const emptyRows = Math.max(0, FIXED_ROW_COUNT - pagedFiles.length)
  const hasActiveFilters = activeFilter !== FILE_TYPE_ALL || selectedSource !== SOURCE_ALL || hasKeyword

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.libraryPage}>
          <header className={styles.header}>
            <div className={styles.headerMain}>
              <h1 className={styles.title}>库</h1>
            </div>
          </header>

          <div className={styles.tools}>
            <div className={styles.cascadeFilterGroup}>
              <div ref={primaryDropdownRef} className={styles.filterDropdownWrap}>
                <button
                  type="button"
                  className={`${styles.filterDropdownButton} ${primaryDropdownOpen ? styles.filterDropdownButtonOpen : ''}`}
                  onClick={() => {
                  setPrimaryDropdownOpen((v) => {
                    if (!v) {
                      setSecondaryDropdownOpen(false)
                    }
                    return !v
                  })
                }}
                >
                  <span>{FILTER_CATEGORIES.find((c) => c.key === primaryCategory)?.label || '来源'}</span>
                  <DownOutlined className={`${styles.filterDropdownArrow} ${primaryDropdownOpen ? styles.filterDropdownArrowOpen : ''}`} />
                </button>
                {primaryDropdownOpen && (
                  <div className={styles.filterDropdownMenu}>
                    {FILTER_CATEGORIES.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        className={`${styles.filterDropdownOption} ${primaryCategory === category.key ? styles.filterDropdownOptionActive : ''}`}
                        onClick={() => {
                          setPrimaryCategory(category.key)
                          setPrimaryDropdownOpen(false)
                        }}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div ref={secondaryDropdownRef} className={styles.filterDropdownWrap}>
                <button
                  type="button"
                  className={`${styles.filterDropdownButton} ${secondaryDropdownOpen ? styles.filterDropdownButtonOpen : ''}`}
                  onClick={() => {
                  setSecondaryDropdownOpen((v) => {
                    if (!v) {
                      setPrimaryDropdownOpen(false)
                    }
                    return !v
                  })
                }}
                >
                  <span>
                    {primaryCategory === 'source'
                      ? sourceOptions.find((o) => o.value === secondarySource)?.label || '全部来源'
                      : FILE_TYPE_OPTIONS.find((o) => o.key === secondaryType)?.label || '全部'}
                  </span>
                  <DownOutlined className={`${styles.filterDropdownArrow} ${secondaryDropdownOpen ? styles.filterDropdownArrowOpen : ''}`} />
                </button>
                {secondaryDropdownOpen && (
                  <div className={styles.filterDropdownMenu}>
                    {(primaryCategory === 'source'
                      ? sourceOptions
                      : FILE_TYPE_OPTIONS.map((option) => ({ value: option.key, label: option.label }))
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.filterDropdownOption} ${(primaryCategory === 'source' ? secondarySource : secondaryType) === option.value ? styles.filterDropdownOptionActive : ''}`}
                        onClick={() => {
                          if (primaryCategory === 'source') {
                            setSecondarySource(option.value)
                          } else {
                            setSecondaryType(option.value)
                          }
                          setSecondaryDropdownOpen(false)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <label className={styles.searchBox}>
              <SearchOutlined className={styles.searchIcon} />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className={styles.searchInput}
                placeholder="搜索"
              />
              {hasKeyword ? (
                <button
                  type="button"
                  className={styles.clearButton}
                  aria-label="清空搜索"
                  onClick={() => setKeyword('')}
                >
                  <CloseCircleFilled />
                </button>
              ) : null}
            </label>
          </div>

          <div className={styles.content}>
            <div className={styles.tableWrap}>
              <div className={styles.tableHeader}>
                <span className={styles.nameCol}>名称</span>
                <span className={styles.sourceCol}>来源</span>
                <span className={styles.typeCol}>类型</span>
                <span className={styles.timeCol}>时间</span>
                <span className={styles.actionCol}>操作</span>
              </div>

              {loading ? (
                <div className={styles.feedbackState}>
                  <LoadingOutlined className={styles.feedbackIcon} />
                  <p className={styles.emptyText}>正在加载文件库...</p>
                </div>
              ) : error ? (
                <div className={styles.feedbackState}>
                  <p className={styles.emptyText}>{error}</p>
                </div>
              ) : total === 0 ? (
                <>
                  <div className={styles.emptyTableState}>
                    <p className={styles.emptyText}>{hasActiveFilters ? '没有匹配结果，换个筛选条件试试吧' : '暂无文件内容'}</p>
                  </div>
                  <div className={styles.paginationRow}>
                    <div className={styles.paginationRight}>
                      <div className={styles.paginationSummary}>第 {safeCurrentPage}/{totalPages} 页，共 {total} 条</div>
                      <div className={styles.paginationControls}>
                        <button
                          type="button"
                          className={styles.pageButton}
                          disabled={safeCurrentPage <= 1}
                          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        >
                          上一页
                        </button>
                        {pageNumbers.map((pageNumber, index) =>
                          typeof pageNumber === 'number' ? (
                            <button
                              key={pageNumber}
                              type="button"
                              className={`${styles.pageButton} ${safeCurrentPage === pageNumber ? styles.pageButtonActive : ''}`}
                              onClick={() => setCurrentPage(pageNumber)}
                            >
                              {pageNumber}
                            </button>
                          ) : (
                            <span key={`${pageNumber}-${index}`} className={styles.pageEllipsis}>
                              ...
                            </span>
                          ),
                        )}
                        <button
                          type="button"
                          className={styles.pageButton}
                          disabled={safeCurrentPage >= totalPages}
                          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.tableBody}>
                    {pagedFiles.map((item) => {
                      const menuOpen = openMenuId === item.file_id

                      return (
                        <div key={item.file_id} className={styles.tableRow}>
                          <div
                            className={styles.nameCol}
                            onClick={() => handleFilePreview(item.file_id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.fileIcon}>
                              <span className={styles.fileIconLetter}>{getAvatarLetter(item.file_name)}</span>
                            </div>
                            <div className={styles.fileMeta}>
                              <div className={styles.fileName} title={item.file_name}>{item.file_name}</div>
                            </div>
                          </div>

                          <div className={styles.sourceCol}>
                            <span className={styles.agentName}>{item.agent_name}</span>
                          </div>

                          <div className={styles.typeCol}>
                            <span className={`${styles.typeTag} ${getFileTypeTagClass(item.file_type)}`}>
                              {getFileTypeText(item.file_type)}
                            </span>
                          </div>

                          <div className={styles.timeCol}>{formatDateTime(item.created_at)}</div>

                          <div className={styles.actionCol}>
                            <div ref={menuWrapRef} className={styles.actionWrap} data-action-menu-root="true">
                              <button
                                type="button"
                                className={`${styles.actionButton} ${menuOpen ? styles.actionButtonActive : ''}`}
                                onClick={() => setOpenMenuId((current) => (current === item.file_id ? null : item.file_id))}
                                aria-label="更多操作"
                              >
                                <MoreOutlined />
                              </button>

                              <div className={`${styles.actionMenu} ${menuOpen ? styles.actionMenuOpen : ''}`}>
                                <button
                                  type="button"
                                  className={styles.actionMenuItem}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleViewSession(item)
                                  }}
                                >
                                  <EyeOutlined />
                                  <span>查看对话</span>
                                </button>
                                <button type="button" className={styles.actionMenuItem} onClick={() => handleDownloadFile(item)}>
                                  <DownloadOutlined />
                                  <span>下载</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {Array.from({ length: emptyRows }).map((_, index) => (
                      <div key={`placeholder-${index}`} className={`${styles.tableRow} ${styles.tableRowPlaceholder}`}>
                        <div className={styles.nameCol} />
                        <div className={styles.sourceCol} />
                        <div className={styles.typeCol} />
                        <div className={styles.timeCol} />
                        <div className={styles.actionCol} />
                      </div>
                    ))}
                  </div>

                  <div className={styles.paginationRow}>
                    <div className={styles.paginationRight}>
                      <div className={styles.paginationSummary}>第 {safeCurrentPage}/{totalPages} 页，共 {total} 条</div>
                      <div className={styles.paginationControls}>
                        <button
                          type="button"
                          className={styles.pageButton}
                          disabled={safeCurrentPage <= 1}
                          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        >
                          上一页
                        </button>
                        {pageNumbers.map((pageNumber, index) =>
                          typeof pageNumber === 'number' ? (
                            <button
                              key={pageNumber}
                              type="button"
                              className={`${styles.pageButton} ${safeCurrentPage === pageNumber ? styles.pageButtonActive : ''}`}
                              onClick={() => setCurrentPage(pageNumber)}
                            >
                              {pageNumber}
                            </button>
                          ) : (
                            <span key={`${pageNumber}-${index}`} className={styles.pageEllipsis}>
                              ...
                            </span>
                          ),
                        )}
                        <button
                          type="button"
                          className={styles.pageButton}
                          disabled={safeCurrentPage >= totalPages}
                          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <LibraryFilePreviewModal
        visible={previewVisible}
        fileId={previewFileId}
        baseUrl={config?.baseUrl ?? ''}
        onClose={handlePreviewClose}
      />
    </main>
  )
}
