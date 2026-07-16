import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  getText: () => string
  label?: string
  className?: string
  variant?: 'icon' | 'default'
}

export function CopyButton({ getText, label = 'Copied to clipboard!', className, variant = 'icon' }: CopyButtonProps) {
  const handleCopy = async () => {
    const text = getText()
    if (!text) return
    await navigator.clipboard.writeText(text)
    toast.success(label)
  }

  if (variant === 'default') {
    return (
      <Button size="sm" variant="outline" onClick={handleCopy} className={className}>
        <Copy className="size-3.5" /> Copy
      </Button>
    )
  }

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      onClick={handleCopy}
      title="Copy"
      className={cn('text-current hover:bg-black/10 dark:hover:bg-white/15', className)}
    >
      <Copy className="size-3.5" />
    </Button>
  )
}
