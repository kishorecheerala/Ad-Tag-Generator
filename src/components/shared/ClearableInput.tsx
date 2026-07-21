import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

interface ClearableInputProps extends ComponentProps<typeof Input> {
  onClear: () => void
}

/** Text input with an inline X button to clear its value, shown once it's non-empty. */
export function ClearableInput({ value, onClear, className, ...props }: ClearableInputProps) {
  return (
    <div className="relative">
      <Input value={value} className={cn(value && 'pr-7', className)} {...props} />
      {value && (
        <button
          type="button"
          onClick={onClear}
          title="Clear"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-0.5 text-red-500 hover:bg-red-500/15 hover:text-red-600 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
