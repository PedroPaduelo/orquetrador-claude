export function getStackSection(): string {
  return `## Stack Obrigatoria

Ao criar projetos, use SEMPRE esta stack. NAO substitua por alternativas.

### Backend

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js (ESM) |
| Linguagem | TypeScript 5.7 |
| Framework HTTP | Fastify 5 |
| ORM / Banco | Prisma 6 (schema em prisma/schema.prisma) |
| Fila / Jobs | BullMQ 5 |
| Cache / Broker | Redis (via ioredis) |
| Autenticacao | JWT (@fastify/jwt) + bcryptjs |
| Validacao | Zod (com fastify-type-provider-zod) |
| IA | Anthropic SDK (@anthropic-ai/sdk) |
| Docs API | Swagger (@fastify/swagger + swagger-ui) |
| Upload | @fastify/multipart |
| Rate Limit | @fastify/rate-limit |
| Build | tsup (bundler) + tsx (dev watch) |
| Package Manager | npm |

**Arquitetura backend**: Organizado por dominios (\`src/domains/\`), cada um com \`routes\`, \`service\` e \`repository\`.

### Frontend

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 18 |
| Linguagem | TypeScript 5.7 |
| Build / Dev | Vite 6 |
| Estilizacao | Tailwind CSS 3.4 + tailwindcss-animate + tailwind-merge |
| Componentes UI | shadcn/ui + Radix UI |
| Icones | Lucide React |
| Roteamento | React Router DOM 7 |
| Estado global | Zustand 5 |
| Estado servidor | TanStack React Query 5 |
| Formularios | React Hook Form 7 + @hookform/resolvers + Zod |
| HTTP Client | Axios |
| SSE | Cliente SSE customizado |
| Editor rico | TipTap 2 |
| Markdown | react-markdown + remark-gfm |
| Graficos | Recharts 3 |
| Toasts | Sonner |
| Utilitarios CSS | clsx + class-variance-authority (CVA) |

**Arquitetura frontend**: Organizado por features (\`src/features/\`), cada uma com \`api\`, \`store\`, \`hooks\`, \`types\` e \`components\`.

**Shared** (\`src/shared/\`):
- \`components/ui/\` — componentes base shadcn/Radix (button, card, input, dialog, etc.)
- \`components/common/\` — componentes reutilizaveis (confirm-dialog, empty-state, etc.)
- \`hooks/\` — hooks customizados (use-debounce, use-local-storage)
- \`lib/\` — api-client (Axios), sse-client, utils

### Tema: Dark Mode OBRIGATORIO

Todo projeto frontend DEVE ter suporte a Dark e Light mode, mas o **Dark mode e o padrao**. Regras:

1. O tema padrao ao abrir o app DEVE ser **dark**
2. Implemente um toggle (botao ou switch) para o usuario alternar entre dark/light
3. Persista a preferencia do usuario no localStorage
4. Use CSS variables ou classes do Tailwind (\`dark:\`) para gerenciar os temas
5. Todos os componentes devem estar estilizados para AMBOS os temas
6. Ao criar novos componentes, SEMPRE inclua as variantes dark — nao deixe pra depois

Exemplo de configuracao no Tailwind:
\`\`\`ts
// tailwind.config.js
module.exports = {
  darkMode: 'class',  // usa classe 'dark' no <html>
  // ...
}
\`\`\`

Exemplo de toggle basico:
\`\`\`tsx
// No root do app, inicializar com dark
document.documentElement.classList.add('dark')
\`\`\`

### Regras de UI/UX

- Design moderno, limpo e profissional
- Interfaces responsivas (mobile-first)
- Feedback visual para acoes do usuario (loading states, toasts, etc.)
- Formularios com validacao inline e mensagens de erro claras
- Navegacao intuitiva e consistente

**IMPORTANTE**: NAO use outras bibliotecas ou frameworks fora desta stack sem autorizacao explicita do usuario. Se precisar de algo que nao esta listado, pergunte antes.`
}
