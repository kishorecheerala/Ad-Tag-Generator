# CLAUDE.md — AI codebase guide

Read this first. It captures the non-obvious things so you don't have to re-derive them.

## What this is

A React SPA that **generates Google Ad Manager (GPT) tags** and lets you test them. Five surfaces:
Tag Settings (the generator), Ad Tag Validator & Decoder, URL Encoder/Decoder, Creative Preview
(live HTML/CSS/JS editor), and a standalone **`/testpage`** route that renders a real ad-serving page.

It's a rewrite of a legacy single-file tool (`../original_dfpgpt.html`, `../index.html` in the parent
`Test Ads` folder). The parent folder is **not** a git repo; **this `ad-tag-generator/` folder is the repo.**

## Stack (verify with package.json, don't trust memory)

React 19 · Vite 8 · TypeScript ~6 · Tailwind CSS v4 (CSS-first, no `tailwind.config.js`; config lives in
`src/index.css`) · Zustand 5 · Radix UI primitives · hand-authored shadcn-style components · CodeMirror 6
(`@uiw/react-codemirror`, lazy-loaded) · oxlint.

## Run / verify

```bash
npm run dev        # Vite dev server; honors PORT env var (see vite.config.ts)
npm run build      # tsc -b && vite build
npx tsc -b --noEmit  # type-check only (fast; use this to validate changes)
npm run lint       # oxlint
```
- Repo-root `../start.command` (in the parent folder) double-click-launches the dev server.
- `.claude/launch.json` (parent) defines the `react-app` preview config with `autoPort: true` — Vite reads
  `PORT` from env, so the preview harness can assign a free port. **Do not hardcode `--port`.**
- The generated tags hit **real Google ad servers**. The sample network `82109981` usually returns no GAM
  fill, so slots show "No Ad Returned" or an AdSense/AdX **backfill** ad. That's expected, not a bug.

## Architecture

```
src/
  main.tsx                 Entry. Branches on location.pathname === '/testpage' → <TestPageRoute/> else <App/>
  App.tsx                  Tab shell (settings/decoder/encoder/creative) + live-mirrors test-page config to localStorage
  stores/uiStore.ts        Tiny: just the active tab
  lib/theme.ts             dark/light store (persisted; also inlined in index.html to avoid FOUC)
  components/ui/           Radix-based primitives (button, card, tabs, select, dialog, ...)
  components/shared/        Cross-feature widgets (see "Shared widgets" below)
  features/
    tag-settings/           THE core. store.ts + lib/ (pure codegen) + components/
    decoder/                Ad-request URL parser + parameter dictionary
    encoder/                Stateless URL encode/decode
    creative-preview/       CodeMirror editor + sandboxed <iframe> preview + console bridge
    test-page/              TestPageRoute.tsx (the /testpage standalone page)
```

### State model — the snapshot pattern (important)

`features/tag-settings/store.ts` is the single source of truth (Zustand). The pure code generators take a
plain **`TagSettingsState` snapshot**, never the store. Get it via:
- `useTagSettingsSnapshot()` — reactive hook, wrapped in `useShallow` (returns a new object each call, so
  shallow-compare is required or React loops / warns "getSnapshot should be cached").
- `getTagSettingsSnapshot()` — imperative one-off.

`toSnapshot()` derives `isMCM`, trims network IDs, and passes nested objects (video/adsense/slots) **by
reference** — so the snapshot is JSON-serializable and cheap.

### GPT codegen pipeline (`features/tag-settings/lib/`)

- **`sizeUtils.ts`** — `SlotSize = [number,number] | 'fluid'`. `parseSizeString` handles the `'fluid'`
  native token. `formatSizes` renders `'fluid'` as the string literal. `pixelSizesOnly()` strips fluid for
  code paths that need real px (VAST, AMP, size math). **If you touch size handling, remember `'fluid'` is
  not a tuple — index access will break on it.**
