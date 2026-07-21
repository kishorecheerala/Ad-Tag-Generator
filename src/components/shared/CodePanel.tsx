import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/CopyButton'
import { highlightCode } from '@/features/tag-settings/lib/highlightCode'
import { cn } from '@/lib/utils'

interface CodePanelProps {
  title: string
  code: string
  editable?: boolean
  onSave?: (code: string) => void
  maxHeightClass?: string
  wrap?: boolean
  isCustomized?: boolean
  onResetCustom?: () => void
}

/** Read-only syntax-highlighted code display with optional Edit/Save & Run and Copy. */
export function CodePanel({
  title,
  code,
  editable = true,
  onSave,
  maxHeightClass = 'max-h-[420px]',
  wrap = false,
  isCustomized = false,
  onResetCustom,
}: CodePanelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(code)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {isCustomized && !editing && (
            <span
              className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
              title="This code was manually edited and won't update when you change settings above."
            >
              Manual edit
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          {isCustomized && !editing && onResetCustom && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 bg-white/10 px-2.5 text-xs hover:bg-white/20"
              onClick={onResetCustom}
              title="Discard manual edits and resume auto-updating from settings"
            >
              Resume Auto-Sync
            </Button>
          )}
          {editable && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 bg-white/10 px-2.5 text-xs hover:bg-white/20"
              onClick={() => {
                if (editing) {
                  onSave?.(draft)
                  setEditing(false)
                } else {
                  setDraft(code)
                  setEditing(true)
                }
              }}
            >
              {editing ? 'Save & Run' : 'Edit'}
            </Button>
          )}
          <CopyButton getText={() => (editing ? draft : code)} label="Code copied to clipboard!" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={Math.min(Math.max(draft.split('\n').length, 12), 24)}
            className={cn('w-full resize-y bg-transparent p-4 font-mono text-xs leading-relaxed outline-none min-h-[200px]', maxHeightClass)}
          />
        ) : (
          <pre
            className={cn(
              'overflow-auto p-4 font-mono text-[11.5px] leading-relaxed',
              maxHeightClass,
              wrap && 'whitespace-pre-wrap break-all'
            )}
            // Safe: highlightCode() HTML-escapes the input before wrapping recognized tokens in spans.
            dangerouslySetInnerHTML={{ __html: highlightCode(code) }}
          />
        )}
      </CardContent>
    </Card>
  )
}
