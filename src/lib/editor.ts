import {
  traitLabels,
  type AnalysisResult,
  type SavedSkill,
  type StyleProfile,
  type TraitKey,
} from './types'

export type Draft = {
  profile: StyleProfile
  revision: number
  savedFingerprint: string
  markdown: string
}
export const fingerprint = (profile: StyleProfile) => JSON.stringify(profile)

export function createDraft(): Draft {
  const timestamp = new Date().toISOString()
  const profile: StyleProfile = {
    schema_version: 1,
    id: crypto.randomUUID().replaceAll('-', ''),
    name: 'Untitled style',
    description: '',
    category: 'Uncategorized',
    tags: [],
    favorite: false,
    palette: [],
    reference_ids: [],
    analysis: null,
    positive_rules: [],
    negative_constraints: [],
    subject_exclusions: [],
    created_at: timestamp,
    updated_at: timestamp,
    traits: Object.fromEntries(
      Object.keys(traitLabels).map((k) => [k, { value: '', source: 'user' }]),
    ) as StyleProfile['traits'],
  }
  return { profile, revision: 0, savedFingerprint: fingerprint(profile), markdown: '' }
}

export function isDirty(draft: Draft): boolean {
  return fingerprint(draft.profile) !== draft.savedFingerprint
}

export function markSaved(_draft: Draft, saved: SavedSkill): Draft {
  return {
    profile: saved.profile,
    revision: saved.revision,
    savedFingerprint: fingerprint(saved.profile),
    markdown: saved.markdown,
  }
}

export function discardChanges(draft: Draft): Draft {
  return { ...draft, profile: JSON.parse(draft.savedFingerprint) as StyleProfile }
}

export function acceptSave(current: Draft, submitted: StyleProfile, saved: SavedSkill): Draft {
  if (current.profile.id !== submitted.id) return current
  if (fingerprint(current.profile) === fingerprint(submitted)) return markSaved(current, saved)
  return {
    ...current,
    profile: {
      ...current.profile,
      created_at: saved.profile.created_at,
      updated_at: saved.profile.updated_at,
    },
    revision: saved.revision,
    savedFingerprint: fingerprint(saved.profile),
    markdown: saved.markdown,
  }
}

export function applyAnalysis(draft: Draft, result: AnalysisResult, inputIds: string[]): Draft {
  if (JSON.stringify(draft.profile.reference_ids) !== JSON.stringify(inputIds)) return draft
  const profile = { ...draft.profile, palette: result.palette, analysis: result }
  if (result.mode === 'ollama') {
    profile.traits = { ...draft.profile.traits }
    for (const key of Object.keys(traitLabels) as TraitKey[]) {
      const existing = profile.traits[key]
      if (result.traits[key] && !(existing?.source === 'user' && existing.value.trim())) {
        profile.traits[key] = result.traits[key]!
      }
    }
    for (const key of ['positive_rules', 'negative_constraints', 'subject_exclusions'] as const) {
      if (!profile[key].length) profile[key] = result[key]
    }
  }
  return { ...draft, profile }
}
