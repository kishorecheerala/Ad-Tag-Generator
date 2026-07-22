import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Globe, Play, ExternalLink, Link2, Sparkles, Copy, Check, Monitor, RotateCcw, ShieldCheck, AlertCircle } from 'lucide-react'
import { useCreativePreviewStore } from '../store'
import { ClearableInput } from '@/components/shared/ClearableInput'
import { toast } from 'sonner'

export function GamOnSitePreviewPane() {
  const config = useCreativePreviewStore((s) => s.liveSiteConfig)
  const updateConfig = useCreativePreviewStore((s) => s.updateLiveSiteConfig)
  const setMacroSubstitution = useCreativePreviewStore((s) => s.setMacroSubstitution)
  const setSize = useCreativePreviewStore((s) => s.setSize)
  const run = useCreativePreviewStore((s) => s.run)
  const clearConsole = useCreativePreviewStore((s) => s.clearConsole)

  const [pastedUrl, setPastedUrl] = useState('')
  const [copiedAppUrl, setCopiedAppUrl] = useState(false)

  const lineItemId = config.lineItemId || ''
  const creativeId = config.creativeId || ''
  const adUnitId = config.adUnitId || ''
  const sizeTargeting = config.sizeTargeting || ''

  // Detect if preview token is present on current page URL or pasted URL
  const currentParams = new URLSearchParams(window.location.search)
  const activeToken = currentParams.get('google_preview') || currentParams.get('googlesitepreview')

  // Current page URL to paste into GAM's "On site" dialog
  const currentOnSitePageUrl = `${window.location.origin}/creative`

  const handleCopyAppUrl = async () => {
    await navigator.clipboard.writeText(currentOnSitePageUrl)
    setCopiedAppUrl(true)
    toast.success('Page URL copied! Paste this into GAM\'s "On site" preview dialog.')
    setTimeout(() => setCopiedAppUrl(false), 2000)
  }

  // Parse pasted GAM On-Site Preview URL
  const handleParsePastedUrl = () => {
    if (!pastedUrl.trim()) {
      toast.error('Please paste a valid GAM On-Site Preview URL.')
      return
    }

    try {
      const url = new URL(pastedUrl.trim())
      const iu = url.searchParams.get('iu') || url.searchParams.get('adUnitId')
      const lid = url.searchParams.get('lineItemId') || url.searchParams.get('lineitem')
      const cid = url.searchParams.get('creativeId') || url.searchParams.get('creative')
      const sz = url.searchParams.get('sz') || url.searchParams.get('size')
      const previewToken = url.searchParams.get('google_preview') || url.searchParams.get('googlesitepreview')

      const patch: Record<string, string> = {}
      if (iu) patch.adUnitId = decodeURIComponent(iu)
      if (lid) patch.lineItemId = lid
      if (cid) patch.creativeId = cid
      if (sz) patch.sizeTargeting = sz

      updateConfig(patch)

      if (lid) setMacroSubstitution('%eaid!', lid)
      if (cid) setMacroSubstitution('%ecid!', cid)
      if (iu) setMacroSubstitution('%epid!', decodeURIComponent(iu))
      if (sz && sz.includes('x')) setSize(sz as any)

      // Update URL query parameters cleanly so GPT sees google_preview
      if (previewToken) {
        const newSearch = url.search
        window.history.replaceState(null, '', window.location.pathname + newSearch)
      }

      toast.success('Successfully extracted GAM On-Site preview parameters!')
      run()
    } catch {
      toast.error('Could not parse URL. Ensure it is a valid web URL.')
    }
  }

  const handleRenderInPage = () => {
    setMacroSubstitution('%eaid!', lineItemId)
    setMacroSubstitution('%ecid!', creativeId)
    setMacroSubstitution('%epid!', adUnitId)
    if (sizeTargeting.includes('x')) setSize(sizeTargeting as any)

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
    })

    setMacroSubstitution('%epid!', '')
    setMacroSubstitution('%eaid!', '')
    setMacroSubstitution('%ecid!', '')
    setSize('responsive')
    setPastedUrl('')
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
    <Card className="flex flex-col border border-border bg-card shadow-xs">
      <CardHeader className="py-2.5 px-4 bg-emerald-500/10 border-b border-emerald-500/20">
        <CardTitle className="text-sm font-bold flex items-center justify-between text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Globe className="size-4" />
            <span>GAM "On Site" Preview Live Receiver &amp; Renderer</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="h-6 px-2 text-[10px] gap-1 border-amber-600/40 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 font-semibold"
            >
              <RotateCcw className="size-3" />
              <span>Clear All Fields</span>
            </Button>
            <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              Live Receiver Active
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-4">
        {/* Token Status Badge */}
        <div className={`border rounded-lg p-2.5 text-xs flex items-center justify-between gap-2 ${
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
        <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-lg p-3 text-xs text-emerald-800 dark:text-emerald-300 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
            <Monitor className="size-4" />
            <span>How to preview GAM Creatives using GAM's "On site" button:</span>
          </div>

          <ol className="list-decimal list-inside space-y-1.5 opacity-95 text-[11px] leading-relaxed pl-1">
            <li>In Google Ad Manager (GAM), navigate to your <strong>Creative &rarr; Preview</strong> tab.</li>
            <li>Click the <strong><Globe className="inline size-3.5 mb-0.5 text-blue-400" /> On site</strong> button at the bottom of the GAM creative preview card.</li>
            <li>Paste this Page URL into GAM's popup dialog:</li>
          </ol>

          {/* Copyable Page URL to enter into GAM's On-site Dialog */}
          <div className="flex items-center gap-2 mt-1">
            <ClearableInput
              value={currentOnSitePageUrl}
              readOnly
              onClear={() => {}}
              className="h-8 text-xs font-mono bg-zinc-950 text-emerald-400 border-emerald-500/30"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAppUrl}
              className="h-8 px-3 text-xs shrink-0 gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
            >
              {copiedAppUrl ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              <span>{copiedAppUrl ? 'Copied!' : 'Copy Page URL'}</span>
            </Button>
          </div>
        </div>

        {/* Quick Paste GAM On-Site Preview Link */}
        <div className="flex flex-col gap-1.5 border rounded-lg p-3 bg-muted/20">
          <Label className="text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Paste GAM "On Site" Preview URL</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-normal">Extracts <code>googlesitepreview</code> token &amp; parameters</span>
          </Label>
          <div className="flex items-center gap-2">
            <ClearableInput
              value={pastedUrl}
              onChange={(e) => setPastedUrl(e.target.value)}
              onClear={() => setPastedUrl('')}
              placeholder="https://mywebsite.com/creative?google_preview=...&iu=...&lineItemId=..."
              className="h-8 text-xs font-mono"
            />
            <Button variant="outline" size="sm" onClick={handleParsePastedUrl} className="h-8 px-3 text-xs shrink-0 gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10">
              <Sparkles className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span>Parse &amp; Load</span>
            </Button>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/10">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Targeted Ad Unit Path (%epid!)</span>
              <span className="text-[10px] text-muted-foreground">GAM Ad Unit Path</span>
            </Label>
            <ClearableInput
              value={adUnitId}
              onChange={(e) => {
                updateConfig({ adUnitId: e.target.value })
                setMacroSubstitution('%epid!', e.target.value)
              }}
              onClear={() => {
                updateConfig({ adUnitId: '' })
                setMacroSubstitution('%epid!', '')
              }}
              placeholder="/<Network_ID>/<ad_unit_code>"
              className="h-8 text-xs font-mono"
            />
            {/* Quick Sub-AdUnit Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10px] text-muted-foreground">Quick AdUnit Presets:</span>
              {[
                '/<Network ID>/<Ad Unit Code>',
                '/<Network ID>/<Parent Ad Unit>/<Child Ad Unit>',
                '/<Network ID>/<Section>/<Sub-section>/<Slot>',
              ].map((path) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => {
                    const targetPath = path.includes('<Child Ad Unit>')
                      ? '/12345678/sports/leaderboard'
                      : path.includes('<Sub-section>')
                      ? '/12345678/news/tech/top_banner'
                      : '/12345678/homepage_top'
                    updateConfig({ adUnitId: targetPath })
                    setMacroSubstitution('%epid!', targetPath)
                    toast.info(`Updated ad unit path template`)
                  }}
                  className="text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700"
                >
                  {path}
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
              <span className="text-[10px] text-muted-foreground">Must match line item / creative size</span>
            </Label>
            <ClearableInput
              value={sizeTargeting}
              onChange={(e) => updateConfig({ sizeTargeting: e.target.value })}
              onClear={() => updateConfig({ sizeTargeting: '' })}
              placeholder="300x250"
              className="h-8 text-xs font-mono"
            />
            {/* Quick Size Helper Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10px] text-muted-foreground">Quick Sizes:</span>
              {['160x600', '300x250', '728x90', '300x600', '320x50', 'fluid'].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    updateConfig({ sizeTargeting: sz })
                    setSize(sz as any)
                    toast.info(`Updated Targeted Ad Size to ${sz}`)
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
