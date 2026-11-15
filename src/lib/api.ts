import type { SavedSkill, StyleProfile } from './types'

type Connection = { url: string; token: string }
let connection: Promise<Connection> | undefined

async function getConnection(): Promise<Connection> {
  if (!connection) {
    connection = (async () => {
      if ('__TAURI_INTERNALS__' in window) {
        const { invoke } = await import('@tauri-apps/api/core')
        return invoke<Connection>('backend_connection')
      }
      return { url: '', token: '' } // The development proxy authenticates server-side.
    })()
    connection.catch(() => { connection = undefined })
  }
  return connection
}

export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const { url, token } = await getConnection()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(url + path, { ...init, headers })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('The local service is unavailable. Restart StyleDNA or the development launcher.')
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.error || `Request failed (${response.status})`)
  }
  return response
}

export const api = {
  get: async <T>(path: string, signal?: AbortSignal): Promise<T> => (await request(path, { signal })).json(),
  post: async <T>(path: string, data: unknown = {}): Promise<T> =>
    (await request(path, { method: 'POST', body: JSON.stringify(data) })).json(),
  put: async <T>(path: string, data: unknown): Promise<T> =>
    (await request(path, { method: 'PUT', body: JSON.stringify(data) })).json(),
  delete: async <T>(path: string): Promise<T> => (await request(path, { method: 'DELETE' })).json(),
  upload: async <T>(path: string, form: FormData): Promise<T> =>
    (await request(path, { method: 'POST', body: form })).json(),
  save: (profile: StyleProfile, expected_revision: number) =>
    api.post<SavedSkill>('/api/skills', { profile, expected_revision }),
}

export async function download(path: string, filename: string): Promise<void> {
  if ('__TAURI_INTERNALS__' in window) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('save_export', { filename, path })
    return
  }
  const blob = await (await request(path)).blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
