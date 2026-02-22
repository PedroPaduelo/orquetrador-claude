# Wizard de Criacao/Edicao de Workflow

## Contexto

A criacao de workflow hoje acontece num modal `max-w-2xl` com tudo espremido: info basica + N steps dinamicos (cada um com nome, baseUrl, systemPrompt, maxRetries, e 4 secoes collapsiveis de recursos). O usuario nao tem nocao de progresso, os steps ficam apertados, nao da pra reordenar, e nao existe preview do que foi configurado.

O objetivo e transformar isso num wizard de pagina inteira com 3 fases claras, experiencia guiada, e um step builder com layout master-detail (lista de steps na esquerda + editor na direita).

---

## Decisao: Pagina dedicada (nao modal)

- Rotas: `/workflows/new` (criar) e `/workflows/:id/edit` (editar)
- Segue o padrao ja existente de `/conversations/:id` para paginas de detalhe
- O modal atual (`workflow-modal.tsx` + `workflow-form.tsx`) sera substituido

---

## Estrutura do Wizard - 3 Fases

### Fase 1: Informacoes Basicas
Campos: nome (obrigatorio), descricao, tipo (sequential/step_by_step com helper), projectPath

### Fase 2: Step Builder (master-detail)
- **Sidebar esquerda (250px)**: lista de steps com nome, badge de recursos, botoes de mover cima/baixo, duplicar e remover. Botao "+ Adicionar Step" no final.
- **Editor direita (flex-1)**: campos do step selecionado (nome, baseUrl, systemPrompt, maxRetries) + Tabs horizontais para resources (MCP Servers / Skills / Agents / Rules), cada tab com grid de checkboxes e badge de contagem.

### Fase 3: Revisao
- Card resumo do workflow (nome, tipo, projeto, descricao)
- Visualizacao do fluxo (circulos numerados conectados por setas, CSS puro)
- Cards de resumo por step com botao "Editar" que volta pra Fase 2
- Botao "Criar Workflow" / "Salvar Alteracoes"

---

## Navegacao

- **Stepper horizontal** no topo: 3 circulos numerados com labels, conectados por linhas. Fases concluidas sao clicaveis.
- **Footer fixo**: botao "Voltar" (esquerda) + "Proximo: [nome da fase]" (direita). Na Fase 3, o botao direito e "Criar Workflow" ou "Salvar Alteracoes".
- Transicao de fase valida dados: Fase 1 exige nome preenchido. Fase 2 exige pelo menos 1 step com baseUrl preenchida.

---

## Arquitetura de Componentes

### Novos arquivos (dentro de `src/features/workflows/wizard/`)

```
wizard/
  index.tsx                    - Pagina principal do wizard (componente da rota)
  components/
    wizard-stepper.tsx         - Barra de stepper horizontal (fases 1-2-3)
    wizard-footer.tsx          - Footer com navegacao Voltar/Proximo
    phase-basic-info.tsx       - Fase 1: form de info basica
    phase-step-builder.tsx     - Fase 2: wrapper do layout split-pane
    step-list-sidebar.tsx      - Sidebar com lista de steps
    step-detail-editor.tsx     - Editor completo do step selecionado
    step-resource-tabs.tsx     - Tabs de recursos (MCP/Skills/Agents/Rules)
    resource-checkbox-grid.tsx - Grid reutilizavel de checkboxes (extrai duplicacao atual)
    phase-review.tsx           - Fase 3: resumo + fluxo visual
    workflow-flow-preview.tsx  - Diagrama visual do pipeline de steps
```

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/app/routes.tsx` | Adicionar rotas `/workflows/new` e `/workflows/:id/edit` |
| `src/features/workflows/store.ts` | Expandir store com: `currentPhase`, `basicInfo`, `selectedStepIndex`, `moveStep()`, `duplicateStep()`, `initCreate()`, `initEdit()`, `resetWizard()` |
| `src/features/workflows/index.tsx` | Trocar `openCreateModal()` por `navigate('/workflows/new')` |
| `src/features/workflows/components/workflow-card.tsx` | Trocar `openEditModal(wf)` por `navigate(`/workflows/${wf.id}/edit`)` |
| `src/features/workflows/hooks/use-workflows.ts` | Refatorar `onSuccess` dos mutations para aceitar callback (navigate ao inves de closeModal) |

### Arquivos a remover (apos migrar)

| Arquivo | Motivo |
|---------|--------|
| `src/features/workflows/components/workflow-modal.tsx` | Substituido pelo wizard |
| `src/features/workflows/components/workflow-form.tsx` | Logica extraida para os componentes do wizard |

### Componentes existentes reutilizados

- `Button`, `Card`, `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Badge`, `Tabs`, `Tooltip`, `Separator`, `Progress`, `ScrollArea`, `Skeleton` (todos de `src/shared/components/ui/`)
- `ConfirmDialog` (de `src/shared/components/common/confirm-dialog.tsx`)
- Hooks: `useMcpServers()`, `useSkills()`, `useAgents()`, `useRules()` para listar recursos disponiveis
- `useWorkflow(id)` para carregar dados no modo edicao

---

## State Management

### Store do Wizard (expandir `src/features/workflows/store.ts`)

```
Estado:
  currentPhase: 1 | 2 | 3
  basicInfo: { name, description, type, projectPath }
  formSteps: WorkflowStep[]
  selectedStepIndex: number

