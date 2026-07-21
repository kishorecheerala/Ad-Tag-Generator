import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileJson, Code, Video, Globe, RefreshCw, Sparkles, ExternalLink } from 'lucide-react'
import { useCreativePreviewStore, type CreativeSizePreset } from '../store'
import { toast } from 'sonner'

const SIZE_PRESETS: { value: CreativeSizePreset; label: string }[] = [
  { value: '300x250', label: '300x250 Medium Banner' },
  { value: '728x90', label: '728x90 Leaderboard' },
  { value: '300x600', label: '300x600 Half Page' },
  { value: '320x50', label: '320x50 Mobile Leaderboard' },
  { value: '160x600', label: '160x600 Wide Skyscraper' },
  { value: '970x250', label: '970x250 Billboard' },
  { value: '640x360', label: '640x360 (16:9 Video Canvas)' },
  { value: 'fluid', label: 'Fluid (Native Content)' },
  { value: 'responsive', label: 'Responsive (Auto Fill)' },
]

export function CreativeFormatToolbar() {
  const formatMode = useCreativePreviewStore((s) => s.formatMode)
  const setFormatMode = useCreativePreviewStore((s) => s.setFormatMode)
  const size = useCreativePreviewStore((s) => s.size)
  const setSize = useCreativePreviewStore((s) => s.setSize)
  const setLiveSiteModalOpen = useCreativePreviewStore((s) => s.setLiveSiteModalOpen)
  const loadGamNativeJsonPreset = useCreativePreviewStore((s) => s.loadGamNativeJsonPreset)
  const loadGamVideoPreset = useCreativePreviewStore((s) => s.loadGamVideoPreset)
  const loadHtml5Preset = useCreativePreviewStore((s) => s.loadHtml5Preset)
  const reset = useCreativePreviewStore((s) => s.reset)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-xs">
      {/* Format Switcher */}
      <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border">
        <Button
          variant={formatMode === 'on_site_gam' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold"
          onClick={() => {
            setFormatMode('on_site_gam')
            toast.info('Switched to GAM On-Site Ad Renderer Mode')
          }}
        >
          <Globe className="size-4 text-emerald-400" />
          <span>GAM On-Site Renderer</span>
        </Button>
        <Button
          variant={formatMode === 'json' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold"
          onClick={() => {
            setFormatMode('json')
            toast.info('Switched to GAM Native Custom Format (JSON Schema v3)')
          }}
        >
          <FileJson className="size-4" />
          <span>GAM Native JSON</span>
        </Button>
        <Button
          variant={formatMode === 'video' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold"
          onClick={() => {
            setFormatMode('video')
            toast.info('Switched to GAM Video Player Mode')
          }}
        >
          <Video className="size-4 text-rose-400" />
          <span>Video Creative</span>
        </Button>
        <Button
          variant={formatMode === 'html' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold"
          onClick={() => {
            setFormatMode('html')
            toast.info('Switched to HTML5 / Custom JS Editor')
          }}
        >
          <Code className="size-4 text-cyan-400" />
          <span>HTML5 Display</span>
        </Button>
      </div>

      {/* Presets & Dimensions */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={size} onValueChange={(v) => setSize(v as CreativeSizePreset)}>
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue placeholder="Select Ad Size" />
          </SelectTrigger>
          <SelectContent>
            {SIZE_PRESETS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => {
              loadGamNativeJsonPreset()
              toast.success('Loaded GAM Native JSON Schema v3 template')
            }}
            title="Load GAM MCM Native Custom Format JSON"
          >
            <Sparkles className="size-3.5 text-amber-400" />
            <span>Preset GAM Native</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => {
              loadGamVideoPreset()
              toast.success('Loaded GAM Outstream Video creative preset')
            }}
            title="Load Video Creative Preset"
          >
            <Video className="size-3.5 text-rose-400" />
            <span>Preset Video</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => {
              loadHtml5Preset()
              toast.success('Loaded HTML5 Banner preset')
            }}
            title="Load HTML5 Banner Preset"
          >
            <Code className="size-3.5 text-cyan-400" />
            <span>Preset HTML5</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 font-semibold"
            onClick={() => {
              reset()
              useCreativePreviewStore.getState().updateLiveSiteConfig({
                adUnitId: '/23171577/expedia.fr_fr/hotels results',
                lineItemId: '7322921650',
                creativeId: '138561712827',
                sizeTargeting: '160x600',
              })
              toast.success('Reset all creative settings & GAM parameters to defaults!')
            }}
            title="Reset All Creative Settings to Defaults"
          >
            <RefreshCw className="size-3.5 text-amber-400" />
            <span>Reset Defaults</span>
          </Button>
        </div>

        {/* GAM On-Site Preview Tool Launcher */}
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 ml-1"
          onClick={() => setLiveSiteModalOpen(true)}
        >
          <ExternalLink className="size-4" />
          <span>On-Site Link Helper</span>
        </Button>
      </div>
    </div>
  )
}
