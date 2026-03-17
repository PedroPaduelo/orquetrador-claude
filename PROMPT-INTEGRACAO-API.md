# Prompt de Integração — Orquestrador Workflow API

Cole este prompt inteiro no Claude Code (ou qualquer LLM) junto com o contexto do seu projeto cliente para que ele integre a API de workflows remotos.

---

## PROMPT

```
Preciso que você integre uma API REST de execução de workflows de IA no meu projeto. Essa API permite executar workflows remotos que processam tarefas usando Claude Code (agentes de IA com system prompts, skills, rules, e ferramentas MCP configuradas).

## BASE URL

A API está disponível em:
- Produção: https://orquestrador-api.ddw1sl.easypanel.host
- Local: http://localhost:3333

## AUTENTICAÇÃO

Todas as requisições exigem header de autenticação:

```
Authorization: Bearer <TOKEN>
```

O token pode ser:
- **JWT** — obtido via login: `POST /auth/login` com `{ email, password }`
- **API Key** — prefixo `exk_`, criada via `POST /api-keys` (mais segura para integração server-side)

### Obter JWT (para testes):
```
POST /auth/login
Content-Type: application/json

{ "email": "seu@email.com", "password": "suasenha" }

→ Resposta: { "token": "eyJ...", "user": { ... } }
```

### Criar API Key (para produção):
```
POST /api-keys
Authorization: Bearer <JWT>
Content-Type: application/json

{ "name": "minha-integracao" }

→ Resposta: { "id": "...", "key": "exk_abc123...", "prefix": "exk_abc1" }
```
⚠️ A chave completa só aparece UMA VEZ na criação. Salve-a imediatamente.

---

## ENDPOINTS DISPONÍVEIS

### 1. Listar Workflows
```
GET /api/v1/workflows
Authorization: Bearer <TOKEN>

→ Resposta: [
  {
    "id": "uuid",
    "name": "Nome do Workflow",
    "description": "Descrição",
    "type": "sequential" | "step_by_step",
    "stepsCount": 3,
    "steps": [
      { "id": "uuid", "name": "Step 1", "stepOrder": 0 },
      { "id": "uuid", "name": "Step 2", "stepOrder": 1 }
    ]
  }
]
```

### 2. Executar Workflow (Síncrono — espera o resultado)
```
POST /api/v1/workflows/:workflowId/execute
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "message": "A tarefa que o workflow deve executar",
  "projectPath": "/caminho/absoluto/do/projeto",
  "conversationId": "uuid (opcional — para reusar conversa existente)",
  "timeoutMs": 600000 (opcional — default 10 min, max 30 min)
}

→ Resposta: {
  "conversationId": "uuid",
  "status": "completed" | "paused" | "error",
  "result": {
    "content": "Resposta final do último step",
    "steps": [
      {
        "stepName": "Nome do Step",
        "stepOrder": 0,
        "content": "Resposta deste step"
      }
    ],
    "messagesCount": 3
  },
  "pausedInfo": null | {
    "stepName": "Step que pausou",
    "question": "Pergunta que o workflow faz ao usuário",
    "options": [{ "label": "Opção 1" }, { "label": "Opção 2" }]
  }
}
```

### 3. Executar Workflow (Assíncrono — retorna imediatamente)
```
POST /api/v1/workflows/:workflowId/execute/async
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "message": "Tarefa para executar",
  "projectPath": "/caminho/do/projeto"
}

→ Resposta (202): {
  "conversationId": "uuid",
  "status": "started",
  "startedAt": "2026-03-17T07:34:58.268Z"
}
```

### 4. Executar Workflow (Streaming SSE — tempo real)
```
POST /api/v1/workflows/:workflowId/execute/stream
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "message": "Tarefa para executar",
  "projectPath": "/caminho/do/projeto"
}

→ Resposta: text/event-stream (SSE)

