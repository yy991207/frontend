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
  assert.match(content, />\s*完成\s*<\/button>/)
})

test('skills page styles include upload modal, drag area and skill info layout', async () => {
  const content = await read('pages/Skills/skills.module.less')

  assert.match(content, /\.uploadModalMask\s*\{/)
  assert.match(content, /\.uploadDropzone\s*\{/)
  assert.match(content, /\.uploadSkillField\s*\{/)
})
