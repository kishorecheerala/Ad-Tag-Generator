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

/** Two-pane layout with a draggable divider (desktop only; stacks on mobile). */
export function ResizablePanels({
  left,
  right,
  minLeftPx = 320,
  minRightPx = 300,
  defaultLeftPercent = 60,
  className,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState<number | null>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(minLeftPx, Math.min(rect.width - minRightPx, e.clientX - rect.left))
      setLeftWidth(x)
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
      <div
        className="min-w-0 flex-1 lg:flex-none"
        style={leftWidth != null ? { width: leftWidth, flex: 'none' } : { flexBasis: `${defaultLeftPercent}%` }}
      >
        {left}
      </div>
      <div
        onMouseDown={(e) => {
          draggingRef.current = true
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
          e.preventDefault()
        }}
        className="mx-1 hidden w-1.5 shrink-0 cursor-col-resize self-stretch rounded transition-colors hover:bg-primary/40 active:bg-primary/60 lg:block"
      />
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  )
}
