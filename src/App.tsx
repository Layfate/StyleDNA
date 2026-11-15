import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { api } from './lib/api'
import {
  acceptSave,
  createDraft,
  discardChanges,
  isDirty,
  markSaved,
  type Draft,
} from './lib/editor'
import type { Page, SavedSkill, Settings } from './lib/types'
import { Button } from './components/ui/button'
import { Dialog } from './components/ui/dialog'
import { Tooltip, TooltipProvider } from './components/ui/tooltip'
import styleDnaLogo from '../assets/branding/styledna-logo.png'
import packageInfo from '../package.json'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Studio = lazy(() => import('./pages/Studio'))
const Library = lazy(() => import('./pages/Library'))
const ProviderSettings = lazy(() => import('./pages/Settings'))

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'studio', label: 'Image-to-Skill', icon: FlaskConical },
  { id: 'library', label: 'Skill Library', icon: BookOpen },
] as const
const titles: Record<Page, string> = {
  dashboard: 'Overview',
  studio: 'Image-to-Skill Studio',
  library: 'Skill Library',
  settings: 'Settings & Providers',
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [draft, setDraft] = useState<Draft>(createDraft)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [compact, setCompact] = useState(false)
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 1050)
  const [drawer, setDrawer] = useState(false)
  const [opening, setOpening] = useState(false)
  const navigation = useRef(0)
  const actionRef = useRef({ newSkill: () => {}, save: () => {}, close: () => {} })

  useEffect(() => {
    api
      .get<Settings>('/api/settings')
      .then(setSettings)
      .catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = settings?.theme || 'dark'
  }, [settings?.theme])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1050px)')
    const update = () => {
      setNarrow(media.matches)
      setDrawer(false)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    document.getElementById('main-content')?.scrollTo(0, 0)
  }, [page])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty(draft)) e.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [draft])
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        actionRef.current.save()
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        actionRef.current.newSkill()
      }
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [])
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return
    let active = true
    let unlisten: (() => void) | undefined
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen('desktop-close-requested', () => {
          actionRef.current.close()
        }),
      )
      .then((stop) => {
        if (active) {
          unlisten = stop
          import('@tauri-apps/api/core')
            .then(({ invoke }) => invoke('register_close_handler'))
            .catch((e) => setError(String(e)))
        } else stop()
      })
    return () => {
      active = false
      unlisten?.()
    }
  }, [])

  const fail = useCallback(
    (value: unknown) => setError(value instanceof Error ? value.message : String(value)),
    [],
  )
  const guard = (action: () => void) => {
    if (saving) return
    if (isDirty(draft)) setPending(() => action)
    else action()
  }
  const invalidateOpen = () => {
    navigation.current++
    setOpening(false)
  }
  const newSkill = () =>
    guard(() => {
      invalidateOpen()
      setDraft(createDraft())
      setPage('studio')
      setDrawer(false)
    })
  const openSkill = (id: string) =>
    guard(() => {
      const operation = ++navigation.current
      setOpening(true)
      api
        .get<SavedSkill>(`/api/skills/${id}`)
        .then((saved) => {
          if (navigation.current !== operation) return
          setDraft(markSaved(draft, saved))
          setPage('studio')
        })
        .catch((error) => {
          if (navigation.current === operation) fail(error)
        })
        .finally(() => {
          if (navigation.current === operation) setOpening(false)
        })
    })
  const save = async () => {
    if (saving || page !== 'studio') return
    setSaving(true)
    try {
      const saved = await api.save(draft.profile, draft.revision)
      setDraft((current) => acceptSave(current, draft.profile, saved))
      setVersion((v) => v + 1)
      setNotice(`Saved ${saved.profile.name} · revision ${saved.revision}`)
    } catch (e) {
      fail(e)
    } finally {
      setSaving(false)
    }
  }
  actionRef.current = {
    newSkill,
    save,
    close: () =>
      guard(() => {
        import('@tauri-apps/api/core').then(({ invoke }) => invoke('close_application')).catch(fail)
      }),
  }

  const discard = () => {
    const action = pending
    setDraft((current) => discardChanges(current))
    setPending(null)
    action?.()
  }

  const collapsed = (compact || narrow) && !drawer
  const go = (destination: Page) => {
    if (page === destination) {
      invalidateOpen()
      return
    }
    if (page !== destination)
      guard(() => {
        invalidateOpen()
        setPage(destination)
        setDrawer(false)
      })
  }
  const sidebarToggleLabel = drawer
    ? 'Close sidebar'
    : collapsed
      ? 'Expand sidebar'
      : 'Collapse sidebar'

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <div
          className={`app-shell ${collapsed ? 'sidebar-compact' : ''} ${drawer ? 'sidebar-drawer-open' : ''}`}
        >
          <a className="skip-link" href="#main-content">
            Skip to workspace
          </a>
          <aside className="sidebar">
            <button className="brand" onClick={() => go('dashboard')} aria-label="StyleDNA home">
              <span className="brand-icon">
                <img src={styleDnaLogo} alt="" draggable={false} />
              </span>
              <span className="brand-name">
                Style<span className="brand-light">DNA</span>
              </span>
            </button>
            <Tooltip label="New skill · Ctrl / ⌘ N">
              <Button
                className="new-skill"
                variant="secondary"
                aria-label="New skill"
                onClick={newSkill}
              >
                <Plus size={19} />
                <span>New skill</span>
              </Button>
            </Tooltip>
            <nav aria-label="Main navigation">
              <div className="nav-group">
                <span className="nav-caption">Workspace</span>
                {nav.map((item) => (
                  <Tooltip key={item.id} label={item.id === 'studio' ? 'Style studio' : item.label}>
                    <button
                      className={`nav-item ${page === item.id ? 'active' : ''}`}
                      aria-label={item.label}
                      aria-current={page === item.id ? 'page' : undefined}
                      onClick={() => go(item.id)}
                    >
                      <item.icon size={20} strokeWidth={1.7} />
                      <span>
                        {item.id === 'studio'
                          ? 'Style studio'
                          : item.id === 'library'
                            ? 'Skill library'
                            : item.label}
                      </span>
                    </button>
                  </Tooltip>
                ))}
              </div>
            </nav>
            <div className="sidebar-bottom">
              <Tooltip label="Settings & Providers">
                <button
                  className={`nav-item ${page === 'settings' ? 'active' : ''}`}
                  aria-label="Settings & Providers"
                  aria-current={page === 'settings' ? 'page' : undefined}
                  onClick={() => go('settings')}
                >
                  <Settings2 size={20} />
                  <span>Settings</span>
                </button>
              </Tooltip>
              <div className="local-card">
                <ShieldCheck size={18} />
                <div>
                  <strong>Private by design</strong>
                  <p>Your work stays with you.</p>
                </div>
              </div>
              <div className="sidebar-version">
                <span className="status-dot" />
                <span>Local workspace</span>
                <span>v{packageInfo.version}</span>
              </div>
            </div>
          </aside>
          {drawer && (
            <button
              className="sidebar-backdrop"
              aria-label="Close navigation"
              onClick={() => setDrawer(false)}
            />
          )}
          <div className="app-body">
            <header className="topbar">
              <div className="topbar-left">
                <Tooltip label={sidebarToggleLabel}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={sidebarToggleLabel}
                    onClick={() => (narrow ? setDrawer((v) => !v) : setCompact((v) => !v))}
                  >
                    {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                  </Button>
                </Tooltip>
                <div className="breadcrumbs">
                  <span>Workspace</span>
                  <ChevronRight size={15} />
                  <strong>{titles[page]}</strong>
                </div>
              </div>
              <div className="local-badge">
                <ShieldCheck size={16} />
                On this device
              </div>
            </header>
            {error && (
              <div className="global-error" role="alert">
                <AlertCircle size={20} />
                <div>
                  <strong>Something needs your attention</strong>
                  <p>{error}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Dismiss error"
                  onClick={() => setError('')}
                >
                  <X size={18} />
                </Button>
              </div>
            )}
            <main
              id="main-content"
              className={`main-content ${page === 'studio' ? 'studio-main' : ''}`}
            >
              <Suspense
                fallback={
                  <div className="page-loading" role="status">
                    <Loader2 className="spin" size={22} />
                    Opening workspace…
                  </div>
                }
              >
                {page === 'dashboard' && (
                  <Dashboard
                    version={version}
                    onNew={newSkill}
                    onOpen={openSkill}
                    onLibrary={() => go('library')}
                    onError={fail}
                  />
                )}
                {page === 'studio' && (
                  <Studio
                    key={draft.profile.id}
                    draft={draft}
                    setDraft={setDraft}
                    onSave={save}
                    saving={saving}
                    settings={settings}
                    onSettings={() => go('settings')}
                    onError={fail}
                    onNotice={setNotice}
                    onRestored={(saved) => {
                      setDraft(markSaved(draft, saved))
                      setVersion((v) => v + 1)
                    }}
                  />
                )}
                {page === 'library' && (
                  <Library
                    version={version}
                    onNew={newSkill}
                    onOpen={openSkill}
                    onError={fail}
                    onNotice={setNotice}
                    onChanged={() => setVersion((v) => v + 1)}
                    onDeleted={(id) => {
                      invalidateOpen()
                      setDraft((current) => (current.profile.id === id ? createDraft() : current))
                    }}
                  />
                )}
                {page === 'settings' && (
                  <ProviderSettings
                    settings={settings}
                    onChange={setSettings}
                    onError={fail}
                    onNotice={setNotice}
                  />
                )}
              </Suspense>
            </main>
            <footer className="app-footer">
              <span>
                <span className="status-dot" />
                Private, local workspace
              </span>
              <span>
                <kbd>Ctrl / ⌘ S</kbd> Save skill
              </span>
            </footer>
          </div>
          {notice && (
            <div className="toast" role="status">
              <span className="status-dot" />
              {notice}
              <button onClick={() => setNotice('')} aria-label="Dismiss notification">
                <X size={14} />
              </button>
            </div>
          )}
          {opening && (
            <div className="opening-status" role="status">
              <Loader2 size={17} className="spin" />
              Opening style…
              <Button size="sm" variant="ghost" onClick={invalidateOpen}>
                Cancel
              </Button>
            </div>
          )}
          <Dialog
            open={!!pending}
            onOpenChange={(open) => {
              if (!open) setPending(null)
            }}
            title="Keep your changes?"
            description="This style has unsaved changes. Save it first, or discard those changes to continue."
          >
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setPending(null)}>
                Keep editing
              </Button>
              <Button variant="destructive" onClick={discard}>
                Discard changes
              </Button>
            </div>
          </Dialog>
        </div>
      </TooltipProvider>
    </MotionConfig>
  )
}
