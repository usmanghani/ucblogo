import { test, expect } from './fixtures'

test.beforeEach(async ({ page }) => { await page.goto('/') })

test('edited program survives refresh and can be cleared', async ({ page }) => {
  const editor = page.locator('.monaco-editor').first()
  await expect(editor).toBeVisible({ timeout: 30000 })
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText('PRINT [SESSION RESTORED]')
  await page.reload()
  await expect(page.locator('.monaco-editor .view-lines').first()).toContainText('SESSION RESTORED', { timeout: 30000 })
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Clear saved session', exact: true }).click()
  await expect(page.locator('.monaco-editor .view-lines').first()).toContainText('SESSION RESTORED')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Clear saved session', exact: true }).click()
  await expect(page.locator('.monaco-editor .view-lines').first()).not.toContainText('SESSION RESTORED')
  await page.reload()
  await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.monaco-editor .view-lines').first()).not.toContainText('SESSION RESTORED')
})
