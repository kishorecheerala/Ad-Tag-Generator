import type { TagSettingsState } from '../types'
import { formatSizes, parseSizeString, parseViewport, pixelSizesOnly } from './sizeUtils'

/** Builds a `{ 'key': ['v1', 'v2'] }` object literal for the current
 * Slot.setConfig({ targeting }) API (Slot.setTargeting is deprecated). Repeated
 * keys are grouped into one value array. Returns '' when there's nothing to set. */
function buildTargetingObjectLiteral(targeting: { key: string; val: string }[]): string {
  if (targeting.length === 0) return ''
  const byKey = new Map<string, string[]>()
  targeting.forEach((kv) => {
    const vals = byKey.get(kv.key) ?? []
    vals.push(kv.val)
    byKey.set(kv.key, vals)
  })
  const entries = Array.from(byKey.entries()).map(
    ([key, vals]) => `'${key}': [${vals.map((v) => `'${v}'`).join(', ')}]`
  )
  return `{ ${entries.join(', ')} }`
}

export function buildVastUrl(state: TagSettingsState, networkBaseSlotPath: string): string {
  if (state.slots.length === 0) return ''
  const adSlot = state.slots[0]
  const parsedSizes = pixelSizesOnly(parseSizeString(adSlot.sizes))
  const sizesQueryString = parsedSizes.map((sizePair) => `${sizePair[0]}x${sizePair[1]}`).join('|')

  const vastUrlParameters = [
    `env=vp`,
    `gdfp_req=1`,
    `unviewed_position_start=1`,
    `output=${state.video.format}`,
    `iu=${encodeURIComponent(networkBaseSlotPath + '/' + adSlot.path)}`,
    `sz=${encodeURIComponent(sizesQueryString)}`,
    `correlator=${state.correlator}`,
  ]

  let combinedTargetingKeyValuePairs = [...state.pageTargeting]
  if (adSlot.targeting) {
    combinedTargetingKeyValuePairs = [...combinedTargetingKeyValuePairs, ...adSlot.targeting]
  }

  if (combinedTargetingKeyValuePairs.length > 0) {
    const customTargetingParameters = combinedTargetingKeyValuePairs.map((kv) => `${kv.key}%3D${kv.val}`).join('%26')
    vastUrlParameters.push(`cust_params=${customTargetingParameters}`)
  }

  if (state.video.cmsId) vastUrlParameters.push(`cmsid=${state.video.cmsId}`)
  if (state.video.videoId) vastUrlParameters.push(`vid=${state.video.videoId}`)

  return `https://pubads.g.doubleclick.net/gampad/ads?${vastUrlParameters.join('&')}`
}