Eventos emitidos:
  event: init           → { conversationId }
  event: step_start     → { stepId, stepName, stepOrder, totalSteps }
  event: stream         → { type: "content"|"action", content?, action? }
  event: step_complete  → { stepId, stepName, content }
  event: step_error     → { stepId, error }
  event: message_saved  → { messageId, role, content }
  event: complete       → { success: true }
  event: cancelled      → {}
  event: execution_paused → { stepName, askUserQuestion }
  event: validation_failed → { validatorType, feedback }
```

### 5. Verificar Status de Execução
```
GET /api/v1/executions/:conversationId
Authorization: Bearer <TOKEN>

→ Resposta: {
  "conversationId": "uuid",
  "workflowId": "uuid",
  "workflowName": "Nome",
  "status": "running" | "paused" | "completed" | "idle",
  "result": {
    "content": "Última resposta",
    "steps": [...],
    "messagesCount": 5
  },
  "pausedInfo": null | { ... }
}
```

### 6. Enviar Mensagem Follow-up (continuar conversa)
```
POST /api/v1/executions/:conversationId/message
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "message": "Continuação ou resposta a pergunta do workflow",
  "timeoutMs": 600000
}

→ Resposta: (mesmo formato do execute síncrono)
```

### 7. Cancelar Execução
```
POST /api/v1/executions/:conversationId/cancel
Authorization: Bearer <TOKEN>

→ Resposta: { "success": true, "message": "Execution cancelled" }
```

### 8. Assistir Execução Ativa (SSE read-only)
```
GET /api/v1/executions/:conversationId/stream
Authorization: Bearer <TOKEN>

→ Resposta: text/event-stream (mesmos eventos do execute/stream)
```

---

## PADRÕES DE INTEGRAÇÃO

### Padrão 1: Execução simples (sync)
O mais fácil. Manda a tarefa e espera o resultado.
```typescript
const response = await fetch(`${API_URL}/api/v1/workflows/${workflowId}/execute`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Crie um componente de login com React',
    projectPath: '/workspace/meu-projeto',
  }),
});
const data = await response.json();
console.log(data.result.content); // Resposta do workflow
// data.conversationId pode ser guardado para follow-ups
```

### Padrão 2: Execução async com polling
Para tarefas longas. Dispara e fica verificando o status.
```typescript
// 1. Disparar
const start = await fetch(`${API_URL}/api/v1/workflows/${workflowId}/execute/async`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Tarefa longa...', projectPath: '/workspace/projeto' }),
});
const { conversationId } = await start.json();

