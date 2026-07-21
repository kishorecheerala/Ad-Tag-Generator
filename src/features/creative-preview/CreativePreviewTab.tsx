import { ResizablePanels } from '@/components/shared/ResizablePanels'
import { CreativeFormatToolbar } from './components/CreativeFormatToolbar'
import { EditorPanes } from './components/EditorPanes'
import { LivePreviewFrame } from './components/LivePreviewFrame'
import { TrackingPixelInspector } from './components/TrackingPixelInspector'
import { ConsolePanel } from './components/ConsolePanel'
import { LiveSitePreviewModal } from './components/LiveSitePreviewModal'

export function CreativePreviewTab() {
  return (
    <div className="flex flex-col gap-3">
      {/* Top Format & Preset Toolbar */}
      <CreativeFormatToolbar />

      {/* Main Workspace Resizable Columns */}
      <ResizablePanels
        defaultLeftPercent={50}
        left={
          <div className="flex flex-col gap-4 h-[calc(100vh-200px)] min-h-[650px] overflow-y-auto pr-1">
            <EditorPanes />
            <TrackingPixelInspector />
          </div>
        }
        right={
          <div className="flex flex-col gap-4 h-[calc(100vh-200px)] min-h-[650px] overflow-y-auto pr-1">
            <LivePreviewFrame />
            <ConsolePanel />
          </div>
        }
      />

      {/* On-Site GAM Live Preview Generator Modal */}
      <LiveSitePreviewModal />
    </div>
  )
}
