export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'json', 'html']

export function isAllowedFileType(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ALLOWED_FILE_EXTENSIONS.includes(ext)
}

export type UploadedFile = {
  id: string
  name: string
  size: number
  type: string
  ext: string
  url: string
  objectKey: string
  uploadProgress: number
  status: 'pending' | 'uploading' | 'parsing' | 'completed' | 'error'
  parseTaskId?: string
  resourceId?: string
  error?: string
}

type OssConfig = {
  token: string
  tenantId: string
  ossSignUrl: string
  bucketName: string
}

const DEFAULT_OSS_SIGN_URL = 'https://test-guoren-api.grtcloud.net/jeecg-boot/open/aliyun/oss/v1/temp/url'
const DEFAULT_BUCKET_NAME = 'guoren-files-test'
const DEFAULT_CONTENT_TYPE = 'text/plain'

function parseYamlConfig(rawText: string): Record<string, string> {
  const lines = rawText.split(/\r?\n/)
  const config: Record<string, string> = {}
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) continue
    const separatorIndex = trimmedLine.indexOf(':')
    if (separatorIndex === -1) continue
    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key) config[key] = value
  }
  return config
}

let cachedOssConfig: OssConfig | null = null

export async function loadOssConfig(): Promise<OssConfig> {
  if (cachedOssConfig) return cachedOssConfig
  
  try {
    const response = await fetch('/config.yaml')
    const rawText = await response.text()
    const config = parseYamlConfig(rawText)
    
    cachedOssConfig = {
      token: config.token || '',
      tenantId: config.user_id || '1000',
      ossSignUrl: DEFAULT_OSS_SIGN_URL,
      bucketName: DEFAULT_BUCKET_NAME
    }
    return cachedOssConfig
  } catch (error) {
    console.error('加载 config.yaml 失败:', error)
    return {
      token: '',
      tenantId: '1000',
      ossSignUrl: DEFAULT_OSS_SIGN_URL,
      bucketName: DEFAULT_BUCKET_NAME
    }
  }
}

export async function getUploadSignUrl(bucketName: string, objectKey: string): Promise<string | null> {
  const ossConfig = await loadOssConfig()
  const token = ossConfig.token || localStorage.getItem('SUPERSONIC_TOKEN') || ''
  const tenantId = ossConfig.tenantId || localStorage.getItem('SUPERSONIC_TENANT_ID') || ''
  
  try {
    const response = await fetch(ossConfig.ossSignUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
        'x-tenant-id': tenantId
      },
      body: JSON.stringify({
        bucketName,
        objectKey,
        method: 'PUT',
        headers: { 'Content-Type': DEFAULT_CONTENT_TYPE }
      })
    })
    
    const result = await response.json()
    if (result.success && result.result) {
      return result.result
    }
    return null
  } catch (error) {
    console.error('获取签名URL失败:', error)
    return null
  }
}

export async function uploadFileToOss(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadedFile | null> {
  const ossConfig = await loadOssConfig()
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  const objectKey = `agent_input/${timestamp}_${randomStr}_${file.name}`
  
  const fileId = `file-${timestamp}-${randomStr}`
  const uploadedFile: UploadedFile = {
    id: fileId,
    name: file.name,
    size: file.size,
    type: file.type,
    ext,
    url: '',
    objectKey,
    uploadProgress: 0,
    status: 'uploading'
  }
  
  const signedUrl = await getUploadSignUrl(ossConfig.bucketName, objectKey)
  if (!signedUrl) {
    uploadedFile.status = 'error'
    uploadedFile.error = '获取签名URL失败'
    return uploadedFile
  }
  
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', DEFAULT_CONTENT_TYPE)
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100)
        uploadedFile.uploadProgress = progress
        onProgress?.(progress)
      }
    }
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        uploadedFile.status = 'completed'
        uploadedFile.uploadProgress = 100
        uploadedFile.url = signedUrl.split('?')[0]
        resolve(uploadedFile)
      } else {
        uploadedFile.status = 'error'
        uploadedFile.error = `上传失败: HTTP ${xhr.status}`
        resolve(uploadedFile)
      }
    }
    
    xhr.onerror = () => {
      uploadedFile.status = 'error'
      uploadedFile.error = '网络请求失败'
      resolve(uploadedFile)
    }
    
    xhr.send(file)
  })
}

export function createPendingUploadedFile(file: File): UploadedFile {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  const objectKey = `agent_input/${timestamp}_${randomStr}_${file.name}`

  return {
    id: `file-${timestamp}-${randomStr}`,
    name: file.name,
    size: file.size,
    type: file.type,
    ext,
    url: '',
    objectKey,
    uploadProgress: 0,
    status: 'uploading',
  }
}

export async function uploadPendingFileToOss(
  pendingFile: UploadedFile,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadedFile> {
  const ossConfig = await loadOssConfig()
  const signedUrl = await getUploadSignUrl(ossConfig.bucketName, pendingFile.objectKey)

  if (!signedUrl) {
    return {
      ...pendingFile,
      status: 'error',
      error: '获取签名URL失败',
    }
  }

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', DEFAULT_CONTENT_TYPE)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress?.(progress)
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve({
          ...pendingFile,
          status: 'completed',
          uploadProgress: 100,
          url: signedUrl.split('?')[0],
        })
      } else {
        resolve({
          ...pendingFile,
          status: 'error',
          error: `上传失败: HTTP ${xhr.status}`,
        })
      }
    }

    xhr.onerror = () => {
      resolve({
        ...pendingFile,
        status: 'error',
        error: '网络请求失败',
      })
    }

    xhr.send(file)
  })
}

export function getFileTypeIcon(ext: string): string {
  const iconMap: Record<string, string> = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '📽️',
    pptx: '📽️',
    txt: '📃',
    json: '📋',
    csv: '📈',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    bmp: '🖼️',
    mp4: '🎬',
    mov: '🎬',
    avi: '🎬',
    mp3: '🎵',
    wav: '🎵',
    m4a: '🎵',
    zip: '📦',
    rar: '📦',
  }
  return iconMap[ext] || '📎'
}

export function getFileTypeName(ext: string): string {
  const typeMap: Record<string, string> = {
    pdf: 'PDF 文档',
    doc: 'Word 文档',
    docx: 'Word 文档',
    xls: 'Excel 表格',
    xlsx: 'Excel 表格',
    ppt: 'PPT 演示',
    pptx: 'PPT 演示',
    txt: '文本文件',
    json: 'JSON 文件',
    csv: 'CSV 表格',
    jpg: '图片',
    jpeg: '图片',
    png: '图片',
    gif: '图片',
    bmp: '图片',
    mp4: '视频',
    mov: '视频',
    avi: '视频',
    mp3: '音频',
    wav: '音频',
    m4a: '音频',
    zip: '压缩包',
    rar: '压缩包',
  }
  return typeMap[ext] || '文件'
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
