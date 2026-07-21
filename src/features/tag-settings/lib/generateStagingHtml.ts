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

  // -- Pre-paint script for Network Request Interception --
  const networkRequestInterceptorScriptCode = `
  <script>
  (function() {
    var originalXHR = window.XMLHttpRequest;
    var originalFetch = window.fetch;
    var originalCreateElement = document.createElement;
    var originalImage = window.Image;

    function logNetwork(type, url, method, data) {
      if (!url) return;
      if (url.indexOf('/diag-log') !== -1 || url.indexOf('storage') !== -1 || url.indexOf('jquery') !== -1 || url.indexOf('imasdk') !== -1) return;

      var isGoogleAd = url.indexOf('securepubads.g.doubleclick.net') !== -1 || url.indexOf('pubads.g.doubleclick.net') !== -1;
      var isTracking = url.indexOf('click') !== -1 || url.indexOf('pixel') !== -1 || url.indexOf('tracking') !== -1 || url.indexOf('impression') !== -1;

      var category = isGoogleAd ? 'AD_REQUEST' : (isTracking ? 'TRACKING_PIXEL' : 'NETWORK_REQUEST');
      var name = isGoogleAd ? 'Google Ad Request' : (isTracking ? 'Tracking / Impression Pixel' : 'Network Request');

      var parsedUrl;
      try {
        parsedUrl = new URL(url, window.location.href);
      } catch (e) {
        try {
          parsedUrl = new URL(url, window.location.origin);
        } catch (e2) {
          return;
        }
      }

      var params = {};
      parsedUrl.searchParams.forEach(function(val, key) {
        params[key] = val;
      });

      var details = {
        url: url,
        method: method || 'GET',
        domain: parsedUrl.hostname,
        path: parsedUrl.pathname,
        queryParams: params
      };

      if (isGoogleAd) {
        if (params.iu) details.adUnitPath = params.iu;
        if (params.sz) details.sizes = params.sz;
        if (params.scp) details.slotTargeting = params.scp;
        if (params.prev_scp) details.pageTargeting = params.prev_scp;
        if (params.correlator) details.correlator = params.correlator;
        if (params.gdpr_consent) details.consentString = params.gdpr_consent;
      }

      if (window.addDiagLogToConsole) {
        window.addDiagLogToConsole(category, name, parsedUrl.hostname, details);
      } else {
        window.pendingNetworkLogs = window.pendingNetworkLogs || [];
        window.pendingNetworkLogs.push({ category: category, name: name, host: parsedUrl.hostname, details: details });
      }
    }

    // Intercept Fetch
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var method = (init && init.method) || 'GET';
      logNetwork('fetch', url, method, init && init.body);
      return originalFetch.apply(this, arguments);
    };

    // Intercept XHR
    window.XMLHttpRequest = function() {
      var xhr = new originalXHR();
      var open = xhr.open;
      var send = xhr.send;
      var method, url;

      xhr.open = function(m, u) {
        method = m;
        url = u;
        return open.apply(this, arguments);
      };

      xhr.send = function(data) {
        logNetwork('xhr', url, method, data);
        return send.apply(this, arguments);
      };

      return xhr;
    };

    // Intercept Image elements (pixel tracking)
    document.createElement = function(tagName) {
      var el = originalCreateElement.apply(this, arguments);
      if (tagName && tagName.toLowerCase() === 'img') {
        var originalSetAttribute = el.setAttribute;

        Object.defineProperty(el, 'src', {
          set: function(val) {
            logNetwork('img-src', val, 'GET');
            el.setAttribute('src', val);
          },
          get: function() {
            return el.getAttribute('src');
          }
        });

        el.setAttribute = function(name, val) {
          if (name && name.toLowerCase() === 'src') {
            logNetwork('img-src', val, 'GET');
          }
          return originalSetAttribute.apply(this, arguments);
        };
      }
      return el;
    };

    // Intercept Image constructor
    if (originalImage) {
      window.Image = function() {
        var img = new originalImage();
        Object.defineProperty(img, 'src', {
          set: function(val) {
            logNetwork('img-constructor', val, 'GET');
            img.setAttribute('src', val);
          },
          get: function() {
            return img.getAttribute('src');
          }
        });
        return img;
      };
    }
  })();
  </script>
  `

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

  // -- Pre-paint script for Geolocation, Privacy, Prebid and SafeFrame troubleshooting --
  const troubleshootingPrepaintScriptCode = `
  <script>
  (function() {
    // 1. Helper to send diagnostic logs back to the parent React app
    function sendDiagLog(type, eventName, slotId, details) {
      try {
        window.parent.postMessage({
          source: 'gpt-troubleshooter-iframe',
          type: type,
          eventName: eventName,
          slotId: slotId || 'page-level',
          details: details || {},
          timestamp: Date.now()
        }, '*');
      } catch (err) {}
      
      console.log('[DiagLog] [' + type + '] ' + eventName + ' (' + (slotId || 'page-level') + ')', details);
      if (typeof window.addDiagLogToConsole === 'function') {
        window.addDiagLogToConsole(type, eventName, slotId, details);
      }
    }

    // 2. SafeFrame postMessage listener
    window.addEventListener('message', function(event) {
      if (!event.data || typeof event.data !== 'string') return;
      var d = event.data;
      if (d.indexOf('googletag_') !== -1 || d.indexOf('safeframe') !== -1 || d.indexOf('sentinel') !== -1) {
        var action = 'unknown';
        var parsed = null;
        try { parsed = JSON.parse(d); } catch (e) {}
        
        if (parsed && parsed.action) {
          action = parsed.action;
        } else if (d.indexOf('expand') !== -1) {
          action = 'expand';
        } else if (d.indexOf('collapse') !== -1) {
          action = 'collapse';
        } else if (d.indexOf('resize') !== -1) {
          action = 'resize';
        }
        
        if (action !== 'unknown') {
          sendDiagLog('SAFEFRAME_EVENT', action, null, { payload: d.substring(0, 300) });
        }
      }
    });

    // 3. IAB TCF and USP API Simulator
    var consentMode = '${state.privacyConsent || 'none'}';
    if (consentMode !== 'none') {
      window.__tcfapi = function(command, version, callback, parameter) {
        var tcString = consentMode === 'accepted' ? 'CP123456789...' : (consentMode === 'rejected' ? 'CP00000000...' : '${state.customConsentString || 'CP12345...' }');
        var gdprApplies = true;
        var mockTcData = {
          tcString: tcString,
          gdprApplies: gdprApplies,
          eventStatus: 'tcloaded',
          cmpStatus: 'loaded',
          cmpLoaded: true,
          purpose: {
            consents: consentMode === 'accepted' ? { '1': true, '2': true, '3': true, '4': true, '5': true, '6': true, '7': true, '8': true, '9': true, '10': true } : {}
          },
          vendor: {
            consents: consentMode === 'accepted' ? { '150': true, '28': true, '24': true } : {}
          }
        };

        if (command === 'ping') {
          if (typeof callback === 'function') callback({ cmpLoaded: true, apiReady: true });
        } else if (command === 'addEventListener' || command === 'getTCData') {
          if (typeof callback === 'function') callback(mockTcData, true);
        }
      };

      // CCPA / US Privacy mock
      window.__uspapi = function(command, version, callback) {
        if (command === 'getUSPData') {
          var uspString = consentMode === 'accepted' ? '1YNN' : '1YYN';
          if (typeof callback === 'function') callback({ version: 1, uspString: uspString }, true);
        }
      };

      window.googletag = window.googletag || { cmd: [] };
      googletag.cmd.push(function() {
        if (googletag.pubads) {
          if (consentMode === 'rejected') {
            googletag.pubads().setRequestNonPersonalizedAds(1);
          } else {
            googletag.pubads().setRequestNonPersonalizedAds(0);
          }
        }
      });
    }

    // 4. Prebid.js API Simulator
    var prebidEnabled = ${state.prebidEnabled ? 'true' : 'false'};
    if (prebidEnabled) {
      window.pbjs = window.pbjs || {};
      pbjs.que = pbjs.que || [];
      
      var simulatedBids = ${JSON.stringify(state.prebidBids || [])};
      var appliedTargeting = {};
      
      simulatedBids.forEach(function(bid, index) {
        var key = 'div-gpt-ad-' + ${state.correlator} + '-' + index;
        appliedTargeting[key] = {
          hb_bidder: bid.bidder,
          hb_pb: parseFloat(bid.cpm).toFixed(2),
          hb_adid: 'pb-mock-adid-' + index,
          hb_size: bid.size
        };
      });

      pbjs.setTargetingForGPTAsync = function(adUnitCodes) {
        googletag.cmd.push(function() {
          var slots = googletag.pubads().getSlots();
          slots.forEach(function(slot) {
            var divId = slot.getSlotElementId();
            var targetObj = appliedTargeting[divId];
            if (!targetObj) {
              var idx = slots.indexOf(slot);
              var fallbackKey = 'div-gpt-ad-' + ${state.correlator} + '-' + idx;
              targetObj = appliedTargeting[fallbackKey];
            }
            if (targetObj) {
              for (var k in targetObj) {
                if (targetObj.hasOwnProperty(k)) {
                  slot.setTargeting(k, targetObj[k]);
                }
              }
              sendDiagLog('PREBID_EVENT', 'Prebid Targeting Applied', divId, targetObj);
            }
          });
        });
      };
      
      googletag.cmd.push(pbjs.setTargetingForGPTAsync);
    }

    // 5. GPT Lifecycle Event Handlers
    window.googletag = window.googletag || { cmd: [] };
    googletag.cmd.push(function() {
      if (typeof googletag.pubads === 'function') {
        var p = googletag.pubads();
        
        function updateLazyStatus(slot, state, extra) {
          if (!${state.lazyLoadEnabled}) return;
          var adSlots = googletag.pubads().getSlots();
          var slotIndex = adSlots.indexOf(slot);
          if (slotIndex === -1) return;
          var num = slotIndex + 1;
          
          var dot = document.getElementById('lazy-dot' + num);
          var txt = document.getElementById('lazy-text' + num);
          var bar = document.getElementById('lazy-status-bar' + num);
          var vis = document.getElementById('lazy-visibility' + num);
          
          if (!dot || !txt || !bar) return;
          
          if (state === 'requested') {
            txt.innerText = 'Fetching Ad (Fetch Margin Crossed)';
            dot.className = 'lazy-status-dot fetching';
          } else if (state === 'received') {
            txt.innerText = 'Response Received';
            dot.className = 'lazy-status-dot received';
          } else if (state === 'rendered') {
            txt.innerText = 'Rendered (Render Margin Crossed)';
            dot.className = 'lazy-status-dot rendered';
          } else if (state === 'viewable') {
            txt.innerText = 'Viewable Impression';
            dot.className = 'lazy-status-dot viewed';
          } else if (state === 'visibility') {
            if (vis) {
              vis.style.display = 'inline-block';
              vis.innerText = 'Vis: ' + extra + '%';
            }
          }
        }
        
        p.addEventListener('slotRequested', function(e) {
          updateLazyStatus(e.slot, 'requested');
          var eventName = 'slotRequested';
          var details = {
            path: e.slot.getAdUnitPath(),
            sizes: e.slot.getSizes().map(function(s) {
              return typeof s === 'string' ? s : s.getWidth() + 'x' + s.getHeight();
            }).join(', ')
          };
          if (${state.lazyLoadEnabled}) {
            eventName += ' (Lazy Load Fetch)';
            details.fetchMargin = '${state.lazyLoadFetchMarginPercent}%';
          }
          sendDiagLog('GPT_EVENT', eventName, e.slot.getSlotElementId(), details);
        });
        
        p.addEventListener('slotResponseReceived', function(e) {
          updateLazyStatus(e.slot, 'received');
          sendDiagLog('GPT_EVENT', 'slotResponseReceived', e.slot.getSlotElementId(), {});
        });
        
        p.addEventListener('slotRenderEnded', function(e) {
          updateLazyStatus(e.slot, 'rendered');
          var eventName = 'slotRenderEnded';
          var details = {
            isEmpty: e.isEmpty,
            advertiserId: e.advertiserId,
            campaignId: e.campaignId,
            lineItemId: e.lineItemId,
            creativeId: e.creativeId,
            size: e.size ? e.size[0] + 'x' + e.size[1] : 'N/A'
          };
          if (${state.lazyLoadEnabled}) {
            eventName += ' (Lazy Load Render)';
            details.renderMargin = '${state.lazyLoadRenderMarginPercent}%';
          }
          sendDiagLog('GPT_EVENT', eventName, e.slot.getSlotElementId(), details);
        });
        
        p.addEventListener('impressionViewable', function(e) {
          updateLazyStatus(e.slot, 'viewable');
          sendDiagLog('GPT_EVENT', 'impressionViewable', e.slot.getSlotElementId(), {});
        });
        
        p.addEventListener('slotVisibilityChanged', function(e) {
          updateLazyStatus(e.slot, 'visibility', e.visibleArea);
        });
      }
    });
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
              ${state.lazyLoadEnabled ? `
              <div class="lazy-status-bar" id="lazy-status-bar${slotDisplayNumber}">
                <span class="lazy-status-dot-wrapper">
                  <span class="lazy-status-dot" id="lazy-dot${slotDisplayNumber}"></span>
                  <span>Lazy Load: <strong id="lazy-text${slotDisplayNumber}">Idle (Awaiting Scroll)</strong></span>
                </span>
                <span class="lazy-status-visibility" id="lazy-visibility${slotDisplayNumber}" style="display: none;">Vis: 0%</span>
              </div>` : ''}
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
  <div class="shorturl vast-tag-container" style="margin-bottom: 16px;">
    <p class="vast-tag-title"><b>Video Tag (VAST) URL:</b></p>
    <a href="${generatedVastUrl}" target="_blank" class="vast-tag-link">${generatedVastUrl}</a>
    <div class="vast-tag-btn-box">
      <a href="https://googleads.github.io/googleads-ima-html5/vsi/?tag=${encodeURIComponent(generatedVastUrl)}" target="_blank" class="vast-tag-btn">External VAST Inspector</a>
    </div>
  </div>
  
  <!-- Embedded Video Ad Player Card -->
  <div class="vast-player-card">
    <div class="vast-player-header">
      <span class="vast-player-title">Embedded VAST Ad Player</span>
      <button class="btn-staging-action btn-back" id="play-vast-btn" onclick="playVastAd()" style="font-weight: 700;">
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Load & Play Video Ad
      </button>
    </div>
    <div class="vast-player-wrapper" style="position: relative; background: #000;">
      <video id="vast-content-video" style="width: 100%; height: 100%; display: block;" playsinline controls></video>
      <div id="vast-ad-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: auto; z-index: 10;"></div >
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

  const imaSdkScriptCode = state.videoEnabled
    ? `\n<script src="https://imasdk.googleapis.com/js/sdkloader/ima3.js"></script>`
    : ''

  const embeddedPlayerScriptCode = state.videoEnabled
    ? `
  <script>
  (function() {
    var adsLoader;
    var adsManager;
    var adDisplayContainer;
    
    window.playVastAd = function() {
      var playButton = document.getElementById('play-vast-btn');
      var videoContent = document.getElementById('vast-content-video');
      var adContainer = document.getElementById('vast-ad-container');

      if (!window.google || !window.google.ima) {
        window.addDiagLogToConsole('SYSTEM_ERROR', 'Google IMA SDK failed to load. Ad cannot play.', 'video-player', {});
        return;
      }

      // Initialize container
      if (!adDisplayContainer) {
        adDisplayContainer = new google.ima.AdDisplayContainer(adContainer, videoContent);
      }
      adDisplayContainer.initialize();

      // Initialize loader
      if (!adsLoader) {
        adsLoader = new google.ima.AdsLoader(adDisplayContainer);
        adsLoader.addEventListener(
          google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
          onAdsManagerLoaded,
          false
        );
        adsLoader.addEventListener(
          google.ima.AdErrorEvent.Type.AD_ERROR,
          onAdError,
          false
        );
      }

      var adsRequest = new google.ima.AdsRequest();
      adsRequest.adTagUrl = '${buildVastUrl(state, networkBaseSlotPath)}';
      adsRequest.linearAdSizeWidth = 640;
      adsRequest.linearAdSizeHeight = 360;
      adsRequest.nonLinearAdSizeWidth = 640;
      adsRequest.nonLinearAdSizeHeight = 360;

      window.addDiagLogToConsole('VAST_EVENT', 'Ad Request Sent', 'video-player', { tag: adsRequest.adTagUrl });
      adsLoader.requestAds(adsRequest);
    };

    function onAdsManagerLoaded(adsManagerLoadedEvent) {
      var videoContent = document.getElementById('vast-content-video');
      var adsRenderingSettings = new google.ima.AdsRenderingSettings();
      adsRenderingSettings.restoreHeaderAdPlay = true;

      adsManager = adsManagerLoadedEvent.getAdsManager(videoContent, adsRenderingSettings);

      // Add listeners
      adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, onAdError);

      var events = [
        google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
        google.ima.AdEvent.Type.CLICK,
        google.ima.AdEvent.Type.COMPLETE,
        google.ima.AdEvent.Type.FIRST_QUARTILE,
        google.ima.AdEvent.Type.LOADED,
        google.ima.AdEvent.Type.MIDPOINT,
        google.ima.AdEvent.Type.PAUSE,
        google.ima.AdEvent.Type.RESUME,
        google.ima.AdEvent.Type.STARTED,
        google.ima.AdEvent.Type.THIRD_QUARTILE,
        google.ima.AdEvent.Type.VOLUME_CHANGED,
        google.ima.AdEvent.Type.VOLUME_MUTED
      ];

      events.forEach(function(eventType) {
        adsManager.addEventListener(eventType, function(adEvent) {
          var ad = adEvent.getAd();
          var details = {};
          if (ad) {
            details.title = ad.getTitle();
            details.creativeId = ad.getCreativeId();
            details.adId = ad.getAdId();
            details.duration = ad.getDuration() + 's';
          }
          window.addDiagLogToConsole('VAST_EVENT', adEvent.type, 'video-player', details);
        });
      });

      try {
        adsManager.init(640, 360, google.ima.ViewMode.NORMAL);
        adsManager.start();
        window.addDiagLogToConsole('VAST_EVENT', 'AdsManager Started', 'video-player', {});
      } catch (adError) {
        window.addDiagLogToConsole('SYSTEM_ERROR', adError.toString(), 'video-player', {});
      }
    }

    function onAdError(adErrorEvent) {
      var err = adErrorEvent.getError();
      window.addDiagLogToConsole('SYSTEM_ERROR', err.getMessage(), 'video-player', { code: err.getErrorCode() });
      if (adsManager) {
        adsManager.destroy();
      }
    }
  })();
  </script>
  `
    : ''

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

  const diagnosticsConsoleHtml = options.isPreview ? '' : `
    <div class="diag-console-card">
      <div class="diag-console-header" onclick="toggleDiagConsole()">
        <span class="diag-console-title">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
          Ad Tech Troubleshooting &amp; Diagnostics Console
        </span>
        <div class="diag-console-actions">
          <span class="diag-badge" id="diag-badge-count">0 Events</span>
          <span class="diag-console-toggle-icon" id="diag-toggle-icon">▼</span>
        </div>
      </div>
      <div class="diag-console-body" id="diag-console-body-content" style="display: flex;">
        <!-- Tabs for Logs -->
        <div class="diag-tabs">
          <button class="diag-tab-btn active" onclick="switchDiagTab(event, 'diag-tab-gpt')">GPT Event Timeline</button>
          <button class="diag-tab-btn" onclick="switchDiagTab(event, 'diag-tab-network')">Network Inspector</button>
          ${state.videoEnabled ? `<button class="diag-tab-btn" onclick="switchDiagTab(event, 'diag-tab-vast')">Video Ad Logs</button>` : ''}
          <button class="diag-tab-btn" onclick="switchDiagTab(event, 'diag-tab-prebid')">Prebid.js Mocks</button>
          <button class="diag-tab-btn" onclick="switchDiagTab(event, 'diag-tab-safeframe')">SafeFrame Audits</button>
          <button class="diag-tab-btn" onclick="switchDiagTab(event, 'diag-tab-consent')">CMP &amp; Privacy</button>
        </div>
        
        <!-- Tab Content -->
        <div class="diag-tab-panel active" id="diag-tab-gpt">
          <div class="diag-log-list" id="gpt-log-list">
            <div class="diag-log-empty">Waiting for GPT events... Make sure scripts are executing.</div>
          </div>
        </div>

        <div class="diag-tab-panel" id="diag-tab-network">
          <div class="diag-log-list" id="network-log-list">
            <div class="diag-log-empty">Waiting for network requests (Fetch, XHR, image beacons)...</div>
          </div>
        </div>

        ${state.videoEnabled ? `
        <div class="diag-tab-panel" id="diag-tab-vast">
          <div class="diag-log-list" id="vast-log-list">
            <div class="diag-log-empty">No video events loaded. Click "Load & Play Video Ad" above.</div>
          </div>
        </div>
        ` : ''}
        
        <div class="diag-tab-panel" id="diag-tab-prebid">
          <div class="diag-info-box">
            <b>Prebid Status:</b> ${state.prebidEnabled ? '<span style="color:#22c55e">Enabled</span>' : '<span style="color:#a1a1aa">Disabled</span>'}<br>
            ${state.prebidEnabled ? 'Auction simulation completed. Bids injected into GPT slots.' : 'Enable Prebid Simulation in settings to inject programmatic bids.'}
          </div>
          <div class="diag-log-list" id="prebid-log-list">
            ${state.prebidEnabled ? '' : '<div class="diag-log-empty">No bids simulated.</div>'}
          </div>
        </div>
        
        <div class="diag-tab-panel" id="diag-tab-safeframe">
          <div class="diag-log-list" id="safeframe-log-list">
            <div class="diag-log-empty">No SafeFrame postMessage interactions recorded.</div>
          </div>
        </div>
        
        <div class="diag-tab-panel" id="diag-tab-consent">
          <div class="diag-info-box">
            <b>CMP Simulation Mode:</b> <span style="font-weight:bold; text-transform:uppercase;">${state.privacyConsent || 'none'}</span><br>
            <b>Consent String (tcString):</b> <code style="word-break:break-all; font-size:11px;">${state.privacyConsent === 'none' ? 'N/A' : (state.privacyConsent === 'accepted' ? 'CP123456789... (Full Consent)' : (state.privacyConsent === 'rejected' ? 'CP00000000... (Restricted)' : state.customConsentString || 'N/A'))}</code>
          </div>
        </div>
      </div>
    </div>
  `

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

    bodyContent = `
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
    <!-- Clean Beautiful Staging Container Header -->
    <div class="staging-header">
      <div class="staging-header-info">
        <h1 class="staging-page-title">Test Page</h1>
        <div class="staging-badges-row">
          <span class="badge badge-network">Network: ${networkDisplayLabel}</span>
          <span class="badge badge-tagtype">${tagTypeLabel} (${requestTypeLabel})</span>
          <span class="badge badge-consent">Consent: ${state.privacyConsent.toUpperCase()}</span>
          ${state.prebidEnabled ? `<span class="badge badge-prebid">Prebid Mock</span>` : ''}
          ${state.geolocationCoordinates ? `<span class="badge badge-geo" title="${state.geolocationCoordinates}">Geo: ${state.geolocationCountry || 'Spoofed'}</span>` : ''}
        </div>
      </div>
      <div class="staging-header-actions">
        <!-- Spoof Location Selector -->
        <div class="geo-selector-wrapper">
          <span style="font-size: 11px; opacity: 0.8; font-weight: 500; font-family: sans-serif; display: flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Spoof Location:
          </span>
          ${selectHtml}
        </div>
        <!-- Refresh Button -->
        <button class="btn-staging-action" onclick="location.reload()" title="Refresh Test Page">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          Refresh
        </button>
        <!-- Back Button -->
        <a href="/" class="btn-staging-action btn-back" title="Go back to generator">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          Back to Generator
        </a>
      </div>
    </div>

    <!-- Collapsible Environment config details panel -->
    <div class="env-details-panel">
      <div class="env-details-header" onclick="toggleEnvDetails()">
        <span>Environment Config Details</span>
        <svg id="env-arrow" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div id="env-details-content" class="env-details-content hidden-element">
        <div class="env-details-grid">
          <div class="env-item"><strong>Network:</strong> <span>${networkDisplayLabel}</span></div>
          <div class="env-item"><strong>Tag Type:</strong> <span>${tagTypeLabel}</span></div>
          <div class="env-item"><strong>Request Mode:</strong> <span>${requestTypeLabel}</span></div>
          <div class="env-item"><strong>TCF Consent Mode:</strong> <span>${state.privacyConsent.toUpperCase()}</span></div>
          ${state.customConsentString ? `<div class="env-item"><strong>TCF Consent String:</strong> <span class="font-mono">${state.customConsentString}</span></div>` : ''}
          <div class="env-item"><strong>Prebid Mock:</strong> <span>${state.prebidEnabled ? 'Active (AppNexus, Rubicon)' : 'Disabled'}</span></div>
          <div class="env-item"><strong>Lazy Loading:</strong> <span>${state.lazyLoadEnabled ? `Enabled (Fetch: ${state.lazyLoadFetchMarginPercent}%, Render: ${state.lazyLoadRenderMarginPercent}%)` : 'Disabled'}</span></div>
          <div class="env-item"><strong>Geo Coordinates:</strong> <span>${state.geolocationCoordinates || 'None (Default)'}</span></div>
          ${state.geolocationCountry ? `<div class="env-item"><strong>Geo Country:</strong> <span>${state.geolocationCountry}</span></div>` : ''}
          <div class="env-item"><strong>Collapse Empty Divs:</strong> <span>${state.collapseEmptyDivs ? 'Enabled' : 'Disabled'}</span></div>
          <div class="env-item"><strong>Disable Initial Load:</strong> <span>${state.disableInitialLoad ? 'Enabled' : 'Disabled'}</span></div>
          <div class="env-item"><strong>Force SafeFrame:</strong> <span>${state.forceSafeFrame ? 'Enabled' : 'Disabled'}</span></div>
          <div class="env-item"><strong>Center Ads:</strong> <span>${state.centerAds ? 'Enabled' : 'Disabled'}</span></div>
          <div class="env-item"><strong>Cookies:</strong> <span>${state.disableCookies ? 'Disabled' : 'Enabled'}</span></div>
        </div>
      </div>
    </div>
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
    
    <!-- Diagnostics Console -->
    ${diagnosticsConsoleHtml}
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
    .lazy-status-bar {
      margin-top: 8px;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: ${isDark ? '#27272a' : '#f5f5f5'};
      border: 1px solid ${isDark ? '#3f3f46' : '#e0e0e0'};
      color: ${isDark ? '#e4e4e7' : '#3f3f46'};
    }
    .lazy-status-dot-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lazy-status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #71717a;
      display: inline-block;
      transition: background-color 0.25s ease;
    }
    .lazy-status-dot.fetching {
      background: #f59e0b; /* Amber */
    }
    .lazy-status-dot.received {
      background: #eab308; /* Yellow */
    }
    .lazy-status-dot.rendered {
      background: #10b981; /* Green */
    }
    .lazy-status-dot.viewed {
      background: #06b6d4; /* Pulsing Cyan */
      animation: lazy-pulse 1.5s infinite alternate;
    }
    .lazy-status-visibility {
      font-family: monospace;
      font-size: 11px;
      opacity: 0.8;
      background: ${isDark ? '#18181b' : '#e2e8f0'};
      padding: 2px 6px;
      border-radius: 3px;
    }
    @keyframes lazy-pulse {
      0% { box-shadow: 0 0 0 0px rgba(6, 182, 212, 0.4); }
      100% { box-shadow: 0 0 0 6px rgba(6, 182, 212, 0); }
    }
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
    .staging-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid ${isDark ? '#27272a' : '#f1f5f9'};
      padding-bottom: 20px;
      margin-bottom: 24px;
      gap: 16px;
      flex-wrap: wrap;
    }
    .staging-header-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .staging-page-title {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      color: ${isDark ? '#ffffff' : '#0f172a'};
      font-family: system-ui, -apple-system, sans-serif;
    }
    .staging-badges-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 6px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .badge-network {
      background: ${isDark ? '#27272a' : '#f1f5f9'};
      color: ${isDark ? '#a1a1aa' : '#475569'};
    }
    .badge-tagtype {
      background: ${isDark ? '#1e293b' : '#e0f2fe'};
      color: ${isDark ? '#38bdf8' : '#0369a1'};
    }
    .badge-consent {
      background: ${isDark ? '#223026' : '#dcfce7'};
      color: ${isDark ? '#4ade80' : '#15803d'};
    }
    .badge-prebid {
      background: ${isDark ? '#3b224c' : '#f3e8ff'};
      color: ${isDark ? '#c084fc' : '#6b21a8'};
    }
    .badge-geo {
      background: ${isDark ? '#4c2f2f' : '#fee2e2'};
      color: ${isDark ? '#f87171' : '#b91c1c'};
    }
    .staging-header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .geo-selector-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      color: ${isDark ? '#a1a1aa' : '#475569'};
    }
    .btn-staging-action {
      background: ${isDark ? '#27272a' : '#f1f5f9'};
      border: 1px solid ${isDark ? '#3f3f46' : '#e2e8f0'};
      border-radius: 6px;
      color: ${isDark ? '#f4f4f5' : '#334155'};
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: background 0.2s, color 0.2s;
    }
    .btn-staging-action:hover {
      background: ${isDark ? '#3f3f46' : '#e2e8f0'};
      color: ${isDark ? '#ffffff' : '#0f172a'};
    }
    .btn-back {
      color: #15803d;
      background: ${isDark ? '#1b2c1f' : '#f0fdf4'};
      border-color: ${isDark ? '#224e2c' : '#bbf7d0'};
    }
    .btn-back:hover {
      background: ${isDark ? '#224e2c' : '#dcfce7'};
      color: ${isDark ? '#22c55e' : '#166534'};
    }

    /* Environment Config Details Styles */
    .env-details-panel {
      border: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .env-details-header {
      background: ${isDark ? '#202023' : '#f8fafc'};
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      color: ${isDark ? '#e4e4e7' : '#334155'};
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }
    .env-details-header:hover {
      background: ${isDark ? '#27272a' : '#f1f5f9'};
    }
    .env-details-content {
      padding: 16px;
      border-top: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      background: ${isDark ? '#1b1b1f' : '#ffffff'};
    }
    .env-details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      font-size: 12px;
    }
    .env-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .env-item strong {
      color: ${isDark ? '#a1a1aa' : '#64748b'};
    }
    .env-item span {
      color: ${isDark ? '#f4f4f5' : '#0f172a'};
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
    
    /* Diagnostics Console Styles */
    .diag-console-card {
      border: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      border-radius: 8px;
      overflow: hidden;
      margin-top: 24px;
      background: ${isDark ? '#09090b' : '#ffffff'};
      font-family: system-ui, -apple-system, sans-serif;
    }
    .diag-console-header {
      background: ${isDark ? '#1e293b' : '#f8fafc'};
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
      border-bottom: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
    }
    .diag-console-title {
      font-weight: 600;
      font-size: 13px;
      color: ${isDark ? '#f4f4f5' : '#1e293b'};
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .diag-console-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .diag-badge {
      background: #15803d;
      color: #fff;
      border-radius: 9999px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
    }
    .diag-console-toggle-icon {
      font-size: 10px;
      color: ${isDark ? '#a1a1aa' : '#64748b'};
      transition: transform 0.2s;
    }
    .diag-console-body {
      display: flex;
      flex-direction: column;
      max-height: 400px;
      overflow-y: auto;
    }
    .diag-tabs {
      display: flex;
      background: ${isDark ? '#18181b' : '#f1f5f9'};
      border-bottom: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
    }
    .diag-tab-btn {
      background: none;
      border: none;
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 500;
      color: ${isDark ? '#a1a1aa' : '#64748b'};
      cursor: pointer;
      border-bottom: 2px solid transparent;
      outline: none;
      font-family: inherit;
    }
    .diag-tab-btn:hover {
      color: ${isDark ? '#f4f4f5' : '#0f172a'};
    }
    .diag-tab-btn.active {
      color: #15803d;
      border-bottom-color: #15803d;
      font-weight: 600;
    }
    .diag-tab-panel {
      display: none;
      padding: 16px;
    }
    .diag-tab-panel.active {
      display: block;
    }
    .diag-log-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 280px;
      overflow-y: auto;
    }
    .diag-log-item {
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: monospace;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: ${isDark ? '#18181b' : '#f8fafc'};
      border: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      animation: diagFadeIn 0.2s ease;
    }
    @keyframes diagFadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .diag-log-badge {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 600;
      text-transform: uppercase;
      margin-right: 8px;
      display: inline-block;
    }
    .diag-badge-gpt_event { background: #2563eb; color: #fff; }
    .diag-badge-prebid_event { background: #7c3aed; color: #fff; }
    .diag-badge-safeframe_event { background: #d97706; color: #fff; }
    .diag-badge-ad_request { background: #10b981; color: #fff; }
    .diag-badge-tracking_pixel { background: #ec4899; color: #fff; }
    .diag-badge-network_request { background: #6b7280; color: #fff; }
    .diag-badge-vast_event { background: #f43f5e; color: #fff; }
    .diag-badge-system_error { background: #ef4444; color: #fff; }

    /* VAST embedded player styles */
    .vast-player-card {
      border: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
      border-radius: 8px;
      margin-bottom: 24px;
      overflow: hidden;
      background: ${isDark ? '#18181b' : '#ffffff'};
      font-family: system-ui, -apple-system, sans-serif;
    }
    .vast-player-header {
      background: ${isDark ? '#202023' : '#f8fafc'};
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid ${isDark ? '#27272a' : '#e2e8f0'};
    }
    .vast-player-title {
      font-size: 14px;
      font-weight: 700;
      color: ${isDark ? '#ffffff' : '#0f172a'};
    }
    .vast-player-wrapper {
      position: relative;
      width: 100%;
      max-width: 640px;
      aspect-ratio: 16 / 9;
      margin: 16px auto;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .diag-log-time {
      font-size: 10px;
      color: ${isDark ? '#71717a' : '#94a3b8'};
      margin-left: 12px;
      white-space: nowrap;
    }
    .diag-log-empty {
      text-align: center;
      padding: 32px;
      color: ${isDark ? '#71717a' : '#94a3b8'};
      font-size: 12.5px;
    }
    .diag-info-box {
      background: ${isDark ? 'rgba(21, 128, 61, 0.1)' : '#f0fdf4'};
      border: 1px solid ${isDark ? 'rgba(21, 128, 61, 0.25)' : '#bbf7d0'};
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 12px;
      margin-bottom: 12px;
      color: ${isDark ? '#86efac' : '#14532d'};
      line-height: 1.5;
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

  var totalDiagEvents = 0;
  window.addDiagLogToConsole = function(type, eventName, slotId, details) {
    totalDiagEvents++;
    $('#diag-badge-count').text(totalDiagEvents + ' Events');
    
    var timeStr = new Date().toLocaleTimeString();
    var typeLabel = type;
    if (type === 'GPT_EVENT') typeLabel = 'GPT';
    else if (type === 'PREBID_EVENT') typeLabel = 'Prebid';
    else if (type === 'SAFEFRAME_EVENT') typeLabel = 'SafeFrame';
    else if (type === 'AD_REQUEST') typeLabel = 'Ad Request';
    else if (type === 'TRACKING_PIXEL') typeLabel = 'Pixel';
    else if (type === 'NETWORK_REQUEST') typeLabel = 'Network';
    else if (type === 'VAST_EVENT') typeLabel = 'VAST';
    
    var badgeClass = 'diag-badge-' + type.toLowerCase();
    
    var detailsStr = '';
    if (details && Object.keys(details).length > 0) {
      detailsStr = ' <span style="opacity:0.75; font-size:11px;">' + JSON.stringify(details) + '</span>';
    }
    
    var logItemHtml = '<div class="diag-log-item">' +
      '<div>' +
        '<span class="diag-log-badge ' + badgeClass + '">' + typeLabel + '</span>' +
        '<b>' + eventName + '</b>' +
        (slotId && slotId !== 'page-level' ? ' <span style="color:#15803d">[' + slotId + ']</span>' : '') +
        detailsStr +
      '</div>' +
      '<div class="diag-log-time">' + timeStr + '</div>' +
    '</div>';
    
    var targetListId = '#gpt-log-list';
    if (type === 'GPT_EVENT') targetListId = '#gpt-log-list';
    else if (type === 'PREBID_EVENT') targetListId = '#prebid-log-list';
    else if (type === 'SAFEFRAME_EVENT') targetListId = '#safeframe-log-list';
    else if (type === 'AD_REQUEST' || type === 'TRACKING_PIXEL' || type === 'NETWORK_REQUEST') targetListId = '#network-log-list';
    else if (type === 'VAST_EVENT') targetListId = '#vast-log-list';
    
    var listEl = $(targetListId);
    if (listEl.find('.diag-log-empty').length > 0) {
      listEl.empty();
    }
    listEl.prepend(logItemHtml);
  };
  
  window.toggleEnvDetails = function() {
    var content = document.getElementById('env-details-content');
    var arrow = document.getElementById('env-arrow');
    if (content.classList.contains('hidden-element')) {
      content.classList.remove('hidden-element');
      arrow.style.transform = 'rotate(180deg)';
    } else {
      content.classList.add('hidden-element');
      arrow.style.transform = 'rotate(0deg)';
    }
  };

  window.toggleDiagConsole = function() {
    var body = document.getElementById('diag-console-body-content');
    var icon = document.getElementById('diag-toggle-icon');
    if (body.style.display === 'none') {
      body.style.display = 'flex';
      icon.innerText = '▼';
    } else {
      body.style.display = 'none';
      icon.innerText = '▲';
    }
  };
  
  window.switchDiagTab = function(event, tabId) {
    $('.diag-tab-btn').removeClass('active');
    $(event.target).addClass('active');
    $('.diag-tab-panel').removeClass('active');
    $('#' + tabId).addClass('active');
  };
  <\/scr` + `ipt>

  ${consoleDisableScriptCode}
  ${imaSdkScriptCode}
  ${networkRequestInterceptorScriptCode}
  ${locationSpoofPrepaintScriptCode}
  ${embeddedPlayerScriptCode}
  ${troubleshootingPrepaintScriptCode}
  ${stagingHeadScriptCode}
  ${publisherConsoleScriptCode}
  ${liveReloadScriptCode}
</head>
<body id="ad-tag-generator-preview-body">
  ${bodyContent}
</body>
</html>`
}
