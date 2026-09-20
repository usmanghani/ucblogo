import { test, expect } from './fixtures'

for (const [id, title] of [['cat', 'Cat with whiskers'], ['farm', 'Farm'], ['rocket', 'Rocket ship'], ['soccer', 'Soccer ball']]) {
  test(`loads, persists and runs ${title}`, async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.monaco-editor')).toBeVisible()
    page.on('dialog', dialog => dialog.accept())
    await page.getByRole('combobox', { name: 'Preloaded examples' }).selectOption(id)
    await expect(page.getByRole('log')).toContainText(`Loaded ${title}. Press Run`)
    const source = await page.evaluate(() => sessionStorage.getItem('ucblogo.program.session.v1'))
    expect(source).toBeTruthy()
    await page.reload()
    await expect(page.locator('.monaco-editor')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('ucblogo.program.session.v1'))).toBe(source)
    await page.getByTitle('Run (Ctrl+Enter)', { exact: true }).click()
    await expect(page.getByRole('log')).toHaveText('')
    const ink = await page.locator('.canvas-panel canvas').evaluate((el: HTMLCanvasElement) => {
      const d = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data
      let n = 0
      for (let i = 0; i < d.length; i += 4) if (d[i] < 220 || d[i + 1] < 220 || d[i + 2] < 220) n++
      return n
    })
    expect(ink).toBeGreaterThan(100)
  })
}

test('cancel preserves the program; accepting from Blocks opens the text example', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.monaco-editor')).toBeVisible()
  const source = await page.evaluate(() => sessionStorage.getItem('ucblogo.program.session.v1'))
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('combobox', { name: 'Preloaded examples' }).selectOption('cat')
  expect(await page.evaluate(() => sessionStorage.getItem('ucblogo.program.session.v1'))).toBe(source)
  await page.getByRole('button', { name: 'Blocks editor', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('combobox', { name: 'Preloaded examples' }).selectOption('cat')
  await expect(page.getByRole('button', { name: 'Blocks editor', exact: true })).toBeVisible()
  await expect(page.locator('.monaco-editor')).toBeVisible()
  await expect(page.getByRole('log')).toContainText('Loaded Cat with whiskers')
})

test('animated rocket changes frames, Stop freezes it, and the original remains available', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.monaco-editor')).toBeVisible()
  page.on('dialog', dialog => dialog.accept())
  const menu = page.getByRole('combobox', { name: 'Preloaded examples' })
  await menu.selectOption('rocket-launch')
  await page.getByTitle('Run (Ctrl+Enter)', { exact: true }).click()
  const canvas = page.locator('.canvas-panel canvas')
  const frame = () => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL())
  await expect.poll(frame).not.toBe('data:,')
  const countdown = await frame()
  await expect.poll(frame, { timeout: 4000 }).not.toBe(countdown)
  // Let the three-second countdown finish, then observe moving launch frames.
  await page.waitForTimeout(3200)
  const liftoff = await frame()
  await expect.poll(frame, { timeout: 3000 }).not.toBe(liftoff)
  await page.getByTitle('Stop', { exact: true }).click()
  await expect(page.getByRole('log')).toContainText('[Stopped]')
  const stopped = await frame()
  await page.waitForTimeout(300)
  expect(await frame()).toBe(stopped)
  await menu.selectOption('rocket')
  await expect(page.getByRole('log')).toContainText('Loaded Rocket ship.')
  await page.getByTitle('Run (Ctrl+Enter)', { exact: true }).click()
  await expect(page.getByRole('log')).toHaveText('')
  await expect.poll(frame).not.toBe(stopped)
})
