export type SizePair = [number, number]
/** A slot size is either a fixed [width, height] pair, or the literal 'fluid'
 * token GPT uses to mark a native/fluid-width ad slot. */
export type SlotSize = SizePair | 'fluid'

export function parseSizeString(str: string): SlotSize[] {
  return (str || '')
    .split(',')
    .map((raw): SlotSize | null => {
      const s = raw.trim()
      if (!s) return null
      if (s.toLowerCase() === 'fluid') return 'fluid'
      const p = s.split(/[x:]/)
      if (p.length === 2) {
        const w = parseInt(p[0], 10)
        const h = parseInt(p[1], 10)
        if (!isNaN(w) && !isNaN(h)) return [w, h]
      }
      return null
    })
    .filter((v): v is SlotSize => v !== null)
}

/** Strips 'fluid' entries for code paths (VAST, AMP, size math) that only make sense with real pixel dimensions. */
export function pixelSizesOnly(arr: SlotSize[]): SizePair[] {
  return arr.filter((s): s is SizePair => s !== 'fluid')
}

export function parseViewport(s: string): SizePair | null {
  const p = s.trim().split(/[x:]/)
  if (p.length === 2) {
    const w = parseInt(p[0], 10)
    const h = parseInt(p[1], 10)
    if (!isNaN(w) && !isNaN(h)) return [w, h]
  }
  return null
}

export function formatSizes(arr: SlotSize[]): string {
  if (!arr.length) return '[]'
  const render = (s: SlotSize) => (s === 'fluid' ? "'fluid'" : `[${s[0]}, ${s[1]}]`)
  if (arr.length === 1) return render(arr[0])
  return `[${arr.map(render).join(', ')}]`
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
