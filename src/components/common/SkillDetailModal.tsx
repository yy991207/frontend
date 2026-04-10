import { useState, useEffect, useCallback, useMemo } from 'react'
import { CloseOutlined, CopyOutlined, ForwardOutlined, LoadingOutlined } from '@ant-design/icons'
import { MarkdownContent } from '../chat/markdown-content'
import styles from './SkillDetailModal.module.less'

export type SkillConfigField = {
  key: string
  label: string
  type: string
  required: boolean
  default?: string | number
  options?: Array<{ label: string; value: string | number }>
  min?: number | null
  max?: number | null
  placeholder?: string | null
}

export type SkillDetail = {
  skill_name: string
  chinese_name: string
  description: string
  source: string
  skill_type: string
  skill_md: string
  template: string
  placeholders: string[]
  config_fields: SkillConfigField[]
  scripts: unknown | null
  references: unknown | null
  assets: unknown | null
}

type SkillDetailModalProps = {
  visible: boolean
  skillName: string
  onCancel: () => void
}

type ParsedSkillDoc = {
  intro: string[]
  triggers: string[]
  workflow: string[]
  notes: string[]
}

async function loadApiConfig(): Promise<{ baseUrl: string; userId: string }> {
  const response = await fetch('/config.yaml')
  if (!response.ok) {
    throw new Error('加载配置文件失败')
  }
  const rawText = await response.text()
  const parsed: Record<string, string> = {}
  rawText.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf(':')
    if (idx === -1) return
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key) parsed[key] = value
  })
  return {
    baseUrl: parsed.url || '',
    userId: parsed.user_id || '',
  }
}

