import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { parseClientHints, formatDate, formatTimeDelta } from '../lib/parseAdTag'

export function EnvironmentPanel({ globalParameters }: { globalParameters: Record<string, string> }) {
  const screen = globalParameters.u_w && globalParameters.u_h ? `${globalParameters.u_w} × ${globalParameters.u_h}` : '-'
  const screenAvail =
    globalParameters.u_aw && globalParameters.u_ah ? `Avail: ${globalParameters.u_aw} × ${globalParameters.u_ah}` : 'Avail: -'
  const viewport = globalParameters.biw && globalParameters.bih ? `${globalParameters.biw} × ${globalParameters.bih}` : '-'
  const aspect =
    globalParameters.biw && globalParameters.bih
      ? `Aspect: ${(Number(globalParameters.biw) / Number(globalParameters.bih)).toFixed(2)}`
      : 'Aspect: -'
  const dpr = globalParameters.u_sd ? `${globalParameters.u_sd}x` : '-'
  const depth = globalParameters.u_cd ? `Color Depth: ${globalParameters.u_cd}-bit` : 'Color Depth: - bit'

  let timezone = '-'
  let timezoneDesc = 'Mins from UTC'
  if (globalParameters.u_tz) {
    const mins = Number(globalParameters.u_tz)
    const hours = Math.floor(Math.abs(mins) / 60)
    const remainder = Math.abs(mins) % 60
    const sign = mins <= 0 ? '+' : '-'
    timezone = `UTC${sign}${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    timezoneDesc = `${globalParameters.u_tz} min offset`
  }

  const clientHints = parseClientHints(globalParameters.uach)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Device / Viewport</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Screen Resolution" value={screen} sub={screenAvail} />
          <Stat label="Browser Viewport" value={viewport} sub={aspect} />
          <Stat label="Device Pixel Ratio" value={dpr} />
          <Stat label="Color" value={depth} />
          <Stat label="Timezone" value={timezone} sub={timezoneDesc} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client Hints (uach)</CardTitle>
          <span className="text-xs opacity-80">{clientHints ? 'Parsed' : globalParameters.uach ? 'Error' : 'Not Present'}</span>
        </CardHeader>
        <CardContent className="text-sm">
          {clientHints ? (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="OS" value={`${clientHints.platform} (${clientHints.platformVersion})`} />
              <Stat label="Arch" value={`${clientHints.architecture}${clientHints.bitness ? ` (${clientHints.bitness}-bit)` : ''}`} />
              <div className="col-span-2 flex flex-col gap-1">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Brands</span>
                <div className="flex flex-wrap gap-1.5">
                  {clientHints.brands.length
                    ? clientHints.brands.map(([b, v], i) => (
                        <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {b} {v}
                        </span>
                      ))
                    : 'None'}
                </div>
              </div>
              <Stat label="Device" value={clientHints.isMobile ? 'Mobile' : 'Desktop'} />
              <Stat label="Model" value={clientHints.model} />
            </div>
          ) : (
            <p className="text-muted-foreground italic">No Client Hints data present.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latency / Timing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="dt (Init)" value={globalParameters.dt ? formatDate(globalParameters.dt) : '-'} />
          <Stat label="dlt (Nav Start)" value={globalParameters.dlt ? formatDate(globalParameters.dlt) : '-'} />
          <Stat label="idt (Render)" value={globalParameters.idt ? `${globalParameters.idt} ms` : '-'} />
          <Stat
            label="Calculated Latency"
            value={
              globalParameters.dt && globalParameters.dlt
                ? formatTimeDelta(Number(globalParameters.dt) - Number(globalParameters.dlt))
                : '-'
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}
