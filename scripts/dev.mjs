import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const desktop = process.argv.includes('--desktop')
const dataDir = process.env.STYLEDNA_DATA_DIR || resolve('.styledna-dev')
mkdirSync(dataDir, { recursive: true })
const token = randomBytes(32).toString('hex')
let frontend
let closing = false
const backend = desktop
  ? null
  : spawn('uv', ['run', 'python', '-m', 'styledna', '--data-dir', dataDir], {
      stdio: ['pipe', 'pipe', 'inherit'],
      windowsHide: true,
    })

function close(code = 0) {
  if (closing) return
  closing = true
  frontend?.kill()
  backend?.stdin.end()
  const timer = setTimeout(() => {
    backend?.kill()
    process.exit(code)
  }, 4000)
  timer.unref()
  if (!backend || backend.exitCode !== null) process.exit(code)
  else backend.once('exit', () => process.exit(code))
}
process.on('SIGINT', () => close())
process.on('SIGTERM', () => close())

function startFrontend(url) {
  const args = desktop
    ? ['node_modules/@tauri-apps/cli/tauri.js', 'dev']
    : ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '1420', '--strictPort']
  frontend = spawn(process.execPath, args, {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, STYLEDNA_BACKEND_URL: url, STYLEDNA_BACKEND_TOKEN: token },
  })
  frontend.on('error', (error) => {
    console.error(error.message)
    close(1)
  })
  frontend.on('exit', (code) => close(code || 0))
}
if (desktop) {
  startFrontend('') // The Rust host owns its service; Vite only serves UI assets.
} else {
  backend.on('error', (error) => {
    console.error(`Could not start backend: ${error.message}`)
    close(1)
  })
  backend.on('exit', (code) => {
    if (!closing) {
      console.error('Backend stopped.')
      close(code || 1)
    }
  })
  const startup = setTimeout(() => {
    console.error('Backend startup timed out')
    close(1)
  }, 30000)
  const lines = createInterface({ input: backend.stdout })
  lines.on('line', (line) => {
    try {
      const message = JSON.parse(line)
      if (message.event === 'ready' && !frontend) {
        clearTimeout(startup)
        console.log(`StyleDNA local service ready. Development data: ${dataDir}`)
        startFrontend(message.url)
      }
    } catch {
      /* Backend diagnostics use stderr; ignore non-protocol stdout. */
    }
  })
  backend.stdin.write(JSON.stringify({ token }) + '\n')
}
