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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <TagSettingsCard />
        {advancedPanelOpen && <AdvancedSettingsPanel />}
        {sizeMappingPanelOpen && <SizeMappingPanel />}
        {adsensePanelOpen && <AdSensePanel />}
        {videoPanelOpen && <VideoPanel />}
      </div>

      <AdSlotsList />
    </div>
  )
}
