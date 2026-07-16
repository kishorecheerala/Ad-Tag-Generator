import type { TagSettingsState } from '../types'
import { escHtml, formatSizes, parseSizeString, pixelSizesOnly } from './sizeUtils'
import { buildBodyScriptCode, buildCompanionSlotParts, buildHeaderScriptCode, buildStandardSlotParts, buildVastUrl } from './codeBuilders'
import { highlightCode } from './highlightCode'

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
                <span class="hidden-element" id="asinfo${slotDisplayNumber}">
                  <dfn><b>Advertiser ID:</b> <em id="aid${slotDisplayNumber}"></em></dfn>
                  - <dfn><b>Campaign ID:</b> <em id="cmid${slotDisplayNumber}"></em></dfn>
                  - <dfn><b>Line Item ID:</b> <em id="lid${slotDisplayNumber}"></em></dfn>
                  - <dfn><b>Creative ID:</b> <em id="cid${slotDisplayNumber}"></em></dfn>
                  - <dfn><b>Response Size:</b> <em id="sz${slotDisplayNumber}"></em></dfn>
                  <br>
                  <dfn class="alert oop info-margin hidden-element" id="oopnote${slotDisplayNumber}">
                    <b>Attention:</b> Out-of-Page elements have been detected at the top of the body.
                  </dfn>
                  <dfn class="info-margin"><b>Query ID:</b> <em id="qid${slotDisplayNumber}"></em></dfn>
                </span>
                <em class="hidden-element" id="noad${slotDisplayNumber}"><br><b>No Ad Returned!</b></em>
                <dfn class="info-margin noad hidden-element" id="noadQID${slotDisplayNumber}"><b>Query ID:</b> <em id="noadqid${slotDisplayNumber}"></em></dfn>
                <span class="hidden-element" id="backfill${slotDisplayNumber}">
                  <br><b>Ad rendered via AdSense/AdX backfill.</b>
                  <dfn class="info-margin"><b>Rendered Size:</b> <em id="backfillsz${slotDisplayNumber}"></em></dfn>
                  <dfn class="info-margin">No Ad Manager line-item details are available for backfill creatives.</dfn>
                  <dfn class="info-margin"><b>Query ID:</b> <em id="backfillqid${slotDisplayNumber}"></em></dfn>
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
      <a href="https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/vast_inspector?tag=${encodeURIComponent(generatedVastUrl)}" target="_blank" class="vast-tag-btn">VAST Inspector</a>
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
  const publisherConsoleScriptCode = options.pubConsole
    ? `\n<scr` + `ipt>googletag.cmd.push(function(){googletag.openConsole();});<\/scr` + `ipt>`
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
    ${finalBodyMarkup}
  </div>
  ${previewHeightScript}`
  } else {
    const finalBodyMarkup = state.customBodyCode !== null ? `${slotInfoBlocksHtml}${state.customBodyCode}` : slotsOutputHtml
    const finalHeaderCode = state.customHeaderCode !== null ? state.customHeaderCode : rawHeaderScriptCode
    const finalBodyCode = state.customBodyCode !== null ? state.customBodyCode : rawBodyScriptCode

    bodyContent = `
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
    <div class="gptcode">
      <p>HEAD Tag</p>
      <pre>${highlightCode(finalHeaderCode)}</pre>
      <p>BODY Tags</p>
      <pre>${highlightCode(finalBodyCode)}</pre>
    </div>
  </div>`
  }

  return `<!DOCTYPE html>
<html lang="en"><!--
  Ad Manager Tag Generator & MCM Tester - Staging Page
  --><head>
  <title>Network ID: ${networkDisplayLabel} - ${tagTypeLabel} - ${requestTypeLabel}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, minimum-scale=1.0">
  <link rel="icon" href="data:,">
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
    .gptcode { margin-top: 20px; border-top: 1px solid ${isDark ? '#27272a' : '#e0e0e0'}; padding-top: 16px; }
    .gptcode p { font-weight: bold; font-size: 14px; color: ${isDark ? '#f4f4f5' : '#333'}; margin: 14px 0 6px; }
    .gptcode pre { background: ${isDark ? '#09090b' : '#f5f5f5'}; border: 1px solid ${isDark ? '#27272a' : '#e0e0e0'}; padding: 14px; font-size: 12px; font-family: 'Courier New', Courier, monospace; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; border-radius: 2px; line-height: 1.6; color: ${isDark ? '#e4e4e7' : '#333'}; }
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
      width: 322px;
    }
    .hidden-element {
      display: none;
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
  <\/scr` + `ipt>
  <!-- End of DFP UI Links -->

  <scr` + `ipt>
  var oopAlert = false;
  var adslotsEventData = [];
  var slotFilledState = {};

  function checkOop(slotIndex){
    var elementIndex = $('#DFPTagsController').index();
    if (elementIndex > 0){
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

  function adslotsData(data) {
    adslotsEventData.push(data);

    var divId = (data.slot && typeof data.slot.getSlotElementId === 'function') ? data.slot.getSlotElementId() : '';
    var lastDashIndex = divId.lastIndexOf('-');
    var slotIndex = lastDashIndex !== -1 ? parseInt(divId.substring(lastDashIndex + 1)) : -1;
    var slotDisplayNumber = isNaN(slotIndex) || slotIndex === -1 ? 1 : (slotIndex + 1);

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
    $('#asinfo' + slotDisplayNumber).hide();
    $('#noad' + slotDisplayNumber).hide();
    $('#noadQID' + slotDisplayNumber).hide();
    $('#backfill' + slotDisplayNumber).hide();

    if (!data.isEmpty) {
      slotFilledState[slotDisplayNumber] = true;
      $('#asinfo' + slotDisplayNumber).show();
      console.log('   %cAdvertiser ID:  ', 'font-style:italic', data.advertiserId);
      console.log('   %cCampaign   ID:  ', 'font-style:italic', data.campaignId);
      console.log('   %cLineItem   ID:  ', 'font-style:italic', data.lineItemId);
      console.log('   %cCreative   ID:  ', 'font-style:italic', data.creativeId);
      $('#aid' + slotDisplayNumber).text(data.advertiserId ? data.advertiserId : 'N/A');
      $('#cmid' + slotDisplayNumber).text(data.campaignId ? data.campaignId : 'N/A');
      $('#lid' + slotDisplayNumber).text(data.lineItemId ? data.lineItemId : 'N/A');
      $('#cid' + slotDisplayNumber).text(data.creativeId ? data.creativeId : 'N/A');
      $('#sz' + slotDisplayNumber).text(data.size[0] + 'x' + data.size[1]);
      $('#asInfo-wrapper' + slotDisplayNumber).width(data.size[0] >= 300 ? data.size[0] + 22 : 322);
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
            $('#asInfo-wrapper' + n).width(frame.offsetWidth >= 300 ? frame.offsetWidth + 22 : 322);
          }
        }, 1500);
      })(slotDisplayNumber, queryId, divId);
    }
    console.log('   %cQuery      ID:  ', 'font-style:italic', queryId);
    console.groupEnd();
  }
  <\/scr` + `ipt>

  ${consoleDisableScriptCode}
  ${stagingHeadScriptCode}
  ${publisherConsoleScriptCode}
  ${liveReloadScriptCode}
</head>
<body>
  ${bodyContent}
</body>
</html>`
}
