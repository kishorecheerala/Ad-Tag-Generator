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

export const DEFAULT_HTML = `<div class="ad-creative">
  <h1>Hello Ad!</h1>
  <p>Edit the HTML, CSS &amp; JS panes to preview a creative live.</p>
  <button id="cta">Click Me</button>
</div>`

export const DEFAULT_CSS = `body { margin: 0; height: 100%; display: flex; align-items: center; justify-content: center; font-family: Arial, Helvetica, sans-serif; text-align: center; }
.ad-creative { padding: 12px; }
#cta { padding: 8px 16px; background: #1a73e8; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
#cta:hover { background: #1558b0; }`

export const DEFAULT_JS = `var cta = document.getElementById('cta');
if (cta) {
  cta.addEventListener('click', function () {
    console.log('CTA clicked!');
  });
}
console.info('Creative loaded.');`

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
  },
  renderedSiteToURLMap: null,
  renderedTemplateVars: null,

  setFormatMode: (mode) => set({ formatMode: mode, activePane: mode === 'json' ? 'json' : 'html' }),
  setJsonContent: (v) => set({ jsonContent: v }),
  setHtml: (v) => set({ html: v }),
  setCss: (v) => set({ css: v }),
  setJs: (v) => set({ js: v }),
  setActivePane: (v) => set({ activePane: v }),
  setSize: (v) => set({ size: v }),
  appendConsoleEntry: (entry) =>
    set((s) => ({ consoleEntries: [...s.consoleEntries, { ...entry, time: new Date().toLocaleTimeString() }] })),
  clearConsole: () => set({ consoleEntries: [] }),
  appendVideoEvent: (event, detail) =>
    set((s) => ({
      videoEventsLog: [{ event, detail, time: new Date().toLocaleTimeString() }, ...s.videoEventsLog.slice(0, 49)],
    })),
  clearVideoEvents: () => set({ videoEventsLog: [] }),
  recordBeaconPing: (url, result) =>
    set((s) => ({
      beaconPingResults: {
        ...s.beaconPingResults,
        [url]: { url, ...result, time: new Date().toLocaleTimeString() },
      },
    })),
  setMacroSubstitution: (macro, value) =>
    set((s) => ({ macroSubstitutions: { ...s.macroSubstitutions, [macro]: value } })),
  setLiveSiteModalOpen: (open) => set({ liveSiteModalOpen: open }),
  updateLiveSiteConfig: (patch) => set((s) => ({ liveSiteConfig: { ...s.liveSiteConfig, ...patch } })),
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
      activePane: 'html',
      html: DEFAULT_HTML,
      css: DEFAULT_CSS,
      js: DEFAULT_JS,
      size: '300x250',
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
    runToken: s.runToken + 1,
    beaconPingResults: {},
    renderedSiteToURLMap: null,
    renderedTemplateVars: null,
    html: s.formatMode === 'on_site_gam' ? '' : s.html
  })),

  hydrateCreativePreview: (patch) =>
    set((s) => ({
      ...s,
      ...patch,
      runToken: Date.now(),
    })),
}))

