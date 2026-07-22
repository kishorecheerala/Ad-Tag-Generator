import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import {
  type TcfGppDecodeResult,
  type GvlVendor,
  parseTcfGppString,
  fetchGvlVendorList,
  getGvlCache,
  SPECIAL_PURPOSE_NAMES,
  FEATURE_NAMES
} from '../lib/tcfGppParser'
import { toast } from 'sonner'
import { Check, Copy, FileCode, Search, ShieldCheck, Layers, ExternalLink, Globe, Sparkles, Building2, Lock, Cpu, Info } from 'lucide-react'
import { ClearableInput } from '../../../components/shared/ClearableInput'

interface TcfGppDecoderCardProps {
  initialInput?: string
  extractedFromTag?: string
}

export const TcfGppDecoderCard: React.FC<TcfGppDecoderCardProps> = ({ initialInput = '', extractedFromTag }) => {
  const [tcfInput, setTcfInput] = useState(initialInput)

  // Initialize state synchronously from in-memory or localStorage cache
  const initialGvl = getGvlCache()
  const [gvlMap, setGvlMap] = useState<Record<number, GvlVendor> | null>(initialGvl)
  const [isGvlLoading, setIsGvlLoading] = useState<boolean>(!initialGvl)
  const [gvlVendorCount, setGvlVendorCount] = useState<number | null>(initialGvl ? Object.keys(initialGvl).length : null)
  const [decodedResult, setDecodedResult] = useState<TcfGppDecodeResult | null>(null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Fetch live GVL JSON on component mount if not already cached
  useEffect(() => {
    if (gvlMap) return;

    let mounted = true;
    setIsGvlLoading(true);
    fetchGvlVendorList().then((map) => {
      if (mounted) {
        setGvlMap(map);
        setGvlVendorCount(Object.keys(map).length);
        setIsGvlLoading(false);
      }
    }).catch(() => {
      if (mounted) setIsGvlLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const handleDecode = (customString?: string) => {
    const stringToDecode = (customString !== undefined ? customString : tcfInput).trim()
    if (!stringToDecode) {
      toast.error('Please enter a TCF or GPP consent string.')
      return
    }

    try {
      const result = parseTcfGppString(stringToDecode, gvlMap || undefined)
      setDecodedResult(result)
      toast.success(result.isGpp ? 'GPP consent string decoded!' : 'TCF consent string decoded!')
    } catch (err: any) {
      setDecodedResult(null)
      toast.error(err.message || 'Failed to decode consent string.')
    }
  }

  // Re-decode whenever GVL map finishes fetching
  useEffect(() => {
    if (tcfInput.trim()) {
      try {
        const result = parseTcfGppString(tcfInput.trim(), gvlMap || undefined);
        setDecodedResult(result);
      } catch {
        // ignore
      }
    }
  }, [gvlMap]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(label)
    toast.success(`Copied ${label} to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const [vendorStatusFilter, setVendorStatusFilter] = useState<'all' | 'consented' | 'legInt'>('all')

  const vendorListToDisplay = decodedResult?.allVendors && decodedResult.allVendors.length > 0
    ? decodedResult.allVendors
    : (decodedResult?.consentedVendors || [])

  const filteredVendors = vendorListToDisplay.filter((v) => {
    if (vendorStatusFilter === 'consented' && !v.hasConsent) return false;
    if (vendorStatusFilter === 'legInt' && !v.hasLegInt) return false;
    if (!vendorSearch.trim()) return true;
    const query = vendorSearch.trim().toLowerCase();
    return v.id.toString().includes(query) || v.name.toLowerCase().includes(query);
  });

  return (
    <Card className="border shadow-sm bg-card text-card-foreground">
      <CardHeader className="py-4 bg-muted/40 border-b text-foreground">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">IAB TCF v2.2 & GPP Full Specification Decoder</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isGvlLoading ? (
              <Badge variant="outline" className="text-xs animate-pulse text-muted-foreground">
                Fetching IAB GVL...
              </Badge>
            ) : gvlVendorCount ? (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold">
                <Globe className="w-3.5 h-3.5 mr-1.5" />
                GVL Synced ({gvlVendorCount} Vendors)
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 flex flex-col gap-6">
        {/* Input Controls */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <ClearableInput
                value={tcfInput}
                onChange={(e) => setTcfInput(e.target.value)}
                onClear={() => setTcfInput('')}
                placeholder="Paste TCF consent string (e.g. CQhw_6Q...) or GPP string (e.g. DBABMA~CQhw...)"
                className="font-mono text-xs sm:text-sm text-foreground bg-background"
              />
            </div>
            <Button onClick={() => handleDecode()} className="gap-1 px-5 font-semibold">
              Decode
            </Button>
          </div>

          {extractedFromTag ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 text-xs shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-foreground flex items-center gap-2">
                    <span>Auto-Detected TCF/GPP String from Active Ad Tag</span>
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-[10px] uppercase font-mono">
                      Ready
                    </Badge>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground truncate max-w-md mt-0.5">
                    {extractedFromTag}
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm px-4 shrink-0"
                onClick={() => {
                  setTcfInput(extractedFromTag)
                  handleDecode(extractedFromTag)
                }}
              >
                <FileCode className="w-4 h-4" />
                Load &amp; Decode From Ad Tag
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-foreground">No TCF / GPP String Auto-Detected</div>
                <p>
                  Please paste the <b>Ad Tag URL</b> in the <b>Tag Inspector</b>tab and Click on <b>Decode</b> to auto-detect the TCF String, or you can paste it manually above by copying the <code className="font-mono text-primary font-bold">gdpr_consent</code> or GPP string.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SINGLE PAGE DASHBOARD */}
        {decodedResult && (
          <div className="flex flex-col gap-6">

            {/* SECTION 1: GPP Privacy Header */}
            {decodedResult.isGpp && decodedResult.gppHeader && (
              <div className="p-4 border rounded-xl bg-sky-500/10 border-sky-500/30 text-xs sm:text-sm flex flex-col gap-2">
                <div className="flex items-center justify-between font-bold text-sky-600 dark:text-sky-300 text-sm sm:text-base">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Global Privacy Platform (GPP) Header
                  </span>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    Version {decodedResult.gppHeader.version}
                  </Badge>
                </div>
                <div className="text-foreground flex flex-wrap gap-2 items-center mt-1">
                  <span className="font-semibold text-xs text-muted-foreground">Active Privacy Frameworks:</span>
                  {decodedResult.gppHeader.sectionNames.map((name, idx) => (
                    <Badge key={idx} className="bg-sky-600/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-xs font-semibold px-2.5 py-0.5">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AD SERVING & PERSONALIZATION VERDICT BANNER */}
            <div
              className={`p-4 border rounded-xl flex flex-col gap-3.5 ${decodedResult.adVerdict.variant === 'emerald'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : decodedResult.adVerdict.variant === 'amber'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : decodedResult.adVerdict.variant === 'orange'
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-rose-500/10 border-rose-500/30'
                }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-foreground">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <span>Ad Personalization Verdict:</span>
                  <span className="text-primary">{decodedResult.adVerdict.title}</span>
                </div>
                <Badge
                  className={`text-xs font-bold px-3 py-1 ${decodedResult.adVerdict.variant === 'emerald'
                      ? 'bg-emerald-600 text-white'
                      : decodedResult.adVerdict.variant === 'amber'
                        ? 'bg-amber-600 text-white'
                        : decodedResult.adVerdict.variant === 'orange'
                          ? 'bg-orange-600 text-white'
                          : 'bg-rose-600 text-white'
                    }`}
                >
                  {decodedResult.adVerdict.badgeText}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-background/60 border flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">P1 Device Access:</span>
                  <span className={`font-bold ${decodedResult.adVerdict.purposeOneGranted ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {decodedResult.adVerdict.purposeOneGranted ? 'GRANTED' : 'DENIED'}
                  </span>
                </div>
                <div className="p-2 rounded bg-background/60 border flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">P2 Basic Ad Delivery:</span>
                  <span className={`font-bold ${decodedResult.adVerdict.purposeTwoGranted ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {decodedResult.adVerdict.purposeTwoGranted ? 'GRANTED' : 'DENIED'}
                  </span>
                </div>
                <div className="p-2 rounded bg-background/60 border flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">P3 Create Profiles:</span>
                  <span className={`font-bold ${decodedResult.adVerdict.purposeThreeGranted ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {decodedResult.adVerdict.purposeThreeGranted ? 'GRANTED' : 'DENIED'}
                  </span>
                </div>
                <div className="p-2 rounded bg-background/60 border flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">P4 Select Personalized:</span>
                  <span className={`font-bold ${decodedResult.adVerdict.purposeFourGranted ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {decodedResult.adVerdict.purposeFourGranted ? 'GRANTED' : 'DENIED'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-foreground bg-background/80 p-3 rounded-lg border leading-relaxed">
                <strong className="text-primary font-bold">Ad Server Rule Rationale:</strong> {decodedResult.adVerdict.reasoning}
              </div>
            </div>

            {/* SECTION 2: Core General Metadata Grid */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-primary">1. TCF Core Metadata Overview</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/30 border border-border rounded-xl p-4 text-xs">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">TCF Version</div>
                  <div className="text-base font-bold font-mono text-foreground">v{decodedResult.version}.0</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">CMP Provider Name</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {decodedResult.cmpName} <span className="text-xs font-medium text-foreground font-mono">(ID {decodedResult.cmpId}, v{decodedResult.cmpVersion})</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Language / Country</div>
                  <div className="text-base font-bold font-mono text-foreground">{decodedResult.consentLanguage} ({decodedResult.publisherCountryCode})</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">GVL / Policy Version</div>
                  <div className="text-base font-bold font-mono text-foreground">GVL v{decodedResult.vendorListVersion} (Policy v{decodedResult.tcfPolicyVersion})</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Created Date (UTC)</div>
                  <div className="text-xs font-mono font-medium text-foreground">{decodedResult.createdDate}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Last Updated (UTC)</div>
                  <div className="text-xs font-mono font-medium text-foreground">{decodedResult.updatedDate}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Purpose 1 Device Access</div>
                  <div className="text-base font-bold font-mono">
                    {decodedResult.adVerdict.purposeOneGranted ? (
                      <span className="text-emerald-600 dark:text-emerald-400">GRANTED</span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400">DENIED</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Consented Vendors Count</div>
                  <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {decodedResult.consentedVendorIds.length} Consented
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Special Features Opt-in Status */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-primary">2. Special Features Opt-in Status</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {decodedResult.specialFeatures.map((sf) => (
                  <div key={sf.id} className="border border-border rounded-xl p-3.5 bg-muted/20 flex items-center justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-foreground">{sf.name}</div>
                      <div className="text-xs text-muted-foreground">{sf.description}</div>
                    </div>
                    <Badge
                      className={
                        sf.optedIn
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold px-2.5 py-0.5'
                          : 'bg-muted text-muted-foreground border border-border text-xs font-medium px-2.5 py-0.5'
                      }
                    >
                      {sf.optedIn ? 'OPTED IN' : 'OPTED OUT'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4: Special Purposes & Features Standard Declarations */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-primary">3. IAB Special Purposes & Features Framework</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="border border-border rounded-xl p-3.5 bg-muted/20 flex flex-col gap-1.5">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" /> Special Purposes (Required for Operations)
                  </div>
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <div><strong className="text-foreground">SP1:</strong> {SPECIAL_PURPOSE_NAMES[1]}</div>
                    <div><strong className="text-foreground">SP2:</strong> {SPECIAL_PURPOSE_NAMES[2]}</div>
                  </div>
                </div>
                <div className="border border-border rounded-xl p-3.5 bg-muted/20 flex flex-col gap-1.5">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-primary" /> Features (Standard Data Processing)
                  </div>
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <div><strong className="text-foreground">F1:</strong> {FEATURE_NAMES[1]}</div>
                    <div><strong className="text-foreground">F2:</strong> {FEATURE_NAMES[2]}</div>
                    <div><strong className="text-foreground">F3:</strong> {FEATURE_NAMES[3]}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: Purposes & Legitimate Interest Audit Table */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-primary">4. Purposes 1–11 User Consent Audit (Segment 1)</div>
                <span className="text-xs text-muted-foreground">User CMP Selection choices</span>
              </div>
              <Card className="border border-border overflow-hidden">
                <CardHeader className="py-3 bg-muted/50 border-b border-border text-foreground flex flex-row items-center justify-between">
                  <CardTitle className="text-sm sm:text-base font-bold text-foreground">User Consent Choices (Segment 1)</CardTitle>
                  <Badge variant="outline" className="text-xs font-semibold text-foreground border-border">
                    TCF v2.2 Standard
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-3 bg-muted/20 border-b border-border text-xs text-muted-foreground leading-relaxed flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>
                      <strong>Note:</strong> This table reflects the <strong>end-user&apos;s explicit consent selections</strong> made in the CMP banner (Segment 1). In this string, the user consented to Purposes 1–7 and opted out of Purposes 8–11.
                    </span>
                  </div>
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-muted/70 text-foreground uppercase text-xs font-bold border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left w-16">ID</th>
                        <th className="px-4 py-3 text-left">Purpose Name & Description</th>
                        <th className="px-4 py-3 text-center w-32">Consent Status</th>
                        <th className="px-4 py-3 text-center w-36">Legitimate Interest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {decodedResult.purposes.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono font-bold text-xs text-foreground">P-{p.id}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                          <td className="px-4 py-3 text-center">
                            {p.consent ? (
                              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold px-2.5 py-0.5">
                                GRANTED
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-bold px-2.5 py-0.5">
                                DENIED
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.legitimateInterest ? (
                              <Badge className="bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-xs font-bold px-2.5 py-0.5">
                                ACTIVE
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-border text-xs font-medium px-2.5 py-0.5">
                                INACTIVE
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* SECTION 6: Publisher Segment Data */}
            {decodedResult.publisherSegmentData && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-primary">5. Publisher Segment Data (OOB / Segment 2 Overrides)</div>
                <div className="p-4 border border-border rounded-xl bg-muted/20 text-xs flex flex-col gap-3">
                  <div className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" /> Publisher First-Party Purpose Declarations (Segment 2)
                  </div>
                  <div className="text-muted-foreground leading-relaxed">
                    <strong>Why is this different from Section 4?</strong> Section 4 shows 3rd-party vendor consent choices selected by the end-user. Section 5 displays the <strong>Publisher Segment (Segment Type 3 / OOB segment)</strong>, which encodes the publisher&apos;s own first-party legal processing capabilities for on-site features.
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center mt-1">
                    {decodedResult.publisherSegmentData.publisherPurposesConsent.map((pId) => (
                      <Badge key={pId} className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                        Publisher P{pId} Granted
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 6: Full Vendor Consents & Legitimate Interest Audit Table */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">
                    6. Vendor Consents &amp; Legitimate Interest Audit ({decodedResult.consentedVendors.length} Consented / {vendorListToDisplay.length} Evaluated)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Complete breakdown of 3rd-party CMPs, DSPs, SSPs &amp; ad-tech vendors with GRANTED (true) vs DENIED (false) consent statuses.
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5"
                    onClick={() =>
                      copyToClipboard(
                        vendorListToDisplay.map((v) => `[${v.id}] ${v.name}: ${v.hasConsent ? 'true' : 'false'}`).join('\n'),
                        'Full Vendor Audit'
                      )
                    }
                  >
                    {copiedField === 'Full Vendor Audit' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Audit List
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5"
                    onClick={() =>
                      copyToClipboard(
                        decodedResult.consentedVendors.map((v) => `[${v.id}] ${v.name}`).join('\n'),
                        'Consented Names'
                      )
                    }
                  >
                    {copiedField === 'Consented Names' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Consented
                  </Button>
                </div>
              </div>

              {/* Vendor Filter & Status Toggles */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-muted/30 border border-border rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setVendorStatusFilter('all')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${vendorStatusFilter === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                      }`}
                  >
                    All Evaluated ({vendorListToDisplay.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVendorStatusFilter('consented')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${vendorStatusFilter === 'consented'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                      }`}
                  >
                    Consented Only ({decodedResult.consentedVendors.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVendorStatusFilter('legInt')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${vendorStatusFilter === 'legInt'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                      }`}
                  >
                    Legitimate Interest ({decodedResult.legitimateInterestVendors.length})
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    placeholder="Search vendor name or ID..."
                    className="h-8 text-xs font-medium text-foreground bg-background"
                  />
                  {vendorSearch && (
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs font-semibold" onClick={() => setVendorSearch('')}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <Card className="border border-border overflow-hidden">
                <CardContent className="p-0 max-h-96 overflow-y-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="sticky top-0 bg-muted/95 backdrop-blur text-foreground uppercase text-xs font-bold border-b border-border z-10">
                      <tr>
                        <th className="px-4 py-3 text-left w-24">ID</th>
                        <th className="px-4 py-3 text-left">Vendor Name</th>
                        <th className="px-4 py-3 text-center w-36">Consent Status</th>
                        <th className="px-4 py-3 text-center w-36">Legitimate Interest</th>
                        <th className="px-4 py-3 text-left w-36">Purposes</th>
                        <th className="px-4 py-3 text-center w-24">Policy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredVendors.length > 0 ? (
                        filteredVendors.map((v) => (
                          <tr key={v.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-mono font-bold text-xs text-foreground">[{v.id}]</td>
                            <td className="px-4 py-3 font-bold text-foreground">{v.name}</td>
                            <td className="px-4 py-3 text-center font-mono">
                              {v.hasConsent ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold text-[11px]">
                                  GRANTED (true)
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/70 font-semibold text-xs">DENIED (false)</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-mono">
                              {v.hasLegInt ? (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-bold text-[11px]">
                                  ACTIVE (true)
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/70 font-semibold text-xs">INACTIVE (false)</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-xs text-muted-foreground">
                              {v.purposes && v.purposes.length > 0
                                ? v.purposes.map((p) => `P${p}`).join(', ')
                                : 'P1–P11 (All)'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {v.policyUrl ? (
                                <a
                                  href={v.policyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary font-semibold hover:underline text-xs"
                                >
                                  Link <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-xs">N/A</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-xs font-medium text-center text-muted-foreground py-8">
                            No matching vendors found for &quot;{vendorSearch}&quot;.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* SECTION 8: Disclosed Vendors WITH NAMES */}
            {decodedResult.disclosedVendors.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-primary">
                  7. Disclosed Vendors (Segment 2 - {decodedResult.disclosedVendors.length} Disclosed)
                </div>
                <Card className="border border-border overflow-hidden">
                  <CardContent className="p-0 max-h-64 overflow-y-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="sticky top-0 bg-muted/95 backdrop-blur text-foreground uppercase text-xs font-bold border-b border-border z-10">
                        <tr>
                          <th className="px-4 py-3 text-left w-24">Vendor ID</th>
                          <th className="px-4 py-3 text-left">Vendor Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {decodedResult.disclosedVendors.map((v) => (
                          <tr key={v.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-mono font-bold text-xs text-foreground">ID {v.id}</td>
                            <td className="px-4 py-3 font-bold text-foreground">{v.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* SECTION 9: Publisher Restrictions WITH NAMES */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-primary">
                8. Publisher Restrictions ({decodedResult.publisherRestrictions.length} Rules)
              </div>
              <Card className="border border-border overflow-hidden">
                <CardContent className="p-0">
                  {decodedResult.publisherRestrictions.length > 0 ? (
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-muted/70 text-foreground uppercase text-xs font-bold border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left w-24">Purpose ID</th>
                          <th className="px-4 py-3 text-left">Restriction Type</th>
                          <th className="px-4 py-3 text-left">Affected Vendors (Names & IDs)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {decodedResult.publisherRestrictions.map((r, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-mono font-bold text-xs text-foreground">P-{r.purposeId}</td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary" className="text-xs font-bold">
                                {r.restrictionTypeName}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                              {r.vendors && r.vendors.length > 0
                                ? r.vendors.map((v) => `[${v.id}] ${v.name}`).join(', ')
                                : 'All Vendors'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-xs font-medium text-center text-muted-foreground py-6">
                      No publisher restrictions defined in this consent string.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* SECTION 10: Sub-Segments & Raw Strings */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-primary">
                9. Sub-Segments & Raw String Breakdown ({decodedResult.subSegments.length} Segments)
              </div>
              <div className="flex flex-col gap-3">
                {decodedResult.subSegments.map((seg, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-3.5 border border-border rounded-xl bg-muted/20 text-xs">
                    <div className="flex items-center justify-between font-bold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-primary" />
                        Segment {idx + 1}: {seg.typeName}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs font-semibold px-2.5 gap-1 hover:bg-muted"
                        onClick={() => copyToClipboard(seg.rawString, `Segment ${idx + 1}`)}
                      >
                        {copiedField === `Segment ${idx + 1}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copy Raw
                      </Button>
                    </div>
                    <div className="font-mono text-xs break-all bg-background text-foreground p-3 rounded-lg border border-border">
                      {seg.rawString}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  )
}
