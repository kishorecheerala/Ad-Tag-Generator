import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTagSettingsStore } from '../store'

export function DiagnosticsPanel() {
  const slots = useTagSettingsStore((s) => s.slots)
  const privacyConsent = useTagSettingsStore((s) => s.privacyConsent)
  const customConsentString = useTagSettingsStore((s) => s.customConsentString)
  const prebidEnabled = useTagSettingsStore((s) => s.prebidEnabled)
  const prebidBids = useTagSettingsStore((s) => s.prebidBids)
  const setField = useTagSettingsStore((s) => s.setField)

  const updateBid = (index: number, key: 'bidder' | 'cpm' | 'size', value: any) => {
    const updated = [...prebidBids]
    // Ensure the array element exists
    while (updated.length <= index) {
      updated.push({ bidder: 'appnexus', cpm: 3.5, size: '300x250' })
    }
    
    let typedVal = value
    if (key === 'cpm') {
      const parsed = parseFloat(value)
      typedVal = isNaN(parsed) ? 0 : parsed
    }
    
    updated[index] = { ...updated[index], [key]: typedVal }
    setField('prebidBids', updated)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consent Simulator &amp; Prebid Setup</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* CMP Simulator section */}
        <div className="flex flex-col gap-2.5">
          <Label className="font-semibold text-xs text-zinc-400 uppercase tracking-wider">CMP Consent Simulation</Label>
          <div className="flex flex-col gap-2">
            <Select
              value={privacyConsent}
              onValueChange={(val: any) => setField('privacyConsent', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select consent choice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Disabled (No simulation)</SelectItem>
                <SelectItem value="accepted">Accepted (Full Consent string)</SelectItem>
                <SelectItem value="rejected">Rejected (No Consent / restricted ads)</SelectItem>
                <SelectItem value="custom">Custom Consent String</SelectItem>
              </SelectContent>
            </Select>
            {privacyConsent === 'custom' && (
              <Input
                value={customConsentString}
                onChange={(e) => setField('customConsentString', e.target.value)}
                placeholder="e.g. CP12345... custom TCF base64 consent"
                className="mt-1 font-mono text-xs"
              />
            )}
          </div>
        </div>

        <hr className="border-border my-1" />

        {/* Prebid Simulator section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label className="font-semibold text-xs text-zinc-400 uppercase tracking-wider">Prebid.js Auctions Mock</Label>
            <Switch
              checked={prebidEnabled}
              onCheckedChange={(val) => setField('prebidEnabled', val)}
            />
          </div>

          {prebidEnabled && (
            <div className="flex flex-col gap-3.5 border rounded-lg bg-muted/20 p-3 mt-1 max-h-[300px] overflow-y-auto">
              <span className="text-[11px] text-zinc-400">Configure simulated bid overrides for each ad slot:</span>
              
              {slots.map((slot, index) => {
                const bid = prebidBids[index] || { bidder: 'appnexus', cpm: 3.5, size: '300x250' }
                const slotLabel = slot.path ? `Slot ${index + 1}: /${slot.path}` : `Slot ${index + 1} (no path)`
                const firstSize = slot.sizes ? slot.sizes.split(',')[0].trim() : '300x250'
                
                return (
                  <div key={index} className="flex flex-col gap-1.5 border-b border-zinc-800/40 last:border-0 pb-3 last:pb-0">
                    <span className="text-xs font-mono font-bold truncate max-w-full text-zinc-300" title={slotLabel}>
                      {slotLabel}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-zinc-500">Bidder</Label>
                        <Input
                          value={bid.bidder}
                          onChange={(e) => updateBid(index, 'bidder', e.target.value)}
                          placeholder="appnexus"
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-500">CPM ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={bid.cpm}
                          onChange={(e) => updateBid(index, 'cpm', e.target.value)}
                          placeholder="3.50"
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-500">Size</Label>
                        <Input
                          value={bid.size}
                          onChange={(e) => updateBid(index, 'size', e.target.value)}
                          placeholder={firstSize}
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
