import { create } from 'zustand'

export type AppTab = 'settings' | 'decoder' | 'encoder' | 'creative'

interface UiState {
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
}

function getInitialTab(): AppTab {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    if (path === '/creative') return 'creative'
    if (path === '/decoder') return 'decoder'
    if (path === '/encoder') return 'encoder'
    if (path === '/tagsettings') return 'settings'

    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (searchParams.get('google_preview') || searchParams.get('googlesitepreview') || searchParams.get('creative') || hashParams.get('creative')) {
      return 'creative'
    }
    if (searchParams.get('tag') || hashParams.get('tag')) return 'decoder'
    if (searchParams.get('config') || searchParams.get('share') || hashParams.get('config') || hashParams.get('share')) return 'settings'
  }
  return 'settings'
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: getInitialTab(),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
