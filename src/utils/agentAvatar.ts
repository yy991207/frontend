export function getAvatarLetter(name?: string) {
  return name?.trim().charAt(0).toUpperCase() || 'A'
}

export function normalizeAgentAvatarUrl(avatarUrl?: string | null) {
  const trimmedAvatarUrl = avatarUrl?.trim()

  if (!trimmedAvatarUrl) {
    return null
  }

  // 后端历史数据里会用 example.com 作为占位头像，这类地址不能当作真实头像展示
  if (trimmedAvatarUrl.toLowerCase() === 'example') {
    return null
  }

  if (
    trimmedAvatarUrl.toLowerCase() === 'example.com' ||
    trimmedAvatarUrl.toLowerCase().startsWith('example.com/')
  ) {
    return null
  }

  try {
    const parsedUrl = new URL(trimmedAvatarUrl)
    const hostname = parsedUrl.hostname.toLowerCase()
    if (hostname === 'example.com' || hostname.endsWith('.example.com')) {
      return null
    }
  } catch {
    return trimmedAvatarUrl
  }

  return trimmedAvatarUrl
}
