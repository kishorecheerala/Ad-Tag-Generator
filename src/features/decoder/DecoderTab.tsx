import { useMemo, useState } from 'react'
import { Copy, Download, Link2, Trash2, Eye, Laptop, Tablet, Smartphone, ExternalLink, MonitorPlay, Clapperboard, Play, Network, Globe, Layers, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ResizablePanels } from '@/components/shared/ResizablePanels'
import { cn } from '@/lib/utils'
import { useDecoderStore } from './store'
import { buildCoreItems, decodeAdTag } from './lib/parseAdTag'
import { AD_PARAMETER_CATEGORY_MAP, AD_PARAMETER_DICTIONARY, type ParameterCategory } from './data/parameterDictionary'
import { ValidationAlert, ValidationBadge } from './components/ValidationBadge'
import { EnvironmentPanel } from './components/EnvironmentPanel'
import { useTheme } from '@/lib/theme'
import { generateStagingHtml } from '@/features/tag-settings/lib/generateStagingHtml'
import type { TagSettingsState } from '@/features/tag-settings/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const CATEGORY_PILLS: { value: ParameterCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'identity', label: 'Identity' },
  { value: 'sizing', label: 'Sizing' },
  { value: 'targeting', label: 'Targeting' },
  { value: 'timing', label: 'Timing' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'consent', label: 'Consent' },
]

function copy(text: string, label: string) {
  if (!text || text === '-') return
  navigator.clipboard.writeText(text)
  toast.success(label)
}

function parseQueryString(str: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!str) return result
  // str is already fully decoded by deepDecode in parseAdTag.ts — do NOT
  // call decodeURIComponent again or it will throw URIError on residual %
  // characters in complex tags (e.g. BBC prev_scp with nested DV params).
  str.split('&').forEach((pair) => {
    const eq = pair.indexOf('=')
    if (eq !== -1) {
      result[pair.substring(0, eq)] = pair.substring(eq + 1)
    }
  })
  return result
}

