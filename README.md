# Ad Manager Tag Generator

A modern suite of tools for generating Google Ad Manager (GPT) tags with MCM support, an ad-request decoder, a URL encoder, and a live HTML/CSS/JS creative preview.

## Advanced Ad Tech Troubleshooting Features

This generator includes several production-grade tools designed to simplify debugging and troubleshooting of Google Publisher Tags (GPT):

1. **Precision Geolocation & Targeting Spoofing**:
   - Easily spoof your browser Geolocation API (`navigator.geolocation`) to test location-dependent ad delivery.
   - Automatically queue and set location coordinates on GPT via `googletag.pubads().setLocation(lat, lng)`.
   - Intercept and override specific geo/targeting keys (`nn_geo`, `geo`, `country`) dynamically.
   - Built-in search integrates with both a local database of major cities and OpenStreetMap's Nominatim API to resolve search names to GPS coordinates instantly.
   
2. **Dynamic `/testpage` with Live Sync & Storage Integration**:
   - Serves staging documents in a genuine, top-level context (required for Google Publisher Console to initialize and codeless ad slots to render).
   - Any modifications made in the main tab automatically reflect in open test page tabs in real-time via state listeners.
   - Location modifications selected on the test page automatically sync back and update the main app's input fields.

3. **In-Staging Interactive Code Editors**:
   - View, edit, and hot-reload raw generated GPT `<head>` and `<slot>` HTML/JS directly on the test page.
   - Affordance to quickly save custom modifications or resume auto-sync with the generator state.

4. **One-Click Diagnostics & Copy Shortcuts**:
   - Inspect Advertiser ID, Line Item ID, Query ID, Creative ID, and Rendered size directly inside the slot preview details frame.
   - Interactive SVG copy buttons let you copy long Query IDs or Advertiser IDs instantly.
   - Automatic detection of AdSense/AdX backfills when GPT returns an empty payload but paints an iframe.

5. **Direct Decoder Tab Live Previews**:
   - Paste a raw Google Ad Manager, VAST, or CM360 ad request URL directly.
   - Instantly open a live sandbox preview (with desktop, tablet, and mobile viewport controls) to verify delivery or test XML playback in VAST Inspector.

6. **Memory Leak & State Cleanup**:
   - Automatically cleans up stale doubleclick `<iframe>`, anchor ad overlays, and publisher console UI frames upon iframe refreshes or route changes to prevent slot definition conflicts.


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
