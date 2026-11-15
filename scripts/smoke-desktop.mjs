// Windows-only verification against the real Tauri WebView2 application via a test-only CDP port.
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const probe = createServer()
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
const port = probe.address().port
await new Promise((resolve) => probe.close(resolve))
const dataDir = resolve('test-results/native-data')
mkdirSync(dataDir, { recursive: true })
const app = spawn(resolve('src-tauri/target/release/styledna-desktop.exe'), [], {
  stdio: 'ignore',
  windowsHide: true,
  env: {
    ...process.env,
    STYLEDNA_DATA_DIR: dataDir,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
  },
})
let browser
const windowAction = (action, ...args) =>
  exec(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve('scripts/native-window.ps1'),
      '-TaskProcessId',
      String(app.pid),
      '-Action',
      action,
      ...args,
    ],
    { windowsHide: true, timeout: 15_000 },
  )
try {
  for (let i = 0; i < 100; i++) {
    if (app.exitCode !== null) throw new Error(`Desktop exited before readiness: ${app.exitCode}`)
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break
    } catch {}
    await delay(300)
  }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
  const page =
    browser.contexts()[0].pages()[0] || (await browser.contexts()[0].waitForEvent('page'))
  const failures = []
  page.on('pageerror', (e) => failures.push(e.message))
  await page.getByRole('button', { name: 'New skill', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'A home for your visual language.' }).waitFor()
  await page.screenshot({ path: 'test-results/desktop-dashboard.png' })
  await page.getByRole('button', { name: 'New skill', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles('examples/amber-study.png')
  await page.getByRole('button', { name: 'Analyze references', exact: true }).click()
  await page.getByRole('button', { name: 'Apply analysis', exact: true }).click({ timeout: 20_000 })
  await page.getByLabel('Style name').fill('Amber botanical study')
  await page
    .getByLabel('Description')
    .fill('Warm architectural shapes, a restrained earth palette, and a quiet botanical character.')
  await page.getByLabel('Lighting & shadows').fill('Soft ambient light. Broad, gentle shadows.')
  await page.getByRole('button', { name: 'Save skill', exact: true }).click()
  await page.getByText('Revision 1', { exact: true }).waitFor()
  await page.locator('.profile-scroll').evaluate((el) => {
    el.scrollTop = 0
  })
  if (await page.getByRole('button', { name: 'Dismiss notification' }).count())
    await page.getByRole('button', { name: 'Dismiss notification' }).click()
  await page.screenshot({ path: 'test-results/desktop-studio.png' })
  if (await page.evaluate(() => window.visualViewport.scale !== 1))
    throw new Error('Desktop is not at normal zoom')
  for (const width of [1440, 1280, 1100, 900]) {
    await windowAction('Resize', '-Width', String(width), '-Height', '960')
    await delay(250)
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
      throw new Error(`Desktop overflows at ${width}px`)
    if (
      (await page
        .getByLabel('Style name')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) < 14
    )
      throw new Error('Desktop form text is too small')
    await page.screenshot({ path: `test-results/desktop-${width}.png` })
  }
  await windowAction('Resize', '-Width', '1440', '-Height', '960')
  await page.getByRole('button', { name: 'Show skill preview', exact: true }).click()
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click()
  await windowAction('CheckClipboard')
  await page.getByRole('button', { name: 'Hide skill preview', exact: true }).click()
  const destination = resolve(`test-results/native-export-${Date.now()}.zip`)
  await page.getByRole('button', { name: 'Export package', exact: true }).click()
  await windowAction('SaveDialog', '-Destination', destination)
  for (let i = 0; i < 100 && !existsSync(destination); i++) await delay(100)
  if (!existsSync(destination) || statSync(destination).size < 100)
    throw new Error('Native save dialog did not produce the ZIP export')
  await page.getByRole('button', { name: 'Skill Library', exact: true }).click()
  await page.getByRole('heading', { name: 'Your style library', exact: true }).waitFor()
  await page
    .getByRole('button', { name: 'Open Amber botanical study', exact: true })
    .first()
    .waitFor()
  await page.screenshot({ path: 'test-results/desktop-library.png' })
  await page.getByRole('button', { name: 'Settings & Providers', exact: true }).click()
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/desktop-settings.png' })
  await page.getByRole('button', { name: 'Daylight', exact: false }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
  await page.screenshot({ path: 'test-results/desktop-settings-light.png' })
  await page.getByRole('button', { name: 'After hours', exact: false }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  await page.getByRole('button', { name: 'AI Generator', exact: true }).click()
  await page.getByText('Image generation is coming in Phase 2.').waitFor()
  await page.screenshot({ path: 'test-results/desktop-planned.png' })
  await page.getByRole('button', { name: 'Skill Library', exact: true }).click()
  await page
    .getByRole('button', { name: 'Open Amber botanical study', exact: true })
    .first()
    .click()
  await page.getByLabel('Style name').waitFor()
  const nativeCheck = await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke
    const connection = await invoke('backend_connection')
    const response = await fetch(connection.url + '/api/skills', {
      headers: { Authorization: `Bearer ${connection.token}` },
    })
    let unsafeRejected = false
    try {
      await invoke('save_export', { path: '/api/settings', filename: 'bad.json' })
    } catch {
      unsafeRejected = true
    }
    return { total: (await response.json()).total, url: connection.url, unsafeRejected }
  })
  if (!nativeCheck.total || !nativeCheck.unsafeRejected || failures.length)
    throw new Error(JSON.stringify({ nativeCheck, failures }))
  console.log(
    'Tauri WebView2: upload, analysis, edit, save, native ZIP export, preview/copy and 1440/1280/1100/900px resizing at normal zoom PASS',
  )
  await page
    .getByLabel('Description')
    .fill('This unsaved edit must survive a native window close request.')
  await windowAction('StopService')
  await delay(500)
  await windowAction('Close')
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  if (
    (await page.getByLabel('Description').inputValue()) !==
    'This unsaved edit must survive a native window close request.'
  )
    throw new Error('Native close discarded unsaved work')
  await windowAction('Close')
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await delay(1500)
  try {
    await fetch(nativeCheck.url + '/health')
    throw new Error('Owned service remained available after desktop exit')
  } catch (error) {
    if (error.message.includes('remained')) throw error
  }
  console.log(
    'Tauri native close: unsaved changes guarded even after backend failure; discard and owned-process cleanup PASS',
  )
} finally {
  await browser?.close().catch(() => {})
  if (app.exitCode === null) app.kill()
}
