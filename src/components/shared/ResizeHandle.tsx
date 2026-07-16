import { useRef, type PointerEvent } from 'react'

interface ResizeHandleProps {
  /** Called with the vertical drag delta (px) on each pointer move. */
  onResize: (deltaY: number) => void
}

/** A vertical (height) drag handle pinned to the bottom edge of a card. The
 * grip stays hidden until the parent — which must have the `group` class — is
 * hovered, so it doesn't clutter the card when idle. */
export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastY = useRef(0)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    lastY.current = e.clientY
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Capture is a best-effort nicety, not required for the drag.
    }
    e.preventDefault()
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const dy = e.clientY - lastY.current
    lastY.current = e.clientY
    if (dy !== 0) onResize(dy)
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore.
    }
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title="Drag to resize"
      className="absolute inset-x-0 bottom-0 z-20 flex h-3 cursor-ns-resize items-end justify-center pb-0.5"
    >
      <div className="h-1 w-10 rounded-full bg-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}
