import { create } from 'zustand'

export type ConsoleLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'

export interface ConsoleEntry {
  level: ConsoleLevel
  text: string
  time: string
}

export const DEFAULT_HTML = `<div class="ad-creative">
  <h1>Hello Ad!</h1>
  <p>Edit the HTML, CSS &amp; JS panes to preview a creative live.</p>
  <button id="cta">Click Me</button>
</div>`

export const DEFAULT_CSS = `body { margin: 0; height: 100%; display: flex; align-items: center; justify-content: center; font-family: Arial, Helvetica, sans-serif; text-align: center; }
.ad-creative { padding: 12px; }
#cta { padding: 8px 16px; background: #1a73e8; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
#cta:hover { background: #1558b0; }`

export const DEFAULT_JS = `var cta = document.getElementById('cta');
if (cta) {
  cta.addEventListener('click', function () {
    console.log('CTA clicked!');
  });
}
console.info('Creative loaded.');`

export type CreativeSizePreset = '300x250' | '300x600' | '728x90' | '320x50' | '160x600' | 'responsive'

interface CreativePreviewStore {
  html: string
  css: string
  js: string
  activePane: 'html' | 'css' | 'js'
  size: CreativeSizePreset
  consoleEntries: ConsoleEntry[]
  runToken: number

  setHtml: (v: string) => void
  setCss: (v: string) => void
  setJs: (v: string) => void
  setActivePane: (v: 'html' | 'css' | 'js') => void
  setSize: (v: CreativeSizePreset) => void
  appendConsoleEntry: (entry: Omit<ConsoleEntry, 'time'>) => void
  clearConsole: () => void
  reset: () => void
  run: () => void
}

export const useCreativePreviewStore = create<CreativePreviewStore>((set) => ({
  html: DEFAULT_HTML,
  css: DEFAULT_CSS,
  js: DEFAULT_JS,
  activePane: 'html',
  size: 'responsive',
  consoleEntries: [],
  runToken: 0,

  setHtml: (v) => set({ html: v }),
  setCss: (v) => set({ css: v }),
  setJs: (v) => set({ js: v }),
  setActivePane: (v) => set({ activePane: v }),
  setSize: (v) => set({ size: v }),
  appendConsoleEntry: (entry) =>
    set((s) => ({ consoleEntries: [...s.consoleEntries, { ...entry, time: new Date().toLocaleTimeString() }] })),
  clearConsole: () => set({ consoleEntries: [] }),
  reset: () => set({ html: DEFAULT_HTML, css: DEFAULT_CSS, js: DEFAULT_JS, consoleEntries: [], size: 'responsive', runToken: Date.now() }),
  run: () => set((s) => ({ runToken: s.runToken + 1 })),
}))
