import { Braces, Check, Copy, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'
import { Tooltip } from '../ui/tooltip'

export function SkillPreview({
  text,
  error,
  pending,
  onClose,
  onError,
}: {
  text: string
  error: string
  pending: boolean
  onClose: () => void
  onError: (e: unknown) => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="preview-panel workspace-panel" aria-label="Skill Markdown preview">
      <div className="preview-toolbar">
        <div className="preview-file">
          <Braces size={18} />
          <strong>SKILL.md</strong>
          <span>Your reusable style instructions</span>
        </div>
        <div className="flex-row">
          {pending && (
            <span className="preview-updating" role="status">
              <Loader2 size={15} className="spin" />
              Updating
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={!text || !!error || pending}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text)
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              } catch (e) {
                onError(e)
              }
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy Markdown'}
          </Button>
          <Tooltip label="Close preview">
            <Button variant="ghost" size="icon" aria-label="Hide skill preview" onClick={onClose}>
              <X size={18} />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="preview-scroll" tabIndex={0} aria-label="Scrollable skill preview">
        {error ? (
          <div className="inline-error" role="alert">
            {error}
          </div>
        ) : (
          <pre aria-label="Generated skill preview">{text || 'Preparing your style skill…'}</pre>
        )}
      </div>
    </section>
  )
}
