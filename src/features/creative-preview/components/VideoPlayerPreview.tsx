import { useRef, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Volume2, VolumeX, Subtitles, Radio, ExternalLink, Activity } from 'lucide-react'
import { useCreativePreviewStore } from '../store'
import { cn } from '@/lib/utils'

export function VideoPlayerPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const macroSubstitutions = useCreativePreviewStore((s) => s.macroSubstitutions)
  const appendVideoEvent = useCreativePreviewStore((s) => s.appendVideoEvent)
  const videoEventsLog = useCreativePreviewStore((s) => s.videoEventsLog)
  const clearVideoEvents = useCreativePreviewStore((s) => s.clearVideoEvents)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [captionsActive, setCaptionsActive] = useState(false)
  const [audioDescActive, setAudioDescActive] = useState(false)

  // Track quartiles
  const quartilesRef = useRef<{ q1: boolean; q2: boolean; q3: boolean; complete: boolean }>({
    q1: false,
    q2: false,
    q3: false,
    complete: false,
  })

  // Resolve video URLs from macros or state
  const rawVideoUrl = macroSubstitutions['[%VideoUrl%]'] || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  const captionsUrl = macroSubstitutions['[%CaptionsUrl%]'] || ''
  const audioDescUrl = macroSubstitutions['[%AudioDescriptionsUrl%]'] || ''
  const videoId = macroSubstitutions['[%VideoId%]'] || 'vid_default'
  const clickThroughUrl = macroSubstitutions['[%ClickThroughUrl%]'] || 'https://example.com'

  const videoUrl = rawVideoUrl.startsWith('http') ? rawVideoUrl : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'

  useEffect(() => {
    // Reset quartiles when video URL changes
    quartilesRef.current = { q1: false, q2: false, q3: false, complete: false }
  }, [videoUrl])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch((err) => console.error('Video play error:', err))
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
    appendVideoEvent(isMuted ? 'UNMUTE' : 'MUTE', `Volume: ${isMuted ? '100%' : 'Muted'}`)
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
    }
    if (pct >= 50 && !quartilesRef.current.q2) {
      quartilesRef.current.q2 = true
      appendVideoEvent('MIDPOINT (50%)', `${cur.toFixed(1)}s / ${dur.toFixed(1)}s`)
    }
    if (pct >= 75 && !quartilesRef.current.q3) {
      quartilesRef.current.q3 = true
      appendVideoEvent('THIRD_QUARTILE (75%)', `${cur.toFixed(1)}s / ${dur.toFixed(1)}s`)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    if (!quartilesRef.current.complete) {
      quartilesRef.current.complete = true
      appendVideoEvent('COMPLETE (100%)', 'Video playback finished')
    }
  }

  const handlePlay = () => {
    setIsPlaying(true)
    appendVideoEvent('START / RESUME', `Video ID: ${videoId}`)
  }

  const handlePause = () => {
    setIsPlaying(false)
    appendVideoEvent('PAUSE', `Paused at ${currentTime.toFixed(1)}s`)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = val
      setCurrentTime(val)
      appendVideoEvent('SEEK', `Seeked to ${val.toFixed(1)}s`)
    }
  }

  const handleVideoClick = () => {
    appendVideoEvent('CLICK_THROUGH', `Landing: ${clickThroughUrl}`)
    window.open(clickThroughUrl, '_blank')
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <Card className="flex flex-col border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="py-2.5 px-4 bg-muted/30 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="size-4 text-rose-500" />
          <span>GAM Video Player &amp; VAST Event Monitor</span>
        </CardTitle>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono bg-rose-500/10 text-rose-400 border-rose-500/30">
            ID: {videoId}
          </Badge>
          <Button variant="ghost" size="sm" onClick={clearVideoEvents} className="h-6 px-2 text-[10px]">
            Clear Events
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex flex-col md:flex-row gap-4">
        {/* Left: Video Player Canvas */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center group">
            <video
              ref={videoRef}
              src={videoUrl}
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
              onChange={handleSeek}
              className="flex-1 accent-rose-500 h-1.5 bg-muted rounded-lg cursor-pointer"
            />

            <Button variant="ghost" size="icon-sm" onClick={toggleMute} className="size-7 shrink-0">
              {isMuted ? <VolumeX className="size-4 text-rose-400" /> : <Volume2 className="size-4" />}
            </Button>

            {captionsUrl && (
              <Button
                variant={captionsActive ? 'default' : 'ghost'}
                size="icon-sm"
                onClick={() => setCaptionsActive(!captionsActive)}
                className="size-7 shrink-0"
                title="Toggle Closed Captions ([%CaptionsUrl%])"
              >
                <Subtitles className="size-4" />
              </Button>
            )}

            {audioDescUrl && (
              <Button
                variant={audioDescActive ? 'default' : 'ghost'}
                size="icon-sm"
                onClick={() => setAudioDescActive(!audioDescActive)}
                className="size-7 shrink-0"
                title="Toggle Audio Descriptions ([%AudioDescriptionsUrl%])"
              >
                <Radio className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Right: Live Video Tracking Events Feed */}
        <div className="w-full md:w-72 flex flex-col gap-2 shrink-0 border rounded-lg p-3 bg-muted/10">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 pb-1 border-b">
            <span>VAST / Video Events</span>
            <span className="text-[10px] text-muted-foreground font-mono">{videoEventsLog.length} events</span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
            {videoEventsLog.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic py-4 text-center">
                Play video to trigger VAST tracking beacons (Start, 25%, 50%, 75%, Complete, Mute, Click)...
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
      </CardContent>
    </Card>
  )
}
