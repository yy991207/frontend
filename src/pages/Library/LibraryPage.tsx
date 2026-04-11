import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckOutlined,
  CloseCircleFilled,
  DownOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileMarkdownOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileUnknownOutlined,
  FileWordOutlined,
  LoadingOutlined,
  MenuOutlined,
  MoreOutlined,
  PictureOutlined,
  SearchOutlined,
  VideoCameraOutlined,
  AudioOutlined,
} from '@ant-design/icons'
import styles from './library.module.less'

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
  agentId: string
  keyword: string
}

const LIBRARY_PATH = '/api/v1/files/library'
const PAGE_SIZE = 8
const TAB_ITEMS = [{ key: 'products', label: '全部产物' }]

const FILE_TYPE_OPTIONS: FilterOption[] = [
  { key: 'all', label: '全部', icon: <MenuOutlined /> },
  { key: 'document', label: '文档', icon: <FileTextOutlined /> },
  { key: 'image', label: '图片', icon: <PictureOutlined /> },
  { key: 'video', label: '视频', icon: <VideoCameraOutlined /> },
  { key: 'audio', label: '音频', icon: <AudioOutlined /> },
  { key: 'other', label: '其他文件', icon: <FileUnknownOutlined /> },
]

const AGENT_TYPE_OPTIONS = [
  { value: 'all', label: '全部智能体' },
  { value: 'personal', label: '个人智能体' },
  { value: 'general', label: '通用智能体' },
  { value: 'custom', label: '自定义智能体' },
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
  const response = await fetch('/config.yaml')

  if (!response.ok) {
    throw new Error('加载配置文件失败')
  }

  const rawText = await response.text()
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const userId = parsedConfig.user_id

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
  if (!value || value === 'all') {
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
  const agentId = query.agentId.trim()

  if (agentType) {
    requestUrl.searchParams.set('agent_type', agentType)
  }

  if (fileType) {
    requestUrl.searchParams.set('file_type', fileType)
  }

  if (keyword) {
    requestUrl.searchParams.set('keyword', keyword)
  }

  if (agentId) {
    requestUrl.searchParams.set('agent_id', agentId)
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

  return (await response.json()) as LibraryResponse
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

function inferFileExtension(fileName: string) {
  const matched = fileName.match(/\.([a-zA-Z0-9]+)$/)
  return matched?.[1]?.toLowerCase() ?? ''
}

function getFileBadge(extension: string) {
  const upper = extension.toUpperCase()
  if (!upper) return '文件'
  if (upper.length <= 4) return upper
  return upper.slice(0, 4)
}

function getFileIcon(item: LibraryFileItem) {
  const extension = inferFileExtension(item.file_name)

  if (item.file_type === 'image') {
    return { icon: <FileImageOutlined />, accent: styles.iconImage, badge: 'IMG' }
  }

  if (item.file_type === 'video') {
    return { icon: <VideoCameraOutlined />, accent: styles.iconVideo, badge: 'VID' }
  }

  if (item.file_type === 'audio') {
    return { icon: <AudioOutlined />, accent: styles.iconAudio, badge: 'AUD' }
  }

  if (extension === 'doc' || extension === 'docx') {
    return { icon: <FileWordOutlined />, accent: styles.iconWord, badge: 'DOC' }
  }

  if (extension === 'md') {
    return { icon: <FileMarkdownOutlined />, accent: styles.iconMarkdown, badge: 'MD' }
  }

  if (extension === 'pdf') {
    return { icon: <FilePdfOutlined />, accent: styles.iconPdf, badge: 'PDF' }
  }

  if (item.file_type === 'document') {
    return { icon: <FileTextOutlined />, accent: styles.iconDocument, badge: getFileBadge(extension) }
  }

  return { icon: <FileOutlined />, accent: styles.iconOther, badge: getFileBadge(extension) }
}

function getAvatarLetter(name: string) {
  return name.trim().charAt(0) || '库'
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
  const [activeTab] = useState('products')
  const [activeFilter, setActiveFilter] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [agentType, setAgentType] = useState('all')
  const [agentId, setAgentId] = useState('')
  const [files, setFiles] = useState<LibraryFileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const filterWrapRef = useRef<HTMLDivElement | null>(null)
  const menuWrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!filterWrapRef.current?.contains(event.target as Node)) {
        setFilterOpen(false)
      }

      if (!menuWrapRef.current?.contains(event.target as Node)) {
        setOpenMenuId(null)
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
      agentType,
      fileType: activeFilter,
      agentId,
      keyword,
    }

    async function loadFiles() {
      setLoading(true)
      setError('')

      try {
        const config = await loadLibraryConfig()
        const response = await fetchLibraryFiles(config, queryState, controller.signal)
        setFiles(response.files ?? [])
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return
        }
        setFiles([])
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
  }, [activeFilter, agentId, agentType, keyword])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeFilter, keyword, agentType, agentId])

  const selectedFilter = FILE_TYPE_OPTIONS.find((item) => item.key === activeFilter) ?? FILE_TYPE_OPTIONS[0]
  const hasKeyword = keyword.trim().length > 0
  const total = files.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageNumbers = buildPageNumbers(safeCurrentPage, totalPages)
  const pagedFiles = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return files.slice(start, start + PAGE_SIZE)
  }, [files, safeCurrentPage])

  const hasActiveFilters = activeFilter !== 'all' || agentType !== 'all' || agentId.trim().length > 0 || hasKeyword

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.libraryPage}>
          <header className={styles.header}>
            <div className={styles.headerMain}>
              <h1 className={styles.title}>库</h1>
              <div className={styles.tabs}>
                {TAB_ITEMS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.tools}>
              <div ref={filterWrapRef} className={styles.filterWrap}>
                <button
                  type="button"
                  className={`${styles.filterButton} ${filterOpen ? styles.filterButtonOpen : ''}`}
                  onClick={() => setFilterOpen((value) => !value)}
                  aria-expanded={filterOpen}
                  aria-haspopup="menu"
                >
                  <span className={styles.filterMain}>
                    <MenuOutlined />
                    <span>{selectedFilter.label}</span>
                  </span>
                  <DownOutlined className={`${styles.filterArrow} ${filterOpen ? styles.filterArrowOpen : ''}`} />
                </button>

                <div className={`${styles.filterMenu} ${filterOpen ? styles.filterMenuOpen : ''}`} role="menu">
                  {FILE_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`${styles.filterOption} ${activeFilter === option.key ? styles.filterOptionActive : ''}`}
                      onClick={() => {
                        setActiveFilter(option.key)
                        setFilterOpen(false)
                      }}
                    >
                      <span className={styles.filterOptionMain}>
                        <span className={styles.filterOptionIcon}>{option.icon}</span>
                        <span>{option.label}</span>
                      </span>
                      {activeFilter === option.key ? <CheckOutlined className={styles.filterOptionCheck} /> : null}
                    </button>
                  ))}
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
          </header>

          <section className={styles.queryBar}>
            <div className={styles.queryItem}>
              <span className={styles.queryLabel}>智能体类型</span>
              <select
                value={agentType}
                onChange={(event) => setAgentType(event.target.value)}
                className={styles.querySelect}
              >
                {AGENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <label className={styles.queryItem}>
              <span className={styles.queryLabel}>智能体 ID</span>
              <input
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                className={styles.queryInput}
                placeholder="可选，仅 custom 类型生效"
              />
            </label>
          </section>

          <div className={styles.content}>
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
              <div className={styles.feedbackState}>
                <p className={styles.emptyText}>{hasActiveFilters ? '没有匹配结果，换个筛选条件试试吧' : '暂无文件内容'}</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <div className={styles.tableHeader}>
                  <span className={styles.nameCol}>名称</span>
                  <span className={styles.sourceCol}>来源</span>
                  <span className={styles.timeCol}>时间</span>
                  <span className={styles.actionCol}>操作</span>
                </div>

                <div className={styles.tableBody}>
                  {pagedFiles.map((item) => {
                    const fileMeta = getFileIcon(item)
                    const menuOpen = openMenuId === item.file_id

                    return (
                      <div key={item.file_id} className={styles.tableRow}>
                        <div className={styles.nameCol}>
                          <div className={`${styles.fileIcon} ${fileMeta.accent}`}>
                            <span className={styles.fileIconBadge}>{fileMeta.badge}</span>
                            <span className={styles.fileIconGlyph}>{fileMeta.icon}</span>
                          </div>
                          <div className={styles.fileMeta}>
                            <div className={styles.fileName} title={item.file_name}>{item.file_name}</div>
                          </div>
                        </div>

                        <div className={styles.sourceCol}>
                          <div className={styles.agentInfo}>
                            <span className={styles.agentAvatar}>{getAvatarLetter(item.agent_name)}</span>
                            <span className={styles.agentName}>{item.agent_name}</span>
                          </div>
                        </div>

                        <div className={styles.timeCol}>{formatDateTime(item.created_at)}</div>

                        <div className={styles.actionCol}>
                          <div ref={menuWrapRef} className={styles.actionWrap}>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${menuOpen ? styles.actionButtonActive : ''}`}
                              onClick={() => setOpenMenuId((current) => (current === item.file_id ? null : item.file_id))}
                              aria-label="更多操作"
                            >
                              <MoreOutlined />
                            </button>

                            <div className={`${styles.actionMenu} ${menuOpen ? styles.actionMenuOpen : ''}`}>
                              <button type="button" className={styles.actionMenuItem}>
                                <EyeOutlined />
                                <span>查看对话</span>
                              </button>
                              <button type="button" className={styles.actionMenuItem}>
                                <DownloadOutlined />
                                <span>下载</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <footer className={styles.pagination}>
                  <div className={styles.paginationSummary}>
                    第 {safeCurrentPage} / {totalPages} 页，共 {total} 条
                  </div>
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
                </footer>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
