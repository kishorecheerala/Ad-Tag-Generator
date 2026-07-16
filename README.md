# Ad Manager Tag Generator

A React rewrite of the original single-file HTML tool for generating Google Ad
Manager (GPT) tags with MCM support, an ad-request decoder, a URL encoder,
and a live HTML/CSS/JS creative preview.

> **Working on the code?** See [`CLAUDE.md`](./CLAUDE.md) for the AI/contributor codebase guide
> (architecture, the GPT-serving gotchas, and the `/testpage` route).

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
SPA fallback; it reads its config from `localStorage` and live-reloads when settings change. See `CLAUDE.md`.

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
