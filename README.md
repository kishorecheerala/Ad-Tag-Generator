# Ad Manager Tag Generator

A modern suite of tools for generating Google Ad Manager (GPT) tags with MCM support, an ad-request decoder, a URL encoder, and a live HTML/CSS/JS creative preview.

## Advanced Ad Tech Troubleshooting Features

This generator includes several production-grade tools designed to simplify debugging and troubleshooting of Google Publisher Tags (GPT):

1. **GAM On-Site Live Receiver & Responsive Canvas**:
   - Set as the primary creative testing mode, allowing developers to load GAM preview tokens, ad unit paths (`/<Network_ID>/<Ad_Unit_Code>`), and live on-site creatives in a full-width responsive preview container.
   - Automatic preview token expiration diagnostic alerts and troubleshooting tips.

2. **Instant Real-Time Tracking Pixel & Beacon Inspector**:
   - Listens to live iframe console entries and network events (`consoleEntries`) to extract view impression beacons (`gampad/ads`, `pagead/adview`), doubleclick trackers, and click landing URLs instantly upon page render.
   - No tab switching required — tracking pixels and custom macro substitutions update in real time as the ad fires.

3. **Dual-Mode VAST Receiver & Video Player**:
   - Input VAST Ad Tag URLs (e.g. GAM VAST tag requests) or paste raw VAST 2.0 / 3.0 / 4.0 XML payloads directly.
   - Automatically parses `<MediaFile>` video URLs, `<ClickThrough>` landing targets, `<Impression>` beacons, and tracking events (`start`, `25%`, `50%`, `75%`, `complete`, `mute`, `pause`).
   - Live video player fires tracking beacons to ad servers at each playback milestone and logs events in real time.

4. **Precision Geolocation & Targeting Spoofing**:
   - Easily spoof your browser Geolocation API (`navigator.geolocation`) to test location-dependent ad delivery.
   - Automatically queue and set location coordinates on GPT via `googletag.pubads().setLocation(lat, lng)`.
   - Intercept and override specific geo/targeting keys (`nn_geo`, `geo`, `country`) dynamically.
   - Search city names or landmarks powered by OpenStreetMap's Nominatim API.

5. **Dynamic `/testpage` with Live Sync & Storage Integration**:
   - Serves staging documents in a genuine, top-level context (required for Google Publisher Console to initialize and codeless ad slots to render).
   - Any modifications made in the main tab automatically reflect in open test page tabs in real-time via state listeners.
   - Location modifications selected on the test page automatically sync back and update the main app's input fields.

6. **Inline Clear Controls & Brand-Free Setup**:
   - All input fields across GAM settings, TCF decoders, tag settings, and video inputs feature 1-click inline clear buttons (`ClearableInput`).
   - Clean, generic placeholders (`/<Network_ID>/<Ad_Unit_Code>`, `123456789`) with zero hardcoded corporate or proprietary network IDs.

7. **Direct Decoder Tab & Memory Cleanup**:
   - Unpack raw DoubleClick, GPT, or VAST request URLs to isolate `cust_params`, sizes, and correlators.
   - Automatically cleans up stale doubleclick `<iframe>`, anchor ad overlays, and publisher console UI frames upon iframe refreshes or route changes.


## Stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** (CSS-first config, no separate `tailwind.config.js`)
- **shadcn/ui**-style components (hand-authored, not CLI-generated) on top of Radix primitives
- **Zustand** for app state — the Tag Settings store is the single reactive source of truth (no DOM-scraping, unlike the original vanilla version)
- **@uiw/react-codemirror** (CodeMirror 6) for the Creative Preview editor, lazy-loaded on demand

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build locally
```

## Project structure

```
src/
  components/ui/        shadcn-style primitives (button, card, tabs, dialog, select, ...)
  components/shared/     ChipInput, SizeChipInput, CopyButton, ResizablePanels, CodePanel, EmptyState
  features/
    tag-settings/         Tag Settings tab: store.ts (zustand), lib/ (pure GPT-tag codegen), components/
    decoder/               Ad Tag Validator & Decoder: parsing lib + parameter dictionaries
    encoder/               URL Encoder/Decoder (stateless)
    creative-preview/      CodeMirror HTML/CSS/JS live editor + console bridge
    test-page/             TestPageRoute — the standalone /testpage page (real top-level ad-serving page)
  stores/uiStore.ts       Cross-cutting UI state (active tab)
  lib/theme.ts            Shared dark/light theme store
```

The **Test Page** and **Publisher Console** open the real `/testpage` route in a new tab (not an iframe) —
GPT ad serving and `googletag.openConsole()` require a genuine top-level page. `main.tsx` renders it via the
SPA fallback; it reads its config from `localStorage` and live-reloads when settings change.

All GPT tag-generation logic (`buildHeaderScriptCode`, `buildBodyScriptCode`,
`generateStagingHtml`, etc.) lives in framework-agnostic, typed modules under
`features/tag-settings/lib/` — ported directly from the original vanilla JS
implementation, decoupled from React.

## Deploying to Vercel

This is a standard Vite SPA — Vercel auto-detects it, no extra config needed:

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

Then import the repo in the Vercel dashboard (or run `vercel` if you have the
CLI set up) — build command `npm run build`, output directory `dist`.