function mapDecodedTagToState(decoded: any): TagSettingsState {
  const global = decoded.globalParameters || {}
  const cust = decoded.customTargetingParameters || {}

  // ── 1. Resolve ad-unit paths ──────────────────────────────────────────────
  // SRA batches multiple slots into a single request.
  //   iu_parts  = "4817,bbccom,home,index,interstitial,top,mid"
  //   enc_prev_ius = "/0/1/2/2/3/4,/0/1/2/2/3/5,/0/1/2/2/3/6"
  // Each comma-separated pattern in enc_prev_ius maps to one slot.

  let adUnitPaths: string[] = []

  if (global['iu']) {
    // Simple single-slot tag
    adUnitPaths = [global['iu']]
  } else if (global['iu_parts']) {
    const parts = global['iu_parts'].split(',')
    const patternRaw = global['enc_prev_ius'] || ''
    if (patternRaw) {
      // Each comma-separated chunk is one slot's index pattern
      const patterns = patternRaw.split(',')

      // However sizes in prev_iu_szs are ALSO comma-separated (with pipe as
      // multi-size delimiter), so we need a smarter split strategy below.
      // For now, reconstruct each pattern into a full ad-unit path.
      adUnitPaths = patterns.map((pattern: string) =>
        pattern.replace(/\/(\d+)/g, (_: string, index: string) => {
          const idx = parseInt(index, 10)
          return '/' + (parts[idx] || '')
        }),
      )
    } else {
      adUnitPaths = ['/' + parts.join('/')]
    }
  }

  if (adUnitPaths.length === 0) adUnitPaths = ['']

  // ── 2. Extract network / MCM info from the first ad-unit path ─────────────
  const firstSegments = adUnitPaths[0].split('/').filter(Boolean)
  let parentNetwork = ''
  let childNetwork = ''
  let isMCM = false
  let networkPrefixLen = 0

  if (firstSegments.length >= 1 && firstSegments[0].includes(':')) {
    const networkParts = firstSegments[0].split(':')
    if (networkParts.length >= 2 && /^\d+$/.test(networkParts[0]) && /^\d+$/.test(networkParts[1])) {
      parentNetwork = networkParts[0]
      childNetwork = networkParts[1]
      isMCM = true
      networkPrefixLen = 1
    }
  }

  if (!parentNetwork) {
    if (firstSegments.length >= 2 && /^\d+$/.test(firstSegments[0]) && /^\d+$/.test(firstSegments[1])) {
      parentNetwork = firstSegments[0]
      childNetwork = firstSegments[1]
      isMCM = true
      networkPrefixLen = 2
    } else if (firstSegments.length >= 1 && /^\d+$/.test(firstSegments[0])) {
      parentNetwork = firstSegments[0]
      networkPrefixLen = 1
    }
  }

  // ── 3. Parse per-slot sizes ───────────────────────────────────────────────
  // In SRA, prev_iu_szs uses comma for BOTH multi-size within a slot AND
  // slot delimiter. The slot delimiter is only distinguishable by matching
  // the number of enc_prev_ius patterns. Pipe | is always multi-size.
  //
  // Strategy: if we have N ad-unit patterns from enc_prev_ius, we can use
  // the number of pipe-groups to split. Sizes like "1x1,728x90|970x90,300x250"
  // have 3 pipe-groups separated by commas that don't contain pipes.
  //
  // A simpler approach: split on comma, then re-group. A new slot boundary
  // starts whenever we've accumulated sizes and the next token starts a fresh
  // dimension without being preceded by a pipe on the previous token.
  //
  // Actually, GPT SRA tags delimit slots by comma at the top level, and
  // multi-size within a slot uses pipe. So: split on comma first, then
  // assign to slots based on whether the token contains a pipe.
  //
  // Correction: the real GPT behaviour is: comma separates sizes within a
  // single slot (along with pipe), and the slot boundary is implicit based
  // on count. We need to use a heuristic.
  //
  // Best approach: split the entire prev_iu_szs by comma, then greedily
  // assign sizes to slots. If a size token contains a pipe, expand it.
  // Since we know the exact slot count from enc_prev_ius, we can split
  // the sizes into exactly N groups.
  //
  // GPT actually uses comma to separate slots and pipe to separate sizes
  // within a slot. So "1x1,728x90|970x90|970x250|990x1,320x50|1024x400..."
  // splits into 3 slot groups by comma.

  const rawSizes = global['sz'] || global['prev_iu_szs'] || global['szs'] || '300x250'
  const slotCount = adUnitPaths.length

  let perSlotSizes: string[]
  if (slotCount > 1) {
    // Split by comma — each chunk is one slot's sizes (with pipe as multi-size)
    const sizeChunks = rawSizes.split(',')
    if (sizeChunks.length === slotCount) {
      // Perfect 1:1 match — each comma group is one slot
      perSlotSizes = sizeChunks.map((s: string) => s.replace(/\|/g, ','))
    } else {
      // Fallback: assign all sizes to each slot
      perSlotSizes = adUnitPaths.map(() => rawSizes.replace(/\|/g, ',').replace(/%2C/gi, ','))
    }
  } else {
    perSlotSizes = [rawSizes.replace(/\|/g, ',').replace(/%2C/gi, ',')]
  }

  // ── 4. Parse per-slot targeting from prev_scp ─────────────────────────────
  // In SRA, prev_scp uses pipe | to separate per-slot targeting blocks.
  let perSlotScp: string[] = []
  if (global['prev_scp']) {
    perSlotScp = global['prev_scp'].split('|')
  }

  // ── 5. Parse shared page-level targeting (cust_params, scp) ───────────────
  const sharedTargeting: Record<string, string> = { ...cust }
  if (global['scp']) {
    const scpParams = parseQueryString(global['scp'])
    Object.assign(sharedTargeting, scpParams)
  }

  const pageTargeting: { key: string; val: string }[] = []
  Object.entries(sharedTargeting).forEach(([key, val]) => {
    if (typeof val === 'string') {
      pageTargeting.push({ key, val })
    }
  })

  // ── 6. Build slot objects ─────────────────────────────────────────────────
  const fluidList = global['fluid'] ? global['fluid'].split(',') : []
  const slots = adUnitPaths.map((adUnit, i) => {
    const segments = adUnit.split('/').filter(Boolean)
    const slotPath = segments.slice(networkPrefixLen).join('/') || 'testing_slot'
    let sizes = perSlotSizes[i] || perSlotSizes[0] || '300x250'

    const isFluid = fluidList[i] && fluidList[i] !== '0'
    if (isFluid) {
      if (sizes === '300x250' && !global['prev_iu_szs'] && !global['szs'] && !global['sz']) {
        sizes = 'fluid'
      } else {
        sizes = sizes ? `${sizes},fluid` : 'fluid'
      }
    }

    // Per-slot targeting from prev_scp
    const slotTargeting: { key: string; val: string }[] = []
    if (perSlotScp[i]) {
      const scpParams = parseQueryString(perSlotScp[i])
      Object.entries(scpParams).forEach(([key, val]) => {
        if (typeof val === 'string') {
          slotTargeting.push({ key, val })
        }
      })
    }

    return {
      path: slotPath,
      sizes,
      oop: false,
      comp: false,
      targeting: slotTargeting,
    }
  })

  // ── 7. Check if VAST (video) ──────────────────────────────────────────────
  const output = global['output'] || ''
  const isVast = output.toLowerCase().includes('vast') || decoded.isVast

  return {
    tagType: 'async',
    isSingleRequestArchitectureEnabled: true,
    collapseEmptyDivs: global['scp'] === '1' || global['empty'] === 'collapse',
    disableInitialLoad: false,
    forceSafeFrame: global['sf'] === '1',
    centerAds: false,
    disableCookies: false,
    disableConsole: false,
    tagForChildDirectedTreatment: false,
    ampValidation: true,
    ampPlaceholders: false,
    geolocationCoordinates: '',
    geolocationCountry: '',
    contentExclusion: '',
    publisherProvidedId: '',
    videoEnabled: isVast,
    video: {
      format: 'vast',
      type: 'single',
      allowNonCompanionAds: true,
      enableCompanionAutofill: false,
      cmsId: '',
      videoId: '',
    },
    pageTargeting,
    sizeMappingEnabled: false,
    sizeMappingName: 'mapping1',
    sizeMappingLines: [],
    adsenseEnabled: false,
    adsense: {
      uiEnabled: true,
      backgroundColor: '#ffffff',
      borderColor: '#ffffff',
      titleLinkColor: '#0000ff',
      textColor: '#000000',
      urlColor: '#008000',
      format: 'text_image',
      pageUrl: '',
      channelIds: '',
      feature: '',
    },
    slots,
    isMCM,
    parentNetwork,
    childNetwork,
    pageUrl: (global['url'] || global['ref'] || '').replace(/^https?:\/\//i, '').replace(/^\/\//, ''),
    customHeaderCode: null,
    customBodyCode: null,
    correlator: Date.now(),
  }
}

export function DecoderTab() {
  const tagInput = useDecoderStore((s) => s.tagInput)
  const decoded = useDecoderStore((s) => s.decoded)
  const activeFilterCategory = useDecoderStore((s) => s.activeFilterCategory)
  const searchTargeting = useDecoderStore((s) => s.searchTargeting)
  const searchCore = useDecoderStore((s) => s.searchCore)
  const searchGlobal = useDecoderStore((s) => s.searchGlobal)
  const setTagInput = useDecoderStore((s) => s.setTagInput)
  const setActiveFilterCategory = useDecoderStore((s) => s.setActiveFilterCategory)
  const setSearchTargeting = useDecoderStore((s) => s.setSearchTargeting)
  const setSearchCore = useDecoderStore((s) => s.setSearchCore)
  const setSearchGlobal = useDecoderStore((s) => s.setSearchGlobal)
  const decode = useDecoderStore((s) => s.decode)
  const clear = useDecoderStore((s) => s.clear)

  const theme = useTheme((s) => s.theme)
  const [previewState, setPreviewState] = useState<TagSettingsState | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState<'100%' | '768px' | '360px'>('100%')
  const [previewTagType, setPreviewTagType] = useState<'display' | 'vast'>('display')

  const handlePreview = () => {
    if (!tagInput.trim()) {
      toast.error('Please enter an ad tag to preview.')
      return
    }
    try {
      const result = decodeAdTag(tagInput)
      if (!result) {
        toast.error('Failed to parse the ad tag.')
        return
      }
      decode()

      if (result.isVast || result.isCm360) {
        setPreviewTagType('vast')
        setPreviewState(null)
        setIsPreviewOpen(true)
        return
      }

      setPreviewTagType('display')
      const state = mapDecodedTagToState(result)
      setPreviewState(state)
      setViewportWidth('100%')
      setIsPreviewOpen(true)
    } catch (err) {
      console.error('Preview mapping error:', err)
      toast.error('Failed to build preview — tag may use unsupported parameters.')
    }
  }

  const handleOpenNewTab = (consoleFlag: boolean) => {
    if (!previewState) return
    const config = {
      snapshot: previewState,
      pubConsole: consoleFlag,
      isDark: theme === 'dark',
      isFromDecoder: true,
    }
    localStorage.setItem('adTagTestPageConfig', JSON.stringify(config))
    window.open('/testpage', '_blank')
  }

  const srcDoc = useMemo(() => {
    if (!previewState) return ''
    return generateStagingHtml(previewState, { isPreview: true, isDark: theme === 'dark' })
  }, [previewState, theme])

  const handleDecode = () => {
    if (!tagInput.trim()) {
      toast.error('Please enter an ad tag to inspect.')
      return
    }
    decode()
    toast.success('Ad tag parameters parsed successfully.')
  }

  const globalParameters = useMemo(() => decoded?.globalParameters ?? {}, [decoded])
  const targetingParameters = useMemo(() => decoded?.customTargetingParameters ?? {}, [decoded])

  const coreItems = useMemo(
    () => (decoded ? buildCoreItems(globalParameters, decoded.isCm360, decoded.pathName) : []),
    [decoded, globalParameters]
  )

  const filteredTargeting = Object.entries(targetingParameters)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([k, v]) => !searchTargeting || k.toLowerCase().includes(searchTargeting.toLowerCase()) || v.toLowerCase().includes(searchTargeting.toLowerCase()))

  const filteredCore = coreItems.filter(
    (item) =>
      !searchCore ||
      item.label.toLowerCase().includes(searchCore.toLowerCase()) ||
      item.val.toLowerCase().includes(searchCore.toLowerCase()) ||
      item.key.toLowerCase().includes(searchCore.toLowerCase())
  )

  const filteredGlobal = Object.entries(globalParameters)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([key]) => {
      const category = AD_PARAMETER_CATEGORY_MAP[key] || 'general'
      return activeFilterCategory === 'all' || category === activeFilterCategory
    })
    .filter(([key, value]) => {
      const dict = AD_PARAMETER_DICTIONARY[key]
      if (!searchGlobal) return true
      const q = searchGlobal.toLowerCase()
      return key.toLowerCase().includes(q) || value.toLowerCase().includes(q) || (dict?.name.toLowerCase().includes(q) ?? false)
    })

  const jsonPreview = decoded
    ? JSON.stringify(
      {
        meta: { timestamp: new Date().toISOString(), total_keys: Object.keys(globalParameters).length, targeting_keys: Object.keys(targetingParameters).length },
        global: globalParameters,
        targeting: targetingParameters,
      },
      null,
      2
    )
    : '{}'

  const url = globalParameters.url
  const ref = globalParameters.ref
  let mismatch = false
  if (url && ref) {
    try {
      mismatch = new URL(url).hostname !== new URL(ref).hostname
    } catch {
      mismatch = false
    }
  }

  const downloadJson = () => {
    if (!tagInput.trim()) {
      toast.error('Decode a tag first')
      return
    }
    const blob = new Blob([jsonPreview], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'gam_decoded_tag.json'
    a.click()
    toast.success('Downloaded JSON')
  }

  const downloadCsv = () => {
    if (!tagInput.trim()) {
      toast.error('Decode a tag first')
      return
    }
    let csv = 'Type,Key,Name,Value,Description\n'
    Object.keys(targetingParameters)
      .sort()
      .forEach((k) => {
        csv += `"Custom","${k}","Targeting","${targetingParameters[k].replace(/"/g, '""')}","Custom targeting key"\n`
      })
    Object.keys(globalParameters)
      .sort()
      .forEach((k) => {
        const dict = AD_PARAMETER_DICTIONARY[k] || { name: 'Custom', desc: 'Publisher-defined' }
        csv += `"Global","${k}","${dict.name.replace(/"/g, '""')}","${globalParameters[k].replace(/"/g, '""')}","${dict.desc.replace(/"/g, '""')}"\n`
      })
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'gam_decoded_tag.csv'
    a.click()
    toast.success('Downloaded CSV')
  }

  const copyShareLink = () => {
    if (!tagInput.trim()) return
    const shareUrl = new URL(window.location.href)
    shareUrl.hash = `tab=decoder&tag=${encodeURIComponent(tagInput.trim())}`
    navigator.clipboard.writeText(shareUrl.toString())
    toast.success('Share link copied!')
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ad Tag Validator &amp; Decoder</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-90">
              Total Keys: <b>{Object.keys(globalParameters).length}</b>
            </span>
            <span className="text-xs opacity-90">
              Targeting: <b>{Object.keys(targetingParameters).length}</b>
            </span>
            <ValidationBadge decoded={decoded} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Paste a DoubleClick / GAM ad request URL here…"
            className="min-h-24 font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handlePreview} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Eye className="size-3.5 mr-1" /> Preview
            </Button>
            <Button size="sm" variant="outline" onClick={handleDecode}>
              Decode
            </Button>
            <Button
              size="sm"
              onClick={clear}
              className="bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              <Trash2 className="size-3.5 mr-1" /> Clear
            </Button>
            {/* Removed samples */}
            <Button size="sm" variant="outline" onClick={copyShareLink} disabled={!decoded}>
              <Link2 className="size-3.5" /> Share Link
            </Button>
            <Button size="sm" variant="outline" onClick={downloadJson} disabled={!decoded}>
              <Download className="size-3.5" /> JSON
            </Button>
            <Button size="sm" variant="outline" onClick={downloadCsv} disabled={!decoded}>
              <Download className="size-3.5" /> CSV
            </Button>
          </div>
          {decoded && <ValidationAlert decoded={decoded} />}
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Preview &amp; Ad Delivery Notice</div>
              <div className="opacity-90 mt-1 space-y-1">
                <p>
                  Some website Ads might not preview/render in test environment might show up ("No Ad Returned") due to:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 mt-1">
                  {/* <li><b>Domain Restrictions</b>: The publisher's Google Ad Manager server may only serve ads to whitelisted domains. Use the <b>Page URL</b> field in settings to override the host page.</li> */}
                  <li><b>IAB GDPR/TCF Consent</b>: UK/EEA publishers strictly require CMP consent cookies. Without them, ad networks block delivery.</li>
                  <li><b>Geotargeting &amp; Custom Targeting Mismatches</b>: Active campaigns on the publisher's ad server might strictly target certain locations (e.g. US, UK only) or key-value criteria. Adjust targeting parameters under <b>Custom Targeting</b> to match active campaigns.</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!decoded ? (
        <EmptyState className="py-16">Paste an ad request URL above and click Decode to inspect it.</EmptyState>
      ) : (
        <>
          {/* ── Tag Summary Bar ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Network ID */}
            <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5">
              <Network className="size-4 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Network ID</div>
                <div className="font-mono text-sm font-bold truncate">
                  {(() => {
                    const iu = globalParameters['iu'] || ''
                    const iuParts = globalParameters['iu_parts'] || ''
                    if (iu) {
                      const seg = iu.split('/').filter(Boolean)
                      return seg[0] && /^\d+$/.test(seg[0]) ? seg[0] : 'N/A'
                    }
                    if (iuParts) {
                      const first = iuParts.split(',')[0]
                      return first && /^\d+$/.test(first) ? first : 'N/A'
                    }
                    return 'N/A'
                  })()}
                </div>
              </div>
            </div>

            {/* Tag Type */}
            <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5">
              <Globe className="size-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Tag Type</div>
                <div className="text-sm font-bold">
                  {decoded.isVast ? 'VAST' : decoded.isCm360 ? 'CM360' : decoded.isGam ? 'GPT' : 'Unknown'}
                </div>
              </div>
            </div>

            {/* Request Type */}
            <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5">
              <Layers className="size-4 text-orange-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Request Type</div>
                <div className="text-sm font-bold">
                  {globalParameters['enc_prev_ius'] && globalParameters['enc_prev_ius'].includes(',') ? 'SRA' : 'Standard'}
                </div>
              </div>
            </div>

            {/* Slot Count */}
            <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5">
              <Eye className="size-4 text-green-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Ad Slots</div>
                <div className="text-sm font-bold">
                  {(() => {
                    const encPrev = globalParameters['enc_prev_ius'] || ''
                    if (encPrev && encPrev.includes(',')) {
                      return encPrev.split(',').length
                    }
                    return 1
                  })()}
                </div>
              </div>
            </div>
          </div>

          <ResizablePanels
            defaultLeftPercent={62}
            left={
              <div className="flex flex-col gap-4 pr-0 lg:pr-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Ad Unit &amp; Size Config</CardTitle>
                    <Input
                      value={searchCore}
                      onChange={(e) => setSearchCore(e.target.value)}
                      placeholder="Filter…"
                      className="h-6 w-32 border-white/30 bg-white/10 text-xs text-primary-foreground placeholder:text-primary-foreground/60"
                    />
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredCore.length === 0 ? (
                      <EmptyState>No parameters match filter.</EmptyState>
                    ) : (
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border">
                          {filteredCore.map((item) => (
                            <tr key={item.key}>
                              <td className="px-3 py-2 align-top">
                                <div className="font-semibold">{item.label}</div>
                                <div className="text-xs text-muted-foreground">{item.key}</div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="font-mono text-xs text-primary">{item.val}</div>
                                <div className="text-xs text-muted-foreground">{item.desc}</div>
                              </td>
                              <td className="w-8 px-2 py-2 text-right align-top">
                                <Button size="icon-sm" variant="ghost" onClick={() => copy(item.val, `Copied: ${item.label}`)}>
                                  <Copy className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Custom Targeting (cust_params)</CardTitle>
                    <Input
                      value={searchTargeting}
                      onChange={(e) => setSearchTargeting(e.target.value)}
                      placeholder="Filter…"
                      className="h-6 w-32 border-white/30 bg-white/10 text-xs text-primary-foreground placeholder:text-primary-foreground/60"
                    />
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredTargeting.length === 0 ? (
                      <EmptyState>No targeting parameters detected.</EmptyState>
                    ) : (
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border">
                          {filteredTargeting.map(([key, value]) => (
                            <tr key={key}>
                              <td className="px-3 py-2 font-semibold">{key}</td>
                              <td className="px-3 py-2">
                                {value.includes(',') ? (
                                  <div className="flex flex-wrap gap-1">
                                    {value.split(',').map((v, i) => (
                                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                        {v}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="font-mono text-xs">{value}</span>
                                )}
                              </td>
                              <td className="w-8 px-2 py-2 text-right">
                                <Button size="icon-sm" variant="ghost" onClick={() => copy(`${key}=${value}`, `Copied: ${key}`)}>
                                  <Copy className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Global Query Parameters</CardTitle>
                    <Input
                      value={searchGlobal}
                      onChange={(e) => setSearchGlobal(e.target.value)}
                      placeholder="Filter…"
                      className="h-6 w-32 border-white/30 bg-white/10 text-xs text-primary-foreground placeholder:text-primary-foreground/60"
                    />
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORY_PILLS.map((pill) => (
                        <button
                          key={pill.value}
                          onClick={() => setActiveFilterCategory(pill.value)}
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                            activeFilterCategory === pill.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                          )}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>
                    {filteredGlobal.length === 0 ? (
                      <EmptyState>No parameters match filter.</EmptyState>
                    ) : (
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border">
                          {filteredGlobal.map(([key, value]) => {
                            const dict = AD_PARAMETER_DICTIONARY[key] || { name: 'Custom Parameter', desc: 'Publisher-defined parameter.' }
                            const isPredefined = key in AD_PARAMETER_DICTIONARY
                            return (
                              <tr key={key}>
                                <td className={cn('px-2 py-2 align-top font-mono text-xs', isPredefined ? 'text-primary' : 'text-muted-foreground')}>{key}</td>
                                <td className="px-2 py-2 align-top">
                                  <div className="font-semibold">{dict.name}</div>
                                  <div className="text-xs text-muted-foreground">{dict.desc}</div>
                                </td>
                                <td className="max-w-[200px] px-2 py-2 align-top">
                                  {key === 'cust_params' || key === 'prev_scp' ? (
                                    <pre className="max-w-full overflow-x-auto rounded bg-muted p-1.5 text-[10px] break-all whitespace-pre-wrap">{value}</pre>
                                  ) : value.includes(',') || value.includes('|') ? (
                                    <div className="flex flex-wrap gap-1">
                                      {value.split(value.includes(',') ? ',' : '|').map((v, i) => (
                                        <span key={i} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                                          {v}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="font-mono text-xs break-all">{value}</span>
                                  )}
                                </td>
                                <td className="w-8 px-2 py-2 text-right align-top">
                                  <Button size="icon-sm" variant="ghost" onClick={() => copy(value, `Copied: ${key}`)}>
                                    <Copy className="size-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
            }
            right={
              <div className="flex flex-col gap-4">
                <EnvironmentPanel globalParameters={globalParameters} />

                <Card>
                  <CardHeader>
                    <CardTitle>Page / Referrer</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <div>
                      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">URL</div>
                      <div className="font-mono text-xs break-all">{url || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Referrer</div>
                      <div className="font-mono text-xs break-all">{ref || 'N/A'}</div>
                    </div>
                    {mismatch && (
                      <Badge variant="destructive" className="w-fit normal-case">
                        URL / Referrer hostname mismatch
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>JSON Export</CardTitle>
                    <Button size="icon-sm" variant="ghost" className="hover:bg-white/20" onClick={() => copy(jsonPreview, 'Copied JSON!')}>
                      <Copy className="size-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <pre className="max-h-64 overflow-auto p-3 font-mono text-[11px] leading-relaxed">{jsonPreview}</pre>
                  </CardContent>
                </Card>
              </div>
            }
          />
        </>
      )}

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className={cn(previewTagType === 'vast' ? 'max-w-3xl' : 'max-w-5xl h-[85vh]', 'flex flex-col p-6')}>
          {previewTagType === 'vast' ? (
            /* ── VAST / CM360 Tag Preview ── */
            <>
              <DialogHeader className="border-b pb-3 mb-2">
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Clapperboard className="size-5 text-orange-500" /> Video / VAST Tag Detected
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  This tag delivers a VAST XML response. Use the VAST Inspector to test playback and verify the XML response.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-5 py-2">
                {/* Tag URL display */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase mb-2">Tag URL</div>
                  <div className="font-mono text-xs break-all leading-relaxed max-h-32 overflow-y-auto select-all">
                    {tagInput.trim()}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => {
                      const inspectorUrl = `https://googleads.github.io/googleads-ima-html5/vsi/?tag=${encodeURIComponent(tagInput.trim())}`
                      window.open(inspectorUrl, '_blank')
                    }}
                  >
                    <Play className="size-3.5 mr-1" /> Open VAST Inspector
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.open(tagInput.trim(), '_blank')
                    }}
                  >
                    <ExternalLink className="size-3.5 mr-1" /> View Raw XML
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(tagInput.trim())
                      toast.success('Tag URL copied!')
                    }}
                  >
                    <Copy className="size-3.5 mr-1" /> Copy Tag URL
                  </Button>
                </div>

                {/* Decoded key info */}
                {decoded && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border p-4 text-xs">
                    <div><span className="text-muted-foreground">Host:</span> <span className="font-mono">{decoded.hostName}</span></div>
                    <div><span className="text-muted-foreground">Type:</span> <Badge variant="secondary" className="ml-1 text-[10px]">{decoded.isVast ? 'VAST XML' : 'CM360'}</Badge></div>
                    {decoded.globalParameters['dc_vast'] && (
                      <div><span className="text-muted-foreground">VAST Version:</span> <span className="font-mono">{decoded.globalParameters['dc_vast']}</span></div>
                    )}
                    {decoded.globalParameters['sz'] && (
                      <div><span className="text-muted-foreground">Companion Sizes:</span> <span className="font-mono">{decoded.globalParameters['sz']}</span></div>
                    )}
                    {decoded.globalParameters['afvsz'] && (
                      <div className="col-span-2"><span className="text-muted-foreground">Available Formats:</span> <span className="font-mono">{decoded.globalParameters['afvsz']}</span></div>
                    )}
                    {decoded.globalParameters['dcmt'] && (
                      <div><span className="text-muted-foreground">MIME Type:</span> <span className="font-mono">{decodeURIComponent(decoded.globalParameters['dcmt'])}</span></div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Display Ad Preview ── */
            <>
              <DialogHeader className="border-b pb-3 mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Eye className="size-5 text-primary animate-pulse" /> Decoded Ad Tag Live Preview
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-2xl">
                    Ad Unit: {previewState?.slots[0]?.path} | Sizes: {previewState?.slots[0]?.sizes}
                  </DialogDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 mr-8">
                  <div className="flex border rounded-md p-0.5 bg-muted/40">
                    <Button
                      size="icon-sm"
                      variant={viewportWidth === '100%' ? 'default' : 'ghost'}
                      onClick={() => setViewportWidth('100%')}
                      title="Desktop (100% Width)"
                    >
                      <Laptop className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant={viewportWidth === '768px' ? 'default' : 'ghost'}
                      onClick={() => setViewportWidth('768px')}
                      title="Tablet (768px Width)"
                    >
                      <Tablet className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant={viewportWidth === '360px' ? 'default' : 'ghost'}
                      onClick={() => setViewportWidth('360px')}
                      title="Mobile (360px Width)"
                    >
                      <Smartphone className="size-3.5" />
                    </Button>
                  </div>

                  <Button size="sm" variant="outline" onClick={() => handleOpenNewTab(false)} className="text-xs">
                    <ExternalLink className="size-3.5 mr-1" /> Open Tab
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenNewTab(true)} className="text-xs">
                    <MonitorPlay className="size-3.5 mr-1" /> Publisher Console
                  </Button>
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/20 border rounded-lg p-4 overflow-y-auto">
                <div
                  style={{ width: viewportWidth }}
                  className="transition-all duration-300 border border-border bg-white rounded-md shadow-lg overflow-hidden flex flex-col h-full max-h-full"
                >
                  {viewportWidth !== '100%' && (
                    <div className="flex items-center justify-between bg-muted/60 border-b border-border px-3 py-1.5 text-xs text-muted-foreground select-none font-mono">
                      <span>Viewport: {viewportWidth === '768px' ? 'Tablet (768px)' : 'Mobile (360px)'}</span>
                      <div className="flex gap-1.5">
                        <span className="size-2 rounded-full bg-red-400/80" />
                        <span className="size-2 rounded-full bg-yellow-400/80" />
                        <span className="size-2 rounded-full bg-green-400/80" />
                      </div>
                    </div>
                  )}
                  <iframe
                    srcDoc={srcDoc}
                    title="Decoded Ad Tag Preview"
                    className="w-full flex-1 border-0 bg-white"
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
