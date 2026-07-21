import { defaultFields } from '../store'
import type { TagSettingsState } from '../types'

/**
 * Returns a partial state object containing only fields that differ from their default values.
 */
export function trimState(state: TagSettingsState): Partial<TagSettingsState> {
  const defaults = defaultFields()
  const trimmed: Partial<TagSettingsState> = {}

  // Primitives
  const primitiveKeys: (keyof TagSettingsState)[] = [
    'tagType',
    'isSingleRequestArchitectureEnabled',
    'collapseEmptyDivs',
    'disableInitialLoad',
    'forceSafeFrame',
    'centerAds',
    'disableCookies',
    'disableConsole',
    'tagForChildDirectedTreatment',
    'ampValidation',
    'ampPlaceholders',
    'geolocationCoordinates',
    'geolocationCountry',
    'contentExclusion',
    'publisherProvidedId',
    'videoEnabled',
    'pageUrl',
    'sizeMappingEnabled',
    'sizeMappingName',
    'adsenseEnabled',
    'parentNetwork',
    'childNetwork',
    'customHeaderCode',
    'customBodyCode',
    'privacyConsent',
    'customConsentString',
    'prebidEnabled',
    'lazyLoadEnabled',
    'lazyLoadFetchMarginPercent',
    'lazyLoadRenderMarginPercent',
    'lazyLoadMobileScalingFactor',
  ]

  for (const key of primitiveKeys) {
    if (state[key] !== defaults[key]) {
      (trimmed as any)[key] = state[key]
    }
  }

  // Nested object - video
  if (JSON.stringify(state.video) !== JSON.stringify(defaults.video)) {
    trimmed.video = state.video
  }

  // Nested object - adsense
  if (JSON.stringify(state.adsense) !== JSON.stringify(defaults.adsense)) {
    trimmed.adsense = state.adsense
  }

  // Array - pageTargeting
  if (state.pageTargeting && state.pageTargeting.length > 0) {
    trimmed.pageTargeting = state.pageTargeting
  }

  // Array - sizeMappingLines
  if (state.sizeMappingLines && state.sizeMappingLines.length > 0) {
    trimmed.sizeMappingLines = state.sizeMappingLines
  }

  // Array - prebidBids
  if (JSON.stringify(state.prebidBids) !== JSON.stringify(defaults.prebidBids)) {
    trimmed.prebidBids = state.prebidBids
  }

  // Array - slots
  if (JSON.stringify(state.slots) !== JSON.stringify(defaults.slots)) {
    trimmed.slots = state.slots
  }

  return trimmed
}

/**
 * Restores a full TagSettingsState from a trimmed partial state by filling in default values.
 */
export function restoreState(trimmed: Partial<TagSettingsState>): TagSettingsState {
  const defaults = defaultFields()
  return {
    ...defaults,
    ...trimmed,
    video: trimmed.video ? { ...defaults.video, ...trimmed.video } : defaults.video,
    adsense: trimmed.adsense ? { ...defaults.adsense, ...trimmed.adsense } : defaults.adsense,
  }
}

/**
 * Compress the current state into a URL-safe Base64 string.
 */
export async function compressState(state: TagSettingsState): Promise<string> {
  const trimmed = trimState(state)
  const json = JSON.stringify(trimmed)
  const stream = new Blob([json]).stream()
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'))
  const response = new Response(compressedStream)
  const blob = await response.blob()
  const arrayBuffer = await blob.arrayBuffer()
  
  const uint8 = new Uint8Array(arrayBuffer)
  const binary = Array.from(uint8).map(b => String.fromCharCode(b)).join('')
  const base64 = btoa(binary)
  // URL-safe Base64
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decompress a URL-safe Base64 string back into a partial state object.
 */
export async function decompressState(encoded: string): Promise<Partial<TagSettingsState>> {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const stream = new Blob([bytes]).stream()
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'))
  const response = new Response(decompressedStream)
  const text = await response.text()
  return JSON.parse(text) as Partial<TagSettingsState>
}

/**
 * Compress the creative preview code into a URL-safe Base64 string.
 */
export async function compressCreativeState(
  html: string,
  css: string,
  js: string,
  size: string
): Promise<string> {
  const payload = { html, css, js, size }
  const json = JSON.stringify(payload)
  const stream = new Blob([json]).stream()
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'))
  const response = new Response(compressedStream)
  const blob = await response.blob()
  const arrayBuffer = await blob.arrayBuffer()

  const uint8 = new Uint8Array(arrayBuffer)
  const binary = Array.from(uint8).map(b => String.fromCharCode(b)).join('')
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decompress a URL-safe Base64 string back into creative preview fields.
 */
export async function decompressCreativeState(
  encoded: string
): Promise<{ html: string; css: string; js: string; size: any }> {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const stream = new Blob([bytes]).stream()
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'))
  const response = new Response(decompressedStream)
  const text = await response.text()
  return JSON.parse(text) as { html: string; css: string; js: string; size: any }
}
