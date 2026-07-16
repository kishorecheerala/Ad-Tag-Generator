import { create } from 'zustand'

export type AppTab = 'settings' | 'decoder' | 'encoder' | 'creative' | 'testpage'

interface UiState {
  activeTab: AppTab
  testPageOpen: boolean
  testPagePubConsoleMode: boolean
  setActiveTab: (tab: AppTab) => void
  openTestPage: (pubConsole?: boolean) => void
  closeTestPage: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'settings',
  testPageOpen: false,
  testPagePubConsoleMode: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  openTestPage: (pubConsole = false) =>
    set({ testPageOpen: true, testPagePubConsoleMode: pubConsole, activeTab: 'testpage' }),
  closeTestPage: () => set({ testPageOpen: false, activeTab: 'settings' }),
}))
