import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Globe, Copy, ExternalLink, ShieldCheck, Info } from 'lucide-react'
import { useCreativePreviewStore } from '../store'
import { ClearableInput } from '@/components/shared/ClearableInput'
import { toast } from 'sonner'

export function LiveSitePreviewModal() {
  const open = useCreativePreviewStore((s) => s.liveSiteModalOpen)
  const setOpen = useCreativePreviewStore((s) => s.setLiveSiteModalOpen)
  const config = useCreativePreviewStore((s) => s.liveSiteConfig)
  const updateConfig = useCreativePreviewStore((s) => s.updateLiveSiteConfig)
  const macroSubstitutions = useCreativePreviewStore((s) => s.macroSubstitutions)

  // Use values from config or fall back to macro values if present
  const lineItemId = config.lineItemId || macroSubstitutions['%eaid!'] || '8872190'
  const creativeId = config.creativeId || macroSubstitutions['%ecid!'] || '44102938'
  const adUnitId = config.adUnitId || macroSubstitutions['%epid!'] || '/82109981/homepage_top'
  const sizeTargeting = config.sizeTargeting || '300x250'
  const siteUrl = config.siteUrl || 'https://example.com/article-demo'

  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedTag, setCopiedTag] = useState(false)

  // Build GAM On-Site Preview URL according to Google Ad Manager specs
  // Parameter format: ?googlesitepreview=1&iu=AD_UNIT&lineItemId=LINE_ITEM_ID&creativeId=CREATIVE_ID
  const previewUrl = (() => {
    try {
      const url = new URL(siteUrl)
      url.searchParams.set('googlesitepreview', '1')
      url.searchParams.set('google_preview', '1')
      url.searchParams.set('iu', adUnitId)
      url.searchParams.set('lineItemId', lineItemId)
      url.searchParams.set('creativeId', creativeId)
      return url.toString()
    } catch {
      return `${siteUrl}?googlesitepreview=1&google_preview=1&iu=${encodeURIComponent(
        adUnitId
      )}&lineItemId=${lineItemId}&creativeId=${creativeId}`
    }
  })()

  // Build matching GPT Tag snippet required on live page
  const parsedSize = sizeTargeting.includes('x')
    ? `[${sizeTargeting.split('x').join(', ')}]`
    : `'${sizeTargeting}'`

  const matchingGptTag = `<!-- GAM Preview Matching Ad Tag Snippet -->
<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script>
<script>
  window.googletag = window.googletag || {cmd: []};
  googletag.cmd.push(function() {
    googletag.defineSlot('${adUnitId}', ${parsedSize}, 'gam-preview-slot')
             .addService(googletag.pubads());
    googletag.enableServices();
  });
</script>

<!-- Ad Slot Container -->
<div id="gam-preview-slot">
  <script>
    googletag.cmd.push(function() { googletag.display('gam-preview-slot'); });
  </script>
</div>`

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(previewUrl)
    setCopiedUrl(true)
    toast.success('Live Site Preview URL copied to clipboard!')
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleCopyTag = async () => {
    await navigator.clipboard.writeText(matchingGptTag)
    setCopiedTag(true)
    toast.success('Matching GPT Tag snippet copied!')
    setTimeout(() => setCopiedTag(false), 2000)
  }

  const handleLaunch = () => {
    window.open(previewUrl, '_blank')
    toast.info('Launching Live Site Preview in new tab...')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-400">
            <Globe className="size-5" />
            <span>Google Ad Manager — Preview on Live Site</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Inspect creatives directly in your live website environment according to GAM On-Site Preview requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* GAM Requirement Alert */}
          <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-lg p-3 text-xs text-emerald-300 flex items-start gap-2.5">
            <ShieldCheck className="size-5 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">GAM On-Site Rule Requirement:</span>
              <p className="opacity-90 leading-relaxed">
                The preview page on your live site <strong>must contain an ad tag that matches the line item's ad unit path and size targeting</strong>. GAM ignores other targeting criteria for previews.
              </p>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/20">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Target Site Webpage URL</Label>
              <ClearableInput
                value={siteUrl}
                onChange={(e) => updateConfig({ siteUrl: e.target.value })}
                onClear={() => updateConfig({ siteUrl: '' })}
                placeholder="https://example.com/live-article"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Line Item ID (%eaid!)</Label>
              <ClearableInput
                value={lineItemId}
                onChange={(e) => updateConfig({ lineItemId: e.target.value })}
                onClear={() => updateConfig({ lineItemId: '' })}
                placeholder="8872190"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Creative ID (%ecid!)</Label>
              <ClearableInput
                value={creativeId}
                onChange={(e) => updateConfig({ creativeId: e.target.value })}
                onClear={() => updateConfig({ creativeId: '' })}
                placeholder="44102938"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Targeted Ad Unit Path (%epid!)</Label>
              <ClearableInput
                value={adUnitId}
                onChange={(e) => updateConfig({ adUnitId: e.target.value })}
                onClear={() => updateConfig({ adUnitId: '' })}
                placeholder="/82109981/homepage_top"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Targeted Ad Size</Label>
              <ClearableInput
                value={sizeTargeting}
                onChange={(e) => updateConfig({ sizeTargeting: e.target.value })}
                onClear={() => updateConfig({ sizeTargeting: '' })}
                placeholder="300x250"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Generated Preview Link */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Generated GAM On-Site Preview URL</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Includes <code>googlesitepreview</code> &amp; <code>iu</code> params
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <Input value={previewUrl} readOnly className="h-8 text-xs font-mono bg-muted/50 text-emerald-400" />
              <Button variant="outline" size="sm" onClick={handleCopyUrl} className="h-8 px-3 text-xs shrink-0 gap-1">
                <Copy className="size-3.5" />
                <span>{copiedUrl ? 'Copied!' : 'Copy'}</span>
              </Button>
            </div>
          </div>

          {/* Matching Tag Snippet Code */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Info className="size-3.5 text-blue-400" />
                <span>Matching GPT Tag Snippet for Live Site</span>
              </Label>
              <Button variant="ghost" size="sm" onClick={handleCopyTag} className="h-6 px-2 text-xs gap-1">
                <Copy className="size-3" />
                <span>{copiedTag ? 'Copied Snippet!' : 'Copy Tag Code'}</span>
              </Button>
            </div>

            <pre className="p-3 border rounded-lg bg-zinc-950 text-zinc-200 text-[11px] font-mono overflow-x-auto max-h-[160px]">
              {matchingGptTag}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={handleLaunch} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5">
            <ExternalLink className="size-4" />
            <span>Launch Live Site Preview</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
