import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { useWorkflowsStore } from '../../store'

interface PhaseBasicInfoProps {
  errors: Record<string, string>
}

export function PhaseBasicInfo({ errors }: PhaseBasicInfoProps) {
  const { basicInfo, setBasicInfo } = useWorkflowsStore()

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Informacoes Basicas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Defina o nome e configuracoes gerais do seu workflow.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="wiz-name">
            Nome <span className="text-destructive">*</span>
          </Label>
          <Input
            id="wiz-name"
            value={basicInfo.name}
            onChange={(e) => setBasicInfo({ name: e.target.value })}
            placeholder="Nome do workflow"
            autoFocus
          />
          {errors.name && (
            <p className="text-sm text-destructive mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <Label htmlFor="wiz-description">Descricao</Label>
          <Textarea
            id="wiz-description"
            value={basicInfo.description}
            onChange={(e) => setBasicInfo({ description: e.target.value })}
            placeholder="Descreva o objetivo deste workflow..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo</Label>
            <Select
              value={basicInfo.type}
              onValueChange={(value) =>
                setBasicInfo({ type: value as 'sequential' | 'step_by_step' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Sequencial</SelectItem>
                <SelectItem value="step_by_step">Passo a Passo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {basicInfo.type === 'sequential'
                ? 'Todos os steps executam automaticamente em ordem'
                : 'Voce controla quando avancar para o proximo step'}
            </p>
          </div>

          <div>
            <Label htmlFor="wiz-projectPath">Caminho do Projeto</Label>
            <Input
              id="wiz-projectPath"
              value={basicInfo.projectPath}
              onChange={(e) => setBasicInfo({ projectPath: e.target.value })}
              placeholder="/caminho/do/projeto"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
