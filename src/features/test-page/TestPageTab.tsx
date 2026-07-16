import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { useTheme } from '@/lib/theme'
import { useUiStore } from '@/stores/uiStore'
import { useTagSettingsSnapshot, useTagSettingsStore } from '@/features/tag-settings/store'
import { generateStagingHtml } from '@/features/tag-settings/lib/generateStagingHtml'

export function TestPageTab() {
  const snapshot = useTagSettingsSnapshot()
  const theme = useTheme((s) => s.theme)
  const pubConsoleMode = useUiStore((s) => s.testPagePubConsoleMode)
  const regenerateCorrelator = useTagSettingsStore((s) => s.regenerateCorrelator)

  const hasContent = Boolean(snapshot.parentNetwork) && snapshot.slots.length > 0

  const srcDoc = useMemo(
    () => generateStagingHtml(snapshot, { isPreview: false, pubConsole: pubConsoleMode, isDark: theme === 'dark' }),
    [snapshot, pubConsoleMode, theme]
  )

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col">
      <div className="mb-2 flex justify-end">
        <Button size="sm" variant="outline" onClick={regenerateCorrelator} title="Refresh Test Page (new ad request)">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>
      {hasContent ? (
        <iframe srcDoc={srcDoc} title="Full test page preview" className="min-h-[70vh] w-full flex-1 rounded-md border border-border bg-white" />
      ) : (
        <EmptyState>Nothing to show yet — enter a Network ID and add at least one ad slot in Tag Settings, then reopen this tab.</EmptyState>
      )}
    </div>
  )
}
