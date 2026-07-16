export type SizePair = [number, number]

export function parseSizeString(str: string): SizePair[] {
  return (str || '')
    .split(',')
    .map((s): SizePair | null => {
      const p = s.trim().split(/[x:]/)
      if (p.length === 2) {
        const w = parseInt(p[0], 10)
        const h = parseInt(p[1], 10)
        if (!isNaN(w) && !isNaN(h)) return [w, h]
      }
      return null
    })
    .filter((v): v is SizePair => v !== null)
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

export function formatSizes(arr: SizePair[]): string {
  if (!arr.length) return '[]'
  if (arr.length === 1) return `[${arr[0][0]}, ${arr[0][1]}]`
  return `[${arr.map((s) => `[${s[0]}, ${s[1]}]`).join(', ')}]`
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
