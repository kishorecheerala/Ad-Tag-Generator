import { useTagSettingsStore } from './store'
import { TagSettingsCard } from './components/TagSettingsCard'
import { AdvancedSettingsPanel } from './components/AdvancedSettingsPanel'
import { SizeMappingPanel } from './components/SizeMappingPanel'
import { AdSensePanel } from './components/AdSensePanel'
import { VideoPanel } from './components/VideoPanel'
import { AdSlotsList } from './components/AdSlotsList'
import { ResultsPanel } from './components/ResultsPanel'

export function TagSettingsTab() {
  const advancedPanelOpen = useTagSettingsStore((s) => s.advancedPanelOpen)
  const sizeMappingPanelOpen = useTagSettingsStore((s) => s.sizeMappingPanelOpen)
  const adsensePanelOpen = useTagSettingsStore((s) => s.adsensePanelOpen)
  const videoPanelOpen = useTagSettingsStore((s) => s.videoPanelOpen)
  const resultsRevealed = useTagSettingsStore((s) => s.resultsRevealed)

  return (
    <div className="flex flex-col gap-4">
      {resultsRevealed && <ResultsPanel />}

      <div className="flex flex-wrap gap-4 items-start">
        <div className="w-full max-w-[480px] min-w-[300px] flex-1">
          <TagSettingsCard />
        </div>
        {advancedPanelOpen && (
          <div className="w-full max-w-[480px] min-w-[300px] flex-1">
            <AdvancedSettingsPanel />
          </div>
        )}
        {sizeMappingPanelOpen && (
          <div className="w-full max-w-[480px] min-w-[300px] flex-1">
            <SizeMappingPanel />
          </div>
        )}
        {adsensePanelOpen && (
          <div className="w-full max-w-[480px] min-w-[300px] flex-1">
            <AdSensePanel />
          </div>
        )}
        {videoPanelOpen && (
          <div className="w-full max-w-[480px] min-w-[300px] flex-1">
            <VideoPanel />
          </div>
        )}
      </div>

      <AdSlotsList />
    </div>
  )
}
