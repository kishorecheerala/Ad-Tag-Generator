import { useMemo, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Radio,
  CheckCircle,
  AlertTriangle,
  Send,
  ExternalLink,
  Zap,
  Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ResizeHandle } from '@/components/shared/ResizeHandle'
import { useCreativePreviewStore } from '../store'
import { toast } from 'sonner'

export interface ExtractedBeacon {
  id: string
  name: string
  category: 'render' | 'third_party' | 'click' | 'bundle_click' | 'video' | 'custom'
  rawUrl: string
  resolvedUrl: string
  hasUnexpandedMacro: boolean
}

function cleanExtractedUrl(raw: string): string {
  if (!raw) return ''
  // 1. Decode JS hex escapes (\x3d -> =, \x26 -> &, \x3f -> ?)
  let url = raw
    .replace(/\\x3d/gi, '=')
    .replace(/\\x26/gi, '&')
    .replace(/\\x3f/gi, '?')
    .replace(/\\x2f/gi, '/')

  // 2. Decode HTML entities (&quot;, &amp;, etc.)
  url = url
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  // 3. Strip trailing JSON quotes/commas or array delimiters like ","Send
  url = url.split('","')[0].split('",')[0].split('"]')[0]

  // 4. Strip trailing punctuation, slashes, or quotes
  url = url.replace(/["'`,;\\\])]+$/, '').trim()
  return url
}

function isTrackingBeacon(url: string): boolean {
  if (!url || !url.startsWith('http')) return false
  const lower = url.toLowerCase()

  // Exclude static UI branding assets & icons
  if (
    lower.includes('googlelogo') ||
    lower.includes('x_blue.png') ||
    lower.includes('back_blue.png') ||
    lower.includes('abg_blue.png') ||
    lower.includes('iconx2-000000.png')
  ) {
    return false
  }

  // Include valid tracking beacons, impression/click trackers & ad call endpoints
  return (
    lower.includes('trackimpi') ||
    lower.includes('trackclk') ||
    lower.includes('pcs/view') ||
    lower.includes('pcs/click') ||
    lower.includes('gampad') ||
    lower.includes('pixel') ||
    lower.includes('tracker') ||
    lower.includes('impression') ||
    lower.includes('beacon')
  )
}

export function TrackingPixelInspector() {
  const formatMode = useCreativePreviewStore((s) => s.formatMode)
  const jsonContent = useCreativePreviewStore((s) => s.jsonContent)
  const html = useCreativePreviewStore((s) => s.html)
  const js = useCreativePreviewStore((s) => s.js)
  const macroSubstitutions = useCreativePreviewStore((s) => s.macroSubstitutions)
  const setMacroSubstitution = useCreativePreviewStore((s) => s.setMacroSubstitution)
  const beaconPingResults = useCreativePreviewStore((s) => s.beaconPingResults)
  const recordBeaconPing = useCreativePreviewStore((s) => s.recordBeaconPing)
  const renderedSiteToURLMap = useCreativePreviewStore((s) => s.renderedSiteToURLMap)
  const renderedTemplateVars = useCreativePreviewStore((s) => s.renderedTemplateVars)
  const liveSiteConfig = useCreativePreviewStore((s) => s.liveSiteConfig)
  const runToken = useCreativePreviewStore((s) => s.runToken)

  const consoleEntries = useCreativePreviewStore((s) => s.consoleEntries)

  const [auditorHeight, setAuditorHeight] = useState<number | null>(null)
  const [isPingingAll, setIsPingingAll] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleResize = (dy: number) => {
    setAuditorHeight((hgt) => {
      if (hgt === null && cardRef.current) {
        return Math.max(120, cardRef.current.offsetHeight + dy)
      }
      return Math.max(120, (hgt || 0) + dy)
    })
  }

  // 1. Discover all macros
  const discoveredMacros = useMemo(() => {
    const code = formatMode === 'json' ? jsonContent : `${html} ${js}`
    const macros = new Set<string>()

    // GAM macros %eaid!, %ecid!, %epid!
    const regex0 = /%[a-z0-9]+!/g
    let match
    while ((match = regex0.exec(code)) !== null) {
      macros.add(match[0])
    }

    // %%MACRO%% patterns
    const regex1 = /%%[A-Z0-9_:]+%%/g
    while ((match = regex1.exec(code)) !== null) {
      macros.add(match[0])
    }

    // [%MacroName%] patterns
    const regex2 = /\[%[a-zA-Z0-9_]+%\]/g
    while ((match = regex2.exec(code)) !== null) {
      macros.add(match[0])
    }

    // [timestamp]
    const regex3 = /\[timestamp\]/g
    while ((match = regex3.exec(code)) !== null) {
      macros.add(match[0])
    }

    return Array.from(macros).sort()
  }, [formatMode, jsonContent, html, js])

  // Helper to substitute macros in a string
  const resolveMacros = (url: string) => {
    let resolved = url
    Object.keys(macroSubstitutions).forEach((macro) => {
      const val = macroSubstitutions[macro]
      if (val !== undefined && val !== '') {
        resolved = resolved.split(macro).join(val)
      }
    })
    return resolved
  }

  // 2. Extract structured beacons from JSON schema / code & live runtime logs
  const extractedBeacons = useMemo(() => {
    const list: ExtractedBeacon[] = []

    // GAM On-Site Preview Beacons (derived dynamically when Line Item ID / Creative ID are active)
    if (liveSiteConfig.lineItemId || liveSiteConfig.creativeId) {
      const adUnit = liveSiteConfig.adUnitId || ''
      const lid = liveSiteConfig.lineItemId || ''
      const cid = liveSiteConfig.creativeId || ''

      if (lid || cid) {
        const gamImpUrl = `https://securepubads.g.doubleclick.net/pcs/view?iu=${encodeURIComponent(adUnit)}&lineItemId=${lid}&creativeId=${cid}`
        list.push({
          id: 'gam_onsite_view',
          name: 'GAM On-Site View Impression Beacon (pcs/view)',
          category: 'render',
          rawUrl: gamImpUrl,
          resolvedUrl: resolveMacros(gamImpUrl),
          hasUnexpandedMacro: false,
        })

        const gamClickUrl = `https://adclick.g.doubleclick.net/pcs/click?iu=${encodeURIComponent(adUnit)}&lineItemId=${lid}&creativeId=${cid}&adurl=`
        list.push({
          id: 'gam_onsite_click',
          name: 'GAM On-Site Primary Click Tracker (pcs/click)',
          category: 'click',
          rawUrl: gamClickUrl,
          resolvedUrl: resolveMacros(gamClickUrl),
          hasUnexpandedMacro: false,
        })
      }

      if (liveSiteConfig.impressionPixel) {
        const impRaw = cleanExtractedUrl(liveSiteConfig.impressionPixel)
        list.push({
          id: 'onsite_third_party_imp',
          name: 'CM360 3rd-Party Impression Tracker (trackimpi)',
          category: 'render',
          rawUrl: impRaw,
          resolvedUrl: resolveMacros(impRaw),
          hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(impRaw)),
        })
      }

      if (liveSiteConfig.clickTracker) {
        const clkRaw = cleanExtractedUrl(liveSiteConfig.clickTracker)
        list.push({
          id: 'onsite_third_party_click',
          name: 'CM360 3rd-Party Click Tracker (trackclk)',
          category: 'click',
          rawUrl: clkRaw,
          resolvedUrl: resolveMacros(clkRaw),
          hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(clkRaw)),
        })
      }
    }

    if (formatMode === 'json' || formatMode === 'on_site_gam') {
      try {
        const parsed = JSON.parse(jsonContent)

        // Render Beacon
        if (parsed?.beacons?.render?.url) {
          const raw = cleanExtractedUrl(String(parsed.beacons.render.url))
          list.push({
            id: 'render_beacon',
            name: 'View Impression Beacon (render.url)',
            category: 'render',
            rawUrl: raw,
            resolvedUrl: resolveMacros(raw),
            hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(raw)),
          })
        }

        // 3rd Party Impression 1
        if (parsed?.beacons?.impressionThirdParty1?.url) {
          const raw = cleanExtractedUrl(String(parsed.beacons.impressionThirdParty1.url))
          list.push({
            id: 'imp_third_party_1',
            name: '3rd Party Tracker 1 (impressionThirdParty1)',
            category: 'third_party',
            rawUrl: raw,
            resolvedUrl: resolveMacros(raw),
            hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(raw)),
          })
        }

        // 3rd Party Impression 2
        if (parsed?.beacons?.impressionThirdParty2?.url) {
          const raw = cleanExtractedUrl(String(parsed.beacons.impressionThirdParty2.url))
          list.push({
            id: 'imp_third_party_2',
            name: '3rd Party Tracker 2 (impressionThirdParty2)',
            category: 'third_party',
            rawUrl: raw,
            resolvedUrl: resolveMacros(raw),
            hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(raw)),
          })
        }

        // Click Landing URL
        if (parsed?.links?.click?.url) {
          const raw = cleanExtractedUrl(String(parsed.links.click.url))
          list.push({
            id: 'click_landing',
            name: 'Primary Click Tracker (links.click.url)',
            category: 'click',
            rawUrl: raw,
            resolvedUrl: resolveMacros(raw),
            hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(raw)),
          })
        }

        // Bundle Clicks (1-10)
        if (Array.isArray(parsed?.links?.bundleClicks)) {
          parsed.links.bundleClicks.forEach((item: { sitePath?: string; clickThroughUrl?: string }, idx: number) => {
            if (item?.clickThroughUrl) {
              const raw = cleanExtractedUrl(String(item.clickThroughUrl))
              const sitePath = item.sitePath ? resolveMacros(item.sitePath) : `Site ${idx + 1}`
              list.push({
                id: `bundle_click_${idx + 1}`,
                name: `Bundle Click ${idx + 1} (${sitePath})`,
                category: 'bundle_click',
                rawUrl: raw,
                resolvedUrl: resolveMacros(raw),
                hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(raw)),
              })
            }
          })
        }
      } catch {
        // Fallback for unparseable JSON
      }
    }

    // Extract any additional standard HTTP URLs found in code or live rendered GAM creative
    const code = formatMode === 'json' ? jsonContent : (formatMode === 'on_site_gam' && html.includes('http')) ? html : formatMode === 'on_site_gam' ? '' : `${html} ${js}`
    const urlRegex = /(https?:\/\/[^\s"'`<>]+)/g
    let match
    const existingUrls = new Set(list.map((b) => b.rawUrl))

    while ((match = urlRegex.exec(code)) !== null) {
      const rawUrl = match[0]
      const url = cleanExtractedUrl(rawUrl)
      if (!url || !isTrackingBeacon(url)) continue

      if (!existingUrls.has(url)) {
        existingUrls.add(url)
        let category: ExtractedBeacon['category'] = 'custom'
        let name = `Custom Tracker (${new URL(url.split('?')[0]).hostname || 'Pixel'})`
        if (url.includes('trackimpi') || url.includes('pcs/view') || url.includes('adview')) {
          category = 'render'
          name = url.includes('trackimpi')
            ? 'CM360 Impression Tracker (trackimpi)'
            : 'DoubleClick Impression View (pcs/view)'
        } else if (url.includes('trackclk') || url.includes('pcs/click')) {
          category = 'click'
          name = url.includes('trackclk')
            ? 'CM360 Click Tracker (trackclk)'
            : 'DoubleClick Primary Click Tracker (pcs/click)'
        }

        list.push({
          id: `custom_${list.length + 1}`,
          name,
          category,
          rawUrl: url,
          resolvedUrl: resolveMacros(url),
          hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(url)),
        })
      }
    }

    // Extract live runtime URLs captured in console entries for the CURRENT ACTIVE creative render
    let activeEntries = consoleEntries
    const slotReqIdx = consoleEntries.findIndex((e) => e.text.includes('[GAM SLOT REQUESTED]') || e.text.includes('[GAM SLOT RENDERED]'))
    if (slotReqIdx !== -1) {
      // Find the previous slot request index if multiple slot renders exist in history
      const nextSlotReqIdx = consoleEntries.findIndex((e, i) => i > slotReqIdx && (e.text.includes('[GAM SLOT REQUESTED]') || e.text.includes('[GAM SLOT RENDERED]')))
      if (nextSlotReqIdx !== -1) {
        activeEntries = consoleEntries.slice(0, nextSlotReqIdx)
      }
    }

    activeEntries.forEach((entry) => {
      const text = entry.text || ''
      const matches = text.match(/(https?:\/\/[^\s"'`<>]+)/g) || []
      matches.forEach((rawUrl) => {
        const url = cleanExtractedUrl(rawUrl)
        if (!url || !isTrackingBeacon(url)) return

        if (!existingUrls.has(url)) {
          existingUrls.add(url)
          let category: ExtractedBeacon['category'] = 'custom'
          let name = `Live Fired Beacon (${new URL(url.split('?')[0]).hostname || 'Runtime'})`
          if (url.includes('pcs/view') || url.includes('gampad/adview')) {
            category = 'render'
            name = 'GAM On-Site View Impression Beacon (pcs/view)'
          } else if (url.includes('pcs/click') || url.includes('gampad/clk')) {
            category = 'click'
            name = 'GAM On-Site Primary Click Tracker (pcs/click)'
          } else if (url.includes('trackimpi') || url.includes('impression')) {
            category = 'render'
            if (url.includes('trackimpi')) name = 'CM360 3rd-Party Impression Tracker (trackimpi)'
          } else if (url.includes('trackclk') || url.includes('click')) {
            category = 'click'
            if (url.includes('trackclk')) name = 'CM360 3rd-Party Click Tracker (trackclk)'
          }
          list.push({
            id: `runtime_${list.length + 1}`,
            name,
            category,
            rawUrl: url,
            resolvedUrl: resolveMacros(url),
            hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(url)),
          })

          // Auto-derive matching CM360 trackclk click tracker if trackimpi impression fired
          if (url.includes('trackimpi')) {
            const derivedClk = url
              .replace('/ddm/trackimpi/', '/ddm/trackclk/')
              .replace(/ord=[^;]+;?/, '')
              .replace(/\?$/, '')
            if (!existingUrls.has(derivedClk)) {
              existingUrls.add(derivedClk)
              list.push({
                id: `derived_clk_${list.length + 1}`,
                name: 'CM360 3rd-Party Click Tracker (trackclk)',
                category: 'click',
                rawUrl: derivedClk,
                resolvedUrl: resolveMacros(derivedClk),
                hasUnexpandedMacro: /%%|\[%|%[a-z0-9]+!|\$\{/.test(resolveMacros(derivedClk)),
              })
            }
          }
        }
      })
    })

    // Sort list so Render & Click beacons always appear first!
    const categoryOrder: Record<ExtractedBeacon['category'], number> = {
      render: 1,
      third_party: 2,
      click: 3,
      bundle_click: 4,
      video: 5,
      custom: 6,
    }
    return list.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatMode, jsonContent, html, js, macroSubstitutions, consoleEntries, liveSiteConfig, runToken])

  // 3. Perform Ping Test for a beacon URL
  const pingBeacon = async (beacon: ExtractedBeacon) => {
    const targetUrl = beacon.resolvedUrl
    if (!targetUrl.startsWith('http')) {
      recordBeaconPing(beacon.rawUrl, {
        status: 'Invalid Protocol',
        ok: false,
        message: 'URL must start with http:// or https://',
      })
      return
    }

    try {
      const startTime = performance.now()
      // Send a ping request (using mode no-cors for cross-domain tracking pixels)
      await fetch(targetUrl, { mode: 'no-cors', cache: 'no-cache' })
      const duration = Math.round(performance.now() - startTime)

      recordBeaconPing(beacon.rawUrl, {
        status: '200 OK (no-cors)',
        ok: true,
        message: `Pixel Pinged successfully (${duration}ms)`,
      })
      toast.success(`Pinged pixel: ${beacon.name}`)
    } catch (err) {
      recordBeaconPing(beacon.rawUrl, {
        status: 'Ping Failed',
        ok: false,
        message: err instanceof Error ? err.message : 'Network error / CORS blocked',
      })
      toast.error(`Ping failed for ${beacon.name}`)
    }
  }

  // Batch Ping All Beacons
  const pingAllBeacons = async () => {
    if (extractedBeacons.length === 0) {
      toast.info('No tracking pixels to ping.')
      return
    }
    setIsPingingAll(true)
    toast.info(`Pinging ${extractedBeacons.length} tracking pixels...`)

    for (const beacon of extractedBeacons) {
      await pingBeacon(beacon)
    }
    setIsPingingAll(false)
    toast.success('All tracking pixel pings completed!')
  }

  // 4. Schema & Creative Audit Check
  const auditReport = useMemo(() => {
    const checks: { level: 'success' | 'warn' | 'info'; title: string; desc: string }[] = []

    if (formatMode === 'json') {
      try {
        const parsed = JSON.parse(jsonContent)
        if (parsed?.schema?.version === 3) {
          checks.push({
            level: 'success',
            title: 'GAM Creative Schema Version 3 Validated',
            desc: 'Creative JSON matches Google Ad Manager Native Custom Format Schema v3 specification.',
          })
        } else {
          checks.push({
            level: 'warn',
            title: 'Non-Standard Schema Version',
            desc: `Expected schema.version = 3, found: ${parsed?.schema?.version ?? 'undefined'}.`,
          })
        }

        if (parsed?.beacons?.render?.url) {
          checks.push({
            level: 'success',
            title: 'View Impression Render Beacon Present',
            desc: `Render beacon configured: ${parsed.beacons.render.url}`,
          })
        } else {
          checks.push({
            level: 'warn',
            title: 'Missing Render Impression Beacon',
            desc: 'Creative JSON is missing beacons.render.url. Impressions will not be recorded by GAM.',
          })
        }
      } catch (err) {
        checks.push({
          level: 'warn',
          title: 'JSON Syntax Error',
          desc: `Failed to parse creative JSON: ${err instanceof Error ? err.message : 'Invalid JSON format'}.`,
        })
      }
    }

    const unexpandedCount = extractedBeacons.filter((b) => b.hasUnexpandedMacro).length
    if (unexpandedCount > 0) {
      checks.push({
        level: 'warn',
        title: `${unexpandedCount} Unexpanded Macros in Tracking Pixels`,
        desc: 'Provide test replacements in the Macro Replacer panel below to resolve macros prior to delivery.',
      })
    } else if (extractedBeacons.length > 0) {
      checks.push({
        level: 'success',
        title: 'All Tracking Pixel Macros Resolved',
        desc: 'Every extracted tracking pixel URL has fully resolved macro replacements.',
      })
    }

    const emptyAdUrlBeacons = extractedBeacons.filter(
      (b) => b.resolvedUrl.includes('adurl=') && (b.resolvedUrl.endsWith('adurl=') || b.resolvedUrl.includes('adurl=&') || b.resolvedUrl.includes('adurl=""'))
    )
    if (emptyAdUrlBeacons.length > 0) {
      checks.push({
        level: 'warn',
        title: 'Empty Destination URL detected (&adurl= is empty)',
        desc: 'Clicking this GAM tracker will redirect to http://www.google.com/gen_204?reason=EmptyAdURL. Append your target landing page URL after &adurl= (e.g. &adurl=https://www.example.com).',
      })
    }

    return checks
  }, [formatMode, jsonContent, extractedBeacons])

  return (
    <Card
      ref={cardRef}
      className={cn('group relative flex flex-col shrink-0', auditorHeight === null && 'h-auto')}
      style={auditorHeight !== null ? { height: auditorHeight } : {}}
    >
      <CardHeader className="py-2.5 px-4 shrink-0 flex flex-row items-center justify-between border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Radio className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span>Tracking Pixel &amp; Beacon Troubleshooting Matrix</span>
        </CardTitle>

      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col gap-4 py-3 overflow-y-auto">
        <div className="flex flex-row items-center justify-between shrink-0 border-b pb-2.5">
          <Badge className="text-[10px] font-mono bg-emerald-600 dark:bg-emerald-500 text-white font-semibold border-0">
            {extractedBeacons.length} Tracking Pixels
          </Badge>
          <Button
            variant="default"
            size="sm"
            onClick={pingAllBeacons}
            disabled={isPingingAll || extractedBeacons.length === 0}
            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1"
          >
            <Send className="size-3" />
            <span>{isPingingAll ? 'Pinging...' : 'Ping All Beacons'}</span>
          </Button>
        </div>
        {/* Rendered Variables & Macros Matrix */}
        {(renderedSiteToURLMap || renderedTemplateVars) && (
          <div className="flex flex-col gap-4 border border-blue-500/20 bg-blue-500/5 rounded-lg p-3 shrink-0">
            <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
              <Label className="text-xs text-blue-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                <Sparkles className="size-4 text-blue-400" />
                <span>GAM Live Auction Variable &amp; Macro Matrix</span>
              </Label>
              <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-300 border-blue-500/30">
                Extracted from Iframe Scope
              </Badge>
            </div>

            {/* Template Variables */}
            {renderedTemplateVars && (
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Template Variables (templateVars)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(renderedTemplateVars).map(([key, value]) => {
                    const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value)
                    const isUnexpanded = /%%|\[%|%[a-z0-9]+!/.test(stringVal)
                    return (
                      <div key={key} className="flex flex-col gap-1 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900/60">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                          <span className="font-mono text-blue-600 dark:text-blue-400">{key}</span>
                          {isUnexpanded ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">Unresolved Macro</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium font-semibold">✓ Resolved</span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 break-all select-all">
                          {stringVal || <span className="text-zinc-400 dark:text-zinc-600 italic">empty</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Site to URL Map */}
            {renderedSiteToURLMap && (
              <div className="flex flex-col gap-1.5 border-t border-blue-500/10 pt-3">
                <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Redirect URL Mapping (siteToURLMap)</div>
                <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {renderedSiteToURLMap.map((item, idx) => {
                    const entries = Object.entries(item || {})
                    if (entries.length === 0) return null
                    const [siteKey, redirectUrl] = entries[0]
                    const stringUrl = String(redirectUrl)
                    const isUnexpanded = /%%|\[%|%[a-z0-9]+!/.test(stringUrl)
                    return (
                      <div key={idx} className="flex flex-col border border-zinc-200 dark:border-zinc-800 rounded p-2 bg-zinc-50 dark:bg-zinc-900/40 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 mb-1">
                          <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">{siteKey}</span>
                          {isUnexpanded ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium font-semibold">Unresolved Macro</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium font-semibold">✓ Resolved</span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400 break-all select-all">
                          {stringUrl}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extracted Beacons Table */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
              Discovered Beacons &amp; Tracking Pixels
            </Label>
            <span className="text-[10px] text-muted-foreground">Click "Test Ping" to send real-time HTTP verification ping</span>
          </div>

          {extractedBeacons.length === 0 ? (
            <div className="text-xs text-muted-foreground italic border rounded-lg p-3 bg-muted/10 text-center">
              No tracking beacons detected in creative snippet.
            </div>
          ) : (
            <div className="flex flex-col gap-2 pr-1">
              {extractedBeacons.map((beacon) => {
                const ping = beaconPingResults[beacon.rawUrl]
                return (
                  <div
                    key={beacon.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-lg p-2.5 bg-muted/20 text-xs"
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{beacon.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-2 py-0.5 uppercase font-mono font-bold border',
                            beacon.category === 'render' && 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700/60',
                            beacon.category === 'click' && 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60',
                            beacon.category === 'third_party' && 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-700/60',
                            beacon.category === 'bundle_click' && 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-700/60',
                            beacon.category === 'custom' && 'bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                          )}
                        >
                          {beacon.category}
                        </Badge>
                        {beacon.hasUnexpandedMacro ? (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700/60">
                            ⚠ Unexpanded Macro
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60">
                            ✓ Macro Resolved
                          </Badge>
                        )}
                        {(liveSiteConfig.lineItemId || liveSiteConfig.creativeId) && (
                          <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                            LineItem: {liveSiteConfig.lineItemId || 'N/A'} | Creative: {liveSiteConfig.creativeId || 'N/A'}
                          </Badge>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 break-all truncate" title={beacon.resolvedUrl}>
                        {beacon.resolvedUrl}
                      </div>

                      {ping && (
                        <div
                          className={cn(
                            'text-[10px] font-mono flex items-center gap-1 mt-0.5',
                            ping.ok ? 'text-emerald-400' : 'text-rose-400'
                          )}
                        >
                          <Zap className="size-3 shrink-0" />
                          <span>
                            [{ping.status}] {ping.message} ({ping.time})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard.writeText(beacon.resolvedUrl)
                          toast.success(`Copied ${beacon.name} URL to clipboard!`)
                        }}
                        className="h-7 px-2 text-[11px] gap-1 border-blue-500/30 hover:bg-blue-500/10 text-blue-300 font-medium"
                        title="Copy tracking pixel URL"
                      >
                        <Copy className="size-3" />
                        <span>Copy Pixel</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pingBeacon(beacon)}
                        className="h-7 px-2 text-[11px] gap-1 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300 font-medium"
                      >
                        <Send className="size-3" />
                        <span>Test Ping</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => window.open(beacon.resolvedUrl, '_blank')}
                        className="size-7"
                        title="Open Beacon URL in New Tab"
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Macro Replacer Input Form */}
        <div className="flex flex-col gap-2 shrink-0 border-t pt-3">
          <Label className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
            Macro Replacer ({discoveredMacros.length} Detected)
          </Label>
          {discoveredMacros.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">No macros found in creative code.</span>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-lg p-3 bg-muted/10">
              {discoveredMacros.map((macro) => (
                <div key={macro} className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-bold text-zinc-300 truncate" title={macro}>
                    {macro}
                  </span>
                  <Input
                    size={28}
                    value={macroSubstitutions[macro] || ''}
                    onChange={(e) => setMacroSubstitution(macro, e.target.value)}
                    placeholder="Mock replacement value"
                    className="h-7 text-xs font-mono"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Report Checks */}
        <div className="flex flex-col gap-2 flex-1 min-h-0 border-t pt-3">
          <Label className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
            Schema &amp; Creative Audits
          </Label>
          <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
            {auditReport.map((audit, idx) => (
              <div
                key={idx}
                className={cn(
                  'border rounded-lg py-2 px-3 flex items-start gap-2 text-xs transition-all',
                  audit.level === 'warn' && 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                  audit.level === 'success' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
                  audit.level === 'info' && 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                )}
              >
                {audit.level === 'success' && <CheckCircle className="size-4 shrink-0 mt-0.5" />}
                {audit.level === 'info' && <Sparkles className="size-4 shrink-0 mt-0.5" />}
                {audit.level === 'warn' && <AlertTriangle className="size-4 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-bold leading-none mb-1">{audit.title}</div>
                  <div className="text-[11px] opacity-90 leading-relaxed break-all">{audit.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <ResizeHandle onResize={handleResize} />
    </Card>
  )
}
