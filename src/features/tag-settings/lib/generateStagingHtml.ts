import type { TagSettingsState } from '../types'
import { escHtml, formatSizes, parseSizeString, pixelSizesOnly } from './sizeUtils'
import { buildBodyScriptCode, buildCompanionSlotParts, buildHeaderScriptCode, buildStandardSlotParts, buildVastUrl } from './codeBuilders'
import { highlightCode } from './highlightCode'
import { MAJOR_CITIES } from './majorCities'

export interface GenerateStagingHtmlOptions {
  isPreview?: boolean
  pubConsole?: boolean
  isDark: boolean
  /** When true, embed a listener that reloads the page whenever the app writes
   * a new config to localStorage — powers live updates on the /testpage route. */
  liveReload?: boolean
}

/**
 * Builds the full staging-page HTML string behind the Live Ads sandbox
 * iframe, the Test Page tab, and the "Open in New Tab"/Pub Console/QR
 * variants — one shared builder so they never drift apart.
 *
 * `isPreview: true` (Live Ads sandbox) produces a minimal unstyled container
 * plus a resize-iframe postMessage script. `isPreview: false` (Test Page,
 * Pub Console, QR) produces a full standalone themed document with the
 * Network ID/Tag type summary and a read-only HEAD/BODY code dump.
 */
