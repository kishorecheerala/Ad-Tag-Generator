import { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Play, Pause, Volume2, VolumeX, ExternalLink, Activity, Sparkles, Code2, Link2, RotateCcw } from 'lucide-react'
import { useCreativePreviewStore } from '../store'
import { ClearableInput } from '@/components/shared/ClearableInput'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function VideoPlayerPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const macroSubstitutions = useCreativePreviewStore((s) => s.macroSubstitutions)
  const appendVideoEvent = useCreativePreviewStore((s) => s.appendVideoEvent)
  const videoEventsLog = useCreativePreviewStore((s) => s.videoEventsLog)
  const clearVideoEvents = useCreativePreviewStore((s) => s.clearVideoEvents)

  const [inputMode, setInputMode] = useState<'url' | 'vast_xml'>('url')
  const [vastTagUrl, setVastTagUrl] = useState('')
  const [vastXmlContent, setVastXmlContent] = useState('')

  const [extractedMediaUrl, setExtractedMediaUrl] = useState('')
  const [extractedClickThrough, setExtractedClickThrough] = useState('')
  const [extractedTracking, setExtractedTracking] = useState<Record<string, string[]>>({})
  const [vastStatus, setVastStatus] = useState<string>('Standard MP4 Canvas')

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Track quartiles
  const quartilesRef = useRef<{ q1: boolean; q2: boolean; q3: boolean; complete: boolean }>({
    q1: false,
    q2: false,
    q3: false,
    complete: false,
  })

  // Default video URL fallbacks
  const rawVideoUrl = macroSubstitutions['[%VideoUrl%]'] || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  const defaultClickThrough = macroSubstitutions['[%ClickThroughUrl%]'] || 'https://example.com'

  const activeVideoUrl = extractedMediaUrl || (rawVideoUrl.startsWith('http') ? rawVideoUrl : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4')
  const activeClickThrough = extractedClickThrough || defaultClickThrough

  // Helper to ping tracking beacons
  const pingTrackingBeacon = (eventKey: string, urls?: string[]) => {
    if (!urls || urls.length === 0) return
    urls.forEach((u) => {
      if (u && u.startsWith('http')) {
        fetch(u, { mode: 'no-cors', cache: 'no-cache' }).catch(() => {})
        appendVideoEvent(`BEACON_PING [${eventKey}]`, u)
      }
    })
  }

  // Parse VAST XML string
  const parseVastXml = (xmlStr: string) => {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlStr, 'text/xml')

      // MediaFile
      const mediaFileEls = xmlDoc.getElementsByTagName('MediaFile')
      let mediaSrc = ''
      for (let i = 0; i < mediaFileEls.length; i++) {
        const src = mediaFileEls[i].textContent?.trim()
        if (src) {
          mediaSrc = src
          break
        }
      }

      // ClickThrough
      const clickEls = xmlDoc.getElementsByTagName('ClickThrough')
      const clickUrl = clickEls.length > 0 ? clickEls[0].textContent?.trim() || '' : ''

      // Impressions
      const impEls = xmlDoc.getElementsByTagName('Impression')
      const imps: string[] = []
      for (let i = 0; i < impEls.length; i++) {
        const u = impEls[i].textContent?.trim()
        if (u) imps.push(u)
      }

      // Tracking events
      const trackEls = xmlDoc.getElementsByTagName('Tracking')
      const trackingMap: Record<string, string[]> = {}
      for (let i = 0; i < trackEls.length; i++) {
        const eventName = trackEls[i].getAttribute('event') || 'unknown'
        const u = trackEls[i].textContent?.trim()
        if (u) {
          if (!trackingMap[eventName]) trackingMap[eventName] = []
          trackingMap[eventName].push(u)
        }
      }

      if (mediaSrc) setExtractedMediaUrl(mediaSrc)
      if (clickUrl) setExtractedClickThrough(clickUrl)
      setExtractedTracking(trackingMap)
      setVastStatus(`VAST XML Parsed (${imps.length} imps, ${Object.keys(trackingMap).length} event types)`)

      toast.success('Successfully parsed VAST XML payload!')
      if (imps.length > 0) {
        pingTrackingBeacon('IMPRESSION', imps)
      }
    } catch {
      toast.error('Failed to parse VAST XML. Ensure valid XML structure.')
    }
  }

  // Fetch VAST Ad Tag URL
  const handleFetchVastTag = async () => {
    if (!vastTagUrl.trim()) {
      toast.error('Please enter a valid VAST Ad Tag URL.')
      return
    }

    try {
      toast.info('Fetching VAST Ad Tag...')
      const res = await fetch(vastTagUrl.trim())
      const text = await res.text()
      setVastXmlContent(text)
      parseVastXml(text)
    } catch {
      toast.error('Could not fetch VAST URL directly due to CORS. Processing URL as direct media file...')
      setExtractedMediaUrl(vastTagUrl.trim())
      setVastStatus('Direct Video URL Target')
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const cur = videoRef.current.currentTime
    const dur = videoRef.current.duration || 1
    setCurrentTime(cur)
    setDuration(dur)

    const pct = (cur / dur) * 100

    if (pct >= 25 && !quartilesRef.current.q1) {
      quartilesRef.current.q1 = true
      appendVideoEvent('FIRST_QUARTILE (25%)', `${cur.toFixed(1)}s / ${dur.toFixed(1)}s`)
      pingTrackingBeacon('firstQuartile', extractedTracking['firstQuartile'])
    }
    if (pct >= 50 && !quartilesRef.current.q2) {
      quartilesRef.current.q2 = true
      appendVideoEvent('MIDPOINT (50%)', `${cur.toFixed(1)}s / ${dur.toFixed(1)}s`)
      pingTrackingBeacon('midpoint', extractedTracking['midpoint'])
    }
    if (pct >= 75 && !quartilesRef.current.q3) {
      quartilesRef.current.q3 = true
      appendVideoEvent('THIRD_QUARTILE (75%)', `${cur.toFixed(1)}s / ${dur.toFixed(1)}s`)
      pingTrackingBeacon('thirdQuartile', extractedTracking['thirdQuartile'])
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    if (!quartilesRef.current.complete) {
      quartilesRef.current.complete = true
      appendVideoEvent('COMPLETE (100%)', 'Video playback finished')
      pingTrackingBeacon('complete', extractedTracking['complete'])
    }
  }

  const handlePlay = () => {
    setIsPlaying(true)
    appendVideoEvent('START / RESUME', `Media: ${activeVideoUrl.substring(0, 30)}...`)
    pingTrackingBeacon('start', extractedTracking['start'])
  }

  const handlePause = () => {
    setIsPlaying(false)
    appendVideoEvent('PAUSE', `Paused at ${currentTime.toFixed(1)}s`)
    pingTrackingBeacon('pause', extractedTracking['pause'])
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(() => {})
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
    appendVideoEvent(isMuted ? 'UNMUTE' : 'MUTE', `Volume: ${isMuted ? '100%' : 'Muted'}`)
    pingTrackingBeacon(isMuted ? 'unmute' : 'mute', extractedTracking[isMuted ? 'unmute' : 'mute'])
  }

  const handleVideoClick = () => {
    appendVideoEvent('CLICK_THROUGH', `Landing: ${activeClickThrough}`)
    pingTrackingBeacon('click', extractedTracking['click'])
    window.open(activeClickThrough, '_blank')
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleClearVast = () => {
    setVastTagUrl('')
    setVastXmlContent('')
    setExtractedMediaUrl('')
    setExtractedClickThrough('')
    setExtractedTracking({})
    setVastStatus('Standard MP4 Canvas')
    clearVideoEvents()
    toast.success('Cleared VAST configuration!')
  }

  return (
    <Card className="flex flex-col border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="py-2.5 px-4 bg-muted/30 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="size-4 text-rose-500" />
          <span>GAM Video Creative &amp; VAST Ad Tag Receiver</span>
        </CardTitle>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono bg-rose-500/10 text-rose-400 border-rose-500/30">
            {vastStatus}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleClearVast} className="h-6 px-2 text-[10px] gap-1">
            <RotateCcw className="size-3" />
            <span>Reset VAST</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-4">
        {/* VAST Ad Tag URL & XML Input Control */}
        <div className="flex flex-col gap-2 border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Link2 className="size-3.5 text-rose-500" />
              <span>VAST Ad Tag URL / Response Input</span>
            </Label>
            <div className="flex items-center gap-1.5">
              <Button
                variant={inputMode === 'url' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setInputMode('url')}
                className="h-6 px-2 text-[10px] gap-1"
              >
                <Link2 className="size-3" />
                <span>VAST Tag URL</span>
              </Button>
              <Button
                variant={inputMode === 'vast_xml' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setInputMode('vast_xml')}
                className="h-6 px-2 text-[10px] gap-1"
              >
                <Code2 className="size-3" />
                <span>VAST XML Payload</span>
              </Button>
            </div>
          </div>

          {inputMode === 'url' ? (
            <div className="flex items-center gap-2">
              <ClearableInput
                value={vastTagUrl}
                onChange={(e) => setVastTagUrl(e.target.value)}
                onClear={() => setVastTagUrl('')}
                placeholder="https://pubads.g.doubleclick.net/gampad/ads?iu=...&output=vast..."
                className="h-8 text-xs font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchVastTag}
                className="h-8 px-3 text-xs shrink-0 gap-1 border-rose-500/40 text-rose-500 hover:bg-rose-500/10 font-semibold"
              >
                <Sparkles className="size-3" />
                <span>Fetch &amp; Parse VAST Tag</span>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Textarea
                value={vastXmlContent}
                onChange={(e) => setVastXmlContent(e.target.value)}
                placeholder="<VAST version='4.0'><Ad><InLine><MediaFiles><MediaFile>https://...</MediaFile></MediaFiles></InLine></Ad></VAST>"
                className="h-24 text-xs font-mono bg-background"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVastXmlContent('')}
                  className="h-7 text-xs"
                >
                  Clear XML
                </Button>
                <Button
                  size="sm"
                  onClick={() => parseVastXml(vastXmlContent)}
                  className="h-7 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                >
                  Parse VAST XML
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Video Canvas & Event Monitor */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Left: Video Player Canvas */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center group border border-zinc-800 shadow-inner">
              <video
                ref={videoRef}
                src={activeVideoUrl}
                muted={isMuted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onPlay={handlePlay}
                onPause={handlePause}
                className="w-full h-full object-contain cursor-pointer"
                onClick={handleVideoClick}
              />

              {/* Click overlay badge */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-[11px] gap-1 bg-black/70 hover:bg-black text-white backdrop-blur"
                  onClick={handleVideoClick}
                >
                  <ExternalLink className="size-3" />
                  <span>Visit Landing</span>
                </Button>
              </div>

              {/* Overlay play button when paused */}
              {!isPlaying && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors group/play"
                >
                  <div className="size-14 rounded-full bg-rose-600/90 text-white flex items-center justify-center pl-1 shadow-lg transform group-hover/play:scale-110 transition-transform">
                    <Play className="size-7 fill-white" />
                  </div>
                </button>
              )}
            </div>

            {/* Controls Bar */}
            <div className="flex items-center gap-3 bg-muted/40 border rounded-lg p-2 text-xs">
              <Button variant="ghost" size="icon-sm" onClick={togglePlay} className="size-7 shrink-0">
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
              </Button>

              <span className="font-mono text-[11px] shrink-0 text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (videoRef.current) videoRef.current.currentTime = val
                  setCurrentTime(val)
                }}
                className="flex-1 accent-rose-500 h-1.5 bg-muted rounded-lg cursor-pointer"
              />

              <Button variant="ghost" size="icon-sm" onClick={toggleMute} className="size-7 shrink-0">
                {isMuted ? <VolumeX className="size-4 text-rose-400" /> : <Volume2 className="size-4" />}
              </Button>
            </div>
          </div>

          {/* Right: Live Video Tracking Events Feed */}
          <div className="w-full md:w-80 flex flex-col gap-2 shrink-0 border rounded-lg p-3 bg-muted/10">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 pb-1 border-b">
              <span>VAST / Video Events &amp; Beacons</span>
              <span className="text-[10px] text-muted-foreground font-mono">{videoEventsLog.length} events</span>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
              {videoEventsLog.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic py-4 text-center">
                  Play video or fetch VAST tag to trigger tracking beacons (Start, 25%, 50%, 75%, Complete, Mute, Click)...
                </div>
              ) : (
                videoEventsLog.map((log, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex flex-col gap-0.5 border rounded p-1.5 text-[11px] font-mono transition-all',
                      log.event.includes('COMPLETE') && 'bg-green-500/10 border-green-500/30 text-green-400',
                      log.event.includes('QUARTILE') && 'bg-purple-500/10 border-purple-500/30 text-purple-300',
                      log.event.includes('START') && 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                      log.event.includes('CLICK') && 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                      log.event.includes('BEACON') && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
                      log.event.includes('MUTE') && 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    )}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{log.event}</span>
                      <span className="text-[9px] opacity-70">{log.time}</span>
                    </div>
                    {log.detail && <div className="text-[10px] opacity-80 truncate">{log.detail}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