- **`codeBuilders.ts`** — `buildHeaderScriptCode` / `buildBodyScriptCode` / `buildStandardSlotParts` /
  `buildVastUrl` / `buildHttpVectorUrl`. These produce the copy-paste tag **and** feed the staging page, so
  they never drift. Deprecated GPT setters use the `setConfig` form:
  `pubads().enableSingleRequest()` → `googletag.setConfig({ singleRequest: true })`, and `Slot.setTargeting()`
  → `slot.setConfig({ targeting: { key: ['val'] } })` (via `buildTargetingObjectLiteral`; setConfig returns
  void so it's the terminal call after `addService`). Still on the old form on purpose: passback
  (`definePassback().setTargeting`) and page-level (`pubads().setTargeting`).
- **`generateStagingHtml.ts`** — builds a full standalone HTML document (as a string) with embedded
  jQuery + the `adslotsData` (slotRenderEnded) handler that populates the per-slot **asInfo** panel. Two
  modes via options: `isPreview` (minimal, for the in-app Live Ads sandbox iframe) vs full page. Also
  `pubConsole`, `isDark`, `liveReload`. **This file is where the ad-testing behavior lives.**

## GPT behaviors baked into generateStagingHtml.ts (hard-won; don't regress)

- **Publisher Console needs a real top-level page.** `googletag.openConsole()` will NOT render inside an
  iframe or a `blob:`/`about:blank` document — it hangs on a blank "Loading" panel. That's the entire reason
  `/testpage` is a real route (see below), not an iframe or a data/blob URL.
- **Console on/off is via JS, not CSS.** When `pubConsole` is false we emit `googletag.disablePublisherConsole()`
  BEFORE `enableServices()` so the live network can't auto-open it. (An older CSS `display:none` hack hid the
  panel but not the per-slot "Delivery Tools" overlay — do not bring that back.) When true, `openConsole()`.
- **`slotRenderEnded` can fire twice for one slot** — a filled event then a later empty one that would wipe
  the details back to "No Ad Returned!". Guarded by `slotFilledState[n]`: once a slot renders a real ad, later
  empty events are ignored.
- **AdSense/AdX backfill has no line-item data.** GAM auction reports `isEmpty:true` and
  `getResponseInformation()` is null, yet a creative still paints. We detect the rendered `<iframe>` in the
  slot div and show an "Ad rendered via AdSense/AdX backfill" message instead of "No Ad Returned". This
  detection is also gated by `slotFilledState` so it can't override a real fill.

## The `/testpage` route (real-time, top-level)

- `main.tsx` renders `<TestPageRoute/>` when the path is `/testpage` (Vite SPA fallback serves index.html).
- The app writes the current config to `localStorage['adTagTestPageConfig']` (`TEST_PAGE_CONFIG_KEY`) and
  opens `/testpage` in a new tab. `LiveAdsPanel` has both buttons: Open Test Page (`pubConsole:false`) and
  Publisher Console (`pubConsole:true`).
- `TestPageRoute` reads that config and `document.write`s the staging HTML (top-level → ads + console work).
- **Live updates:** `App.tsx` mirrors the snapshot to that localStorage key (debounced ~1s) whenever settings
  change *and the key already exists*; the staging page carries a `storage`-event listener (`liveReload`) that
  reloads. So an open test page tracks edits across tabs. There is **no** separate `testpage.html` file and
  no multi-page Vite config — it's a normal SPA route.

## Shared widgets (`components/shared/`)

- **`ChipInput` / `SizeChipInput`** — tag inputs for targeting `key=value` and ad sizes. Both split on commas
  (typed or pasted) into multiple chips. `SizeChipInput` has a focus-opens autocomplete of standard sizes
  (incl. `fluid`) rendered outside the overflow container so it isn't clipped; fixed `h-8` like a normal input.
- **`ResizablePanels`** — two-pane split with a draggable divider. Split stored as a **percentage** (stays
  fluid on resize, not px-locked). Divider is transparent at rest, **red on hover** (`hover:bg-red-500`,
  desktop-only `lg:block`).
- **`ResizeHandle`** — hover-reveal vertical drag handle pinned to a card's bottom edge (parent needs
  `group relative`). Used by the three Creative Preview cards (editor/preview/console) for per-card height.
- **`ClearableInput`** — input with an inline X clear button (red on hover). Used for network IDs.
- **`CodePanel`** — read-only highlighted code with Edit → "Save & Run" (stores a manual override in
  `customHeaderCode`/`customBodyCode`) plus a "Resume Auto-Sync" affordance to drop the override.

## Conventions

- Feature-first folders; pure logic in `lib/`, React in `components/`, state in `store.ts`.
- Keep the copy-paste tag and the staging page consistent — both come from `codeBuilders`/`generateStagingHtml`.
- Match surrounding style; Tailwind utility classes; `cn()` from `lib/utils` for conditional classes.
- Red-on-hover for destructive/resize affordances uses fixed `red-500/red-600` so it's identical in both themes.
