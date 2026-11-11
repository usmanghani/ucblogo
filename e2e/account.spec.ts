import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const LOCAL_PROGRAMS = 'logo-teacher.programs.v1'
const menu = (page: Page) => page.getByRole('combobox', { name: 'Preloaded examples' })
const mine = (page: Page) => menu(page).locator('optgroup[label="My programs"] option')

async function writeProgram(page: Page, code: string) {
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(code)
}
async function saveAs(page: Page, title: string) {
  await page.getByRole('button', { name: /^My programs/ }).click()
  await page.getByLabel('Save the program in your code pane as a new example').fill(title)
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: `Saved “${title}”.` })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
}

// The account API must answer as JSON on every deployment, configured or not.
test('the account API is routed and says whether accounts are available', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/account')
    return { status: response.status, type: response.headers.get('content-type'), body: await response.json() }
  })
  expect(result.status).toBe(200)
  expect(result.type).toContain('application/json')
  expect(typeof result.body.accounts).toBe('boolean')
  expect(result.body.user).toBeNull()
})

test.describe('with accounts', () => {
  // Needs the local in-process database; a deployment's own database is not for test users.
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local test database')

  test('an anonymous student saves a program as an example and it stays in this browser', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.monaco-editor')).toBeVisible()
    await writeProgram(page, 'CS PRINT [MY OWN EXAMPLE]')
    await saveAs(page, 'My first example')
    await expect(page.getByRole('button', { name: 'My programs (1)' })).toBeVisible()
    await expect(mine(page)).toHaveText(['My first example'])

    await page.reload()
    await expect(page.locator('.monaco-editor')).toBeVisible()
    await writeProgram(page, 'PRINT [SOMETHING ELSE]')
    page.once('dialog', dialog => dialog.accept())
    await menu(page).selectOption({ label: 'My first example' })
    await page.getByTitle('Run (Ctrl+Enter)', { exact: true }).click()
    await expect(page.getByRole('log')).toContainText('MY OWN EXAMPLE')

    await page.getByRole('button', { name: 'My programs (1)' }).click()
    await expect(page.getByText('Saved in this browser only.')).toBeVisible()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete My first example' }).click()
    await expect(page.getByText('Nothing saved yet.')).toBeVisible()
    expect(await page.evaluate(key => localStorage.getItem(key), LOCAL_PROGRAMS)).toBeNull()
  })

  test('signing up moves anonymous work into the account, and it follows the student to another browser', async ({ page, browser }) => {
    const email = `student-${Date.now()}@example.com`
    await page.goto('/')
    await expect(page.locator('.monaco-editor')).toBeVisible()
    await page.evaluate(() => localStorage.setItem('logo-teacher.progress.v1', JSON.stringify(['meet-the-turtle', 'repeat'])))
    await page.reload()
    await expect(page.locator('.monaco-editor')).toBeVisible()
    await writeProgram(page, 'CS PRINT [SAVED BEFORE SIGNING UP]')
    await saveAs(page, 'From before')

    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('button', { name: 'Create a new account' }).click()
    await page.getByLabel('Your name').fill('Ada')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('turtle-power-1')
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/signup.png` })
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(page.locator('.account-chip')).toContainText('Ada')

    // The anonymous program now belongs to the account, not the browser.
    await expect(mine(page)).toHaveText(['From before'])
    if (process.env.SHOTS) { await page.getByRole('button', { name: 'My programs (1)' }).click(); await page.screenshot({ path: `${process.env.SHOTS}/programs.png` }); await page.getByRole('button', { name: 'Close' }).click() }
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), LOCAL_PROGRAMS)).toBeNull()
    await page.getByRole('button', { name: 'My programs (1)' }).click()
    await expect(page.getByText(`Saved to your account (${email}).`)).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('button', { name: /Lessons/ })).toContainText('2/8')

    // A second browser with no local data: sign in and find the same program and progress.
    const other = await (await browser.newContext()).newPage()
    await other.goto('/')
    await expect(other.getByRole('button', { name: /Lessons/ })).toContainText('0/8')
    await other.getByRole('button', { name: 'Sign in', exact: true }).click()
    await other.getByLabel('Email').fill(email)
    await other.getByLabel('Password').fill('wrong-password')
    await other.getByRole('dialog').getByRole('button', { name: 'Sign in' }).click()
    await expect(other.locator('.sheet-error')).toContainText('do not match an account')
    await other.getByLabel('Password').fill('turtle-power-1')
    await other.getByRole('dialog').getByRole('button', { name: 'Sign in' }).click()
    await expect(other.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(mine(other)).toHaveText(['From before'])
    await expect(other.getByRole('button', { name: /Lessons/ })).toContainText('2/8')
    await other.reload()
    await expect(other.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(mine(other)).toHaveText(['From before'])

    // Signing out leaves nothing of the account behind for the next person at this computer.
    await other.getByRole('button', { name: 'Sign out' }).click()
    await expect(other.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
    await expect(mine(other)).toHaveCount(0)
    await expect(other.getByRole('button', { name: /Lessons/ })).toContainText('0/8')
    await other.context().close()
  })

  test('a signed-out visitor cannot read or write saved programs', async ({ page }) => {
    await page.goto('/')
    const statuses = await page.evaluate(async () => Promise.all([
      fetch('/api/programs').then(r => r.status),
      fetch('/api/progress').then(r => r.status),
      fetch('/api/programs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'x', source: 'FD 1' }) }).then(r => r.status),
    ]))
    expect(statuses).toEqual([401, 401, 401])
  })
})
