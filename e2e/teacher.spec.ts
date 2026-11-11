import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { drawingPng } from './drawing-png.mjs'
import { HOUSE, SQUARE } from './fake-model.mjs'

// These tests script the language model, which only the local preview can do. Against a
// deployment, scripts/smoke-teacher.mjs checks one real turn instead.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the scripted model')

const PROGRAM = 'ucblogo.program.session.v1'
const program = (page: Page) => page.evaluate(key => sessionStorage.getItem(key), PROGRAM)

async function enter(page: Page) {
  await page.goto('/')
  await expect(page.locator('.monaco-editor')).toBeAttached()
  await page.getByRole('button', { name: 'Start learning' }).click()
}
async function ask(page: Page, text: string) {
  await page.getByLabel('Message Pip').fill(text)
  await page.getByLabel('Message Pip').press('Enter')
}
const redPixels = (page: Page) => page.locator('.canvas-panel canvas').evaluate((el: HTMLCanvasElement) => {
  const d = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data
  let count = 0
  for (let i = 0; i < d.length; i += 4) if (d[i] > 100 && d[i + 1] < 80 && d[i + 2] < 80) count++
  return count
})

test('nothing is sent to Pip until the student agrees, and the choice is remembered', async ({ page }) => {
  const calls: string[] = []
  page.on('request', request => { if (request.url().includes('/eve/v1/session')) calls.push(request.url()) })
  await page.goto('/')
  await expect(page.getByText(/Pip is an AI. What you type here/)).toBeVisible()
  await expect(page.getByLabel('Message Pip')).toBeDisabled()
  expect(calls).toEqual([])
  await page.getByRole('button', { name: 'Start learning' }).click()
  await expect(page.getByLabel('Message Pip')).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: /Start lesson 1: Meet the turtle/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start learning' })).toHaveCount(0)
})

test('Pip writes a program into the code pane, draws it, and the chat survives a reload', async ({ page }) => {
  await enter(page)
  const original = await program(page)
  await ask(page, 'Draw a red square')
  await expect(page.getByText('Your red square is ready.')).toBeVisible()
  await expect(page.getByText('Pip put a program in your code pane')).toBeVisible()
  await expect(page.getByRole('log')).toContainText('SQUARE READY')
  expect(await program(page)).toBe(SQUARE)
  await expect.poll(() => redPixels(page)).toBeGreaterThan(100)

  await page.getByRole('button', { name: 'Undo change' }).click()
  expect(await program(page)).not.toContain('SQUARE READY')
  expect(original).toBeNull()

  // A reload shows the conversation again but must not replay Pip's edit over the student's code.
  await page.reload()
  await expect(page.getByText('Your red square is ready.')).toBeVisible()
  await expect(page.locator('.monaco-editor')).toBeVisible()
  await page.waitForTimeout(1500)
  expect(await program(page)).not.toContain('SQUARE READY')

  await page.getByRole('button', { name: 'New chat' }).click()
  await expect(page.getByRole('heading', { name: 'Learn Logo by drawing.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Learn Logo by drawing.' })).toBeVisible()
})

async function attachDrawing(page: Page) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Add a picture of your drawing' }).click()
  await (await chooser).setFiles({ name: 'my-house.png', mimeType: 'image/png', buffer: drawingPng() })
}

