import CodeMirror from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { dracula } from '@uiw/codemirror-theme-dracula'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useCreativePreviewStore } from '../store'

export function EditorPanes() {
  const activePane = useCreativePreviewStore((s) => s.activePane)
  const setActivePane = useCreativePreviewStore((s) => s.setActivePane)
  const html_ = useCreativePreviewStore((s) => s.html)
  const css_ = useCreativePreviewStore((s) => s.css)
  const js_ = useCreativePreviewStore((s) => s.js)
  const setHtml = useCreativePreviewStore((s) => s.setHtml)
  const setCss = useCreativePreviewStore((s) => s.setCss)
  const setJs = useCreativePreviewStore((s) => s.setJs)
  const reset = useCreativePreviewStore((s) => s.reset)

  return (
    <Tabs value={activePane} onValueChange={(v) => setActivePane(v as 'html' | 'css' | 'js')} className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted px-2 py-1.5">
        <TabsList className="bg-transparent p-0">
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="css">CSS</TabsTrigger>
          <TabsTrigger value="js">JS</TabsTrigger>
        </TabsList>
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
      <TabsContent value="html" className="m-0">
        <CodeMirror value={html_} height="380px" theme={dracula} extensions={[html()]} onChange={setHtml} basicSetup={{ tabSize: 2 }} />
      </TabsContent>
      <TabsContent value="css" className="m-0">
        <CodeMirror value={css_} height="380px" theme={dracula} extensions={[css()]} onChange={setCss} basicSetup={{ tabSize: 2 }} />
      </TabsContent>
      <TabsContent value="js" className="m-0">
        <CodeMirror value={js_} height="380px" theme={dracula} extensions={[javascript()]} onChange={setJs} basicSetup={{ tabSize: 2 }} />
      </TabsContent>
    </Tabs>
  )
}
