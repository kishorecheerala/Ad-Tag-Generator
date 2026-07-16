import { useState, type KeyboardEvent } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const PRESET_GROUPS: { label: string; sizes: { size: string; name: string }[] }[] = [
  {
    label: 'Popular Display',
    sizes: [
      { size: '300x250', name: 'Medium Rectangle' },
      { size: '728x90', name: 'Leaderboard' },
      { size: '300x600', name: 'Half Page' },
      { size: '160x600', name: 'Skyscraper' },
      { size: '970x250', name: 'Billboard' },
      { size: '970x90', name: 'Super Leaderboard' },
      { size: '336x280', name: 'Large Rectangle' },
    ],
  },
  {
    label: 'Mobile',
    sizes: [
      { size: '320x50', name: 'Mobile Banner' },
      { size: '320x100', name: 'Large Mobile' },
      { size: '320x480', name: 'Mobile Interstitial' },
    ],
  },
  {
    label: 'Special',
    sizes: [
      { size: '1x1', name: 'OutOfPage Pixel' },
      { size: '468x60', name: 'Standard Banner' },
    ],
  },
]

const SIZE_RE = /^\d+x\d+$/i

interface SizeChipInputProps {
  value: string[]
  onChange: (value: string[]) => void
}

export function SizeChipInput({ value, onChange }: SizeChipInputProps) {
  const [draft, setDraft] = useState('')

  const addSize = (size: string) => {
    const normalized = size.trim().toLowerCase()
    if (!SIZE_RE.test(normalized)) return
    if (value.includes(normalized)) return
    onChange([...value, normalized])
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      if (draft.trim()) {
        e.preventDefault()
        addSize(draft)
        setDraft('')
      }
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
      {value.map((size, i) => (
        <span
          key={`${size}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
        >
          {size}
          <button type="button" onClick={() => removeAt(i)} className="rounded-full hover:bg-primary/25" title="Remove">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) {
            addSize(draft)
            setDraft('')
          }
        }}
        placeholder={value.length === 0 ? 'e.g. 300x250' : '+Size'}
        className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" title="Select standard sizes" className="shrink-0">
            <ChevronDown className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-h-80 overflow-y-auto">
          {PRESET_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <div className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {group.label}
              </div>
              {group.sizes.map(({ size, name }) => {
                const checked = value.includes(size)
                return (
                  <label
                    key={size}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <span>
                      {size} <span className="text-muted-foreground">({name})</span>
                    </span>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => (v ? addSize(size) : onChange(value.filter((s) => s !== size)))}
                    />
                  </label>
                )
              })}
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}
