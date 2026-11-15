import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { GripHorizontal, GripVertical } from 'lucide-react'

function initialNumber(key: string, fallback: number, min: number, max: number) {
  try {
    const stored = localStorage.getItem(key)
    const value = stored === null ? fallback : Number(stored)
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
  } catch {
    return fallback
  }
}

export function ResizableWorkspace({
  references,
  editor,
  preview,
}: {
  references: ReactNode
  editor: ReactNode
  preview: ReactNode | null
}) {
  const root = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState(() => initialNumber('styledna.layout.references', 40, 32, 54))
  const [height, setHeight] = useState(() =>
    initialNumber('styledna.layout.previewHeight', 290, 180, 440),
  )
  const update = (value: number, vertical = false) => {
    const bounded = vertical
      ? Math.max(180, Math.min(440, value))
      : Math.max(32, Math.min(54, value))
    if (vertical) setHeight(bounded)
    else setSplit(bounded)
    try {
      localStorage.setItem(
        vertical ? 'styledna.layout.previewHeight' : 'styledna.layout.references',
        String(bounded),
      )
    } catch {}
  }
  return (
    <div
      ref={root}
      className={`resizable-workspace ${preview ? 'with-preview' : ''}`}
      style={
        { '--reference-width': `${split}%`, '--preview-height': `${height}px` } as CSSProperties
      }
    >
      <div className="workspace-upper">
        <div className="reference-slot">{references}</div>
        <div
          role="separator"
          aria-label="Resize references panel"
          aria-orientation="vertical"
          aria-valuemin={32}
          aria-valuemax={54}
          aria-valuenow={Math.round(split)}
          tabIndex={0}
          className="panel-resizer vertical"
          title="Drag to resize · arrow keys to adjust · double-click to reset"
          onDoubleClick={() => update(40)}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              e.preventDefault()
              update(
                e.key === 'Home'
                  ? 32
                  : e.key === 'End'
                    ? 54
                    : split + (e.key === 'ArrowRight' ? 2 : -2),
              )
            }
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            e.preventDefault()
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId) && root.current) {
              const rect = root.current.getBoundingClientRect()
              update(((e.clientX - rect.left) / rect.width) * 100)
            }
          }}
          onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
        >
          <GripVertical size={15} />
        </div>
        <div className="editor-slot">{editor}</div>
      </div>
      {preview && (
        <>
          <div
            role="separator"
            aria-label="Resize skill preview"
            aria-orientation="horizontal"
            aria-valuemin={180}
            aria-valuemax={440}
            aria-valuenow={Math.round(height)}
            tabIndex={0}
            className="panel-resizer horizontal"
            title="Drag to resize · arrow keys to adjust"
            onDoubleClick={() => update(290, true)}
            onKeyDown={(e) => {
              if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
                e.preventDefault()
                update(
                  e.key === 'Home'
                    ? 180
                    : e.key === 'End'
                      ? 440
                      : height + (e.key === 'ArrowUp' ? 20 : -20),
                  true,
                )
              }
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              e.preventDefault()
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId) && root.current) {
                update(root.current.getBoundingClientRect().bottom - e.clientY, true)
              }
            }}
            onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
          >
            <GripHorizontal size={16} />
          </div>
          <div className="preview-slot">{preview}</div>
        </>
      )}
    </div>
  )
}
