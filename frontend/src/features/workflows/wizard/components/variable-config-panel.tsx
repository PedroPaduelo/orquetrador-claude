import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

interface VariableConfigPanelProps {
  inputVariables: string[]
  outputVariables: string[]
  onInputChange: (vars: string[]) => void
  onOutputChange: (vars: string[]) => void
}

function VariableSection({
  label,
  variables,
  onChange,
}: {
  label: string
  variables: string[]
  onChange: (vars: string[]) => void
}) {
  const [newVar, setNewVar] = useState('')

  const handleAdd = () => {
    const trimmed = newVar.trim()
    if (!trimmed || variables.includes(trimmed)) return
    onChange([...variables, trimmed])
    setNewVar('')
  }

  const handleRemove = (varName: string) => {
    onChange(variables.filter((v) => v !== varName))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={newVar}
          onChange={(e) => setNewVar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nome da variavel"
          className="h-8 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 shrink-0"
          onClick={handleAdd}
          disabled={!newVar.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {variables.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {variables.map((varName) => (
            <Badge
              key={varName}
              variant="secondary"
              className="text-[11px] px-2 py-0.5 gap-1"
            >
              {varName}
              <button
                type="button"
                onClick={() => handleRemove(varName)}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function VariableConfigPanel({
  inputVariables,
  outputVariables,
  onInputChange,
  onOutputChange,
}: VariableConfigPanelProps) {
  return (
    <div className="space-y-4">
      <VariableSection
        label="Variaveis de Entrada"
        variables={inputVariables}
        onChange={onInputChange}
      />
      <VariableSection
        label="Variaveis de Saida"
        variables={outputVariables}
        onChange={onOutputChange}
      />
    </div>
  )
}
