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
 * React route for `/testpage`. Replaced via document.write so that GPT and the
 * Google Publisher Console run in the real top-level browsing context.
 */
export function TestPageRoute() {
  const rendered = useRef(false)

  useEffect(() => {
    if (rendered.current) return
    rendered.current = true

    const raw = localStorage.getItem(TEST_PAGE_CONFIG_KEY)
    if (!raw) {
      document.body.textContent = 'No test configuration found.'
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
    
    document.open()
    document.write(html)
    document.close()

    // Listen for storage updates
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TEST_PAGE_CONFIG_KEY) {
        window.location.reload()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>Loading test page…</div>
}
