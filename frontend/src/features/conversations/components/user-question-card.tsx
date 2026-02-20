import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { HelpCircle, Send, CheckCircle2 } from 'lucide-react'

interface QuestionOption {
  label: string
  description?: string
}

interface Question {
  question: string
  header?: string
  options: QuestionOption[]
  multiSelect?: boolean
}

interface UserQuestionCardProps {
  questions: Question[]
  onAnswer: (formattedAnswer: string) => void
  disabled?: boolean
  answeredText?: string
}

/**
 * Parse the formatted answer text back into per-question answers.
 * Format: "Question text\n→ Answer\n\nQuestion text 2\n→ Answer 2"
 */
function parseAnsweredText(text: string): Map<string, string> {
  const map = new Map<string, string>()
  const blocks = text.split('\n\n')
  for (const block of blocks) {
    const arrowIdx = block.indexOf('\n→ ')
    if (arrowIdx !== -1) {
      const question = block.slice(0, arrowIdx).trim()
      const answer = block.slice(arrowIdx + 3).trim()
      map.set(question, answer)
    }
  }
  return map
}

export function UserQuestionCard({ questions, onAnswer, disabled, answeredText }: UserQuestionCardProps) {
  const [selections, setSelections] = useState<Map<number, Set<number>>>(new Map())
  const [customTexts, setCustomTexts] = useState<Map<number, string>>(new Map())
  const [submitted, setSubmitted] = useState(false)

  const isAnswered = !!answeredText || submitted

  const toggleSelection = (questionIdx: number, optionIdx: number, multiSelect?: boolean) => {
    if (isAnswered) return
    setSelections((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(questionIdx) || new Set<number>()

      if (multiSelect) {
        const newSet = new Set(current)
        if (newSet.has(optionIdx)) {
          newSet.delete(optionIdx)
        } else {
          newSet.add(optionIdx)
        }
        newMap.set(questionIdx, newSet)
      } else {
        newMap.set(questionIdx, new Set([optionIdx]))
      }

      return newMap
    })
  }

  const setCustomText = (questionIdx: number, text: string) => {
    if (isAnswered) return
    setCustomTexts((prev) => {
      const newMap = new Map(prev)
      newMap.set(questionIdx, text)
      return newMap
    })
  }

  const handleSubmit = () => {
    if (isAnswered) return
    const answers: string[] = []

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const selected = selections.get(i)
      const custom = customTexts.get(i)

      let answer = ''
      if (selected && selected.size > 0) {
        const selectedLabels = Array.from(selected).map((idx) => q.options[idx]?.label).filter(Boolean)
        answer = selectedLabels.join(', ')
      }
      if (custom?.trim()) {
        answer = answer ? `${answer}. ${custom.trim()}` : custom.trim()
      }

      if (answer) {
        answers.push(`${q.question}\n→ ${answer}`)
      }
    }

    if (answers.length > 0) {
      const formatted = answers.join('\n\n')
      setSubmitted(true)
      onAnswer(formatted)
    }
  }

  const hasAnySelection = Array.from(selections.values()).some((s) => s.size > 0) ||
    Array.from(customTexts.values()).some((t) => t.trim().length > 0)

  // Already answered — show the answered state with recorded responses
  if (isAnswered) {
    const parsedAnswers = answeredText ? parseAnsweredText(answeredText) : null

    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Resposta enviada</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((q, qIdx) => {
            const answer = parsedAnswers?.get(q.question)

            return (
              <div key={qIdx} className="space-y-1">
                <div className="flex items-center gap-2">
                  {q.header && (
                    <Badge variant="outline" className="text-xs">{q.header}</Badge>
                  )}
                  <p className="text-sm font-medium text-muted-foreground">{q.question}</p>
                </div>
                {answer && (
                  <p className="text-sm text-green-300 pl-4 border-l-2 border-green-500/30">
                    {answer}
                  </p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <HelpCircle className="h-4 w-4 text-blue-400" />
          <span>Claude precisa da sua resposta</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="space-y-2">
            <div className="flex items-center gap-2">
              {q.header && (
                <Badge variant="outline" className="text-xs">{q.header}</Badge>
              )}
              <p className="text-sm font-medium">{q.question}</p>
            </div>

            {q.multiSelect && (
              <p className="text-xs text-muted-foreground">Selecione uma ou mais opcoes</p>
            )}

            <div className="grid gap-2">
              {q.options.map((opt, optIdx) => {
                const isSelected = selections.get(qIdx)?.has(optIdx) || false

                return q.multiSelect ? (
                  <label
                    key={optIdx}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-border hover:border-blue-500/50 hover:bg-muted/50'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(qIdx, optIdx, true)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      {opt.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                      )}
                    </div>
                  </label>
                ) : (
                  <button
                    key={optIdx}
                    onClick={() => toggleSelection(qIdx, optIdx, false)}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-lg border text-left transition-all',
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-border hover:border-blue-500/50 hover:bg-muted/50'
                    )}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    {opt.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Custom text input for "Other" */}
            <Textarea
              placeholder="Ou escreva sua resposta personalizada..."
              value={customTexts.get(qIdx) || ''}
              onChange={(e) => setCustomText(qIdx, e.target.value)}
              className="text-sm min-h-[60px]"
            />
          </div>
        ))}

        <Button
          onClick={handleSubmit}
          disabled={!hasAnySelection || disabled}
          className="w-full"
          size="sm"
        >
          <Send className="h-4 w-4 mr-2" />
          Enviar resposta
        </Button>
      </CardContent>
    </Card>
  )
}
