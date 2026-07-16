import { lazy, Suspense, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from '@/lib/theme'
import { useUiStore, type AppTab } from '@/stores/uiStore'
import { useDecoderStore } from '@/features/decoder/store'
import { useTagSettingsStore, useTagSettingsSnapshot } from '@/features/tag-settings/store'
import { TagSettingsTab } from '@/features/tag-settings/TagSettingsTab'
import { DecoderTab } from '@/features/decoder/DecoderTab'
import { EncoderTab } from '@/features/encoder/EncoderTab'
import { TEST_PAGE_CONFIG_KEY } from '@/features/test-page/TestPageRoute'

// CodeMirror + its language packages are the single heaviest dependency in
// the app and are only needed once someone visits Creative Preview — code
// split it out of the main bundle instead of loading it on every page view.
const CreativePreviewTab = lazy(() =>
  import('@/features/creative-preview/CreativePreviewTab').then((m) => ({ default: m.CreativePreviewTab }))
)

function App() {
  const { theme, toggleTheme } = useTheme()
  const activeTab = useUiStore((s) => s.activeTab)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const snapshot = useTagSettingsSnapshot()

  // Load the basic sample once on first mount, same as the original app.
  useEffect(() => {
    useTagSettingsStore.getState().loadBasicSample()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live-update any open /testpage tab: whenever settings or theme change and a
  // test page has been opened (its config key exists), refresh the stored
  // config — preserving the console mode it was opened with. The /testpage
  // document watches this key and reloads, so it tracks edits in real time.
  useEffect(() => {
    if (!localStorage.getItem(TEST_PAGE_CONFIG_KEY)) return
    const timer = setTimeout(() => {
      const raw = localStorage.getItem(TEST_PAGE_CONFIG_KEY)
      if (!raw) return
      let pubConsole = false
      try {
        pubConsole = Boolean(JSON.parse(raw).pubConsole)
      } catch {
        // keep default
      }
      localStorage.setItem(TEST_PAGE_CONFIG_KEY, JSON.stringify({ snapshot, pubConsole, isDark: theme === 'dark' }))
    }, 1000)
    return () => clearTimeout(timer)
  }, [snapshot, theme])

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
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading editor…</div>}>
            <CreativePreviewTab />
          </Suspense>
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}

export default App
