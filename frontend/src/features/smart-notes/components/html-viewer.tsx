import { useRef, useEffect, useState, useCallback } from 'react'
import { Code, MonitorPlay } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface HtmlViewerProps {
  content: string
  onChange?: (content: string) => void
  readOnly?: boolean
}

export function HtmlViewer({ content, onChange, readOnly = false }: HtmlViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')

  const getIframeContent = useCallback(() => {
    const cspMeta = '<meta http-equiv="Content-Security-Policy" content="default-src * \'unsafe-inline\' \'unsafe-eval\' data: blob:; script-src * \'unsafe-inline\' \'unsafe-eval\'; style-src * \'unsafe-inline\';">'

    const linkInterceptScript = `
      <script>
        document.addEventListener('click', function(e) {
          var target = e.target;
          while (target && target.tagName !== 'A') {
            target = target.parentElement;
          }
          if (target && target.tagName === 'A') {
            var href = target.getAttribute('href');
            if (href && href.startsWith('#')) {
              e.preventDefault();
              var element = document.querySelector(href);
              if (element) element.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }, true);
      </script>
    `

    let htmlWithCsp = content
    if (content.includes('</head>')) {
      htmlWithCsp = content.replace('</head>', cspMeta + linkInterceptScript + '</head>')
    } else {
      htmlWithCsp = `<!DOCTYPE html><html><head>${cspMeta}${linkInterceptScript}</head><body>${content}</body></html>`
    }

    return htmlWithCsp
  }, [content])

  useEffect(() => {
    if (viewMode === 'preview' && iframeRef.current) {
      const iframe = iframeRef.current
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(getIframeContent())
        doc.close()
      }
    }
  }, [viewMode, content, getIframeContent])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      onChange?.(newContent)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode Toggle */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/30">
        <Button
          variant={viewMode === 'preview' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setViewMode('preview')}
        >
          <MonitorPlay className="h-3 w-3" />
          Preview
        </Button>
        <Button
          variant={viewMode === 'code' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setViewMode('code')}
        >
          <Code className="h-3 w-3" />
          Código
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === 'preview' ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="HTML Preview"
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full h-full font-mono text-sm p-4 resize-none focus:outline-none',
              'bg-zinc-950 text-zinc-100 border-0'
            )}
            placeholder="<!-- Escreva seu HTML aqui -->"
            spellCheck={false}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  )
}
