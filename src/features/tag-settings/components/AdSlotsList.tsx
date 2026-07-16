import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTagSettingsStore } from '../store'
import { AdSlotCard } from './AdSlotCard'
import { useUiStore } from '@/stores/uiStore'
import { toast } from 'sonner'

export function AdSlotsList() {
  const slots = useTagSettingsStore((s) => s.slots)
  const addSlot = useTagSettingsStore((s) => s.addSlot)
  const generateTags = useTagSettingsStore((s) => s.generateTags)
  const setActiveTab = useUiStore((s) => s.setActiveTab)

  const handleGenerate = () => {
    const success = generateTags()
    if (!success) {
      toast.error('Enter a Parent Network ID and add at least one ad slot first.')
      return
    }
    setActiveTab('settings')
  }

  return (
    <div className="flex flex-col gap-3">
      {slots.map((slot, i) => (
        <AdSlotCard key={i} index={i} slot={slot} />
      ))}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => addSlot()}>
          <Plus className="size-3.5" /> Add Slot
        </Button>
        <Button onClick={handleGenerate} className="px-8">
          Generate Tags
        </Button>
      </div>
    </div>
  )
}