/** Shared by the code-display panel and the generated staging page, so the two never drift apart. */
export function buildBodyScriptCode(state: TagSettingsState, networkBaseSlotPath: string): string {
  if (state.videoEnabled && state.video.type === 'single') {
    return '<!-- No body tag required for single Video Tag (VAST) -->'
  }

  let rawBodyScriptCode = ''
  state.slots.forEach((slot, slotIndex) => {
    const fullSlotPath = `${networkBaseSlotPath}/${slot.path}`
    const adDivId = `div-gpt-ad-${state.correlator}-${slotIndex}`
    const parsedSizes = parseSizeString(slot.sizes)
    const formattedSizes = formatSizes(parsedSizes)

    if (state.tagType === 'passback') {
      let slotTargetingCode = ''
      slot.targeting.forEach((kv) => {
        slotTargetingCode += `\n                      .setTargeting('${kv.key}', ['${kv.val}'])`
      })
      rawBodyScriptCode += `<!-- Passback AdSlot ${slotIndex + 1} for Ad unit '${slot.path}' ### Size: ${formattedSizes} -->
<div id='${adDivId}-pb'>
  <script src='https://securepubads.g.doubleclick.net/tag/js/gpt.js'>
    googletag.cmd.push(function() {
      googletag.pubads().definePassback('${fullSlotPath}', ${formattedSizes})${slotTargetingCode}
                        .display();
    });
  <\/script>
</div>
<!-- End AdSlot ${slotIndex + 1} -->\n\n`
    } else if (state.tagType === 'amp') {
      const ampPixelSizes = pixelSizesOnly(parsedSizes)
      let primaryWidth = 300
      let primaryHeight = 250
      let ampMultiSizeAttribute = ''
      if (ampPixelSizes.length > 0) {
        primaryWidth = ampPixelSizes[0][0]
        primaryHeight = ampPixelSizes[0][1]
        if (ampPixelSizes.length > 1) {
          const others = ampPixelSizes
            .slice(1)
            .map((sz) => `${sz[0]}x${sz[1]}`)
            .join(',')
          ampMultiSizeAttribute = ` data-multi-size="${others}"`
        }
      }
      let ampValidationAttribute = ''
      if (!state.ampValidation) ampValidationAttribute = ' data-multi-size-validation="false"'
      let ampTargetingAttribute = ''
      if (slot.targeting.length > 0) {
        const targetingObject: Record<string, string> = {}
        slot.targeting.forEach((kv) => {
          targetingObject[kv.key] = kv.val
        })
        ampTargetingAttribute = ` data-targeting='${JSON.stringify(targetingObject)}'`
      }
      let ampPlaceholderHtml = ''
      if (state.ampPlaceholders) {
        ampPlaceholderHtml = `\n  <div placeholder>Loading ad...</div>\n  <div fallback>No ad available</div>`
      }

      rawBodyScriptCode += `<!-- AMP AdSlot ${slotIndex + 1} for Ad unit '${slot.path}' ### Size: [${primaryWidth}x${primaryHeight}] -->
<amp-ad width="${primaryWidth}" height="${primaryHeight}"
        type="doubleclick"
        data-slot="${fullSlotPath}"${ampMultiSizeAttribute}${ampValidationAttribute}${ampTargetingAttribute}>${ampPlaceholderHtml}
</amp-ad>
<!-- End AdSlot ${slotIndex + 1} -->\n\n`
    } else if (state.videoEnabled && state.video.type === 'mc') {
      if (slotIndex === 0) {
        rawBodyScriptCode += `<!-- AdSlot 1 is Master Video Slot. No body companion tag required. -->\n\n`
      } else if (slot.comp) {
        rawBodyScriptCode += `<!-- GPT Companion AdSlot ${slotIndex + 1} for Ad unit '${slot.path}' ### Size: ${formattedSizes} -->
<div id='${adDivId}'>
  <script>
    googletag.cmd.push(function() { googletag.display('${adDivId}'); });
  <\/script>
</div>
<!-- End AdSlot ${slotIndex + 1} -->\n\n`
      } else {
        rawBodyScriptCode += `<!-- AdSlot ${slotIndex + 1} is not set as companion. -->\n\n`
      }
    } else {
      rawBodyScriptCode += `<!-- GPT AdSlot ${slotIndex + 1} for Ad unit '${slot.path}' ### Size: ${formattedSizes} -->
<div id='${adDivId}'>
  <script>
    googletag.cmd.push(function() { googletag.display('${adDivId}'); });
  <\/script>
</div>
<!-- End AdSlot ${slotIndex + 1} -->\n\n`
    }
  })
  return rawBodyScriptCode
}

export function buildCompanionSlotParts(state: TagSettingsState, networkBaseSlotPath: string) {
  let companionSlotDefinitionsCode = ''
  state.slots.forEach((slot, slotIndex) => {
    if (slotIndex === 0) return // Master video slot
    if (!slot.comp) return
    const fullSlotPath = `${networkBaseSlotPath}/${slot.path}`
    const adDivId = `div-gpt-ad-${state.correlator}-${slotIndex}`
    const parsedSizes = parseSizeString(slot.sizes)
    const formattedSizes = formatSizes(parsedSizes)
    companionSlotDefinitionsCode += `    googletag.defineSlot('${fullSlotPath}', ${formattedSizes}, '${adDivId}')\n`
    companionSlotDefinitionsCode += `             .addService(googletag.companionAds())`
    if (state.video.allowNonCompanionAds) {
      companionSlotDefinitionsCode += `\n             .addService(googletag.pubads())`
    }
    // Slot.setTargeting is deprecated — use setConfig({ targeting }) (goes last).
    const compTargeting = buildTargetingObjectLiteral(slot.targeting)
    if (compTargeting) companionSlotDefinitionsCode += `\n             .setConfig({ targeting: ${compTargeting} })`
    companionSlotDefinitionsCode += `;\n\n`
  })

  let companionSettingsCode = ''
  if (state.video.enableCompanionAutofill) {
    companionSettingsCode += `    googletag.companionAds().setRefreshUnfilledSlots(true);\n`
  }
  return { companionSlotDefinitionsCode, companionSettingsCode }
}