async function fetchSkillDetail(baseUrl: string, userId: string, skillName: string): Promise<SkillDetail> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/skills/${skillName}?user_id=${userId}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`获取技能详情失败: HTTP ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.msg || '获取技能详情失败')
  }

  return data.data as SkillDetail
}

function normalizeSkillDetail(detail: SkillDetail, skillName: string): SkillDetail {
  return {
    ...detail,
    skill_name: detail.skill_name || skillName,
    chinese_name: detail.chinese_name || skillName,
    description: detail.description || '',
    source: detail.source || 'custom_agent',
    skill_type: detail.skill_type || 'custom_agent',
    skill_md: detail.skill_md || '',
    template: detail.template || '',
    placeholders: Array.isArray(detail.placeholders) ? detail.placeholders : [],
    config_fields: Array.isArray(detail.config_fields) ? detail.config_fields : [],
  }
}

function getSkillBadgeLetter(detail: SkillDetail | null, skillName: string) {
  const title = detail?.chinese_name || detail?.skill_name || skillName
  return title?.trim().charAt(0).toUpperCase() || 'S'
}

function getMetaSummary(detail: SkillDetail) {
  return [
    { label: '技能标识', value: detail.skill_name || '-' },
    { label: '来源', value: detail.source || 'custom_agent' },
    { label: '技能类型', value: detail.skill_type || 'custom_agent' },
    { label: '参数数量', value: String(detail.config_fields.length) },
  ]
}

function buildSceneCards(detail: SkillDetail) {
  const descriptionParts = detail.description
    .split(/[。；]/)
    .map((item) => item.trim())
    .filter(Boolean)

  const cards = [
    {
      title: '适用场景',
      description: descriptionParts[0] || '适用于技能首页、管理技能以及需要快速了解技能能力的场景。',
    },
    {
      title: '触发方式',
      description: descriptionParts[1] || '当用户点击技能卡片查看详情，或希望确认技能适用范围时展示。',
    },
    {
      title: '结果预期',
      description: descriptionParts[2] || '帮助用户快速理解技能能力边界、入参结构和推荐使用方式。',
    },
  ]

  return cards
}

function parseSkillMarkdown(markdown: string): ParsedSkillDoc {
  const result: ParsedSkillDoc = {
    intro: [],
    triggers: [],
    workflow: [],
    notes: [],
  }

  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let currentSection: keyof ParsedSkillDoc = 'intro'

  lines.forEach((line) => {
    const normalized = line.replace(/^#+\s*/, '')

    if (/^(技能说明|AI 绘图|AI 信息图|AI 编程|AI 写作|课程探索)/.test(normalized)) {
      currentSection = 'intro'
      return
    }

    if (/^(触发条件|使用条件|启用条件)/.test(normalized)) {
      currentSection = 'triggers'
      return
    }

    if (/^(工作流程|处理流程|执行流程)/.test(normalized)) {
      currentSection = 'workflow'
      return
    }

    if (/^(注意事项|说明|补充)/.test(normalized)) {
      currentSection = 'notes'
      return
    }

    const cleaned = line.replace(/^[-*\d.\s]+/, '').trim()
    if (!cleaned) {
      return
    }
    result[currentSection].push(cleaned)
  })

  return result
}

function formatConfigValue(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') {
    return '—'
  }
  return String(value)
}

export default function SkillDetailModal({ visible, skillName, onCancel }: SkillDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [headerCompact, setHeaderCompact] = useState(false)

  const loadSkillDetail = useCallback(async () => {
    if (!skillName) return
    setLoading(true)
    setError(null)
    setSkillDetail(null)

    try {
      const { baseUrl, userId } = await loadApiConfig()
      const detail = await fetchSkillDetail(baseUrl, userId, skillName)
      setSkillDetail(normalizeSkillDetail(detail, skillName))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [skillName])

  useEffect(() => {
    if (visible && skillName) {
      void loadSkillDetail()
    }
  }, [visible, skillName, loadSkillDetail])

  useEffect(() => {
    if (!visible) {
      setHeaderCompact(false)
    }
  }, [visible])

  const parsedDoc = useMemo(() => parseSkillMarkdown(skillDetail?.skill_md || ''), [skillDetail?.skill_md])
  const sceneCards = useMemo(() => (skillDetail ? buildSceneCards(skillDetail) : []), [skillDetail])
  const metaSummary = useMemo(() => (skillDetail ? getMetaSummary(skillDetail) : []), [skillDetail])

  if (!visible) return null

  const displayName = skillDetail?.chinese_name || skillName
  const displayDescription = skillDetail?.description || '该技能用于完成特定任务，并按照技能配置要求生成结果。'

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalContainer} onClick={(event) => event.stopPropagation()}>
        <div className={`${styles.stickyHeader} ${headerCompact ? styles.stickyHeaderCompact : ''}`}>
          <div className={styles.headerCenterTitle}>
            <h3 className={styles.headerTitle}>{displayName}</h3>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.secondaryAction} onClick={() => navigator.clipboard.writeText(displayName).catch(() => undefined)}>
              <ForwardOutlined />
              <span>分享</span>
            </button>
            <button type="button" className={styles.primaryAction}>
              使用
            </button>
            <button type="button" className={styles.modalCloseBtn} onClick={onCancel} aria-label="关闭技能详情弹窗">
              <CloseOutlined />
            </button>
          </div>
        </div>

        <div
          className={styles.modalBody}
          onScroll={(event) => setHeaderCompact(event.currentTarget.scrollTop > 48)}
        >
          {loading ? (
            <div className={styles.loadingState}>
              <LoadingOutlined spin style={{ fontSize: 24, color: '#245bdb' }} />
              <span>加载中...</span>
            </div>
          ) : null}

          {error ? (
            <div className={styles.errorState}>
              <span>{error}</span>
            </div>
          ) : null}

          {skillDetail && !loading ? (
            <div className={styles.detailContent}>
              <section className={styles.heroSection}>
                <div className={styles.heroMain}>
                  <div className={styles.modalIcon}>
                    <span className={styles.modalIconText}>{getSkillBadgeLetter(skillDetail, skillName)}</span>
                  </div>
                  <div className={styles.heroInfo}>
                    <div className={styles.heroTitleRow}>
                      <h2 className={styles.heroTitle}>{displayName}</h2>
                      <span className={styles.heroTag}>调研</span>
                      <span className={styles.heroTag}>市场洞察</span>
                      <span className={styles.heroTag}>营销</span>
                    </div>
                    <p className={styles.heroDescription}>{displayDescription}</p>
                  </div>
                </div>
              </section>

              <section className={styles.summaryCard}>
                <div className={styles.metaGrid}>
                  {metaSummary.map((item) => (
                    <div key={item.label} className={styles.metaItem}>
                      <div className={styles.metaValue}>{item.value}</div>
                      <div className={styles.metaLabel}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.detailSection}>
                <h4 className={styles.sectionTitle}>技能说明</h4>
                <div className={styles.markdownWrap}>
                  <MarkdownContent content={skillDetail.skill_md || displayDescription} isStreaming={false} />
                </div>
                <div className={styles.contentHint}>
                  内容组织参考 custom_agent 模块的技能说明阅读顺序，但最终布局与视觉层级以 [skill.json](skill.json) 的弹窗结构为准。
                </div>
              </section>

              <section className={styles.detailSection}>
                <h4 className={styles.sectionTitle}>使用场景</h4>
                <div className={styles.sceneGrid}>
                  {sceneCards.map((scene) => (
                    <article key={scene.title} className={styles.sceneCard}>
                      <span className={styles.sceneIcon}>◌</span>
                      <h5 className={styles.sceneTitle}>{scene.title}</h5>
                      <p className={styles.sceneDescription}>{scene.description}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.detailSection}>
                <h4 className={styles.sectionTitle}>示例提示词</h4>
                <div className={styles.exampleList}>
                  {skillDetail.placeholders.length > 0 ? (
                    skillDetail.placeholders.map((placeholder, index) => (
                      <article key={placeholder} className={styles.exampleItem}>
                        <div className={styles.exampleHead}>
                          <span className={styles.exampleTitle}>示例 {index + 1}</span>
                          <CopyOutlined className={styles.exampleCopyIcon} />
                        </div>
                        <p className={styles.exampleText}>{skillDetail.template.replace(`/${placeholder}`, `【${placeholder}】`)}</p>
                      </article>
                    ))
                  ) : (
                    <article className={styles.exampleItem}>
                      <div className={styles.exampleHead}>
                        <span className={styles.exampleTitle}>默认示例</span>
                        <CopyOutlined className={styles.exampleCopyIcon} />
                      </div>
                      <p className={styles.exampleText}>{skillDetail.template || `基于 ${displayName} 帮我完成当前任务`}</p>
                    </article>
                  )}
                </div>
              </section>

              {skillDetail.config_fields.length > 0 ? (
                <section className={styles.detailSection}>
                  <h4 className={styles.sectionTitle}>工具配置（tool_config）</h4>
                  <div className={styles.configTableWrap}>
                    <table className={styles.configTable}>
                      <thead>
                        <tr>
                          <th>参数</th>
                          <th>说明</th>
                          <th>类型</th>
                          <th>默认值</th>
                          <th>示例值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skillDetail.config_fields.map((field) => (
                          <tr key={field.key}>
                            <td>{field.key}</td>
                            <td>{field.label}</td>
                            <td>{field.type}</td>
                            <td>{formatConfigValue(field.default)}</td>
                            <td>
                              {field.options && field.options.length > 0
                                ? field.options
                                    .slice(0, 4)
                                    .map((option) => option.label)
                                    .join('、')
                                : formatConfigValue(field.placeholder)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {(parsedDoc.triggers.length > 0 || parsedDoc.workflow.length > 0 || parsedDoc.notes.length > 0) ? (
                <section className={styles.detailSection}>
                  <h4 className={styles.sectionTitle}>技能补充说明</h4>
                  <div className={styles.noteGrid}>
                    {parsedDoc.triggers.length > 0 ? (
                      <div className={styles.noteBlock}>
                        <h5 className={styles.noteTitle}>触发条件</h5>
                        <ul className={styles.noteList}>
                          {parsedDoc.triggers.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {parsedDoc.workflow.length > 0 ? (
                      <div className={styles.noteBlock}>
                        <h5 className={styles.noteTitle}>工作流程</h5>
                        <ul className={styles.noteList}>
                          {parsedDoc.workflow.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {parsedDoc.notes.length > 0 ? (
                      <div className={styles.noteBlock}>
                        <h5 className={styles.noteTitle}>注意事项</h5>
                        <ul className={styles.noteList}>
                          {parsedDoc.notes.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
