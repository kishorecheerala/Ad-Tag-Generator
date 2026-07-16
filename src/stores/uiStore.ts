import { create } from 'zustand'

export type AppTab = 'settings' | 'decoder' | 'encoder' | 'creative'

interface UiState {
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'settings',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
