# Swarm de Agentes com o Execut MCP

## O que e um Swarm?

Um **swarm** e quando um agente "mestre" (orquestrador) cria e controla outros agentes, cada um com seu proprio workflow, e usa os resultados de um para alimentar o proximo. Em vez de um unico agente fazendo tudo, voce tem especialistas trabalhando em cadeia ou em paralelo.

```
                        Agente Orquestrador
                       /        |         \
                      /         |          \
              [Frontend]   [Backend]    [Testes]
                  |             |           |
              resultado     resultado    resultado
                  \             |          /
                   \            |         /
                    Agente de Integracao
```

---

## As 3 tools que habilitam o swarm

| Tool | Comportamento | Quando usar |
|------|--------------|-------------|
| `conversation_send_message` | Envia mensagem e **espera** o resultado | Orquestracao sequencial (A -> B -> C) |
| `conversation_send_message_async` | Envia e **retorna imediatamente** | Disparar tarefas em paralelo |
| `conversation_await_execution` | **Espera** uma tarefa async terminar | Coletar resultado apos disparo paralelo |

Essas 3 tools se combinam com as que ja existiam:

| Tool | Funcao |
|------|--------|
| `conversation_create` | Cria uma conversa nova com um workflow |
| `conversation_get` | Le os detalhes de uma conversa |
| `conversation_messages` | Le as mensagens/resultados |
| `conversation_status` | Verifica se esta executando |
| `workflow_list` | Lista workflows disponiveis |

---

## Padrao 1: Orquestracao Sequencial

O caso mais simples. O orquestrador executa um agente por vez, e o resultado de um alimenta o proximo.

```
Orquestrador
  |
  |-- 1. conversation_create (workflow: "Analista de Requisitos")
  |-- 2. conversation_send_message ("Analise esta demanda: ...")
  |       -> recebe: documento de requisitos
  |
  |-- 3. conversation_create (workflow: "Arquiteto")
  |-- 4. conversation_send_message ("Projete a arquitetura baseado nestes requisitos: {resultado_anterior}")
  |       -> recebe: documento de arquitetura
  |
  |-- 5. conversation_create (workflow: "Desenvolvedor")
  |-- 6. conversation_send_message ("Implemente baseado nesta arquitetura: {resultado_anterior}")
  |       -> recebe: codigo implementado
  |
  |-- 7. conversation_create (workflow: "Code Reviewer")
  |-- 8. conversation_send_message ("Revise este codigo: {resultado_anterior}")
  |       -> recebe: review com aprovacao ou correcoes
```

### Como o Orquestrador faz isso na pratica

O agente orquestrador e um Claude com acesso ao MCP do Execut. Ele recebe uma demanda e executa as tools em sequencia:

```
DEMANDA DO USUARIO: "Crie um sistema de autenticacao com JWT"

AGENTE ORQUESTRADOR (passo a passo):

1. Chama: workflow_list
   -> Ve os workflows disponiveis, escolhe os adequados

2. Chama: conversation_create
   -> workflowId: "id-do-workflow-analista"
   -> projectPath: "/workspace/projeto-auth"
   -> Recebe: conversationId = "conv-analista"

3. Chama: conversation_send_message
   -> id: "conv-analista"
   -> content: "Analise os requisitos para um sistema de autenticacao JWT com refresh token, roles e permissoes"
   -> ESPERA...
   -> Recebe: { content: "## Requisitos\n1. Login com email/senha\n2. JWT com expiracao...\n..." }

4. Chama: conversation_create
   -> workflowId: "id-do-workflow-dev"
   -> projectPath: "/workspace/projeto-auth"
   -> Recebe: conversationId = "conv-dev"

5. Chama: conversation_send_message
   -> id: "conv-dev"
   -> content: "Implemente o sistema de auth baseado nestes requisitos:\n\n{conteudo que recebeu no passo 3}"
   -> ESPERA...
   -> Recebe: { content: "Implementei os seguintes arquivos:\n- src/auth/...\n..." }

6. Chama: conversation_create
   -> workflowId: "id-do-workflow-reviewer"
   -> projectPath: "/workspace/projeto-auth"

7. Chama: conversation_send_message
   -> id: "conv-reviewer"
   -> content: "Revise a implementacao:\n\n{conteudo que recebeu no passo 5}"
   -> ESPERA...
   -> Recebe: { content: "## Code Review\nAprovado com ressalvas:\n1. ..." }

8. Retorna para o usuario: resumo de tudo que foi feito
```

---

## Padrao 2: Execucao Paralela (Swarm real)

Quando tarefas sao independentes, voce pode dispara-las ao mesmo tempo e esperar todas terminarem.

```
Orquestrador
  |
  |-- 1. conversation_create (workflow: "Frontend")     -> conv-front
  |-- 2. conversation_create (workflow: "Backend")      -> conv-back
  |-- 3. conversation_create (workflow: "Testes E2E")   -> conv-tests
  |
  |-- 4. conversation_send_message_async (conv-front, "Crie a tela de login")
  |-- 5. conversation_send_message_async (conv-back, "Crie a API de auth")
  |-- 6. conversation_send_message_async (conv-tests, "Crie os testes E2E de auth")
  |       (as 3 executam em paralelo no servidor)
  |
  |-- 7. conversation_await_execution (conv-front)   -> resultado frontend
  |-- 8. conversation_await_execution (conv-back)    -> resultado backend
  |-- 9. conversation_await_execution (conv-tests)   -> resultado testes
  |
  |-- 10. conversation_create (workflow: "Integrador")
  |-- 11. conversation_send_message (conv-integrador,
  |         "Integre estes resultados:
  |          Frontend: {resultado_front}
  |          Backend: {resultado_back}
  |          Testes: {resultado_tests}")
  |       -> resultado final integrado
```

