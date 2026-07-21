import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { dracula } from '@uiw/codemirror-theme-dracula'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ResizeHandle } from '@/components/shared/ResizeHandle'
import { useCreativePreviewStore } from '../store'
import { GamOnSitePreviewPane } from './GamOnSitePreviewPane'

export function EditorPanes() {
  const formatMode = useCreativePreviewStore((s) => s.formatMode)
  const activePane = useCreativePreviewStore((s) => s.activePane)
  const setActivePane = useCreativePreviewStore((s) => s.setActivePane)
  const jsonContent = useCreativePreviewStore((s) => s.jsonContent)
  const setJsonContent = useCreativePreviewStore((s) => s.setJsonContent)
  const html_ = useCreativePreviewStore((s) => s.html)
  const css_ = useCreativePreviewStore((s) => s.css)
  const js_ = useCreativePreviewStore((s) => s.js)
  const setHtml = useCreativePreviewStore((s) => s.setHtml)
  const setCss = useCreativePreviewStore((s) => s.setCss)
  const setJs = useCreativePreviewStore((s) => s.setJs)
  const reset = useCreativePreviewStore((s) => s.reset)
  const [editorHeight, setEditorHeight] = useState(() => Math.max(300, (window.innerHeight - 140) * 0.8))

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonContent)
      setJsonContent(JSON.stringify(parsed, null, 2))
      toast.success('JSON formatted successfully!')
    } catch {
      toast.error('Invalid JSON syntax; cannot format.')
    }
  }

  if (formatMode === 'on_site_gam') {
    return <GamOnSitePreviewPane />
  }

  return (
    <Tabs
      value={activePane}
      onValueChange={(v) => setActivePane(v as 'json' | 'html' | 'css' | 'js')}
      className="group relative overflow-hidden rounded-lg border border-border flex flex-col shrink-0"
      style={{ height: editorHeight }}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted px-2 py-1.5 shrink-0">
        <TabsList className="bg-transparent p-0">
          <TabsTrigger value="json">GAM Native JSON</TabsTrigger>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="css">CSS</TabsTrigger>
          <TabsTrigger value="js">JS</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-1.5">
          {activePane === 'json' && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-emerald-400" onClick={handleFormatJson}>
              Format JSON
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={() => {
              reset()
              toast.success('Creative Preview fully reset.')
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <TabsContent value="json" className="m-0 flex-1 min-h-0 flex flex-col">
        <CodeMirror
          value={jsonContent}
          height="100%"
          theme={dracula}
          extensions={[javascript()]}
          onChange={setJsonContent}
          basicSetup={{ tabSize: 2 }}
          className="flex-1 min-h-0"
        />
      </TabsContent>

      <TabsContent value="html" className="m-0 flex-1 min-h-0 flex flex-col">
        <CodeMirror
          value={html_}
          height="100%"
          theme={dracula}
          extensions={[html()]}
          onChange={setHtml}
          basicSetup={{ tabSize: 2 }}
          className="flex-1 min-h-0"
        />
      </TabsContent>

      <TabsContent value="css" className="m-0 flex-1 min-h-0 flex flex-col">
        <CodeMirror
          value={css_}
          height="100%"
          theme={dracula}
          extensions={[css()]}
          onChange={setCss}
          basicSetup={{ tabSize: 2 }}
          className="flex-1 min-h-0"
        />
      </TabsContent>

      <TabsContent value="js" className="m-0 flex-1 min-h-0 flex flex-col">
        <CodeMirror
          value={js_}
          height="100%"
          theme={dracula}
          extensions={[javascript()]}
          onChange={setJs}
          basicSetup={{ tabSize: 2 }}
          className="flex-1 min-h-0"
        />
      </TabsContent>

      <ResizeHandle onResize={(dy) => setEditorHeight((hgt) => Math.max(200, hgt + dy))} />
    </Tabs>
  )
}
