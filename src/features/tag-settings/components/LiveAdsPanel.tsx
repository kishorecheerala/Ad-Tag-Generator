import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, MonitorPlay, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { useTheme } from '@/lib/theme'
import { useTagSettingsSnapshot, useTagSettingsStore } from '../store'
import { generateStagingHtml } from '../lib/generateStagingHtml'
import { TEST_PAGE_CONFIG_KEY } from '@/features/test-page/TestPageRoute'

export function LiveAdsPanel() {
  const snapshot = useTagSettingsSnapshot()
  const theme = useTheme((s) => s.theme)
  const regenerateCorrelator = useTagSettingsStore((s) => s.regenerateCorrelator)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(300)

  const srcDoc = useMemo(
    () => generateStagingHtml(snapshot, { isPreview: true, isDark: theme === 'dark' }),
    [snapshot, theme]
  )

  // Both open the real /testpage route in a new tab: a genuine top-level page at
  // a real URL, which is what GPT ad serving and the Publisher Console require
  // (neither works from an iframe or blob:/about:blank document). The route
  // reads this config and live-reloads when the app rewrites it.
  const openTestPageRoute = (pubConsole: boolean) => {
    localStorage.setItem(TEST_PAGE_CONFIG_KEY, JSON.stringify({ snapshot, pubConsole, isDark: theme === 'dark' }))
    window.open('/testpage', '_blank')
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source === iframeRef.current?.contentWindow && e.data?.type === 'resize-iframe') {
        setHeight(Math.max(200, e.data.height))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    // When the staging HTML changes (triggering an iframe reload), or when
    // this preview panel is unmounted, search the parent window for any
    // DOM nodes injected by GPT (anchors, interstitials, console frames, etc.)
    // and destroy them to prevent "Format already created" errors on the next load.
    return () => {
      const selectors = [
        'iframe[name^="google_ads_iframe"]',
        'iframe[id^="google_ads_iframe"]',
        'div[id^="google_ads_iframe"]',
        'div[id^="googletag_"]',
        'div[class*="googletag"]',
        'iframe[src*="doubleclick.net"]',
        'iframe[src*="googlesyndication.com"]',
        '.google-anchor-ad',
        'google-handle',
        '#googletag-open-console-tab',
        '#googletag-console-outer',
      ]
      selectors.forEach((selector) => {
        try {
          const elements = document.querySelectorAll(selector)
          elements.forEach((el) => el.remove())
        } catch (e) {
          console.warn('Error cleaning up GPT element from parent window:', e)
        }
      })
      // Clear global references to prevent slot definition leakage
      try {
        delete (window.top as any).googletag
        delete (window.top as any).google_js_in_page_html
      } catch {}
    }
  }, [srcDoc])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Ads</CardTitle>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" className="hover:bg-white/20" title="Open Test Page (real /testpage route, new tab)" onClick={() => openTestPageRoute(false)}>
            <ExternalLink className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="hover:bg-white/20" title="Open Google Publisher Console (real /testpage route, new tab)" onClick={() => openTestPageRoute(true)}>
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
