import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircleFilled,
  EllipsisOutlined,
  PlusOutlined,
  SearchOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import skillConfigText from '../../../config.yaml?raw'
import { getUrlUserId } from '../../utils/urlParams'
import {
  deleteCreatedSkill as deleteCreatedSkillFromApi,
  fetchCreatedSkills as fetchCreatedSkillsFromApi,
  parseCustomSkillListApiConfig,
} from '../../services/customSkillListService'
import {
  extractSkillItemsFromResponse,
  type SkillApiResponse,
  type SkillItem as SkillApiItem,
} from '../../services/skillPromptService'
import styles from './PartnerSkillManagement.module.less'

type ManageTab = 'added' | 'created'

type SkillApiConfig = {
  featuredEndpoint: string
  manageEndpoint: string
  addSkillEndpoint: string
  removeSkillEndpointTemplate: string
  userId: string
  userIdParam: string
}

type ManageSkillCard = {
  id: string
  skillName: string
  title: string
  description: string
  template: string
  toneClassName: 'manageCardGreen' | 'manageCardAmber'
  icon: React.ReactNode
}

// 定义组件props
interface PartnerSkillManagementProps {
  onUseSkill?: (skill: {
    id: string
    skillName: string
    title: string
    description: string
    template: string
  }) => void
  onAddSkill?: () => void
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
  const userIdParam = parsedConfig.skill_user_id_param
  const urlUserId = getUrlUserId()
  const userId = urlUserId || parsedConfig.user_id

