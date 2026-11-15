import { useEffect, useState } from 'react'
import { Check, CircleHelp, Database, HardDrive, Loader2, Monitor, Moon, RefreshCw, ShieldCheck, Sun } from 'lucide-react'
import { api } from '../lib/api'
import type { ProviderState, Settings } from '../lib/types'
import { Button } from '../components/ui/button'

export default function ProviderSettings({ settings, onChange, onError, onNotice }:
  { settings: Settings | null; onChange: (s: Settings) => void; onError: (e: unknown) => void; onNotice: (s: string) => void }) {
  const [url, setUrl] = useState(settings?.ollama_url || 'http://127.0.0.1:11434')
  const [provider, setProvider] = useState<ProviderState | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (settings) setUrl(settings.ollama_url) }, [settings?.ollama_url])
  async function update(values: Partial<Settings>) {
    try { onChange(await api.put<Settings>('/api/settings', values)) } catch (e) { onError(e) }
  }
  async function connect() {
    setBusy(true)
    try {
      const saved = await api.put<Settings>('/api/settings', { ollama_url: url })
      onChange(saved)
      const result = await api.get<ProviderState>('/api/providers/ollama')
      setProvider(result)
      if (result.available) onNotice('Connected to local Ollama.')
    } catch (e) { onError(e) } finally { setBusy(false) }
  }
  return <div className="page settings-page"><div className="page-heading"><div><div className="eyebrow">MAKE YOURSELF AT HOME</div><h1>Your workspace. Your rules.</h1><p>Local by default, with the tools you choose to connect.</p></div></div>
    <section className="settings-section"><div className="settings-label"><Monitor size={20} /><div><h2>Appearance</h2><p>Set the tone for your creative work.</p></div></div><div className="theme-options">{(['dark', 'light'] as const).map(theme => <button key={theme} className={`theme-option ${settings?.theme === theme ? 'selected' : ''}`} onClick={() => update({ theme })}><div className={`theme-sample ${theme}`}><i /><span><b /><b /><b /></span></div><span>{theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}{theme === 'dark' ? 'After hours' : 'Daylight'}{settings?.theme === theme && <Check size={15} />}</span></button>)}</div></section>
    <section className="settings-section"><div className="settings-label"><HardDrive size={20} /><div><h2>Local AI · Ollama</h2><p>Interpret semantic traits with an installed vision model.</p></div><span className="outlined-tag">OPTIONAL</span></div><div className="provider-explanation"><ShieldCheck size={17} /><p>Reference previews are sent only when you select Ollama vision and start analysis. This phase supports local models on loopback addresses. Cloud-routed models are excluded.</p></div><div className="connection-form"><label className="field"><span>Ollama address</span><input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://127.0.0.1:11434" disabled={busy} /></label><Button variant="secondary" onClick={connect} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}Save & check connection</Button></div>
      {provider && <div className={`provider-status ${provider.available ? 'connected' : ''}`} role="status"><span className="status-dot" />{provider.available ? `Connected · ${provider.models.filter(m => m.vision).length} vision model(s) available` : provider.error}</div>}
      <label className="field model-selection"><span>Analysis model</span><select value={settings?.ollama_model || ''} disabled={busy || !provider?.available} onChange={e => update({ ollama_model: e.target.value })}><option value="">Select an installed vision model</option>{settings?.ollama_model && !provider?.models.some(m => m.name === settings.ollama_model) && <option value={settings.ollama_model}>{settings.ollama_model} · check connection to verify</option>}{provider?.models.map(model => <option key={model.name} value={model.name} disabled={!model.vision}>{model.name}{!model.vision ? ` · ${model.reason}` : ''}</option>)}</select></label>
      <div className="settings-help"><CircleHelp size={15} /><p>Install Ollama and a compatible vision model yourself, then check the connection. StyleDNA does not download models. You can always use local measurements and manual editing without AI.</p></div>
    </section>
    <section className="settings-section"><div className="settings-label"><Database size={20} /><div><h2>Your local data</h2><p>Skills, revisions, and managed reference copies stay on this device.</p></div></div><div className="data-location"><span>APPLICATION DATA DIRECTORY</span><code>{settings?.data_directory || 'Waiting for local service…'}</code></div><p className="settings-help-text">Export portable ZIP packages from the studio to back up or share a saved style. Original image files are never modified. No telemetry is collected.</p></section>
  </div>
}
