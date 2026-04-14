import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import { ArrowUpOutlined } from '@ant-design/icons'
import { AttachmentMenu, type AttachmentSkillItem } from './AttachmentMenu'
import { FileAttachmentPreview } from './FileAttachmentPreview'
import { SkillSlashCommand } from './SkillSlashCommand'
import SkillTemplateInput from './SkillTemplateInput'
import type { UploadedFile } from '../../services/ossUploadService'
import styles from './ChatComposer.module.less'

type ChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onSend: () => void
  placeholder: string
  onMultilineChange?: (isMultiline: boolean) => void
  selectedSkillName?: string
  selectedSkillDescription?: string
  showSelectedSkillBadge?: boolean
  slashCommandOpen: boolean
  slashQuery: string
  onSlashQueryChange: (query: string) => void
  skills: AttachmentSkillItem[]
  filteredSkills: AttachmentSkillItem[]
  skillsLoading: boolean
  loadSkills: (signal?: AbortSignal) => Promise<void>
  selectedSkillIndex: number
  onSelectSkill: (skill: AttachmentSkillItem) => void
  onCloseSlashCommand: () => void
  onManageSkills: () => void
  uploadedFiles: UploadedFile[]
  onRemoveFile: (fileId: string) => void
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadFile: () => void
  webSearchEnabled: boolean
  knowledgeEnabled: boolean
  onToggleWebSearch: () => void
  onToggleKnowledge: () => void
  sendDisabled: boolean
  isResponding?: boolean
  onStop?: () => void
  testId?: string
  layout?: 'inline' | 'stacked'
}

export function ChatComposer({
  value,
  onChange,
  onKeyDown,
  onSend,
  placeholder,
  onMultilineChange,
  selectedSkillName = '',
  selectedSkillDescription = '',
  showSelectedSkillBadge = false,
  slashCommandOpen,
  slashQuery,
  onSlashQueryChange,
  skills,
  filteredSkills,
  skillsLoading,
  loadSkills,
  selectedSkillIndex,
  onSelectSkill,
  onCloseSlashCommand,
  onManageSkills,
  uploadedFiles,
  onRemoveFile,
  fileInputRef,
  onFileChange,
  onUploadFile,
  webSearchEnabled,
  knowledgeEnabled,
  onToggleWebSearch,
  onToggleKnowledge,
  sendDisabled,
  isResponding = false,
  onStop,
  testId,
  layout,
}: ChatComposerProps) {
  const showStopButton = isResponding && typeof onStop === 'function'

  return (
    <div data-testid={testId} data-layout={layout} className={styles.inputWrap}>
      <SkillSlashCommand
        visible={slashCommandOpen}
        query={slashQuery}
        setQuery={(query) => {
          onSlashQueryChange(query)
          onChange('/' + query)
        }}
        skills={filteredSkills}
        loading={skillsLoading}
        selectedIndex={selectedSkillIndex}
        onSelectSkill={onSelectSkill}
        onClose={onCloseSlashCommand}
        onManageSkills={onManageSkills}
      />
      <FileAttachmentPreview files={uploadedFiles} onRemove={onRemoveFile} />
      <div className={styles.inputTopArea}>
        {showSelectedSkillBadge && selectedSkillName ? (
          <span
            className={`${styles.selectedSkillBadge} ${styles.skillTooltip}`}
            data-tooltip={selectedSkillDescription}
          >
            /{selectedSkillName}
          </span>
        ) : null}
        <SkillTemplateInput
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onMultilineChange={onMultilineChange}
          onSend={onSend}
          placeholder={placeholder}
        />
      </div>
      <div className={styles.inputBottomArea}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="*/*"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        <div className={styles.inputBottomLeft}>
          <AttachmentMenu
            placement="bottom"
            skills={skills}
            skillsLoading={skillsLoading}
            loadSkills={loadSkills}
            onSelectSkill={onSelectSkill}
            onManageSkills={onManageSkills}
            onUploadFile={onUploadFile}
            showTools
            webSearchEnabled={webSearchEnabled}
            knowledgeEnabled={knowledgeEnabled}
            onToggleWebSearch={onToggleWebSearch}
            onToggleKnowledge={onToggleKnowledge}
          />
        </div>
        <div className={styles.inputBottomRight}>
          <div className={styles.inputActions}>
            {showStopButton ? (
              <button type="button" aria-label="停止生成" className={`${styles.iconBtn} ${styles.stopBtn}`} onClick={onStop}>
                <span className={styles.stopInner} />
              </button>
            ) : (
              <button
                type="button"
                aria-label="发送消息"
                className={`${styles.iconBtn} ${styles.sendBtn} ${sendDisabled ? styles.sendBtnDisabled : ''}`}
                onClick={onSend}
                disabled={sendDisabled}
              >
                <ArrowUpOutlined />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
