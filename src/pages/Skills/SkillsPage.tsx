import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloseOutlined,
  DownOutlined,
  EllipsisOutlined,
  FileZipOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  ShareAltOutlined,
  StarFilled,
  SwapOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import skillConfigText from '../../../config.yaml?raw'
import homeAvatar from '../../assets/home-avatar.png'
import { fetchCreatedSkills as fetchCreatedSkillsFromApi, parseCustomSkillListApiConfig } from '../../services/customSkillListService'
import { buildSkillInitialPrompt, extractSkillItemsFromResponse, type SkillApiResponse, type SkillItem as SkillApiItem } from '../../services/skillPromptService'
import { parseSkillUploadApiConfig, uploadCustomSkill, type UploadedSkillSummary } from '../../services/skillUploadService'
import styles from './skills.module.less'

type SkillsMode = 'discover' | 'manage'
type ManageTab = 'added' | 'created'
type CreateOptionKey = 'chat' | 'upload'

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

const CREATE_OPTIONS: Array<{
  key: CreateOptionKey
  title: string
  description: string
  icon: React.ReactNode
}> = [
  {
    key: 'chat',
    title: '使用对话创建',
    description: '通过对话构建个人使用的技能',
    icon: <ThunderboltOutlined />,
  },
  {
    key: 'upload',
    title: '上传技能',
    description: '上传 .zip、.skill 或 .md 文件',
    icon: <UploadOutlined />,
  },
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

function buildSkillNameSet(items: SkillApiItem[]) {
  return new Set(items.map((item) => item.skillName || item.id).filter(Boolean))
}

function getFeaturedCardPresentation(index: number) {
  if (index % 3 === 0) {
    return {
      toneClassName: 'skillCardAmber' as const,
      icon: <StarFilled />,
    }
  }

  if (index % 3 === 1) {
    return {
      toneClassName: 'skillCardIndigo' as const,
      icon: <ShareAltOutlined />,
    }
  }

  return {
    toneClassName: 'skillCardGreen' as const,
    icon: <SwapOutlined />,
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

export default function SkillsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialMode = (location.state as { mode?: SkillsMode } | null)?.mode === 'manage' ? 'manage' : 'discover'
  const [mode, setMode] = useState<SkillsMode>(initialMode)
  const [createOpen, setCreateOpen] = useState(false)
  const [manageTab, setManageTab] = useState<ManageTab>('added')
  const [featuredSkills, setFeaturedSkills] = useState<SkillApiItem[]>([])
  const [featuredSkillsLoading, setFeaturedSkillsLoading] = useState(false)
  const [featuredSkillsError, setFeaturedSkillsError] = useState('')
  const [addSkillSuccessMessage, setAddSkillSuccessMessage] = useState('')
  const [skillActionLoadingId, setSkillActionLoadingId] = useState<string | null>(null)
  const [addedSkills, setAddedSkills] = useState<SkillApiItem[]>([])
  const [addedSkillsLoading, setAddedSkillsLoading] = useState(false)
  const [addedSkillsError, setAddedSkillsError] = useState('')
  const [createdSkills, setCreatedSkills] = useState<SkillApiItem[]>([])
  const [createdSkillsLoading, setCreatedSkillsLoading] = useState(false)
  const [createdSkillsError, setCreatedSkillsError] = useState('')
  const [removeSkillLoadingId, setRemoveSkillLoadingId] = useState<string | null>(null)
  const [openManageMenuId, setOpenManageMenuId] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadingSkill, setUploadingSkill] = useState(false)
  const [isUploadDragging, setIsUploadDragging] = useState(false)
  const [uploadNotice, setUploadNotice] = useState('')
  const [uploadedSkillSummary, setUploadedSkillSummary] = useState<UploadedSkillSummary | null>(null)
  const createWrapRef = useRef<HTMLDivElement | null>(null)
  const successToastTimerRef = useRef<number | null>(null)
  const uploadNoticeTimerRef = useRef<number | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const uploadRequestControllerRef = useRef<AbortController | null>(null)
  const skillApiConfig = useMemo(() => {
    try {
      // 接口地址和 userId 统一从 config.yaml 读取，避免页面里写死环境配置。
      return parseSkillApiConfig(skillConfigText)
    } catch {
      return null
    }
  }, [])
  const skillUploadApiConfig = useMemo(() => {
    try {
      // 上传技能单独读 upload_skill_path，避免和列表接口配置混在一起。
      return parseSkillUploadApiConfig(skillConfigText)
    } catch {
      return null
    }
  }, [])
  const customSkillListApiConfig = useMemo(() => {
    try {
      // “我创建的”单独走 list_user_skills_path，和“我添加的”接口隔离开。
      return parseCustomSkillListApiConfig(skillConfigText)
    } catch {
      return null
    }
  }, [])

  // 创建菜单点外部自动关闭，避免弹层停留在页面上。
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!createWrapRef.current?.contains(event.target as Node)) {
        setCreateOpen(false)
      }

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

        const response = await fetch(requestUrl.toString(), {
          signal,
        })

        if (!response.ok) {
          throw new Error('技能接口请求失败')
        }

        const data = (await response.json()) as SkillApiResponse

        if (!data.success) {
          throw new Error(data.msg || '技能接口返回失败')
        }

        const nextSkills = extractSkillItemsFromResponse(data)
        const addedSkillNames = buildSkillNameSet(nextSkills)

        setAddedSkills(nextSkills)
        setFeaturedSkills((previous) =>
          previous.map((item) => ({
            ...item,
            isSelected: addedSkillNames.has(item.skillName || item.id),
          })),
        )
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

  const openManageSkills = useCallback(async () => {
    setMode('manage')
    setManageTab('added')
    await fetchAddedSkills()
  }, [fetchAddedSkills])

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

  const showUploadNotice = useCallback((message: string) => {
    setUploadNotice(message)

    if (uploadNoticeTimerRef.current !== null) {
      window.clearTimeout(uploadNoticeTimerRef.current)
    }

    uploadNoticeTimerRef.current = window.setTimeout(() => {
      setUploadNotice('')
    }, 2600)
  }, [])

  const handleCloseUploadModal = useCallback(() => {
    uploadRequestControllerRef.current?.abort()
    uploadRequestControllerRef.current = null
    setUploadModalOpen(false)
    setUploadingSkill(false)
    setIsUploadDragging(false)
    setUploadedSkillSummary(null)

    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }, [])

  const handleOpenUploadModal = useCallback(() => {
    setCreateOpen(false)
    setUploadModalOpen(true)
    setUploadingSkill(false)
    setIsUploadDragging(false)
    setUploadedSkillSummary(null)

    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }, [])

  const handleUploadSkillFile = useCallback(
    async (file: File) => {
      if (!skillUploadApiConfig) {
        showUploadNotice('技能上传配置读取失败，请检查 config.yaml')
        return
      }

      // 用户可能连续切换文件或直接关闭弹窗，这里先终止旧请求，避免旧响应覆盖新状态。
      uploadRequestControllerRef.current?.abort()
      const controller = new AbortController()
      uploadRequestControllerRef.current = controller

      setUploadingSkill(true)
      setIsUploadDragging(false)
      setUploadedSkillSummary(null)

      try {
        const result = await uploadCustomSkill(skillUploadApiConfig, file, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        if (!result.success) {
          showUploadNotice(result.msg || '技能上传失败，请稍后重试')
          return
        }

        setUploadedSkillSummary(
          result.data ?? {
            skillId: '',
            skillName: file.name.replace(/\.[^.]+$/, ''),
            description: '',
          },
        )
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        showUploadNotice(error instanceof Error ? error.message : '技能上传失败，请稍后重试')
      } finally {
        if (uploadRequestControllerRef.current === controller) {
          uploadRequestControllerRef.current = null
        }

        if (!controller.signal.aborted) {
          setUploadingSkill(false)
        }

        if (uploadInputRef.current) {
          uploadInputRef.current.value = ''
        }
      }
    },
    [showUploadNotice, skillUploadApiConfig],
  )

  const handleCreateOptionClick = useCallback(
    (optionKey: CreateOptionKey) => {
      if (optionKey === 'upload') {
        handleOpenUploadModal()
        return
      }

      setCreateOpen(false)
    },
    [handleOpenUploadModal],
  )

  const handleOpenUploadPicker = useCallback(() => {
    if (!uploadingSkill) {
      uploadInputRef.current?.click()
    }
  }, [uploadingSkill])

  const handleUploadInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]

      if (file) {
        void handleUploadSkillFile(file)
      }
    },
    [handleUploadSkillFile],
  )

  const handleUploadDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsUploadDragging(true)
  }, [])

  const handleUploadDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsUploadDragging(true)
  }, [])

  const handleUploadDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return
    }

    setIsUploadDragging(false)
  }, [])

  const handleUploadDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsUploadDragging(false)

      if (uploadingSkill) {
        return
      }

      const file = event.dataTransfer.files?.[0]

      if (file) {
        void handleUploadSkillFile(file)
      }
    },
    [handleUploadSkillFile, uploadingSkill],
  )

  const handleUploadDropzoneKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleOpenUploadPicker()
      }
    },
    [handleOpenUploadPicker],
  )

  useEffect(() => {
    if (initialMode === 'manage') {
      void openManageSkills()
    }
  }, [initialMode, openManageSkills])

  useEffect(() => {
    return () => {
      if (successToastTimerRef.current !== null) {
        window.clearTimeout(successToastTimerRef.current)
      }

      if (uploadNoticeTimerRef.current !== null) {
        window.clearTimeout(uploadNoticeTimerRef.current)
      }

      uploadRequestControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!skillApiConfig) {
      setFeaturedSkills([])
      setFeaturedSkillsError('技能配置读取失败，请检查 config.yaml')
      setFeaturedSkillsLoading(false)
      return
    }

    const controller = new AbortController()

    const loadFeaturedSkills = async () => {
      setFeaturedSkillsLoading(true)
      setFeaturedSkillsError('')

      try {
        const requestUrl = new URL(skillApiConfig.featuredEndpoint)
        requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)

        const response = await fetch(requestUrl.toString(), {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('技能接口请求失败')
        }

        const data = (await response.json()) as SkillApiResponse

        if (!data.success) {
          throw new Error(data.msg || '技能接口返回失败')
        }

        const featuredItems = extractSkillItemsFromResponse(data)

        let mergedFeaturedItems = featuredItems
        try {
          const manageRequestUrl = new URL(skillApiConfig.manageEndpoint)
          manageRequestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)

          const manageResponse = await fetch(manageRequestUrl.toString(), {
            signal: controller.signal,
          })

          if (manageResponse.ok) {
            const manageData = (await manageResponse.json()) as SkillApiResponse
            if (manageData.success) {
              const addedItems = extractSkillItemsFromResponse(manageData)
              const addedSkillNames = buildSkillNameSet(addedItems)
              mergedFeaturedItems = featuredItems.map((item) => ({
                ...item,
                isSelected: item.isSelected || addedSkillNames.has(item.skillName || item.id),
              }))
            }
          }
        } catch {
          if (controller.signal.aborted) {
            return
          }
        }

        setFeaturedSkills(mergedFeaturedItems)
        setFeaturedSkillsError('')
      } catch {
        if (controller.signal.aborted) {
          return
        }

        setFeaturedSkills([])
        setFeaturedSkillsError('技能加载失败，请检查接口配置或服务状态')
      } finally {
        if (!controller.signal.aborted) {
          setFeaturedSkillsLoading(false)
        }
      }
    }

    loadFeaturedSkills()

    return () => {
      controller.abort()
    }
  }, [skillApiConfig])

  const handleUseSkill = async (skill: SkillApiItem) => {
    if (skillActionLoadingId === skill.id) {
      return
    }

    if (skill.isSelected) {
      navigate('/', {
        state: {
          initialPrompt: buildSkillInitialPrompt(skill),
          toolType: skill.skillName || skill.id,
          skillName: skill.skillName || skill.id,
          skillDescription: skill.description,
          template: skill.template,
        },
      })
      return
    }

    if (!skillApiConfig) {
      return
    }

    setSkillActionLoadingId(skill.id)

    try {
      const requestUrl = new URL(skillApiConfig.addSkillEndpoint)
      requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)

      const response = await fetch(requestUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skill_name: skill.skillName || skill.id,
        }),
      })

      if (!response.ok) {
        throw new Error('添加技能失败')
      }

      setFeaturedSkills((previous) =>
        previous.map((item) =>
          item.id === skill.id
            ? {
                ...item,
                isSelected: true,
              }
            : item,
        ),
      )

      setAddSkillSuccessMessage('添加成功，快到管理技能中查看吧')
      if (successToastTimerRef.current !== null) {
        window.clearTimeout(successToastTimerRef.current)
      }
      successToastTimerRef.current = window.setTimeout(() => {
        setAddSkillSuccessMessage('')
      }, 2600)

      await fetchAddedSkills()
    } catch {
      // 保持页面轻量交互，失败时不阻断其它操作。
    } finally {
      setSkillActionLoadingId(null)
    }
  }

  useEffect(() => {
    if (mode !== 'manage' || manageTab !== 'added') {
      return
    }

    const controller = new AbortController()

    void fetchAddedSkills(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchAddedSkills, manageTab, mode])

  useEffect(() => {
    if (mode !== 'manage' || manageTab !== 'created') {
      return
    }

    const controller = new AbortController()

    // 只有切到“我创建的”时才请求自定义技能，避免额外接口开销。
    void fetchCreatedSkills(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchCreatedSkills, manageTab, mode])

  const handleShareSkill = async (skill: ManageSkillCard) => {
    setOpenManageMenuId(null)

    try {
      await navigator.clipboard.writeText(`${skill.title}\n${skill.description}`)
    } catch {
      // 分享文案复制失败时，不额外打断页面交互。
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

      const response = await fetch(requestUrl.toString(), {
        method: 'DELETE',
      })

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

  const manageList = useMemo<ManageSkillCard[]>(() => {
    const sourceSkills = manageTab === 'created' ? createdSkills : addedSkills

    return sourceSkills.map((item, index) => {
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
  }, [addedSkills, createdSkills, manageTab])

  const manageLoading = manageTab === 'created' ? createdSkillsLoading : addedSkillsLoading

  const featuredList = useMemo(() => {
    return featuredSkills.map((item, index) => {
      const presentation = getFeaturedCardPresentation(index)

      return {
        id: item.id,
        skillName: item.skillName,
        title: item.title,
        description: item.description,
        template: item.template,
        isSelected: item.isSelected,
        toneClassName: presentation.toneClassName,
        icon: presentation.icon,
        tags: ['果仁数据源'],
        count: '',
      }
    })
  }, [featuredSkills])

  const manageEmptyText = useMemo(() => {
    if (manageTab === 'created') {
      return createdSkillsError || '还没有创建任何技能'
    }

    if (addedSkillsError) {
      return addedSkillsError
    }

    return '还没有添加任何技能'
  }, [addedSkillsError, createdSkillsError, manageTab])

  const handleLaunchSkill = useCallback(
    (skill: Pick<SkillApiItem, 'id' | 'skillName' | 'template' | 'title' | 'description'>) => {
      navigate('/', {
        state: {
          initialPrompt: buildSkillInitialPrompt(skill),
          toolType: skill.skillName || skill.id,
          skillName: skill.skillName || skill.id,
          skillDescription: skill.description,
          template: skill.template,
        },
      })
    },
    [navigate],
  )

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        {mode === 'discover' ? (
          <div className={styles.discoverPage}>
            {addSkillSuccessMessage ? <div className={styles.successToast}>{addSkillSuccessMessage}</div> : null}
            <div className={styles.heroBlock}>
              <div className={styles.heroActions}>
                <div ref={createWrapRef} className={styles.createWrap}>
                  <button
                    type="button"
                    className={styles.createButton}
                    aria-expanded={createOpen}
                    aria-haspopup="menu"
                    onClick={() => setCreateOpen((value) => !value)}
                  >
                    <span className={styles.createButtonMain}>
                      <PlusOutlined />
                      <span>创建</span>
                    </span>
                    <DownOutlined className={`${styles.createArrow} ${createOpen ? styles.createArrowOpen : ''}`} />
                  </button>
                  <div className={`${styles.createMenu} ${createOpen ? styles.createMenuOpen : ''}`} role="menu">
                    {CREATE_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={styles.createMenuItem}
                        onClick={() => handleCreateOptionClick(option.key)}
                      >
                        <span className={styles.createMenuIcon}>{option.icon}</span>
                        <span className={styles.createMenuText}>
                          <span className={styles.createMenuTitle}>{option.title}</span>
                          <span className={styles.createMenuDesc}>{option.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button type="button" className={styles.manageButton} onClick={() => void openManageSkills()}>
                  <SettingOutlined />
                  <span>管理技能</span>
                </button>
              </div>

              <div className={styles.heroHeading}>
                <span className={styles.heroWave}>👋</span>
                <h1 className={styles.heroTitle}>Hi～ 发现并管理你的技能</h1>
              </div>

              <label className={styles.searchBox}>
                <SearchOutlined className={styles.searchIcon} />
                <input className={styles.searchInput} placeholder="搜索技能名称、描述或标签" />
              </label>
            </div>

            <div className={styles.bannerRow}>
              <article className={`${styles.bannerCard} ${styles.bannerCardDark}`}>
                <div className={styles.bannerContent}>
                  <h2 className={styles.bannerTitle}>办公版龙虾🦞 必备技能包</h2>
                  <p className={styles.bannerDesc}>与果仁生态打通，解锁 OpenClaw 办公版龙虾执行力，自动搞定琐碎事务</p>
                  <button type="button" className={styles.bannerLink}>
                    查看技能包
                  </button>
                </div>
                <div className={styles.bannerArtworkDark}>
                  <span className={styles.floatingChip}>26</span>
                  <span className={`${styles.floatingDot} ${styles.dotBlue}`} />
                  <span className={`${styles.floatingDot} ${styles.dotCyan}`} />
                  <div className={styles.lobsterBody} />
                  <div className={styles.lobsterEyeLeft} />
                  <div className={styles.lobsterEyeRight} />
                  <div className={styles.lobsterClaw} />
                </div>
              </article>

              <article className={`${styles.bannerCard} ${styles.bannerCardLight}`}>
                <div className={styles.bannerContent}>
                  <h2 className={styles.bannerTitleLight}>「技能」挑战赛 只等你来！</h2>
                  <p className={styles.bannerDescLight}>参与大赛投稿和实践分享，有机会获得安克 AI 录音豆和京东京卡的大奖！</p>
                  <button type="button" className={styles.bannerLinkLight}>
                    立即参赛
                  </button>
                </div>
                <div className={styles.bannerArtworkLight}>
                  <span className={styles.ribbon} />
                  <div className={styles.deskBoard}>
                    <img src={homeAvatar} alt="技能挑战赛" className={styles.bannerAvatar} />
                    <div className={styles.boardCard}>
                      <span>早上好～ 今天的</span>
                      <strong>汇报 PPT</strong>
                      <span>已经完成啦！</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionTitleWrap}>
                  <StarFilled className={styles.sectionIcon} />
                  <h2 className={styles.sectionTitle}>官方精选</h2>
                </div>
                <button type="button" className={styles.sectionAction}>
                  <SwapOutlined />
                  <span>换一换</span>
                </button>
              </div>

              {featuredList.length > 0 ? (
                <div className={styles.featuredGrid}>
                  {featuredList.map((item) => (
                  <article key={item.id} className={styles.featuredCard}>
                    <div className={`${styles.featuredBadge} ${styles[item.toneClassName]}`}>{item.icon}</div>
                    <h3 className={styles.featuredTitle}>{item.title}</h3>
                    <p className={styles.featuredDesc}>{item.description}</p>
                    {'isSelected' in item ? (
                      <div className={styles.featuredActionBar}>
                        <span className={styles.featuredActionSource}>果仁数据源</span>
                        <button
                          type="button"
                          className={styles.featuredActionButton}
                          onClick={() => handleUseSkill(item)}
                          disabled={skillActionLoadingId === item.id}
                        >
                          {skillActionLoadingId === item.id ? '处理中...' : item.isSelected ? '使用' : '添加'}
                        </button>
                      </div>
                    ) : null}
                  </article>
                  ))}
                </div>
              ) : null}
              {featuredSkillsLoading ? <div className={styles.manageStatus}>技能加载中...</div> : null}
              {!featuredSkillsLoading && featuredSkillsError ? <div className={styles.manageStatus}>{featuredSkillsError}</div> : null}
              {!featuredSkillsLoading && !featuredSkillsError && featuredList.length === 0 ? <div className={styles.manageStatus}>暂无技能数据</div> : null}
            </section>
          </div>
        ) : (
          <div className={styles.managePage}>
            <header className={styles.manageHeader}>
              <button type="button" className={styles.backButton} onClick={() => setMode('discover')}>
                <ArrowLeftOutlined />
                <span>管理技能</span>
              </button>

              <div className={styles.manageTools}>
                <label className={styles.manageSearchBox}>
                  <SearchOutlined className={styles.searchIcon} />
                  <input className={styles.searchInput} placeholder="搜索" />
                </label>

                <div ref={createWrapRef} className={styles.createWrap}>
                  <button
                    type="button"
                    className={styles.createButton}
                    aria-expanded={createOpen}
                    aria-haspopup="menu"
                    onClick={() => setCreateOpen((value) => !value)}
                  >
                    <span className={styles.createButtonMain}>
                      <PlusOutlined />
                      <span>创建</span>
                    </span>
                    <DownOutlined className={`${styles.createArrow} ${createOpen ? styles.createArrowOpen : ''}`} />
                  </button>
                  <div className={`${styles.createMenu} ${createOpen ? styles.createMenuOpen : ''}`} role="menu">
                    {CREATE_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={styles.createMenuItem}
                        onClick={() => handleCreateOptionClick(option.key)}
                      >
                        <span className={styles.createMenuIcon}>{option.icon}</span>
                        <span className={styles.createMenuText}>
                          <span className={styles.createMenuTitle}>{option.title}</span>
                          <span className={styles.createMenuDesc}>{option.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </header>

            <div className={styles.manageTabs}>
              <button
                type="button"
                className={`${styles.manageTab} ${manageTab === 'added' ? styles.manageTabActive : ''}`}
                onClick={() => setManageTab('added')}
              >
                我添加的
              </button>
              <button
                type="button"
                className={`${styles.manageTab} ${manageTab === 'created' ? styles.manageTabActive : ''}`}
                onClick={() => setManageTab('created')}
              >
                我创建的
              </button>
            </div>

            {manageLoading ? (
              <div className={styles.manageStatus}>技能加载中...</div>
            ) : manageList.length > 0 ? (
              <div className={styles.manageGrid}>
                {manageList.map((item) => (
                  <article key={item.id} className={styles.manageCard}>
                    <div className={styles.manageCardHead}>
                      <span className={`${styles.manageCardIcon} ${styles[item.toneClassName]}`}>{item.icon}</span>
                      {manageTab === 'added' ? (
                        <div className={styles.manageMenuRoot} data-manage-menu-root="true">
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
                            <div className={styles.manageCardMenu}>
                              <button type="button" className={styles.manageCardMenuItem} onClick={() => handleShareSkill(item)}>
                                分享
                              </button>
                              <button
                                type="button"
                                className={`${styles.manageCardMenuItem} ${styles.manageCardMenuItemDanger}`}
                                onClick={() => handleRemoveSkill(item)}
                                disabled={removeSkillLoadingId === item.id}
                              >
                                {removeSkillLoadingId === item.id ? '移除中...' : '移除'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.manageTitleRow}>
                      <h3 className={styles.manageCardTitle}>{item.title}</h3>
                    </div>
                    <p className={styles.manageCardDesc}>{item.description}</p>
                      <button type="button" className={styles.useButton} onClick={() => handleLaunchSkill(item)}>
                        立即使用
                      </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.manageEmpty}>
                <div className={styles.balloonWrap}>
                  <span className={styles.balloonHalo} />
                  <span className={styles.balloonMain} />
                  <span className={styles.balloonString} />
                </div>
                <p className={styles.emptyText}>{manageEmptyText}</p>
              </div>
            )}
          </div>
        )}
      </section>
      {uploadNotice ? <div className={styles.uploadNotice}>{uploadNotice}</div> : null}
      {uploadModalOpen ? (
        <div className={styles.uploadModalMask} onClick={handleCloseUploadModal}>
          <div
            className={styles.uploadModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="skill-upload-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.uploadModalHeader}>
              <h3 id="skill-upload-modal-title" className={styles.uploadModalTitle}>
                {uploadedSkillSummary ? '技能基础信息' : '上传技能'}
              </h3>
              <button
                type="button"
                className={styles.uploadModalClose}
                onClick={handleCloseUploadModal}
                aria-label="关闭上传技能弹窗"
              >
                <CloseOutlined />
              </button>
            </div>

            {uploadedSkillSummary ? (
              <div className={styles.uploadSkillPanel}>
                <label className={styles.uploadSkillField}>
                  <span className={styles.uploadSkillLabel}>展示名称</span>
                  <input className={styles.uploadSkillInput} value={uploadedSkillSummary?.skillName ?? ''} readOnly />
                </label>

                <label className={styles.uploadSkillField}>
                  <span className={styles.uploadSkillLabel}>描述</span>
                  <textarea className={styles.uploadSkillTextarea} value={uploadedSkillSummary?.description ?? ''} readOnly />
                </label>

                <div className={styles.uploadSkillField}>
                  <span className={styles.uploadSkillLabel}>图标</span>
                  <div className={styles.uploadSkillIconPlaceholder} aria-hidden="true" />
                </div>

                <div className={styles.uploadSkillField}>
                  <span className={styles.uploadSkillLabel}>标签</span>
                  <div className={styles.uploadSkillSelect} aria-hidden="true">
                    <span className={styles.uploadSkillSelectValue} />
                    <DownOutlined />
                  </div>
                </div>

                <div className={styles.uploadSkillActions}>
                  <button type="button" className={styles.uploadSkillPrimaryButton} onClick={handleCloseUploadModal}>
                    完成
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.uploadModalBody}>
                <input ref={uploadInputRef} type="file" className={styles.uploadFileInput} onChange={handleUploadInputChange} />
                <div
                  className={`${styles.uploadDropzone} ${isUploadDragging ? styles.uploadDropzoneActive : ''} ${uploadingSkill ? styles.uploadDropzoneBusy : ''}`}
                  role="button"
                  tabIndex={uploadingSkill ? -1 : 0}
                  aria-disabled={uploadingSkill}
                  onClick={handleOpenUploadPicker}
                  onKeyDown={handleUploadDropzoneKeyDown}
                  onDragEnter={handleUploadDragEnter}
                  onDragOver={handleUploadDragOver}
                  onDragLeave={handleUploadDragLeave}
                  onDrop={handleUploadDrop}
                >
                  <div className={styles.uploadIllustration} aria-hidden="true">
                    <span className={`${styles.uploadIllustrationCard} ${styles.uploadIllustrationZip}`}>
                      <FileZipOutlined />
                    </span>
                    <span className={`${styles.uploadIllustrationCard} ${styles.uploadIllustrationSkill}`}>
                      <ThunderboltOutlined />
                    </span>
                  </div>
                  <div className={styles.uploadDropText}>
                    {uploadingSkill ? '文件上传中，请稍候...' : '拖拽文件至此，或点击选择文件'}
                  </div>
                </div>

                <ul className={styles.uploadTips}>
                  <li>上传根目录下包含 SKILL.md 文件的 .zip、.skill 或 .md 文件</li>
                  <li>SKILL.md 应包含 YAML 格式编写的技能名称和描述</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  )
}
