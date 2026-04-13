import { useState, useEffect, useCallback, useMemo } from 'react'
import { CloseOutlined, SearchOutlined, LoadingOutlined } from '@ant-design/icons'
import { message } from 'antd'
import skillConfigText from '../../../config.yaml?raw'
import {
  fetchCreatedSkills as fetchCreatedSkillsFromApi,
  parseCustomSkillListApiConfig,
} from '../../services/customSkillListService'
import {
  extractSkillItemsFromResponse,
  type SkillApiResponse,
  type SkillItem,
} from '../../services/skillPromptService'
import { type EnabledSkill, type RecommendedSkill } from '../../services/customAgentService'
import styles from './SkillConfigModal.module.less'

type SkillConfigModalProps = {
  visible: boolean
  onCancel: () => void
  onSkillChange: (skills: EnabledSkill[]) => void
  currentSkills: EnabledSkill[]
  recommendedSkills?: RecommendedSkill[] | null
}

type ManageTab = 'added' | 'created' | 'recommended'

type SkillApiConfig = {
  featuredEndpoint: string
  manageEndpoint: string
  addSkillEndpoint: string
  removeSkillEndpointTemplate: string
  userId: string
  userIdParam: string
}

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

function parseSkillApiConfig(rawText: string): SkillApiConfig {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const skillPath = parsedConfig.skill_path
  const managePath = parsedConfig.view_user_skills_path
  const addPath = parsedConfig.add_user_skills_path
  const removePath = parsedConfig.del_user_skills_path
  const userId = parsedConfig.user_id
  const userIdParam = parsedConfig.skill_user_id_param

  if (!baseUrl || !skillPath || !managePath || !addPath || !removePath || !userId || !userIdParam) {
    throw new Error('config.yaml 缺少必要的技能接口配置')
  }

  const managePathWithUser = managePath.includes('{user_id}')
    ? managePath.replace('{user_id}', encodeURIComponent(userId))
    : managePath
  const addPathWithUser = addPath.includes('{user_id}')
    ? addPath.replace('{user_id}', encodeURIComponent(userId))
    : addPath
  const removePathWithUser = removePath.includes('{user_id}')
    ? removePath.replace('{user_id}', encodeURIComponent(userId))
    : removePath

  return {
    featuredEndpoint: buildAbsoluteUrl(baseUrl, skillPath),
    manageEndpoint: buildAbsoluteUrl(baseUrl, managePathWithUser),
    addSkillEndpoint: buildAbsoluteUrl(baseUrl, addPathWithUser),
    removeSkillEndpointTemplate: buildAbsoluteUrl(baseUrl, removePathWithUser),
    userId,
    userIdParam,
  }
}

