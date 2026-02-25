import { ArrowLeft, ArrowRight, Save } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

interface WizardFooterProps {
  currentPhase: 1 | 2 | 3
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
  isEditing: boolean
  isSubmitting: boolean
}

const phaseLabels: Record<number, string> = {
  2: 'Steps',
  3: 'Revisao',
}

export function WizardFooter({
  currentPhase,
  onBack,
  onNext,
  onSubmit,
  isEditing,
  isSubmitting,
}: WizardFooterProps) {
  return (
    <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Back button */}
        <div>
          {currentPhase > 1 && (
            <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          )}
        </div>

        {/* Next / Submit button */}
        <div>
          {currentPhase < 3 ? (
            <Button type="button" onClick={onNext}>
              Proximo: {phaseLabels[currentPhase + 1]}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Salvar Alteracoes' : 'Criar Workflow'}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
