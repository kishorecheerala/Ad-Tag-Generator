import { AlertTriangle, CheckCircle2, Clapperboard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DecodedAdTag } from '../lib/parseAdTag'

export function validationInfo(decoded: DecodedAdTag) {
  if (decoded.isVast) {
    return {
      label: 'XML VAST Tag',
      title: 'Video Tag Validation: VAST XML Schema',
      message: `Target matches Video Ad Serving Template (VAST) XML endpoint. Host: ${decoded.hostName || 'Alternative'}`,
      tone: 'purple' as const,
    }
  }
  if (decoded.isCm360) {
    return {
      label: 'CM360 Placement Tag',
      title: 'Campaign Manager 360 Validation: Passed',
      message: `Target matches Campaign Manager 360 ad server schema. Host: ${decoded.hostName}`,
      tone: 'blue' as const,
    }
  }
  if (decoded.isGam) {
    return {
      label: 'Valid GPT Tag',
      title: 'GAM Schema Validation: Passed',
      message: `Target matches securepubads.g.doubleclick.net/gampad/ads. Host: ${decoded.hostName}`,
      tone: 'emerald' as const,
    }
  }
  return {
    label: 'Query String / Alternate',
    title: 'GAM Schema Check: Query Only',
    message: 'Pasted text does not match the standard GPT endpoint. Processing query parameters.',
    tone: 'amber' as const,
  }
}

const TONE_CLASSES = {
  purple: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
}

export function ValidationAlert({ decoded }: { decoded: DecodedAdTag }) {
  const info = validationInfo(decoded)
  const Icon = decoded.isVast ? Clapperboard : decoded.isGam || decoded.isCm360 ? CheckCircle2 : AlertTriangle
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3', TONE_CLASSES[info.tone])}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">{info.title}</div>
        <div className="opacity-90">{info.message}</div>
      </div>
    </div>
  )
}

export function ValidationBadge({ decoded }: { decoded: DecodedAdTag | null }) {
  if (!decoded) return <Badge variant="secondary">No Tag Loaded</Badge>
  const info = validationInfo(decoded)
  return <Badge className={TONE_CLASSES[info.tone]} variant="outline">{info.label}</Badge>
}
