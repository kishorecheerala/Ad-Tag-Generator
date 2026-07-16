import { create } from 'zustand'
import type { AdSenseConfig, AdSlot, KeyValue, SizeMappingLine, TagSettingsState, VideoConfig } from './types'
import { maybeGenerateNewCorrelator } from './lib/codeBuilders'

function emptySlot(path = '', sizes = '', targeting: KeyValue[] = []): AdSlot {
  return { path, sizes, oop: false, comp: false, targeting }
}

const BASIC_SAMPLE_SLOT: AdSlot = emptySlot('kishore_testing', '300x250, 300x600', [{ key: 'pos', val: 'top' }])

const ADVANCED_SAMPLE_SLOTS: AdSlot[] = [
  emptySlot('kishore_testing', '300x250, 300x600', [
    { key: 'pos', val: 'top' },
    { key: 'env', val: 'test' },
  ]),
  emptySlot('Kishore_Sidebar', '300x600', [{ key: 'pos', val: 'sidebar' }]),
  emptySlot('Kishore_OOP', '1x1', [{ key: 'pos', val: 'interstitial' }]),
]

function defaultFields(): TagSettingsState {
  return {
    tagType: 'async',
    isSingleRequestArchitectureEnabled: true,
    collapseEmptyDivs: false,
    disableInitialLoad: false,
    forceSafeFrame: false,
    centerAds: false,
    disableCookies: false,
    disableConsole: false,
    tagForChildDirectedTreatment: false,
    ampValidation: true,
    ampPlaceholders: false,
    geolocationCoordinates: '',
    contentExclusion: '',
    publisherProvidedId: '',

    videoEnabled: false,
    video: { format: 'vast', type: 'single', allowNonCompanionAds: true, enableCompanionAutofill: false, cmsId: '', videoId: '' },

    pageTargeting: [],

    sizeMappingEnabled: false,
    sizeMappingName: 'mapping1',
    sizeMappingLines: [],

    adsenseEnabled: false,
    adsense: {
      uiEnabled: true,
      backgroundColor: '#ffffff',
      borderColor: '#ffffff',
      titleLinkColor: '#0000ff',
      textColor: '#000000',
      urlColor: '#008000',
      format: 'text_image',
      pageUrl: '',
      channelIds: '',
      feature: '',
    },

    slots: [],

    isMCM: false,
    parentNetwork: '',
    childNetwork: '',

    customHeaderCode: null,
    customBodyCode: null,
    correlator: 0,
  }
}

interface TagSettingsStore extends Omit<TagSettingsState, 'isMCM'> {
  advancedPanelOpen: boolean
  sizeMappingPanelOpen: boolean
  adsensePanelOpen: boolean
  videoPanelOpen: boolean

  setField: <K extends keyof Omit<TagSettingsState, 'isMCM'>>(key: K, value: TagSettingsState[K]) => void
  setVideoField: <K extends keyof VideoConfig>(key: K, value: VideoConfig[K]) => void
  setAdSenseField: <K extends keyof AdSenseConfig>(key: K, value: AdSenseConfig[K]) => void

  setAdvancedPanelOpen: (open: boolean) => void
  setSizeMappingPanelOpen: (open: boolean) => void
  setAdsensePanelOpen: (open: boolean) => void
  setVideoPanelOpen: (open: boolean) => void

  addSlot: (slot?: Partial<AdSlot>) => void
  removeSlot: (index: number) => void
  updateSlot: (index: number, patch: Partial<AdSlot>) => void

  addSizeMappingLine: (line?: SizeMappingLine) => void
  removeSizeMappingLine: (index: number) => void
  updateSizeMappingLine: (index: number, line: SizeMappingLine) => void

  loadBasicSample: () => void
  loadAdvancedSample: () => void
  resetTagSettings: () => void

  /** True once Generate Tags has succeeded at least once — gates Results panel + Test Page tab visibility. */
  resultsRevealed: boolean
  /** Validates + reveals results (mirrors renderAllOutputs' explicit-Generate-only reveal rule). Returns whether it succeeded. */
  generateTags: () => boolean

  regenerateCorrelator: () => void
}

