import { useState, useEffect, useCallback } from 'react'
import { MarkdownContent } from '../chat/markdown-content'
import { API_PATHS, buildAbsoluteApiUrl } from '../../services/apiEndpoints'
import styles from './SkillDetailPanel.module.less'

export type SkillConfigField = {
  key: string
  label: string
  type: string
  required: boolean
  default?: string | number
  options?: { label: string; value: string }[]
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

type SkillDetailPanelProps = {
  visible: boolean
  skillName: string
  source?: string
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

async function fetchRegularSkillDetail(baseUrl: string, userId: string, skillName: string): Promise<SkillDetail> {
  const url = `${buildAbsoluteApiUrl(baseUrl, API_PATHS.regularSkillDetail).replace('{skill_name}', encodeURIComponent(skillName))}?user_id=${userId}`
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

async function fetchClawhubSkillDetail(baseUrl: string, userId: string, slug: string): Promise<SkillDetail> {
  const url = `${buildAbsoluteApiUrl(baseUrl, API_PATHS.clawhubSkillDetail).replace('{slug}', encodeURIComponent(slug))}?user_id=${userId}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`获取技能详情失败: HTTP ${response.status}`)
  }

  const jsonData = await response.json()

  if (!jsonData.success) {
    throw new Error(jsonData.msg || '获取技能详情失败')
  }

  const payload = jsonData.data
  const skill = payload?.skill || {}
  const metaContent = payload?.metaContent || {}

  const skillMd = metaContent.skillMd || ''
  return {
    skill_name: skill.slug || slug,
    chinese_name: skill.displayName || metaContent.displayName || slug,
    description: metaContent.DisplayDescription || skill.summary || '',
    source: 'clawhub',
    skill_type: 'clawhub',
    skill_md: skillMd,
    template: skillMd,
    placeholders: [],
    config_fields: [],
    scripts: null,
    references: null,
    assets: null,
  }
}

export default function SkillDetailPanel({ visible, skillName, source }: SkillDetailPanelProps) {
  const [loading, setLoading] = useState(false)
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSkillDetail = useCallback(async () => {
    if (!skillName) return
    setLoading(true)
    setError(null)
    setSkillDetail(null)

    try {
      const { baseUrl, userId } = await loadApiConfig()
      const detail = source === 'clawhub'
        ? await fetchClawhubSkillDetail(baseUrl, userId, skillName)
        : await fetchRegularSkillDetail(baseUrl, userId, skillName)
      setSkillDetail(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [skillName, source])

  useEffect(() => {
    if (visible && skillName) {
      loadSkillDetail()
    }
  }, [visible, skillName, loadSkillDetail])

  if (!visible) return null

  return (
    <div className={styles.detailPanel}>
      {error && (
        <div className={styles.errorState}>
          <span>{error}</span>
        </div>
      )}

      {skillDetail && !loading && (
        <div className={styles.detailContent}>
          <div className={styles.markdownWrap}>
            <MarkdownContent content={skillDetail.skill_md} isStreaming={false} />
          </div>

          {skillDetail.template && (
            <div className={styles.detailSection}>
              <h4 className={styles.sectionTitle}>使用模板</h4>
              <div className={styles.templateBox}>
                <code>{skillDetail.template}</code>
              </div>
            </div>
          )}

          {skillDetail.config_fields && skillDetail.config_fields.length > 0 && (
            <div className={styles.detailSection}>
              <h4 className={styles.sectionTitle}>配置参数</h4>
              <div className={styles.configFieldsList}>
                {skillDetail.config_fields.map((field) => (
                  <div key={field.key} className={styles.configFieldItem}>
                    <div className={styles.configFieldHeader}>
                      <span className={styles.configFieldKey}>{field.key}</span>
                      <span className={styles.configFieldLabel}>{field.label}</span>
                      {field.required && <span className={styles.configFieldRequired}>必填</span>}
                    </div>
                    <div className={styles.configFieldMeta}>
                      <span className={styles.configFieldType}>类型: {field.type}</span>
                      {field.default !== undefined && field.default !== null && (
                        <span className={styles.configFieldDefault}>默认: {String(field.default)}</span>
                      )}
                    </div>
                    {field.options && field.options.length > 0 && (
                      <div className={styles.configFieldOptions}>
                        {field.options.map((opt) => (
                          <span key={opt.value} className={styles.configFieldOption}>
                            {opt.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
