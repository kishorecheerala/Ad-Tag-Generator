export function deepDecode(rawValue: string): string {
  if (!rawValue) return ''
  let decodedValue = String(rawValue)
  try {
    for (let i = 0; i < 3; i++) {
      const previous = decodedValue
      decodedValue = decodeURIComponent(decodedValue)
      if (decodedValue === previous) break
    }
  } catch {
    // leave partially decoded value as-is
  }
  return decodedValue
}

export function formatDate(epochString: string): string {
  try {
    const ms = Number(epochString)
    if (isNaN(ms)) return epochString
    const d = new Date(ms)
    return d.toLocaleTimeString() + ` (${d.toLocaleDateString()})`
  } catch {
    return epochString
  }
}

export function formatTimeDelta(ms: number): string {
  if (isNaN(ms)) return 'N/A'
  const abs = Math.abs(ms)
  return abs < 1000 ? `${ms > 0 ? '+' : '-'}${abs} ms` : `${ms > 0 ? '+' : '-'}${(abs / 1000).toFixed(2)}s`
}

function decodeBase64(str: string): string | null {
  try {
    return atob(str.trim())
  } catch {
    return null
  }
}

export interface ClientHints {
  platform: string
  platformVersion: string
  architecture: string
  model: string
  browserVersion: string
  isMobile: boolean
  bitness: string
  brands: [string, string][]
}

export function parseClientHints(rawClientHintsString: string | undefined): ClientHints | null {
  if (!rawClientHintsString) return null
  const decoded = decodeBase64(rawClientHintsString) || rawClientHintsString
  try {
    const arr = JSON.parse(decoded)
    if (Array.isArray(arr)) {
      return {
        platform: arr[0] || 'Unknown',
        platformVersion: arr[1] || 'Unknown',
        architecture: arr[2] || 'Unknown',
        model: arr[3] || 'N/A',
        browserVersion: arr[4] || 'Unknown',
        isMobile: !!arr[6],
        bitness: arr[8] || '',
        brands: Array.isArray(arr[9]) ? arr[9] : [],
      }
    }
  } catch {
    // not valid client hints
  }
  return null
}

export function parseNestedParams(nestedParamsString: string | undefined): Record<string, string> {
  const parsed: Record<string, string> = {}
  if (!nestedParamsString) return parsed
  const decoded = deepDecode(nestedParamsString)
  for (const segment of decoded.split('&')) {
    if (!segment) continue
    const eq = segment.indexOf('=')
    if (eq !== -1) parsed[segment.substring(0, eq)] = deepDecode(segment.substring(eq + 1))
    else parsed[segment] = ''
  }
  return parsed
}

export interface DecodedAdTag {
  globalParameters: Record<string, string>
  customTargetingParameters: Record<string, string>
  isGam: boolean
  isCm360: boolean
  isVast: boolean
  hostName: string
  pathName: string
  isHtmlTag?: boolean
  htmlSlots?: { path: string; sizes: string; divId: string; targeting?: Record<string, string> }[]
}

