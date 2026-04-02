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
