import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useTagSettingsStore } from '../store'

export function AdvancedSettingsPanel() {
  const contentExclusion = useTagSettingsStore((s) => s.contentExclusion)
  const publisherProvidedId = useTagSettingsStore((s) => s.publisherProvidedId)
  const geolocationCoordinates = useTagSettingsStore((s) => s.geolocationCoordinates)
  const collapseEmptyDivs = useTagSettingsStore((s) => s.collapseEmptyDivs)
  const disableInitialLoad = useTagSettingsStore((s) => s.disableInitialLoad)
  const forceSafeFrame = useTagSettingsStore((s) => s.forceSafeFrame)
  const centerAds = useTagSettingsStore((s) => s.centerAds)
  const disableCookies = useTagSettingsStore((s) => s.disableCookies)
  const disableConsole = useTagSettingsStore((s) => s.disableConsole)
  const tagForChildDirectedTreatment = useTagSettingsStore((s) => s.tagForChildDirectedTreatment)
  const tagType = useTagSettingsStore((s) => s.tagType)
  const ampValidation = useTagSettingsStore((s) => s.ampValidation)
  const ampPlaceholders = useTagSettingsStore((s) => s.ampPlaceholders)
  const setField = useTagSettingsStore((s) => s.setField)

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setField('geolocationCoordinates', `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),
      () => toast.error('Could not read current location.')
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced Settings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label>Content Exclusion Label</Label>
          <Input value={contentExclusion} onChange={(e) => setField('contentExclusion', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Publisher Provided ID</Label>
          <Input value={publisherProvidedId} onChange={(e) => setField('publisherProvidedId', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>GPS Location (lat,long)</Label>
          <div className="flex gap-2">
            <Input value={geolocationCoordinates} onChange={(e) => setField('geolocationCoordinates', e.target.value)} placeholder="37.4220,-122.0841" />
            <Button size="icon" variant="outline" onClick={useCurrentLocation} title="Use current location">
              <MapPin className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          <ToggleRow label="Collapse Empty Divs" checked={collapseEmptyDivs} onCheckedChange={(v) => setField('collapseEmptyDivs', v)} />
          <ToggleRow label="Disable Initial Load" checked={disableInitialLoad} onCheckedChange={(v) => setField('disableInitialLoad', v)} />
          <ToggleRow label="Force SafeFrame" checked={forceSafeFrame} onCheckedChange={(v) => setField('forceSafeFrame', v)} />
          <ToggleRow label="Center Ads" checked={centerAds} onCheckedChange={(v) => setField('centerAds', v)} />
          <ToggleRow label="Disable Cookies" checked={disableCookies} onCheckedChange={(v) => setField('disableCookies', v)} />
          {tagType !== 'amp' && tagType !== 'passback' && (
            <ToggleRow label="Disable Publisher Console" checked={disableConsole} onCheckedChange={(v) => setField('disableConsole', v)} />
          )}
          <ToggleRow label="Tag For Child Directed Treatment" checked={tagForChildDirectedTreatment} onCheckedChange={(v) => setField('tagForChildDirectedTreatment', v)} />
        </div>

        {tagType === 'amp' && (
          <div className="flex flex-col divide-y divide-border rounded-md border border-border pt-1">
            <ToggleRow label="Multi Size Validation" checked={ampValidation} onCheckedChange={(v) => setField('ampValidation', v)} />
            <ToggleRow label="Include Placeholders" checked={ampPlaceholders} onCheckedChange={(v) => setField('ampPlaceholders', v)} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}
