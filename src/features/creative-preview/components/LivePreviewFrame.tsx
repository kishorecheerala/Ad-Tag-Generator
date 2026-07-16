import { useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useCreativePreviewStore, type CreativeSizePreset } from '../store'
import { CONSOLE_BRIDGE } from '../consoleBridge'

const SIZE_PRESETS: { value: CreativeSizePreset; label: string }[] = [
  { value: '300x250', label: '300x250' },
  { value: '300x600', label: '300x600' },
  { value: '728x90', label: '728x90' },
  { value: '320x50', label: '320x50' },
  { value: '160x600', label: '160x600' },
  { value: 'responsive', label: 'Responsive (drag to resize)' },
]

export function LivePreviewFrame() {
  const html = useCreativePreviewStore((s) => s.html)
  const css = useCreativePreviewStore((s) => s.css)
  const js = useCreativePreviewStore((s) => s.js)
  const size = useCreativePreviewStore((s) => s.size)
  const setSize = useCreativePreviewStore((s) => s.setSize)
  const appendConsoleEntry = useCreativePreviewStore((s) => s.appendConsoleEntry)
  const clearConsole = useCreativePreviewStore((s) => s.clearConsole)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const srcDoc = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>html, body { height: 100%; }
${css}</style>
<script>${CONSOLE_BRIDGE}<\/script>
</head>
<body>
${html}
<script>
try {
${js}
} catch (e) {
  console.error(e && e.message ? e.message : String(e));
}
<\/script>
</body>
</html>`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, css, js])

  useEffect(() => {
    clearConsole()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcDoc])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source === iframeRef.current?.contentWindow && e.data?.source === 'creative-console') {
        appendConsoleEntry({ level: e.data.level, text: e.data.args.join(' ') })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [appendConsoleEntry])

  const isResponsive = size === 'responsive'
  const [w, h] = isResponsive ? [0, 0] : size.split('x').map(Number)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Preview</CardTitle>
        <Select value={size} onValueChange={(v) => setSize(v as CreativeSizePreset)}>
          <SelectTrigger className="h-7 border-white/30 bg-white/10 text-xs text-primary-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIZE_PRESETS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex justify-center bg-white p-3">
        <div
          className={cn('overflow-auto bg-white', isResponsive && 'min-h-[150px] min-w-[200px] resize')}
          style={isResponsive ? { width: '100%', height: 400, maxWidth: '100%' } : { width: w, height: h }}
        >
          <iframe ref={iframeRef} srcDoc={srcDoc} title="Creative live preview" className="h-full w-full border-0 bg-white" />
        </div>
      </CardContent>
    </Card>
  )
}
