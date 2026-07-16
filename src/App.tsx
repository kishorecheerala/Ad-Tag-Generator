import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from '@/lib/theme'
import { useUiStore, type AppTab } from '@/stores/uiStore'
import { useDecoderStore } from '@/features/decoder/store'
import { TagSettingsTab } from '@/features/tag-settings/TagSettingsTab'
import { DecoderTab } from '@/features/decoder/DecoderTab'
import { EncoderTab } from '@/features/encoder/EncoderTab'
import { CreativePreviewTab } from '@/features/creative-preview/CreativePreviewTab'
import { TestPageTab } from '@/features/test-page/TestPageTab'

function App() {
  const { theme, toggleTheme } = useTheme()
  const activeTab = useUiStore((s) => s.activeTab)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const testPageOpen = useUiStore((s) => s.testPageOpen)
  const closeTestPage = useUiStore((s) => s.closeTestPage)

  // Shareable decoder links: #tab=decoder&tag=<encoded ad request URL>
  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash.replace(/^#/, '')
      const params = new URLSearchParams(hash)
      if (params.get('tab') === 'decoder') {
        setActiveTab('decoder')
        const tag = params.get('tag')
        if (tag) {
          useDecoderStore.getState().setTagInput(tag)
          useDecoderStore.getState().decode()
        }
      }
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-col gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-base font-semibold sm:text-lg">
          Ad Manager Tag Generator{' '}
          <span className="font-normal opacity-90">with MCM Support &amp; Tag Validator &amp; URL Decoder</span>
        </h1>
        <div className="flex items-center gap-3 text-xs opacity-90">
          <span className="hidden sm:inline">
            Developed by: Kishore Cheerala | Reach out:{' '}
            <a className="underline" href="mailto:cheeralakishore@gmail.com">
              cheeralakishore@gmail.com
            </a>
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={toggleTheme}
            title="Toggle light/dark theme"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AppTab)} className="flex flex-1 flex-col">
        <div className="sticky top-0 z-30 overflow-x-auto border-b border-border bg-muted/60 px-4 py-2 backdrop-blur">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="settings">Tag Settings</TabsTrigger>
            <TabsTrigger value="decoder">Ad Tag Validator &amp; Decoder</TabsTrigger>
            <TabsTrigger value="encoder">URL Encoder / Decoder</TabsTrigger>
            <TabsTrigger value="creative">Creative Preview</TabsTrigger>
            {testPageOpen && (
              <TabsTrigger value="testpage" className="gap-1.5">
                Test Page
                {activeTab === 'testpage' && (
                  <button
                    type="button"
                    className="ml-1 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/15"
                    title="Close Test Page"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTestPage()
                    }}
                  >
                    ✕
                  </button>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="settings" className="p-4">
          <TagSettingsTab />
        </TabsContent>
        <TabsContent value="decoder" className="p-4">
          <DecoderTab />
        </TabsContent>
        <TabsContent value="encoder" className="p-4">
          <EncoderTab />
        </TabsContent>
        <TabsContent value="creative" className="p-4">
          <CreativePreviewTab />
        </TabsContent>
        {testPageOpen && (
          <TabsContent value="testpage" className="flex flex-1 flex-col p-4">
            <TestPageTab />
          </TabsContent>
        )}
      </Tabs>

      <Toaster />
    </div>
  )
}

export default App
