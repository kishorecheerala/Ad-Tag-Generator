import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ChipInput } from '@/components/shared/ChipInput'
import { ClearableInput } from '@/components/shared/ClearableInput'
import { useTagSettingsStore } from '../store'
import type { TagType } from '../types'
import { MapPin, Search, X, Navigation, Plus } from 'lucide-react'
import { MAJOR_CITIES } from '../lib/majorCities'
import { toast } from 'sonner'

const TAG_TYPE_OPTIONS: { value: TagType; label: string }[] = [
  { value: 'async', label: 'GPT (Async)' },
  { value: 'sync', label: 'GPT (Sync)' },
  { value: 'passback', label: 'Passback' },
  { value: 'amp', label: 'AMP Ad' },
]

export function TagSettingsCard() {
  const tagType = useTagSettingsStore((s) => s.tagType)
  const parentNetwork = useTagSettingsStore((s) => s.parentNetwork)
  const childNetwork = useTagSettingsStore((s) => s.childNetwork)
  const pageTargeting = useTagSettingsStore((s) => s.pageTargeting)
  const pageUrl = useTagSettingsStore((s) => s.pageUrl)
  const isSRA = useTagSettingsStore((s) => s.isSingleRequestArchitectureEnabled)
  const advancedPanelOpen = useTagSettingsStore((s) => s.advancedPanelOpen)
  const sizeMappingPanelOpen = useTagSettingsStore((s) => s.sizeMappingPanelOpen)
  const adsensePanelOpen = useTagSettingsStore((s) => s.adsensePanelOpen)
  const videoPanelOpen = useTagSettingsStore((s) => s.videoPanelOpen)
  const diagnosticsPanelOpen = useTagSettingsStore((s) => s.diagnosticsPanelOpen)
  const lazyLoadPanelOpen = useTagSettingsStore((s) => s.lazyLoadPanelOpen)

  const setField = useTagSettingsStore((s) => s.setField)
  const setAdvancedPanelOpen = useTagSettingsStore((s) => s.setAdvancedPanelOpen)
  const setSizeMappingPanelOpen = useTagSettingsStore((s) => s.setSizeMappingPanelOpen)
  const setAdsensePanelOpen = useTagSettingsStore((s) => s.setAdsensePanelOpen)
  const setVideoPanelOpen = useTagSettingsStore((s) => s.setVideoPanelOpen)
  const setDiagnosticsPanelOpen = useTagSettingsStore((s) => s.setDiagnosticsPanelOpen)
  const setLazyLoadPanelOpen = useTagSettingsStore((s) => s.setLazyLoadPanelOpen)
  const resetTagSettings = useTagSettingsStore((s) => s.resetTagSettings)
  const geolocationCoordinates = useTagSettingsStore((s) => s.geolocationCoordinates)
  const geolocationCountry = useTagSettingsStore((s) => s.geolocationCountry)

  const [geoSearchQuery, setGeoSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<typeof MAJOR_CITIES>([])
  const [isSearchingApi, setIsSearchingApi] = useState(false)
  const [showCustomCoords, setShowCustomCoords] = useState(false)
  const [customLat, setCustomLat] = useState('')
  const [customLng, setCustomLng] = useState('')
  const [customCountry, setCustomCountry] = useState('')

  // Sync inputs with geolocationCoordinates if updated outside
  useEffect(() => {
    if (geolocationCoordinates) {
      const parts = geolocationCoordinates.split(',')
      if (parts.length === 2) {
        setCustomLat(parts[0])
        setCustomLng(parts[1])
      }
    } else {
      setCustomLat('')
      setCustomLng('')
    }
    if (geolocationCountry) {
      setCustomCountry(geolocationCountry)
    } else {
      setCustomCountry('')
    }
  }, [geolocationCoordinates, geolocationCountry])

  const applyCustomCoords = () => {
    const lat = parseFloat(customLat)
    const lng = parseFloat(customLng)
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Please enter valid numerical Latitude and Longitude values.')
      return
    }
    const coords = `${customLat.trim().replace(/\s+/g, '')},${customLng.trim().replace(/\s+/g, '')}`
    setField('geolocationCoordinates', coords)
    setField('geolocationCountry', customCountry.trim().toUpperCase())
    setGeoSearchQuery(coords)
    toast.success('Custom GPS coordinates applied successfully!')
  }

  const handleSearchQueryChange = (val: string) => {
    const clean = val.replace(/\s+/g, '')
    if (/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(clean)) {
      const parts = clean.split(',')
      if (parts.length === 2) {
        setCustomLat(parts[0])
        setCustomLng(parts[1])
        setShowCustomCoords(true)
        setGeoSearchQuery('')
        toast.success('Coordinates detected! Adjust settings and enter country code below.')
        return
      }
    }
    setGeoSearchQuery(val)
  }

  const handleLatChange = (val: string) => {
    if (val.includes(',')) {
      const parts = val.split(',')
      if (parts.length >= 2) {
        setCustomLat(parts[0].trim())
        setCustomLng(parts[1].trim())
        toast.success('Pasted coordinates automatically split!')
      }
    } else {
      setCustomLat(val)
    }
  }

  // Initialize geoSearchQuery to display city name if coordinates are pre-hydrated
  useEffect(() => {
    if (geolocationCoordinates) {
      const city = MAJOR_CITIES.find(
        (c) =>
          `${c.lat.toFixed(6)},${c.lng.toFixed(6)}` === geolocationCoordinates ||
          `${c.lat.toFixed(4)},${c.lng.toFixed(4)}` ===
          geolocationCoordinates.split(',').map((coord) => parseFloat(coord).toFixed(4)).join(',')
      )
      if (city) {
        setGeoSearchQuery(`${city.n}, ${city.c}`)
      } else if (!geoSearchQuery) {
        setGeoSearchQuery(geolocationCoordinates)
      }
    } else {
      setGeoSearchQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geolocationCoordinates])

  // Filter local cities
  useEffect(() => {
    const q = geoSearchQuery.trim().toLowerCase()
    if (!q || q.includes(',')) {
      setSuggestions([])
      return
    }
    const matches = MAJOR_CITIES.filter((city) => {
      const nameMatch = city.n.toLowerCase().includes(q)
      const countryMatch = city.c.toLowerCase() === q
      return nameMatch || countryMatch
    })
    setSuggestions(matches.slice(0, 5))
  }, [geoSearchQuery])

  const selectCity = (city: { n: string; c: string; lat: number; lng: number }) => {
    setField('geolocationCoordinates', `${city.lat.toFixed(6)},${city.lng.toFixed(6)}`)
    setField('geolocationCountry', city.c.toUpperCase())
    setGeoSearchQuery(`${city.n}, ${city.c}`)
    setSuggestions([])
  }

  const handleApiSearch = async () => {
    const query = geoSearchQuery.trim()
    if (!query) return

    // Clean whitespace to support pasted coords like "28.645352447455743, -91.84964181462405"
    const cleanQuery = query.replace(/\s+/g, '')
    if (/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(cleanQuery)) {
      const parts = cleanQuery.split(',')
      if (parts.length === 2) {
        setCustomLat(parts[0])
        setCustomLng(parts[1])
        setShowCustomCoords(true)
        setGeoSearchQuery('')
        toast.success('Coordinates detected! Adjust settings and enter country code below.')
        return
      }
    }

    setIsSearchingApi(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`
      )
      const data = await res.json()
      if (data && data.length > 0) {
        const result = data[0]
        const lat = parseFloat(result.lat)
        const lng = parseFloat(result.lon)
        const countryCode = (result.address?.country_code || '').toUpperCase()
        const displayName = result.display_name.split(',')[0]

        selectCity({ n: displayName, c: countryCode, lat, lng })
        toast.success(`Resolved location: ${displayName}, ${countryCode}`)
      } else {
        toast.error('Location not found via online search.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to search location.')
    } finally {
      setIsSearchingApi(false)
    }
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`
        setField('geolocationCoordinates', coords)
        setField('geolocationCountry', '')
        setGeoSearchQuery(coords)
        toast.success('Using browser GPS coordinates!')
      },
      () => toast.error('Could not retrieve current location.')
    )
  }

  const clearLocation = () => {
    setField('geolocationCoordinates', '')
    setField('geolocationCountry', '')
    setGeoSearchQuery('')
    setSuggestions([])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag Settings</CardTitle>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 px-3 text-xs"
          onClick={resetTagSettings}
          title="Reset Tag Settings entirely"
        >
          Reset
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label>Tag Type</Label>
            <Select value={tagType} onValueChange={(v) => setField('tagType', v as TagType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAG_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Parent Network ID *</Label>
            <ClearableInput
              value={parentNetwork}
              onChange={(e) => setField('parentNetwork', e.target.value)}
              onClear={() => setField('parentNetwork', '')}
              placeholder="e.g. 123"
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>MCM Child ID</Label>
            <ClearableInput
              value={childNetwork}
              onChange={(e) => setField('childNetwork', e.target.value)}
              onClear={() => setField('childNetwork', '')}
              placeholder="e.g. 456"
              className="font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label>Page URL <code>googletag.pubads().set('page_url')</code></Label>
          <ClearableInput
            value={pageUrl}
            onChange={(e) => setField('pageUrl', e.target.value)}
            onClear={() => setField('pageUrl', '')}
            placeholder="e.g. www.google.com"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label>Custom Targeting</Label>
          <ChipInput value={pageTargeting} onChange={(v) => setField('pageTargeting', v)} placeholder="Page Level Key Value, Type key=value" />
        </div>

        <div className="flex flex-col gap-1.5 relative">
          <Label className="flex items-center gap-1">
            <MapPin className="size-3.5 text-primary" />
            <span>Spoof Geolocation (GPS)</span>
          </Label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={geoSearchQuery}
                onChange={(e) => handleSearchQueryChange(e.target.value)}
                placeholder="Search Country or city (US, New York, UK) or enter coordinates"
                className="pr-8 text-xs font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleApiSearch()
                  }
                }}
              />
              {geoSearchQuery && (
                <button
                  type="button"
                  onClick={clearLocation}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-red-500 hover:bg-red-500/15 hover:text-red-600 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleApiSearch}
              disabled={isSearchingApi}
              title="Search location online"
              className="px-2.5 h-9"
            >
              <Search className="size-4" />
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={useCurrentLocation}
              title="Use current GPS location"
              className="px-2.5 h-9"
            >
              <Navigation className="size-4" />
            </Button>

            <Button
              type="button"
              size="sm"
              variant={showCustomCoords ? 'default' : 'outline'}
              onClick={() => setShowCustomCoords(!showCustomCoords)}
              title="Add Custom GPS Coordinates manually"
              className="px-2.5 h-9"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {/* Custom coordinates entry form */}
          {showCustomCoords && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/40 p-3 mt-1.5 text-xs animate-in fade-in duration-200">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Custom Coordinates</span>
                <button
                  type="button"
                  onClick={() => setShowCustomCoords(false)}
                  className="rounded-full p-0.5 text-red-500 hover:bg-red-500/15 hover:text-red-600 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium font-sans">Latitude</Label>
                  <ClearableInput
                    type="text"
                    placeholder="e.g. 40.7128"
                    value={customLat}
                    onChange={(e) => handleLatChange(e.target.value)}
                    onClear={() => handleLatChange('')}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium font-sans">Longitude</Label>
                  <ClearableInput
                    type="text"
                    placeholder="e.g. -74.006"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    onClear={() => setCustomLng('')}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium font-sans">Country Code</Label>
                  <ClearableInput
                    placeholder="e.g. US"
                    value={customCountry}
                    onChange={(e) => setCustomCountry(e.target.value)}
                    onClear={() => setCustomCountry('')}
                    className="h-8 text-xs uppercase font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-1">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={applyCustomCoords}
                  className="h-7 text-[11px] font-medium"
                >
                  Apply Coordinates
                </Button>
              </div>

              {/* Instructions on how to get coordinates */}
              <div className="rounded border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-muted-foreground leading-relaxed text-left">
                <strong className="text-foreground">Tip: Get coords from Google Maps</strong>
                <ol className="list-decimal pl-4 mt-1 space-y-1">
                  <li>
                    Open{' '}
                    <a
                      href="https://maps.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold"
                    >
                      Google Maps
                    </a>{' '}
                    and find your target location.
                  </li>
                  <li><strong>Right-click</strong> (desktop) or <strong>long-press</strong> (mobile) on the map.</li>
                  <li>The exact latitude/longitude will be shown at the top of the context menu.</li>
                  <li>Click on the coordinates to copy them to your clipboard.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Autocomplete suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-[60px] z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-[160px] overflow-y-auto">
              <ul className="py-1 text-xs">
                {suggestions.map((city, idx) => (
                  <li
                    key={idx}
                    onClick={() => selectCity(city)}
                    className="flex cursor-pointer items-center justify-between px-3 py-1.5 hover:bg-accent hover:text-accent-foreground text-left"
                  >
                    <span>
                      {city.n}, {city.c}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {city.lat.toFixed(3)}, {city.lng.toFixed(3)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Display active coordinates */}
          {geolocationCoordinates && (
            <div className="flex flex-wrap items-center gap-1 mt-1 px-2.5 py-1 text-[11px] font-mono rounded bg-primary/10 border border-primary/20 text-foreground">
              <span className="font-semibold text-primary">Active GPS:</span>
              <span>{geolocationCoordinates}</span>
              {geolocationCountry && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <span className="font-semibold text-primary">Country:</span>
                  <span>{geolocationCountry}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          <ToggleRow label="Single Request Architecture (SRA)" checked={isSRA} onCheckedChange={(v) => setField('isSingleRequestArchitectureEnabled', v)} />
          <ToggleRow label="Advanced Options" checked={advancedPanelOpen} onCheckedChange={setAdvancedPanelOpen} />
          <ToggleRow label="Size Mapping (Responsive Design)" checked={sizeMappingPanelOpen} onCheckedChange={setSizeMappingPanelOpen} />
          <ToggleRow label="Adx/AdSense Settings" checked={adsensePanelOpen} onCheckedChange={setAdsensePanelOpen} />
          <ToggleRow label="Video Tag (VAST)" checked={videoPanelOpen} onCheckedChange={setVideoPanelOpen} />
          <ToggleRow label="Consent Simulator & Prebid Setup" checked={diagnosticsPanelOpen} onCheckedChange={setDiagnosticsPanelOpen} />
          <ToggleRow label="Lazy Loading (Visualizer)" checked={lazyLoadPanelOpen} onCheckedChange={setLazyLoadPanelOpen} />
        </div>

        {/* Removed samples block */}
      </CardContent>
    </Card>
  )
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}
