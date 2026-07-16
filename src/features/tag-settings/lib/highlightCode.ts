/**
 * Lightweight regex-based syntax highlighter for the generated GPT tag code
 * panels (comments / strings / tags / attributes). Escapes HTML first, then
 * wraps recognized tokens in spans — safe to render with
 * dangerouslySetInnerHTML since the input is always escaped before any
 * markup is introduced.
 */
export function highlightCode(code: string): string {
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rx = /(&lt;!--.*?--&gt;)|(".*?"|'.*?'|`.*?`)|(&lt;\/?[a-zA-Z0-9-]+)|(\s[a-zA-Z0-9-]+(?=\s*=|=))/g
  const highlighted = esc.replace(rx, (m, comment, str, tag, attr) => {
    if (comment) return `<span class="code-syntax-comment">${m}</span>`
    if (str) return `<span class="code-syntax-string">${m}</span>`
    if (tag) return `<span class="code-syntax-tag">${m}</span>`
    if (attr) return `<span class="code-syntax-attr">${m}</span>`
    return m
  })
  const lines = highlighted.split('\n')
  return lines.map((line, i) => `<span class="code-line-num">${i + 1}.</span>${line}`).join('\n')
}
