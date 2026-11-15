import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('comfortable workspace has adjustable panels and a collapsible readable preview', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: 'New skill', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Style workflow' })).toBeVisible()
  const divider = page.getByRole('separator', { name: 'Resize references panel', exact: true })
  await expect(divider).toBeVisible()
  const board = page.getByRole('region', { name: 'Reference images', exact: true })
  const before = await board.boundingBox()
  await divider.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  expect((await board.boundingBox())!.width).toBeGreaterThan(before!.width + 10)
  const handle = (await divider.boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 100)
  await page.mouse.down()
  await page.mouse.move(handle.x - 65, handle.y + 100)
  await page.mouse.up()
  expect((await board.boundingBox())!.width).toBeLessThan(before!.width)
  await page.getByRole('button', { name: 'Show skill preview', exact: true }).click()
  const code = page.getByLabel('Generated skill preview')
  await expect(code).toBeVisible()
  expect(
    await code.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(13)
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('## Visual language')
  await page.getByRole('button', { name: 'Hide skill preview', exact: true }).click()
  await expect(code).toHaveCount(0)
  await page.screenshot({ path: 'test-results/redesign-studio-empty.png' })
})

test('readability, image space, resizing and focus survive normal desktop window sizes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByRole('button', { name: 'New skill', exact: true }).click()
  await page
    .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles('examples/amber-study.png')
  await expect(page.getByRole('button', { name: 'Preview amber-study.png' })).toBeVisible()
  expect(
    (await page.getByRole('button', { name: 'Preview amber-study.png' }).boundingBox())!.height,
  ).toBeGreaterThanOrEqual(240)
  for (const width of [1440, 1280, 1100, 900]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('button', { name: 'Save skill', exact: true })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    expect(
      await page
        .getByLabel('Style name')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(14)
    expect(
      await page
        .getByRole('button', { name: 'Save skill', exact: true })
        .evaluate((el) => el.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(40)
    await page.screenshot({ path: `test-results/redesign-${width}.png`, fullPage: true })
  }
  await page.getByLabel('Style name').focus()
  expect(
    await page.getByLabel('Style name').evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe('none')
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Image-to-Skill', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('studio and settings have accessible names, contrast, and structure', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: 'New skill', exact: true }).click()
  const studio = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(studio.violations).toEqual([])
  await page.getByRole('button', { name: 'Settings & Providers', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Your workspace|Settings/ })).toBeVisible()
  const settings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(settings.violations).toEqual([])
})

test('short windows keep analysis actions reachable with options and preview open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 700 })
  await page.goto('/')
  await page.getByRole('heading', { name: 'A home for your visual language.' }).waitFor()
  await page.getByRole('button', { name: 'New skill', exact: true }).click()
  await page
    .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles('examples/amber-study.png')
  await page.getByRole('button', { name: 'Analyze references', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Apply analysis', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Show skill preview', exact: true }).click()
  await page.locator('.analysis-options > summary').click()
  await expect(
    page.getByRole('button', { name: 'Analyze references', exact: true }),
  ).toBeInViewport({ ratio: 1 })
  const apply = page.getByRole('button', { name: 'Apply analysis', exact: true })
  await apply.scrollIntoViewIfNeeded()
  await expect(apply).toBeInViewport({ ratio: 1 })
  await apply.click()
  await expect(page.getByRole('button', { name: 'Save skill', exact: true })).toBeInViewport({
    ratio: 1,
  })
  await page.screenshot({ path: 'test-results/redesign-1100x700.png' })
})
