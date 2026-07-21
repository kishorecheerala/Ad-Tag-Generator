import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Globe, Play, ExternalLink, Link2, Sparkles, Copy, Check, Info, Monitor } from 'lucide-react'
import { useCreativePreviewStore } from '../store'
import { toast } from 'sonner'

export function GamOnSitePreviewPane() {
  const config = useCreativePreviewStore((s) => s.liveSiteConfig)
  const updateConfig = useCreativePreviewStore((s) => s.updateLiveSiteConfig)
  const setMacroSubstitution = useCreativePreviewStore((s) => s.setMacroSubstitution)
  const setSize = useCreativePreviewStore((s) => s.setSize)
  const run = useCreativePreviewStore((s) => s.run)

  const [pastedUrl, setPastedUrl] = useState('')
  const [copiedAppUrl, setCopiedAppUrl] = useState(false)

  const lineItemId = config.lineItemId || '8872190'
  const creativeId = config.creativeId || '44102938'
  const adUnitId = config.adUnitId || '/82109981/homepage_top'
  const sizeTargeting = config.sizeTargeting || '300x250'

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

      const patch: Record<string, string> = {}
      if (iu) patch.adUnitId = iu
      if (lid) patch.lineItemId = lid
      if (cid) patch.creativeId = cid
      if (sz) patch.sizeTargeting = sz

      updateConfig(patch)

      if (lid) setMacroSubstitution('%eaid!', lid)
      if (cid) setMacroSubstitution('%ecid!', cid)
      if (iu) setMacroSubstitution('%epid!', iu)
      if (sz && sz.includes('x')) setSize(sz as any)

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
        <CardTitle className="text-sm font-bold flex items-center justify-between text-emerald-400">
          <div className="flex items-center gap-2">
            <Globe className="size-4" />
            <span>GAM "On Site" Preview Live Receiver &amp; Renderer</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            Live GAM Preview Receiver
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-4">
        {/* Step-by-Step Instructions matching GAM UI */}
        <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-lg p-3 text-xs text-emerald-300 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-emerald-400">
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
            <Input value={currentOnSitePageUrl} readOnly className="h-8 text-xs font-mono bg-zinc-950 text-emerald-400 border-emerald-500/30" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAppUrl}
              className="h-8 px-3 text-xs shrink-0 gap-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
            >
              {copiedAppUrl ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              <span>{copiedAppUrl ? 'Copied URL!' : 'Copy Page URL'}</span>
            </Button>
          </div>
        </div>

        {/* Quick Paste GAM On-Site Preview Link */}
        <div className="flex flex-col gap-1.5 border rounded-lg p-3 bg-muted/20">
          <Label className="text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-emerald-400" />
              <span>Paste GAM "On Site" Preview URL</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-normal">Extracts <code>googlesitepreview</code> token</span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              value={pastedUrl}
              onChange={(e) => setPastedUrl(e.target.value)}
              placeholder="https://mywebsite.com/creative?googlesitepreview=...&iu=...&lineItemId=..."
              className="h-8 text-xs font-mono"
            />
            <Button variant="outline" size="sm" onClick={handleParsePastedUrl} className="h-8 px-3 text-xs shrink-0 gap-1 border-emerald-500/40">
              <Sparkles className="size-3 text-emerald-400" />
              <span>Parse &amp; Load</span>
            </Button>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/10">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Targeted Ad Unit Path (%epid!)</span>
              <span className="text-[10px] text-muted-foreground">Matches line item ad unit</span>
            </Label>
            <Input
              value={adUnitId}
              onChange={(e) => updateConfig({ adUnitId: e.target.value })}
              placeholder="/82109981/homepage_top"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold">Line Item ID (%eaid!)</Label>
            <Input
              value={lineItemId}
              onChange={(e) => updateConfig({ lineItemId: e.target.value })}
              placeholder="8872190"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold">Creative ID (%ecid!)</Label>
            <Input
              value={creativeId}
              onChange={(e) => updateConfig({ creativeId: e.target.value })}
              placeholder="44102938"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-semibold">Targeted Ad Size</Label>
            <Input
              value={sizeTargeting}
              onChange={(e) => updateConfig({ sizeTargeting: e.target.value })}
              placeholder="300x250"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>

        {/* Requirement Note */}
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-muted/30 p-2 rounded border">
          <Info className="size-3.5 text-blue-400 shrink-0" />
          <span>GAM On-Site rule: Ad unit path and size targeting must match line item setup. Other targeting criteria are bypassed for previews.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="default"
            size="sm"
            onClick={handleRenderInPage}
            className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-2 flex-1 min-w-[180px]"
          >
            <Play className="size-4 fill-current" />
            <span>Render GAM Creative In Our Page</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenTestPage}
            className="h-9 px-3 text-xs gap-1.5 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-300"
          >
            <ExternalLink className="size-4" />
            <span>Open Standalone /testpage</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
