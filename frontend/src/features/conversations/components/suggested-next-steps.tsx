import { useState, useEffect, useCallback } from 'react'
import { Sparkles, ChevronRight, RefreshCw, X, Send, ArrowLeft } from 'lucide-react'

interface Suggestion {
  text: string
  description: string
}

interface SuggestedNextStepsProps {
  conversationId: string
  onSelect: (text: string) => void
}

export function SuggestedNextSteps({ conversationId, onSelect }: SuggestedNextStepsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState(false)
  const [fetchCount, setFetchCount] = useState(0)
  const [expanded, setExpanded] = useState<number | null>(null)

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    setError(false)
    setExpanded(null)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
      const token = localStorage.getItem('token')
      const res = await fetch(`${apiUrl}/conversations/${conversationId}/suggestions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        const items = data.suggestions || []
        setSuggestions(items)
        if (items.length === 0) setError(true)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [conversationId, fetchCount])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  if (dismissed) return null

  const selectedSuggestion = expanded !== null ? suggestions[expanded] : null

  return (
    <div className="border-t border-blue-500/10 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 px-4 py-3">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          {selectedSuggestion ? (
            <button
              onClick={() => setExpanded(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Voltar</span>
            </button>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs text-muted-foreground font-medium">Próximos passos</span>
            </>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {!selectedSuggestion && (
              <button
                onClick={() => setFetchCount(c => c + 1)}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs
                  text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10
                  transition-all disabled:opacity-50"
                title="Gerar novas sugestões"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Regerar</span>
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              title="Fechar sugestões"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded preview */}
        {selectedSuggestion ? (
          <div className="space-y-3">
            <div className="bg-background/80 border border-border/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{selectedSuggestion.description}</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {selectedSuggestion.text}
              </p>
            </div>
            <button
              onClick={() => {
                onSelect(selectedSuggestion.text)
                setDismissed(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-blue-500 hover:bg-blue-600 text-white transition-colors w-full justify-center"
            >
              <Send className="h-4 w-4" />
              Enviar esta mensagem
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <span>Não foi possível gerar sugestões.</span>
            <button
              onClick={() => setFetchCount(c => c + 1)}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setExpanded(i)}
                className="group flex flex-col items-start gap-1 px-3 py-2 rounded-lg text-left
                  bg-background/60 border border-border/40
                  hover:border-blue-400/50 hover:bg-blue-500/5 hover:shadow-sm
                  transition-all duration-150"
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span className="text-xs font-medium text-foreground/90 group-hover:text-foreground line-clamp-2 flex-1">
                    {s.text}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                </div>
                <span className="text-[10px] text-muted-foreground/70 line-clamp-1">
                  {s.description}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
