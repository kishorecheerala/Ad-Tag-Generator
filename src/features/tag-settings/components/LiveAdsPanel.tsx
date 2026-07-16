import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, MonitorPlay, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { useTheme } from '@/lib/theme'
import { useUiStore } from '@/stores/uiStore'
import { useTagSettingsSnapshot, useTagSettingsStore } from '../store'
import { generateStagingHtml } from '../lib/generateStagingHtml'

export function LiveAdsPanel() {
  const snapshot = useTagSettingsSnapshot()
  const theme = useTheme((s) => s.theme)
  const regenerateCorrelator = useTagSettingsStore((s) => s.regenerateCorrelator)
  const openTestPage = useUiStore((s) => s.openTestPage)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(300)

  const srcDoc = useMemo(
    () => generateStagingHtml(snapshot, { isPreview: true, isDark: theme === 'dark' }),
    [snapshot, theme]
  )

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source === iframeRef.current?.contentWindow && e.data?.type === 'resize-iframe') {
        setHeight(Math.max(200, e.data.height))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Ads</CardTitle>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" className="hover:bg-white/20" title="Open Test Page" onClick={() => openTestPage(false)}>
            <ExternalLink className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="hover:bg-white/20" title="Open Google Publisher Console" onClick={() => openTestPage(true)}>
            <MonitorPlay className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="hover:bg-white/20" title="Refresh Live Ads (new ad request)" onClick={regenerateCorrelator}>
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {snapshot.slots.length === 0 ? (
          <EmptyState>No slots configured.</EmptyState>
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            title="Live Ads preview"
            className="w-full border-0 bg-white"
            style={{ height }}
          />
        )}
        <div className="border-t border-border px-3 py-1.5 text-right text-[11px] text-muted-foreground">
          Slots: <span className="font-semibold text-foreground">{snapshot.slots.length}</span>
        </div>
      </CardContent>
    </Card>
  )
}