export function decodeAdTag(rawAdTagInput: string): DecodedAdTag | null {
  const trimmed = rawAdTagInput.trim()
  if (!trimmed) return null

  const isHtml = trimmed.includes('<script') || trimmed.includes('googletag') || trimmed.includes('defineSlot')
  if (isHtml) {
    const slots: { path: string; sizes: string; divId: string; targeting?: Record<string, string> }[] = []
    
    let match
    const defineSlotRegex = /defineSlot\(\s*['"]([^'"]+)['"]\s*,\s*([^,)]+|\[[^\]]+\]|['"][^'"]+['"])\s*,\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = defineSlotRegex.exec(trimmed)) !== null) {
      const path = match[1]
      const rawSizes = match[2].trim()
      const divId = match[3]
      
      let sizes = '300x250'
      if (rawSizes.startsWith('[') && rawSizes.endsWith(']')) {
        const nestedMatches = rawSizes.match(/\[\s*\d+\s*,\s*\d+\s*\]/g)
        if (nestedMatches) {
          sizes = nestedMatches.map(m => {
            const parts = m.replace(/[\[\]\s]/g, '').split(',')
            return `${parts[0]}x${parts[1]}`
          }).join('|')
        } else {
          const parts = rawSizes.replace(/[\[\]\s]/g, '').split(',')
          if (parts.length === 2) {
            sizes = `${parts[0]}x${parts[1]}`
          }
        }
      } else {
        sizes = rawSizes.replace(/['"\s]/g, '')
      }
      slots.push({ path, sizes, divId, targeting: {} })
    }

    const oopSlotRegex = /defineOutOfPageSlot\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = oopSlotRegex.exec(trimmed)) !== null) {
      slots.push({ path: match[1], sizes: 'oop', divId: match[2], targeting: {} })
    }

    const customTargetingParameters: Record<string, string> = {}
    const pageTargetingRegex = /googletag\.pubads\(\)\.setTargeting\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\)/g
    while ((match = pageTargetingRegex.exec(trimmed)) !== null) {
      const key = match[1]
      let val = match[2].trim()
      val = val.replace(/[\[\]'"\s]/g, '')
      customTargetingParameters[key] = val
    }

    if (slots.length > 0) {
      return {
        globalParameters: {
          iu: slots[0].path,
          sz: slots[0].sizes,
        },
        customTargetingParameters,
        isGam: true,
        isCm360: false,
        isVast: false,
        hostName: 'securepubads.g.doubleclick.net',
        pathName: '/gampad/ads',
        isHtmlTag: true,
        htmlSlots: slots,
      }
    }
  }

  const globalParameters: Record<string, string> = {}
  let parsedHostName = ''
  let parsedPathName = ''

  let urlObject: URL | null = null
  try {
    let sanitized = trimmed
    if (sanitized.startsWith('//')) sanitized = 'https:' + sanitized
    else if (!sanitized.includes('://')) sanitized = 'https://' + sanitized
    urlObject = new URL(sanitized)
    parsedHostName = urlObject.hostname
    parsedPathName = urlObject.pathname
  } catch {
    urlObject = null
  }

  if (urlObject) {
    for (const [key, value] of urlObject.searchParams.entries()) {
      globalParameters[key] = deepDecode(value)
    }
    const pathAndHash = urlObject.pathname + urlObject.hash
    const semicolonParts = pathAndHash.split(';')
    if (semicolonParts.length > 1) {
      for (let i = 1; i < semicolonParts.length; i++) {
        const part = semicolonParts[i]
        if (!part) continue
        const eq = part.indexOf('=')
        if (eq !== -1) globalParameters[part.substring(0, eq)] = deepDecode(part.substring(eq + 1))
        else globalParameters[part] = ''
      }
    }
  } else {
    trimmed.split(/[&;]/).forEach((segment) => {
      if (!segment) return
      const eq = segment.indexOf('=')
      if (eq !== -1) {
        let key = segment.substring(0, eq)
        if (key.includes('?')) key = key.split('?')[1]
        globalParameters[key] = deepDecode(segment.substring(eq + 1))
      }
    })
  }

  const isGam =
    (parsedHostName.includes('securepubads.g.doubleclick.net') || parsedHostName.includes('pubads.g.doubleclick.net')) &&
    parsedPathName.includes('/gampad/ads')
  const isCm360 =
    parsedHostName.includes('ad.doubleclick.net') ||
    parsedHostName.includes('ad-emea.doubleclick.net') ||
    parsedPathName.includes('/ddm/pfadx/') ||
    parsedPathName.includes('/ddm/adx/')
  const isVast =
    globalParameters['dcmt'] === 'text/xml' ||
    !!globalParameters['dc_vast'] ||
    globalParameters['output'] === 'vast' ||
    globalParameters['output'] === 'xml_vast' ||
    globalParameters['output'] === 'xml_vast3' ||
    globalParameters['output'] === 'xml_vast4' ||
    globalParameters['output'] === 'vpaid_vast' ||
    parsedPathName.includes('/gampad/live/ads') ||
    (parsedPathName.includes('/gampad/ads') && globalParameters['env'] === 'vp')

  const customTargetingParameters = globalParameters['cust_params'] ? parseNestedParams(globalParameters['cust_params']) : {}

  return { globalParameters, customTargetingParameters, isGam, isCm360, isVast, hostName: parsedHostName, pathName: parsedPathName }
}

