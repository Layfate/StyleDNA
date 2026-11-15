import { ArrowRight, History, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function Planned({ type, onStudio }: { type: 'generator' | 'history'; onStudio: () => void }) {
  const Icon = type === 'generator' ? Sparkles : History
  return <div className="planned-page page"><div className="eyebrow">ON THE ROADMAP / PHASE 02</div><div className="planned-art"><Icon size={44} strokeWidth={1.1} /></div><h1>{type === 'generator' ? 'A new subject. The same visual DNA.' : 'Your creative process, collected.'}</h1><p>{type === 'generator' ? 'Image generation is coming in Phase 2.' : 'Generated image history is coming in Phase 2.'}</p><p className="muted">For now, create and export style skills. The next phase will connect real generation providers, with supported controls and saved results.</p><Button onClick={onStudio}>Create a style skill<ArrowRight size={16} /></Button></div>
}
