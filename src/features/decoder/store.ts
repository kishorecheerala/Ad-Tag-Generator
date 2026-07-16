import { create } from 'zustand'
import { decodeAdTag, type DecodedAdTag } from './lib/parseAdTag'
import type { ParameterCategory } from './data/parameterDictionary'

interface DecoderStore {
  tagInput: string
  decoded: DecodedAdTag | null
  activeFilterCategory: ParameterCategory | 'all'
  searchTargeting: string
  searchCore: string
  searchGlobal: string

  setTagInput: (v: string) => void
  setActiveFilterCategory: (v: ParameterCategory | 'all') => void
  setSearchTargeting: (v: string) => void
  setSearchCore: (v: string) => void
  setSearchGlobal: (v: string) => void
  decode: () => boolean
  clear: () => void
}

export const useDecoderStore = create<DecoderStore>((set, get) => ({
  tagInput: '',
  decoded: null,
  activeFilterCategory: 'all',
  searchTargeting: '',
  searchCore: '',
  searchGlobal: '',

  setTagInput: (v) => set({ tagInput: v }),
  setActiveFilterCategory: (v) => set({ activeFilterCategory: v }),
  setSearchTargeting: (v) => set({ searchTargeting: v }),
  setSearchCore: (v) => set({ searchCore: v }),
  setSearchGlobal: (v) => set({ searchGlobal: v }),

  decode: () => {
    const result = decodeAdTag(get().tagInput)
    if (!result) return false
    set({ decoded: result })
    return true
  },

  clear: () =>
    set({
      tagInput: '',
      decoded: null,
      activeFilterCategory: 'all',
      searchTargeting: '',
      searchCore: '',
      searchGlobal: '',
    }),
}))
