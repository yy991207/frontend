import { useEffect, useRef, useState } from 'react'
import {
  CheckOutlined,
  CloseCircleFilled,
  DownOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FileUnknownOutlined,
  GlobalOutlined,
  MenuOutlined,
  PictureOutlined,
  SearchOutlined,
  SnippetsOutlined,
  TableOutlined,
} from '@ant-design/icons'
import styles from './library.module.less'

const TAB_ITEMS = [
  { key: 'products', label: '全部产物' },
  { key: 'favorites', label: '收藏夹' },
]

const FILTER_OPTIONS = [
  { key: 'all', label: '全部', icon: <MenuOutlined /> },
  { key: 'ppt', label: 'PPT', icon: <FilePptOutlined /> },
  { key: 'doc', label: '云文档', icon: <FileTextOutlined /> },
  { key: 'table', label: '多维表格', icon: <TableOutlined /> },
  { key: 'report', label: '报告', icon: <SnippetsOutlined /> },
  { key: 'web', label: '网页', icon: <GlobalOutlined /> },
  { key: 'image', label: '图片', icon: <PictureOutlined /> },
  { key: 'file', label: '其他文件', icon: <FileUnknownOutlined /> },
]

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState('products')
  const [activeFilter, setActiveFilter] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const filterWrapRef = useRef<HTMLDivElement | null>(null)

  // 下拉菜单点外部自动关闭，避免菜单悬在页面上。
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!filterWrapRef.current?.contains(event.target as Node)) {
        setFilterOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const selectedFilter = FILTER_OPTIONS.find((item) => item.key === activeFilter) ?? FILTER_OPTIONS[0]
  const hasKeyword = keyword.trim().length > 0

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <h1 className={styles.title}>库</h1>
            <div className={styles.tabs}>
              {TAB_ITEMS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ''}`}
                  onClick={() => setActiveTab(tab.key)}
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
                {FILTER_OPTIONS.map((option) => (
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

        <div className={styles.content}>
          {hasKeyword ? (
            <div className={styles.emptyState}>
              <div className={`${styles.illustration} ${styles.searchIllustration}`}>
                <div className={styles.searchHalo} />
                <div className={styles.searchRing} />
                <div className={styles.searchHandle} />
              </div>
              <p className={styles.emptyText}>没有匹配结果，换个关键词试试吧</p>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={`${styles.illustration} ${styles.folderIllustration}`}>
                <div className={styles.folderHalo} />
                <div className={styles.folderBack} />
                <div className={styles.folderTop} />
                <div className={styles.folderFront} />
                <div className={styles.folderLock} />
              </div>
              <p className={styles.emptyText}>暂无内容</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
