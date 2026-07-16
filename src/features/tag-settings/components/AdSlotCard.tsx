import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { ChipInput } from '@/components/shared/ChipInput'
import { SizeChipInput } from '@/components/shared/SizeChipInput'
import { useTagSettingsStore } from '../store'
import type { AdSlot } from '../types'

interface AdSlotCardProps {
  index: number
  slot: AdSlot
}

export function AdSlotCard({ index, slot }: AdSlotCardProps) {
  const updateSlot = useTagSettingsStore((s) => s.updateSlot)
  const removeSlot = useTagSettingsStore((s) => s.removeSlot)
  const videoEnabled = useTagSettingsStore((s) => s.videoEnabled)
  const videoType = useTagSettingsStore((s) => s.video.type)
  const slotCount = useTagSettingsStore((s) => s.slots.length)

  const sizes = slot.sizes ? slot.sizes.split(',').map((s) => s.trim()).filter(Boolean) : []

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <span className="text-sm font-semibold">Ad slot {index + 1}</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Out Of Page
            <Switch checked={slot.oop} onCheckedChange={(v) => updateSlot(index, { oop: v })} />
          </label>
          {videoEnabled && videoType === 'mc' && index > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Companion Slot
              <Switch checked={slot.comp} onCheckedChange={(v) => updateSlot(index, { comp: v })} />
            </label>
          )}
          {slotCount > 1 && (
            <Button size="icon-sm" variant="ghost" onClick={() => removeSlot(index)} title="Remove slot">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label>Ad Unit Code *</Label>
          <Input
            value={slot.path}
            onChange={(e) => updateSlot(index, { path: e.target.value })}
            placeholder="e.g. kishore_testing"
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Ad Slot Sizes</Label>
          <SizeChipInput value={sizes} onChange={(v) => updateSlot(index, { sizes: v.join(', ') })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Custom Targeting</Label>
          <ChipInput value={slot.targeting} onChange={(v) => updateSlot(index, { targeting: v })} placeholder="Slot Level Key Value, Type key=value" />
        </div>
      </div>
    </div>
  )
}
