import { useMemo } from 'react'
import { ResizablePanels } from '@/components/shared/ResizablePanels'
import { CodePanel } from '@/components/shared/CodePanel'
import { useTagSettingsSnapshot, useTagSettingsStore } from '../store'
import { buildBodyScriptCode, buildHeaderScriptCode, buildHttpVectorUrl } from '../lib/codeBuilders'
import { McmDetailsPanel } from './McmDetailsPanel'
import { LiveAdsPanel } from './LiveAdsPanel'

export function ResultsPanel() {
  const snapshot = useTagSettingsSnapshot()
  const setField = useTagSettingsStore((s) => s.setField)

  const networkBaseSlotPath = `/${snapshot.parentNetwork}${snapshot.isMCM ? ',' + snapshot.childNetwork : ''}`

  const headerCode = useMemo(
    () => (snapshot.customHeaderCode !== null ? snapshot.customHeaderCode : buildHeaderScriptCode(snapshot, networkBaseSlotPath)),
    [snapshot, networkBaseSlotPath]
  )
  const bodyCode = useMemo(
    () => (snapshot.customBodyCode !== null ? snapshot.customBodyCode : buildBodyScriptCode(snapshot, networkBaseSlotPath)),
    [snapshot, networkBaseSlotPath]
  )
  const httpVectorUrl = useMemo(() => buildHttpVectorUrl(snapshot, networkBaseSlotPath), [snapshot, networkBaseSlotPath])

  const showHeaderBody = !(snapshot.videoEnabled && snapshot.video.type === 'single')

  return (
    <ResizablePanels
      defaultLeftPercent={58}
      left={
        <div className="flex flex-col gap-4 pr-0 lg:pr-3">
          {showHeaderBody && (
            <>
              <CodePanel title="GPT <HEAD> code" code={headerCode} onSave={(code) => setField('customHeaderCode', code)} />
              <CodePanel title="Adslots <BODY> code" code={bodyCode} onSave={(code) => setField('customBodyCode', code)} maxHeightClass="max-h-[340px]" />
            </>
          )}
          <McmDetailsPanel snapshot={snapshot} httpVectorUrl={httpVectorUrl} />
        </div>
      }
      right={<LiveAdsPanel />}
    />
  )
}