export function generateStagingHtml(state: TagSettingsState, options: GenerateStagingHtmlOptions): string {
  const isDark = options.isDark
  const networkBaseSlotPath = `/${state.parentNetwork}${state.isMCM ? ',' + state.childNetwork : ''}`
  const networkDisplayLabel = state.isMCM ? `${state.parentNetwork},${state.childNetwork}` : state.parentNetwork
  const tagTypeLabel = state.videoEnabled
    ? 'Video Tag (VAST)'
    : state.tagType === 'async'
      ? 'GPT'
      : state.tagType === 'sync'
        ? 'GPT (Sync)'
        : state.tagType === 'passback'
          ? 'Passback'
          : 'AMP'
  const requestTypeLabel = state.isSingleRequestArchitectureEnabled ? 'SRA' : 'Standard'
  const networkId = state.parentNetwork

  // -- Pre-paint script for Geolocation and GPT location/targeting spoofing --
  const locationSpoofPrepaintScriptCode = `
  <script>
  (function() {
    var raw = localStorage.getItem('adTagTestPageConfig');
    if (!raw) return;
    try {
      var config = JSON.parse(raw);
      var coordsStr = config.snapshot.geolocationCoordinates || '';
      var country = config.snapshot.geolocationCountry || '';
      
      if (coordsStr) {
        var parts = coordsStr.split(',');
        var lat = parseFloat(parts[0]);
        var lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          // 1. Spoof HTML5 Geolocation API
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition = function(success) {
              setTimeout(function() {
                success({
                  coords: {
                    latitude: lat,
                    longitude: lng,
                    accuracy: 100,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                  },
                  timestamp: Date.now()
                });
              }, 0);
            };
            navigator.geolocation.watchPosition = function(success) {
              setTimeout(function() {
                success({
                  coords: {
                    latitude: lat,
                    longitude: lng,
                    accuracy: 100,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                  },
                  timestamp: Date.now()
                });
              }, 0);
              return 1;
            };
          }

          // 2. Queue setting location on GPT pubads when loaded
          window.googletag = window.googletag || {};
          window.googletag.cmd = window.googletag.cmd || [];
          window.googletag.cmd.push(function() {
            if (window.googletag.pubads) {
              window.googletag.pubads().setLocation(lat, lng);
              
              // 3. Dynamic targeting interceptor for geo/country keys
              if (country) {
                var originalSetTargeting = window.googletag.pubads().setTargeting;
                window.googletag.pubads().setTargeting = function(key, val) {
                  var k = key.toLowerCase();
                  if (k === 'nn_geo' || k === 'geo' || k === 'country') {
                    val = [country];
                  }
                  return originalSetTargeting.call(window.googletag.pubads(), key, val);
                };
              }
            }
          });
        }
      }
    } catch(e) {
      console.error('Error in location spoofing pre-paint script:', e);
    }
  })();
  <\/script>
  `;

  // -- Head Script (the actually-executed script) --
  let stagingHeadScriptCode = ''
  if (state.customHeaderCode !== null) {
    stagingHeadScriptCode = state.customHeaderCode
    // Custom header code doesn't include the slotRenderEnded wiring that
    // powers the asInfo details panel (it's stripped from the copy-paste
    // code shown to users) — re-attach it so the sandbox preview keeps working.
    if (state.tagType !== 'passback' && state.tagType !== 'amp' && !(state.videoEnabled && state.video.type === 'single')) {
      stagingHeadScriptCode += `\n<script>window.googletag = window.googletag || {cmd: []};\ngoogletag.cmd.push(function() { if (googletag.pubads) googletag.pubads().addEventListener('slotRenderEnded', adslotsData); });<\/script>`
    }
  } else if (state.tagType === 'amp') {
    stagingHeadScriptCode = `<script async custom-element="amp-ad" src="https://cdn.ampproject.org/v0/amp-ad-0.1.js"><\/script>`
  } else if (state.tagType === 'passback') {
    stagingHeadScriptCode = `<!-- Passback Mode: No page-level header configuration required. -->`
  } else if (state.videoEnabled && state.video.type === 'single') {
    stagingHeadScriptCode = `<!-- Single Video Tag Mode: No head slots configured. -->`
  } else if (state.videoEnabled && state.video.type === 'mc') {
    const { companionSlotDefinitionsCode, companionSettingsCode } = buildCompanionSlotParts(state, networkBaseSlotPath)
    stagingHeadScriptCode = `<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"><\/script>
  <script>
  window.googletag = window.googletag || {cmd: []};
  googletag.cmd.push(function() {
${companionSlotDefinitionsCode}${companionSettingsCode}    googletag.pubads().addEventListener('slotRenderEnded', adslotsData);
    googletag.enableServices();
  });
  <\/script>`
  } else {
    const { sizeMappingScriptCode, adSlotDefinitionsCode, pageTargetingSettingsCode } = buildStandardSlotParts(state, networkBaseSlotPath)
    stagingHeadScriptCode = `<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"><\/script>
  <script>
  window.googletag = window.googletag || {cmd: []};
  googletag.cmd.push(function() {
${sizeMappingScriptCode}${adSlotDefinitionsCode}${pageTargetingSettingsCode}    googletag.pubads().addEventListener('slotRenderEnded', adslotsData);
    googletag.enableServices();
  });
  <\/script>`
  }

  const rawHeaderScriptCode = buildHeaderScriptCode(state, networkBaseSlotPath)
  const rawBodyScriptCode = buildBodyScriptCode(state, networkBaseSlotPath)

  // -- Build interleaved slot info and ad slot divs --
  let slotsOutputHtml = ''
  let slotInfoBlocksHtml = ''
  state.slots.forEach((slot, slotIndex) => {
    const slotDisplayNumber = slotIndex + 1
    const parsedSizes = parseSizeString(slot.sizes)
    const sizesDisplayString = parsedSizes.map((s) => (s === 'fluid' ? 'Fluid (Native)' : s[0] + 'x' + s[1])).join(', ')
    const targetingString = slot.targeting.map((kv) => kv.key + '=' + kv.val).join(', ')
    const adDivId = `div-gpt-ad-${state.correlator}-${slotIndex}`
    const formattedSizes = formatSizes(parsedSizes)

    let infoHtml = ''
    if (state.videoEnabled && slotIndex === 0) {
      infoHtml = `
            <div>
              <b class="as-title">Ad slot ${slotDisplayNumber} (Master Video)</b><br>
              <b>Ad Unit:</b> ${escHtml(slot.path)}<br>
              <b>Ad slot Size:</b> ${sizesDisplayString}<br>
              <div class="alert alert-master-video oop info-margin">
                <b>Master Video Slot:</b> Loaded dynamically inside video player elements. Test this tag using the VAST Inspector above.
              </div>
            </div>`
    } else {
      infoHtml = `
            <div>
              <b class="as-title">Ad slot ${slotDisplayNumber}</b><br>
              <b>Ad Unit:</b> ${escHtml(slot.path)}<br>
              <b>Ad slot Size:</b> ${sizesDisplayString}
              ${targetingString ? '<br><b>Custom Targeting:</b> ' + escHtml(targetingString) : ''}
              <div class="asInfo as-info-wrapper" id="asInfo-wrapper${slotDisplayNumber}">
                <div class="as-info-grid hidden-element" id="asinfo${slotDisplayNumber}">
                  <div class="as-info-item"><b>Advertiser ID:</b> <em id="aid${slotDisplayNumber}"></em><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="copy-icon" onclick="copyText('aid${slotDisplayNumber}')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></div>
                  <div class="as-info-item"><b>Campaign ID:</b> <em id="cmid${slotDisplayNumber}"></em><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="copy-icon" onclick="copyText('cmid${slotDisplayNumber}')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></div>
                  <div class="as-info-item"><b>Line Item ID:</b> <em id="lid${slotDisplayNumber}"></em><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="copy-icon" onclick="copyText('lid${slotDisplayNumber}')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></div>
                  <div class="as-info-item"><b>Creative ID:</b> <em id="cid${slotDisplayNumber}"></em><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="copy-icon" onclick="copyText('cid${slotDisplayNumber}')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></div>
                  <div class="as-info-item"><b>Response Size:</b> <em id="sz${slotDisplayNumber}"></em><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="copy-icon" onclick="copyText('sz${slotDisplayNumber}')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></div>
                </div>
                <div class="as-info-query hidden-element" id="asinfoquery${slotDisplayNumber}">
                  <b>Query ID:</b> <em id="qid${slotDisplayNumber}"></em><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="copy-icon" onclick="copyText('qid${slotDisplayNumber}')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </div>
                <div class="alert oop info-margin hidden-element" id="oopnote${slotDisplayNumber}">
                  <b>Attention:</b> Out-of-Page elements have been detected at the top of the body.
                </div>
                <em class="hidden-element" id="noad${slotDisplayNumber}"><br><b>No Ad Returned!</b></em>
                <div class="as-info-query hidden-element noad" id="noadQID${slotDisplayNumber}"><b>Query ID:</b> <em id="noadqid${slotDisplayNumber}"></em><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="copy-icon" onclick="copyText('noadqid${slotDisplayNumber}')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></div>
                <span class="hidden-element" id="backfill${slotDisplayNumber}">
                  <br><b>Ad rendered via AdSense/AdX backfill.</b>
                  <div class="as-info-grid-backfill">
                    <div class="as-info-item"><b>Rendered Size:</b> <em id="backfillsz${slotDisplayNumber}"></em><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="copy-icon" onclick="copyText('backfillsz${slotDisplayNumber}')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></div>
                  </div>
                  <div class="as-info-query">
                    <b>Query ID:</b> <em id="backfillqid${slotDisplayNumber}"></em><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="copy-icon" onclick="copyText('backfillqid${slotDisplayNumber}')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </div>
                  <div class="as-info-note">No Ad Manager line-item details are available for backfill creatives.</div>
                </span>
              </div>
            </div>`
    }

    let divHtml = ''
    if (state.tagType === 'passback') {
      const slotPath = `${networkBaseSlotPath}/${slot.path}`
      let slotTargetingCode = ''
      slot.targeting.forEach((kv) => {
        slotTargetingCode += `\n                      .setTargeting('${kv.key}', ['${kv.val}'])`
      })
      divHtml = `\n<!-- Passback AdSlot ${slotIndex + 1} ### Size: ${formattedSizes} -->\n<div id='div-gpt-ad-${state.correlator}-${slotIndex}-pb'>\n  <script src='https://securepubads.g.doubleclick.net/tag/js/gpt.js'>\n    googletag.cmd.push(function() {\n      googletag.pubads().definePassback('${slotPath}', ${formattedSizes})${slotTargetingCode}\n                        .display();\n    });\n  <\/script>\n</div>\n`
    } else if (state.tagType === 'amp') {
      const slotPath = `${networkBaseSlotPath}/${slot.path}`
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
      if (state.ampPlaceholders) ampPlaceholderHtml = `\n  <div placeholder>Loading ad...</div>\n  <div fallback>No ad available</div>`
      divHtml = `\n<!-- AMP AdSlot ${slotIndex + 1} ### Size: [${primaryWidth}x${primaryHeight}] -->\n<amp-ad width="${primaryWidth}" height="${primaryHeight}"\n        type="doubleclick"\n        data-slot="${slotPath}"${ampMultiSizeAttribute}${ampValidationAttribute}${ampTargetingAttribute}>${ampPlaceholderHtml}\n</amp-ad>\n`
    } else if (state.videoEnabled) {
      if (slotIndex === 0) {
        divHtml = `\n<!-- AdSlot 1 is the Master Video Slot. It has no page-level div; the video ad is delivered to your video player via the VAST URL above, not via googletag.display(). -->\n<div class="ad-slot-container ad-slot-master-video">&#9654; Master Video Slot<br>Delivered via VAST URL &mdash; test with the VAST Inspector above</div>\n`
      } else if (slot.comp) {
        divHtml = `\n<!-- GPT Companion AdSlot ${slotIndex + 1} ### Size: ${formattedSizes} -->\n<div id='${adDivId}'>\n  <script>\n    googletag.cmd.push(function() { googletag.display('${adDivId}'); });\n  <\/script>\n<\/div>\n`
      }
    } else {
      const standardPixelSizes = pixelSizesOnly(parsedSizes)
      // A pure native/fluid slot has no fixed dimensions — let it size to its
      // content instead of forcing a pixel box. Mixed or pixel-only slots
      // still get capped to their largest requested size so an
      // unfilled/misbehaving creative iframe (e.g. a stray interstitial from
      // the live ad network) can't blow the container out into blank space.
      const dimensionStyle =
        standardPixelSizes.length === 0
          ? 'width:100%;'
          : (() => {
              const primaryWidth = standardPixelSizes[0][0]
              const primaryHeight = standardPixelSizes[0][1]
              const maxWidth = Math.max(...standardPixelSizes.map((s) => s[0]))
              const maxHeight = Math.max(...standardPixelSizes.map((s) => s[1]))
              return `min-width:${primaryWidth}px;min-height:${primaryHeight}px;max-width:${maxWidth}px;max-height:${maxHeight}px;overflow:hidden;`
            })()
      divHtml = `\n<!-- GPT AdSlot ${slotDisplayNumber} for Ad unit '${escHtml(slot.path)}' ### Size: ${formattedSizes} -->\n<div id='${adDivId}' class="ad-slot-container" style="${dimensionStyle}">\n  <script>\n    googletag.cmd.push(function() { googletag.display('${adDivId}'); });\n  <\/script>\n<\/div>\n`
    }

    slotsOutputHtml += `
          <div class="staging-slot-group">
            ${infoHtml}
            <div style="margin-top: 12px;">
              ${divHtml}
            </div>
          </div>
        `
    slotInfoBlocksHtml += `
          <div class="staging-slot-group">
            ${infoHtml}
          </div>
        `
  })

  let vastDisplayBlockHtml = ''
  if (state.videoEnabled) {
    const generatedVastUrl = buildVastUrl(state, networkBaseSlotPath)
    vastDisplayBlockHtml = `
  <div class="shorturl vast-tag-container">
    <p class="vast-tag-title"><b>Video Tag (VAST) URL:</b></p>
    <a href="${generatedVastUrl}" target="_blank" class="vast-tag-link">${generatedVastUrl}</a>
    <div class="vast-tag-btn-box">
      <a href="https://googleads.github.io/googleads-ima-html5/vsi/?tag=${encodeURIComponent(generatedVastUrl)}" target="_blank" class="vast-tag-btn">VAST Inspector</a>
    </div>
  </div>`
  }

  let settingsInfoHtml = ''
  if (state.collapseEmptyDivs) settingsInfoHtml += '<b>Collapse Empty Divs:</b> Enabled<br>\n  '
  if (state.disableInitialLoad) settingsInfoHtml += '<b>Disable Initial Load:</b> Enabled<br>\n  '
  if (state.forceSafeFrame) settingsInfoHtml += '<b>Force SafeFrame:</b> Enabled<br>\n  '
  if (state.centerAds) settingsInfoHtml += '<b>Center Ads:</b> Enabled<br>\n  '
  if (state.disableCookies) settingsInfoHtml += '<b>Cookies Disabled:</b> Yes<br>\n  '
  if (state.adsenseEnabled) settingsInfoHtml += '<b>AdSense Settings:</b> Enabled<br>\n  '

  // When the Publisher Console is requested, open it once GPT is ready. When it
  // isn't, fully disable it (not just hide the panel) so the live network can't
  // auto-open it and leave the per-slot "Delivery Tools" overlay showing while
  // the panel is gone. disablePublisherConsole must run before enableServices,
  // so it's pushed ahead of the head script; openConsole runs after.
  const consoleDisableScriptCode = options.pubConsole
    ? ''
    : `\n<scr` +
      `ipt>window.googletag = window.googletag || {cmd: []};\ngoogletag.cmd.push(function(){ if (googletag.disablePublisherConsole) googletag.disablePublisherConsole(); });<\/scr` +
      `ipt>`
  // Open the console on a short delay. Codeless/auto ad units (Anchor, Web
  // Interstitial, Side Rail) are requested by GPT at enableServices time and are
  // SKIPPED if a fixed/sticky element already exists — and the console panel is
  // itself a fixed element. Delaying openConsole lets those codeless units get
  // requested first, so you can see them AND the console.
  const publisherConsoleScriptCode = options.pubConsole
    ? `\n<scr` + `ipt>googletag.cmd.push(function(){ window.setTimeout(function(){ googletag.openConsole(); }, 3000); });<\/scr` + `ipt>`
    : ''

  // On the standalone /testpage route, reload when the app pushes new settings
  // (a `storage` event fires in this tab when the app tab rewrites the config),
  // so the test page tracks edits in real time.
  const liveReloadScriptCode = options.liveReload
    ? `\n<scr` + `ipt>window.addEventListener('storage',function(e){if(e.key==='adTagTestPageConfig')location.reload();});<\/scr` + `ipt>`
    : ''

  let bodyContent = ''
  if (options.isPreview) {
    const previewHeightScript = `
<script>
  function sendHeight() {
    var height = document.body.scrollHeight;
    window.parent.postMessage({ type: 'resize-iframe', height: height }, '*');
  }
  window.addEventListener('load', function() {
    setTimeout(sendHeight, 100);
    setTimeout(sendHeight, 500);
    setTimeout(sendHeight, 1500);
  });
  if (window.MutationObserver) {
    var obs = new MutationObserver(sendHeight);
    obs.observe(document.body, { attributes: true, childList: true, subtree: true });
  }
<\/script>
        `
    const finalBodyMarkup = state.customBodyCode !== null ? `${slotInfoBlocksHtml}${state.customBodyCode}` : slotsOutputHtml

    bodyContent = `
  <div class="staging-container" id="DFPTagsController" style="max-width: 100%; margin: 0; background: ${isDark ? '#18181b' : '#fff'}; color: ${isDark ? '#f4f4f5' : '#333'}; padding: 10px; border: none; box-shadow: none;">
    <div style="font-size: 13px; line-height: 1.5; margin-bottom: 12px; font-family: sans-serif; border-bottom: 1px solid ${isDark ? '#27272a' : '#e0e0e0'}; padding-bottom: 12px;">
      <p style="margin: 0 0 6px 0; font-size: 15px;"><b>Network ID: ${networkDisplayLabel}</b></p>
      <b>Tag type:</b> ${tagTypeLabel}<br>
      <b>Request type:</b> ${requestTypeLabel}
      ${settingsInfoHtml ? '<br>' + settingsInfoHtml : ''}
    </div>
    ${finalBodyMarkup}
  </div>
  ${previewHeightScript}`
  } else {
    const finalBodyMarkup = state.customBodyCode !== null ? `${slotInfoBlocksHtml}${state.customBodyCode}` : slotsOutputHtml
    const finalHeaderCode = state.customHeaderCode !== null ? state.customHeaderCode : rawHeaderScriptCode
    const finalBodyCode = state.customBodyCode !== null ? state.customBodyCode : rawBodyScriptCode

    const cleanGeo = state.geolocationCoordinates || ''
    const locationOptions = [
      { label: 'No Spoofing (Default)', value: '', country: '' },
      { label: '🇺🇸 United States (New York)', value: '40.7128,-74.0060', country: 'US' },
      { label: '🇬🇧 United Kingdom (London)', value: '51.5074,-0.1278', country: 'GB' },
      { label: '🇮🇳 India (Delhi)', value: '28.6139,77.2090', country: 'IN' },
      { label: '🇩🇪 Germany (Berlin)', value: '52.5200,13.4050', country: 'DE' },
      { label: '🇯🇵 Japan (Tokyo)', value: '35.6762,139.6503', country: 'JP' },
      { label: '🇦🇺 Australia (Sydney)', value: '-33.8688,151.2093', country: 'AU' }
    ]

    const isPredefined = locationOptions.some(o => o.value === cleanGeo)
    if (cleanGeo && !isPredefined) {
      const countryCode = state.geolocationCountry || ''
      locationOptions.push({
        label: `📍 Custom (${cleanGeo}${countryCode ? ' - ' + countryCode : ''})`,
        value: cleanGeo,
        country: countryCode
      })
    }

    locationOptions.push({ label: '⚙️ Custom Location...', value: 'custom', country: '' })

    const selectedOpt = locationOptions.find(o => o.value === cleanGeo) || locationOptions[0]

    const selectHtml = `
      <select class="select-location" onchange="changeSpoofedLocation(this)" data-prev="${selectedOpt.value ? `${selectedOpt.value}|${selectedOpt.country}` : ''}">
        ${locationOptions.map(o => {
          const valStr = o.value === 'custom' ? 'custom' : (o.value ? `${o.value}|${o.country}` : '')
          const selected = o.value === selectedOpt.value ? 'selected' : ''
          return `<option value="${valStr}" ${selected}>${o.label}</option>`
        }).join('')}
      </select>
    `

    const headerToolbarHtml = `
      <div class="testpage-header">
        <div class="testpage-header-left">
          <a href="/" class="testpage-logo">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Back to Home
          </a>
        </div>
        <div class="testpage-header-right">
          <span style="font-size: 11px; color: ${isDark ? '#71717a' : '#64748b'}; font-weight: 500; font-family: sans-serif;">Spoof Location:</span>
          ${selectHtml}
          <button class="btn-header-action" onclick="location.reload()">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Refresh
          </button>
        </div>
      </div>
    `

    bodyContent = `
  ${headerToolbarHtml}
  
  <div id="custom-geo-modal" class="geo-modal-overlay hidden-element">
    <div class="geo-modal-content">
      <div class="geo-modal-header">
        <h3>Custom Geolocation Spoofing</h3>
        <button class="geo-modal-close" onclick="closeGeoModal()">&times;</button>
      </div>
      <div class="geo-modal-body">
        <div class="geo-modal-field">
          <label>Search Location Name</label>
          <div style="display: flex; gap: 8px; width: 100%;">
            <input type="text" id="modal-geo-search" placeholder="e.g. US - Washington or London" style="flex: 1;" onkeydown="if(event.key === 'Enter') searchLocationName()" />
            <button class="btn-geo-detect btn-geo-search" onclick="searchLocationName()">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block; margin-right:4px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              Search
            </button>
          </div>
          <div id="geo-search-result" class="geo-search-result hidden-element"></div>
        </div>
        <div class="geo-modal-field">
          <label>GPS Coordinates (latitude,longitude)</label>
          <div style="display: flex; gap: 8px; width: 100%;">
            <input type="text" id="modal-geo-coords" placeholder="e.g. 48.8566,2.3522" style="flex: 1;" />
            <button class="btn-geo-detect" onclick="detectUserLocation()">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block; margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path><path d="M2 12h20"></path></svg>
              Auto Detect
            </button>
          </div>
        </div>
        <div class="geo-modal-field">
          <label>Country Code (e.g. US, GB, FR)</label>
          <input type="text" id="modal-geo-country" placeholder="e.g. FR" maxlength="2" style="width: 100%;" />
        </div>
        <div class="geo-modal-actions">
          <button class="btn-geo-cancel" onclick="closeGeoModal()">Cancel</button>
          <button class="btn-geo-submit" onclick="submitGeoModal()">Apply & Refresh</button>
        </div>
      </div>
    </div>
  </div>

  <div class="staging-container" id="DFPTagsController">
    <p id="stage-title"><b>Network ID: ${networkDisplayLabel}</b></p>
    <br>
    <p>
      <b>Tag type:</b> ${tagTypeLabel}<br>
      <b>Request type:</b> ${requestTypeLabel}<br>
      ${settingsInfoHtml}
    </p>
    <br>
    <hr>
    ${vastDisplayBlockHtml}
    ${finalBodyMarkup}
    <hr>
    <div class="code-panel-card">
      <div class="code-panel-header">
        <span class="code-panel-title">
          GPT &lt;HEAD&gt; code
          ${state.customHeaderCode !== null ? '<span class="manual-badge" title="Manually edited">Manual edit</span>' : ''}
        </span>
        <div class="code-panel-actions">
          ${state.customHeaderCode !== null ? `<button class="btn-ghost" onclick="resetCode('customHeaderCode')">Resume Auto-Sync</button>` : ''}
          <button class="btn-ghost" id="edit-btn-header" onclick="toggleEdit('header', 'customHeaderCode')">Edit</button>
          <button class="btn-ghost" onclick="copyRawCode('header')">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>
      <div class="code-panel-body">
        <pre id="pre-header" class="code-panel-pre">${highlightCode(finalHeaderCode)}</pre>
        <textarea id="textarea-header" class="code-panel-textarea hidden-element" spellcheck="false">${escHtml(finalHeaderCode)}</textarea>
      </div>
    </div>

    <div class="code-panel-card" style="margin-top: 16px;">
      <div class="code-panel-header">
        <span class="code-panel-title">
          Adslots &lt;BODY&gt; code
          ${state.customBodyCode !== null ? '<span class="manual-badge" title="Manually edited">Manual edit</span>' : ''}
        </span>
        <div class="code-panel-actions">
          ${state.customBodyCode !== null ? `<button class="btn-ghost" onclick="resetCode('customBodyCode')">Resume Auto-Sync</button>` : ''}
          <button class="btn-ghost" id="edit-btn-body" onclick="toggleEdit('body', 'customBodyCode')">Edit</button>
          <button class="btn-ghost" onclick="copyRawCode('body')">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>
      <div class="code-panel-body">
        <pre id="pre-body" class="code-panel-pre">${highlightCode(finalBodyCode)}</pre>
        <textarea id="textarea-body" class="code-panel-textarea hidden-element" spellcheck="false">${escHtml(finalBodyCode)}</textarea>
      </div>
    </div>
  </div>`
  }

  return `<!DOCTYPE html>
<html lang="en"><!--
  Ad Manager Tag Generator & MCM Tester - Staging Page
  --><head>
  <title>Network ID: ${networkDisplayLabel} - ${tagTypeLabel} - ${requestTypeLabel}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, minimum-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20fill%3D%22%23246FDB%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EGoogle%20Tag%20Manager%3C%2Ftitle%3E%3Cpath%20d%3D%22M12.003%200a3%203%200%200%200-2.121%205.121l6.865%206.865-4.446%204.541%201.745%201.836a3.432%203.432%200%200%201%20.7.739l.012.011-.001.002a3.432%203.432%200%200%201%20.609%201.953%203.432%203.432%200%200%201-.09.78l7.75-7.647c.031-.029.067-.05.098-.08.023-.023.038-.052.06-.076a2.994%202.994%200%200%200-.06-4.166l-9-9A2.99%202.99%200%200%200%2012.003%200zM8.63%202.133L.88%209.809a2.998%202.998%200%200%200%200%204.238l7.7%207.75a3.432%203.432%200%200%201-.077-.729%203.432%203.432%200%200%201%203.431-3.431%203.432%203.432%200%200%201%20.826.101l-5.523-5.81%204.371-4.373-2.08-2.08c-.903-.904-1.193-2.183-.898-3.342zm3.304%2016.004a2.932%202.932%200%200%200-2.931%202.931A2.932%202.932%200%200%200%2011.934%2024a2.932%202.932%200%200%200%202.932-2.932%202.932%202.932%200%200%200-2.932-2.931z%22%2F%3E%3C%2Fsvg%3E">
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; margin: 0; padding: 0; background: ${isDark ? '#09090b' : '#fafafa'}; color: ${isDark ? '#f4f4f5' : '#333'}; }
    .ad-slot-container { display: inline-block; margin: 16px 0; }
    .staging-container { max-width: 960px; margin: 20px auto; background: ${isDark ? '#18181b' : '#fff'}; padding: 24px 28px; border: 1px solid ${isDark ? '#27272a' : '#e0e0e0'}; border-radius: 2px; box-shadow: ${isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.08)'}; }
    #stage-title { font-size: 16px; color: ${isDark ? '#f4f4f5' : '#333'}; margin-bottom: 4px; }
    .as-title { font-size: 14px; color: ${isDark ? '#34d399' : '#689f38'}; display: block; margin-top: 16px; }
    .asInfo { background: ${isDark ? '#27272a' : '#f5f5f5'}; border: 1px solid ${isDark ? '#3f3f46' : '#e0e0e0'}; padding: 10px 12px; margin: 8px 0 16px; font-size: 12px; line-height: 1.9; border-radius: 2px; color: ${isDark ? '#d4d4d8' : '#333'}; }
    .asInfo dfn { font-style: normal; }
    .asInfo em { font-style: normal; color: ${isDark ? '#60a5fa' : '#1565c0'}; }
    .asInfo a { color: ${isDark ? '#60a5fa' : '#1565c0'}; text-decoration: none; }
    .asInfo a:hover { text-decoration: underline; }
    .info-margin { display: block; margin-top: 4px; }
    .alert.oop { background: ${isDark ? '#3f2203' : '#fff3e0'}; border: 1px solid ${isDark ? '#7c2d12' : '#ffcc80'}; padding: 8px 10px; color: ${isDark ? '#fdba74' : '#e65100'}; margin-top: 8px; border-radius: 2px; font-size: 11px; }
    .noad { color: #d32f2f; }
    .code-panel-card {
      border: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      border-radius: 6px;
      overflow: hidden;
      margin-top: 16px;
      background: ${isDark ? '#09090b' : '#fff'};
    }
    .code-panel-header {
      background: #15803d;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #fff;
      font-family: sans-serif;
    }
    .code-panel-title {
      font-weight: bold;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .manual-badge {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 9999px;
      padding: 1px 8px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .code-panel-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .btn-ghost {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: #fff;
      padding: 4px 10px;
      font-size: 11.5px;
      cursor: pointer;
      font-family: sans-serif;
      transition: background 0.2s, border-color 0.2s;
    }
    .btn-ghost:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.3);
    }
    .code-panel-body {
      position: relative;
    }
    .code-panel-pre {
      margin: 0;
      padding: 14px;
      font-size: 11.5px;
      font-family: 'Courier New', Courier, monospace;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.6;
      color: ${isDark ? '#e4e4e7' : '#334155'};
      max-height: 380px;
    }
    .code-panel-textarea {
      width: 100%;
      height: 300px;
      border: none;
      padding: 14px;
      font-size: 11.5px;
      font-family: 'Courier New', Courier, monospace;
      background: ${isDark ? '#18181b' : '#f8fafc'};
      color: ${isDark ? '#e4e4e7' : '#334155'};
      outline: none;
      resize: vertical;
      box-sizing: border-box;
      display: block;
    }
    .code-line-num { display: inline-block; width: 30px; text-align: right; padding-right: 10px; color: ${isDark ? '#71717a' : '#999'}; user-select: none; }
    .code-syntax-comment { color: ${isDark ? '#4ade80' : '#15803d'}; font-style: italic; }
    .code-syntax-string { color: ${isDark ? '#f87171' : '#b91c1c'}; }
    .code-syntax-tag { color: ${isDark ? '#60a5fa' : '#1e40af'}; font-weight: bold; }
    .code-syntax-attr { color: ${isDark ? '#c084fc' : '#7e22ce'}; font-weight: 600; }
    hr { border: none; border-top: 1px solid ${isDark ? '#27272a' : '#e0e0e0'}; margin: 16px 0; }
    .shorturl { background: ${isDark ? '#052e16' : '#e8f5e9'}; padding: 10px 14px; margin-bottom: 16px; border: 1px solid ${isDark ? '#064e3b' : '#c8e6c9'}; font-size: 12px; border-radius: 2px; }
    .shorturl a { color: ${isDark ? '#a7f3d0' : '#1b5e20'}; text-decoration: none; }
    .shorturl a:hover { text-decoration: underline; }
    .shorturl p { margin: 0 0 4px; }
    .alert-master-video {
      background: ${isDark ? '#1e3a8a' : '#e3f2fd'};
      border: 1px solid ${isDark ? '#1e40af' : '#90caf9'};
      color: ${isDark ? '#93c5fd' : '#0d47a1'};
    }
    .as-info-wrapper {
      max-width: 100%;
      width: fit-content;
      box-sizing: border-box;
    }
    .as-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 16px;
    }
    .as-info-item {
      font-size: 12px;
      line-height: 1.5;
    }
    .as-info-note {
      font-size: 11px;
      margin-top: 6px;
      color: ${isDark ? '#a1a1aa' : '#666'};
    }
    .as-info-query {
      font-size: 12px;
      line-height: 1.5;
      margin-top: 6px;
      word-break: break-all;
    }
    .hidden-element {
      display: none !important;
    }
    .vast-tag-container {
      background: ${isDark ? '#450a0a' : '#ffebee'};
      border: 1px solid ${isDark ? '#7f1d1d' : '#ffcdd2'};
      margin-bottom: 16px;
    }
    .vast-tag-title {
      margin: 0 0 6px;
    }
    .vast-tag-link {
      color: ${isDark ? '#fca5a5' : '#c62828'};
      word-break: break-all;
      font-family: monospace;
      font-size: 11px;
    }
    .vast-tag-btn-box {
      margin-top: 10px;
    }
    .vast-tag-btn {
      display: inline-block;
      background: #d32f2f;
      color: white;
      padding: 5px 10px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      border-radius: 2px;
      text-decoration: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    .staging-slot-group {
      margin-bottom: 28px;
      padding-bottom: 20px;
    }
    .ad-slot-master-video {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-width: 300px;
      min-height: 80px;
      padding: 8px;
      font-size: 11px;
      color: ${isDark ? '#d8b4fe' : '#7b1fa2'};
      line-height: 1.6;
    }
    .copy-icon {
      vertical-align: middle;
      margin-left: 5px;
      cursor: pointer;
      opacity: ${isDark ? '0.75' : '0.5'};
      color: ${isDark ? '#e4e4e7' : 'inherit'};
      transition: opacity 0.15s ease, color 0.15s ease;
      display: inline-block;
    }
    .copy-icon:hover {
      opacity: 1;
      color: #34d399;
    }
    .testpage-header {
      background: ${isDark ? '#18181b' : '#ffffff'};
      border-bottom: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: ${isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'};
      font-family: system-ui, -apple-system, sans-serif;
    }
    .testpage-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .testpage-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .testpage-logo {
      font-weight: 700;
      font-size: 14px;
      color: #15803d;
      display: flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }
    .btn-header-action {
      background: ${isDark ? '#27272a' : '#f1f5f9'};
      border: 1px solid ${isDark ? '#3f3f46' : '#e2e8f0'};
      border-radius: 6px;
      color: ${isDark ? '#f4f4f5' : '#334155'};
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: background 0.2s, color 0.2s;
    }
    .btn-header-action:hover {
      background: ${isDark ? '#3f3f46' : '#e2e8f0'};
      color: ${isDark ? '#ffffff' : '#0f172a'};
    }
    .select-location {
      background: ${isDark ? '#27272a' : '#ffffff'};
      border: 1px solid ${isDark ? '#3f3f46' : '#e2e8f0'};
      border-radius: 6px;
      color: ${isDark ? '#f4f4f5' : '#334155'};
      padding: 6px 28px 6px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      outline: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23888888' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-size: 12px;
    }
    
    /* Geolocation Modal Styles */
    .geo-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .geo-modal-content {
      background: ${isDark ? '#18181b' : '#ffffff'};
      border: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      border-radius: 12px;
      width: 90%;
      max-width: 440px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      animation: geoModalFadeIn 0.2s ease-out;
    }
    @keyframes geoModalFadeIn {
      from { transform: scale(0.96); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .geo-modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .geo-modal-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: ${isDark ? '#f4f4f5' : '#1e293b'};
    }
    .geo-modal-close {
      background: none;
      border: none;
      font-size: 22px;
      cursor: pointer;
      color: ${isDark ? '#a1a1aa' : '#64748b'};
      line-height: 1;
      padding: 4px;
    }
    .geo-modal-close:hover {
      color: ${isDark ? '#f4f4f5' : '#0f172a'};
    }
    .geo-modal-body {
      padding: 20px;
    }
    .geo-modal-field {
      margin-bottom: 16px;
    }
    .geo-modal-field label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: ${isDark ? '#a1a1aa' : '#64748b'};
      margin-bottom: 6px;
      text-align: left;
    }
    .geo-modal-field input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      background: ${isDark ? '#09090b' : '#ffffff'};
      border: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      border-radius: 6px;
      color: ${isDark ? '#f4f4f5' : '#334155'};
      padding: 8px 12px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }
    .geo-modal-field input[type="text"]:focus {
      border-color: #15803d;
    }
    .btn-geo-detect {
      background: ${isDark ? '#27272a' : '#f1f5f9'};
      border: 1px solid ${isDark ? '#3f3f46' : '#e2e8f0'};
      border-radius: 6px;
      color: ${isDark ? '#f4f4f5' : '#334155'};
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .btn-geo-detect:hover {
      background: ${isDark ? '#3f3f46' : '#e2e8f0'};
    }
    .geo-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
    }
    .btn-geo-cancel {
      background: none;
      border: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      border-radius: 6px;
      color: ${isDark ? '#a1a1aa' : '#64748b'};
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-geo-cancel:hover {
      background: ${isDark ? '#27272a' : '#f8fafc'};
      color: ${isDark ? '#f4f4f5' : '#0f172a'};
    }
    .btn-geo-submit {
      background: #15803d;
      border: 1px solid #166534;
      border-radius: 6px;
      color: #ffffff;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-geo-submit:hover {
      background: #166534;
    }
    .geo-search-result {
      margin-top: 6px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11.5px;
      line-height: 1.5;
      background: ${isDark ? 'rgba(22, 101, 52, 0.15)' : 'rgba(22, 163, 74, 0.08)'};
      border: 1px solid ${isDark ? 'rgba(22, 163, 74, 0.3)' : 'rgba(22, 163, 74, 0.25)'};
      color: ${isDark ? '#86efac' : '#15803d'};
    }
    .geo-search-result .geo-result-label {
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
      display: block;
      margin-bottom: 2px;
    }
    .geo-search-result .geo-result-name {
      font-weight: 500;
    }
    .geo-search-result .geo-result-type {
      opacity: 0.6;
      font-size: 10.5px;
      margin-left: 6px;
    }
  </style>

  <scr` + `ipt src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"><\/scr` + `ipt>

  <!-- DFP UI Links -->
  <scr` + `ipt>
  function icsUrls(slotIndex, data){
    function makeUrl(id, url){
      return '<a target="_blank" href="' + url + id + '">' + id + '</a>';
    }
    var networkId = '${networkId}';
    var lineItemUrlPrefix  = 'https://admanager.google.com/' + networkId + '#delivery/LineItemDetail/lineItemId=';
    var creativeUrlPrefix  = 'https://admanager.google.com/' + networkId + '#delivery/CreativeDetail/creativeId=';
    var orderUrlPrefix = 'https://admanager.google.com/' + networkId + '#delivery/OrderDetail/orderId=';
    var adminUrlPrefix  = 'https://admanager.google.com/' + networkId + '#admin/companyDetail/id=';
    var queryIdUrlPrefix = 'https://admanager.google.com/' + networkId + '#troubleshooting/screenshot/queryId=';

    $('#aid'+ slotIndex).html(data.advertiserId ? makeUrl(data.advertiserId, adminUrlPrefix) : 'N/A');
    $('#cmid'+ slotIndex).html(data.campaignId ? makeUrl(data.campaignId, orderUrlPrefix) : 'N/A');
    $('#lid'+ slotIndex).html(data.lineItemId ? makeUrl(data.lineItemId, lineItemUrlPrefix) : 'N/A');
    $('#cid'+ slotIndex).html(data.creativeId ? makeUrl(data.creativeId, creativeUrlPrefix) : 'N/A');
    $('#qid'+ slotIndex).html(data.qid ? makeUrl(data.qid, queryIdUrlPrefix) : 'N/A');
  }
  function copyText(elementId) {
    var el = document.getElementById(elementId);
    if (!el) return;
    var text = el.innerText || el.textContent;
    if (!text || text === 'N/A') return;
    navigator.clipboard.writeText(text).then(function() {
      var originalColor = el.style.color;
      el.style.color = '#34d399';
      setTimeout(function() {
        el.style.color = originalColor;
      }, 800);
    });
  }
  <\/scr` + `ipt>
  <!-- End of DFP UI Links -->

  <scr` + `ipt>
  var CITIES = ${JSON.stringify(MAJOR_CITIES)};
  var oopAlert = false;
  var adslotsEventData = [];
  var slotFilledState = {};

  function checkOop(slotIndex){
    var elementIndex = $('#DFPTagsController').index();
    if (elementIndex > 0){
      var hasActualOopElement = false;
      for (var i = 0; i < elementIndex; i++) {
        var child = $('body').children().eq(i)[0];
        if (child) {
          var id = child.id || '';
          if (id.indexOf('googletag_console') === -1 && id.indexOf('google_pubconsole') === -1) {
            hasActualOopElement = true;
          }
        }
      }
      if (hasActualOopElement) {
        $('#oopnote' + slotIndex).show();
        if(!oopAlert){
          var injectedElements = [];
          for (var i = 0; i < elementIndex; i++){
            injectedElements.push($('body').children().eq(i)[0]);
          }
          console.group('\\n%cAttention:\\n ', 'font-size: 120%;font-weight:bold;color:red');
          console.log('   The following Elements have been added to the page DOM\\n' +
                      '   by one of the ads:\\n ');
          console.log('   ', injectedElements);
          console.log('   \\n' +
                      '   This can indicate that one or more OOP Creatives have\\n' +
                      '   been delivered and rendered on the page, but the elements\\n' +
                      '   containing the creatives might be hidden from view.\\n\\n' +
                      '   To make sure the OOP ads rendered correctly, please inspect\\n' +
                      '   the above elements which should be found at the very top of\\n' +
                      '   the BODY element on the top.window.'
                     );
          console.groupEnd();
        }
        oopAlert = true;
      }
    }
  }

  function adslotsData(data) {
    var adSlots = (typeof googletag !== 'undefined' && typeof googletag.pubads === 'function') ? googletag.pubads().getSlots() : [];
    adslotsEventData.push(data);

    var divId = (data.slot && typeof data.slot.getSlotElementId === 'function') ? data.slot.getSlotElementId() : '';
    var slotIndex = adSlots.indexOf(data.slot);
    var slotDisplayNumber = slotIndex !== -1 ? (slotIndex + 1) : 1;

    console.group('%cAdslot: ' + slotDisplayNumber, 'font-size: 120%;font-weight:bold');

    var queryId = (data.slot && typeof data.slot.getEscapedQemQueryId === 'function') ? data.slot.getEscapedQemQueryId() : 'N/A';

    // slotRenderEnded can fire more than once for the same slot. Once a slot has
    // rendered a real ad, ignore a later empty signal — otherwise the populated
    // Advertiser/Line Item/Creative details get wiped back to "No Ad Returned!"
    // a moment after they appear.
    if (data.isEmpty && slotFilledState[slotDisplayNumber]) {
      console.log('   %cIgnoring later empty event for an already-filled slot.', 'font-style:italic');
      console.groupEnd();
      return;
    }

    // Reset visual states before applying this event's result, so stale state
    // from a prior call doesn't stick around alongside the new one.
    $('#asinfo' + slotDisplayNumber).addClass('hidden-element');
    $('#asinfoquery' + slotDisplayNumber).addClass('hidden-element');
    $('#noad' + slotDisplayNumber).hide();
    $('#noadQID' + slotDisplayNumber).hide();
    $('#backfill' + slotDisplayNumber).hide();

    if (!data.isEmpty) {
      slotFilledState[slotDisplayNumber] = true;
      $('#asinfo' + slotDisplayNumber).removeClass('hidden-element');
      $('#asinfoquery' + slotDisplayNumber).removeClass('hidden-element');
      console.log('   %cAdvertiser ID:  ', 'font-style:italic', data.advertiserId);
      console.log('   %cCampaign   ID:  ', 'font-style:italic', data.campaignId);
      console.log('   %cLineItem   ID:  ', 'font-style:italic', data.lineItemId);
      console.log('   %cCreative   ID:  ', 'font-style:italic', data.creativeId);
      $('#aid' + slotDisplayNumber).text(data.advertiserId ? data.advertiserId : 'N/A');
      $('#cmid' + slotDisplayNumber).text(data.campaignId ? data.campaignId : 'N/A');
      $('#lid' + slotDisplayNumber).text(data.lineItemId ? data.lineItemId : 'N/A');
      $('#cid' + slotDisplayNumber).text(data.creativeId ? data.creativeId : 'N/A');
      $('#sz' + slotDisplayNumber).text(data.size[0] + 'x' + data.size[1]);
      $('#qid' + slotDisplayNumber).text(queryId);
      data.qid = queryId;

      if(data.size[0] == 1 && data.size[1] == 1){
        window.setTimeout(checkOop, 2000, slotDisplayNumber);
      }
      if(typeof icsUrls !== 'undefined'){
        icsUrls(slotDisplayNumber, data);
      }
    } else {
      console.log('   %cNo Ad Returned!', 'font-style:italic');
      $('#noad' + slotDisplayNumber).show();
      $('#noadqid' + slotDisplayNumber).text(queryId);
      $('#noadQID' + slotDisplayNumber).show();
      // The GAM auction came back empty, but an AdSense/AdX backfill creative
      // can still paint into the slot a moment later. slotRenderEnded/
      // getResponseInformation expose no line-item data for backfill, so detect
      // the rendered iframe directly and report that an ad actually showed.
      (function (n, qid, id) {
        window.setTimeout(function () {
          // If a real ad filled this slot in the meantime, leave its details be.
          if (slotFilledState[n]) return;
          var div = document.getElementById(id);
          var frame = div ? div.querySelector('iframe') : null;
          if (frame && frame.offsetWidth > 1 && frame.offsetHeight > 1) {
            $('#noad' + n).hide();
            $('#noadQID' + n).hide();
            $('#backfillsz' + n).text(frame.offsetWidth + 'x' + frame.offsetHeight);
            $('#backfillqid' + n).text(qid);
            $('#backfill' + n).show();
            // Wrapper will fit content automatically via CSS
          }
        }, 1500);
      })(slotDisplayNumber, queryId, divId);
    }
    console.log('   %cQuery      ID:  ', 'font-style:italic', queryId);
    console.groupEnd();
  }

  function showToast(msg) {
    var t = document.createElement('div');
    t.style.position = 'fixed';
    t.style.bottom = '20px';
    t.style.right = '20px';
    t.style.background = '#15803d';
    t.style.color = '#fff';
    t.style.padding = '10px 18px';
    t.style.borderRadius = '4px';
    t.style.boxShadow = '0 2px 10px rgba(0,0,0,0.25)';
    t.style.fontFamily = 'sans-serif';
    t.style.fontSize = '13px';
    t.style.zIndex = '99999';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 2000);
  }

  window.copyRawCode = function(type) {
    var el = document.getElementById('textarea-' + type);
    if (!el) return;
    navigator.clipboard.writeText(el.value).then(function() {
      showToast('Code copied to clipboard!');
    }).catch(function() {
      el.select();
      document.execCommand('copy');
      showToast('Code copied to clipboard!');
    });
  }

  window.toggleEdit = function(type, configKey) {
    var btn = document.getElementById('edit-btn-' + type);
    var pre = document.getElementById('pre-' + type);
    var textarea = document.getElementById('textarea-' + type);
    if (!btn || !pre || !textarea) return;

    var isEditing = btn.innerText === 'Save & Run';
    if (!isEditing) {
      pre.classList.add('hidden-element');
      textarea.classList.remove('hidden-element');
      btn.innerText = 'Save & Run';
    } else {
      var newCode = textarea.value;
      var raw = localStorage.getItem('adTagTestPageConfig');
      if (raw) {
        try {
          var config = JSON.parse(raw);
          config.snapshot[configKey] = newCode;
          localStorage.setItem('adTagTestPageConfig', JSON.stringify(config));
          location.reload();
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  window.changeSpoofedLocation = function(selectEl) {
    var val = selectEl.value;
    if (val === 'custom') {
      window.openGeoModal();
      return;
    }

    var parts = val.split('|');
    var coords = parts[0] || '';
    var country = parts[1] || '';

    var raw = localStorage.getItem('adTagTestPageConfig');
    if (!raw) return;
    try {
      var config = JSON.parse(raw);
      config.snapshot.geolocationCoordinates = coords;
      config.snapshot.geolocationCountry = country;
      
      localStorage.setItem('adTagTestPageConfig', JSON.stringify(config));
      localStorage.setItem('adTagTestPageConfigUpdateSource', 'location-spoof');
      location.reload();
    } catch (e) {
      console.error('Failed to change spoofed location:', e);
    }
  }

  window.openGeoModal = function() {
    var raw = localStorage.getItem('adTagTestPageConfig');
    var coords = '';
    var country = '';
    if (raw) {
      try {
        var config = JSON.parse(raw);
        coords = config.snapshot.geolocationCoordinates || '';
        country = config.snapshot.geolocationCountry || '';
      } catch(e) {}
    }
    
    document.getElementById('modal-geo-coords').value = coords;
    document.getElementById('modal-geo-country').value = country;
    document.getElementById('custom-geo-modal').classList.remove('hidden-element');
  }

  window.closeGeoModal = function() {
    document.getElementById('custom-geo-modal').classList.add('hidden-element');
    var selectEl = document.querySelector('.select-location');
    if (selectEl) {
      selectEl.value = selectEl.getAttribute('data-prev') || '';
    }
  }

  window.submitGeoModal = function() {
    var coords = document.getElementById('modal-geo-coords').value.trim();
    var country = document.getElementById('modal-geo-country').value.trim().toUpperCase();

    var raw = localStorage.getItem('adTagTestPageConfig');
    if (!raw) return;
    try {
      var config = JSON.parse(raw);
      config.snapshot.geolocationCoordinates = coords;
      config.snapshot.geolocationCountry = country;
      
      localStorage.setItem('adTagTestPageConfig', JSON.stringify(config));
      localStorage.setItem('adTagTestPageConfigUpdateSource', 'location-spoof');
      location.reload();
    } catch (e) {
      console.error(e);
    }
  }

  window.detectUserLocation = function() {
    var btn = document.querySelector('.btn-geo-detect');
    var originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerText = 'Detecting...';
    
    fetch('https://ipapi.co/json/')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.latitude && data.longitude) {
          document.getElementById('modal-geo-coords').value = data.latitude + ',' + data.longitude;
          document.getElementById('modal-geo-country').value = data.country_code || '';
        } else {
          alert('Could not detect location from IP.');
        }
      })
      .catch(function(err) {
        console.error(err);
        return fetch('https://ip-api.com/json/')
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data.lat && data.lon) {
              document.getElementById('modal-geo-coords').value = data.lat + ',' + data.lon;
              document.getElementById('modal-geo-country').value = data.countryCode || '';
            } else {
              alert('Could not detect location from IP.');
            }
          });
      })
      .finally(function() {
        btn.disabled = false;
        btn.innerHTML = originalText;
      });
  }

  window.searchLocationName = function() {
    var query = document.getElementById('modal-geo-search').value.trim();
    if (!query) {
      alert('Please enter a location name to search.');
      return;
    }

    var btn = document.querySelector('.btn-geo-search');
    var originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Searching...';
    var resultEl = document.getElementById('geo-search-result');

    // Local fuzzy search first
    var q = query.toLowerCase();
    var matches = CITIES.filter(function(city) {
      var label = (city.n + ' ' + city.c).toLowerCase();
      // Check if all query words appear in the label
      var words = q.split(/[\s,\-]+/).filter(Boolean);
      return words.every(function(w) { return label.indexOf(w) !== -1; });
    });

    if (matches.length > 0) {
      // Use the best match (first result)
      var best = matches[0];
      document.getElementById('modal-geo-coords').value = best.lat.toFixed(6) + ',' + best.lng.toFixed(6);
      document.getElementById('modal-geo-country').value = best.c;

      // Show result with alternatives if multiple matches
      var html = '<span class="geo-result-label">Matched Location</span>';
      html += '<span class="geo-result-name">' + best.n + ', ' + best.c + '</span>';
      html += '<span class="geo-result-type">(local database)</span>';
      if (matches.length > 1) {
        html += '<div style="margin-top:6px; font-size:10.5px; opacity:0.7;">';
        html += 'Also found: ';
        var alts = matches.slice(1, 6);
        html += alts.map(function(m, i) {
          return '<span class="geo-alt-city" data-idx="' + i + '" data-lat="' + m.lat.toFixed(6) + '" data-lng="' + m.lng.toFixed(6) + '" data-cc="' + m.c + '" data-name="' + m.n + ', ' + m.c + '" style="color:inherit; text-decoration:underline; cursor:pointer;">' + m.n + ', ' + m.c + '</span>';
        }).join(' \u00b7 ');
        if (matches.length > 6) html += ' \u00b7 +' + (matches.length - 6) + ' more';
        html += '</div>';
      }
      resultEl.innerHTML = html;
      resultEl.style.borderColor = '';
      resultEl.style.background = '';
      resultEl.style.color = '';
      resultEl.classList.remove('hidden-element');
      // Attach click handlers for alternative cities
      var altSpans = resultEl.querySelectorAll('.geo-alt-city');
      altSpans.forEach(function(span) {
        span.addEventListener('click', function() {
          document.getElementById('modal-geo-coords').value = span.getAttribute('data-lat') + ',' + span.getAttribute('data-lng');
          document.getElementById('modal-geo-country').value = span.getAttribute('data-cc');
          resultEl.querySelector('.geo-result-name').textContent = span.getAttribute('data-name');
        });
      });
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    // Fallback: Nominatim API for locations not in local database
    fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=1&addressdetails=1')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.length > 0) {
          var result = data[0];
          document.getElementById('modal-geo-coords').value = parseFloat(result.lat).toFixed(6) + ',' + parseFloat(result.lon).toFixed(6);
          if (result.address && result.address.country_code) {
            document.getElementById('modal-geo-country').value = result.address.country_code.toUpperCase();
          } else {
            document.getElementById('modal-geo-country').value = '';
          }
          var typeLabel = result.type ? result.type.replace(/_/g, ' ') : '';
          resultEl.innerHTML = '<span class="geo-result-label">Resolved Location (API)</span>' +
            '<span class="geo-result-name">' + (result.display_name || 'Unknown') + '</span>' +
            (typeLabel ? '<span class="geo-result-type">(' + typeLabel + ')</span>' : '');
          resultEl.style.borderColor = '';
          resultEl.style.background = '';
          resultEl.style.color = '';
          resultEl.classList.remove('hidden-element');
        } else {
          resultEl.innerHTML = '<span class="geo-result-label">Not Found</span>' +
            '<span class="geo-result-name">No results for "' + query + '". Try a different spelling.</span>';
          resultEl.style.borderColor = '${isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.25)'}';
          resultEl.style.background = '${isDark ? 'rgba(127, 29, 29, 0.15)' : 'rgba(239, 68, 68, 0.08)'}';
          resultEl.style.color = '${isDark ? '#fca5a5' : '#dc2626'}';
          resultEl.classList.remove('hidden-element');
        }
      })
      .catch(function(err) {
        console.error(err);
        alert('Failed to search location.');
      })
      .finally(function() {
        btn.disabled = false;
        btn.innerHTML = originalText;
      });
  }

  window.resetCode = function(configKey) {
    var raw = localStorage.getItem('adTagTestPageConfig');
    if (raw) {
      try {
        var config = JSON.parse(raw);
        config.snapshot[configKey] = null;
        localStorage.setItem('adTagTestPageConfig', JSON.stringify(config));
        location.reload();
      } catch (e) {
        console.error(e);
      }
    }
  }
  <\/scr` + `ipt>

  ${consoleDisableScriptCode}
  ${locationSpoofPrepaintScriptCode}
  ${stagingHeadScriptCode}
  ${publisherConsoleScriptCode}
  ${liveReloadScriptCode}
</head>
<body id="ad-tag-generator-preview-body">
  ${bodyContent}
</body>
</html>`
}
