import { ArrowUpRight, Star } from 'lucide-react'
import type { SkillSummary } from '../lib/types'
import { AssetImage } from './AssetImage'
import { Button } from './ui/button'

export function SkillCard({ skill, onOpen, onFavorite }:
  { skill: SkillSummary; onOpen: (id: string) => void; onFavorite?: (skill: SkillSummary) => void }) {
  return <article className="skill-card">
    <button className="skill-cover" onClick={() => onOpen(skill.id)} aria-label={`Open ${skill.name}`}>
      {skill.reference_ids.length ? <AssetImage id={skill.reference_ids[0]} alt={skill.name} /> :
        <div className="type-cover"><span>{skill.name.slice(0, 2)}</span><span>STYLE / {String(skill.revision).padStart(2, '0')}</span></div>}
      <span className="cover-open"><ArrowUpRight size={18} /></span>
      <span className="cover-count">{skill.reference_ids.length} reference{skill.reference_ids.length === 1 ? '' : 's'}</span>
    </button>
    <div className="skill-card-body">
      <div className="flex-row between"><h3><button onClick={() => onOpen(skill.id)}>{skill.name}</button></h3>
        {onFavorite && <Button variant="ghost" size="icon" aria-label={`${skill.favorite ? 'Unfavorite' : 'Favorite'} ${skill.name}`}
          onClick={() => onFavorite(skill)}><Star size={16} fill={skill.favorite ? 'currentColor' : 'none'} className={skill.favorite ? 'accent-text' : ''} /></Button>}
      </div>
      <p>{skill.description || 'An editable visual language, ready for your next subject.'}</p>
      <div className="flex-row between card-footer"><span>{skill.category}</span><div className="mini-palette">{skill.palette.slice(0, 6).map((color, i) => <i key={i} style={{ background: color.hex }} title={color.hex} />)}</div></div>
    </div>
  </article>
}
