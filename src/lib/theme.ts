import { create } from 'zustand'

export type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('theme', theme)
}

interface ThemeStore {
  theme: Theme
  toggleTheme: () => void
}

// A shared store (not local useState) so every component sees the same
// theme and re-renders together when it changes — a local-state hook here
// would give each caller its own out-of-sync copy.
export const useTheme = create<ThemeStore>((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return { theme: next }
    }),
}))
