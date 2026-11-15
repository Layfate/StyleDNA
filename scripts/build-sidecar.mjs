import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
const host = spawnSync('rustc', ['-vV'], { encoding: 'utf8', windowsHide: true })
if (host.status !== 0) throw new Error('Rust is required to determine the sidecar target')
const target = host.stdout.match(/^host: (.+)$/m)?.[1]?.trim()
if (!target) throw new Error('Could not determine native build target')
run('uv', ['run', 'pyinstaller', '--noconfirm', '--clean', '--onefile', '--noupx',
  '--name', 'styledna-service', '--paths', 'backend', '--collect-submodules', 'uvicorn',
  '--distpath', 'build/sidecar', '--workpath', 'build/pyinstaller', '--specpath', 'build',
  'scripts/sidecar-entry.py'])
mkdirSync('src-tauri/binaries', { recursive: true })
const suffix = process.platform === 'win32' ? '.exe' : ''
const destination = resolve(`src-tauri/binaries/styledna-service-${target}${suffix}`)
copyFileSync(`build/sidecar/styledna-service${suffix}`, destination)
console.log(`Packaged Python service: ${destination}`)
