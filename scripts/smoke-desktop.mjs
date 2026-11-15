// Windows-only verification against the real Tauri WebView2 application via a test-only CDP port.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const probe = createServer()
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
const port = probe.address().port
await new Promise(resolve => probe.close(resolve))
const dataDir = resolve('test-results/native-data')
mkdirSync(dataDir, { recursive: true })
const app = spawn(resolve('src-tauri/target/release/styledna-desktop.exe'), [], {
  stdio: 'ignore', windowsHide: true,
  env: { ...process.env, STYLEDNA_DATA_DIR: dataDir,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1` },
})
let browser
try {
  for (let i = 0; i < 100; i++) {
    if (app.exitCode !== null) throw new Error(`Desktop exited before readiness: ${app.exitCode}`)
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break } catch {}
    await delay(300)
  }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
  const page = browser.contexts()[0].pages()[0] || await browser.contexts()[0].waitForEvent('page')
  const failures = []
  page.on('pageerror', e => failures.push(e.message))
  await page.getByRole('button', { name: 'New skill', exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/desktop-dashboard.png' })
  await page.getByRole('button', { name: 'New skill', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles('examples/amber-study.png')
  await page.getByRole('button', { name: 'Analyze references', exact: true }).click()
  await page.getByRole('button', { name: 'Apply analysis', exact: true }).click({ timeout: 20_000 })
  await page.getByLabel('Style name').fill('Native smoke study')
  await page.getByRole('button', { name: 'Save skill', exact: true }).click()
  await page.getByText('Revision 1', { exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/desktop-studio.png' })
  const nativeCheck = await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke
    const connection = await invoke('backend_connection')
    const response = await fetch(connection.url + '/api/skills', { headers: { Authorization: `Bearer ${connection.token}` } })
    let unsafeRejected = false
    try { await invoke('save_export', { path: '/api/settings', filename: 'bad.json' }) } catch { unsafeRejected = true }
    return { total: (await response.json()).total, url: connection.url, unsafeRejected }
  })
  if (!nativeCheck.total || !nativeCheck.unsafeRejected || failures.length) throw new Error(JSON.stringify({ nativeCheck, failures }))
  console.log('Tauri WebView2: real backend connection, upload, analysis, save, restricted export command PASS')
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('close_application')).catch(() => {})
  await delay(1500)
  try { await fetch(nativeCheck.url + '/health'); throw new Error('Owned service remained available after desktop exit') }
  catch (error) { if (error.message.includes('remained')) throw error }
  console.log('Tauri exit: owned sidecar stopped PASS')
} finally {
  await browser?.close().catch(() => {})
  if (app.exitCode === null) app.kill()
}
