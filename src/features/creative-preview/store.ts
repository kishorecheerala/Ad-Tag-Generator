import { create } from 'zustand'

export type ConsoleLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'
export type CreativeFormatMode = 'on_site_gam' | 'json' | 'html' | 'video'

export interface ConsoleEntry {
  level: ConsoleLevel
  text: string
  time: string
}

export interface VideoEventLog {
  event: string
  time: string
  detail?: string
}

export interface BeaconPingResult {
  url: string
  status: number | string
  ok: boolean
  time: string
  message: string
}

export const DEFAULT_HTML = `<script type="text/javascript">
  var clickTag = "https://www.example.com";
</script>
<div id="banner" onclick="window.open(window.clickTag || clickTag, '_blank')">
  <div class="content">
    <div class="headline">HTML5 Display Creative</div>
    <div class="subhead font-mono">clickTag Enabled</div>
    <button class="cta-button">Click to Preview Destination</button>
  </div>
</div>`

export const DEFAULT_CSS = `html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; font-family: Arial, sans-serif; }
#banner { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border: 1px solid #0ea5e9; cursor: pointer; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 16px; text-align: center; }
.headline { font-size: 16px; font-weight: bold; margin-bottom: 4px; color: #38bdf8; }
.subhead { font-size: 11px; opacity: 0.85; margin-bottom: 12px; }
.cta-button { padding: 6px 14px; background: #0284c7; color: #ffffff; border: none; border-radius: 4px; font-weight: bold; font-size: 12px; cursor: pointer; }
.cta-button:hover { background: #0369a1; }`

export const DEFAULT_JS = `document.addEventListener('DOMContentLoaded', function () {
  console.info('HTML5 Creative loaded. Active clickTag:', window.clickTag || clickTag);
});`

export const DEFAULT_GAM_NATIVE_JSON = ''

export const DEFAULT_MACRO_SUBSTITUTIONS: Record<string, string> = {}

export type CreativeSizePreset =
  | '300x250'
  | '300x600'
  | '728x90'
  | '320x50'
  | '160x600'
  | '970x250'
  | '640x360'
  | 'fluid'
  | 'responsive'

export interface LiveSitePreviewConfig {
  siteUrl: string
  lineItemId: string
  creativeId: string
  adUnitId: string
  sizeTargeting: string
  pastedUrl?: string
  impressionPixel?: string
  clickTracker?: string
}

interface CreativePreviewStore {
  formatMode: CreativeFormatMode
  jsonContent: string
  html: string
  css: string
  js: string
  activePane: 'json' | 'html' | 'css' | 'js'
  size: CreativeSizePreset
  consoleEntries: ConsoleEntry[]
  videoEventsLog: VideoEventLog[]
  beaconPingResults: Record<string, BeaconPingResult>
  runToken: number
  macroSubstitutions: Record<string, string>
  liveSiteModalOpen: boolean
  liveSiteConfig: LiveSitePreviewConfig
  activeRenderConfig: LiveSitePreviewConfig
  renderedSiteToURLMap: any[] | null
  renderedTemplateVars: Record<string, any> | null

  setFormatMode: (mode: CreativeFormatMode) => void
  setJsonContent: (v: string) => void
  setHtml: (v: string) => void
  setCss: (v: string) => void
  setJs: (v: string) => void
  setActivePane: (v: 'json' | 'html' | 'css' | 'js') => void
  setSize: (v: CreativeSizePreset) => void
  appendConsoleEntry: (entry: Omit<ConsoleEntry, 'time'>) => void
  clearConsole: () => void
  appendVideoEvent: (event: string, detail?: string) => void
  clearVideoEvents: () => void
  recordBeaconPing: (url: string, result: Omit<BeaconPingResult, 'url' | 'time'>) => void
  setMacroSubstitution: (macro: string, value: string) => void
  setLiveSiteModalOpen: (open: boolean) => void
  updateLiveSiteConfig: (patch: Partial<LiveSitePreviewConfig>) => void
  setRenderedSiteToURLMap: (v: any[] | null) => void
  setRenderedTemplateVars: (v: Record<string, any> | null) => void
  loadGamNativeJsonPreset: () => void
  loadGamVideoPreset: () => void
  loadHtml5Preset: () => void
  reset: () => void
  run: () => void
  hydrateCreativePreview: (patch: {
    formatMode?: CreativeFormatMode
    jsonContent?: string
    html?: string
    css?: string
    js?: string
    size?: CreativeSizePreset
  }) => void
}

