import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(relativePath: string) {
  return readFile(new URL(`../src/${relativePath}`, import.meta.url), 'utf8')
}

test('menu entry points navigate to skills page with manage mode state', async () => {
  const home = await read('pages/Home/HomePage.tsx')
  const chat = await read('pages/Chat/ChatPage.tsx')
  const partner = await read('pages/Partner/PartnerPage.tsx')

  assert.match(home, /navigate\('\/skills', \{[\s\S]*mode: 'manage'/)
  assert.match(chat, /navigate\('\/skills', \{[\s\S]*mode: 'manage'/)
  assert.match(partner, /navigate\('\/skills', \{[\s\S]*mode: 'manage'/)
})

test('skills page reads route state and opens manage mode directly', async () => {
  const skills = await read('pages/Skills/SkillsPage.tsx')

  assert.match(skills, /useLocation/)
  assert.match(skills, /location\.state/)
  assert.match(skills, /initialMode/)
  assert.match(skills, /initialMode === 'manage'/)
  assert.match(skills, /openManageSkills\(\)/)
})

test('skills page use actions jump to home page with skill template state', async () => {
  const skills = await read('pages/Skills/SkillsPage.tsx')
  const home = await read('pages/Home/HomePage.tsx')

  assert.match(skills, /buildSkillInitialPrompt/)
  assert.match(skills, /navigate\('\/', \{[\s\S]*initialPrompt:/)
  assert.match(skills, /toolType: skill\.skillName \|\| skill\.id/)
  assert.match(skills, /skillName: skill\.skillName \|\| skill\.id/)
  assert.match(skills, /skillDescription: skill\.description/)
  assert.match(skills, /template: skill\.template/)
  assert.match(home, /useLocation/)
  assert.match(home, /location\.state/)
  assert.match(home, /setPrompt\(/)
})

test('skills page fetches and renders created skills when switching to 我创建的', async () => {
  const skills = await read('pages/Skills/SkillsPage.tsx')

  assert.match(skills, /createdSkills/)
  assert.match(skills, /createdSkillsLoading/)
  assert.match(skills, /createdSkillsError/)
  assert.match(skills, /parseCustomSkillListApiConfig/)
  assert.match(skills, /fetchCreatedSkills/)
  assert.match(skills, /manageTab === 'created'/)
})
