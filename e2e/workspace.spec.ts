import { test, expect } from '@playwright/test'

async function command(page: import('@playwright/test').Page, code: string) {
  const input = page.getByPlaceholder('Type a Logo command...')
  await input.fill(code)
  await input.press('Enter')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByPlaceholder('Type a Logo command...')).toBeVisible()
  await expect(page.locator('.canvas-panel canvas').first()).toBeVisible()
})

test('loads the app and core controls without browser exceptions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.reload()
  for (const title of ['Run (Ctrl+Enter)', 'Stop', 'Clear Screen', 'Help']) {
    await expect(page.getByTitle(title, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: /Save$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Load$/ })).toBeVisible()
  await command(page, 'PRINT 6 * 7')
  await expect(page.getByRole('log')).toContainText('42')
  expect(errors).toEqual([])
})

for (const [code, output] of [
  ['PRINT 2 + 3 * 4', '14'],
  ['PRINT FIRST [APPLE PEAR]', 'APPLE'],
  ['PRINT WORD "FARM "HOUSE', 'FARMHOUSE'],
  ['MAKE "ANIMALS 8 PRINT :ANIMALS + 2', '10'],
  ['TO DOUBLE :N OUTPUT :N * 2 END PRINT DOUBLE 12', '24'],
]) {
  test(`listener evaluates ${code}`, async ({ page }) => {
    await command(page, code)
    await expect(page.getByRole('log')).toContainText(output)
  })
}

test('command history recalls the previous command', async ({ page }) => {
  await command(page, 'PRINT 123')
  const input = page.getByPlaceholder('Type a Logo command...')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('PRINT 123')
  await input.press('ArrowDown')
  await expect(input).toHaveValue('')
})

test('clear removes output and drawn pixels', async ({ page }) => {
  const canvas = page.locator('.canvas-panel canvas').first()
  await command(page, 'CS HT')
  const redPixels = () => canvas.evaluate((el: HTMLCanvasElement) => {
    const pixels = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data
    let count = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 100 && pixels[i + 1] < 80 && pixels[i + 2] < 80 && pixels[i + 3] > 0) count++
    }
    return count
  })
  await command(page, 'SETPC 4 REPEAT 4 [FD 60 RT 90] PRINT [DONE]')
  await expect(page.getByRole('log')).toContainText('DONE')
  await expect.poll(redPixels).toBeGreaterThan(0)
  await page.getByTitle('Clear Screen', { exact: true }).click()
  await expect(page.getByRole('log')).toHaveText('')
  await command(page, 'HT')
  await expect.poll(redPixels).toBe(0)
})

test('stop reports to the output panel', async ({ page }) => {
  await page.getByTitle('Stop', { exact: true }).click()
  await expect(page.getByRole('log')).toContainText('[Stopped]')
})

test('mobile layout keeps the listener usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await command(page, 'PRINT [MOBILE]')
  await expect(page.getByRole('log')).toContainText('MOBILE')
})