export const useTagSettingsStore = create<TagSettingsStore>((set, get) => ({
  ...defaultFields(),
  resultsRevealed: false,
  advancedPanelOpen: false,
  sizeMappingPanelOpen: false,
  adsensePanelOpen: false,
  videoPanelOpen: false,

  setField: (key, value) => set({ [key]: value } as Partial<TagSettingsStore>),
  setVideoField: (key, value) => set((s) => ({ video: { ...s.video, [key]: value } })),
  setAdSenseField: (key, value) => set((s) => ({ adsense: { ...s.adsense, [key]: value } })),

  setAdvancedPanelOpen: (open) => set({ advancedPanelOpen: open }),
  setSizeMappingPanelOpen: (open) => set({ sizeMappingPanelOpen: open, sizeMappingEnabled: open }),
  setAdsensePanelOpen: (open) => set({ adsensePanelOpen: open, adsenseEnabled: open }),
  setVideoPanelOpen: (open) => set({ videoPanelOpen: open, videoEnabled: open }),

  addSlot: (slot) => set((s) => ({ slots: [...s.slots, emptySlot(slot?.path, slot?.sizes, slot?.targeting)] })),
  removeSlot: (index) => set((s) => ({ slots: s.slots.filter((_, i) => i !== index) })),
  updateSlot: (index, patch) =>
    set((s) => ({ slots: s.slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)) })),

  addSizeMappingLine: (line) =>
    set((s) => ({ sizeMappingLines: [...s.sizeMappingLines, line ?? { viewport: '', sizes: '' }] })),
  removeSizeMappingLine: (index) => set((s) => ({ sizeMappingLines: s.sizeMappingLines.filter((_, i) => i !== index) })),
  updateSizeMappingLine: (index, line) =>
    set((s) => ({ sizeMappingLines: s.sizeMappingLines.map((l, i) => (i === index ? line : l)) })),

  loadBasicSample: () =>
    set({
      ...defaultFields(),
      parentNetwork: '82109981',
      childNetwork: '22880237682',
      slots: [BASIC_SAMPLE_SLOT],
      resultsRevealed: false,
      advancedPanelOpen: false,
      sizeMappingPanelOpen: false,
      adsensePanelOpen: false,
      videoPanelOpen: false,
    }),

  loadAdvancedSample: () =>
    set({
      ...defaultFields(),
      parentNetwork: '82109981',
      childNetwork: '22880237682',
      pageTargeting: [
        { key: 'category', val: 'adtech' },
        { key: 'env', val: 'production' },
      ],
      advancedPanelOpen: true,
      collapseEmptyDivs: true,
      sizeMappingPanelOpen: true,
      sizeMappingEnabled: true,
      sizeMappingLines: [
        { viewport: '1024x768', sizes: '970x250, 728x90' },
        { viewport: '768x600', sizes: '728x90' },
        { viewport: '0x0', sizes: '320x50' },
      ],
      adsensePanelOpen: true,
      adsenseEnabled: true,
      slots: ADVANCED_SAMPLE_SLOTS,
      resultsRevealed: false,
      videoPanelOpen: false,
    }),

  // A true reset (blank), not the sample data — nothing valid to
  // auto-regenerate from, so Results/Test Page stay hidden too.
  resetTagSettings: () =>
    set({
      ...defaultFields(),
      slots: [emptySlot()],
      resultsRevealed: false,
      advancedPanelOpen: false,
      sizeMappingPanelOpen: false,
      adsensePanelOpen: false,
      videoPanelOpen: false,
    }),

  generateTags: () => {
    const s = get()
    const parentNetwork = s.parentNetwork.trim().replace(/^\/+|\/+$/g, '')
    if (!parentNetwork) return false
    if (s.slots.length === 0) return false
    // An explicit Generate discards any custom-edited code and rebuilds
    // fresh from the current form (custom edits only survive silent
    // live-sync re-renders, never an explicit re-Generate).
    set({
      resultsRevealed: true,
      customHeaderCode: null,
      customBodyCode: null,
      correlator: Math.floor(Math.random() * 1_000_000_000_000),
    })
    return true
  },

  regenerateCorrelator: () => set((s) => ({ correlator: maybeGenerateNewCorrelator(s) })),
}))

function toSnapshot(s: TagSettingsStore): TagSettingsState {
  const parentNetwork = s.parentNetwork.trim().replace(/^\/+|\/+$/g, '')
  const childNetwork = s.childNetwork.trim().replace(/^\/+|\/+$/g, '')
  return {
    tagType: s.tagType,
    isSingleRequestArchitectureEnabled: s.isSingleRequestArchitectureEnabled,
    collapseEmptyDivs: s.collapseEmptyDivs,
    disableInitialLoad: s.disableInitialLoad,
    forceSafeFrame: s.forceSafeFrame,
    centerAds: s.centerAds,
    disableCookies: s.disableCookies,
    disableConsole: s.disableConsole,
    tagForChildDirectedTreatment: s.tagForChildDirectedTreatment,
    ampValidation: s.ampValidation,
    ampPlaceholders: s.ampPlaceholders,
    geolocationCoordinates: s.geolocationCoordinates,
    contentExclusion: s.contentExclusion,
    publisherProvidedId: s.publisherProvidedId,
    videoEnabled: s.videoEnabled,
    video: s.video,
    pageTargeting: s.pageTargeting,
    sizeMappingEnabled: s.sizeMappingEnabled,
    sizeMappingName: s.sizeMappingName,
    sizeMappingLines: s.sizeMappingLines,
    adsenseEnabled: s.adsenseEnabled,
    adsense: s.adsense,
    slots: s.slots,
    isMCM: childNetwork !== '',
    parentNetwork,
    childNetwork,
    customHeaderCode: s.customHeaderCode,
    customBodyCode: s.customBodyCode,
    correlator: s.correlator,
  }
}
/** Full TagSettingsState snapshot (with derived isMCM + trimmed network IDs) for the pure code-generation functions. */
export function getTagSettingsSnapshot(): TagSettingsState {
  return toSnapshot(useTagSettingsStore.getState())
}

/** Live-updating hook version of getTagSettingsSnapshot(), for components that need to re-render as state changes. */
export function useTagSettingsSnapshot(): TagSettingsState {
  return useTagSettingsStore(toSnapshot)
}
