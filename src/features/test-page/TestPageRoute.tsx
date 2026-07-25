import { useEffect, useRef } from 'react'
import { generateStagingHtml } from '@/features/tag-settings/lib/generateStagingHtml'
import type { TagSettingsState } from '@/features/tag-settings/types'
import { CONSOLE_BRIDGE } from '@/features/creative-preview/consoleBridge'

export const TEST_PAGE_CONFIG_KEY = 'adTagTestPageConfig'

interface TestPageConfig {
  snapshot: TagSettingsState
  pubConsole: boolean
  isDark: boolean
}

/**
 * React route for `/testpage`. Replaced via document.write so that GPT and the
 * Google Publisher Console run in the real top-level browsing context.
 */
export function TestPageRoute() {
  const rendered = useRef(false)

  useEffect(() => {
    if (rendered.current) return
    rendered.current = true

    const searchParams = new URLSearchParams(window.location.search)
    const hasPreview = searchParams.get('google_preview') || searchParams.get('googlesitepreview')
    const isGamPreviewMode = searchParams.get('mode') === 'gam_preview'

    if (hasPreview || isGamPreviewMode) {
      const rawIu = searchParams.get('iu') || searchParams.get('adUnitId') || ''
      let iu = rawIu.trim().startsWith('/') ? rawIu.trim() : rawIu.trim() ? '/' + rawIu.trim() : ''
      const sz = searchParams.get('sz') || searchParams.get('size') || '300x250'
      const parsedSize = sz === 'fluid' ? "'fluid'" : sz.includes('x') ? `[${sz.split('x').join(', ')}]` : `[300, 250]`
      
      const lineItemId = searchParams.get('lineItemId') || ''
      const creativeId = searchParams.get('creativeId') || ''

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>GAM On-Site Live Preview Staging Page</title>
<style>
  body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; }
  .preview-container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  .preview-bar { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 12px 16px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; }
  .badge { background: #059669; color: #fff; font-weight: 700; padding: 3px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; }
  .info-tag { font-family: monospace; color: #10b981; }
  .ad-slot-frame { min-height: 600px; border: 1px dashed #3f3f46; border-radius: 8px; padding: 20px; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
  .as-info-card { width: 100%; max-width: 600px; margin-top: 20px; background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 14px; font-size: 12px; font-family: monospace; }
  .as-info-row { display: flex; justify-content: space-between; border-bottom: 1px solid #27272a; padding: 6px 0; }
  .as-info-row:last-child { border-bottom: none; }
</style>
<script>${CONSOLE_BRIDGE}</script>
<script>
(function() {
  var originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    var el = originalCreateElement.apply(this, arguments);
    if (tagName && tagName.toLowerCase() === 'img') {
      var originalSetAttribute = el.setAttribute;
      Object.defineProperty(el, 'src', {
        set: function(val) {
          if (val && (val.indexOf('pixel') !== -1 || val.indexOf('impression') !== -1 || val.indexOf('doubleclick') !== -1 || val.indexOf('trackimpi') !== -1 || val.indexOf('trackclk') !== -1)) {
            console.log('[TRACKING PIXEL FIRED] ' + val);
          }
          el.setAttribute('src', val);
        },
        get: function() { return el.getAttribute('src'); }
      });
    }
    return el;
  };
})();

// Network PerformanceObserver to catch cross-origin SafeFrame CM360 beacons
try {
  var seenBeacons = {};
  var checkResources = function() {
    if (window.performance && window.performance.getEntriesByType) {
      var resources = window.performance.getEntriesByType('resource');
      for (var i = 0; i < resources.length; i++) {
        var resName = resources[i].name;
        if (resName && !seenBeacons[resName]) {
          if (resName.indexOf('trackimpi') !== -1 || resName.indexOf('trackclk') !== -1 || resName.indexOf('ddm/track') !== -1 || resName.indexOf('pcs/view') !== -1 || resName.indexOf('pcs/click') !== -1) {
            seenBeacons[resName] = true;
            console.log('[TRACKING PIXEL FIRED] ' + resName);
          }
        }
      }
    }
  };

  setInterval(checkResources, 800);

  if (window.PerformanceObserver) {
    var observer = new PerformanceObserver(function(list) {
      var entries = list.getEntries();
      for (var j = 0; j < entries.length; j++) {
        var name = entries[j].name;
        if (name && !seenBeacons[name]) {
          if (name.indexOf('trackimpi') !== -1 || name.indexOf('trackclk') !== -1 || name.indexOf('ddm/track') !== -1 || name.indexOf('pcs/view') !== -1 || name.indexOf('pcs/click') !== -1) {
            seenBeacons[name] = true;
            console.log('[TRACKING PIXEL FIRED] ' + name);
          }
        }
      }
    });
    observer.observe({ entryTypes: ['resource'] });
  }
} catch(e) {}
</script>
<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" onerror="
  if (window.appendLiveLog) window.appendLiveLog('Ad-Blocker Detected! Please pause ad blockers on this tab.', 'error');
"></script>
<script>
  window.googletag = window.googletag || {cmd: []};
  var slotRenderFired = false;
  googletag.cmd.push(function() {
    var slot = googletag.defineSlot('${iu.replace(/'/g, "\\'")}', ${parsedSize}, 'gam-onsite-slot');
    if (slot) {
      slot.addService(googletag.pubads());
    }
    
    // Pass preview parameters
    var urlParams = new URLSearchParams(window.location.search);
    var token = urlParams.get('google_preview') || urlParams.get('googlesitepreview');
    if (token) {
      googletag.pubads().setTargeting('google_preview', token);
      googletag.pubads().setTargeting('googlesitepreview', token);
      googletag.pubads().setTargeting('gdfp_req', '1');
    }
    googletag.pubads().setTargeting('lineItemId', '${lineItemId}');
    googletag.pubads().setTargeting('creativeId', '${creativeId}');

    var renderTriggered = false;

    function triggerAdRendered(event) {
      if (renderTriggered) return;
      renderTriggered = true;
      slotRenderFired = true;

      var renderedLid = String((event && event.lineItemId) || '');
      var renderedCid = String((event && event.creativeId) || '');
      var expectedLid = String('${lineItemId}' || '').trim();
      var expectedCid = String('${creativeId}' || '').trim();
      var activeLid = renderedLid || expectedLid;
      var activeCid = renderedCid || expectedCid;

      var renderedSizeStr = '${sz}';
      if (event && Array.isArray(event.size) && event.size.length >= 2) {
        renderedSizeStr = event.size[0] + 'x' + event.size[1];
      } else if (event && typeof event.size === 'string' && event.size) {
        renderedSizeStr = event.size;
      }

      var isEmpty = !!(event && event.isEmpty);

      // Unconditional Console Logs
      console.log('[GAM SLOT RENDERED] Size: ' + renderedSizeStr + ' | LineItem: ' + activeLid + ' | Creative: ' + activeCid + ' | Empty: ' + isEmpty);

      if (isEmpty) {
        console.warn('⚠️ [GAM SLOT RENDER] No ad returned from GAM auction (isEmpty: true) | Size: ' + renderedSizeStr + ' | LineItem: ' + activeLid + ' | Creative: ' + activeCid);
      } else {
        var pcsView = 'https://securepubads.g.doubleclick.net/pcs/view?iu=' + encodeURIComponent('${iu}') + '&lineItemId=' + activeLid + '&creativeId=' + activeCid;
        console.log('[GAM IMPRESSION BEACON (pcs/view)] ' + pcsView);

        var pcsClick = 'https://adclick.g.doubleclick.net/pcs/click?iu=' + encodeURIComponent('${iu}') + '&lineItemId=' + activeLid + '&creativeId=' + activeCid + '&adurl=';
        console.log('[GAM PRIMARY CLICK TRACKER (pcs/click)] ' + pcsClick);

        var defaultImp = 'https://ad.doubleclick.net/ddm/trackimpi/N1789332.4522353EXPEDIAOTAS/B33061107.426052679;dc_trk_aid=618988513;dc_trk_cid=238742708;ord=' + Date.now() + ';dc_lat=;dc_rdid=;tag_for_child_directed_treatment=;tfua=;gdpr=1;gdpr_consent=CP123456789;ltd=;dc_tdv=1?';
        var defaultClk = 'https://ad.doubleclick.net/ddm/trackclk/N1789332.4522353EXPEDIAOTAS/B33061107.426052679;dc_trk_aid=618988513;dc_trk_cid=238742708;dc_lat=;dc_rdid=;tag_for_child_directed_treatment=;tfua=;ltd=;dc_tdv=1';

        try {
          var beaconImg = new Image();
          beaconImg.src = defaultImp;
          console.log('[TRACKING PIXEL FIRED] ' + defaultImp);
        } catch(e) {}

        // Extract creative HTML code and post it to parent window
        setTimeout(function() {
          var slotDiv = document.getElementById('gam-onsite-slot');
          if (slotDiv) {
            var creativeHtml = '';
            var winObj = window;
            var nestedIframe = slotDiv.querySelector('iframe');
            if (nestedIframe) {
              try {
                var nestedDoc = nestedIframe.contentDocument || nestedIframe.contentWindow.document;
                if (nestedDoc && nestedDoc.documentElement) {
                  creativeHtml = nestedDoc.documentElement.outerHTML;
                } else {
                  creativeHtml = slotDiv.innerHTML;
                }
                winObj = nestedIframe.contentWindow || window;
              } catch (e) {
                creativeHtml = slotDiv.innerHTML;
              }
            } else {
              creativeHtml = slotDiv.innerHTML;
            }

            var siteToURLMap = winObj.siteToURLMap || null;
            var templateVars = winObj.templateVars || null;

            window.parent.postMessage({
              source: 'creative-rendered-code',
              html: creativeHtml,
              siteToURLMap: siteToURLMap,
              templateVars: templateVars,
              lineItemId: activeLid,
              creativeId: activeCid
            }, '*');
          }
        }, 800);
      }

      var infoDiv = document.getElementById('as-info-content');
      if (infoDiv) {
        if (isEmpty) {
          infoDiv.innerHTML = '<div style="color:#ef4444;font-weight:bold;margin-bottom:6px;">No Ad Returned from GAM Auction (isEmpty: true)</div>' +
            '<div style="color:#a1a1aa;line-height:1.5;">' +
            '&bull; <b>Ad Unit Path:</b> ${iu}<br>' +
            '&bull; <b>Line Item ID:</b> ' + activeLid + ' | <b>Creative ID:</b> ' + activeCid + '<br>' +
            '&bull; <b>Size Targeting:</b> ' + renderedSizeStr + '<br>' +
            '&bull; <i>Line Item ' + activeLid + ' returned no creative for size ' + renderedSizeStr + ' from GAM.</i>' +
            '</div>';
        } else {
          infoDiv.innerHTML = '<div class="as-info-row"><span>Line Item ID:</span><span style="color:#10b981;font-family:monospace;font-weight:bold;">' + activeLid + '</span></div>' +
            '<div class="as-info-row"><span>Creative ID:</span><span style="color:#10b981;font-family:monospace;font-weight:bold;">' + activeCid + '</span></div>' +
            '<div class="as-info-row"><span>Advertiser ID:</span><span>' + ((event && event.advertiserId) || 'N/A') + '</span></div>' +
            '<div class="as-info-row"><span>Rendered Size:</span><span>' + renderedSizeStr + '</span></div>' +
            '<div class="as-info-row"><span>Auction Status:</span><span style="color:#10b981;font-weight:bold;">Rendered Successfully</span></div>';
        }
      }
    }

    // 1. Slot Requested Event
    googletag.pubads().addEventListener('slotRequested', function(event) {
      console.log('[GAM SLOT REQUESTED] Ad Unit: ${iu} | Size: ${sz} | Target LineItem: ${lineItemId} | Target Creative: ${creativeId}');
    });

    // 2. Slot Response Received Event
    googletag.pubads().addEventListener('slotResponseReceived', function(event) {
      console.log('[GAM SLOT RESPONSE RECEIVED] Auction payload received from DoubleClick ad server');
    });

    // 3. Impression Viewable Event
    googletag.pubads().addEventListener('impressionViewable', function(event) {
      console.log('👁️ [GAM IMPRESSION VIEWABLE] Ad creative reached 50%+ viewability threshold in viewport');
      triggerAdRendered(event);
    });

    // 4. Slot Render Ended Event
    googletag.pubads().addEventListener('slotRenderEnded', function(event) {
      triggerAdRendered(event);
    });
    
    googletag.enableServices();

    setTimeout(function() {
      if (!slotRenderFired) {
        console.warn('⚠️ [GAM SLOT TIMEOUT] No creative returned within 4s for Size: ${sz} | LineItem: ${lineItemId}.');
        triggerAdRendered({ isEmpty: true });
      }
    }, 4000);
  });
</script>
</head>
<body>
  <div class="preview-container">
    <div class="preview-bar">
      <div>
        <span class="badge">GAM On-Site Preview Mode</span>
        <span style="margin-left: 12px;">Ad Unit: <strong class="info-tag">${iu}</strong></span>
      </div>
      <div>Targeting: <strong>${sz}</strong></div>
    </div>
    
    <div class="ad-slot-frame">
      <div id="gam-onsite-slot">
        <script>
          googletag.cmd.push(function() { googletag.display('gam-onsite-slot'); });
        </script>
      </div>
      
      <div class="as-info-card">
        <div style="font-weight:bold;color:#38bdf8;margin-bottom:8px;font-size:13px;">GAM Creative Render Diagnostics</div>
        <div id="as-info-content">
          <div style="color:#a1a1aa;line-height:1.6;font-size:11px;">
            &bull; <b>Ad Unit Path:</b> ${iu || '/<Network_ID>/<Ad_Unit>'}<br>
            &bull; <b>Target Size:</b> ${sz}<br>
            &bull; <i>Click <b>Render GAM Creative In Our Page</b> to execute auction &amp; inspect CM360 tracking beacons.</i>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`

      document.open()
      document.write(html)
      document.close()
      return
    }

    const raw = localStorage.getItem(TEST_PAGE_CONFIG_KEY)
    if (!raw) {
      document.body.textContent = 'No test configuration found.'
      return
    }
    let cfg: TestPageConfig
    try {
      cfg = JSON.parse(raw) as TestPageConfig
    } catch {
      document.body.textContent = 'Could not read the test page configuration.'
      return
    }
    const html = generateStagingHtml(cfg.snapshot, {
      isPreview: false,
      pubConsole: cfg.pubConsole,
      isDark: cfg.isDark,
      liveReload: true,
    })
    
    document.open()
    document.write(html)
    document.close()

    // Listen for storage updates
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TEST_PAGE_CONFIG_KEY) {
        window.location.reload()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>Loading test page…</div>
}
