import { useLayoutEffect, useRef, useState } from 'react'
import { Copy, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function EncoderTab() {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const encode = () => {
    try {
      setValue(encodeURIComponent(value).replace(/'/g, '%27').replace(/"/g, '%22'))
    } catch {
      toast.error('Could not encode this text.')
    }
  }

  const decode = () => {
    try {
      setValue(decodeURIComponent(value.replace(/\+/g, ' ')))
    } catch {
      toast.error('Malformed URI — could not decode.')
    }
  }

  const copyResult = () => {
    if (!value) return
    navigator.clipboard.writeText(value)
    toast.success('Copied to clipboard!')
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>URL Encoder / Decoder</CardTitle>
        <span className="text-xs opacity-90">{value.length} chars</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste URL-encoded text, query strings, or any text to encode/decode…"
          className="min-h-120 resize-none overflow-hidden font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={decode}>
            Decode
          </Button>
          <Button size="sm" onClick={encode}>
            Encode
          </Button>
          <Button size="sm" variant="outline" onClick={copyResult}>
            <Copy className="size-3.5" /> Copy
          </Button>
          <Button size="sm" variant="outline" onClick={() => setValue('')}>
            <RotateCcw className="size-3.5" /> Clear
          </Button>
        </div>
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          <li>Input a string of text and encode or decode it as you like.</li>
          <li>Handy for turning encoded JavaScript URLs from complete gibberish into readable gibberish.</li>
          <li>Uses encodeURIComponent — single and double quotes are also escaped.</li>
        </ul>
      </CardContent>
    </Card>
  )
}
