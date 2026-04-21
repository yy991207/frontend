import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { UploadedFile } from './ossUploadService'
import { uploadPendingFileToOss } from './ossUploadService'
import {
  parseAgentFileApiConfig,
  uploadPendingFileToOssWithDocumentParse,
} from './agentFileUploadService'

vi.mock('./ossUploadService', async () => {
  const actual = await vi.importActual<typeof import('./ossUploadService')>('./ossUploadService')
  return {
    ...actual,
    uploadPendingFileToOss: vi.fn(),
  }
})

const mockedUploadPendingFileToOss = vi.mocked(uploadPendingFileToOss)

function createUploadedFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    id: 'file-1',
    name: '年度报告.pdf',
    size: 1024,
    type: 'application/pdf',
    ext: 'pdf',
    url: 'https://guoren-files-test.oss-cn-beijing.aliyuncs.com/input/1002/demo.pdf',
    objectKey: 'input/1002/demo.pdf',
    uploadProgress: 100,
    status: 'completed',
    ...overrides,
  }
}

describe('agentFileUploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('会从 config.yaml 里读取 url 和 user_id 组装文档解析接口', () => {
    const config = parseAgentFileApiConfig(`
user_id: 123456
url: http://192.168.30.238:8000/
`)

    expect(config.userId).toBe('123456')
    expect(config.uploadEndpoint).toBe('http://192.168.30.238:8000/api/v1/agent/files/upload')
    expect(config.parseTaskEndpoint).toBe('http://192.168.30.238:8000/api/v1/parse/{task_id}')
  })

  it('文档上传到 OSS 后，会继续提交解析任务并轮询到 completed 再返回成功态', async () => {
    const pendingFile = createUploadedFile({
      status: 'uploading',
      uploadProgress: 0,
      url: '',
    })
    const ossCompletedFile = createUploadedFile()
    mockedUploadPendingFileToOss.mockResolvedValue(ossCompletedFile)

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'user_id: 123456\nurl: http://192.168.30.238:8000/\n',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          code: '200',
          msg: 'success',
          data: {
            task_id: '2043634245821267969',
            resource_id: '2043634245821267968',
            file_name: '年度报告.pdf',
            message: '文件解析任务已提交',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: '2043634245821267969',
          resource_id: '2043634245821267968',
          status: 'processing',
          progress: 80,
          result: null,
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: '2043634245821267969',
          resource_id: '2043634245821267968',
          status: 'completed',
          progress: null,
          result: {
            file_name: '年度报告.pdf',
          },
          error: null,
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const statusChanges: UploadedFile[] = []
    const uploadPromise = uploadPendingFileToOssWithDocumentParse(
      pendingFile,
      new File(['demo'], '年度报告.pdf', { type: 'application/pdf' }),
      {
        pollIntervalMs: 10,
        onStatusChange: (nextFile) => {
          statusChanges.push(nextFile)
        },
      },
    )

    await vi.advanceTimersByTimeAsync(10)
    const result = await uploadPromise

    expect(statusChanges[0]).toMatchObject({
      status: 'parsing',
      parseTaskId: '2043634245821267969',
    })
    expect(result).toMatchObject({
      status: 'completed',
      parseTaskId: '2043634245821267969',
      resourceId: '2043634245821267968',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/config.yaml')
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://192.168.30.238:8000/api/v1/agent/files/upload',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          file_name: '年度报告.pdf',
          url: 'https://guoren-files-test.oss-cn-beijing.aliyuncs.com/input/1002/demo.pdf',
          user_id: '123456',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://192.168.30.238:8000/api/v1/parse/2043634245821267969',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          accept: 'application/json',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://192.168.30.238:8000/api/v1/parse/2043634245821267969',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('图片上传仍然直接按 OSS 成功态返回，不会误走文档解析', async () => {
    const pendingFile = createUploadedFile({
      name: '封面.png',
      ext: 'png',
      type: 'image/png',
      status: 'uploading',
      uploadProgress: 0,
      url: '',
    })
    const ossCompletedFile = createUploadedFile({
      name: '封面.png',
      ext: 'png',
      type: 'image/png',
      url: 'https://guoren-files-test.oss-cn-beijing.aliyuncs.com/input/1002/demo.png',
    })
    mockedUploadPendingFileToOss.mockResolvedValue(ossCompletedFile)

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadPendingFileToOssWithDocumentParse(
      pendingFile,
      new File(['demo'], '封面.png', { type: 'image/png' }),
    )

    expect(result).toEqual(ossCompletedFile)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
