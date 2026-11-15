import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Braces, ImagePlus, Layers3, Plus, ScanLine, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { api } from '../lib/api'
import type { LibraryResult } from '../lib/types'
import { Button } from '../components/ui/button'
import { SkillCard } from '../components/SkillCard'

function StyleIllustration() {
  return <div className="style-illustration" aria-label="Illustration of reference images becoming reusable visual instructions" role="img">
    <div className="illustration-note">01 / THE REFERENCE</div>
    <div className="art-print print-back"><svg viewBox="0 0 220 245" aria-hidden="true"><rect width="220" height="245" fill="#ddd5c4" /><circle cx="150" cy="68" r="38" fill="#b77542" /><path d="M0 180Q60 80 120 165T250 140V260H0" fill="#555a47" /><path d="M-20 225Q90 100 160 220T250 180V260H0" fill="#283c36" /></svg></div>
    <div className="art-print print-front"><svg viewBox="0 0 220 245" aria-hidden="true"><rect width="220" height="245" fill="#ded2b8" /><path d="M26 210V89a67 67 0 0 1 134 0v121" fill="#ae693d" /><path d="M65 210V110a40 40 0 0 1 80 0v100" fill="#e7bd75" /><path d="M0 200Q100 160 220 220V245H0" fill="#4a5040" /><circle cx="175" cy="40" r="14" fill="#e9e1d0" /><path d="M109 220V129M109 172Q60 142 64 115Q108 119 109 159M110 192Q157 156 156 130Q113 136 110 179" fill="#313e30" stroke="#313e30" strokeWidth="4" /></svg><div className="print-caption">A study in warmth.</div></div>
    <div className="illustration-profile"><div className="flex-row between"><span><ScanLine size={13} />STYLE DECODED</span><i /></div><div className="illustration-swatches">{['#ded2b8', '#ae693d', '#e7bd75', '#4a5040', '#313e30'].map(c => <i key={c} style={{ background: c }} />)}</div><div className="illustration-code"><span>palette</span> warm, muted earth tones<br /><span>texture</span> soft, tactile grain<br /><span>form</span> organic silhouettes</div><div className="illustration-file"><Braces size={13} />SKILL.md<span>↗</span></div></div>
    <div className="illustration-label">ILLUSTRATIVE STYLE STUDY — NOT AI ANALYSIS</div>
  </div>
}

export default function Dashboard({ version, onNew, onOpen, onLibrary, onError }:
  { version: number; onNew: () => void; onOpen: (id: string) => void; onLibrary: () => void; onError: (e: unknown) => void }) {
  const [data, setData] = useState<LibraryResult | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    api.get<LibraryResult>('/api/skills?limit=3', controller.signal).then(setData).catch(e => {
      if (e.name !== 'AbortError') onError(e)
    })
    return () => controller.abort()
  }, [version, onError])
  return <motion.div className="dashboard page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
    <div className="page-heading"><div><div className="eyebrow"><span />YOUR CREATIVE WORKSPACE</div><h1>Your visual language, decoded.</h1><p>A place for the styles you discover—and the things you’ll make with them.</p></div><span className="outlined-tag"><ShieldCheck size={13} />Private by design</span></div>
    <section className="hero-panel"><div className="hero-copy"><div className="eyebrow">COLLECT. UNDERSTAND. CREATE.</div><h2>Every style starts<br />with a <em>reference.</em></h2><p>Turn the images that inspire you into a visual language you can use again. Extract the details. Make them yours. Take them anywhere.</p><Button onClick={onNew}><Plus size={17} />Create your first style<ArrowUpRight size={17} /></Button><div className="hero-fineprint"><span className="status-dot" />Works locally. No account required.</div></div><StyleIllustration /></section>
    <section className="workflow-strip" aria-label="How StyleDNA works">{[
      { icon: ImagePlus, number: '01', title: 'Bring your references', text: 'One image or a whole moodboard.' },
      { icon: ScanLine, number: '02', title: 'Find the visual DNA', text: 'Measure, interpret, and refine.' },
      { icon: Braces, number: '03', title: 'Make it reusable', text: 'A portable skill for your next idea.' },
    ].map(step => <div key={step.number}><span className="workflow-icon"><step.icon size={20} strokeWidth={1.5} /></span><div><small>{step.number} /</small><h3>{step.title}</h3><p>{step.text}</p></div></div>)}</section>
    <section className="recent-section"><div className="section-heading"><div><div className="eyebrow">YOUR COLLECTION</div><h2>Recent styles <span>{data?.total ?? '—'}</span></h2></div><Button variant="ghost" onClick={onLibrary}>View library<ArrowRight size={16} /></Button></div>
      {data?.items.length ? <div className="skills-grid dashboard-grid">{data.items.map(skill => <SkillCard key={skill.id} skill={skill} onOpen={onOpen} />)}</div> :
        <div className="empty-library"><div className="empty-symbol"><Layers3 size={26} strokeWidth={1.3} /></div><div><h3>{data ? 'A fresh canvas for your style collection.' : 'Opening your local library…'}</h3><p>{data ? 'Create a style from your references. It will be right here when inspiration strikes.' : 'Loading saved skills from this device.'}</p></div>{data && <Button variant="secondary" onClick={onNew}>Start a style<ArrowRight size={16} /></Button>}</div>}
    </section>
  </motion.div>
}
