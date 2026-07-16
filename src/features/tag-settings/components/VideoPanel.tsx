import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTagSettingsStore } from '../store'
import type { VideoFormat, VideoType } from '../types'

const FORMAT_OPTIONS: { value: VideoFormat; label: string }[] = [
  { value: 'vast', label: 'Network Default VAST' },
  { value: 'xml_vast2', label: 'VAST 2.0' },
  { value: 'xml_vast3', label: 'VAST 3.0' },
  { value: 'vmap', label: 'Network Default VMAP' },
  { value: 'xml_vmap1', label: 'VMAP 1.0' },
]

export function VideoPanel() {
  const video = useTagSettingsStore((s) => s.video)
  const setVideoField = useTagSettingsStore((s) => s.setVideoField)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Tag (VAST)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label>Video Output Format</Label>
          <Select value={video.format} onValueChange={(v) => setVideoField('format', v as VideoFormat)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Video Tag Type</Label>
          <Select value={video.type} onValueChange={(v) => setVideoField('type', v as VideoType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Video Tag</SelectItem>
              <SelectItem value="mc">Master / Companion</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {video.type === 'mc' && (
          <div className="flex flex-col divide-y divide-border rounded-md border border-border pt-1">
            <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>Allow Non-Companion Ads</span>
              <Switch checked={video.allowNonCompanionAds} onCheckedChange={(v) => setVideoField('allowNonCompanionAds', v)} />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>Enable Companion Autofill</span>
              <Switch checked={video.enableCompanionAutofill} onCheckedChange={(v) => setVideoField('enableCompanionAutofill', v)} />
            </label>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <Label>Content ID (cmsid)</Label>
          <Input value={video.cmsId} onChange={(e) => setVideoField('cmsId', e.target.value)} className="font-mono" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Video ID</Label>
          <Input value={video.videoId} onChange={(e) => setVideoField('videoId', e.target.value)} className="font-mono" />
        </div>
      </CardContent>
    </Card>
  )
}
