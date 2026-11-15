import { useEffect, useState } from 'react'
import { ChevronDown, Plus, SlidersHorizontal, Sparkles, Tag, X } from 'lucide-react'
import { traitLabels, type ProfileChange, type StyleProfile, type TraitKey } from '../../lib/types'
import { Button } from '../ui/button'

function TagsInput({
  profile,
  revision,
  change,
}: {
  profile: StyleProfile
  revision: number
  change: ProfileChange
}) {
  const [text, setText] = useState(profile.tags.join(', '))
  useEffect(() => setText(profile.tags.join(', ')), [profile.id, revision])
  return (
    <label className="field">
      <span>
        Tags <small>Separate with commas</small>
      </span>
      <input
        aria-label="Tags"
        value={text}
        placeholder="editorial, warm, organic"
        maxLength={800}
        onChange={(e) => {
          setText(e.target.value)
          change(
            'tags',
            [
              ...new Set(
                e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              ),
            ].slice(0, 20),
          )
        }}
        onBlur={() => setText(profile.tags.join(', '))}
      />
    </label>
  )
}

export function ProfileEditor({
  profile,
  revision,
  change,
}: {
  profile: StyleProfile
  revision: number
  change: ProfileChange
}) {
  const [tab, setTab] = useState<'profile' | 'rules'>('profile')
  const traitField = (key: TraitKey) => (
    <label key={key} className="field trait-field">
      <span>
        {traitLabels[key]}
        <small className="source-label">
          {profile.traits[key]?.value
            ? profile.traits[key].source === 'ollama'
              ? 'AI suggestion'
              : 'Your edit'
            : 'Optional'}
        </small>
      </span>
      <textarea
        aria-label={traitLabels[key]}
        value={profile.traits[key]?.value || ''}
        rows={3}
        maxLength={2000}
        onChange={(e) =>
          change('traits', { ...profile.traits, [key]: { value: e.target.value, source: 'user' } })
        }
        placeholder={`What do you notice about ${traitLabels[key].toLowerCase()}?`}
      />
    </label>
  )

  return (
    <section className="profile-panel workspace-panel" aria-label="Style profile editor">
      <div className="panel-heading">
        <div>
          <h2>Review & edit</h2>
          <p>Keep the details that make this style its own.</p>
        </div>
        <span className="soft-badge">Editable</span>
      </div>
      <div
        className="profile-tabs"
        role="tablist"
        aria-label="Profile sections"
        onKeyDown={(e) => {
          if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
          e.preventDefault()
          const next =
            e.key === 'Home'
              ? 'profile'
              : e.key === 'End'
                ? 'rules'
                : tab === 'profile'
                  ? 'rules'
                  : 'profile'
          setTab(next)
          document.getElementById(`tab-${next}`)?.focus()
        }}
      >
        <button
          id="tab-profile"
          role="tab"
          aria-controls="profile-content"
          aria-selected={tab === 'profile'}
          tabIndex={tab === 'profile' ? 0 : -1}
          onClick={() => setTab('profile')}
        >
          Visual profile
        </button>
        <button
          id="tab-rules"
          role="tab"
          aria-controls="profile-content"
          aria-selected={tab === 'rules'}
          tabIndex={tab === 'rules' ? 0 : -1}
          onClick={() => setTab('rules')}
        >
          Generation rules
        </button>
      </div>
      <div
        id="profile-content"
        className="profile-scroll"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'profile' ? (
          <>
            <label className="field">
              <span>Style name</span>
              <input
                aria-label="Style name"
                value={profile.name}
                maxLength={120}
                onChange={(e) => change('name', e.target.value)}
                placeholder="A name for this visual language"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                aria-label="Description"
                value={profile.description}
                maxLength={2000}
                rows={3}
                onChange={(e) => change('description', e.target.value)}
                placeholder="A few words about the mood, character, and feel of this style."
              />
            </label>
            <div className="editor-section-title">
              <h3>Color palette</h3>
              <span>
                {profile.palette.length
                  ? `${profile.palette.length} colors · click to edit`
                  : 'Measured or chosen by you'}
              </span>
            </div>
            {profile.palette.length ? (
              <div className="palette-editor">
                {profile.palette.map((color, index) => (
                  <div key={index} className="palette-color">
                    <label title={`Edit ${color.hex}`}>
                      <input
                        type="color"
                        value={color.hex}
                        aria-label={`Palette color ${index + 1}`}
                        onChange={(e) =>
                          change(
                            'palette',
                            profile.palette.map((c, i) =>
                              i === index ? { ...c, hex: e.target.value.toUpperCase() } : c,
                            ),
                          )
                        }
                      />
                      <span style={{ background: color.hex }} />
                    </label>
                    <code>{color.hex}</code>
                    <div className="palette-caption">
                      <small>{Math.round(color.share * 100)}%</small>
                      <button
                        aria-label={`Remove color ${color.hex}`}
                        title="Remove color"
                        onClick={() => {
                          const left = profile.palette.filter((_, i) => i !== index)
                          const total = left.reduce((s, c) => s + c.share, 0)
                          change(
                            'palette',
                            left.map((c) => ({
                              ...c,
                              share: total ? c.share / total : 1 / left.length,
                            })),
                          )
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {profile.palette.length < 12 && (
                  <button
                    className="add-color"
                    aria-label="Add palette color"
                    title="Add a color"
                    onClick={() =>
                      change(
                        'palette',
                        [...profile.palette, { hex: '#BFA77A', share: 0 }].map((c) => ({
                          ...c,
                          share: 1 / (profile.palette.length + 1),
                        })),
                      )
                    }
                  >
                    <Plus size={19} />
                  </button>
                )}
              </div>
            ) : (
              <button
                className="palette-empty"
                onClick={() => change('palette', [{ hex: '#BFA77A', share: 1 }])}
              >
                <span className="empty-swatches">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span>Analyze references or add a color manually.</span>
                <Plus size={18} />
              </button>
            )}
            <div className="editor-section-title">
              <h3>Visual character</h3>
              <span>
                {profile.analysis?.mode === 'ollama'
                  ? 'Review the AI suggestions'
                  : 'Your observations'}
              </span>
            </div>
            {!profile.analysis && (
              <p className="field-help section-help">
                Analysis can help you get started. You can also describe the style yourself.
              </p>
            )}
            {(['visual_identity', 'lighting', 'rendering'] as TraitKey[]).map(traitField)}
            <details className="editor-disclosure">
              <summary>
                <SlidersHorizontal size={17} />
                <span>
                  More visual traits
                  <small>Linework, textures, shapes, composition, backgrounds</small>
                </span>
                <ChevronDown size={17} />
              </summary>
              <div className="disclosure-body">
                {(['linework', 'texture', 'shapes', 'composition', 'background'] as TraitKey[]).map(
                  traitField,
                )}
              </div>
            </details>
            <details className="editor-disclosure">
              <summary>
                <Tag size={17} />
                <span>
                  Organize this skill<small>Category and tags for your library</small>
                </span>
                <ChevronDown size={17} />
              </summary>
              <div className="disclosure-body">
                <label className="field">
                  <span>Category</span>
                  <input
                    value={profile.category}
                    maxLength={64}
                    onChange={(e) => change('category', e.target.value)}
                    placeholder="Illustration"
                  />
                </label>
                <TagsInput profile={profile} revision={revision} change={change} />
              </div>
            </details>
            {profile.analysis && (
              <details className="editor-disclosure">
                <summary>
                  <SlidersHorizontal size={17} />
                  <span>
                    Measured evidence
                    <small>Image statistics, separate from style interpretation</small>
                  </span>
                  <ChevronDown size={17} />
                </summary>
                <div className="disclosure-body measurement-details">
                  <p className="field-help">
                    Measurements use bounded previews on a white background. They describe image
                    statistics, not semantic style.
                  </p>
                  {profile.analysis.observations.map((observation, i) => (
                    <div key={observation.reference_id} className="measurement-row">
                      <strong>Reference {i + 1}</strong>
                      <dl>
                        {Object.entries({
                          Luminance: observation.measurements.luminance,
                          Saturation: observation.measurements.saturation,
                          Contrast: observation.measurements.contrast,
                          'Edge density': observation.measurements.edge_density,
                        }).map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{Math.round(value * 100)}%</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <>
            <div className="editor-tip">
              <Sparkles size={20} />
              <p>
                Write rules that work for a new subject. Use one instruction per line. Applying
                analysis preserves your manual rules.
              </p>
            </div>
            {[
              [
                'positive_rules',
                'Generation rules',
                'What should stay consistent?',
                'Use broad organic shapes\nKeep a restrained, warm palette',
              ],
              [
                'negative_constraints',
                'Negative constraints',
                'What should the generator avoid?',
                'Avoid glossy surfaces\nAvoid hard digital gradients',
              ],
              [
                'subject_exclusions',
                'Subject independence',
                'Separate the style from the original subject.',
                'The new subject does not need the objects or characters in the references',
              ],
            ].map(([key, label, hint, placeholder]) => (
              <label key={key} className="field rule-field">
                <span>{label}</span>
                <p className="field-help">{hint}</p>
                <textarea
                  aria-label={label}
                  value={profile[key as 'positive_rules'].join('\n')}
                  rows={6}
                  maxLength={12000}
                  onChange={(e) =>
                    change(
                      key as 'positive_rules',
                      e.target.value ? e.target.value.split('\n').slice(0, 32) : [],
                    )
                  }
                  placeholder={placeholder}
                />
              </label>
            ))}
            <Button variant="ghost" onClick={() => setTab('profile')}>
              Back to visual profile
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
