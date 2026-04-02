export type SkillItem = {
  id: string
  skillName: string
  title: string
  description: string
  template: string
  isSelected: boolean
}

export type SkillApiResponse = {
  success: boolean
  code: string
  msg: string
  data?: {
    skills?: unknown[]
    items?: unknown[]
    total?: number
  }
}

function readSkillField(item: Record<string, unknown>, keys: string[]) {
  const value = keys.find((key) => typeof item[key] === 'string' && item[key])
  return value ? String(item[value]).trim() : ''
}

export function normalizeSkillItems(items: unknown[]): SkillItem[] {
  return items
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const value = item as Record<string, unknown>
      const title = readSkillField(value, ['chinese_name', 'chinesename', 'chineseName', 'name'])
      const description = readSkillField(value, ['description', 'desc'])
      const skillName = readSkillField(value, ['skill_name', 'skillName', 'name'])
      const template = readSkillField(value, ['template', 'prompt_template', 'promptTemplate'])

      if (!title) {
        return null
      }

      const id = readSkillField(value, ['id']) || skillName || `${title}-${index}`
      const isSelected = Boolean(value.is_selected ?? value.isSelected)

      return {
        id,
        skillName,
        title,
        description,
        template,
        isSelected,
      }
    })
    .filter((item): item is SkillItem => item !== null)
}

export function extractSkillItemsFromResponse(data: SkillApiResponse) {
  const payload = data.data as Record<string, unknown> | undefined
  const skills = Array.isArray(payload?.skills)
    ? payload.skills
    : Array.isArray(payload?.items)
      ? payload.items
      : []

  return normalizeSkillItems(skills)
}

export function buildSkillDisplayName(skillName: string) {
  const normalizedSkillName = skillName.trim().replace(/^\/+/, '')

  return normalizedSkillName ? `/${normalizedSkillName}` : ''
}

export function buildSkillInitialPrompt(skill: Pick<SkillItem, 'skillName' | 'template' | 'title'>) {
  const template = skill.template.trim()
  const skillName = buildSkillDisplayName(skill.skillName)

  // 技能提示统一按“基于 + skill_name + template”组装，首页和对话页走同一套文案。
  if (skillName && template) {
    return `基于 ${skillName} ${template}`
  }

  if (template) {
    return template
  }

  if (skillName) {
    return `/${skillName}`
  }

  return skill.title.trim()
}