export default function SkillConfigModal({
  visible,
  onCancel,
  onSkillChange,
  currentSkills,
  recommendedSkills,
}: SkillConfigModalProps) {
  const [manageTab, setManageTab] = useState<ManageTab>('added')
  const [searchQuery, setSearchQuery] = useState('')
  const [addedSkills, setAddedSkills] = useState<SkillItem[]>([])
  const [addedSkillsLoading, setAddedSkillsLoading] = useState(false)
  const [addedSkillsError, setAddedSkillsError] = useState('')
  const [createdSkills, setCreatedSkills] = useState<SkillItem[]>([])
  const [createdSkillsLoading, setCreatedSkillsLoading] = useState(false)
  const [createdSkillsError, setCreatedSkillsError] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const skillApiConfig = useMemo(() => {
    try {
      return parseSkillApiConfig(skillConfigText)
    } catch {
      return null
    }
  }, [])

  const customSkillListApiConfig = useMemo(() => {
    try {
      return parseCustomSkillListApiConfig(skillConfigText)
    } catch {
      return null
    }
  }, [])

  const fetchAddedSkills = useCallback(
    async (signal?: AbortSignal) => {
      if (!skillApiConfig) {
        setAddedSkills([])
        setAddedSkillsError('技能配置读取失败')
        setAddedSkillsLoading(false)
        return
      }

      setAddedSkillsLoading(true)
      setAddedSkillsError('')

      try {
        const requestUrl = new URL(skillApiConfig.manageEndpoint)
        requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)

        const response = await fetch(requestUrl.toString(), { signal })

        if (!response.ok) {
          throw new Error('技能接口请求失败')
        }

        const data = (await response.json()) as SkillApiResponse

        if (!data.success) {
          throw new Error(data.msg || '技能接口返回失败')
        }

        const nextSkills = extractSkillItemsFromResponse(data)
        setAddedSkills(nextSkills)
        setAddedSkillsError('')
      } catch {
        if (signal?.aborted) return
        setAddedSkills([])
        setAddedSkillsError('技能加载失败')
      } finally {
        if (!signal?.aborted) {
          setAddedSkillsLoading(false)
        }
      }
    },
    [skillApiConfig],
  )

  const fetchCreatedSkills = useCallback(
    async (signal?: AbortSignal) => {
      if (!customSkillListApiConfig) {
        setCreatedSkills([])
        setCreatedSkillsError('技能配置读取失败')
        setCreatedSkillsLoading(false)
        return
      }

      setCreatedSkillsLoading(true)
      setCreatedSkillsError('')

      try {
        const nextSkills = await fetchCreatedSkillsFromApi(customSkillListApiConfig, signal)
        setCreatedSkills(nextSkills)
        setCreatedSkillsError('')
      } catch {
        if (signal?.aborted) return
        setCreatedSkills([])
        setCreatedSkillsError('技能加载失败')
      } finally {
        if (!signal?.aborted) {
          setCreatedSkillsLoading(false)
        }
      }
    },
    [customSkillListApiConfig],
  )

  useEffect(() => {
    if (!visible) return

    const controller = new AbortController()
    void fetchAddedSkills(controller.signal)

    return () => {
      controller.abort()
    }
  }, [visible, fetchAddedSkills])

  useEffect(() => {
    if (!visible || manageTab !== 'created') return

    const controller = new AbortController()
    void fetchCreatedSkills(controller.signal)

    return () => {
      controller.abort()
    }
  }, [visible, manageTab, fetchCreatedSkills])

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  const handleAddSkill = (skill: SkillItem) => {
    const skillName = skill.skillName || skill.id
    if (!skillName) return

    if (currentSkills.some((s) => s.skill_name === skillName)) {
      return
    }

    const newSkill = {
      skill_name: skillName,
      chinese_name: skill.title,
      description: skill.description,
      ...(skill.template ? { template: skill.template } : {}),
    }

    onSkillChange([...currentSkills, newSkill])
    message.success(`已添加技能: ${skill.title}`)
  }

  const handleAddRecommendedSkill = (skill: RecommendedSkill) => {
    if (currentSkills.some((s) => s.skill_name === skill.name)) {
      return
    }

    setActionLoadingId(skill.name)

    const newSkill: EnabledSkill = {
      skill_name: skill.name,
      chinese_name: skill.chinese_name,
      description: skill.description,
      ...(skill.template ? { template: skill.template } : {}),
    }

    onSkillChange([...currentSkills, newSkill])
    message.success(`已添加技能: ${skill.chinese_name}`)
    setActionLoadingId(null)
  }

  const handleRemoveSkill = async (skill: SkillItem) => {
    if (!skillApiConfig || actionLoadingId) return

    const skillName = skill.skillName || skill.id
    if (!skillName) return

    setActionLoadingId(skill.id)

    try {
      const deleteEndpoint = skillApiConfig.removeSkillEndpointTemplate.includes('{skill_name}')
        ? skillApiConfig.removeSkillEndpointTemplate.replace('{skill_name}', encodeURIComponent(skillName))
        : skillApiConfig.removeSkillEndpointTemplate
      const requestUrl = new URL(deleteEndpoint)
      requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)
      requestUrl.searchParams.set('skill_name', skillName)

      const response = await fetch(requestUrl.toString(), { method: 'DELETE' })

      if (!response.ok) {
        throw new Error('移除技能失败')
      }

      const responseText = await response.text()
      if (responseText) {
        const data = JSON.parse(responseText) as SkillApiResponse
        if (!data.success) {
          throw new Error(data.msg || '移除技能失败')
        }
      }

      message.success(`已移除技能: ${skill.title}`)
      await fetchAddedSkills()
      onSkillChange(currentSkills.filter((s) => s.skill_name !== skillName))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '移除技能失败')
    } finally {
      setActionLoadingId(null)
    }
  }

  const sourceSkills = manageTab === 'created' ? createdSkills : manageTab === 'recommended' ? [] : addedSkills

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return sourceSkills
    const query = searchQuery.toLowerCase()
    return sourceSkills.filter(
      (skill) =>
        skill.title.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.skillName.toLowerCase().includes(query),
    )
  }, [sourceSkills, searchQuery])

  const isLoading = manageTab === 'created' ? createdSkillsLoading : manageTab === 'recommended' ? false : addedSkillsLoading
  const errorText = manageTab === 'created' ? createdSkillsError : manageTab === 'recommended' ? '' : addedSkillsError

  const isSkillAdded = (skill: SkillItem) => {
    const skillName = skill.skillName || skill.id
    return currentSkills.some((s) => s.skill_name === skillName)
  }

  if (!visible) return null

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>服务管理</h3>
          <button className={styles.closeButton} onClick={onCancel}>
            <CloseOutlined />
          </button>
        </div>

        <div className={styles.modalToolbar}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${manageTab === 'added' ? styles.tabActive : ''}`}
              onClick={() => setManageTab('added')}
            >
              我添加的
            </button>
            <button
              type="button"
              className={`${styles.tab} ${manageTab === 'created' ? styles.tabActive : ''}`}
              onClick={() => setManageTab('created')}
            >
              我创建的
            </button>
            <button
              type="button"
              className={`${styles.tab} ${manageTab === 'recommended' ? styles.tabActive : ''}`}
              onClick={() => setManageTab('recommended')}
            >
              技能推荐
            </button>
          </div>
          <label className={styles.searchBox}>
            <SearchOutlined className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="搜索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.modalBody}>
          {manageTab === 'recommended' ? (
            recommendedSkills === null || recommendedSkills === undefined ? (
              <div className={styles.loadingState}>
                <LoadingOutlined style={{ marginRight: 8, fontSize: 16 }} spin />
                技能推荐中...
              </div>
            ) : recommendedSkills.length > 0 ? (
              <div className={styles.skillList}>
                {recommendedSkills.map((skill) => {
                  const added = currentSkills.some((s) => s.skill_name === skill.name)
                  const loading = actionLoadingId === skill.name
                  return (
                    <div key={skill.name} className={styles.skillItem}>
                      <div className={styles.skillIcon}>
                        <span className={styles.skillIconInner} />
                      </div>
                      <div className={styles.skillInfo}>
                        <div className={styles.skillNameRow}>
                          <span className={styles.skillTitle}>{skill.chinese_name}</span>
                          <span className={styles.skillBadge}>推荐</span>
                        </div>
                        <p className={styles.skillDesc}>{skill.description}</p>
                      </div>
                      <div className={styles.skillAction}>
                        {added ? (
                          <button
                            type="button"
                            className={`${styles.actionButton} ${styles.actionButtonAdded}`}
                            disabled
                          >
                            已添加
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => handleAddRecommendedSkill(skill)}
                            disabled={loading}
                          >
                            {loading ? '添加中...' : '添加'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>暂无推荐技能</div>
            )
          ) : isLoading ? (
            <div className={styles.loadingState}>加载中...</div>
          ) : errorText ? (
            <div className={styles.errorState}>{errorText}</div>
          ) : filteredSkills.length > 0 ? (
            <div className={styles.skillList}>
              {filteredSkills.map((skill) => {
                const added = isSkillAdded(skill)
                const loading = actionLoadingId === skill.id

                return (
                  <div key={skill.id} className={styles.skillItem}>
                    <div className={styles.skillIcon}>
                      <span className={styles.skillIconInner} />
                    </div>
                    <div className={styles.skillInfo}>
                      <div className={styles.skillNameRow}>
                        <span className={styles.skillTitle}>{skill.title}</span>
                        <span className={styles.skillBadge}>官方</span>
                      </div>
                      <p className={styles.skillDesc}>{skill.description}</p>
                    </div>
                    <div className={styles.skillAction}>
                      {added ? (
                        <button
                          type="button"
                          className={`${styles.actionButton} ${styles.actionButtonAdded}`}
                          disabled
                        >
                          已添加
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => handleAddSkill(skill)}
                          disabled={loading}
                        >
                          {loading ? '添加中...' : '添加'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              {manageTab === 'created' ? '还没有创建任何技能' : '还没有添加任何技能'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
