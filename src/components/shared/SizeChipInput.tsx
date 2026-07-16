import { useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

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
      { size: 'fluid', name: 'Native / Fluid Width' },
    ],
  },
]

const FLAT_PRESETS = PRESET_GROUPS.flatMap((g) => g.sizes)
const SIZE_RE = /^\d+x\d+$/i
const isValidSizeToken = (s: string) => SIZE_RE.test(s) || s === 'fluid'

interface SizeChipInputProps {
  value: string[]
  onChange: (value: string[]) => void
}

/** Chip input for ad slot sizes: fixed single-line height like a plain text input, with a
 * live dropdown of standard sizes that opens on focus and narrows as you type. */
export function SizeChipInput({ value, onChange }: SizeChipInputProps) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  const query = draft.trim().toLowerCase()
  const suggestions = FLAT_PRESETS.filter(
    (p) => !value.includes(p.size) && (!query || p.size.includes(query) || p.name.toLowerCase().includes(query))
  )
  const showSuggestions = focused && suggestions.length > 0

  const addSize = (size: string) => {
    const normalized = size.trim().toLowerCase()
    if (!isValidSizeToken(normalized)) return
    if (value.includes(normalized)) return
    onChange([...value, normalized])
  }

  const addSizes = (raw: string) => {
    const tokens = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    const additions = tokens.filter((t) => isValidSizeToken(t) && !value.includes(t))
    if (additions.length === 0) return
    onChange([...value, ...Array.from(new Set(additions))])
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      if (draft.trim()) {
        e.preventDefault()
        addSizes(draft)
        setDraft('')
      }
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted.includes(',')) {
      e.preventDefault()
      addSizes(draft + pasted)
      setDraft('')
    }
  }

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div className="relative">
      <div className="flex h-8 w-full min-w-0 items-center gap-1.5 overflow-x-auto rounded-md border border-input bg-transparent px-2 text-sm shadow-xs transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
        {value.map((size, i) => (
          <span
            key={`${size}-${i}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {size === 'fluid' ? 'Fluid' : size}
            <button type="button" onClick={() => removeAt(i)} className="rounded-full hover:bg-primary/25" title="Remove">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (draft.trim()) {
              addSizes(draft)
              setDraft('')
            }
          }}
          placeholder={value.length === 0 ? 'e.g. 300x250' : '+Size'}
          className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showSuggestions && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md">
          {suggestions.map(({ size, name }) => (
            <button
              key={size}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                addSize(size)
                setDraft('')
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="font-mono">{size === 'fluid' ? 'Fluid' : size}</span>
              <span className="text-xs text-muted-foreground">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