// 2. Polling até completar
let status = 'running';
let result;
while (status === 'running') {
  await new Promise(r => setTimeout(r, 5000)); // espera 5s
  const check = await fetch(`${API_URL}/api/v1/executions/${conversationId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await check.json();
  status = data.status;
  result = data.result;
}
console.log(result.content);
```

### Padrão 3: Streaming SSE (tempo real)
Para UIs que mostram progresso em tempo real.
```typescript
const response = await fetch(`${API_URL}/api/v1/workflows/${workflowId}/execute/stream`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Tarefa...', projectPath: '/workspace/projeto' }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  let currentEvent = '';
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7);
    } else if (line.startsWith('data: ') && currentEvent) {
      const data = JSON.parse(line.slice(6));

      switch (currentEvent) {
        case 'init':
          console.log('Conversa:', data.conversationId);
          break;
        case 'step_start':
          console.log(`Step ${data.stepOrder + 1}/${data.totalSteps}: ${data.stepName}`);
          break;
        case 'stream':
          if (data.type === 'content') process.stdout.write(data.content);
          break;
        case 'step_complete':
          console.log(`\n✓ ${data.stepName} concluído`);
          break;
        case 'complete':
          console.log('\n✓ Workflow completo!');
          break;
        case 'step_error':
          console.error('Erro:', data.error);
          break;
      }
      currentEvent = '';
    }
  }
}
```

### Padrão 4: Conversa contínua (multi-turn)
Para workflows interativos onde você manda várias mensagens.
```typescript
// 1. Primeira execução
const first = await fetch(`${API_URL}/api/v1/workflows/${workflowId}/execute`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Analise o projeto e me diga o que precisa melhorar',
    projectPath: '/workspace/projeto',
  }),
});
const { conversationId, result } = await first.json();
console.log('Análise:', result.content);

// 2. Follow-up na mesma conversa (mantém contexto)
const second = await fetch(`${API_URL}/api/v1/executions/${conversationId}/message`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Agora implemente a melhoria #1 que você sugeriu',
  }),
});
const followUp = await second.json();
console.log('Implementação:', followUp.result.content);
```

### Padrão 5: Múltiplos workflows em paralelo
Para orquestrar vários workflows ao mesmo tempo.
```typescript
const workflows = [
  { id: 'workflow-frontend-id', message: 'Crie o componente de dashboard' },
  { id: 'workflow-backend-id', message: 'Crie a API de métricas' },
  { id: 'workflow-tests-id', message: 'Crie os testes E2E' },
];

// Disparar todos em paralelo (async)
const executions = await Promise.all(
  workflows.map(w =>
    fetch(`${API_URL}/api/v1/workflows/${w.id}/execute/async`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: w.message, projectPath: '/workspace/projeto' }),
    }).then(r => r.json())
  )
);

// Esperar todos completarem
const results = await Promise.all(
  executions.map(async (exec) => {
    let status = 'running';
    while (status === 'running') {
      await new Promise(r => setTimeout(r, 5000));
      const check = await fetch(`${API_URL}/api/v1/executions/${exec.conversationId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }).then(r => r.json());
      status = check.status;
      if (status !== 'running') return check;
    }
  })
);

results.forEach((r, i) => {
  console.log(`${workflows[i].message}: ${r.status}`);
});
```

### Padrão 6: Workflow pausado (interação humana)
Quando o workflow faz uma pergunta e espera resposta.
```typescript
const exec = await fetch(`${API_URL}/api/v1/workflows/${workflowId}/execute`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Deploy para produção', projectPath: '/workspace/projeto' }),
}).then(r => r.json());

if (exec.status === 'paused' && exec.pausedInfo) {
  console.log('Pergunta:', exec.pausedInfo.question);
  console.log('Opções:', exec.pausedInfo.options?.map(o => o.label));

  // Responder à pergunta
  const answer = await fetch(`${API_URL}/api/v1/executions/${exec.conversationId}/message`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Sim, pode fazer o deploy' }),
  }).then(r => r.json());

  console.log('Resultado:', answer.result.content);
}
```

---

## CLASSE SDK COMPLETA (TypeScript)

Aqui está uma classe pronta para usar como SDK:

```typescript
interface WorkflowExecuteOptions {
  message: string;
  projectPath: string;
  conversationId?: string;
  timeoutMs?: number;
}

interface ExecutionResult {
  conversationId: string;
  status: 'completed' | 'paused' | 'error' | 'running' | 'idle';
  result: {
    content: string;
    steps: Array<{ stepName: string; stepOrder: number; content: string }>;
    messagesCount: number;
  };
  pausedInfo: {
    stepName?: string;
    question?: string;
    options?: Array<{ label: string; description?: string }>;
  } | null;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  stepsCount: number;
  steps: Array<{ id: string; name: string; stepOrder: number }>;
}

class OrquestradorClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error ${response.status}: ${error.message || JSON.stringify(error)}`);
    }

    return response.json() as T;
  }

  // Listar workflows disponíveis
  async listWorkflows(): Promise<Workflow[]> {
    return this.request('GET', '/api/v1/workflows');
  }

  // Executar workflow (síncrono — espera resultado)
  async execute(workflowId: string, options: WorkflowExecuteOptions): Promise<ExecutionResult> {
    return this.request('POST', `/api/v1/workflows/${workflowId}/execute`, options);
  }

  // Executar workflow (assíncrono)
  async executeAsync(workflowId: string, options: Omit<WorkflowExecuteOptions, 'timeoutMs'>): Promise<{ conversationId: string; status: string; startedAt: string }> {
    return this.request('POST', `/api/v1/workflows/${workflowId}/execute/async`, options);
  }

  // Verificar status
  async getStatus(conversationId: string): Promise<ExecutionResult> {
    return this.request('GET', `/api/v1/executions/${conversationId}`);
  }

  // Enviar follow-up
  async sendMessage(conversationId: string, message: string, timeoutMs?: number): Promise<ExecutionResult> {
    return this.request('POST', `/api/v1/executions/${conversationId}/message`, { message, timeoutMs });
  }

  // Cancelar execução
  async cancel(conversationId: string): Promise<{ success: boolean; message: string }> {
    return this.request('POST', `/api/v1/executions/${conversationId}/cancel`);
  }

  // Executar e esperar (async + polling)
  async executeAndWait(workflowId: string, options: Omit<WorkflowExecuteOptions, 'timeoutMs'>, pollIntervalMs = 5000): Promise<ExecutionResult> {
    const { conversationId } = await this.executeAsync(workflowId, options);

    while (true) {
      await new Promise(r => setTimeout(r, pollIntervalMs));
      const status = await this.getStatus(conversationId);
      if (status.status !== 'running') return status;
    }
  }

  // Executar com streaming SSE
  async executeStream(
    workflowId: string,
    options: Omit<WorkflowExecuteOptions, 'timeoutMs'>,
    onEvent: (event: string, data: Record<string, unknown>) => void,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/workflows/${workflowId}/execute/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ') && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent(currentEvent, data);
          } catch { /* ignore parse errors */ }
          currentEvent = '';
        }
      }
    }
  }
}
```

### Exemplo de uso do SDK:
```typescript
const client = new OrquestradorClient(
  'https://orquestrador-api.ddw1sl.easypanel.host',
  'exk_sua_api_key_aqui'
);

// Listar workflows
const workflows = await client.listWorkflows();
console.log(workflows.map(w => `${w.name} (${w.stepsCount} steps)`));

// Executar sync
const result = await client.execute(workflows[0].id, {
  message: 'Crie uma landing page moderna',
  projectPath: '/workspace/meu-projeto',
});
console.log(result.result.content);

// Continuar conversa
const followUp = await client.sendMessage(result.conversationId, 'Adicione animações');
console.log(followUp.result.content);
```

---

## NOTAS IMPORTANTES

1. **projectPath** deve ser um caminho absoluto válido no servidor do orquestrador, dentro de `/workspace/temp-orquestrador/`
2. **Timeout padrão** é 10 minutos (600000ms). Para tarefas longas, use async + polling ou aumente o timeout (max 30 min)
3. **Workflows step_by_step** executam apenas o step atual por chamada. Para executar todos, faça múltiplas chamadas ou use advance-step
4. **conversationId** permite reusar a mesma sessão (mantém contexto, histórico, e resume token do Claude)
5. **status "paused"** indica que o workflow fez uma pergunta e espera resposta via `/message`
6. **Rate limiting** pode estar ativo — trate erros 429
7. Respostas grandes podem demorar. Use streaming para UX em tempo real
8. A API autentica via JWT (7 dias) ou API Key (sem expiração até ser revogada)

## ERROS COMUNS

| Status | Significado | Solução |
|--------|------------|---------|
| 401 | Token inválido/expirado | Refazer login ou usar API Key |
| 400 | Parâmetros inválidos | Verificar projectPath e message |
| 404 | Workflow/conversa não encontrado | Verificar IDs |
| 429 | Rate limit ou budget excedido | Esperar e tentar novamente |
| 500 | Erro interno | Verificar logs do servidor |

---

Agora integre essa API no meu projeto seguindo o padrão que faz mais sentido para o meu caso de uso. Crie o client/SDK, as chamadas necessárias, e o tratamento de erros.
```
