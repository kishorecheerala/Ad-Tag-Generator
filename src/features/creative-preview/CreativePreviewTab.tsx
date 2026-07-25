import { ResizablePanels } from '@/components/shared/ResizablePanels'
import { CreativeFormatToolbar } from './components/CreativeFormatToolbar'
import { EditorPanes } from './components/EditorPanes'
import { LivePreviewFrame } from './components/LivePreviewFrame'
import { VideoPlayerPreview } from './components/VideoPlayerPreview'
import { TrackingPixelInspector } from './components/TrackingPixelInspector'
import { ConsolePanel } from './components/ConsolePanel'
import { LiveSitePreviewModal } from './components/LiveSitePreviewModal'
import { useCreativePreviewStore } from './store'

export function CreativePreviewTab() {
  const formatMode = useCreativePreviewStore((s) => s.formatMode)

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Top Format & Preset Toolbar */}
      <CreativeFormatToolbar />

      {/* Video Mode: Full Width Single Layout */}
      {formatMode === 'video' ? (
        <div className="flex flex-col gap-4 w-full">
          <VideoPlayerPreview />
          <ConsolePanel />
          <TrackingPixelInspector />
        </div>
      ) : (
        /* Main Workspace Resizable Columns for Other Modes */
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
      )}

      {/* On-Site GAM Live Preview Generator Modal */}
      <LiveSitePreviewModal />
    </div>
  )
}
