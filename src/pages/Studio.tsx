import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowDownToLine, Braces, Check, ChevronDown, CircleHelp, Clock3, Copy, FileCode2,
  ImagePlus, Loader2, PanelRightClose, PanelRightOpen, Plus, Save, ScanLine, ShieldCheck,
  Sparkles, Square, UploadCloud, X } from 'lucide-react'
import { api, download, request } from '../lib/api'
import { applyAnalysis, isDirty, type Draft } from '../lib/editor'
import { traitLabels, type Job, type Reference, type Revision, type SavedSkill, type Settings,
  type StyleProfile, type TraitKey } from '../lib/types'
import { AssetImage } from '../components/AssetImage'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'

type Props = {
  draft: Draft; setDraft: Dispatch<SetStateAction<Draft>>; onSave: () => Promise<void>; saving: boolean;
  settings: Settings | null; onSettings: () => void; onError: (e: unknown) => void;
  onNotice: (s: string) => void; onRestored: (s: SavedSkill) => void
}

function TagsInput({ profile, update }: { profile: StyleProfile; update: (tags: string[]) => void }) {
  const [text, setText] = useState(profile.tags.join(', '))
  useEffect(() => setText(profile.tags.join(', ')), [profile.id, profile.tags])
  return <label className="field"><span>Tags <small>comma separated</small></span><input value={text}
    placeholder="editorial, warm, organic" maxLength={800} onChange={e => setText(e.target.value)}
    onBlur={() => update([...new Set(text.split(',').map(t => t.trim()).filter(Boolean))].slice(0, 20))} /></label>
}

