import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Switch } from '@/shared/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type { ValidatorConfig } from '../../types'

const VALIDATOR_TYPES = [
  { value: 'build_check', label: 'Build Check' },
  { value: 'test_check', label: 'Test Check' },
  { value: 'json_schema', label: 'JSON Schema' },
  { value: 'llm_judge', label: 'LLM Judge' },
]

interface ValidatorConfigPanelProps {
  validators: ValidatorConfig[]
  onChange: (validators: ValidatorConfig[]) => void
}

export function ValidatorConfigPanel({ validators, onChange }: ValidatorConfigPanelProps) {
  const addValidator = () => {
    onChange([
      ...validators,
      { type: 'build_check', enabled: true },
    ])
  }

  const removeValidator = (index: number) => {
    onChange(validators.filter((_, i) => i !== index))
  }

  const updateValidator = (index: number, partial: Partial<ValidatorConfig>) => {
    onChange(
      validators.map((v, i) => (i === index ? { ...v, ...partial } : v))
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Validators</Label>
        <Button variant="outline" size="sm" onClick={addValidator} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Adicionar
        </Button>
      </div>

      {validators.length === 0 && (
        <p className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
          Nenhum validator configurado. Validators verificam a saida do step automaticamente.
        </p>
      )}

      {validators.map((validator, index) => (
        <div
          key={index}
          className="border rounded-lg p-3 space-y-3 bg-muted/20"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Select
                value={validator.type}
                onValueChange={(value) => updateValidator(index, { type: value })}
              >
                <SelectTrigger className="h-8 text-xs w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALIDATOR_TYPES.map((vt) => (
                    <SelectItem key={vt.value} value={vt.value}>
                      {vt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={validator.enabled !== false}
                  onCheckedChange={(checked) =>
                    updateValidator(index, { enabled: checked })
                  }
                  className="scale-75"
                />
                <span className="text-[10px] text-muted-foreground">
                  {validator.enabled !== false ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeValidator(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {(validator.type === 'build_check' || validator.type === 'test_check') && (
            <div>
              <Label className="text-xs">Comando</Label>
              <Input
                value={validator.command || ''}
                onChange={(e) => updateValidator(index, { command: e.target.value })}
                placeholder={
                  validator.type === 'build_check'
                    ? 'npm run build'
                    : 'npm test'
                }
                className="h-8 text-xs font-mono"
              />
            </div>
          )}

          {validator.type === 'json_schema' && (
            <div>
              <Label className="text-xs">Schema JSON</Label>
              <Textarea
                value={
                  validator.schema ? JSON.stringify(validator.schema, null, 2) : ''
                }
                onChange={(e) => {
                  try {
                    const schema = JSON.parse(e.target.value)
                    updateValidator(index, { schema })
                  } catch {
                    // Allow intermediate invalid JSON while typing
                  }
                }}
                placeholder='{ "type": "object", "properties": { ... } }'
                rows={3}
                className="text-xs font-mono"
              />
            </div>
          )}

          {validator.type === 'llm_judge' && (
            <div>
              <Label className="text-xs">Criterios de avaliacao</Label>
              <Textarea
                value={validator.criteria || ''}
                onChange={(e) => updateValidator(index, { criteria: e.target.value })}
                placeholder="Descreva os criterios que o LLM deve usar para avaliar a saida..."
                rows={3}
                className="text-xs"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