test('a student shows Pip a hand drawing and gets a Logo program for it', async ({ page }) => {
  await enter(page)
  await attachDrawing(page)
  await expect(page.locator('.drawing-chip')).toContainText('Your drawing')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Here is my drawing. Can you turn it into a Logo program?')).toBeVisible()
  await expect(page.getByRole('img', { name: 'The drawing you sent' })).toBeVisible()
  await expect(page.getByText('I see a house: a square with a triangle roof.')).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('log')).toContainText('HOUSE FROM YOUR DRAWING')
  expect(await program(page)).toBe(HOUSE)
  await expect(page.locator('.drawing-chip')).toHaveCount(0)
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/drawing.png` })
})

test('a picture can be removed before sending, and only pictures are accepted', async ({ page, baseURL }) => {
  await enter(page)
  await attachDrawing(page)
  await page.getByRole('button', { name: 'Remove the picture' }).click()
  await expect(page.locator('.drawing-chip')).toHaveCount(0)
  const refused = await page.evaluate(async url => (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: [{ type: 'text', text: 'hi' }, { type: 'file', mediaType: 'application/pdf', filename: 'x.pdf', data: 'data:application/pdf;base64,JVBERi0xLjQK' }] }) })).status, `${baseURL}/eve/v1/session`)
  expect(refused).toBe(415)
})

test('Pip sees its own mistake in the run report and repairs it', async ({ page }) => {
  await enter(page)
  await ask(page, 'Show me something broken')
  await expect(page.getByText('I fixed my spelling mistake')).toBeVisible()
  await expect(page.getByText('Pip’s program hit a problem')).toBeVisible()
  await expect(page.getByText("I don't know how to FDD (line 2)")).toBeVisible()
  await expect(page.getByRole('log')).toContainText('REPAIRED')
  expect(await program(page)).toContain('PRINT [REPAIRED]')
})

test('a lesson: Pip explains, the student tries the code, and progress is kept', async ({ page }) => {
  await enter(page)
  await page.getByRole('button', { name: /Start lesson 1: Meet the turtle/ }).click()
  await expect(page.getByText('Welcome to the lesson!')).toBeVisible()
  await expect(page.getByText('Lesson: Meet the turtle')).toBeVisible()
  await page.getByRole('button', { name: 'Try it' }).click()
  expect(await program(page)).toBe('CS\nFD 100\nRT 90\nFD 100')
  await expect(page.locator('.status-bar')).toContainText('x: 100')

  await ask(page, 'I finished the challenge')
  await expect(page.getByText('Lesson complete: Meet the turtle')).toBeVisible()
  await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/lesson.png` : undefined })
  await expect(page.getByRole('button', { name: /Lessons/ })).toContainText('1/8')
  await page.reload()
  await expect(page.getByRole('button', { name: /Lessons/ })).toContainText('1/8')
  await page.getByRole('button', { name: /Lessons/ }).click()
  await expect(page.getByRole('button', { name: /Meet the turtle.*finished/ })).toBeVisible()
})

test('Pip is told what is in the code pane and how the last run went', async ({ page }) => {
  await enter(page)
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText('PRINT [MY SECRET MARKER]\nFDD 50')
  await ask(page, 'What is in my editor?')
  await expect(page.getByText('I can see MY SECRET MARKER in your code pane.')).toBeVisible()

  await page.getByTitle('Run (Ctrl+Enter)', { exact: true }).click()
  await expect(page.getByRole('log')).toContainText("I don't know how to FDD")
  await page.getByRole('button', { name: /Your program stopped.*Ask Pip/ }).click()
  await expect(page.getByText('The turtle did not know one of your words.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Your program stopped/ })).toHaveCount(0)
})

test('a turn can be stopped and Pip answers again afterwards', async ({ page }) => {
  await enter(page)
  await ask(page, 'Answer slowly please')
  await page.getByRole('button', { name: 'Stop' , exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('This slow answer should never arrive.')).toHaveCount(0)
  await ask(page, 'Hello')
  await expect(page.getByText('Hello! I am Pip.')).toBeVisible()
})

test('a failure to reach Pip is explained and the classroom stays usable', async ({ page }) => {
  await page.route('**/eve/v1/session**', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'rate_limited', error: 'Pip is helping a lot of students right now. Wait a minute, then try again.' }) }))
  await enter(page)
  await ask(page, 'Draw a red square')
  await expect(page.locator('.failure')).toContainText('Wait a minute')
  await expect(page.getByLabel('Message Pip')).toBeEnabled()
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText('PRINT [STILL WORKS]')
  await page.getByTitle('Run (Ctrl+Enter)', { exact: true }).click()
  await expect(page.getByRole('log')).toContainText('STILL WORKS')
})

test('other sites cannot use Pip', async ({ page, baseURL }) => {
  await page.goto('/')
  const response = await page.request.post(`${baseURL}/eve/v1/session`, { headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site', origin: 'https://elsewhere.example' }, data: { message: 'hi' } })
  expect(response.status()).toBe(403)
})

test('on a phone the three panes become tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enter(page)
  await expect(page.getByLabel('Message Pip')).toBeVisible()
  await expect(page.locator('.canvas-panel')).toBeHidden()
  await ask(page, 'Draw a red square')
  await expect(page.getByText('Your red square is ready.')).toBeVisible()
  await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/phone-pip.png` : undefined })
  await page.getByRole('navigation', { name: 'Show' }).getByRole('button', { name: 'Drawing' }).click()
  await expect(page.locator('.canvas-panel canvas')).toBeVisible()
  await expect(page.getByRole('log')).toContainText('SQUARE READY')
  await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/phone-drawing.png` : undefined })
  const box = await page.locator('.drawing-pane').boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await page.getByRole('navigation', { name: 'Show' }).getByRole('button', { name: 'Code' }).click()
  await expect(page.locator('.monaco-editor')).toBeVisible()
  await expect(page.locator('.monaco-editor .view-lines').first()).toContainText('SETPC 4')
})
