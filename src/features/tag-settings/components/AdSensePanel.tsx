import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTagSettingsStore } from '../store'
import type { AdSenseFeature, AdSenseFormat } from '../types'

const DEFAULT_ADSENSE = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  titleLinkColor: '#0000ff',
  textColor: '#000000',
  urlColor: '#008000',
} as const

const COLOR_FIELDS: { key: keyof typeof DEFAULT_ADSENSE; label: string }[] = [
  { key: 'backgroundColor', label: 'Background' },
  { key: 'borderColor', label: 'Border' },
  { key: 'titleLinkColor', label: 'Title Link' },
  { key: 'textColor', label: 'Text' },
  { key: 'urlColor', label: 'URL' },
]

export function AdSensePanel() {
  const adsense = useTagSettingsStore((s) => s.adsense)
  const setAdSenseField = useTagSettingsStore((s) => s.setAdSenseField)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adx/AdSense Settings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label>Page URL</Label>
          <Input value={adsense.pageUrl} onChange={(e) => setAdSenseField('pageUrl', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Channel IDs</Label>
          <Input value={adsense.channelIds} onChange={(e) => setAdSenseField('channelIds', e.target.value)} placeholder="comma-separated" />
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
          <span>UI Elements</span>
          <Switch checked={adsense.uiEnabled} onCheckedChange={(v) => setAdSenseField('uiEnabled', v)} />
        </label>

        {adsense.uiEnabled && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COLOR_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  <Label>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={adsense[key]}
                      onChange={(e) => setAdSenseField(key, e.target.value)}
                      className="h-8 w-8 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
                    />
                    <Input value={adsense[key]} onChange={(e) => setAdSenseField(key, e.target.value)} className="font-mono" />
                  </div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => {
                COLOR_FIELDS.forEach(({ key }) => setAdSenseField(key, DEFAULT_ADSENSE[key]))
              }}
            >
              Reset Colors
            </Button>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label>Ad Type</Label>
            <Select value={adsense.format} onValueChange={(v) => setAdSenseField('format', v as AdSenseFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text_image">text_image</SelectItem>
                <SelectItem value="text">text</SelectItem>
                <SelectItem value="image">image</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>UI Feature</Label>
            <Select value={adsense.feature || '__default__'} onValueChange={(v) => setAdSenseField('feature', (v === '__default__' ? '' : v) as AdSenseFeature)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Default</SelectItem>
                <SelectItem value="rc:0">rc:0</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
