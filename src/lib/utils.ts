import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Automatically parses and formats copy-pasted Google Ad Manager ad unit breadcrumbs or URLs.
 * Preserves existing Network ID (e.g. 23171577) if the pasted breadcrumbs start with a text ad unit code.
 * Examples:
 *  - "expedia.us_en > packages > infosite \n R2" + existing "23171577" -> "/23171577/expedia.us_en/packages/infosite/R2"
 *  - "23171577 > expedia.us_en > packages > infosite > R2" -> "/23171577/expedia.us_en/packages/infosite/R2"
 *  - "https://securepubads.g.doubleclick.net/gampad/ads?iu=/23171577/site/section" -> "/23171577/site/section"
 */
export function parseAdUnitBreadcrumbs(input: string, existingNetworkId?: string): string {
  if (!input) return ''
  let cleaned = input.trim()

  // Extract iu parameter if a full URL is pasted
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const url = new URL(cleaned)
      const iu = url.searchParams.get('iu') || url.searchParams.get('adUnitId')
      if (iu) cleaned = decodeURIComponent(iu)
    } catch {}
  }

  // Replace breadcrumb delimiters: '>', '→', '->', '|', newlines '\n', tabs, with '/'
  cleaned = cleaned
    .replace(/[\r\n]+/g, '/')
    .replace(/\s*([>→|]|->)\s*/g, '/')
    .replace(/\s+\/\s+/g, '/')
    .replace(/\s+/g, '/')
    .replace(/\/+/g, '/')
    .trim()

  if (!cleaned) return ''

  // Strip leading slashes temporarily for segment check
  const pathWithoutLeadingSlash = cleaned.replace(/^\/+/, '')
  const segments = pathWithoutLeadingSlash.split('/')
  const firstSegmentIsNumeric = /^\d+$/.test(segments[0])

  // Extract digits from existingNetworkId if provided
  const netIdDigits = existingNetworkId ? (existingNetworkId.match(/^\/?(\d+)/) || [])[1] : ''

  if (!firstSegmentIsNumeric && netIdDigits) {
    // Prepend existing Network ID automatically so it is never lost or cleared!
    cleaned = `${netIdDigits}/${pathWithoutLeadingSlash}`
  }

  // Ensure single leading slash
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned
  }

  // Remove trailing slash if longer than 1 char
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1)
  }

  return cleaned
}
