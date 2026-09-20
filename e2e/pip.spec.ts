import { test, expect } from './fixtures'
const frame = (delta: object) => `data: ${JSON.stringify({ model: 'test/free', choices: [{ delta }] })}\n\ndata: [DONE]\n\n`
const tool = (name: string, args = {}) => frame({ tool_calls: [{ index: 0, id: `call_${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })

test('Pip writes from a prompt, draws in a worker, follows up, restores chat and undoes edits', async ({ page }) => {
  let count = 0
  const program = 'CS SETPC 4 SETPENSIZE 3 REPEAT 4 [FD 80 RT 90] HT PRINT [SQUARE READY]'
  await page.route('**/api/assistant', async route => {
    const req = route.request().postDataJSON()
    const replies = [tool('read_program'), tool('write_program', { code: program }), tool('run_program'), frame({ content: 'Your red square is ready.' }), frame({ content: 'Each side is 80 turtle steps.' })]
    if (count === 3) expect(req.messages.at(-1).content).toContain('"success":true')
    await route.fulfill({ contentType: 'text/event-stream', body: replies[count++] })
  })
  await page.goto('/')
  if (await page.getByRole('checkbox', { name: /Allow Pip/ }).isVisible()) await page.getByRole('checkbox', { name: /Allow Pip/ }).check()
  await expect(page.locator('.monaco-editor')).toBeVisible()
  const original = await page.evaluate(() => sessionStorage.getItem('ucblogo.program.session.v1'))
  await page.getByLabel('Ask Pip', { exact: true }).fill('Draw a red square')
  await page.getByRole('button', { name: 'Send ↗' }).click()
  await expect(page.getByText('Your red square is ready.')).toBeVisible()
  await expect(page.getByRole('log')).toContainText('SQUARE READY')
  expect(await page.evaluate(() => sessionStorage.getItem('ucblogo.program.session.v1'))).toContain(program)
  const pixels = await page.locator('.canvas-panel canvas').evaluate((el: HTMLCanvasElement) => {
    const d = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data
    let count = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] > 100 && d[i + 1] < 80 && d[i + 2] < 80) count++
    return count
  })
  expect(pixels).toBeGreaterThan(100)
  await page.getByRole('button', { name: 'Undo edits' }).click()
  expect(await page.evaluate(() => sessionStorage.getItem('ucblogo.program.session.v1'))).not.toContain(program)
  await page.getByLabel('Ask Pip', { exact: true }).fill('How long is each side?')
  await page.getByLabel('Ask Pip', { exact: true }).press('Enter')
  await expect(page.getByText('Each side is 80 turtle steps.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Each side is 80 turtle steps.')).toBeVisible()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  await expect(page.getByText('What shall we draw?')).toBeVisible()
  expect(original).toBeNull()
})

test('Pip stops an in-flight response and can start again', async ({ page }) => {
  let count = 0
  await page.route('**/api/assistant', async route => {
    if (count++ === 0) { await new Promise(resolve => setTimeout(resolve, 1200)); await route.fulfill({ contentType: 'text/event-stream', body: tool('write_program', { code: 'PRINT 999' }) }).catch(() => {}); return }
    await route.fulfill({ contentType: 'text/event-stream', body: frame({ content: 'Ready to help again.' }) })
  })
  await page.goto('/')
  if (await page.getByRole('checkbox', { name: /Allow Pip/ }).isVisible()) await page.getByRole('checkbox', { name: /Allow Pip/ }).check()
  await page.getByLabel('Ask Pip', { exact: true }).fill('Make a drawing')
  await page.getByLabel('Ask Pip', { exact: true }).press('Enter')
  await expect.poll(() => count).toBe(1)
  await page.getByRole('button', { name: 'Stop turn' }).click()
  await expect(page.getByText('Turn stopped. Any completed edits are kept.')).toBeVisible()
  await page.getByLabel('Ask Pip', { exact: true }).fill('Hello again')
  await page.getByLabel('Ask Pip', { exact: true }).press('Enter')
  await expect(page.getByText('Ready to help again.')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('ucblogo.program.session.v1') ?? '')).not.toContain('PRINT 999')
})

test('Pip times out infinite Logo without freezing the editor', async ({ page }) => {
  let count = 0
  await page.route('**/api/assistant', route => route.fulfill({ contentType: 'text/event-stream', body: [tool('write_program', { code: 'FOREVER [FD 1 RT 1]' }), tool('run_program'), frame({ content: 'This loop needs a finite repeat count.' })][count++] }))
  await page.goto('/')
  if (await page.getByRole('checkbox', { name: /Allow Pip/ }).isVisible()) await page.getByRole('checkbox', { name: /Allow Pip/ }).check()
  await expect(page.locator('.monaco-editor')).toBeVisible()
  await page.getByLabel('Ask Pip', { exact: true }).fill('Test a loop')
  await page.getByLabel('Ask Pip', { exact: true }).press('Enter')
  await expect(page.getByText('This loop needs a finite repeat count.')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('log')).toContainText('3 seconds')
  await page.getByRole('button', { name: 'Close Pip' }).click()
  await expect(page.getByRole('complementary', { name: 'Pip assistant' })).toBeHidden()
})

test('Pip reports configuration errors and remains usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/assistant', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Pip is not connected yet.' }) }))
  await page.goto('/')
  if (await page.getByRole('checkbox', { name: /Allow Pip/ }).isVisible()) await page.getByRole('checkbox', { name: /Allow Pip/ }).check()
  await page.getByRole('button', { name: 'Pip assistant' }).click()
  await page.getByRole('checkbox', { name: /Allow Pip/ }).check()
  await page.getByRole('button', { name: 'Draw a soccer ball' }).click()
  await expect(page.getByText('Pip is not connected yet.')).toBeVisible()
  await expect(page.getByLabel('Ask Pip', { exact: true })).toBeEnabled()
  const panel = await page.getByRole('complementary', { name: 'Pip assistant' }).boundingBox()
  expect(panel!.x).toBeGreaterThanOrEqual(0)
  expect(panel!.width).toBeLessThanOrEqual(390)
})

// Exercise the real server route without consuming a model request or requiring a key.
test('Pip server route rejects invalid requests as JSON', async ({ page }) => {
  await page.goto('/')
  if (await page.getByRole('checkbox', { name: /Allow Pip/ }).isVisible()) await page.getByRole('checkbox', { name: /Allow Pip/ }).check()
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    return { status: response.status, body: await response.json() }
  })
  expect(result.status).toBe(400)
  expect(result.body.error).toContain('Invalid conversation')
})

test('Pip requires explicit opt-in before sending editor content', async ({ page }) => {
  let requests = 0
  await page.route('**/api/assistant', route => { requests++; return route.abort() })
  await page.goto('/')
  await page.getByLabel('Ask Pip', { exact: true }).fill('Explain this program')
  await expect(page.getByRole('button', { name: 'Send ↗' })).toBeDisabled()
  await page.getByLabel('Ask Pip', { exact: true }).press('Enter')
  expect(requests).toBe(0)
})
