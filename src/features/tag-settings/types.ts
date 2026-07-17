export interface KeyValue {
  key: string
  val: string
}

export type TagType = 'async' | 'sync' | 'passback' | 'amp'
export type VideoFormat = 'vast' | 'xml_vast2' | 'xml_vast3' | 'vmap' | 'xml_vmap1'
export type VideoType = 'single' | 'mc'
export type AdSenseFormat = 'text_image' | 'text' | 'image'
export type AdSenseFeature = '' | 'rc:0'

export interface AdSlot {
  path: string
  sizes: string
  oop: boolean
  comp: boolean
  targeting: KeyValue[]
}

export interface SizeMappingLine {
  viewport: string
  sizes: string
}

export interface VideoConfig {
  format: VideoFormat
  type: VideoType
  allowNonCompanionAds: boolean
  enableCompanionAutofill: boolean
  cmsId: string
  videoId: string
}

export interface AdSenseConfig {
  uiEnabled: boolean
  backgroundColor: string
  borderColor: string
  titleLinkColor: string
  textColor: string
  urlColor: string
  format: AdSenseFormat
  pageUrl: string
  channelIds: string
  feature: AdSenseFeature
}

export interface TagSettingsState {
  tagType: TagType
  isSingleRequestArchitectureEnabled: boolean
  collapseEmptyDivs: boolean
  disableInitialLoad: boolean
  forceSafeFrame: boolean
  centerAds: boolean
  disableCookies: boolean
  disableConsole: boolean
  tagForChildDirectedTreatment: boolean
  ampValidation: boolean
  ampPlaceholders: boolean
  geolocationCoordinates: string
  geolocationCountry: string
  contentExclusion: string
  publisherProvidedId: string

  videoEnabled: boolean
  video: VideoConfig

  pageTargeting: KeyValue[]
  pageUrl: string

  sizeMappingEnabled: boolean
  sizeMappingName: string
  sizeMappingLines: SizeMappingLine[]

  adsenseEnabled: boolean
  adsense: AdSenseConfig

  slots: AdSlot[]

  isMCM: boolean
  parentNetwork: string
  childNetwork: string

  /** null = auto-generated; set once the user edits+saves the code panel by hand. */
  customHeaderCode: string | null
  customBodyCode: string | null

  /** GPT request cache-buster / div-id suffix. Only rotated on explicit actions — see maybeGenerateNewCorrelator(). */
  correlator: number
}