Acoes novas:
  setPhase(phase)
  setBasicInfo(partial)
  setSelectedStepIndex(index)
  moveStep(from, to)          - reordenar via array swap
  duplicateStep(index)         - copiar step com todos os campos
  initCreate()                 - reset completo para novo workflow
  initEdit(workflow)           - popular tudo a partir dos dados da API
  resetWizard()                - limpar estado
```

### Validacao
- Fase 1: zod + react-hook-form (nome obrigatorio)
- Fase 2: validacao programatica (todo step precisa de baseUrl)
- Fase 3: re-valida tudo antes de submeter

### Protecao contra perda
- `useBlocker` do react-router (v7.1.1 suporta) + `beforeunload` quando houver dados alterados
- Mostra `ConfirmDialog` se usuario tentar navegar com dados nao salvos

---

## Fluxo de Edicao

1. Usuario navega para `/workflows/:id/edit`
2. `useWorkflow(id)` carrega dados completos (com steps)
3. Skeleton enquanto carrega, erro 404 se nao encontrar
4. `initEdit(workflow)` popula store
5. Wizard abre na Fase 1 (todas as fases clicaveis pois ja tem dados)
6. Submit chama `useUpdateWorkflow` com navigate para `/workflows` no success

---

## Sequencia de Implementacao

1. **Scaffolding**: rotas no `routes.tsx`, pagina `wizard/index.tsx` com switch de fases, stepper e footer
2. **Store**: expandir store com estado do wizard
3. **Fase 1**: `phase-basic-info.tsx` (extrair e re-layoutar do form atual)
4. **Fase 2**: `step-list-sidebar.tsx` + `step-detail-editor.tsx` + `step-resource-tabs.tsx` + `resource-checkbox-grid.tsx`
5. **Fase 3**: `phase-review.tsx` + `workflow-flow-preview.tsx`
6. **Integracao**: mutations, navegacao, protecao contra perda, modo edicao
7. **Limpeza**: remover modal e form antigos, atualizar botoes na listagem e cards

---

## Verificacao

1. `cd frontend && npm run build` - zero erros
2. Testar criacao: `/workflows` -> "Novo Workflow" -> preencher 3 fases -> criar -> aparece na lista
3. Testar edicao: card dropdown -> "Editar" -> dados carregados -> alterar -> salvar
4. Testar validacao: tentar avancar Fase 1 sem nome, Fase 2 sem baseUrl
5. Testar reordenacao: mover steps pra cima/baixo na sidebar
6. Testar protecao: preencher dados, tentar navegar fora -> confirmacao aparece
7. Testar review: verificar que preview mostra todos os dados corretamente
