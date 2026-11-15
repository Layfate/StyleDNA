export const traitLabels = {
  visual_identity: 'Visual identity',
  lighting: 'Lighting & shadows',
  linework: 'Linework',
  texture: 'Texture & materials',
  shapes: 'Shapes & proportions',
  composition: 'Composition',
  background: 'Background',
  rendering: 'Rendering & shading',
} as const
export type TraitKey = keyof typeof traitLabels
export type Trait = { value: string; source: 'measurement' | 'ollama' | 'user' }
export type PaletteColor = { hex: string; share: number }
export type Measurements = {
  palette: PaletteColor[]
  luminance: number
  saturation: number
  contrast: number
  edge_density: number
  texture: number
}
export type Reference = {
  id: string
  filename: string
  width: number
  height: number
  format: 'PNG' | 'JPEG' | 'WEBP'
  bytes: number
  sha256: string
}
export type AnalysisResult = {
  mode: 'measurements' | 'ollama'
  model: string | null
  palette: PaletteColor[]
  traits: Partial<Record<TraitKey, Trait>>
  positive_rules: string[]
  negative_constraints: string[]
  subject_exclusions: string[]
  analyzed_at: string
  observations: {
    reference_id: string
    measurements: Measurements
    traits: Partial<Record<TraitKey, Trait>>
  }[]
}
export type StyleProfile = {
  schema_version: 1
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  favorite: boolean
  palette: PaletteColor[]
  traits: Record<TraitKey, Trait>
  positive_rules: string[]
  negative_constraints: string[]
  subject_exclusions: string[]
  reference_ids: string[]
  analysis: AnalysisResult | null
  created_at: string
  updated_at: string
}
export type SavedSkill = { profile: StyleProfile; revision: number; markdown: string }
export type SkillSummary = Pick<
  StyleProfile,
  | 'id'
  | 'name'
  | 'description'
  | 'category'
  | 'tags'
  | 'favorite'
  | 'updated_at'
  | 'reference_ids'
  | 'palette'
> & { revision: number }
export type LibraryResult = {
  items: SkillSummary[]
  total: number
  categories: string[]
  tags: string[]
}
export type Revision = { revision: number; name: string; created_at: string }
export type Settings = {
  theme: 'dark' | 'light'
  ollama_url: string
  ollama_model: string
  data_directory: string
}
export type ProviderState = {
  available: boolean
  error: string | null
  models: { name: string; vision: boolean; reason: string }[]
}
export type Job = {
  id: string
  state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted'
  stage: string
  progress: number
  result: AnalysisResult | null
  error: string | null
  reference_ids: string[]
}
export type Page = 'dashboard' | 'studio' | 'library' | 'generator' | 'history' | 'settings'
export type ProfileChange = <K extends keyof StyleProfile>(key: K, value: StyleProfile[K]) => void
