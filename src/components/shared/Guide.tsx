import React, { useState } from 'react'
import {
  HelpCircle,
  BookOpen,
  Settings,
  Smartphone,
  MapPin,
  Activity,
  Code,
  Terminal,
  Info,
  Lightbulb,
  FileText
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type SectionId = 'overview' | 'generator' | 'responsive' | 'gps' | 'decoder' | 'creative' | 'faq'

interface NavItem {
  id: SectionId
  title: string
  icon: React.ComponentType<{ className?: string }>
}

export function Guide() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview')

  const navItems: NavItem[] = [
    { id: 'overview', title: 'Overview & Getting Started', icon: BookOpen },
    { id: 'generator', title: 'Ad Tag Generator', icon: Settings },
    { id: 'responsive', title: 'Size Mapping (Responsive)', icon: Smartphone },
    { id: 'gps', title: 'GPS Spoofing & Diagnostics', icon: MapPin },
    { id: 'decoder', title: 'Ad Tag Decoder & VAST', icon: Activity },
    { id: 'creative', title: 'Creative Preview Sandbox', icon: Code },
    { id: 'faq', title: 'Troubleshooting & FAQ', icon: Terminal },
  ]

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <BookOpen className="size-5" />
              <h3 className="text-lg font-semibold text-foreground">Overview</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Welcome to the <strong>Ad Manager Tag Generator &amp; MCM Tester</strong> documentation. This tool is a
              developer companion suite designed to simplify the configuration, validation, decoding, and staging of
              Google Publisher Tags (GPT), MCM setups, and VAST XML tags.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 mt-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Interactive Tag Generation</h4>
                <p className="text-xs text-muted-foreground">
                  Build multi-size ad slots with parent-child MCM relationships, custom targeting keys, SRA, and lazy loading configuration.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Live Sandbox Testing</h4>
                <p className="text-xs text-muted-foreground">
                  Instantly load ad slots inside an isolated sandbox iframe or a top-level staging window to bypass cross-origin browser constraints.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Request Decoding &amp; VAST</h4>
                <p className="text-xs text-muted-foreground">
                  Paste raw GPT or VAST request URLs to parse and isolate targeting key-values, sizes, and launch testing block frames.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Creative Sandbox</h4>
                <p className="text-xs text-muted-foreground">
                  Write HTML, CSS, and JS snippets in a CodeMirror editor to instantly review ad serving, tracking clicks, and layout behaviors.
                </p>
              </div>
            </div>

            <div className="rounded-md bg-sky-500/10 border border-sky-500/20 p-3 flex items-start gap-2.5 mt-2">
              <Info className="size-4.5 text-sky-500 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">Pro-tip:</strong> When testing tags, click <strong className="text-foreground">Open Test Page</strong> to launch a true top-level page context. This is required for the Google Publisher Console (<code className="bg-sky-500/15 text-sky-600 dark:text-sky-400 px-1 rounded">googletag.openConsole()</code>) to execute properly.
              </div>
            </div>
          </div>
        )

      case 'generator':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Settings className="size-5" />
              <h3 className="text-lg font-semibold text-foreground">Configuring the Tag Generator</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Follow these steps to generate standard or custom Google Publisher Tags (GPT) with advanced delivery parameters:
            </p>

            <div className="space-y-3 mt-2">
              <div className="relative pl-6 pb-2 border-l border-border last:border-0 last:pb-0">
                <div className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                <h4 className="text-xs font-semibold text-foreground">Step 1: Network &amp; MCM Info</h4>
                <p className="text-xs text-muted-foreground">
                  Enter your main Google Ad Manager Network Code. If using parent-child setups (Multiple Customer Management), toggle the MCM option and select Parent (Reseller) or Child (Managed Account) format. Provide the respective MCM ID.
                </p>
              </div>

              <div className="relative pl-6 pb-2 border-l border-border last:border-0 last:pb-0">
                <div className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                <h4 className="text-xs font-semibold text-foreground">Step 2: Add Ad Slots</h4>
                <p className="text-xs text-muted-foreground">
                  Define ad slot units by choosing their placement (Header, Content, Right-rail, Footer, etc.). Assign unique names, sizes (e.g., <code className="bg-muted px-1 rounded">300x250</code>, <code className="bg-muted px-1 rounded">728x90</code>), and specific targeting keys.
                </p>
              </div>

              <div className="relative pl-6 pb-2 border-l border-border last:border-0 last:pb-0">
                <div className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                <h4 className="text-xs font-semibold text-foreground">Step 3: Toggle Global Features</h4>
                <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1 mt-1">
                  <li><strong>Single Request Architecture (SRA):</strong> Loads all page slots in a single HTTP request, enabling coordinated targeting and blocking roadblocks.</li>
                  <li><strong>Collapse Empty Divs:</strong> Collapses slot divs when no ads are returned to avoid visual empty margins.</li>
                  <li><strong>SafeFrame:</strong> Forces rendering in an isolated iframe for publisher security and sandbox protection.</li>
                </ul>
              </div>

              <div className="relative pl-6">
                <div className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                <h4 className="text-xs font-semibold text-foreground">Step 4: Generate &amp; Inspect Output</h4>
                <p className="text-xs text-muted-foreground">
                  Click <strong className="text-foreground">Generate Tags</strong>. The output updates in a 50-50 split layout. The Left column contains copyable <code className="bg-muted px-1 rounded">&lt;HEAD&gt;</code> and <code className="bg-muted px-1 rounded">&lt;BODY&gt;</code> blocks, while the Right column presents a live rendered iframe of the ad delivery.
                </p>
              </div>
            </div>
          </div>
        )

      case 'responsive':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Smartphone className="size-5" />
              <h3 className="text-lg font-semibold text-foreground">Responsive Sizing &amp; Mapping</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Responsive Size Mapping ensures that different ad dimensions serve based on the user's viewport resolution (e.g. desktop vs. mobile).
            </p>

            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2 mt-2">
              <h4 className="text-xs font-semibold text-foreground">Understanding Viewport Mapping Syntax</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A size mapping maps a <strong>browser viewport size</strong> to a list of <strong>ad sizes</strong> that are allowed to show when the viewport is at or above those dimensions.
              </p>
              <pre className="text-[11px] font-mono bg-background border border-border rounded p-2 text-foreground overflow-x-auto leading-relaxed">
                {`// Viewport: [Width, Height] -> Ad Sizes: [[w, h], [w, h]]
googletag.sizeMapping()
  .addSize([1024, 768], [[970, 250], [728, 90]]) // Desktop
  .addSize([768, 500], [[728, 90]])              // Tablet
  .addSize([0, 0], [[320, 50], [300, 250]])       // Mobile/Default
  .build();`}
              </pre>
            </div>

            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2.5">
              <Lightbulb className="size-4.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">Important:</strong> Ensure the parent ad slot definition contains <strong>all sizes</strong> listed within the size mapping, otherwise the GPT library will filter out the mappings.
              </div>
            </div>
          </div>
        )

      case 'gps':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="size-5" />
              <h3 className="text-lg font-semibold text-foreground">Precision Geolocation Spoofing</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Ad campaigns frequently target specific countries, states, or zip codes. Use the Diagnostics Panel to test location-based ad tags accurately.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 mt-2">
              <div className="rounded-lg border border-border p-3 space-y-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  GPS Coordinate Setters
                </span>
                <p className="text-[11px] text-muted-foreground">
                  The panel overrides the browser's <code className="bg-muted px-0.5 rounded">navigator.geolocation</code> interface. It also attaches coordinates directly to GPT via the API call:
                </p>
                <code className="text-[10px] font-mono block bg-muted/60 p-1.5 rounded text-foreground overflow-x-auto">
                  googletag.pubads().setLocation(lat, lng);
                </code>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-blue-500" />
                  Nominatim API Search
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Instead of manually writing coordinates, search for any city, country, or landmark. The tool queries OpenStreetMap's database to retrieve latitude/longitude coordinates automatically.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3">
              <h4 className="text-xs font-semibold text-foreground mb-1">Active Targeting Interception</h4>
              <p className="text-xs text-muted-foreground">
                In addition to coordinates, the generator automatically injects location targeting keys (e.g. <code className="bg-muted px-0.5 rounded">nn_geo</code>, <code className="bg-muted px-0.5 rounded">country</code>) in custom targeting settings when a location override is enabled.
              </p>
            </div>
          </div>
        )

      case 'decoder':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Activity className="size-5" />
              <h3 className="text-lg font-semibold text-foreground">Tag Decoder &amp; VAST Inspector</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Troubleshoot ad servers by unpacking existing requests or VAST tags. Paste a raw DoubleClick or Google Publisher Tag (GPT) request URL directly into the input bar.
            </p>

            <div className="space-y-3 mt-2">
              <div className="flex items-start gap-2.5">
                <div className="rounded bg-primary/10 p-1.5 text-primary text-xs font-mono shrink-0">1</div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-foreground">Unpack Parameter Dictionaries</h4>
                  <p className="text-xs text-muted-foreground">
                    Instantly extract and expand query parameters: targeting arguments (<code className="bg-muted px-0.5 rounded">cust_params</code>), active size lists (<code className="bg-muted px-0.5 rounded">sz</code>), correlator IDs, slot names, and environment indicators.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="rounded bg-primary/10 p-1.5 text-primary text-xs font-mono shrink-0">2</div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-foreground">Live Visual Preview</h4>
                  <p className="text-xs text-muted-foreground">
                    Launch a sandbox iframe using the parsed parameters to see what creative actually gets returned by the Google Ad Manager server. Swap between Desktop, Tablet, and Mobile viewport bounds.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="rounded bg-primary/10 p-1.5 text-primary text-xs font-mono shrink-0">3</div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-foreground">VAST Inspector Integration</h4>
                  <p className="text-xs text-muted-foreground">
                    For Video Ad templates, one-click redirects send your VAST XML URL directly to Google's VAST Inspector tool to test video playback events (Impression, Start, Quartiles, Complete).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'creative':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Code className="size-5" />
              <h3 className="text-lg font-semibold text-foreground">Creative Preview Sandbox</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Test raw creative code (HTML, CSS, JS) instantly inside an isolated sandbox page frame without hosting it externally.
            </p>

            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2 mt-2">
              <h4 className="text-xs font-semibold text-foreground">Key Sandbox Features</h4>
              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
                <li><strong>Interactive Code Editor:</strong> Powered by CodeMirror 6 with full HTML, CSS, and Javascript syntax highlighting and autocomplete.</li>
                <li><strong>Lazy-Loaded Panel:</strong> Optimized bundles lazy-load CodeMirror assets only when the Creative Preview tab is actively visited.</li>
                <li><strong>Safe Sandboxing:</strong> Iframe sandbox flags (<code className="bg-muted px-0.5 rounded">allow-scripts</code>, <code className="bg-muted px-0.5 rounded">allow-popups</code>) allow Javascript to run securely while blocking main tab cookie/localStorage access.</li>
              </ul>
            </div>
          </div>
        )

      case 'faq':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Terminal className="size-5" />
              <h3 className="text-lg font-semibold text-foreground">Troubleshooting &amp; FAQ</h3>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[45vh] pr-2">
              <div className="space-y-1 border-b border-border/60 pb-2">
                <h4 className="text-xs font-semibold text-foreground">Q: Why are ads not rendering in the preview?</h4>
                <p className="text-xs text-muted-foreground">
                  <strong>A:</strong> Common reasons include missing targeting keys, invalid size mappings, active ad-blockers, or restrictions requiring a top-level staging page instead of an iframe. Ensure SRA and Sizing are configured correctly.
                </p>
              </div>

              <div className="space-y-1 border-b border-border/60 pb-2">
                <h4 className="text-xs font-semibold text-foreground">Q: What is the difference between parent and child MCM network configurations?</h4>
                <p className="text-xs text-muted-foreground">
                  <strong>A:</strong> Under Multiple Customer Management, a Parent network (Reseller) distributes inventory and sets up delegations for Child networks. The Parent network code is concatenated with the child code, e.g. <code className="bg-muted px-0.5 rounded">/ParentNetwork,ChildNetwork/AdUnitPath</code>.
                </p>
              </div>

              <div className="space-y-1 border-b border-border/60 pb-2">
                <h4 className="text-xs font-semibold text-foreground">Q: How do I test the GPT Publisher Console?</h4>
                <p className="text-xs text-muted-foreground">
                  <strong>A:</strong> Click <strong className="text-foreground">Open Test Page</strong>. In the newly launched top-level window, hit <code className="bg-muted px-0.5 rounded">Ctrl+F10</code> or open developer tools console and execute <code className="bg-muted px-0.5 rounded">googletag.openConsole()</code>.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-foreground">Q: How do I resolve layout drift in code editing fields?</h4>
                <p className="text-xs text-muted-foreground">
                  <strong>A:</strong> Use the drag resizer handle situated between the Left Code Column and Right Live Ads column to manually adjust the widths and reset layout dimensions.
                </p>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 border-primary/30 bg-primary/10 hover:bg-primary/20 hover:text-foreground text-foreground px-3 font-medium transition-colors"
        >
          <HelpCircle className="size-4 text-primary" />
          <span>Guide</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[650px] max-h-[60vh] flex flex-col p-0 overflow-hidden border border-border shadow-2xl bg-card rounded-xl">
        <DialogHeader className="p-4 md:p-6 border-b border-border shrink-0 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight">Guide &amp; Instructions</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Detailed manuals, configuration setups, and troubleshooting checklists.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Navigation Sidebar */}
          <nav className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border shrink-0 bg-muted/15 flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-x-visible md:overflow-y-auto shrink-0 whitespace-nowrap">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-left transition-all duration-200 w-full shrink-0',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.title}</span>
                </button>
              )
            })}
          </nav>

          {/* Right Content Panel */}
          <main className="flex-1 overflow-y-auto p-5 md:p-6 bg-background/50">
            {renderContent()}
          </main>
        </div>

        {/* Footer with Dev Details */}
        <div className="shrink-0 border-t border-border bg-muted/20 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Developed by: <strong className="text-foreground">Kishore Cheerala</strong></span>
          <span className="flex items-center gap-1">
            Reach out to me for additional features/suggestions:{' '}
            <a
              className="text-primary underline hover:text-primary-foreground/95 cursor-pointer font-medium"
              href="mailto:cheeralakishore@gmail.com"
              onClick={(e) => {
                e.preventDefault()
                navigator.clipboard.writeText('cheeralakishore@gmail.com')
                toast.success('Email copied to clipboard!')

                const subject = encodeURIComponent('Ad Manager Tag Generator - Feature Suggestions & Feedback')
                const body = encodeURIComponent('Hi Kishore,\n\nI have the following suggestions/feedback for Ad Manager Tag Generator:\n\n[Your suggestion/feedback here]\n\nBest regards,\n[Your Name]')
                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=cheeralakishore@gmail.com&su=${subject}&body=${body}`

                window.open(gmailUrl, '_blank')
              }}
            >
              cheeralakishore@gmail.com
            </a>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
