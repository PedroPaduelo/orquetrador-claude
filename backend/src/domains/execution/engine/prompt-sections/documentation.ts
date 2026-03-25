export function getDocumentationSection(): string {
  return `## Documentacao do Projeto (pasta docs/)

Todo projeto DEVE ter uma pasta \`docs/\` na raiz com documentacao viva do que esta acontecendo.

### Estrutura da pasta docs/

\`\`\`
docs/
  tasks/
    task-001-setup-inicial.md        ← tarefa concluida
    task-002-api-autenticacao.md     ← tarefa em andamento
  guides/
    guia-autenticacao.html           ← como usar o login
    guia-dashboard.html              ← como usar o dashboard
  index.html                         ← pagina principal (navegavel pelo usuario)
  styles.css                         ← estilos baseados no tema do frontend
\`\`\`

### Arquivos de task (docs/tasks/task-NNN-*.md)

Crie um arquivo para cada tarefa significativa. Formato:

\`\`\`markdown
# Task NNN — Titulo da Tarefa

**Status**: ✅ Concluida | 🔄 Em andamento | ⬚ Pendente
**Inicio**: YYYY-MM-DD HH:MM
**Fim**: YYYY-MM-DD HH:MM (ou "em andamento")

## O que foi pedido
Descricao do que o usuario solicitou.

## O que foi feito
- Item 1
- Item 2

## O que falta (se em andamento)
- Item pendente 1

## Arquivos alterados
- \\\`src/components/Login.tsx\\\` — criado
- \\\`src/api/auth.ts\\\` — modificado
\`\`\`

Atualize o arquivo de task conforme progride. O usuario pode consultar a qualquer momento.

### Pagina HTML (docs/index.html)

Crie uma pagina HTML que serve como portal de documentacao. Esta pagina DEVE:
- Seguir o mesmo tema visual do frontend do projeto (cores, fontes, dark mode)
- Ter duas secoes principais: **Tasks** (progresso) e **Guias** (como usar)
- Mostrar lista de tasks com status visual (badges coloridos)
- Mostrar lista de guias disponiveis com links diretos
- Permitir clicar em uma task para ver detalhes
- Renderizar os arquivos .md como HTML
- Ser uma SPA simples e leve (vanilla JS, sem frameworks)

### Servir a pasta docs/

Ao criar o projeto, suba um servidor estatico para a pasta docs/:

\`\`\`bash
pm2 start npx --name "docs-NOME-PROJETO" -- serve docs/ -l PORTA --no-clipboard
\`\`\`

Crie um dominio para os docs: \`docs-NOME-PROJETO.ddw1sl.easypanel.host\`

Informe a URL dos docs ao usuario junto com a URL do projeto principal.

### Quando atualizar docs/

- **Ao iniciar uma nova tarefa** — crie o arquivo task-NNN
- **Ao concluir uma tarefa** — atualize status, adicione "O que foi feito" e "Arquivos alterados"
- **Ao finalizar o projeto** — garanta que todas as tasks estao documentadas`
}
