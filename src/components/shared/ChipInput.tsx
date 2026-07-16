import { useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

export interface KeyValue {
  key: string
  val: string
}

interface ChipInputProps {
  value: KeyValue[]
  onChange: (value: KeyValue[]) => void
  placeholder?: string
}

/** Generic `key=value` chip/tag input, used for custom targeting everywhere in the app. */
export function ChipInput({ value, onChange, placeholder }: ChipInputProps) {
  const [draft, setDraft] = useState('')

  const parseEntry = (raw: string): KeyValue | null => {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const eqIdx = trimmed.indexOf('=')
    const key = eqIdx === -1 ? trimmed : trimmed.slice(0, eqIdx)
    const val = eqIdx === -1 ? '' : trimmed.slice(eqIdx + 1)
    if (!key) return null
    return { key, val }
  }

  const commit = (raw: string) => {
    const entries = raw
      .split(',')
      .map(parseEntry)
      .filter((kv): kv is KeyValue => kv !== null)
    if (entries.length === 0) return
    onChange([...value, ...entries])
    setDraft('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      if (draft.trim()) {
        e.preventDefault()
        commit(draft)
      }
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted.includes(',')) {
      e.preventDefault()
      commit(draft + pasted)
    }
  }

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
      {value.map((kv, i) => (
        <span
          key={`${kv.key}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
        >
          {kv.key}
          {kv.val && `=${kv.val}`}
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
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-28 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
