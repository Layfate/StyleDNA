import { describe, expect, it } from 'vitest'
import {
  acceptSave,
  applyAnalysis,
  createDraft,
  discardChanges,
  isDirty,
  markSaved,
} from '../src/lib/editor'
import type { AnalysisResult } from '../src/lib/types'

describe('editor draft ownership', () => {
  it('discards from the saved snapshot without needing a service read', () => {
    const initial = createDraft()
    const saved = markSaved(initial, {
      profile: { ...initial.profile, name: 'Saved state' },
      revision: 1,
      markdown: '# Saved state',
    })
    const edited = { ...saved, profile: { ...saved.profile, name: 'Unsaved edits' } }
    const restored = discardChanges(edited)
    expect(restored.profile.name).toBe('Saved state')
    expect(isDirty(restored)).toBe(false)
    expect(restored.revision).toBe(1)
  })
  it('distinguishes unsaved new work from a saved revision', () => {
    const draft = createDraft()
    expect(isDirty(draft)).toBe(false)
    const edited = { ...draft, profile: { ...draft.profile, name: 'Amber ink' } }
    expect(isDirty(edited)).toBe(true)
    const saved = markSaved(edited, {
      profile: edited.profile,
      revision: 1,
      markdown: '# Amber ink',
    })
    expect(isDirty(saved)).toBe(false)
    expect(saved.revision).toBe(1)
  })

  it('rejects analysis for a changed reference set without losing manual edits', () => {
    const draft = createDraft()
    draft.profile.reference_ids = ['a'.repeat(32)]
    draft.profile.name = 'My intentional name'
    const result = {
      mode: 'measurements',
      palette: [{ hex: '#FF0000', share: 1 }],
      traits: {},
      positive_rules: [],
      negative_constraints: [],
      subject_exclusions: [],
      observations: [],
      model: null,
      analyzed_at: '2026-11-15',
    } as AnalysisResult
    const stale = applyAnalysis(draft, result, ['b'.repeat(32)])
    expect(stale).toBe(draft)
    const updated = applyAnalysis(draft, result, ['a'.repeat(32)])
    expect(updated.profile.name).toBe('My intentional name')
    expect(updated.profile.palette[0].hex).toBe('#FF0000')
  })

  it('measurement analysis preserves manually entered semantic traits and constraints', () => {
    const draft = createDraft()
    draft.profile.reference_ids = ['a'.repeat(32)]
    draft.profile.traits.lighting = { value: 'Warm rim lighting', source: 'user' }
    draft.profile.positive_rules = ['Keep wide negative space']
    const result = {
      mode: 'measurements',
      palette: [],
      traits: {},
      positive_rules: [],
      negative_constraints: [],
      subject_exclusions: [],
      observations: [],
      model: null,
      analyzed_at: '2026-11-15',
    } as AnalysisResult
    const updated = applyAnalysis(draft, result, draft.profile.reference_ids)
    expect(updated.profile.traits.lighting.value).toBe('Warm rim lighting')
    expect(updated.profile.positive_rules).toEqual(['Keep wide negative space'])
  })

  it('a save response preserves edits made after the submitted snapshot', () => {
    const initial = createDraft()
    const submitted = {
      ...initial.profile,
      name: 'Snapshot',
      palette: [{ hex: '#FF0000', share: 1 }],
    }
    const current = {
      ...initial,
      profile: { ...submitted, palette: [{ hex: '#0000FF', share: 1 }] },
    }
    const saved = {
      profile: { ...submitted, updated_at: '2026-11-15T00:00:00Z' },
      revision: 1,
      markdown: '# Snapshot',
    }
    const updated = acceptSave(current, submitted, saved)
    expect(updated.profile.palette[0].hex).toBe('#0000FF')
    expect(updated.revision).toBe(1)
    expect(isDirty(updated)).toBe(true)
    expect(isDirty(acceptSave({ ...initial, profile: submitted }, submitted, saved))).toBe(false)
  })
})
