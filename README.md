# Ad Manager Tag Generator

A React rewrite of the original single-file HTML tool for generating Google Ad
Manager (GPT) tags with MCM support, an ad-request decoder, a URL encoder,
and a live HTML/CSS/JS creative preview.

## Stack

- **Vite + React 18 + TypeScript**
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
    test-page/             Full staging-page preview tab
  stores/uiStore.ts       Cross-cutting UI state (active tab, Test Page visibility)
  lib/theme.ts            Shared dark/light theme store
```

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
