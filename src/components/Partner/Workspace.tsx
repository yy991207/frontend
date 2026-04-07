import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  CaretRightOutlined,
  FileOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  EditOutlined,
} from '@ant-design/icons'
import styles from './Workspace.module.less'

// 文件树节点类型
export type FileNodeType = 'folder' | 'file'

export interface FileNode {
  id: string
  name: string
  type: FileNodeType
  content?: string
  children?: FileNode[]
  isOpen?: boolean
}

// 工作空间配置接口（复用个性化配置的接口）
export interface WorkspaceConfig {
  agentName: string
  avatarUrl: string
  files: FileNode[]
}

interface WorkspaceProps {
  config?: WorkspaceConfig
  loading?: boolean
  onUpdateFile?: (fileId: string, content: string) => Promise<void>
}

// 递归查找文件节点
function findFileNode(nodes: FileNode[], fileId: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === fileId) {
      return node
    }
    if (node.children) {
      const found = findFileNode(node.children, fileId)
      if (found) return found
    }
  }
  return null
}

// 递归过滤文件树
function filterFileTree(nodes: FileNode[], keyword: string): FileNode[] {
  return nodes
    .map((node) => {
      if (node.name.toLowerCase().includes(keyword.toLowerCase())) {
        return node
      }
      if (node.children) {
        const filteredChildren = filterFileTree(node.children, keyword)
        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren, isOpen: true }
        }
      }
      return null
    })
    .filter((node): node is FileNode => node !== null)
}

// 递归渲染文件树节点
interface TreeNodeProps {
  node: FileNode
  level: number
  selectedFileId: string | null
  onSelect: (node: FileNode) => void
  onToggle: (nodeId: string) => void
}

