import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  FolderOpen,
  Import,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react'
import { api } from '../lib/api'
import type { LibraryResult, SavedSkill, SkillSummary } from '../lib/types'
import { SkillCard } from '../components/SkillCard'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'

export default function Library({
  version,
  onNew,
  onOpen,
  onError,
  onNotice,
  onChanged,
  onDeleted,
}: {
  version: number
  onNew: () => void
  onOpen: (id: string) => void
  onError: (e: unknown) => void
  onNotice: (s: string) => void
  onChanged: () => void
  onDeleted: (id: string) => void
}) {
  const [data, setData] = useState<LibraryResult | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [tag, setTag] = useState('')
  const [favorite, setFavorite] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<SkillSummary | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setOffset(0)
  }, [query, category, tag, favorite])
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      setLoading(true)
      api
        .get<LibraryResult>(
          `/api/skills?${new URLSearchParams({ q: query, category, tag, favorite: String(favorite), offset: String(offset) })}`,
          controller.signal,
        )
        .then(setData)
        .catch((e) => {
          if (e.name !== 'AbortError') onError(e)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 200)
    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [query, category, tag, favorite, offset, version, onError])
  async function toggleFavorite(skill: SkillSummary) {
    if (busy) return
    setBusy(true)
    try {
      const current = await api.get<SavedSkill>(`/api/skills/${skill.id}`)
      await api.save({ ...current.profile, favorite: !current.profile.favorite }, current.revision)
      onChanged()
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }
  async function duplicate(id: string) {
    setBusy(true)
    try {
      await api.post(`/api/skills/${id}/duplicate`)
      onChanged()
      onNotice('Style duplicated.')
      setOffset(0)
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      await api.delete(`/api/skills/${deleting.id}`)
      onDeleted(deleting.id)
      setDeleting(null)
      onChanged()
      setOffset(0)
      onNotice('Style deleted.')
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }
  async function importFile(file: File) {
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const saved = await api.upload<SavedSkill>('/api/import', form)
      onChanged()
      onNotice('Style package imported.')
      onOpen(saved.profile.id)
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div className="page library-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Your collection</div>
          <h1>Your style library</h1>
          <p>The visual languages you’ve collected, refined, and made your own.</p>
        </div>
        <div className="flex-row">
          <input
            type="file"
            accept=".zip"
            hidden
            ref={input}
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Import size={16} />}Import package
          </Button>
          <Button onClick={onNew}>
            <Plus size={16} />
            Create style
          </Button>
        </div>
      </div>
      <div className="library-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search skills"
            value={query}
            placeholder="Search names, descriptions, tags…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {data?.categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {data?.tags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Button
          variant={favorite ? 'secondary' : 'ghost'}
          onClick={() => setFavorite((v) => !v)}
          aria-pressed={favorite}
        >
          <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
          Favorites
        </Button>
      </div>
      <div className="library-count" role="status">
        <span>
          {loading ? 'Searching…' : `${data?.total ?? 0} style${data?.total === 1 ? '' : 's'}`}
        </span>
        <span>Saved on this device</span>
      </div>
      {data?.items.length ? (
        <div className="skills-grid">
          {data.items.map((skill) => (
            <div className="library-card-wrap" key={skill.id}>
              <SkillCard skill={skill} onOpen={onOpen} onFavorite={toggleFavorite} />
              <div className="library-card-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => duplicate(skill.id)}
                >
                  <Copy size={13} />
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setDeleting(skill)}
                  aria-label={`Delete ${skill.name}`}
                >
                  <Trash2 size={13} />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="library-empty-state">
            <FolderOpen size={38} strokeWidth={1.2} />
            <h2>
              {query || category || tag || favorite
                ? 'No styles match this view.'
                : 'Your collection starts here.'}
            </h2>
            <p>
              {query || category || tag || favorite
                ? 'Try another search or clear a filter.'
                : 'Create your first style or import a portable StyleDNA package.'}
            </p>
            <Button variant="secondary" onClick={onNew}>
              <ImageLabel />
              Create a style
            </Button>
          </div>
        )
      )}
      {!!data?.total && (
        <div className="pagination">
          <span>
            {offset + 1}–{Math.min(offset + 24, data.total)} of {data.total}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((v) => Math.max(0, v - 24))}
          >
            <ArrowLeft size={14} />
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={offset + 24 >= data.total || loading}
            onClick={() => setOffset((v) => v + 24)}
          >
            Next
            <ArrowRight size={14} />
          </Button>
        </div>
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null)
        }}
        title="Delete this style?"
        description={`“${deleting?.name || ''}” and all its revisions will be removed. References used by other skills are kept. Export a package first if you need a backup.`}
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={remove} disabled={busy}>
            <Trash2 size={15} />
            Delete style
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function ImageLabel() {
  return <Plus size={16} />
}