export default function Studio({ draft, setDraft, onSave, saving, settings, onSettings, onError, onNotice, onRestored }: Props) {
  const { profile } = draft
  const [references, setReferences] = useState<Reference[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [mode, setMode] = useState<'measurements' | 'ollama'>('measurements')
  const [tab, setTab] = useState<'profile' | 'rules'>('profile')
  const [showPreview, setShowPreview] = useState(true)
  const [preview, setPreview] = useState(draft.markdown)
  const [previewError, setPreviewError] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [starting, setStarting] = useState(false)
  const [revisions, setRevisions] = useState<Revision[] | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const jobRef = useRef(job)
  const busy = uploading || saving || starting || job?.state === 'queued' || job?.state === 'running'
  jobRef.current = job

  const change = <K extends keyof StyleProfile>(key: K, value: StyleProfile[K]) => {
    setDraft(current => ({ ...current, profile: { ...current.profile, [key]: value } }))
  }
  useEffect(() => {
    let active = true
    Promise.all(profile.reference_ids.map(id => api.get<Reference>(`/api/assets/${id}/metadata`)))
      .then(items => { if (active) setReferences(items) }).catch(e => { if (active) onError(e) })
    return () => { active = false }
  }, [profile.reference_ids, onError])
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      if (!profile.name.trim()) { setPreviewError('Add a style name to generate the preview.'); return }
      request('/api/preview', {
        method: 'POST', body: JSON.stringify(profile), signal: controller.signal,
      }).then(r => r.json()).then(data => { setPreview(data.markdown); setPreviewError('') })
        .catch(e => { if (e.name !== 'AbortError') setPreviewError(e.message) })
    }, 300)
    return () => { clearTimeout(timeout); controller.abort() }
  }, [profile])
  useEffect(() => {
    if (!job?.id || !['running', 'queued'].includes(job.state)) return
    let active = true
    const timeout = setTimeout(async () => {
      try {
        const next = await api.get<Job>(`/api/jobs/${job.id}`)
        if (active) setJob(next)
      } catch (e) { if (active) { onError(e); setJob(null) } }
    }, 400)
    return () => { active = false; clearTimeout(timeout) }
  }, [job, onError])
  useEffect(() => () => {
    const current = jobRef.current
    if (current && ['queued', 'running'].includes(current.state)) api.delete(`/api/jobs/${current.id}`).catch(() => {})
  }, [])

  async function upload(files: FileList | File[]) {
    if (busy || !files.length) return
    if (profile.reference_ids.length + files.length > 20) return onError(new Error('A style can have up to 20 references.'))
    setUploading(true)
    try {
      const form = new FormData()
      Array.from(files).forEach(file => form.append('files', file))
      const imported = await api.upload<Reference[]>('/api/assets', form)
      setDraft(current => current.profile.id !== profile.id ? current : ({ ...current,
        profile: { ...current.profile, analysis: null,
          reference_ids: [...current.profile.reference_ids, ...imported.map(r => r.id)] } }))
      setJob(null)
    } catch (e) { onError(e) } finally { setUploading(false); if (input.current) input.current.value = '' }
  }
  async function analyze() {
    setStarting(true)
    try {
      const next = await api.post<Job>('/api/jobs', { reference_ids: profile.reference_ids, mode,
        model: mode === 'ollama' ? settings?.ollama_model || null : null })
      setJob(next)
    } catch (e) { onError(e) } finally { setStarting(false) }
  }
  async function exportFile(format: 'zip' | 'json' | 'markdown') {
    try {
      await download(`/api/skills/${profile.id}/export?format=${format}&revision=${draft.revision}`,
        format === 'zip' ? `${profile.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.zip` : format === 'json' ? 'style.json' : 'SKILL.md')
    } catch (e) { onError(e) }
  }
  async function history() {
    try { setRevisions(await api.get<Revision[]>(`/api/skills/${profile.id}/revisions`)) } catch (e) { onError(e) }
  }
  async function restore(revision: number) {
    setRestoring(true)
    try {
      const saved = await api.post<SavedSkill>(`/api/skills/${profile.id}/restore`, { revision, expected_revision: draft.revision })
      onRestored(saved); setRevisions(null); onNotice(`Restored as revision ${saved.revision}`)
    } catch (e) { onError(e) } finally { setRestoring(false) }
  }

  return <div className="studio-page">
    <div className="studio-heading"><div><div className="eyebrow">THE STYLE LAB</div><div className="studio-title"><h1>{draft.revision ? profile.name : 'Discover a new visual language.'}</h1><span className={`save-status ${isDirty(draft) ? 'unsaved' : ''}`}><i />{isDirty(draft) ? 'Unsaved changes' : draft.revision ? `Revision ${draft.revision}` : 'New style'}</span></div></div>
      <div className="flex-row studio-actions"><Button variant="ghost" size="icon" title={showPreview ? 'Hide skill preview' : 'Show skill preview'} aria-label={showPreview ? 'Hide skill preview' : 'Show skill preview'} onClick={() => setShowPreview(v => !v)}>{showPreview ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}</Button>
        {draft.revision > 0 && <Button variant="secondary" size="icon" aria-label="Version history" title="Version history" disabled={busy || isDirty(draft)} onClick={history}><Clock3 size={17} /></Button>}
        <Button variant="secondary" onClick={() => exportFile('zip')} disabled={!draft.revision || isDirty(draft) || busy} title={isDirty(draft) ? 'Save changes before exporting' : 'Export saved revision'}><ArrowDownToLine size={16} />Export package</Button>
        <Button onClick={onSave} disabled={busy || !profile.name.trim()}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}Save skill</Button>
      </div>
    </div>
    <div className={`studio-workspace ${showPreview ? '' : 'preview-closed'}`}>
      <section className="reference-panel workspace-panel"><div className="panel-heading"><span><small>01</small>References</span><span className="count-label">{profile.reference_ids.length} / 20</span></div>
        <div className="reference-scroll">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={e => e.target.files && upload(e.target.files)} />
          <button className={`upload-zone ${dragging ? 'dragging' : ''} ${references.length ? 'compact' : ''}`} disabled={busy}
            onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files) }}>
            {uploading ? <Loader2 size={26} className="spin" /> : <span className="upload-symbol"><UploadCloud size={25} strokeWidth={1.4} /></span>}
            <strong>{uploading ? 'Preparing references…' : references.length ? 'Add more references' : 'Drop your inspiration here'}</strong>
            <span>{references.length ? 'or drop images here' : <>or <u>browse files</u> to get started</>}</span>
            {!references.length && <small>PNG, JPG, WEBP · up to 20 MiB each</small>}
          </button>
          <div className="reference-list">{references.map((ref, index) => <div className="reference-item" key={ref.id}>
            <button className="reference-photo" onClick={() => setSelectedReference(ref)} aria-label={`Preview ${ref.filename}`}><AssetImage id={ref.id} alt={ref.filename} /><span>{String(index + 1).padStart(2, '0')}</span></button>
            <div className="reference-meta"><div><strong title={ref.filename}>{ref.filename}</strong><small>{ref.width} × {ref.height} · {ref.format}</small></div><Button variant="ghost" size="icon" aria-label={`Remove ${ref.filename}`} disabled={busy} onClick={() => { change('reference_ids', profile.reference_ids.filter(id => id !== ref.id)); change('analysis', null); setJob(null) }}><X size={14} /></Button></div>
          </div>)}</div>
          {!references.length && <div className="reference-tip"><CircleHelp size={15} /><p>Choose images that share a visual style. Different subjects help separate the style from the content.</p></div>}
        </div>
        <div className="analysis-controls"><div className="flex-row between"><label htmlFor="analysis-mode">Analysis mode</label><span className="tiny-label">LOCAL</span></div>
          <div className="select-wrap"><select id="analysis-mode" value={mode} onChange={e => setMode(e.target.value as typeof mode)} disabled={busy}><option value="measurements">Local measurements</option><option value="ollama">Ollama vision</option></select><ChevronDown size={14} /></div>
          <p className="analysis-description">{mode === 'measurements' ? 'Extract colors and image statistics. Add visual traits yourself.' : settings?.ollama_model ? `Interpret visual traits with ${settings.ollama_model}.` : 'Choose an installed local vision model in Settings first.'}</p>
          {mode === 'ollama' && !settings?.ollama_model && <Button variant="ghost" size="sm" onClick={onSettings}>Configure Ollama<ArrowDownToLine size={13} /></Button>}
          {job && <div className={`job-status ${job.state}`} role="status"><div className="flex-row between"><span>{job.stage}</span>{['running', 'queued'].includes(job.state) && <button aria-label="Cancel analysis" onClick={() => api.delete<Job>(`/api/jobs/${job.id}`).then(setJob).catch(onError)}><Square size={12} /></button>}</div><div className="progress-track"><i style={{ width: `${job.progress}%` }} /></div>
            {job.error && <p>{job.error}</p>}
            {job.state === 'completed' && job.result && <Button size="sm" variant="secondary" onClick={() => {
              setDraft(current => applyAnalysis(current, job.result!, job.reference_ids)); setJob(null); onNotice('Analysis applied. Review the profile before saving.')
            }}><Check size={14} />Apply analysis</Button>}
          </div>}
          <Button className="analyze-button" onClick={analyze} disabled={busy || !profile.reference_ids.length || (mode === 'ollama' && !settings?.ollama_model)}>{busy && !saving ? <Loader2 size={16} className="spin" /> : mode === 'ollama' ? <Sparkles size={16} /> : <ScanLine size={16} />}Analyze references</Button>
          <span className="privacy-note"><ShieldCheck size={12} />{mode === 'measurements' ? 'Processed entirely on this device' : 'Sent to your local Ollama service'}</span>
        </div>
      </section>
      <section className="profile-panel workspace-panel"><div className="panel-heading"><span><small>02</small>Style profile</span><span className="tiny-label">EDITABLE</span></div>
        <div className="profile-tabs" role="tablist" aria-label="Profile sections"><button role="tab" aria-selected={tab === 'profile'} onClick={() => setTab('profile')}>Visual profile</button><button role="tab" aria-selected={tab === 'rules'} onClick={() => setTab('rules')}>Generation rules<span>{profile.positive_rules.filter(Boolean).length + profile.negative_constraints.filter(Boolean).length}</span></button></div>
        <div className="profile-scroll" role="tabpanel" aria-label={tab === 'profile' ? 'Visual profile' : 'Generation rules'}>
          {tab === 'profile' ? <>
            <label className="field"><span>Style name</span><input aria-label="Style name" value={profile.name} maxLength={120} disabled={saving} onChange={e => change('name', e.target.value)} placeholder="Give this visual language a name" /></label>
            <label className="field"><span>Description</span><textarea aria-label="Description" value={profile.description} maxLength={2000} disabled={saving} rows={3} onChange={e => change('description', e.target.value)} placeholder="What makes this style feel like itself?" /></label>
            <div className="field-row"><label className="field"><span>Category</span><input value={profile.category} maxLength={64} disabled={saving} onChange={e => change('category', e.target.value)} placeholder="Illustration" /></label><TagsInput profile={profile} update={tags => change('tags', tags)} /></div>
            <div className="profile-divider"><span>COLOR LANGUAGE</span><small>{profile.palette.length ? `${profile.palette.length} colors` : 'Not measured yet'}</small></div>
            {profile.palette.length ? <div className="palette-editor">{profile.palette.map((color, index) => <div key={index} className="palette-color"><label title="Edit palette color"><input type="color" value={color.hex} aria-label={`Palette color ${index + 1}`} onChange={e => change('palette', profile.palette.map((c, i) => i === index ? { ...c, hex: e.target.value.toUpperCase() } : c))} /><span style={{ background: color.hex }} /></label><code>{color.hex}</code><small>{Math.round(color.share * 100)}%</small><button aria-label={`Remove color ${color.hex}`} onClick={() => {
                const left = profile.palette.filter((_, i) => i !== index); const total = left.reduce((s, c) => s + c.share, 0)
                change('palette', left.map(c => ({ ...c, share: total ? c.share / total : 1 / left.length })))
              }}><X size={12} /></button></div>)}
              {profile.palette.length < 12 && <button className="add-color" aria-label="Add palette color" onClick={() => change('palette', [...profile.palette, { hex: '#BFA77A', share: 0 }].map(c => ({ ...c, share: 1 / (profile.palette.length + 1) })))}><Plus size={16} /></button>}</div> : <button className="palette-empty" onClick={() => change('palette', [{ hex: '#BFA77A', share: 1 }])}><span className="empty-swatches"><i /><i /><i /><i /></span><span>Analyze references or add a color manually.</span><Plus size={15} /></button>}
            <div className="profile-divider"><span>VISUAL TRAITS</span><small>{profile.analysis?.mode === 'ollama' ? 'AI interpretation · review required' : 'Your observations'}</small></div>
            <div className="traits-form">{(Object.keys(traitLabels) as TraitKey[]).map(key => <label key={key} className="field trait-field"><span>{traitLabels[key]}<small className="source-label">{profile.traits[key]?.value ? profile.traits[key].source === 'ollama' ? 'OLLAMA' : 'EDITED' : 'UNASSESSED'}</small></span><textarea aria-label={traitLabels[key]} value={profile.traits[key]?.value || ''} disabled={saving} rows={2} maxLength={2000} onChange={e => change('traits', { ...profile.traits, [key]: { value: e.target.value, source: 'user' } })} placeholder={`Describe ${traitLabels[key].toLowerCase()}…`} /></label>)}</div>
            {profile.analysis && <div className="measurement-details"><div className="profile-divider"><span>MEASURED EVIDENCE</span><small>White matte · normalized previews</small></div>{profile.analysis.observations.map((observation, i) => <div key={observation.reference_id} className="measurement-row"><strong>Reference {i + 1}</strong><span>Luminance <b>{Math.round(observation.measurements.luminance * 100)}%</b></span><span>Saturation <b>{Math.round(observation.measurements.saturation * 100)}%</b></span><span>Contrast <b>{Math.round(observation.measurements.contrast * 100)}%</b></span><span>Edges <b>{Math.round(observation.measurements.edge_density * 100)}%</b></span></div>)}</div>}
          </> : <><div className="editor-tip"><Sparkles size={17} /><p>Write instructions that work for a new subject. One rule per line. Your manual rules are preserved when analysis is applied.</p></div>{[
            ['positive_rules', 'Generation rules', 'Use broad organic shapes\nKeep a restrained, warm palette'],
            ['negative_constraints', 'Negative constraints', 'Avoid glossy surfaces\nAvoid hard digital gradients'],
            ['subject_exclusions', 'Subject independence', 'Do not require the objects or characters in the references'],
          ].map(([key, label, placeholder]) => <label key={key} className="field rule-field"><span>{label}</span><textarea aria-label={label} value={profile[key as 'positive_rules'].join('\n')} rows={7} disabled={saving} maxLength={12000} onChange={e => change(key as 'positive_rules', e.target.value ? e.target.value.split('\n').slice(0, 32) : [])} placeholder={placeholder} /></label>)}</>}
        </div>
        <div className="panel-footnote"><span className="status-dot" />{profile.analysis ? `Analyzed with ${profile.analysis.mode === 'measurements' ? 'local measurements' : profile.analysis.model}` : 'A profile you can make your own.'}</div>
      </section>
      {showPreview && <section className="preview-panel workspace-panel"><div className="panel-heading"><span><small>03</small>Skill preview</span><FileCode2 size={15} /></div><div className="preview-file"><Braces size={15} /><span>SKILL.md</span><span className="tiny-label">MARKDOWN</span></div><div className="preview-scroll">{previewError ? <div className="preview-error">{previewError}</div> : <pre aria-label="Generated skill preview">{preview || '# Your style skill\n\nStart with a name, a reference,\nand the details that make it yours.'}</pre>}</div><div className="preview-footer"><div><ShieldCheck size={14} /><p>Prompt guidance, not model training.<br />Results depend on your generator.</p></div><div className="flex-row"><Button variant="secondary" size="sm" disabled={!preview || !!previewError} onClick={() => navigator.clipboard.writeText(preview).then(() => onNotice('Skill Markdown copied.')).catch(onError)}><Copy size={13} />Copy</Button><Button variant="ghost" size="sm" onClick={() => exportFile('markdown')} disabled={!draft.revision || isDirty(draft)}>Markdown</Button><Button variant="ghost" size="sm" onClick={() => exportFile('json')} disabled={!draft.revision || isDirty(draft)}>JSON</Button></div></div></section>}
    </div>
    <Dialog open={!!revisions} onOpenChange={open => { if (!open) setRevisions(null) }} title="Version history" description="Every save is a snapshot. Restoring a snapshot creates a new revision and keeps the existing history."><div className="revision-list">{revisions?.map(rev => <div key={rev.revision}><span><strong>Revision {rev.revision}</strong><small>{new Date(rev.created_at).toLocaleString()}</small></span>{rev.revision === draft.revision ? <span className="outlined-tag">Current</span> : <Button variant="secondary" size="sm" disabled={restoring} onClick={() => restore(rev.revision)}>Restore revision {rev.revision}</Button>}</div>)}</div></Dialog>
    <Dialog open={!!selectedReference} onOpenChange={open => { if (!open) setSelectedReference(null) }} title={selectedReference?.filename || 'Reference'} description="Normalized reference preview. Your original file is unchanged.">{selectedReference && <AssetImage id={selectedReference.id} alt={selectedReference.filename} variant="preview" className="reference-dialog-image" />}</Dialog>
  </div>
}