function TreeNode({ node, level, selectedFileId, onSelect, onToggle }: TreeNodeProps) {
  const isSelected = selectedFileId === node.id
  const hasChildren = node.children && node.children.length > 0
  const isOpen = node.isOpen ?? false

  const handleClick = () => {
    if (node.type === 'folder' && hasChildren) {
      onToggle(node.id)
    } else if (node.type === 'file') {
      onSelect(node)
    }
  }

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      onToggle(node.id)
    }
  }

  return (
    <div>
      <div
        className={`${styles.treeNode} ${isSelected ? styles.treeNodeActive : ''}`}
        style={{ paddingLeft: `${16 + level * 16}px` }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        {hasChildren ? (
          <span
            className={`${styles.treeNodeExpandIcon} ${isOpen ? styles.treeNodeExpandIconOpen : ''}`}
            onClick={handleExpandClick}
          >
            <CaretRightOutlined />
          </span>
        ) : (
          <span className={styles.treeNodeExpandIcon} style={{ visibility: 'hidden' }}>
            <CaretRightOutlined />
          </span>
        )}
        <span className={`${styles.treeNodeIcon} ${node.type === 'folder' ? styles.treeNodeIconFolder : styles.treeNodeIconFile}`}>
          {node.type === 'folder' ? (
            isOpen ? <FolderOpenOutlined /> : <FolderOutlined />
          ) : (
            <FileOutlined />
          )}
        </span>
        <span className={styles.treeNodeName}>{node.name}</span>
      </div>
      {hasChildren && isOpen && (
        <div className={styles.treeNodeChildren}>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedFileId={selectedFileId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Markdown 渲染组件
function MarkdownContent({ content }: { content: string }) {
  const renderMarkdown = useCallback((text: string) => {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let currentList: string[] = []
    let listType: 'ul' | 'ol' | null = null

    const flushList = () => {
      if (currentList.length === 0) return
      if (listType === 'ul') {
        elements.push(
          <ul key={elements.length}>
            {currentList.map((item, idx) => (
              <li key={idx}>{renderInlineMarkdown(item.replace(/^- /, ''))}</li>
            ))}
          </ul>
        )
      } else if (listType === 'ol') {
        elements.push(
          <ol key={elements.length}>
            {currentList.map((item, idx) => (
              <li key={idx}>{renderInlineMarkdown(item.replace(/^\d+\. /, ''))}</li>
            ))}
          </ol>
        )
      }
      currentList = []
      listType = null
    }

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()

      // 空行
      if (trimmedLine === '') {
        flushList()
        return
      }

      // 标题
      if (trimmedLine.startsWith('# ')) {
        flushList()
        elements.push(<h1 key={index}>{trimmedLine.replace('# ', '')}</h1>)
        return
      }
      if (trimmedLine.startsWith('## ')) {
        flushList()
        elements.push(<h2 key={index}>{trimmedLine.replace('## ', '')}</h2>)
        return
      }
      if (trimmedLine.startsWith('### ')) {
        flushList()
        elements.push(<h3 key={index}>{trimmedLine.replace('### ', '')}</h3>)
        return
      }

      // 无序列表
      if (trimmedLine.startsWith('- ')) {
        if (listType !== 'ul') {
          flushList()
          listType = 'ul'
        }
        currentList.push(trimmedLine)
        return
      }

      // 有序列表
      if (/^\d+\. /.test(trimmedLine)) {
        if (listType !== 'ol') {
          flushList()
          listType = 'ol'
        }
        currentList.push(trimmedLine)
        return
      }

      // 普通段落
      flushList()
      elements.push(<p key={index}>{renderInlineMarkdown(trimmedLine)}</p>)
    })

    flushList()
    return elements
  }, [])

  // 渲染行内 Markdown（加粗、代码等）
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    // 处理加粗 **text**
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return <div className={styles.markdownContent}>{renderMarkdown(content)}</div>
}

export default function Workspace({ config, loading = false, onUpdateFile }: WorkspaceProps) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // 默认展开所有文件夹
  useEffect(() => {
    if (config?.files) {
      const expandAll = (nodes: FileNode[]) => {
        nodes.forEach((node) => {
          if (node.type === 'folder' && node.children && node.children.length > 0) {
            setExpandedNodes((prev) => new Set([...prev, node.id]))
            expandAll(node.children)
          }
        })
      }
      expandAll(config.files)

      // 默认选中第一个文件
      const findFirstFile = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          if (node.type === 'file') return node
          if (node.children) {
            const found = findFirstFile(node.children)
            if (found) return found
          }
        }
        return null
      }
      const firstFile = findFirstFile(config.files)
      if (firstFile && !selectedFileId) {
        setSelectedFileId(firstFile.id)
      }
    }
  }, [config?.files, selectedFileId])

  // 过滤后的文件树
  const filteredFiles = useMemo(() => {
    if (!config?.files) return []
    if (!searchKeyword.trim()) return config.files
    return filterFileTree(config.files, searchKeyword)
  }, [config?.files, searchKeyword])

  // 当前选中的文件
  const selectedFile = useMemo(() => {
    if (!config?.files || !selectedFileId) return null
    return findFileNode(config.files, selectedFileId)
  }, [config?.files, selectedFileId])

  // 切换文件夹展开状态
  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  // 选择文件
  const handleSelect = useCallback((node: FileNode) => {
    setSelectedFileId(node.id)
    setIsEditing(false)
    setEditContent('')
  }, [])

  // 开始编辑
  const handleEdit = useCallback(() => {
    if (selectedFile?.content) {
      setEditContent(selectedFile.content)
      setIsEditing(true)
    }
  }, [selectedFile])

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditContent('')
  }, [])

  // 保存编辑
  const handleSave = useCallback(async () => {
    if (selectedFile && onUpdateFile) {
      await onUpdateFile(selectedFile.id, editContent)
      setIsEditing(false)
    }
  }, [selectedFile, editContent, onUpdateFile])

  // 为文件树添加展开状态
  const filesWithOpenState = useMemo(() => {
    const addOpenState = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => ({
        ...node,
        isOpen: expandedNodes.has(node.id),
        children: node.children ? addOpenState(node.children) : undefined,
      }))
    }
    return addOpenState(filteredFiles)
  }, [filteredFiles, expandedNodes])

  if (loading) {
    return (
      <div className={styles.workspaceContainer}>
        <div className={styles.loadingState}>加载中...</div>
      </div>
    )
  }

  return (
    <div className={styles.workspaceContainer}>
      {/* 左侧文件树 */}
      <div className={styles.fileTreePanel}>
        <div className={styles.fileTreeHeader}>
          <h3 className={styles.fileTreeTitle}>工作空间</h3>
          <div className={styles.searchBox}>
            <SearchOutlined className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="搜索文件"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.fileTreeContent}>
          {filesWithOpenState.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              selectedFileId={selectedFileId}
              onSelect={handleSelect}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>

      {/* 右侧内容区域 */}
      <div className={styles.contentPanel}>
        {selectedFile ? (
          <>
            <div className={styles.contentHeader}>
              <h3 className={styles.contentTitle}>{selectedFile.name}</h3>
              {isEditing ? (
                <div className={styles.editActions}>
                  <button type="button" className={styles.cancelBtn} onClick={handleCancelEdit}>
                    取消
                  </button>
                  <button type="button" className={styles.saveBtn} onClick={handleSave}>
                    保存
                  </button>
                </div>
              ) : (
                <button type="button" className={styles.editButton} onClick={handleEdit}>
                  <EditOutlined />
                  编辑
                </button>
              )}
            </div>
            {isEditing ? (
              <div className={styles.editModeContainer}>
                <textarea
                  className={styles.markdownEditor}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="请输入内容..."
                  autoFocus
                />
              </div>
            ) : (
              <div className={styles.contentBody}>
                <MarkdownContent content={selectedFile.content || ''} />
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>请选择文件查看内容</div>
        )}
      </div>
    </div>
  )
}