export function buildStandardSlotParts(state: TagSettingsState, networkBaseSlotPath: string) {
  let sizeMappingScriptCode = ''
  if (state.sizeMappingEnabled && state.sizeMappingLines.length > 0) {
    sizeMappingScriptCode += `    var ${state.sizeMappingName} = googletag.sizeMapping()\n`
    state.sizeMappingLines.forEach((mappingLine) => {
      const viewportDimension = parseViewport(mappingLine.viewport)
      const mappingSizes = parseSizeString(mappingLine.sizes)
      if (viewportDimension && mappingSizes.length > 0) {
        sizeMappingScriptCode += `                            .addSize([${viewportDimension[0]}, ${viewportDimension[1]}], ${formatSizes(mappingSizes)})\n`
      }
    })
    sizeMappingScriptCode += `                            .build();\n\n`
  }

  let adSlotDefinitionsCode = ''
  state.slots.forEach((slot, slotIndex) => {
    const fullSlotPath = `${networkBaseSlotPath}/${slot.path}`
    const adDivId = `div-gpt-ad-${state.correlator}-${slotIndex}`
    const parsedSizes = parseSizeString(slot.sizes)
    const formattedSizes = formatSizes(parsedSizes)
    adSlotDefinitionsCode += slot.oop
      ? `    googletag.defineOutOfPageSlot('${fullSlotPath}', '${adDivId}')\n`
      : `    googletag.defineSlot('${fullSlotPath}', ${formattedSizes}, '${adDivId}')\n`
    if (state.sizeMappingEnabled) adSlotDefinitionsCode += `             .defineSizeMapping(${state.sizeMappingName})\n`
    adSlotDefinitionsCode += `             .addService(googletag.pubads())`
    // Slot.setTargeting is deprecated; set slot-level targeting via
    // setConfig({ targeting }) instead. setConfig returns void, so it goes last.
    const slotTargeting = buildTargetingObjectLiteral(slot.targeting)
    if (slotTargeting) adSlotDefinitionsCode += `\n             .setConfig({ targeting: ${slotTargeting} })`
    adSlotDefinitionsCode += `;\n\n`
  })

  let pageTargetingSettingsCode = ''
  if (state.tagType === 'sync') pageTargetingSettingsCode += `    googletag.pubads().enableSyncRendering();\n`
  // enableSingleRequest() is deprecated by GPT in favour of the page-level
  // setConfig API — use the current form so the generated tag doesn't log a
  // deprecation warning in the Publisher Console.
  if (state.isSingleRequestArchitectureEnabled) pageTargetingSettingsCode += `    googletag.setConfig({ singleRequest: true });\n`
  if (state.collapseEmptyDivs) pageTargetingSettingsCode += `    googletag.pubads().collapseEmptyDivs(true);\n`
  if (state.disableInitialLoad) pageTargetingSettingsCode += `    googletag.pubads().disableInitialLoad();\n`
  if (state.forceSafeFrame) pageTargetingSettingsCode += `    googletag.pubads().setForceSafeFrame(true);\n`
  if (state.centerAds) pageTargetingSettingsCode += `    googletag.pubads().setCentering(true);\n`
  if (state.disableCookies) pageTargetingSettingsCode += `    googletag.pubads().setCookieOptions(1);\n`
  if (state.disableConsole) pageTargetingSettingsCode += `    googletag.disablePublisherConsole();\n`
  if (state.tagForChildDirectedTreatment) {
    pageTargetingSettingsCode += `    googletag.pubads().setPrivacySettings({ childDirectedTreatment: true });\n`
  }
  if (state.geolocationCoordinates) pageTargetingSettingsCode += `    googletag.pubads().setLocation('${state.geolocationCoordinates}');\n`
  if (state.contentExclusion) pageTargetingSettingsCode += `    googletag.pubads().setCategoryExclusion('${state.contentExclusion}');\n`
  if (state.publisherProvidedId) pageTargetingSettingsCode += `    googletag.pubads().setPublisherProvidedId('${state.publisherProvidedId}');\n`
  if (state.pageUrl) {
    const cleanUrl = state.pageUrl.replace(/^https?:\/\//i, '').replace(/^\/\//, '')
    pageTargetingSettingsCode += `    googletag.pubads().set('page_url', '${cleanUrl}');\n`
  }
  // PubAdsService.setTargeting is deprecated — set page-level targeting via the
  // page-level setConfig({ targeting }) in a single grouped call.
  if (state.pageTargeting.length > 0) {
    pageTargetingSettingsCode += `    googletag.setConfig({ targeting: ${buildTargetingObjectLiteral(state.pageTargeting)} });\n`
  }
  if (state.adsenseEnabled) {
    const attrs: Record<string, string> = {}
    if (state.adsense.uiEnabled) {
      attrs['adsense_ad_types'] = state.adsense.format
      attrs['adsense_background_color'] = state.adsense.backgroundColor
      attrs['adsense_border_color'] = state.adsense.borderColor
      attrs['adsense_link_color'] = state.adsense.titleLinkColor
      attrs['adsense_text_color'] = state.adsense.textColor
      attrs['adsense_url_color'] = state.adsense.urlColor
      if (state.adsense.feature) {
        attrs['adsense_ui_features'] = state.adsense.feature
      }
    }
    if (state.adsense.pageUrl) {
      attrs['page_url'] = state.adsense.pageUrl
      attrs['adsense_page_url'] = state.adsense.pageUrl
    }
    if (state.adsense.channelIds) {
      attrs['adsense_channel_ids'] = state.adsense.channelIds
    }
    if (Object.keys(attrs).length > 0) {
      const attrsStr = JSON.stringify(attrs, null, 6).replace(/\n/g, '\n    ')
      pageTargetingSettingsCode += `\n    googletag.setConfig({ adsenseAttributes: ${attrsStr} });\n`
    }
  }

  return { sizeMappingScriptCode, adSlotDefinitionsCode, pageTargetingSettingsCode }
}

/** Human-readable HEAD tag snippet (with comments, no test-harness event listener) — shown in the code panel and the Test Page dump. */
export function buildHeaderScriptCode(state: TagSettingsState, networkBaseSlotPath: string): string {
  if (state.tagType === 'passback') {
    return '/* Passback tags require no header script. Self-contained tags are generated in the BODY section. */'
  }
  if (state.tagType === 'amp') {
    return `<script async custom-element="amp-ad" src="https://cdn.ampproject.org/v0/amp-ad-0.1.js"><\/script>`
  }
  if (state.videoEnabled && state.video.type === 'single') {
    return buildVastUrl(state, networkBaseSlotPath)
  }
  if (state.videoEnabled && state.video.type === 'mc') {
    const generatedVastUrl = buildVastUrl(state, networkBaseSlotPath)
    const { companionSlotDefinitionsCode, companionSettingsCode } = buildCompanionSlotParts(state, networkBaseSlotPath)
    return `<!-- GPt Video Tag (VAST) -->\n${generatedVastUrl}\n\n<!-- Start GPT Tag for Video Companions -->\n<script async src='https://securepubads.g.doubleclick.net/tag/js/gpt.js'><\/script>\n<script>\n  window.googletag = window.googletag || {cmd: []};\n  googletag.cmd.push(function() {\n${companionSlotDefinitionsCode}${companionSettingsCode}    googletag.enableServices();\n  });\n<\/script>\n<!-- End GPT Tag -->`
  }
  const { sizeMappingScriptCode, adSlotDefinitionsCode, pageTargetingSettingsCode } = buildStandardSlotParts(state, networkBaseSlotPath)
  return `<!-- Start GPT Tag -->\n<script async src='https://securepubads.g.doubleclick.net/tag/js/gpt.js'><\/script>\n<script>\n  window.googletag = window.googletag || {cmd: []};\n  googletag.cmd.push(function() {\n${sizeMappingScriptCode}${adSlotDefinitionsCode}${pageTargetingSettingsCode}    googletag.enableServices();\n  });\n<\/script>\n<!-- End GPT Tag -->`
}

/** Rotates the correlator, but only when neither header nor body is custom-edited — see generateStagingHtml.ts for why. */
export function maybeGenerateNewCorrelator(state: Pick<TagSettingsState, 'customHeaderCode' | 'customBodyCode' | 'correlator'>): number {
  if (state.customHeaderCode === null && state.customBodyCode === null) {
    return Math.floor(Math.random() * 1_000_000_000_000)
  }
  return state.correlator
}

export function buildHttpVectorUrl(state: TagSettingsState, networkBaseSlotPath: string): string {
  if (state.videoEnabled && state.video.type === 'single') {
    return buildVastUrl(state, networkBaseSlotPath)
  }
  const vectorUrlParameters = [`gdfp_req=1`, `correlator=${state.correlator}`, `output=ldjh`, `impl=fif`]
  const allSlotSizesQueryString = state.slots
    .map((s) => parseSizeString(s.sizes).map((sz) => (sz === 'fluid' ? 'fluid' : `${sz[0]}x${sz[1]}`)).join(','))
    .join('|')
  vectorUrlParameters.push(`sz=${encodeURIComponent(allSlotSizesQueryString)}`)
  state.slots.forEach((slot) => vectorUrlParameters.push(`iu=${encodeURIComponent(networkBaseSlotPath + '/' + slot.path)}`))
  return `https://securepubads.g.doubleclick.net/gampad/ads?${vectorUrlParameters.join('&')}`
}
