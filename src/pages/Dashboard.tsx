import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Braces, ImagePlus, Layers3, Plus, ScanLine } from 'lucide-react'
import { api } from '../lib/api'
import type { LibraryResult } from '../lib/types'
import { Button } from '../components/ui/button'
import { SkillCard } from '../components/SkillCard'
import exampleArt from '../../examples/amber-study.png'

export default function Dashboard({
  version,
  onNew,
  onOpen,
  onLibrary,
  onError,
}: {
  version: number
  onNew: () => void
  onOpen: (id: string) => void
  onLibrary: () => void
  onError: (e: unknown) => void
}) {
  const [data, setData] = useState<LibraryResult | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    api
      .get<LibraryResult>('/api/skills?limit=3', controller.signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') onError(e)
      })
    return () => controller.abort()
  }, [version, onError])
  return (
    <div className="dashboard page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Your workspace</div>
          <h1>A home for your visual language.</h1>
          <p>
            Collect what inspires you. Understand the details. Make something that feels like you.
          </p>
        </div>
      </div>
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="soft-badge">
            <ImagePlus size={15} />
            From inspiration to instruction
          </span>
          <h2>
            Start with what
            <br />
            inspires <em>you.</em>
          </h2>
          <p>
            A color palette. A way of drawing. A particular kind of light. Turn the things you love
            about an image into a style you can use again.
          </p>
          <div className="welcome-actions">
            <Button onClick={onNew}>
              <Plus size={18} />
              Create a style
              <ArrowUpRight size={17} />
            </Button>
            <Button variant="ghost" onClick={onLibrary}>
              Explore your library
              <ArrowRight size={17} />
            </Button>
          </div>
          <span className="welcome-note">
            No account needed. Your references stay on your device.
          </span>
        </div>
        <div
          className="welcome-art"
          role="img"
          aria-label="A manually illustrated botanical reference study"
        >
          <div className="art-back" />
          <div className="art-front">
            <img src={exampleArt} alt="" />
            <span>Amber botanical study</span>
          </div>
          <div className="art-file">
            <Braces size={19} />
            <div>
              <strong>Your visual language.</strong>
              <span>Ready for the next idea.</span>
            </div>
          </div>
          <span className="art-note">Illustrated example · not AI output</span>
        </div>
      </section>
      <section className="workflow-strip" aria-label="How StyleDNA works">
        {[
          {
            icon: ImagePlus,
            number: '01',
            title: 'Bring your references',
            text: 'One image or a small moodboard.',
          },
          {
            icon: ScanLine,
            number: '02',
            title: 'Find the visual DNA',
            text: 'Analyze, review, and make it yours.',
          },
          {
            icon: Braces,
            number: '03',
            title: 'Take the style with you',
            text: 'Save a skill. Reuse it anywhere.',
          },
        ].map((step) => (
          <div key={step.number}>
            <span className="workflow-icon">
              <step.icon size={22} strokeWidth={1.6} />
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </div>
        ))}
      </section>
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <h2>Recent styles {data && <span>{data.total}</span>}</h2>
            <p>Your latest visual discoveries, ready to pick up again.</p>
          </div>
          <Button variant="ghost" onClick={onLibrary}>
            View library
            <ArrowRight size={17} />
          </Button>
        </div>
        {data?.items.length ? (
          <div className="skills-grid dashboard-grid">
            {data.items.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="empty-library">
            <div className="empty-symbol">
              <Layers3 size={29} strokeWidth={1.4} />
            </div>
            <div>
              <h3>{data ? 'Your saved styles will live here.' : 'Opening your local library…'}</h3>
              <p>
                {data
                  ? 'Start with a reference and build your first reusable style.'
                  : 'Loading the skills saved on this device.'}
              </p>
            </div>
            {data && (
              <Button variant="secondary" onClick={onNew}>
                Start a style
                <ArrowRight size={17} />
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
