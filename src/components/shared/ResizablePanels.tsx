import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ResizablePanelsProps {
  left: ReactNode
  right: ReactNode
  minLeftPx?: number
  minRightPx?: number
  defaultLeftPercent?: number
  className?: string
}

/** Two-pane layout with a draggable divider (desktop only; stacks on mobile).
 * The split is stored as a percentage, not a pixel width, so it stays fluid
 * and rescales automatically with the container instead of getting locked to
 * whatever pixel value was under the cursor at drag time. */
export function ResizablePanels({
  left,
  right,
  minLeftPx = 320,
  minRightPx = 300,
  defaultLeftPercent = 60,
  className,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent)
  const draggingRef = useRef(false)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width <= 0) return
      const minLeftPercent = (minLeftPx / rect.width) * 100
      const maxLeftPercent = 100 - (minRightPx / rect.width) * 100
      const rawPercent = ((e.clientX - rect.left) / rect.width) * 100
      setLeftPercent(Math.max(minLeftPercent, Math.min(maxLeftPercent, rawPercent)))
    }
    function onUp() {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [minLeftPx, minRightPx])

  return (
    <div ref={containerRef} className={cn('flex w-full flex-col gap-4 lg:flex-row lg:gap-0', className)}>
      <div className="min-w-0 flex-1 lg:flex-none" style={{ flexBasis: `${leftPercent}%` }}>
        {left}
      </div>
      <div
        onMouseDown={(e) => {
          draggingRef.current = true
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
          e.preventDefault()
        }}
        className="mx-1 hidden w-0.5 shrink-0 cursor-col-resize self-stretch rounded bg-transparent transition-colors hover:bg-red-500 active:bg-red-600 lg:block"
      />
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  )
}
