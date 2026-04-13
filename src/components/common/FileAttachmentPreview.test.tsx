import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileAttachmentPreview } from './FileAttachmentPreview'
import type { UploadedFile } from '../../services/ossUploadService'

describe('FileAttachmentPreview', () => {
  it('解析中的文档要显示解析中状态，不能直接显示成功态', () => {
    const file = {
      id: 'file-1',
      name: '年度报告.pdf',
      size: 1024,
      type: 'application/pdf',
      ext: 'pdf',
      url: 'https://example.com/report.pdf',
      objectKey: 'input/report.pdf',
      uploadProgress: 100,
      status: 'parsing',
      parseTaskId: 'task-1',
    } as UploadedFile

    render(<FileAttachmentPreview files={[file]} onRemove={vi.fn()} />)

    expect(screen.getByText('年度报告.pdf')).toBeInTheDocument()
    expect(screen.getByText('解析中...')).toBeInTheDocument()
  })
})
