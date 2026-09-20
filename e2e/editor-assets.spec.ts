import { test, expect } from './fixtures'

test('the editor loads, edits, and runs without a third-party CDN', async ({ page }) => {
  const externalScripts: string[] = []
  await page.route(/https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//, route => {
    externalScripts.push(route.request().url())
    return route.abort()
  })
  await page.goto('/')
  await expect(page.locator('.monaco-editor')).toBeVisible()
  expect(await page.locator('script[src*="/monaco/"]').count()).toBeGreaterThan(0)
  const editor = page.locator('.monaco-editor').first()
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText('CS PRINT [LOCAL EDITOR READY]')
  await page.getByTitle('Run (Ctrl+Enter)', { exact: true }).click()
  await expect(page.getByRole('log')).toContainText('LOCAL EDITOR READY')
  expect(externalScripts).toEqual([])
})
