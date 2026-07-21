import { useEffect, useRef } from 'react'
import { generateStagingHtml } from '@/features/tag-settings/lib/generateStagingHtml'
import type { TagSettingsState } from '@/features/tag-settings/types'

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

    if (hasPreview) {
      const rawIu = searchParams.get('iu') || searchParams.get('adUnitId') || '/23171577/expedia.fr_fr/hotels results'
      let iu = rawIu.trim().startsWith('/') ? rawIu.trim() : '/' + rawIu.trim()
      if (iu === '/23171577' || iu === '23171577') {
        iu = '/23171577/expedia.fr_fr/hotels results'
      }
      const sz = searchParams.get('sz') || searchParams.get('size') || '160x600'
      const parsedSize = sz === 'fluid' ? "'fluid'" : sz.includes('x') ? `[${sz.split('x').join(', ')}]` : `[160, 600]`
      
      const lineItemId = searchParams.get('lineItemId') || '7322921650'
      const creativeId = searchParams.get('creativeId') || '138561712827'

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
<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" onerror="
  document.getElementById('as-info-content').innerHTML = '<div style=\\'color:#ef4444;font-weight:bold;\\'>Ad-Blocker Detected</div><div style=\\'color:#f87171;margin-top:6px;\\'>Please pause Brave Shields, uBlock, or AdGuard on this tab to allow GAM to respond.</div>';
"><\/script>
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

    googletag.pubads().addEventListener('slotRenderEnded', function(event) {
      slotRenderFired = true;
      var infoDiv = document.getElementById('as-info-content');
      if (infoDiv) {
        if (event.isEmpty) {
          infoDiv.innerHTML = '<div style=\\'color:#ef4444;font-weight:bold;margin-bottom:6px;\\'>No Ad Returned from GAM Auction (Empty: true)</div>' +
            '<div style=\\'color:#a1a1aa;line-height:1.5;\\'>' +
            '&bull; <b>Ad Unit Path:</b> ${iu}<br>' +
            '&bull; <b>Line Item ID:</b> ${lineItemId} | <b>Creative ID:</b> ${creativeId}<br>' +
            '&bull; <b>Size Targeting:</b> ${sz}<br>' +
            '&bull; <i>Check if the preview token has expired. click On site in GAM again to refresh.</i>' +
            '</div>';
        } else {
          infoDiv.innerHTML = '<div class="as-info-row"><span>Line Item ID:</span><span class="info-tag">' + (event.lineItemId || '${lineItemId}') + '</span></div>' +
            '<div class="as-info-row"><span>Creative ID:</span><span class="info-tag">' + (event.creativeId || '${creativeId}') + '</span></div>' +
            '<div class="as-info-row"><span>Advertiser ID:</span><span>' + (event.advertiserId || 'N/A') + '</span></div>' +
            '<div class="as-info-row"><span>Rendered Size:</span><span>' + (event.size ? event.size[0] + 'x' + event.size[1] : '${sz}') + '</span></div>';
        }
      }
    });
    
    googletag.enableServices();
  });
  
  setTimeout(function() {
    if (!slotRenderFired) {
      var infoDiv = document.getElementById('as-info-content');
      if (infoDiv && infoDiv.innerText.indexOf('Requesting') !== -1) {
        infoDiv.innerHTML = '<div style=\\'color:#fbbf24;font-weight:bold;\\'>GAM Request Pending / Token Timeout</div>' +
          '<div style=\\'color:#a1a1aa;margin-top:6px;line-height:1.5;\\'>' +
          '&bull; GAM preview token may have expired or is blocked.<br>' +
          '&bull; Click <b>On site</b> in GAM UI again to refresh the token, then reload this page.' +
          '</div>';
      }
    }
  }, 4500);
<\/script>
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
          <div style="color:#a1a1aa;font-style:italic;">Requesting ad from Google Ad Manager...</div>
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
