import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/components/shared/CopyButton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TagSettingsState } from '../types'

interface McmDetailsPanelProps {
  snapshot: TagSettingsState
  httpVectorUrl: string
}

export function McmDetailsPanel({ snapshot, httpVectorUrl }: McmDetailsPanelProps) {
  const [open, setOpen] = useState(true)

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <CardTitle>Network &amp; MCM details &amp; Ad Request</CardTitle>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-4">
          <div
            className={cn(
              'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
              snapshot.isMCM ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted'
            )}
          >
            <div>
              <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Tag Auditing Mode</div>
              <div className="font-semibold">{snapshot.isMCM ? 'Multiple Customer Management (MCM) Active' : 'Direct Parent Account Context'}</div>
            </div>
            <Badge variant={snapshot.isMCM ? 'default' : 'secondary'}>{snapshot.isMCM ? 'MCM Active' : 'Direct'}</Badge>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="pb-1.5 font-semibold">Parameter</th>
                <th className="pb-1.5 font-semibold">Value</th>
                <th className="pb-1.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-1.5">Parent Network ID</td>
                <td className="py-1.5 font-mono font-semibold">{snapshot.parentNetwork || '—'}</td>
                <td className="py-1.5 text-right">
                  <CopyButton getText={() => snapshot.parentNetwork} />
                </td>
              </tr>
              <tr>
                <td className="py-1.5">MCM Child ID</td>
                <td className={cn('py-1.5 font-mono font-semibold', snapshot.isMCM && 'text-primary')}>
                  {snapshot.isMCM ? snapshot.childNetwork : 'Not Detected'}
                </td>
                <td className="py-1.5 text-right">
                  <CopyButton getText={() => snapshot.childNetwork} />
                </td>
              </tr>
              <tr>
                <td className="py-1.5">Active Slots</td>
                <td className="py-1.5 font-semibold">
                  {snapshot.slots.length} Active Slot{snapshot.slots.length !== 1 ? 's' : ''}
                </td>
                <td className="py-1.5 text-right text-xs text-muted-foreground italic">Audited</td>
              </tr>
            </tbody>
          </table>

          <div className="rounded-md border border-border bg-muted p-3">
            <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">HTTP Ad Request URL</div>
            <div className="font-mono text-xs break-all text-orange-600 dark:text-orange-400">{httpVectorUrl}</div>
          </div>
          <CopyButton getText={() => httpVectorUrl} variant="default" label="Request URL copied!" className="self-center" />
        </CardContent>
      )}
    </Card>
  )
}
