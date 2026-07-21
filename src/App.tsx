import { lazy, Suspense, useEffect } from 'react'
import { Moon, Sun, Share2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from '@/lib/theme'
import { useUiStore, type AppTab } from '@/stores/uiStore'
import { useDecoderStore } from '@/features/decoder/store'
import { useTagSettingsSnapshot, useTagSettingsStore, getTagSettingsSnapshot } from '@/features/tag-settings/store'
import { compressState, decompressState, compressCreativeState, decompressCreativeState } from '@/features/tag-settings/lib/shareUrl'
import { useCreativePreviewStore } from '@/features/creative-preview/store'
import { TagSettingsTab } from '@/features/tag-settings/TagSettingsTab'
import { DecoderTab } from '@/features/decoder/DecoderTab'
import { EncoderTab } from '@/features/encoder/EncoderTab'
import { TEST_PAGE_CONFIG_KEY } from '@/features/test-page/TestPageRoute'
import { toast } from 'sonner'
import { Guide } from '@/components/shared/Guide'

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



  // Live-update any open /testpage tab: whenever settings or theme change and a
  // test page has been opened (its config key exists), refresh the stored
  // config — preserving the console mode it was opened with. The /testpage
  // document watches this key and reloads, so it tracks edits in real time.
  useEffect(() => {
    if (!localStorage.getItem(TEST_PAGE_CONFIG_KEY)) return

    try {
      const raw = localStorage.getItem(TEST_PAGE_CONFIG_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.isFromDecoder) return
      }
    } catch {
      // proceed if parse fails
    }

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

  // Synchronize location spoofing edits made on the test page back to the main app store state
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TEST_PAGE_CONFIG_KEY && localStorage.getItem('adTagTestPageConfigUpdateSource') === 'location-spoof') {
        localStorage.removeItem('adTagTestPageConfigUpdateSource')
        try {
          const config = JSON.parse(e.newValue || '{}')
          if (config.snapshot) {
            const setField = useTagSettingsStore.getState().setField
            setField('geolocationCoordinates', config.snapshot.geolocationCoordinates || '')
            setField('geolocationCountry', config.snapshot.geolocationCountry || '')
          }
        } catch (err) {
          console.error('Failed to sync location back to main tab:', err)
        }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Synchronize initial routes and shared parameters from pathnames, query strings, and hash fallbacks
  useEffect(() => {
    async function handleUrlRouting() {
      const path = window.location.pathname
      const searchParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

      const configCode = searchParams.get('config') || searchParams.get('share') || hashParams.get('config') || hashParams.get('share')
      const creativeCode = searchParams.get('creative') || hashParams.get('creative')
      const tagCode = searchParams.get('tag') || hashParams.get('tag')

      let targetTab: AppTab = 'settings'
      if (path === '/tagsettings') {
        targetTab = 'settings'
      } else if (path === '/decoder') {
        targetTab = 'decoder'
      } else if (path === '/encoder') {
        targetTab = 'encoder'
      } else if (path === '/creative') {
        targetTab = 'creative'
      } else {
        // Fallback checks for old styles of routing (e.g. root or tab parameters)
        const tabParam = searchParams.get('tab') || hashParams.get('tab')
        if (tabParam === 'settings' || tabParam === 'decoder' || tabParam === 'encoder' || tabParam === 'creative') {
          targetTab = tabParam as AppTab
        } else if (configCode) {
          targetTab = 'settings'
        } else if (creativeCode) {
          targetTab = 'creative'
        } else if (tagCode) {
          targetTab = 'decoder'
        }
      }

      // Hydrate custom store configs if shared
      if (configCode) {
        try {
          const partialState = await decompressState(configCode)
          useTagSettingsStore.getState().hydrateTagSettings(partialState)
          const parentNetwork = partialState.parentNetwork?.trim() || useTagSettingsStore.getState().parentNetwork.trim()
          const slots = partialState.slots || useTagSettingsStore.getState().slots
          if (parentNetwork && slots.length > 0) {
            useTagSettingsStore.getState().generateTags()
          }
          toast.success('Shared configuration loaded successfully!')
        } catch (err) {
          console.error('Failed to load shared configuration:', err)
          toast.error('Invalid or corrupted share link.')
        }
      } else if (creativeCode) {
        try {
          const creativeState = await decompressCreativeState(creativeCode)
          useCreativePreviewStore.getState().hydrateCreativePreview(creativeState)
          toast.success('Shared Creative Preview loaded successfully!')
        } catch (err) {
          console.error('Failed to load shared creative:', err)
          toast.error('Invalid or corrupted creative link.')
        }
      }

      const googlePreviewParam = searchParams.get('googlesitepreview') || searchParams.get('google_preview')
      const adUnitParam = searchParams.get('iu') || searchParams.get('adUnitId')
      const lineItemParam = searchParams.get('lineItemId') || searchParams.get('lineitem')
      const creativeParam = searchParams.get('creativeId') || searchParams.get('creative')
      const sizeParam = searchParams.get('sz') || searchParams.get('size')

      let effectiveAdUnit = useCreativePreviewStore.getState().liveSiteConfig.adUnitId || '/23171577/expedia.fr_fr/hotels results'
      if (adUnitParam) {
        const decoded = decodeURIComponent(adUnitParam).trim()
        const countSlashes = (decoded.match(/\//g) || []).length
        if (countSlashes >= 2 || (decoded.includes('/') && !decoded.startsWith('/'))) {
          effectiveAdUnit = decoded.startsWith('/') ? decoded : '/' + decoded
        }
      }

      // Automatically expand root network codes to full ad units
      const cleanedPath = effectiveAdUnit.trim()
      const normalizedPath = cleanedPath.startsWith('/') ? cleanedPath : '/' + cleanedPath
      if (normalizedPath === '/23171577' || normalizedPath === '/23171577/') {
        effectiveAdUnit = '/23171577/expedia.fr_fr/hotels results'
      } else if (normalizedPath === '/82109981' || normalizedPath === '/82109981/') {
        effectiveAdUnit = '/82109981/homepage_top'
      } else {
        effectiveAdUnit = normalizedPath
      }

      if (googlePreviewParam || (adUnitParam && lineItemParam)) {
        targetTab = 'creative'
        useCreativePreviewStore.getState().setFormatMode('on_site_gam')
        useCreativePreviewStore.getState().updateLiveSiteConfig({
          adUnitId: effectiveAdUnit,
          lineItemId: lineItemParam || '7322921650',
          creativeId: creativeParam || '138561712827',
          sizeTargeting: sizeParam || '160x600',
        })
        useCreativePreviewStore.getState().run()
        toast.success('GAM On-Site Preview link detected! Rendering creative live on page...')
      } else if (tagCode) {
        useDecoderStore.getState().setTagInput(tagCode)
        useDecoderStore.getState().decode()
      }

      // Sync internal UI store activeTab
      if (useUiStore.getState().activeTab !== targetTab) {
        setActiveTab(targetTab)
      }

      // Transition browser location pathname cleanly (PRESERVE query string if google_preview is present!)
      const tabPaths: Record<AppTab, string> = {
        settings: '/tagsettings',
        decoder: '/decoder',
        encoder: '/encoder',
        creative: '/creative'
      }
      const cleanPath = tabPaths[targetTab]
      if (googlePreviewParam) {
        if (window.location.pathname !== cleanPath) {
          window.history.replaceState(null, '', cleanPath + window.location.search)
        }
      } else if (window.location.pathname !== cleanPath || window.location.hash !== '' || window.location.search !== '') {
        window.history.replaceState(null, '', cleanPath)
      }
    }

    handleUrlRouting()
    window.addEventListener('popstate', handleUrlRouting)
    return () => window.removeEventListener('popstate', handleUrlRouting)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push new state to URL pathname on active tab store adjustments
  useEffect(() => {
    const tabPaths: Record<AppTab, string> = {
      settings: '/tagsettings',
      decoder: '/decoder',
      encoder: '/encoder',
      creative: '/creative'
    }
    const cleanPath = tabPaths[activeTab]
    if (window.location.pathname !== cleanPath) {
      const searchParams = new URLSearchParams(window.location.search)
      const hasPreview = searchParams.get('google_preview') || searchParams.get('googlesitepreview')
      const targetUrl = hasPreview ? cleanPath + window.location.search : cleanPath
      window.history.pushState(null, '', targetUrl)
    }
  }, [activeTab])

  // Show alert confirmation on reload or tab close to prevent accidental data loss
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Are you sure you want to leave? Unsaved changes will be lost.'
      return e.returnValue
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleShare = async () => {
    try {
      if (activeTab === 'settings') {
        const snap = getTagSettingsSnapshot()
        if (!snap.parentNetwork.trim()) {
          toast.error('Please configure at least a Parent Network ID before sharing.')
          return
        }

        const compressed = await compressState(snap)
        const shareUrl = `${window.location.origin}/tagsettings?config=${compressed}`

        await navigator.clipboard.writeText(shareUrl)
        toast.success('Shareable link copied to clipboard!')
      } else if (activeTab === 'decoder') {
        const tag = useDecoderStore.getState().tagInput.trim()
        if (!tag) {
          toast.error('Please enter a tag URL to decode before sharing.')
          return
        }

        const shareUrl = `${window.location.origin}/decoder?tag=${encodeURIComponent(tag)}`

        await navigator.clipboard.writeText(shareUrl)
        toast.success('Decoder shareable link copied to clipboard!')
      } else if (activeTab === 'creative') {
        const { html, css, js, size } = useCreativePreviewStore.getState()
        const compressed = await compressCreativeState(html, css, js, size)
        const shareUrl = `${window.location.origin}/creative?creative=${compressed}`

        await navigator.clipboard.writeText(shareUrl)
        toast.success('Creative Preview shareable link copied to clipboard!')
      } else if (activeTab === 'encoder') {
        toast.info(
          'The Encoder/Decoder is a simple conversion utility tool. It converts text immediately on the spot, so there are no settings or customized configurations to share.'
        )
      }
    } catch (err) {
      console.error('Failed to generate share link:', err)
      toast.error('Could not generate share link.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-col gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-base font-semibold sm:text-lg">
          Ad Manager Tag Generator{' '}
          <span className="font-normal opacity-90">with MCM Support &amp; Tag Validator &amp; URL Decoder &amp; Creative Preview</span>
        </h1>
        <div className="flex items-center gap-3 text-sm opacity-90">
          <span className="hidden sm:inline">
            Developed by: Kishore Cheerala | Reach out to me for additional features/suggestions:{' '}
            <a
              className="underline hover:text-white cursor-pointer"
              href="mailto:cheeralakishore@gmail.com"
              onClick={(e) => {
                e.preventDefault()
                navigator.clipboard.writeText('cheeralakishore@gmail.com')
                toast.success('Email copied to clipboard!')
                
                const subject = encodeURIComponent('Ad Manager Tag Generator - Feature Suggestions & Feedback')
                const body = encodeURIComponent('Hi Kishore,\n\nI have the following suggestions/feedback for Ad Manager Tag Generator:\n\n[Your suggestion/feedback here]\n\nBest regards,\n[Your Name]')
                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=cheeralakishore@gmail.com&su=${subject}&body=${body}`
                
                window.open(gmailUrl, '_blank')
              }}
            >
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
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AppTab)} className="flex flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-4 overflow-x-auto border-b border-border bg-muted/60 px-4 py-2 backdrop-blur">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="settings">Tag Settings</TabsTrigger>
            <TabsTrigger value="decoder">Ad Tag Validator &amp; Decoder</TabsTrigger>
            <TabsTrigger value="encoder">URL Encoder / Decoder</TabsTrigger>
            <TabsTrigger value="creative">Creative Preview</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 border-primary/30 bg-primary/10 hover:bg-primary/20 hover:text-foreground text-foreground px-3 font-medium transition-colors"
              onClick={handleShare}
              title="Share current configuration"
            >
              <Share2 className="size-4 text-primary" />
              <span>Share Config</span>
            </Button>
            <Guide />
          </div>
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
