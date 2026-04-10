import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(relativePath: string) {
  return readFile(new URL(`../src/${relativePath}`, import.meta.url), 'utf8')
}

test('skills page wires upload menu to modal and upload service', async () => {
  const content = await read('pages/Skills/SkillsPage.tsx')

  assert.match(content, /parseSkillUploadApiConfig/)
  assert.match(content, /uploadCustomSkill\(/)
  assert.match(content, /handleCreateOptionClick/)
  assert.match(content, /type="file"/)
  assert.match(content, /onDrop=\{handleUploadDrop\}/)
  assert.match(content, /拖拽文件至此，或点击选择文件/)
})

test('skills page renders uploaded skill name, description and top notice', async () => {
  const content = await read('pages/Skills/SkillsPage.tsx')

  assert.match(content, /uploadNotice/)
  assert.match(content, /uploadedSkillSummary\?\.skillName/)
  assert.match(content, /uploadedSkillSummary\?\.description/)
  assert.match(content, /getUploadedSkillPresentation/)
  assert.match(content, /uploadSkillIconPreview/)
  assert.match(content, />\s*完成\s*<\/button>/)
})

test('skills page wires created skill card menu to custom delete action', async () => {
  const content = await read('pages/Skills/SkillsPage.tsx')

  assert.match(content, /handleDeleteCreatedSkill/)
  assert.match(content, /handleDeleteCreatedSkill\(item\)/)
  assert.match(content, /删除中\.\.\./)
})

test('skills page wires featured and manage cards to skill detail modal entry', async () => {
  const content = await read('pages/Skills/SkillsPage.tsx')

  assert.match(content, /selectedSkillForDetail/)
  assert.match(content, /handleOpenSkillDetail/)
  assert.match(content, /handleCloseSkillDetail/)
  assert.match(content, /onClick=\{\(\) => handleOpenSkillDetail\(item\)\}/)
  assert.match(content, /<SkillDetailModal/)
  assert.match(content, /visible=\{Boolean\(selectedSkillForDetail\)\}/)
})

test('skill detail modal uses sticky header, metadata cards and scene grid layout from skill spec', async () => {
  const component = await read('components/common/SkillDetailModal.tsx')
  const styles = await read('components/common/SkillDetailModal.module.less')

  assert.match(component, /stickyHeader/)
  assert.match(component, /summaryCard/)
  assert.match(component, /metaGrid/)
  assert.match(component, /sceneGrid/)
  assert.match(component, /exampleList/)
  assert.match(component, /configTable/)
  assert.match(component, /custom_agent/)

  assert.match(styles, /\.stickyHeader\s*\{/) 
  assert.match(styles, /position:\s*sticky/)
  assert.match(styles, /\.heroSection\s*\{/) 
  assert.match(styles, /\.metaGrid\s*\{/) 
  assert.match(styles, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(styles, /\.sceneGrid\s*\{/) 
  assert.match(styles, /@media \(max-width:\s*960px\)/)
})

test('skills page styles include upload modal, drag area and skill info layout', async () => {
  const content = await read('pages/Skills/skills.module.less')

  assert.match(content, /\.uploadModalMask\s*\{/)
  assert.match(content, /\.uploadDropzone\s*\{/)
  assert.match(content, /\.uploadSkillField\s*\{/)
  assert.match(content, /\.uploadSkillIconPreview\s*\{/)
  assert.match(content, /\.skillDetailCardTrigger\s*\{/)
})
