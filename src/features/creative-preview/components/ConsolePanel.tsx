import { useEffect, useRef, useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { ResizeHandle } from '@/components/shared/ResizeHandle'
import { cn } from '@/lib/utils'
import { useCreativePreviewStore } from '../store'

const LEVEL_CLASSES: Record<string, string> = {
  log: 'bg-muted text-muted-foreground',
  debug: 'bg-muted text-muted-foreground',
  info: 'bg-blue-500/15 text-blue-500',
  warn: 'bg-amber-500/15 text-amber-500',
  error: 'bg-red-500/15 text-red-500',
}

const TEXT_CLASSES: Record<string, string> = {
  warn: 'text-amber-500',
  error: 'text-red-500',
}

export function ConsolePanel() {
  const entries = useCreativePreviewStore((s) => s.consoleEntries)
  const clearConsole = useCreativePreviewStore((s) => s.clearConsole)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [consoleHeight, setConsoleHeight] = useState(200)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [entries.length])

  const copyConsole = () => {
    if (entries.length === 0) {
      toast.error('Console is empty — nothing to copy.')
      return
    }
    const text = entries.map((e) => `[${e.time}] ${e.level.toUpperCase()}: ${e.text}`).join('\n')
    navigator.clipboard.writeText(text)
    toast.success('Console output copied to clipboard!')
  }

  return (
    <Card className="group relative">
      <CardHeader>
        <CardTitle>Console</CardTitle>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" className="hover:bg-white/20" title="Copy console output" onClick={copyConsole}>
            <Copy className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="hover:bg-white/20" title="Clear console" onClick={clearConsole}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={scrollRef} className="overflow-y-auto p-0 pb-3 font-mono text-[11.5px]" style={{ height: consoleHeight }}>
        {entries.length === 0 ? (
          <EmptyState>Console output will appear here.</EmptyState>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className={cn('flex items-start gap-2 border-b border-border/60 px-3 py-1.5', TEXT_CLASSES[entry.level])}>
              <span className="shrink-0 text-muted-foreground/60">{entry.time}</span>
              <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase', LEVEL_CLASSES[entry.level])}>
                {entry.level}
              </span>
              <span className="break-words whitespace-pre-wrap">{entry.text}</span>
            </div>
          ))
        )}
      </CardContent>
      <ResizeHandle onResize={(dy) => setConsoleHeight((hgt) => Math.max(80, hgt + dy))} />
    </Card>
  )
}