---

## Padrao 3: Decisao condicional (roteamento inteligente)

O orquestrador analisa o resultado e decide qual proximo agente chamar.

```
Orquestrador
  |
  |-- 1. conversation_send_message (conv-triagem, "Classifique: {demanda}")
  |       -> recebe: "TIPO: bug_fix, PRIORIDADE: alta, COMPONENTE: backend"
  |
  |-- 2. SE tipo == "bug_fix":
  |       -> conversation_send_message (conv-debugger, "Investigue: {demanda}")
  |       -> conversation_send_message (conv-fixer, "Corrija: {diagnostico}")
  |
  |   SE tipo == "feature":
  |       -> conversation_send_message (conv-analista, "Analise: {demanda}")
  |       -> conversation_send_message (conv-dev, "Implemente: {requisitos}")
  |
  |   SE tipo == "refactoring":
  |       -> conversation_send_message (conv-reviewer, "Avalie: {demanda}")
  |       -> conversation_send_message (conv-refactor, "Refatore: {plano}")
```

---

## Padrao 4: Loop com validacao (agente QA)

O orquestrador pede implementacao, depois valida, e se nao passou, pede correcao.

```
Orquestrador
  |
  |-- 1. conversation_send_message (conv-dev, "Implemente X")
  |       -> recebe: codigo
  |
  |-- 2. conversation_send_message (conv-qa, "Valide este codigo: {codigo}")
  |       -> recebe: "FALHOU: teste de seguranca SQL injection na linha 42"
  |
  |-- 3. conversation_send_message (conv-dev, "Corrija: {feedback do QA}")
  |       -> recebe: codigo corrigido
  |
  |-- 4. conversation_send_message (conv-qa, "Valide novamente: {codigo_corrigido}")
  |       -> recebe: "PASSOU: todos os testes ok"
  |
  |-- 5. Retorna resultado aprovado
```

Esse loop pode ser feito N vezes ate o QA aprovar (com limite de tentativas).

---

## Como montar o Workflow Orquestrador

### Passo 1: Criar os workflows especialistas

Cada agente especialista e um workflow no Execut. Exemplos:

- **Analista de Requisitos**: 1 step com system prompt focado em analise
- **Arquiteto**: 1 step com system prompt de design de arquitetura
- **Desenvolvedor**: workflow sequencial com 2 steps (planejar + implementar)
- **Code Reviewer**: 1 step com system prompt de revisao de codigo
- **QA**: 1 step com system prompt de validacao e testes

### Passo 2: Criar o workflow orquestrador

O workflow orquestrador e um workflow com 1 step que tem:

- **System prompt** explicando o papel de orquestrador
- **MCP Server** do Execut configurado (para acessar as tools)
- **Rules** com instrucoes de quando usar cada workflow

Exemplo de system prompt do orquestrador:

```
Voce e o Orquestrador de uma Software House.

Voce tem acesso ao MCP do Execut com as seguintes tools:
- workflow_list: lista workflows disponiveis
- conversation_create: cria uma conversa com um workflow
- conversation_send_message: envia mensagem e espera resultado
- conversation_send_message_async: envia em background
- conversation_await_execution: espera resultado async

WORKFLOWS DISPONIVEIS:
- "Analista de Requisitos" (id: xxx): Para analisar demandas
- "Desenvolvedor Full Stack" (id: yyy): Para implementar codigo
- "Code Reviewer" (id: zzz): Para revisar codigo
- "QA Automatizado" (id: www): Para validar qualidade

FLUXO PADRAO:
1. Receba a demanda do usuario
2. Use o Analista para gerar requisitos
3. Use o Desenvolvedor para implementar
4. Use o Code Reviewer para revisar
5. Se reprovado, volte ao Desenvolvedor com o feedback
6. Use o QA para validar
7. Retorne o resultado final

REGRAS:
- Sempre passe o projectPath correto ao criar conversas
- Use async para tarefas independentes (ex: frontend e backend em paralelo)
- Limite loops de correcao a 3 tentativas
- Inclua o contexto dos steps anteriores em cada nova mensagem
```

### Passo 3: Usar

O usuario cria uma conversa com o workflow orquestrador e envia a demanda. O orquestrador faz todo o resto sozinho, chamando os especialistas via MCP.

---

## Resumo visual

```
USUARIO
  |
  | "Crie um sistema de pagamentos"
  v
ORQUESTRADOR (1 conversa, 1 workflow, com MCP do Execut)
  |
  |-- cria conversa A (workflow: Analista)
  |   envia mensagem -> espera -> recebe requisitos
  |
  |-- cria conversa B (workflow: Arquiteto)
  |   envia mensagem + requisitos -> espera -> recebe arquitetura
  |
  |-- cria conversa C (workflow: Dev Frontend) \
  |   envia async                               } paralelo
  |-- cria conversa D (workflow: Dev Backend)  /
  |   envia async
  |
  |-- await C -> resultado frontend
  |-- await D -> resultado backend
  |
  |-- cria conversa E (workflow: Code Review)
  |   envia frontend + backend -> espera -> recebe review
  |
  |-- SE review reprovou:
  |     cria conversa F (workflow: Dev Fix)
  |     envia correcoes -> espera -> recebe fix
  |     volta pro Code Review
  |
  |-- cria conversa G (workflow: QA)
  |   envia tudo -> espera -> recebe validacao
  |
  v
USUARIO recebe: "Sistema de pagamentos implementado, revisado e validado"
```

A chave e: **o orquestrador e ele mesmo um agente Claude dentro de uma conversa do Execut, que usa o MCP do Execut para criar e controlar outras conversas**. E agentes controlando agentes.
