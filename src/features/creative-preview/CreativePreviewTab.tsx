import { ResizablePanels } from '@/components/shared/ResizablePanels'
import { EditorPanes } from './components/EditorPanes'
import { LivePreviewFrame } from './components/LivePreviewFrame'
import { ConsolePanel } from './components/ConsolePanel'

export function CreativePreviewTab() {
  return (
    <ResizablePanels
      defaultLeftPercent={50}
      left={<EditorPanes />}
      right={
        <div className="flex flex-col gap-4">
          <LivePreviewFrame />
          <ConsolePanel />
        </div>
      }
    />
  )
}
