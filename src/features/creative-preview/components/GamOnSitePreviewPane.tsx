import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Globe, Play, ExternalLink, Link2, Sparkles, Copy, Check, Monitor, RotateCcw, ShieldCheck, AlertCircle } from 'lucide-react'
import { useCreativePreviewStore } from '../store'
import { ClearableInput } from '@/components/shared/ClearableInput'
import { parseAdUnitBreadcrumbs } from '@/lib/utils'
import { toast } from 'sonner'

export function GamOnSitePreviewPane() {
  const config = useCreativePreviewStore((s) => s.liveSiteConfig)
  const updateConfig = useCreativePreviewStore((s) => s.updateLiveSiteConfig)
  const setMacroSubstitution = useCreativePreviewStore((s) => s.setMacroSubstitution)
  const setSize = useCreativePreviewStore((s) => s.setSize)
  const run = useCreativePreviewStore((s) => s.run)
  const clearConsole = useCreativePreviewStore((s) => s.clearConsole)

  const currentParams = new URLSearchParams(window.location.search)
  const activeToken = currentParams.get('google_preview') || currentParams.get('googlesitepreview') || ''
  const currentOnSitePageUrl = `${window.location.origin}/creative`
  const [copiedAppUrl, setCopiedAppUrl] = useState(false)

  const handleCopyAppUrl = async () => {
    await navigator.clipboard.writeText(currentOnSitePageUrl)
    setCopiedAppUrl(true)
    toast.success('Page URL copied! Paste this into GAM\'s "On site" preview dialog.')
    setTimeout(() => setCopiedAppUrl(false), 2000)
  }

  const lineItemId = config.lineItemId || ''
  const creativeId = config.creativeId || ''
  const adUnitId = config.adUnitId || ''
  const sizeTargeting = config.sizeTargeting || ''
  const pastedUrl = config.pastedUrl || ''
  const setPastedUrl = (val: string) => updateConfig({ pastedUrl: val })

  // Auto-hydrate liveSiteConfig on mount if URL parameters exist
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const iu = params.get('iu') || params.get('adUnitId')
    const lid = params.get('lineItemId') || params.get('lineitem')
    const cid = params.get('creativeId') || params.get('creative')
    const sz = params.get('sz') || params.get('size')
    const imp = params.get('impressionPixel')
    const clk = params.get('clickTracker')

    if (iu || lid || cid || sz || imp || clk) {
      const patch: Record<string, string> = {}
      if (iu) patch.adUnitId = parseAdUnitBreadcrumbs(decodeURIComponent(iu))
      if (lid) patch.lineItemId = lid
      if (cid) patch.creativeId = cid
      if (sz) patch.sizeTargeting = sz
      if (imp) patch.impressionPixel = imp
      if (clk) patch.clickTracker = clk

      updateConfig(patch)

      if (lid) setMacroSubstitution('%eaid!', lid)
      if (cid) setMacroSubstitution('%ecid!', cid)
      if (iu) setMacroSubstitution('%epid!', parseAdUnitBreadcrumbs(decodeURIComponent(iu)))
    }
  }, [updateConfig, setMacroSubstitution])

  // Parse pasted GAM On-Site Preview URL or multi-pixel tracking block
  const handleParsePastedUrl = () => {
    if (!pastedUrl.trim()) {
      toast.error('Please paste a valid GAM On-Site Preview URL or tracking pixel block.')
      return
    }

    const rawText = pastedUrl.trim()
    const patch: Record<string, string> = { pastedUrl: rawText }

    // 1. Extract URLs from the pasted text
    const extractedUrls = rawText.match(/(https?:\/\/[^\s"'`<>]+)/g) || []

    extractedUrls.forEach((u: string) => {
      if (u.includes('trackimpi')) {
        patch.impressionPixel = u
      } else if (u.includes('trackclk') || u.includes('pcs/click')) {
        patch.clickTracker = u
      }
    })

    // 2. Try parsing URL query parameters
    try {
      const targetUrlStr = extractedUrls.find((u: string) => u.includes('google_preview') || u.includes('lineItemId') || u.includes('iu')) || rawText
      const url = new URL(targetUrlStr)
      const iu = url.searchParams.get('iu') || url.searchParams.get('adUnitId')
      const lid = url.searchParams.get('lineItemId') || url.searchParams.get('lineitem')
      const cid = url.searchParams.get('creativeId') || url.searchParams.get('creative')
      const sz = url.searchParams.get('sz') || url.searchParams.get('size')
      const previewToken = url.searchParams.get('google_preview') || url.searchParams.get('googlesitepreview')

      if (iu) patch.adUnitId = parseAdUnitBreadcrumbs(decodeURIComponent(iu), adUnitId)
      if (lid) patch.lineItemId = lid
      if (cid) patch.creativeId = cid
      if (sz) patch.sizeTargeting = sz

      if (previewToken) {
        window.history.replaceState(null, '', window.location.pathname + url.search)
      }
    } catch {}

    // 3. Fallback regex for lineItemId/creativeId if query string was unparseable
    const lidMatch = rawText.match(/lineItemId=(\d+)/i) || rawText.match(/lineItem=(\d+)/i)
    if (lidMatch) patch.lineItemId = lidMatch[1]

    const cidMatch = rawText.match(/creativeId=(\d+)/i) || rawText.match(/creative=(\d+)/i)
    if (cidMatch) patch.creativeId = cidMatch[1]

    updateConfig(patch)

    if (patch.lineItemId) setMacroSubstitution('%eaid!', patch.lineItemId)
    if (patch.creativeId) setMacroSubstitution('%ecid!', patch.creativeId)
    if (patch.adUnitId) setMacroSubstitution('%epid!', patch.adUnitId)

    toast.success('Successfully extracted GAM On-Site parameters & tracking pixels!')
    run()
  }

  const handleRenderInPage = () => {
    setMacroSubstitution('%eaid!', lineItemId)
    setMacroSubstitution('%ecid!', creativeId)
    setMacroSubstitution('%epid!', adUnitId)

    run()
    toast.success('Rendering GAM On-Site creative directly inside page canvas!')
  }

  // 1-Click Clear/Reset all parameters
  const handleResetDefaults = () => {
    updateConfig({
      adUnitId: '',
      lineItemId: '',
      creativeId: '',
      sizeTargeting: '',
      pastedUrl: '',
    })

    setMacroSubstitution('%epid!', '')
    setMacroSubstitution('%eaid!', '')
    setMacroSubstitution('%ecid!', '')
    setSize('responsive')
    clearConsole()
    run()

    toast.success('Cleared all GAM preview parameters!')
  }

  const handleOpenTestPage = () => {
    const previewParams = `?googlesitepreview=1&google_preview=1&iu=${encodeURIComponent(
      adUnitId
    )}&lineItemId=${lineItemId}&creativeId=${creativeId}`
    window.open(`/testpage${previewParams}`, '_blank')
    toast.info('Opening GAM On-Site Preview in top-level test page...')
  }

  return (
    <Card className="flex flex-col border border-border bg-card shadow-xs w-full">
      <CardHeader className="py-2.5 px-4 bg-emerald-500/10 border-b border-emerald-500/20">
        <CardTitle className="text-sm font-bold flex flex-wrap items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Globe className="size-4 shrink-0" />
            <span>GAM "On Site" Preview Live Receiver &amp; Renderer</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              Live Receiver Active
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="h-6 px-2.5 text-[10px] gap-1 border-amber-600/40 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 font-semibold"
            >
              <RotateCcw className="size-3" />
              <span>Clear All Fields</span>
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-4 w-full">
        {/* Token Status Badge */}
        <div className={`border rounded-lg p-2.5 text-xs flex items-center justify-between gap-2 w-full ${
          activeToken ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {activeToken ? <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />}
            <span>
              {activeToken
                ? `GAM Preview Token Active: ${activeToken.substring(0, 18)}...`
                : 'No active GAM token in URL. Copy page URL below into GAM "On site" dialog or paste preview link.'}
            </span>
          </div>
          {activeToken && (
            <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold shrink-0">
              Token Valid
            </Badge>
          )}
        </div>

        {/* Step-by-Step Instructions matching GAM UI */}
        <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-lg p-3 text-xs text-emerald-800 dark:text-emerald-300 flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
            <Monitor className="size-4" />
            <span>How to preview GAM Creatives using GAM's "On site" button:</span>
          </div>

          <ol className="list-decimal list-inside space-y-1.5 opacity-95 text-[11px] leading-relaxed pl-1">
            <li>In Google Ad Manager (GAM), navigate to your <strong>Creative &rarr; Preview</strong> tab.</li>
            <li>Click the <strong><Globe className="inline size-3.5 mb-0.5 text-blue-400" /> On site</strong> button at the bottom of the GAM creative preview card.</li>
            <li>Paste this Page URL into GAM's popup dialog:</li>
          </ol>

          {/* Copyable Page URL to enter into GAM's On-site Dialog - Full Width Layout */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1 w-full">
            <div className="flex-1 w-full">
              <ClearableInput
                value={currentOnSitePageUrl}
                readOnly
                onClear={() => {}}
                className="h-8 w-full text-xs font-mono bg-zinc-950 text-emerald-400 border-emerald-500/30"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAppUrl}
              className="h-8 px-3 text-xs shrink-0 gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-semibold"
            >
              {copiedAppUrl ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              <span>{copiedAppUrl ? 'Copied!' : 'Copy Page URL'}</span>
            </Button>
          </div>
        </div>

        {/* Quick Paste GAM On-Site Preview Link - Resizable Textarea Box */}
        <div className="flex flex-col gap-2 border rounded-lg p-3 bg-muted/20 w-full">
          <Label className="text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Paste GAM "On Site" Preview URL</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-normal">Extracts <code>googlesitepreview</code> token &amp; parameters</span>
          </Label>
          <div className="flex flex-col gap-2 w-full">
            <Textarea
              value={pastedUrl}
              onChange={(e) => setPastedUrl(e.target.value)}
              placeholder="https://mywebsite.com/creative?google_preview=...&iu=...&lineItemId=..."
              className="min-h-[64px] w-full text-xs font-mono bg-background resize-y p-2.5 rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="flex items-center justify-end gap-2">
              {pastedUrl && (
                <Button variant="ghost" size="sm" onClick={() => setPastedUrl('')} className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground">
                  Clear URL
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleParsePastedUrl} className="h-8 px-4 text-xs shrink-0 gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-semibold">
                <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Parse &amp; Load Preview Parameters</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/10">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Targeted Ad Unit Path (%epid!)</span>
              <span className="text-[10px] text-muted-foreground">Auto-formats <code>A &gt; B &gt; C</code> hierarchy</span>
            </Label>
            <ClearableInput
              value={adUnitId}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text')
                if (text) {
                  e.preventDefault()
                  const formatted = parseAdUnitBreadcrumbs(text, adUnitId)
                  updateConfig({ adUnitId: formatted })
                  setMacroSubstitution('%epid!', formatted)
                  toast.success(`Auto-parsed GAM Ad Unit Path: ${formatted}`)
                }
              }}
              onChange={(e) => {
                const val = e.target.value
                const formatted = val.includes('>') || val.includes('->') || val.includes('→') || val.includes('|') || val.includes('http') || val.includes('\n')
                  ? parseAdUnitBreadcrumbs(val, adUnitId)
                  : val
                updateConfig({ adUnitId: formatted })
                setMacroSubstitution('%epid!', formatted)
              }}
              onBlur={() => {
                if (adUnitId && (adUnitId.includes('>') || adUnitId.includes(' ') || !adUnitId.startsWith('/'))) {
                  const formatted = parseAdUnitBreadcrumbs(adUnitId, adUnitId)
                  updateConfig({ adUnitId: formatted })
                  setMacroSubstitution('%epid!', formatted)
                  toast.success(`Auto-formatted ad unit hierarchy: ${formatted}`)
                }
              }}
              onClear={() => {
                updateConfig({ adUnitId: '' })
                setMacroSubstitution('%epid!', '')
              }}
              placeholder="Paste GAM hierarchy (e.g. site_domain > section > page \n slot_name) or /<Network_ID>/<Ad_Unit>"
              className="h-8 text-xs font-mono"
            />
            {/* Quick Sub-AdUnit Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10px] text-muted-foreground">Ad Unit Hierarchy Presets:</span>
              {[
                { label: 'site_domain > section > page > slot_name', path: '/site_domain/section/page/slot_name' },
                { label: 'sports > news > top_banner', path: '/12345678/sports/news/top_banner' },
                { label: '/<Network ID>/<Ad Unit Code>', path: '/12345678/homepage_top' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    updateConfig({ adUnitId: item.path })
                    setMacroSubstitution('%epid!', item.path)
                    toast.info(`Auto-parsed GAM Ad Unit Path: ${item.path}`)
                  }}
                  className="text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 text-emerald-300 px-1.5 py-0.5 rounded border border-zinc-700 font-medium"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold">Line Item ID (%eaid!)</Label>
            <ClearableInput
              value={lineItemId}
              onChange={(e) => {
                updateConfig({ lineItemId: e.target.value })
                setMacroSubstitution('%eaid!', e.target.value)
              }}
              onClear={() => {
                updateConfig({ lineItemId: '' })
                setMacroSubstitution('%eaid!', '')
              }}
              placeholder="123456789"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold">Creative ID (%ecid!)</Label>
            <ClearableInput
              value={creativeId}
              onChange={(e) => {
                updateConfig({ creativeId: e.target.value })
                setMacroSubstitution('%ecid!', e.target.value)
              }}
              onClear={() => {
                updateConfig({ creativeId: '' })
                setMacroSubstitution('%ecid!', '')
              }}
              placeholder="987654321"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Targeted Ad Size</span>
              <span className="text-[10px] text-muted-foreground">GAM Targeting parameter (keeps preview canvas responsive)</span>
            </Label>
            <ClearableInput
              value={sizeTargeting}
              onChange={(e) => updateConfig({ sizeTargeting: e.target.value })}
              onClear={() => updateConfig({ sizeTargeting: '' })}
              placeholder="160x600, 300x250, fluid"
              className="h-8 text-xs font-mono"
            />
            {/* Quick Size Helper Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10px] text-muted-foreground">Quick Targeted Sizes:</span>
              {['160x600', '300x250', '728x90', '300x600', '320x50', 'fluid'].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    updateConfig({ sizeTargeting: sz })
                    setSize(sz as any)
                    toast.info(`Updated GAM Targeted Ad Size parameter to ${sz}`)
                  }}
                  className="text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 text-amber-300 px-1.5 py-0.5 rounded border border-zinc-700 font-semibold"
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 mt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="h-8 text-xs gap-1.5 border-amber-600/40 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-semibold"
          >
            <RotateCcw className="size-3.5" />
            <span>Clear All Fields</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenTestPage}
              className="h-8 text-xs gap-1.5 border-emerald-600/40 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-semibold"
            >
              <ExternalLink className="size-3.5" />
              <span>Full Test Page</span>
            </Button>

            <Button
              size="sm"
              onClick={handleRenderInPage}
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
            >
              <Play className="size-3.5" />
              <span>Render GAM Creative In Our Page</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