  if (!baseUrl || !skillPath || !managePath || !addPath || !removePath || !userId || !userIdParam) {
    throw new Error('config.yaml 缺少 url、skill_path、view_user_skills_path、add_user_skills_path、del_user_skills_path、user_id 或 skill_user_id_param 配置')
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

function getManageCardPresentation(index: number) {
  if (index % 3 === 0) {
    return {
      toneClassName: 'manageCardGreen' as const,
      icon: <CheckCircleFilled />,
    }
  }

  if (index % 3 === 1) {
    return {
      toneClassName: 'manageCardAmber' as const,
      icon: <ShareAltOutlined />,
    }
  }

  return {
    toneClassName: 'manageCardGreen' as const,
    icon: <ThunderboltOutlined />,
  }
}

export default function PartnerSkillManagement({ onUseSkill, onAddSkill }: PartnerSkillManagementProps) {
  const [manageTab, setManageTab] = useState<ManageTab>('added')
  const [searchQuery, setSearchQuery] = useState('')
  const [addedSkills, setAddedSkills] = useState<SkillApiItem[]>([])
  const [addedSkillsLoading, setAddedSkillsLoading] = useState(false)
  const [addedSkillsError, setAddedSkillsError] = useState('')
  const [createdSkills, setCreatedSkills] = useState<SkillApiItem[]>([])
  const [createdSkillsLoading, setCreatedSkillsLoading] = useState(false)
  const [createdSkillsError, setCreatedSkillsError] = useState('')
  const [removeSkillLoadingId, setRemoveSkillLoadingId] = useState<string | null>(null)
  const [openManageMenuId, setOpenManageMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

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

  // 点击外部关闭菜单
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-manage-menu-root="true"]')) {
        setOpenManageMenuId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const fetchAddedSkills = useCallback(
    async (signal?: AbortSignal) => {
      if (!skillApiConfig) {
        setAddedSkills([])
        setAddedSkillsError('技能配置读取失败，请检查 config.yaml')
        setAddedSkillsLoading(false)
        return [] as SkillApiItem[]
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
        return nextSkills
      } catch {
        if (signal?.aborted) {
          return [] as SkillApiItem[]
        }
        setAddedSkills([])
        setAddedSkillsError('技能加载失败，请检查接口配置或服务状态')
        return [] as SkillApiItem[]
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
        setCreatedSkillsError('技能配置读取失败，请检查 config.yaml')
        setCreatedSkillsLoading(false)
        return [] as SkillApiItem[]
      }

      setCreatedSkillsLoading(true)
      setCreatedSkillsError('')

      try {
        const nextSkills = await fetchCreatedSkillsFromApi(customSkillListApiConfig, signal)
        setCreatedSkills(nextSkills)
        setCreatedSkillsError('')
        return nextSkills
      } catch {
        if (signal?.aborted) {
          return [] as SkillApiItem[]
        }
        setCreatedSkills([])
        setCreatedSkillsError('技能加载失败，请检查接口配置或服务状态')
        return [] as SkillApiItem[]
      } finally {
        if (!signal?.aborted) {
          setCreatedSkillsLoading(false)
        }
      }
    },
    [customSkillListApiConfig],
  )

  // 初始加载
  useEffect(() => {
    const controller = new AbortController()
    void fetchAddedSkills(controller.signal)
    return () => {
      controller.abort()
    }
  }, [fetchAddedSkills])

  // 切换标签时加载数据
  useEffect(() => {
    if (manageTab !== 'created') {
      return
    }

    const controller = new AbortController()
    void fetchCreatedSkills(controller.signal)
    return () => {
      controller.abort()
    }
  }, [fetchCreatedSkills, manageTab])

  const handleAddSkill = () => {
    if (onAddSkill) {
      onAddSkill()
    }
  }

  const handleUseSkill = (skill: ManageSkillCard) => {
    if (onUseSkill) {
      onUseSkill({
        id: skill.id,
        skillName: skill.skillName,
        title: skill.title,
        description: skill.description,
        template: skill.template,
      })
    }
  }

  const handleShareSkill = async (skill: ManageSkillCard) => {
    setOpenManageMenuId(null)
    try {
      await navigator.clipboard.writeText(`${skill.title}\n${skill.description}`)
    } catch {
      // 分享文案复制失败时，不额外打断页面交互
    }
  }

  const handleRemoveSkill = async (skill: ManageSkillCard) => {
    if (!skillApiConfig || removeSkillLoadingId === skill.id) {
      return
    }

    const currentSkillName = skill.skillName || skill.id
    if (!currentSkillName) {
      return
    }

    setRemoveSkillLoadingId(skill.id)
    setOpenManageMenuId(null)

    try {
      const deleteEndpoint = skillApiConfig.removeSkillEndpointTemplate.includes('{skill_name}')
        ? skillApiConfig.removeSkillEndpointTemplate.replace('{skill_name}', encodeURIComponent(currentSkillName))
        : skillApiConfig.removeSkillEndpointTemplate
      const requestUrl = new URL(deleteEndpoint)

      requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)
      requestUrl.searchParams.set('skill_name', currentSkillName)

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

      await fetchAddedSkills()
    } catch {
      setAddedSkillsError('移除技能失败，请稍后重试')
    } finally {
      setRemoveSkillLoadingId(null)
    }
  }

  const handleDeleteCreatedSkill = async (skill: ManageSkillCard) => {
    if (!customSkillListApiConfig || removeSkillLoadingId === skill.id) {
      return
    }

    const currentSkillName = skill.skillName || skill.id
    if (!currentSkillName) {
      return
    }

    setRemoveSkillLoadingId(skill.id)
    setOpenManageMenuId(null)

    try {
      await deleteCreatedSkillFromApi(customSkillListApiConfig, currentSkillName)
      await fetchCreatedSkills()
    } catch {
      // 删除失败时给用户即时反馈
    } finally {
      setRemoveSkillLoadingId(null)
    }
  }

  const manageList = useMemo<ManageSkillCard[]>(() => {
    const sourceSkills = manageTab === 'created' ? createdSkills : addedSkills

    // 根据搜索关键词过滤
    let filteredSkills = sourceSkills
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filteredSkills = sourceSkills.filter(
        (skill) =>
          skill.title.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query) ||
          skill.skillName.toLowerCase().includes(query),
      )
    }

    return filteredSkills.map((item, index) => {
      const presentation = getManageCardPresentation(index)

      return {
        id: item.id,
        skillName: item.skillName,
        title: item.title,
        description: item.description,
        template: item.template,
        toneClassName: presentation.toneClassName,
        icon: presentation.icon,
      }
    })
  }, [addedSkills, createdSkills, manageTab, searchQuery])

  const manageLoading = manageTab === 'created' ? createdSkillsLoading : addedSkillsLoading

  const manageEmptyText = useMemo(() => {
    if (manageTab === 'created') {
      return createdSkillsError || '还没有创建任何技能'
    }
    if (addedSkillsError) {
      return addedSkillsError
    }
    return '还没有添加任何技能'
  }, [addedSkillsError, createdSkillsError, manageTab])

  return (
    <div className={styles.container}>
      {/* 头部区域 */}
      <div className={styles.header}>
        <h2 className={styles.title}>技能管理</h2>
        <div className={styles.headerActions}>
          <label className={styles.searchBox}>
            <SearchOutlined className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="搜索技能"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <button type="button" className={styles.addButton} onClick={handleAddSkill}>
            <PlusOutlined />
            <span>添加</span>
          </button>
        </div>
      </div>

      {/* 标签切换 */}
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
      </div>

      {/* 技能列表 */}
      {manageLoading ? (
        <div className={styles.status}>技能加载中...</div>
      ) : manageList.length > 0 ? (
        <div className={styles.grid}>
          {manageList.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={`${styles.cardIcon} ${styles[item.toneClassName]}`}>{item.icon}</span>
                <div className={styles.menuRoot} data-manage-menu-root="true">
                  <button
                    type="button"
                    className={styles.moreButton}
                    aria-label="更多操作"
                    aria-expanded={openManageMenuId === item.id}
                    onClick={() => setOpenManageMenuId((previous) => (previous === item.id ? null : item.id))}
                    disabled={removeSkillLoadingId === item.id}
                  >
                    <EllipsisOutlined />
                  </button>
                  {openManageMenuId === item.id ? (
                    <div className={styles.cardMenu} ref={menuRef}>
                      {manageTab === 'added' ? (
                        <>
                          <button type="button" className={styles.cardMenuItem} onClick={() => handleShareSkill(item)}>
                            分享
                          </button>
                          <button
                            type="button"
                            className={`${styles.cardMenuItem} ${styles.cardMenuItemDanger}`}
                            onClick={() => handleRemoveSkill(item)}
                            disabled={removeSkillLoadingId === item.id}
                          >
                            {removeSkillLoadingId === item.id ? '移除中...' : '移除'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.cardMenuItem} ${styles.cardMenuItemDanger}`}
                          onClick={() => handleDeleteCreatedSkill(item)}
                          disabled={removeSkillLoadingId === item.id}
                        >
                          {removeSkillLoadingId === item.id ? '删除中...' : '删除'}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={styles.cardTitleRow}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
              </div>
              <p className={styles.cardDesc}>{item.description}</p>
              <button type="button" className={styles.useButton} onClick={() => handleUseSkill(item)}>
                立即使用
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.balloonWrap}>
            <span className={styles.balloonHalo} />
            <span className={styles.balloonMain} />
            <span className={styles.balloonString} />
          </div>
          <p className={styles.emptyText}>{manageEmptyText}</p>
        </div>
      )}
    </div>
  )
}