export const useCreativePreviewStore = create<CreativePreviewStore>((set) => ({
  formatMode: 'on_site_gam',
  jsonContent: DEFAULT_GAM_NATIVE_JSON,
  html: DEFAULT_HTML,
  css: DEFAULT_CSS,
  js: DEFAULT_JS,
  activePane: 'html',
  size: 'responsive',
  consoleEntries: [],
  videoEventsLog: [],
  beaconPingResults: {},
  runToken: 0,
  macroSubstitutions: DEFAULT_MACRO_SUBSTITUTIONS,
  liveSiteModalOpen: false,
  liveSiteConfig: {
    siteUrl: 'https://example.com/article-demo',
    lineItemId: '',
    creativeId: '',
    adUnitId: '',
    sizeTargeting: '',
    pastedUrl: '',
  },
  activeRenderConfig: {
    siteUrl: 'https://example.com/article-demo',
    lineItemId: '',
    creativeId: '',
    adUnitId: '',
    sizeTargeting: '',
    pastedUrl: '',
  },
  renderedSiteToURLMap: null,
  renderedTemplateVars: null,

  setFormatMode: (mode) => set({ formatMode: mode }),
  setJsonContent: (v) => set({ jsonContent: v }),
  setHtml: (v) => set({ html: v }),
  setCss: (v) => set({ css: v }),
  setJs: (v) => set({ js: v }),
  setActivePane: (v) => set({ activePane: v }),
  setSize: (v) => set({ size: v }),
  appendConsoleEntry: (entry) =>
    set((s) => {
      const text = entry.text || ''
      if (text.includes('[vite]') || text.includes('.css') || text.includes('.ts') || text.includes('.tsx') || text.includes('hot update') || text.includes('hmr')) {
        return s
      }
      const now = Date.now()
      const first = s.consoleEntries[0]
      const lastTime = (s as any)._lastLogTimestamp || 0
      if (first && first.text === text && first.level === entry.level && now - lastTime < 250) {
        return s
      }
      return {
        _lastLogTimestamp: now,
        consoleEntries: [{ ...entry, time: new Date().toLocaleTimeString() }, ...s.consoleEntries.slice(0, 199)],
      } as any
    }),
  clearConsole: () => set({ consoleEntries: [] }),
  appendVideoEvent: (event, detail) =>
    set((s) => ({
      videoEventsLog: [...s.videoEventsLog.slice(-99), { event, detail, time: new Date().toLocaleTimeString() }],
    })),
  clearVideoEvents: () => set({ videoEventsLog: [] }),
  recordBeaconPing: (url, result) =>
    set((s) => ({
      beaconPingResults: {
        ...s.beaconPingResults,
        [url]: { ...result, url, time: new Date().toLocaleTimeString() },
      },
    })),
  setMacroSubstitution: (macro, value) =>
    set((s) => ({ macroSubstitutions: { ...s.macroSubstitutions, [macro]: value } })),
  setLiveSiteModalOpen: (open) => set({ liveSiteModalOpen: open }),
  updateLiveSiteConfig: (patch) =>
    set((s) => ({
      liveSiteConfig: { ...s.liveSiteConfig, ...patch },
    })),
  setRenderedSiteToURLMap: (v) => set({ renderedSiteToURLMap: v }),
  setRenderedTemplateVars: (v) => set({ renderedTemplateVars: v }),

  loadGamNativeJsonPreset: () =>
    set({
      formatMode: 'json',
      activePane: 'json',
      jsonContent: DEFAULT_GAM_NATIVE_JSON,
      macroSubstitutions: DEFAULT_MACRO_SUBSTITUTIONS,
      size: 'responsive',
      runToken: Date.now(),
    }),

  loadGamVideoPreset: () =>
    set({
      formatMode: 'video',
      size: '640x360',
      macroSubstitutions: {
        ...DEFAULT_MACRO_SUBSTITUTIONS,
        '[%VideoUrl%]': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      },
      runToken: Date.now(),
    }),

  loadHtml5Preset: () =>
    set({
      formatMode: 'html',
      size: '300x250',
      html: DEFAULT_HTML,
      css: DEFAULT_CSS,
      js: DEFAULT_JS,
      macroSubstitutions: DEFAULT_MACRO_SUBSTITUTIONS,
      runToken: Date.now(),
    }),

  reset: () =>
    set({
      formatMode: 'json',
      jsonContent: DEFAULT_GAM_NATIVE_JSON,
      html: DEFAULT_HTML,
      css: DEFAULT_CSS,
      js: DEFAULT_JS,
      consoleEntries: [],
      videoEventsLog: [],
      beaconPingResults: {},
      size: 'responsive',
      macroSubstitutions: DEFAULT_MACRO_SUBSTITUTIONS,
      runToken: Date.now(),
    }),

  run: () => set((s) => ({
    activeRenderConfig: { ...s.liveSiteConfig },
    runToken: Date.now(),
    consoleEntries: [],
    beaconPingResults: {},
    renderedSiteToURLMap: null,
    renderedTemplateVars: null,
  })),

  hydrateCreativePreview: (patch) =>
    set((s) => ({
      formatMode: patch.formatMode ?? s.formatMode,
      jsonContent: patch.jsonContent ?? s.jsonContent,
      html: patch.html ?? s.html,
      css: patch.css ?? s.css,
      js: patch.js ?? s.js,
      size: patch.size ?? s.size,
      runToken: Date.now(),
    })),
}))
