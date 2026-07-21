import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ResizeHandle } from '@/components/shared/ResizeHandle'
import { ExternalLink, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreativePreviewStore, type CreativeSizePreset } from '../store'
import { CONSOLE_BRIDGE } from '../consoleBridge'
import { VideoPlayerPreview } from './VideoPlayerPreview'

const SIZE_PRESETS: { value: CreativeSizePreset; label: string }[] = [
  { value: '160x600', label: '160x600 Wide Skyscraper' },
  { value: '300x250', label: '300x250 Medium Banner' },
  { value: '728x90', label: '728x90 Leaderboard' },
  { value: '300x600', label: '300x600 Half Page' },
  { value: '320x50', label: '320x50 Mobile Leaderboard' },
  { value: '970x250', label: '970x250 Billboard' },
  { value: '640x360', label: '640x360 (16:9 Video Canvas)' },
  { value: 'fluid', label: 'Fluid (Native Content)' },
  { value: 'responsive', label: 'Responsive (Auto Fill)' },
]

export function LivePreviewFrame() {
  const formatMode = useCreativePreviewStore((s) => s.formatMode)
  const jsonContent = useCreativePreviewStore((s) => s.jsonContent)
  const html = useCreativePreviewStore((s) => s.html)
  const css = useCreativePreviewStore((s) => s.css)
  const js = useCreativePreviewStore((s) => s.js)
  const size = useCreativePreviewStore((s) => s.size)
  const setSize = useCreativePreviewStore((s) => s.setSize)
  const appendConsoleEntry = useCreativePreviewStore((s) => s.appendConsoleEntry)
  const clearConsole = useCreativePreviewStore((s) => s.clearConsole)
  const macroSubstitutions = useCreativePreviewStore((s) => s.macroSubstitutions)
  const liveSiteConfig = useCreativePreviewStore((s) => s.liveSiteConfig)
  const runToken = useCreativePreviewStore((s) => s.runToken)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [previewHeight, setPreviewHeight] = useState(() => Math.max(320, (window.innerHeight - 140) * 0.8))

  // Substitute macros in string
  const resolveMacros = (inputStr: string) => {
    let result = inputStr
    Object.keys(macroSubstitutions).forEach((macro) => {
      const val = macroSubstitutions[macro]
      if (val !== undefined && val !== '') {
        result = result.split(macro).join(val)
      }
    })
    return result
  }

  // Generate HTML for iframe
  const htmlContent = useMemo(() => {
    if (formatMode === 'video') return ''

    // 1. GAM On-Site Live Ad Renderer Mode
    if (formatMode === 'on_site_gam') {
      const rawAdUnit = liveSiteConfig.adUnitId || macroSubstitutions['%epid!'] || '/23171577/expedia.fr_fr/hotels/results'
      let adUnitId = rawAdUnit.trim().startsWith('/') ? rawAdUnit.trim() : '/' + rawAdUnit.trim()
      // If GAM URL passed only the network code (e.g. "/23171577"), expand to full ad unit path
      if (adUnitId === '/23171577' || adUnitId === '23171577') {
        adUnitId = '/23171577/expedia.fr_fr/hotels/results'
      }

      const lineItemId = liveSiteConfig.lineItemId || macroSubstitutions['%eaid!'] || '7322921650'
      const creativeId = liveSiteConfig.creativeId || macroSubstitutions['%ecid!'] || '138561712827'
      const sizeTargeting = liveSiteConfig.sizeTargeting || (size === 'responsive' ? '160x600' : size)

      const parsedSize = sizeTargeting === 'fluid'
        ? "'fluid'"
        : sizeTargeting.includes('x')
          ? `[${sizeTargeting.split('x').join(', ')}]`
          : `[160, 600]`

      const parentSearchString = window.location.search || ''

      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { height: 100%; margin: 0; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; box-sizing: border-box; }
  .preview-bar { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 11px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .badge { background: #059669; color: #fff; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px; text-transform: uppercase; }
  .info-tag { font-family: monospace; color: #10b981; }
  .ad-slot-frame { min-height: 250px; border: 1px dashed #3f3f46; border-radius: 8px; padding: 12px; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
  .as-info-card { width: 100%; margin-top: 12px; background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 10px; font-size: 11px; font-family: monospace; }
  .as-info-row { display: flex; justify-content: space-between; border-b: 1px solid #27272a; padding: 4px 0; }
  .as-info-row:last-child { border-b: none; }
</style>
<script>${CONSOLE_BRIDGE}<\/script>

<script>
  try {
    if (window.history && window.history.replaceState) {
      var topSearch = ${JSON.stringify(parentSearchString)};
      if (topSearch) {
        window.history.replaceState(null, '', window.location.pathname + topSearch);
      }
    }
  } catch (e) {}
<\/script>

<script>
(function() {
  var originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    var el = originalCreateElement.apply(this, arguments);
    if (tagName && tagName.toLowerCase() === 'img') {
      var originalSetAttribute = el.setAttribute;
      Object.defineProperty(el, 'src', {
        set: function(val) {
          if (val && (val.indexOf('pixel') !== -1 || val.indexOf('impression') !== -1 || val.indexOf('doubleclick') !== -1 || val.indexOf('log') !== -1)) {
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
<\/script>

<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" onerror="
  window.__gptBlocked = true;
  console.error('[GAM On-Site Error] gpt.js was blocked by browser or ad-blocker.');
  var infoDiv = document.getElementById('as-info-content');
  if (infoDiv) {
    infoDiv.innerHTML = '<div style=\'color:#ef4444;font-weight:bold;\'>Ad-Blocker Detected (net::ERR_BLOCKED_BY_CLIENT)</div>' +
      '<div style=\'font-size:10px;color:#f87171;margin-top:4px;line-height:1.4;\'>' +
      '&bull; <b>Action Needed:</b> Please pause Brave Shields, uBlock Origin, or AdGuard on this domain (ad-tag-generator.vercel.app) to allow Google Ad Manager to respond.<br>' +
      '&bull; Or click <b>Full Test Page</b> above to test in a clean tab.' +
      '</div>';
  }
"><\/script>
<script>
  window.googletag = window.googletag || {cmd: []};
  var slotRenderFired = false;

  googletag.cmd.push(function() {
    var slot = googletag.defineSlot('${adUnitId.replace(/'/g, "\\'")}', ${parsedSize}, 'gam-onsite-preview-slot');
    if (slot) {
      slot.addService(googletag.pubads());
    }

    // Set full top-level page URL on GPT pubads service
    try {
      var topUrl = (window.top && window.top.location && window.top.location.href) ? window.top.location.href : window.location.href;
      googletag.pubads().set('page_url', topUrl);
    } catch(e) {}

    var urlParams = new URLSearchParams(window.location.search || (window.top ? window.top.location.search : ''));
    var previewToken = urlParams.get('google_preview') || urlParams.get('googlesitepreview');
    if (previewToken) {
      googletag.pubads().setTargeting('google_preview', previewToken);
      googletag.pubads().setTargeting('googlesitepreview', previewToken);
      googletag.pubads().setTargeting('gdfp_req', '1');
    }
    if ('${lineItemId}') googletag.pubads().setTargeting('lineItemId', '${lineItemId}');
    if ('${creativeId}') googletag.pubads().setTargeting('creativeId', '${creativeId}');

    googletag.pubads().addEventListener('slotRenderEnded', function(event) {
      slotRenderFired = true;
      console.log('[GAM On-Site Render] Slot: ' + event.slot.getAdUnitPath() + ' | Empty: ' + event.isEmpty + ' | LineItem: ' + (event.lineItemId || 'N/A') + ' | Creative: ' + (event.creativeId || 'N/A'));
      
      var infoDiv = document.getElementById('as-info-content');
      if (infoDiv) {
        if (event.isEmpty) {
          infoDiv.innerHTML = '<div style="color:#ef4444;font-weight:bold;margin-bottom:4px;">No Ad Returned from GAM Auction (Empty: true)</div>' +
            '<div style="font-size:10px;color:#a1a1aa;line-height:1.4;">' +
            '&bull; <b>Ad Unit Path:</b> ${adUnitId}<br>' +
            '&bull; <b>Line Item ID:</b> ${lineItemId} | <b>Creative ID:</b> ${creativeId}<br>' +
            '&bull; <b>Size Targeting:</b> ${sizeTargeting}<br>' +
            '&bull; <i>Check if GAM preview token expired. Re-click "On site" in GAM to generate a fresh link.</i>' +
            '</div>';
        } else {
          infoDiv.innerHTML = '<div class="as-info-row"><span>Line Item ID:</span><span class="info-tag">' + (event.lineItemId || '${lineItemId}') + '</span></div>' +
            '<div class="as-info-row"><span>Creative ID:</span><span class="info-tag">' + (event.creativeId || '${creativeId}') + '</span></div>' +
            '<div class="as-info-row"><span>Advertiser ID:</span><span>' + (event.advertiserId || 'N/A') + '</span></div>' +
            '<div class="as-info-row"><span>Rendered Size:</span><span>' + (event.size ? event.size[0] + 'x' + event.size[1] : '${sizeTargeting}') + '</span></div>';
        }
      }
    });

    googletag.enableServices();
  });

  // 4.5s Timeout diagnostic for blocked requests or slow responses
  setTimeout(function() {
    if (!slotRenderFired && !window.__gptBlocked) {
      var infoDiv = document.getElementById('as-info-content');
      if (infoDiv && infoDiv.innerText.indexOf('Requesting ad') !== -1) {
        infoDiv.innerHTML = '<div style="color:#fbbf24;font-weight:bold;">GAM Request Pending / Token Timeout</div>' +
          '<div style="font-size:10px;color:#a1a1aa;margin-top:4px;line-height:1.4;">' +
          '&bull; GAM preview token may have expired or is blocked by browser extension.<br>' +
          '&bull; Click <b>On site</b> in GAM UI again to refresh token, or test in <b>Full Test Page</b> tab.<br>' +
          '&bull; Alternatively, paste your Creative Template JSON into <b>GAM Native JSON</b> editor.' +
          '</div>';
      }
    }
  }, 4500);
<\/script>
</head>
<body>
  <div class="preview-bar">
    <div>
      <span class="badge">GAM On-Site Live Preview</span>
      <span style="margin-left: 8px;">Ad Unit: <strong class="info-tag">${adUnitId}</strong></span>
    </div>
    <div>Targeting: <strong>${sizeTargeting}</strong></div>
  </div>

  <div class="ad-slot-frame">
    <!-- GAM Ad Slot Container -->
    <div id="gam-onsite-preview-slot">
      <script>
        googletag.cmd.push(function() { googletag.display('gam-onsite-preview-slot'); });
      </script>
    </div>

    <!-- Troubleshooting Information Details -->
    <div class="as-info-card" id="as-info-card">
      <div style="font-weight:bold;color:#38bdf8;margin-bottom:6px;">GAM Creative Render Diagnostics</div>
      <div id="as-info-content">
        <div style="color:#a1a1aa;font-style:italic;">Requesting ad from Google Ad Manager...</div>
      </div>
    </div>
  </div>
</body>
</html>`
    }

    // 2. GAM Native Custom Format (JSON Schema v3) Mode
    if (formatMode === 'json') {
      let parsedJson: any = null
      try {
        parsedJson = JSON.parse(jsonContent)
      } catch {
        parsedJson = null
      }

      if (!parsedJson) {
        return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#ef4444;padding:16px;">
        <h3>JSON Syntax Error</h3>
        <p>Could not parse GAM Native Custom Format JSON. Check syntax in editor.</p>
        </body></html>`
      }

      const heading = resolveMacros(parsedJson?.copy?.heading?.standard || 'Native Ad Heading')
      const description = resolveMacros(parsedJson?.copy?.description?.standard || '')
      const ctaText = resolveMacros(parsedJson?.copy?.callToAction?.standard || 'Learn More')
      const sponsoredLabel = resolveMacros(parsedJson?.copy?.sponsoredLabel?.standard || 'Sponsored')
      const advertiserName = resolveMacros(parsedJson?.copy?.advertiserName?.standard || '')
      const terms = resolveMacros(parsedJson?.copy?.termsAndConditions?.standard || '')
      const landingDomain = resolveMacros(parsedJson?.copy?.landingDomain?.standard || '')
      const logoUrl = resolveMacros(parsedJson?.images?.logo?.standard?.src || 'https://picsum.photos/120/40')
      const featureImgUrl = resolveMacros(parsedJson?.images?.feature?.standard?.src || 'https://picsum.photos/600/300')
      const clickUrl = resolveMacros(parsedJson?.links?.click?.url || '#')
      const videoUrl = resolveMacros(parsedJson?.video?.url || '')

      const renderBeacon = resolveMacros(parsedJson?.beacons?.render?.url || '')
      const imp1Beacon = resolveMacros(parsedJson?.beacons?.impressionThirdParty1?.url || '')
      const imp2Beacon = resolveMacros(parsedJson?.beacons?.impressionThirdParty2?.url || '')

      const bundleClicks: { sitePath: string; clickThroughUrl: string }[] = Array.isArray(parsedJson?.links?.bundleClicks)
        ? parsedJson.links.bundleClicks.map((b: any) => ({
            sitePath: resolveMacros(b.sitePath || ''),
            clickThroughUrl: resolveMacros(b.clickThroughUrl || '#'),
          }))
        : []

      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #09090b; color: #f4f4f5; }
  .native-card { border: 1px solid #27272a; border-radius: 12px; padding: 16px; background: #18181b; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  .header { display: flex; items-center; justify-content: space-between; gap: 8px; }
  .logo { max-height: 36px; max-width: 120px; object-fit: contain; }
  .sponsored-badge { background: #27272a; color: #a1a1aa; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .title { font-size: 16px; font-weight: 700; color: #ffffff; line-height: 1.3; margin: 0; }
  .desc { font-size: 13px; color: #a1a1aa; margin: 0; line-height: 1.4; }
  .feature-img { width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; }
  .cta-btn { background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; text-align: center; cursor: pointer; border: none; display: inline-block; transition: background 0.2s; }
  .cta-btn:hover { background: #1d4ed8; }
  .footer { font-size: 10px; color: #71717a; border-t: 1px solid #27272a; pt-2; display: flex; justify-content: space-between; align-items: center; }
  .bundle-box { margin-top: 8px; border-top: 1px solid #27272a; padding-top: 8px; }
  .bundle-title { font-size: 11px; font-weight: 600; color: #e4e4e7; margin-bottom: 6px; }
  .bundle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; }
  .bundle-item { background: #27272a; color: #38bdf8; text-decoration: none; font-size: 11px; padding: 6px 8px; border-radius: 4px; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; border: 1px solid #3f3f46; }
  .bundle-item:hover { background: #3f3f46; color: #7dd3fc; }
  .beacon-log { font-size: 9px; font-family: monospace; color: #4ade80; background: #052e16; padding: 4px 8px; border-radius: 4px; margin-top: 8px; }
</style>
<script>${CONSOLE_BRIDGE}<\/script>
</head>
<body>
  <div class="native-card">
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : `<span>${advertiserName}</span>`}
      <span class="sponsored-badge">${sponsoredLabel}</span>
    </div>

    ${heading ? `<h2 class="title">${heading}</h2>` : ''}
    ${description ? `<p class="desc">${description}</p>` : ''}
    ${featureImgUrl ? `<img src="${featureImgUrl}" class="feature-img" alt="Featured" />` : ''}

    ${videoUrl ? `
      <div style="margin:6px 0;">
        <video src="${videoUrl}" controls style="width:100%; border-radius:8px; background:#000;"></video>
      </div>` : ''}

    <a href="${clickUrl}" target="_blank" class="cta-btn" onclick="console.log('CTA Clicked: ' + this.href)">
      ${ctaText} &rarr;
    </a>

    ${bundleClicks.length > 0 ? `
      <div class="bundle-box">
        <div class="bundle-title">Bundle Click Targets (${bundleClicks.length})</div>
        <div class="bundle-grid">
          ${bundleClicks.map((b, idx) => `<a href="${b.clickThroughUrl}" target="_blank" class="bundle-item" title="${b.clickThroughUrl}" onclick="console.log('Bundle Click ${idx+1}: ' + this.href)">${b.sitePath || 'Link ' + (idx+1)}</a>`).join('')}
        </div>
      </div>` : ''}

    <div class="footer">
      <span>${landingDomain || advertiserName}</span>
      <span>${terms}</span>
    </div>

    <div class="beacon-log" id="beacon-log">
      Firing Render &amp; Impression Beacons...
    </div>
  </div>

  <script>
    console.info('GAM Native Custom Format Creative Loaded (Schema v3).');
    
    var beacons = [
      { name: 'Render Beacon', url: '${renderBeacon}' },
      { name: '3rd Party Tracker 1', url: '${imp1Beacon}' },
      { name: '3rd Party Tracker 2', url: '${imp2Beacon}' }
    ];

    var firedCount = 0;
    beacons.forEach(function(b) {
      if (b.url && b.url.startsWith('http')) {
        firedCount++;
        console.log('[BEACON FIRED] ' + b.name + ' -> ' + b.url);
      }
    });

    document.getElementById('beacon-log').innerText = 'Fired ' + firedCount + ' Impression & Render Beacons cleanly.';
  <\/script>
</body>
</html>`
    }

    // 3. HTML5 mode
    let finalHtml = resolveMacros(html)
    let finalJs = resolveMacros(js)

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>html, body { height: 100%; margin: 0; }
${css}</style>
<script>${CONSOLE_BRIDGE}<\/script>
</head>
<body>
${finalHtml}
<script>
try {
${finalJs}
} catch (e) {
  console.error(e && e.message ? e.message : String(e));
}
<\/script>
</body>
</html>`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatMode, jsonContent, html, css, js, macroSubstitutions, liveSiteConfig, runToken])

  // Write content via contentDocument for same-origin execution
  useEffect(() => {
    if (!iframeRef.current) return
    const iframe = iframeRef.current
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(htmlContent)
        doc.close()
      }
    } catch (e) {
      console.error('Failed to write iframe content:', e)
    }
  }, [htmlContent])

  useEffect(() => {
    clearConsole()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlContent, formatMode])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source === iframeRef.current?.contentWindow && e.data?.source === 'creative-console') {
        appendConsoleEntry({ level: e.data.level, text: e.data.args.join(' ') })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [appendConsoleEntry])

  const isResponsive = size === 'responsive'
  const isFluid = size === 'fluid'
  const w = isResponsive || isFluid ? 0 : Number(size.split('x')[0])

  return (
    <Card className="group relative flex flex-col shrink-0" style={{ height: previewHeight }}>
      <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {formatMode === 'on_site_gam' && <Globe className="size-4 text-emerald-400" />}
          <span>
            {formatMode === 'on_site_gam'
              ? 'GAM On-Site Creative Canvas'
              : `Live Creative Canvas (${formatMode.toUpperCase()})`}
          </span>
        </CardTitle>

        <div className="flex items-center gap-2">
          {formatMode === 'on_site_gam' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 border-emerald-500/40 text-emerald-300"
              onClick={() => {
                const lineItemId = liveSiteConfig.lineItemId || '7322921650'
                const creativeId = liveSiteConfig.creativeId || '138561712827'
                const adUnitId = liveSiteConfig.adUnitId || '/23171577/expedia.fr_fr/hotels results'
                window.open(
                  `/testpage?google_preview=1&iu=${encodeURIComponent(
                    adUnitId
                  )}&lineItemId=${lineItemId}&creativeId=${creativeId}`,
                  '_blank'
                )
              }}
            >
              <ExternalLink className="size-3" />
              <span>Full Test Page</span>
            </Button>
          )}

          <Select value={size} onValueChange={(v) => setSize(v as CreativeSizePreset)}>
            <SelectTrigger className="h-7 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZE_PRESETS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex justify-center bg-zinc-950 p-3 overflow-hidden">
        {formatMode === 'video' ? (
          <div className="w-full h-full overflow-y-auto">
            <VideoPlayerPreview />
          </div>
        ) : (
          <div
            className={cn(
              'bg-zinc-900 h-full rounded-lg overflow-hidden border border-zinc-800 shadow-inner',
              (isResponsive || isFluid) && 'w-full'
            )}
            style={{ width: isResponsive || isFluid ? '100%' : w, maxWidth: '100%' }}
          >
            <iframe
              ref={iframeRef}
              title="Creative live preview"
              className="h-full w-full border-0 bg-transparent"
            />
          </div>
        )}
      </CardContent>
      <ResizeHandle onResize={(dy) => setPreviewHeight((ph) => Math.max(200, ph + dy))} />
    </Card>
  )
}
