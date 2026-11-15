import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  ArrowDownToLine,
  Braces,
  Check,
  ChevronDown,
  Clock3,
  FileJson2,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  PanelBottom,
  Plus,
  Save,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  UploadCloud,
  X,
} from 'lucide-react'
import { api, download, request } from '../lib/api'
import { applyAnalysis, isDirty, type Draft } from '../lib/editor'
import type { Job, ProfileChange, Reference, Revision, SavedSkill, Settings } from '../lib/types'
import { AssetImage } from '../components/AssetImage'
import { ResizableWorkspace } from '../components/ResizableWorkspace'
import { ProfileEditor } from '../components/studio/ProfileEditor'
import { SkillPreview } from '../components/studio/SkillPreview'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'
import { Menu, MenuItem } from '../components/ui/menu'
import { Tooltip } from '../components/ui/tooltip'

type Props = {
  draft: Draft
  setDraft: Dispatch<SetStateAction<Draft>>
  onSave: () => Promise<void>
  saving: boolean
  settings: Settings | null
  onSettings: () => void
  onError: (e: unknown) => void
  onNotice: (s: string) => void
  onRestored: (s: SavedSkill) => void
}

export default function Studio({
  draft,
  setDraft,
  onSave,
  saving,
  settings,
  onSettings,
  onError,
  onNotice,
  onRestored,
}: Props) {
  const { profile } = draft
  const [references, setReferences] = useState<Reference[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [mode, setMode] = useState<'measurements' | 'ollama'>('measurements')
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState(draft.markdown)
  const [previewError, setPreviewError] = useState('')
  const [previewPending, setPreviewPending] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [starting, setStarting] = useState(false)
  const [revisions, setRevisions] = useState<Revision[] | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const jobRef = useRef(job)
  const mounted = useRef(true)
  const running = starting || job?.state === 'queued' || job?.state === 'running'
  const busy = uploading || saving || running
  const dirty = isDirty(draft)
  jobRef.current = job
  const change: ProfileChange = (key, value) =>
    setDraft((current) => ({ ...current, profile: { ...current.profile, [key]: value } }))

  useEffect(() => {
    let active = true
    Promise.all(profile.reference_ids.map((id) => api.get<Reference>(`/api/assets/${id}/metadata`)))
      .then((items) => {
        if (active) setReferences(items)
      })
      .catch((e) => {
        if (active) onError(e)
      })
    return () => {
      active = false
    }
  }, [profile.reference_ids, onError])
  useEffect(() => {
    if (!showPreview) return
    const controller = new AbortController()
    setPreviewPending(true)
    const timeout = setTimeout(() => {
      if (!profile.name.trim()) {
        setPreviewError('Add a style name to generate the preview.')
        setPreviewPending(false)
        return
      }
      request('/api/preview', {
        method: 'POST',
        body: JSON.stringify(profile),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          if (!controller.signal.aborted) {
            setPreview(data.markdown)
            setPreviewError('')
          }
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setPreviewError(e.message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewPending(false)
        })
    }, 250)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [profile, showPreview])
  useEffect(() => {
    if (!job?.id || !['running', 'queued'].includes(job.state)) return
    let active = true
    const timeout = setTimeout(async () => {
      try {
        const next = await api.get<Job>(`/api/jobs/${job.id}`)
        if (active) setJob(next)
      } catch (e) {
        if (active) {
          onError(e)
          setJob(null)
        }
      }
    }, 400)
    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [job, onError])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const current = jobRef.current
      if (current && ['queued', 'running'].includes(current.state))
        api.delete(`/api/jobs/${current.id}`).catch(() => {})
    }
  }, [])

  async function upload(files: FileList | File[]) {
    if (busy || !files.length) return
    if (profile.reference_ids.length + files.length > 20)
      return onError(new Error('A style can have up to 20 references.'))
    setUploading(true)
    try {
      const form = new FormData()
      Array.from(files).forEach((file) => form.append('files', file))
      const imported = await api.upload<Reference[]>('/api/assets', form)
      if (!mounted.current) return
      setDraft((current) =>
        current.profile.id !== profile.id
          ? current
          : {
              ...current,
              profile: {
                ...current.profile,
                analysis: null,
                reference_ids: [...current.profile.reference_ids, ...imported.map((r) => r.id)],
              },
            },
      )
      setJob(null)
    } catch (e) {
      if (mounted.current) onError(e)
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }
  async function analyze() {
    setStarting(true)
    try {
      const next = await api.post<Job>('/api/jobs', {
        reference_ids: profile.reference_ids,
        mode,
        model: mode === 'ollama' ? settings?.ollama_model || null : null,
      })
      if (!mounted.current) {
        await api.delete(`/api/jobs/${next.id}`)
        return
      }
      setJob(next)
    } catch (e) {
      if (mounted.current) onError(e)
    } finally {
      setStarting(false)
    }
  }
  async function exportFile(format: 'zip' | 'json' | 'markdown') {
    try {
      await download(
        `/api/skills/${profile.id}/export?format=${format}&revision=${draft.revision}`,
        format === 'zip'
          ? `${profile.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.zip`
          : format === 'json'
            ? 'style.json'
            : 'SKILL.md',
      )
    } catch (e) {
      onError(e)
    }
  }
  async function history() {
    try {
      setRevisions(await api.get<Revision[]>(`/api/skills/${profile.id}/revisions`))
    } catch (e) {
      onError(e)
    }
  }
  async function restore(revision: number) {
    setRestoring(true)
    try {
      const saved = await api.post<SavedSkill>(`/api/skills/${profile.id}/restore`, {
        revision,
        expected_revision: draft.revision,
      })
      onRestored(saved)
      setRevisions(null)
      onNotice(`Restored as revision ${saved.revision}`)
    } catch (e) {
      onError(e)
    } finally {
      setRestoring(false)
    }
  }
  const step =
    draft.revision && !dirty
      ? 4
      : profile.analysis || job?.state === 'completed'
        ? 3
        : references.length
          ? 2
          : 1
  const canExport = draft.revision > 0 && !dirty && !busy

  const referenceBoard = (
    <section className="reference-panel workspace-panel" aria-label="Reference images">
      <div className="panel-heading">
        <div>
          <h2>
            Your references <span className="count-label">{references.length}/20</span>
          </h2>
          <p>The images that define your visual direction.</p>
        </div>
        <Tooltip label="Add reference images">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Add reference images"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Plus size={20} />
          </Button>
        </Tooltip>
      </div>
      <div
        className={`reference-scroll ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          upload(e.dataTransfer.files)
        }}
      >
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        {!references.length ? (
          <button className="upload-zone" disabled={busy} onClick={() => input.current?.click()}>
            <span className="upload-symbol">
              {uploading ? (
                <Loader2 size={28} className="spin" />
              ) : (
                <ImagePlus size={30} strokeWidth={1.5} />
              )}
            </span>
            <strong>
              {uploading ? 'Preparing your references…' : 'Start with an image that inspires you.'}
            </strong>
            <span>
              Drop images here, or <u>browse files</u>
            </span>
            <small>PNG, JPG, or WebP · up to 20 MiB each</small>
          </button>
        ) : (
          <>
            <div className="reference-list">
              {references.map((ref, index) => (
                <article className="reference-item" key={ref.id}>
                  <button
                    className="reference-photo"
                    onClick={() => setSelectedReference(ref)}
                    aria-label={`Preview ${ref.filename}`}
                  >
                    <AssetImage
                      id={ref.id}
                      alt={ref.filename}
                      variant={references.length === 1 ? 'preview' : 'thumbnail'}
                    />
                    <span className="reference-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="reference-zoom">Click to enlarge</span>
                  </button>
                  <div className="reference-meta">
                    <div>
                      <strong title={ref.filename}>{ref.filename}</strong>
                      <small>
                        {ref.width} × {ref.height} · {ref.format}
                      </small>
                    </div>
                    <Tooltip label="Remove reference">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${ref.filename}`}
                        disabled={busy}
                        onClick={() => {
                          change(
                            'reference_ids',
                            profile.reference_ids.filter((id) => id !== ref.id),
                          )
                          change('analysis', null)
                          setJob(null)
                        }}
                      >
                        <X size={17} />
                      </Button>
                    </Tooltip>
                  </div>
                </article>
              ))}
            </div>
            <Button
              variant="secondary"
              className="add-references"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              {uploading ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}Add more
              references
            </Button>
          </>
        )}
        {!references.length && (
          <div className="reference-tip">
            <p>
              One image is enough to start. A few references with different subjects help reveal
              what makes the style consistent.
            </p>
            <div>
              <ShieldCheck size={15} />
              Your original files stay untouched.
            </div>
          </div>
        )}
      </div>
      <div className="analysis-controls">
        <div
          className="analysis-detail-scroll"
          tabIndex={0}
          aria-label="Analysis progress and options"
        >
          {job && (
            <div className={`job-status ${job.state}`} role="status">
              <div className="flex-row between">
                <strong>{job.state === 'completed' ? 'Your analysis is ready.' : job.stage}</strong>
                {running && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Cancel analysis"
                    onClick={() =>
                      api.delete<Job>(`/api/jobs/${job.id}`).then(setJob).catch(onError)
                    }
                  >
                    <Square size={16} />
                  </Button>
                )}
              </div>
              {running && (
                <div className="progress-track">
                  <i style={{ width: `${job.progress}%` }} />
                </div>
              )}
              {job.error && <p>{job.error}</p>}
              {job.state === 'completed' && (
                <p>
                  {job.result?.mode === 'measurements'
                    ? 'Colors and image measurements are ready. Add semantic traits in the editor.'
                    : 'Review the visual interpretation and keep what fits.'}
                </p>
              )}
              {job.state === 'completed' && job.result && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraft((current) => applyAnalysis(current, job.result!, job.reference_ids))
                    setJob(null)
                    onNotice('Analysis applied. Review your style before saving.')
                  }}
                  disabled={saving}
                >
                  <Check size={17} />
                  Apply analysis
                </Button>
              )}
            </div>
          )}
          <details className="analysis-options">
            <summary>
              <SlidersHorizontal size={16} />
              <span>
                {mode === 'measurements'
                  ? 'Local measurements'
                  : settings?.ollama_model || 'Ollama vision'}
                <small>Analysis options</small>
              </span>
              <ChevronDown size={16} />
            </summary>
            <div>
              <label className="field">
                <span>Analysis mode</span>
                <select
                  value={mode}
                  aria-label="Analysis mode"
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  disabled={busy}
                >
                  <option value="measurements">Local measurements</option>
                  <option value="ollama">Ollama vision</option>
                </select>
              </label>
              <p className="field-help">
                {mode === 'measurements'
                  ? 'Measure colors and image statistics without AI. Describe visual traits yourself.'
                  : 'Reference previews are sent to your local Ollama vision model when you start analysis.'}
              </p>
              {mode === 'ollama' && !settings?.ollama_model && (
                <Button variant="secondary" size="sm" onClick={onSettings}>
                  Set up local Ollama
                </Button>
              )}
            </div>
          </details>
        </div>
        <Button
          className="analyze-button"
          onClick={analyze}
          disabled={
            busy || !profile.reference_ids.length || (mode === 'ollama' && !settings?.ollama_model)
          }
        >
          {running || uploading ? <Loader2 size={18} className="spin" /> : <ScanLine size={18} />}
          {running ? 'Analyzing references…' : 'Analyze references'}
        </Button>
        <span className="privacy-note">
          <ShieldCheck size={14} />
          {mode === 'measurements'
            ? 'Processed entirely on this device'
            : 'Uses your local Ollama service'}
        </span>
      </div>
    </section>
  )

  return (
    <div className="studio-page">
      <div className="studio-heading">
        <div>
          <h1>Style studio</h1>
          <div className="studio-subtitle">
            <span>
              {draft.revision
                ? profile.name
                : 'Turn a reference into your next creative starting point.'}
            </span>
            <span className={`save-status ${dirty ? 'unsaved' : ''}`}>
              <i />
              {dirty
                ? 'Unsaved changes'
                : draft.revision
                  ? `Revision ${draft.revision}`
                  : 'New style'}
            </span>
          </div>
        </div>
        <div className="studio-actions">
          <Tooltip label={showPreview ? 'Hide the Markdown preview' : 'Open the Markdown preview'}>
            <Button
              variant={showPreview ? 'secondary' : 'ghost'}
              aria-label="Show skill preview"
              aria-pressed={showPreview}
              onClick={() => setShowPreview((v) => !v)}
            >
              <PanelBottom size={18} />
              <span>Skill preview</span>
            </Button>
          </Tooltip>
          {draft.revision > 0 && (
            <Tooltip
              label={
                dirty
                  ? 'Save your changes before restoring a revision'
                  : 'View and restore saved revisions'
              }
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label="Version history"
                disabled={busy || dirty}
                onClick={history}
              >
                <Clock3 size={19} />
              </Button>
            </Tooltip>
          )}
          <div className="export-group">
            <Button
              variant="secondary"
              onClick={() => exportFile('zip')}
              disabled={!canExport}
              title={
                dirty ? 'Save changes before exporting' : 'Export a portable ZIP with references'
              }
            >
              <ArrowDownToLine size={18} />
              <span>Export package</span>
            </Button>
            <Menu
              trigger={
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="More export formats"
                  disabled={!canExport}
                >
                  <ChevronDown size={16} />
                </Button>
              }
            >
              <MenuItem onSelect={() => exportFile('markdown')}>
                <Braces size={17} />
                Export Markdown
              </MenuItem>
              <MenuItem onSelect={() => exportFile('json')}>
                <FileJson2 size={17} />
                Export style JSON
              </MenuItem>
            </Menu>
          </div>
          <Button onClick={onSave} disabled={saving || uploading || !profile.name.trim()}>
            {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            {saving ? 'Saving…' : 'Save skill'}
          </Button>
        </div>
      </div>
      <ol className="workflow-steps" aria-label="Style workflow">
        {['Upload references', 'Analyze style', 'Review & edit', 'Save or export'].map(
          (label, index) => (
            <li
              key={label}
              className={index + 1 === step ? 'current' : index + 1 < step ? 'complete' : ''}
              aria-current={index + 1 === step ? 'step' : undefined}
            >
              <span>{index + 1 < step ? <Check size={15} /> : index + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      <ResizableWorkspace
        references={referenceBoard}
        editor={<ProfileEditor profile={profile} revision={draft.revision} change={change} />}
        preview={
          showPreview ? (
            <SkillPreview
              text={preview}
              error={previewError}
              pending={previewPending}
              onClose={() => setShowPreview(false)}
              onError={onError}
            />
          ) : null
        }
      />
      <Dialog
        open={!!revisions}
        onOpenChange={(open) => {
          if (!open) setRevisions(null)
        }}
        title="Version history"
        description="Every save is a snapshot. Restoring creates a new revision and preserves the existing history."
      >
        <div className="revision-list">
          {revisions?.map((rev) => (
            <div key={rev.revision}>
              <span>
                <strong>Revision {rev.revision}</strong>
                <small>{new Date(rev.created_at).toLocaleString()}</small>
              </span>
              {rev.revision === draft.revision ? (
                <span className="soft-badge">Current</span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={restoring}
                  onClick={() => restore(rev.revision)}
                >
                  Restore revision {rev.revision}
                </Button>
              )}
            </div>
          ))}
        </div>
      </Dialog>
      <Dialog
        open={!!selectedReference}
        onOpenChange={(open) => {
          if (!open) setSelectedReference(null)
        }}
        title={selectedReference?.filename || 'Reference'}
        description="A closer look at your reference. Your original file is unchanged."
      >
        {selectedReference && (
          <AssetImage
            id={selectedReference.id}
            alt={selectedReference.filename}
            variant="preview"
            className="reference-dialog-image"
          />
        )}
      </Dialog>
    </div>
  )
}
