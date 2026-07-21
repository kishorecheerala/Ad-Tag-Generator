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

export const DEFAULT_GAM_NATIVE_JSON = `{
  "schema": {
    "name": "creative",
    "version": 3
  },
  "creative": {
    "type": "[%CreativeType%]"
  },
  "meta": {
    "lineItemId": "%eaid!",
    "creativeId": "%ecid!",
    "adUnitId": "%epid!"
  },
  "advertisedItem": {
    "key": "[%PartnerCode%]"
  },
  "copy": {
    "heading": {
      "standard": "[%HeadingText%]"
    },
    "description": {
      "standard": "[%DescriptionText%]"
    },
    "callToAction": {
      "standard": "[%CalltoActionText%]"
    },
    "sponsoredLabel": {
      "standard": "[%SponsoredText%]"
    },
    "landingDomain": {
      "standard": "[%LinkOffPreviewText%]"
    },
    "advertiserName": {
      "standard": "[%AdvertiserName%]"
    },
    "termsAndConditions": {
      "standard": "[%TermsConditionsText%]"
    }
  },
  "images": {
    "logo": {
      "altText": "[%LogoImageAltText%]",
      "standard": {
        "src": "[%LogoImageColor%]",
        "dimensions": {
          "height": [%LogoHeight%],
          "width": [%LogoWidth%]
        }
      }
    },
    "logoWhite": {
      "altText": "[%LogoImageAltText%]",
      "standard": {
        "src": "[%LogoImageWhite%]",
        "dimensions": {
          "height": [%LogoHeight%],
          "width": [%LogoWidth%]
        }
      }
    },
    "feature": {
      "altText": "[%FeatureImageAltText%]",
      "standard": {
        "src": "[%FeatureImage%]"
      }
    }
  },
  "beacons": {
    "render": {
      "url": "%%VIEW_URL_UNESC%%"
    },
    "impressionThirdParty1": {
      "url": "[%ThirdPartyImpressionTrackerURL1%]"
    },
    "impressionThirdParty2": {
      "url": "[%ThirdPartyImpressionTrackerURL2%]"
    }
  },
  "links": {
    "click": {
      "url": "%%CLICK_URL_UNESC%%[%ClickThroughUrl%]",
      "target": "[%OpenLinkin%]",
      "brandIdSearchFilter": "[%BrandIdSearchFilter%]"
    },
    "bundleClicks": [
      {
        "sitePath": "[%SitePath1%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl1%]"
      },
      {
        "sitePath": "[%SitePath2%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl2%]"
      },
      {
        "sitePath": "[%SitePath3%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl3%]"
      },
      {
        "sitePath": "[%SitePath4%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl4%]"
      },
      {
        "sitePath": "[%SitePath5%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl5%]"
      },
      {
        "sitePath": "[%SitePath6%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl6%]"
      },
      {
        "sitePath": "[%SitePath7%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl7%]"
      },
      {
        "sitePath": "[%SitePath8%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl8%]"
      },
      {
        "sitePath": "[%SitePath9%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl9%]"
      },
      {
        "sitePath": "[%SitePath10%]",
        "clickThroughUrl": "%%CLICK_URL_UNESC%%[%ClickThroughUrl10%]"
      }
    ]
  },
  "video": {
    "url": "[%VideoUrl%]",
    "captionsUrl": "[%CaptionsUrl%]",
    "audioDescriptionsUrl": "[%AudioDescriptionsUrl%]",
    "videoId": "[%VideoId%]"
  }
}`

