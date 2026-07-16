import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChipInput } from '@/components/shared/ChipInput'
import { ClearableInput } from '@/components/shared/ClearableInput'
import { useTagSettingsStore } from '../store'
import type { TagType } from '../types'

const TAG_TYPE_OPTIONS: { value: TagType; label: string }[] = [
  { value: 'async', label: 'GPT (Async)' },
  { value: 'sync', label: 'GPT (Sync)' },
  { value: 'passback', label: 'Passback' },
  { value: 'amp', label: 'AMP Ad' },
]

export function TagSettingsCard() {
  const tagType = useTagSettingsStore((s) => s.tagType)
  const parentNetwork = useTagSettingsStore((s) => s.parentNetwork)
  const childNetwork = useTagSettingsStore((s) => s.childNetwork)
  const pageTargeting = useTagSettingsStore((s) => s.pageTargeting)
  const isSRA = useTagSettingsStore((s) => s.isSingleRequestArchitectureEnabled)
  const advancedPanelOpen = useTagSettingsStore((s) => s.advancedPanelOpen)
  const sizeMappingPanelOpen = useTagSettingsStore((s) => s.sizeMappingPanelOpen)
  const adsensePanelOpen = useTagSettingsStore((s) => s.adsensePanelOpen)
  const videoPanelOpen = useTagSettingsStore((s) => s.videoPanelOpen)

  const setField = useTagSettingsStore((s) => s.setField)
  const setAdvancedPanelOpen = useTagSettingsStore((s) => s.setAdvancedPanelOpen)
  const setSizeMappingPanelOpen = useTagSettingsStore((s) => s.setSizeMappingPanelOpen)
  const setAdsensePanelOpen = useTagSettingsStore((s) => s.setAdsensePanelOpen)
  const setVideoPanelOpen = useTagSettingsStore((s) => s.setVideoPanelOpen)
  const loadBasicSample = useTagSettingsStore((s) => s.loadBasicSample)
  const loadAdvancedSample = useTagSettingsStore((s) => s.loadAdvancedSample)
  const resetTagSettings = useTagSettingsStore((s) => s.resetTagSettings)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag Settings</CardTitle>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 px-3 text-xs"
          onClick={resetTagSettings}
          title="Reset Tag Settings entirely"
        >
          Reset
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label>Tag Type</Label>
            <Select value={tagType} onValueChange={(v) => setField('tagType', v as TagType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAG_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Parent Network ID *</Label>
            <ClearableInput
              value={parentNetwork}
              onChange={(e) => setField('parentNetwork', e.target.value)}
              onClear={() => setField('parentNetwork', '')}
              placeholder="e.g. 82109981"
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>MCM Child ID</Label>
            <ClearableInput
              value={childNetwork}
              onChange={(e) => setField('childNetwork', e.target.value)}
              onClear={() => setField('childNetwork', '')}
              placeholder="e.g. 22880237682"
              className="font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label>Custom Targeting</Label>
          <ChipInput value={pageTargeting} onChange={(v) => setField('pageTargeting', v)} placeholder="Page Level Key Value, Type key=value" />
        </div>

        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          <ToggleRow label="Single Request Architecture (SRA)" checked={isSRA} onCheckedChange={(v) => setField('isSingleRequestArchitectureEnabled', v)} />
          <ToggleRow label="Advanced Options" checked={advancedPanelOpen} onCheckedChange={setAdvancedPanelOpen} />
          <ToggleRow label="Size Mapping (Responsive Design)" checked={sizeMappingPanelOpen} onCheckedChange={setSizeMappingPanelOpen} />
          <ToggleRow label="Adx/AdSense Settings" checked={adsensePanelOpen} onCheckedChange={setAdsensePanelOpen} />
          <ToggleRow label="Video Tag (VAST)" checked={videoPanelOpen} onCheckedChange={setVideoPanelOpen} />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={loadBasicSample} className="font-semibold text-primary hover:underline">
            Basic Sample
          </button>
          <span className="text-muted-foreground">|</span>
          <button type="button" onClick={loadAdvancedSample} className="font-semibold text-primary hover:underline">
            Advanced Sample
          </button>
        </div>
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