export interface CoreItem {
  key: string
  label: string
  val: string
  desc: string
}

export function buildCoreItems(globalParameters: Record<string, string>, isCm360: boolean, pathName: string): CoreItem[] {
  if (isCm360 && pathName) {
    let cmSiteId = '-'
    let cmCampaignId = '-'
    let cmPlacementId = '-'

    const pathSegments = pathName.split('/')
    const nSegment = pathSegments.find((seg) => seg.startsWith('N'))
    let bSegment = pathSegments.find((seg) => seg.startsWith('B'))

    if (nSegment) cmSiteId = nSegment.split(';')[0]
    if (bSegment) {
      bSegment = bSegment.split(';')[0]
      const parts = bSegment.split('.')
      cmCampaignId = parts[0]
      if (parts.length > 1) cmPlacementId = parts[1]
    }

    return [
      { key: 'Site / Network ID', label: 'Site / Network ID', val: cmSiteId, desc: 'Campaign Manager site placement identifier.' },
      { key: 'Campaign ID', label: 'Campaign ID', val: cmCampaignId, desc: 'Campaign Manager campaign level identifier.' },
      { key: 'Placement ID', label: 'Placement ID', val: cmPlacementId, desc: 'Unique placement identifier for creative serving.' },
      { key: 'sz', label: 'Ad Slot Sizes', val: globalParameters['sz'] || '-', desc: 'Target creative size dimensions.' },
      { key: 'dcmt', label: 'Document MIME Type', val: globalParameters['dcmt'] || '-', desc: 'Response format MIME (e.g. text/xml for VAST).' },
      { key: 'dc_vast', label: 'VAST Version', val: globalParameters['dc_vast'] || '-', desc: 'Requested VAST XML schema version.' },
      { key: 'ord', label: 'ord (Cache Buster)', val: globalParameters['ord'] || '-', desc: 'Unique variable to bypass browser caches.' },
      { key: 'env', label: 'Environment', val: globalParameters['env'] || '-', desc: 'Platform execution scope constraint.' },
      { key: 'ifi', label: 'Slot Index', val: globalParameters['ifi'] || '-', desc: 'Relative slot placement index.' },
    ]
  }

  let networkCode = '-'
  let adUnitPath = '-'
  if (globalParameters['iu_parts']) {
    const parts = globalParameters['iu_parts'].split(',')
    if (parts.length > 0) {
      networkCode = parts[0]
      adUnitPath = parts.slice(1).join('/')
    }
  } else if (globalParameters['iu']) {
    const raw = globalParameters['iu']
    const sanitized = raw.startsWith('/') ? raw.substring(1) : raw
    const parts = sanitized.split('/')
    if (parts.length > 0) {
      networkCode = parts[0]
      adUnitPath = parts.slice(1).join('/') || '/'
    }
  }

  return [
    { key: 'Network Code', label: 'Network Code', val: networkCode, desc: 'Google Ad Manager network ID.' },
    { key: 'Ad Unit Path', label: 'Ad Unit Path', val: adUnitPath, desc: 'Full hierarchical path of the ad unit slot.' },
    { key: 'Ad Slot Sizes', label: 'Ad Slot Sizes', val: globalParameters['prev_iu_szs'] || globalParameters['sz'] || '-', desc: 'Target creative size dimensions.' },
    { key: 'gdfp_req', label: 'Google DFP Request', val: globalParameters['gdfp_req'] || '-', desc: 'Required flag indicating a GPT transaction.' },
    { key: 'output', label: 'Output Format', val: globalParameters['output'] || '-', desc: 'Response layout wrapping standard.' },
    { key: 'correlator', label: 'Correlator (Cache Buster)', val: globalParameters['correlator'] || '-', desc: 'Unique shared correlation ID.' },
    { key: 'env', label: 'Environment', val: globalParameters['env'] || '-', desc: 'Platform execution scope constraint.' },
    { key: 'ifi', label: 'Slot Index', val: globalParameters['ifi'] || '-', desc: 'Relative slot placement index.' },
  ]
}
