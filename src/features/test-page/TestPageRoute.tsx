import { useEffect, useRef } from 'react'
import { generateStagingHtml } from '@/features/tag-settings/lib/generateStagingHtml'
import type { TagSettingsState } from '@/features/tag-settings/types'

export const TEST_PAGE_CONFIG_KEY = 'adTagTestPageConfig'

interface TestPageConfig {
  snapshot: TagSettingsState
  pubConsole: boolean
  isDark: boolean
}

/**
 * React route for `/testpage`. The app stashes the current tag config in
 * localStorage and opens this route in a new tab; here we render the full
 * staging document into the real top-level page.
 *
 * Why a top-level document (not an iframe): GPT needs a genuine page URL for ad
 * serving, and the Google Publisher Console only initializes at the top level.
 * The generated page carries a `storage` listener (liveReload) so it refreshes
 * whenever the app tab rewrites the config — that's the real-time update path.
 */
export function TestPageRoute() {
  const rendered = useRef(false)

  useEffect(() => {
    if (rendered.current) return // guard StrictMode's double effect
    rendered.current = true

    const raw = localStorage.getItem(TEST_PAGE_CONFIG_KEY)
    if (!raw) {
      document.body.textContent = 'Open this page from the “Open Test Page” or Publisher Console button in the app.'
      return
    }
    let cfg: TestPageConfig
    try {
      cfg = JSON.parse(raw) as TestPageConfig
    } catch {
      document.body.textContent = 'Could not read the test page configuration.'
      return
    }
    const html = generateStagingHtml(cfg.snapshot, {
      isPreview: false,
      pubConsole: cfg.pubConsole,
      isDark: cfg.isDark,
      liveReload: true,
    })
    // Replace this document with the staging page so its <script> tags run in
    // this real top-level context.
    document.open()
    document.write(html)
    document.close()
  }, [])

  return <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>Loading test page…</div>
}
