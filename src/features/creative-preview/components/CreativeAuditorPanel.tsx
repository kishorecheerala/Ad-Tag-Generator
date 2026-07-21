import { useMemo, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CheckCircle, ShieldAlert, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ResizeHandle } from '@/components/shared/ResizeHandle'
import { useCreativePreviewStore } from '../store'

export function CreativeAuditorPanel() {
  const html = useCreativePreviewStore((s) => s.html)
  const js = useCreativePreviewStore((s) => s.js)
  const macroSubstitutions = useCreativePreviewStore((s) => s.macroSubstitutions)
  const setMacroSubstitution = useCreativePreviewStore((s) => s.setMacroSubstitution)
  const [auditorHeight, setAuditorHeight] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleResize = (dy: number) => {
    setAuditorHeight((hgt) => {
      if (hgt === null && cardRef.current) {
        return Math.max(100, cardRef.current.offsetHeight + dy)
      }
      return Math.max(100, (hgt || 0) + dy)
    })
  }

  // 1. Scan for macros
  const discoveredMacros = useMemo(() => {
    const code = `${html} ${js}`
    const macros = new Set<string>()
    
    // Match %%MACRO%% patterns
    const regex1 = /%%[A-Z0-9_:]+%%/g
    let match
    while ((match = regex1.exec(code)) !== null) {
      macros.add(match[0])
    }

    // Match [%MacroName%] patterns
    const regex2 = /\[%[a-zA-Z0-9_]+%\]/g
    while ((match = regex2.exec(code)) !== null) {
      macros.add(match[0])
    }

    // Match [timestamp]
    const regex3 = /\[timestamp\]/g
    while ((match = regex3.exec(code)) !== null) {
      macros.add(match[0])
    }

    // Match case-insensitive bracket placeholders like [APIFRAMEWORKS], [click], [click_url]
    const regex4 = /\[[a-zA-Z0-9_]{3,}\]/g
    while ((match = regex4.exec(code)) !== null) {
      macros.add(match[0])
    }

    // Match dollar-brace placeholders like ${GDPR} or ${GDPR_CONSENT_755}
    const regex5 = /\$\{[a-zA-Z0-9_]+\}/g
    while ((match = regex5.exec(code)) !== null) {
      macros.add(match[0])
    }

    return Array.from(macros).sort()
  }, [html, js])

  // 2. Perform audits on URL trackers and cache-busting
  const audits = useMemo(() => {
    const list: { level: 'success' | 'warn' | 'info'; title: string; desc: string }[] = []
    
    // Scan for script tags, image tags, trackers in HTML and Javascript
    const urlRegex = /(https?:\/\/[^\s"'`<>]+)/g
    const code = `${html} ${js}`
    
    let match
    const trackedUrls: string[] = []
    while ((match = urlRegex.exec(code)) !== null) {
      trackedUrls.push(match[0])
    }

    const thirdPartyDomains = [
      'doubleclick.net',
      'adnxs.com',
      'rubiconproject.com',
      'pubmatic.com',
      'openx.net',
      'criteo.com',
      'google-analytics.com',
      'googlesyndication.com',
      'googletagservices.com',
      'googletagmanager.com',
      'dcmads.js',
      'adserver',
      'adtech',
      'pixel',
      'tracking',
      'log'
    ]

    let totalBusted = 0
    let totalThirdParty = 0

    trackedUrls.forEach((url) => {
      const isThirdParty = thirdPartyDomains.some(domain => url.toLowerCase().includes(domain))
      if (isThirdParty) {
        totalThirdParty++
        const hasCacheBuster = url.includes('%%CACHEBUSTER%%') || url.includes('%%ORD%%') || url.includes('[timestamp]')
        if (hasCacheBuster) {
          totalBusted++
        } else {
          list.push({
            level: 'warn',
            title: 'Missing Cache Buster',
            desc: `Third-party resource is missing a cache-buster macro: "${url.substring(0, 70)}...". Add %%CACHEBUSTER%% or [timestamp] to avoid browser caching discrepancies.`
          })
        }
      }
    })

    // Advanced Google Campaign Manager (DCM) and generic placeholder audits
    const lowerCode = code.toLowerCase()
    if (lowerCode.includes('dcmads') || lowerCode.includes('dcm-placement')) {
      list.push({
        level: 'info',
        title: 'Campaign Manager (DCM) Tag',
        desc: 'Detected Google Campaign Manager placement tag structure. Ensure all relevant parameter inputs are configured.'
      })
    }

    if (code.includes('${GDPR}') || code.includes('${GDPR_CONSENT_') || code.includes('${ADDTL_CONSENT}')) {
      list.push({
        level: 'info',
        title: 'Consent Placeholders Detected',
        desc: 'Detected GDPR / Consent placeholder strings (e.g. ${GDPR}, ${GDPR_CONSENT_...}).'
      })
    }

    if (code.includes('[OMIDPARTNER]') || code.includes('[APIFRAMEWORKS]')) {
      list.push({
        level: 'info',
        title: 'Measurement Placeholders Detected',
        desc: 'Found Open Measurement (OMID) partner or API frameworks configuration placeholder tags.'
      })
    }

    if (lowerCode.includes('[click]') || lowerCode.includes('[click_url]') || lowerCode.includes('%%click_url_')) {
      list.push({
        level: 'info',
        title: 'Click Tracking Active',
        desc: 'Found click tracker macro placeholders (e.g. [click], [click_url]). Configure replacement landing page URLs for testing.'
      })
    }

    const trackerScripts = [
      { key: 'googletagservices.com/dcm/dcmads.js', name: 'Google Campaign Manager (DCM) Script' },
      { key: 'googletagservices.com/tag/js/gpt.js', name: 'Google Publisher Tag (GPT) Script' },
      { key: 'google-analytics.com', name: 'Google Analytics Script' }
    ]
    trackerScripts.forEach((script) => {
      if (lowerCode.includes(script.key)) {
        list.push({
          level: 'success',
          title: `${script.name} Loaded`,
          desc: `Successfully found third-party library script: "${script.key}".`
        })
      }
    })

    // General macro check
    if (discoveredMacros.length > 0) {
      list.push({
        level: 'info',
        title: 'Macro Substitution Active',
        desc: `Detected ${discoveredMacros.length} macros. Provide mock replacements below to substitute them in live preview.`
      })
    }

    if (totalThirdParty > 0 && totalThirdParty === totalBusted) {
      list.push({
        level: 'success',
        title: 'All Trackers Cache-Busted',
        desc: 'All detected third-party tracking pixels and script resources are correctly cache-busted!'
      })
    } else if (totalThirdParty === 0) {
      list.push({
        level: 'info',
        title: 'No Tracker Pixels Detected',
        desc: 'No external third-party tracker scripts or impressions pixels found.'
      })
    }

    return list
  }, [html, js, discoveredMacros])

  return (
    <Card
      ref={cardRef}
      className={cn("group relative flex flex-col shrink-0", auditorHeight === null && "h-auto")}
      style={auditorHeight !== null ? { height: auditorHeight } : {}}
    >
      <CardHeader className="py-2.5 shrink-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="size-4 text-primary" /> Creative Macro &amp; Tracker Audit
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-3 py-0 pb-3 overflow-y-auto">
        {/* Macro List */}
        <div className="flex flex-col gap-2 shrink-0">
          <Label className="text-xs text-zinc-400 uppercase tracking-wider">Discovered Macros</Label>
          {discoveredMacros.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">No ad manager macros detected in creative code.</span>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-lg p-3 bg-muted/10 max-h-[260px] overflow-y-auto">
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

        {/* Audits/Alerts */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <Label className="text-xs text-zinc-400 uppercase tracking-wider">Cache-Buster &amp; tracker audits</Label>
          <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
            {audits.map((audit, idx) => (
              <div
                key={idx}
                className={cn(
                  "border rounded-lg py-2.5 px-3 flex items-start gap-2.5 text-xs transition-all",
                  audit.level === 'warn' && "bg-red-500/10 border-red-500/30 text-red-500",
                  audit.level === 'success' && "bg-green-500/10 border-green-500/30 text-green-500",
                  audit.level === 'info' && "bg-blue-500/10 border-blue-500/30 text-blue-500"
                )}
              >
                {audit.level === 'success' && <CheckCircle className="size-4 shrink-0 mt-0.5" />}
                {audit.level === 'info' && <Sparkles className="size-4 shrink-0 mt-0.5" />}
                {audit.level === 'warn' && <ShieldAlert className="size-4 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-bold leading-none mb-1">{audit.title}</div>
                  <div className="text-[11px] opacity-90 leading-relaxed break-all">
                    {audit.desc}
                  </div>
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
