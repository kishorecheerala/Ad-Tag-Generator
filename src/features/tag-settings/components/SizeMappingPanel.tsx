import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useTagSettingsStore } from '../store'

export function SizeMappingPanel() {
  const sizeMappingName = useTagSettingsStore((s) => s.sizeMappingName)
  const sizeMappingLines = useTagSettingsStore((s) => s.sizeMappingLines)
  const setField = useTagSettingsStore((s) => s.setField)
  const addLine = useTagSettingsStore((s) => s.addSizeMappingLine)
  const removeLine = useTagSettingsStore((s) => s.removeSizeMappingLine)
  const updateLine = useTagSettingsStore((s) => s.updateSizeMappingLine)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Size Mapping</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label>Mapping Variable Name</Label>
          <Input value={sizeMappingName} onChange={(e) => setField('sizeMappingName', e.target.value)} className="font-mono" />
        </div>

        {sizeMappingLines.map((line, i) => (
          <div key={i} className="flex items-end gap-2 rounded-md border border-border p-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label>Viewport Size</Label>
              <Input
                value={line.viewport}
                onChange={(e) => updateLine(i, { ...line, viewport: e.target.value })}
                placeholder="1024x768"
                className="font-mono"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label>Request Sizes</Label>
              <Input
                value={line.sizes}
                onChange={(e) => updateLine(i, { ...line, sizes: e.target.value })}
                placeholder="970x250, 728x90"
                className="font-mono"
              />
            </div>
            <Button size="icon" variant="ghost" onClick={() => removeLine(i)} title="Remove">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <Button size="sm" variant="outline" onClick={() => addLine()} className="self-start">
          <Plus className="size-3.5" /> Add Breakpoint
        </Button>
      </CardContent>
    </Card>
  )
}
