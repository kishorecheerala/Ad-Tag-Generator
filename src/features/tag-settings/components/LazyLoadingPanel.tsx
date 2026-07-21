import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTagSettingsStore } from '../store'

export function LazyLoadingPanel() {
  const lazyLoadFetchMarginPercent = useTagSettingsStore((s) => s.lazyLoadFetchMarginPercent)
  const lazyLoadRenderMarginPercent = useTagSettingsStore((s) => s.lazyLoadRenderMarginPercent)
  const lazyLoadMobileScalingFactor = useTagSettingsStore((s) => s.lazyLoadMobileScalingFactor)
  const setField = useTagSettingsStore((s) => s.setField)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lazy Loading (Visualizer)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="fetch-margin">Fetch Margin Percent (%)</Label>
          <Input
            id="fetch-margin"
            type="number"
            value={lazyLoadFetchMarginPercent}
            onChange={(e) => setField('lazyLoadFetchMarginPercent', parseInt(e.target.value) || 0)}
            placeholder="e.g. 200"
          />
          <p className="text-[11px] text-muted-foreground leading-normal">
            Fetch slots when scrolled within X% of the viewport height. E.g. 200% fetches slots within 2 viewport heights.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="render-margin">Render Margin Percent (%)</Label>
          <Input
            id="render-margin"
            type="number"
            value={lazyLoadRenderMarginPercent}
            onChange={(e) => setField('lazyLoadRenderMarginPercent', parseInt(e.target.value) || 0)}
            placeholder="e.g. 100"
          />
          <p className="text-[11px] text-muted-foreground leading-normal">
            Render slots when scrolled within Y% of the viewport height. E.g. 100% renders slots within 1 viewport height.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="mobile-scaling">Mobile Scaling Factor</Label>
          <Input
            id="mobile-scaling"
            type="number"
            step="0.1"
            value={lazyLoadMobileScalingFactor}
            onChange={(e) => setField('lazyLoadMobileScalingFactor', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 2.0"
          />
          <p className="text-[11px] text-muted-foreground leading-normal">
            Multiplier applied to margins on mobile devices. E.g. 2.0 doubles the margins.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
