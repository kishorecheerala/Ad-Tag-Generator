import { useMemo } from 'react'
import { Copy, Download, Link2, Trash2 } from 'lucide-react'
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
import { buildCoreItems } from './lib/parseAdTag'
import { AD_PARAMETER_CATEGORY_MAP, AD_PARAMETER_DICTIONARY, DECODER_CM360_SAMPLE_TAG, DECODER_SAMPLE_TAG, type ParameterCategory } from './data/parameterDictionary'
import { ValidationAlert, ValidationBadge } from './components/ValidationBadge'
import { EnvironmentPanel } from './components/EnvironmentPanel'

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

  const handleDecode = () => {
    if (!tagInput.trim()) {
      toast.error('Please enter an ad tag to inspect.')
      return
    }
    decode()
    toast.success('Ad tag parameters parsed successfully.')
  }

  const globalParameters = decoded?.globalParameters ?? {}
  const targetingParameters = decoded?.customTargetingParameters ?? {}

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
            <Button size="sm" onClick={handleDecode}>
              Decode
            </Button>
            <Button size="sm" variant="outline" onClick={clear}>
              <Trash2 className="size-3.5" /> Clear
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setTagInput(DECODER_SAMPLE_TAG); decode(); }}>
              GAM Sample
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setTagInput(DECODER_CM360_SAMPLE_TAG); decode(); }}>
              CM360 Sample
            </Button>
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
        </CardContent>
      </Card>

      {!decoded ? (
        <EmptyState className="py-16">Paste an ad request URL above and click Decode to inspect it.</EmptyState>
      ) : (
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
      )}
    </div>
  )
}
