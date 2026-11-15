import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, ChevronRight, Dna, FlaskConical, History, LayoutDashboard,
  Loader2, Plus, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { api } from './lib/api'
import { createDraft, isDirty, markSaved, type Draft } from './lib/editor'
import type { Page, SavedSkill, Settings } from './lib/types'
import { Button } from './components/ui/button'
import { Dialog } from './components/ui/dialog'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Studio = lazy(() => import('./pages/Studio'))
const Library = lazy(() => import('./pages/Library'))
const ProviderSettings = lazy(() => import('./pages/Settings'))
const Planned = lazy(() => import('./pages/Planned'))

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'studio', label: 'Image-to-Skill', icon: FlaskConical },
  { id: 'library', label: 'Skill Library', icon: BookOpen },
  { id: 'generator', label: 'AI Generator', icon: Sparkles, planned: true },
  { id: 'history', label: 'Image History', icon: History, planned: true },
] as const
const titles: Record<Page, string> = { dashboard: 'Overview', studio: 'Image-to-Skill Studio',
  library: 'Skill Library', settings: 'Settings & Providers', generator: 'AI Generator', history: 'Image History' }

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [draft, setDraft] = useState<Draft>(createDraft)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const actionRef = useRef({ newSkill: () => {}, save: () => {} })

  useEffect(() => { api.get<Settings>('/api/settings').then(setSettings).catch(e => setError(e.message)) }, [])
  useEffect(() => { document.documentElement.dataset.theme = settings?.theme || 'dark' }, [settings?.theme])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (isDirty(draft)) e.preventDefault() }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [draft])
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      if (e.key.toLowerCase() === 's') { e.preventDefault(); actionRef.current.save() }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); actionRef.current.newSkill() }
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [])

  const fail = useCallback((value: unknown) => setError(value instanceof Error ? value.message : String(value)), [])
  const guard = (action: () => void) => {
    if (saving) return
    if (isDirty(draft)) setPending(() => action)
    else action()
  }
  const newSkill = () => guard(() => { setDraft(createDraft()); setPage('studio') })
  const openSkill = (id: string) => guard(() => {
    api.get<SavedSkill>(`/api/skills/${id}`).then(saved => {
      setDraft(markSaved(draft, saved)); setPage('studio')
    }).catch(fail)
  })
  const save = async () => {
    if (saving || page !== 'studio') return
    setSaving(true)
    try {
      const saved = await api.save(draft.profile, draft.revision)
      setDraft(markSaved(draft, saved)); setVersion(v => v + 1)
      setNotice(`Saved ${saved.profile.name} · revision ${saved.revision}`)
    } catch (e) { fail(e) } finally { setSaving(false) }
  }
  actionRef.current = { newSkill, save }

  const discard = async () => {
    const action = pending
    try {
      if (draft.revision) {
        const saved = await api.get<SavedSkill>(`/api/skills/${draft.profile.id}`)
        setDraft(markSaved(draft, saved))
      } else setDraft(createDraft())
      setPending(null); action?.()
    } catch (e) { fail(e); setPending(null) }
  }

  return <MotionConfig reducedMotion="user"><div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to workspace</a>
    <aside className="sidebar">
      <button className="brand" onClick={() => guard(() => setPage('dashboard'))} aria-label="StyleDNA home"><span className="brand-icon"><Dna size={25} strokeWidth={1.6} /></span><span>Style<span className="brand-light">DNA</span><small>THE VISUAL STYLE LAB</small></span></button>
      <Button className="new-skill" variant="secondary" aria-label="New skill" onClick={newSkill}><Plus size={17} />New skill<span className="keycap" aria-hidden="true">⌘ N</span></Button>
      <span className="nav-caption">WORKSPACE</span>
      <nav aria-label="Main navigation">{nav.map(item => <button key={item.id}
        className={`nav-item ${page === item.id ? 'active' : ''}`}
        aria-label={item.label} aria-current={page === item.id ? 'page' : undefined}
        onClick={() => page !== item.id && guard(() => setPage(item.id))}>
        <item.icon size={18} strokeWidth={1.7} /><span>{item.label}</span>
        {'planned' in item && <span className="planned-dot" title="Planned for Phase 2" />}
      </button>)}</nav>
      <div className="sidebar-bottom"><div className="local-card"><ShieldCheck size={17} /><div><strong>Made to stay yours.</strong><p>Your references. Your device.</p></div></div>
        <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} aria-label="Settings & Providers" onClick={() => guard(() => setPage('settings'))}><Settings2 size={18} /><span>Settings & Providers</span></button>
        <div className="sidebar-version"><span className="status-dot" />Local workspace<span>v0.1.0</span></div>
      </div>
    </aside>
    <div className="app-body">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{titles[page]}</strong></div><div className="local-badge"><span className="status-dot" />Local-first<span className="topbar-divider" />PHASE 01</div></header>
      {error && <div className="global-error" role="alert"><span>{error}</span><Button variant="ghost" size="icon" aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></Button></div>}
      <main id="main-content" className={`main-content ${page === 'studio' ? 'studio-main' : ''}`}>
        <Suspense fallback={<div className="page-loading" role="status"><Loader2 className="spin" size={22} />Opening workspace…</div>}>
          {page === 'dashboard' && <Dashboard version={version} onNew={newSkill} onOpen={openSkill} onLibrary={() => setPage('library')} onError={fail} />}
          {page === 'studio' && <Studio draft={draft} setDraft={setDraft} onSave={save} saving={saving} settings={settings} onSettings={() => guard(() => setPage('settings'))} onError={fail} onNotice={setNotice}
            onRestored={saved => { setDraft(markSaved(draft, saved)); setVersion(v => v + 1) }} />}
          {page === 'library' && <Library version={version} onNew={newSkill} onOpen={openSkill} onError={fail} onNotice={setNotice} onChanged={() => setVersion(v => v + 1)} />}
          {page === 'settings' && <ProviderSettings settings={settings} onChange={setSettings} onError={fail} onNotice={setNotice} />}
          {(page === 'generator' || page === 'history') && <Planned type={page} onStudio={newSkill} />}
        </Suspense>
      </main>
      <footer className="app-footer"><span><ShieldCheck size={12} />No telemetry. No automatic uploads.</span><span>Turn images into reusable style skills.<ArrowUpRight size={12} /></span></footer>
    </div>
    {notice && <div className="toast" role="status"><span className="status-dot" />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
    <Dialog open={!!pending} onOpenChange={open => { if (!open) setPending(null) }} title="Keep your changes?" description="This style has unsaved changes. Save it first, or discard those changes to continue.">
      <div className="dialog-actions"><Button variant="secondary" onClick={() => setPending(null)}>Keep editing</Button><Button variant="destructive" onClick={discard}>Discard changes</Button></div>
    </Dialog>
  </div></MotionConfig>
}