export const DEFAULT_MACRO_SUBSTITUTIONS: Record<string, string> = {
  '[%HeadingText%]': 'Experience Next-Gen Ad Manager Solutions',
  '[%DescriptionText%]': 'Empower your campaigns with advanced MCM native custom creative templates and video player integration.',
  '[%CalltoActionText%]': 'Explore Solution',
  '[%SponsoredText%]': 'Sponsored',
  '[%LinkOffPreviewText%]': 'admanager.google.com',
  '[%AdvertiserName%]': 'Google Ad Manager Partner',
  '[%TermsConditionsText%]': '*Terms and conditions apply. View live site demo for details.',
  '[%LogoImageAltText%]': 'Partner Brand Logo',
  '[%LogoImageColor%]': 'https://picsum.photos/seed/adlogo/120/40',
  '[%LogoImageWhite%]': 'https://picsum.photos/seed/adlogo/120/40',
  '[%LogoHeight%]': '40',
  '[%LogoWidth%]': '120',
  '[%FeatureImageAltText%]': 'Featured Campaign Banner',
  '[%FeatureImage%]': 'https://picsum.photos/seed/adfeature/600/300',
  '%%VIEW_URL_UNESC%%': 'https://pubads.g.doubleclick.net/pagead/adview?ai=SampleRenderBeacon',
  '[%ThirdPartyImpressionTrackerURL1%]': 'https://secure.adserver.com/impression?id=101&cb=12345',
  '[%ThirdPartyImpressionTrackerURL2%]': 'https://analytics.tracker.org/log?event=imp&cb=67890',
  '%%CLICK_URL_UNESC%%': 'https://adclick.g.doubleclick.net/pcs/click?',
  '[%ClickThroughUrl%]': 'https://example.com/landing-page',
  '[%OpenLinkin%]': '_blank',
  '[%BrandIdSearchFilter%]': 'brand_9981',
  '[%VideoUrl%]': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  '[%CaptionsUrl%]': 'https://example.com/captions.vtt',
  '[%AudioDescriptionsUrl%]': 'https://example.com/audio-desc.vtt',
  '[%VideoId%]': 'vid_stream_771',
  '%eaid!': '7322921650',
  '%ecid!': '138561712827',
  '%epid!': '/23171577/expedia.fr_fr/hotels/results',
  '[%CreativeType%]': 'NativeCustomFormat',
  '[%PartnerCode%]': 'PARTNER_MCM_01',
  '[%SitePath1%]': '/tech/news',
  '[%ClickThroughUrl1%]': 'https://example.com/tech',
  '[%SitePath2%]': '/finance/markets',
  '[%ClickThroughUrl2%]': 'https://example.com/finance',
  '[%SitePath3%]': '/lifestyle/travel',
  '[%ClickThroughUrl3%]': 'https://example.com/travel',
  '[%SitePath4%]': '/sports/scores',
  '[%ClickThroughUrl4%]': 'https://example.com/sports',
  '[%SitePath5%]': '/entertainment/movies',
  '[%ClickThroughUrl5%]': 'https://example.com/movies',
  '[%SitePath6%]': '/health/wellness',
  '[%ClickThroughUrl6%]': 'https://example.com/health',
  '[%SitePath7%]': '/automotive/reviews',
  '[%ClickThroughUrl7%]': 'https://example.com/automotive',
  '[%SitePath8%]': '/gaming/esports',
  '[%ClickThroughUrl8%]': 'https://example.com/gaming',
  '[%SitePath9%]': '/science/space',
  '[%ClickThroughUrl9%]': 'https://example.com/science',
  '[%SitePath10%]': '/education/courses',
  '[%ClickThroughUrl10%]': 'https://example.com/education',
}

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
  formatMode: 'json',
  jsonContent: DEFAULT_GAM_NATIVE_JSON,
  html: DEFAULT_HTML,
  css: DEFAULT_CSS,
  js: DEFAULT_JS,
  activePane: 'json',
  size: 'responsive',
  consoleEntries: [],
  videoEventsLog: [],
  beaconPingResults: {},
  runToken: 0,
  macroSubstitutions: DEFAULT_MACRO_SUBSTITUTIONS,
  liveSiteModalOpen: false,
  liveSiteConfig: {
    siteUrl: 'https://example.com/article-demo',
    lineItemId: '7322921650',
    creativeId: '138561712827',
    adUnitId: '/23171577/expedia.fr_fr/hotels/results',
    sizeTargeting: '160x600',
  },

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

  run: () => set((s) => ({ runToken: s.runToken + 1 })),

  hydrateCreativePreview: (patch) =>
    set((s) => ({
      ...s,
      ...patch,
      runToken: Date.now(),
    })),
}))

