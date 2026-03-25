export function getFinalizationSection(): string {
  return `## Finalizacao de Implementacao

Toda vez que voce terminar uma demanda (feature, correcao, alteracao) em uma aplicacao, voce DEVE seguir TODOS estes passos na ordem. Nao pule nenhum.

### Passo 1 — Testes

- **Backend**: rode testes de servico e regra de negocio. Todos devem passar.
- **Frontend**: use o MCP \`remote-browser\` para validar acoes na tela, checar console sem erros, validar UI/UX.

### Passo 2 — Build e Deploy

1. Rode o build do projeto (\`npm run build\` ou equivalente)
2. Reinicie o servidor: \`pm2 restart nome-do-projeto\`
3. Confirme que subiu: \`pm2 list\` e \`netstat -tlnp | grep PORTA\`

### Passo 3 — Garantir que o servico reflete as alteracoes

Este passo e CRITICO. O usuario precisa ter certeza de que o que esta rodando e de fato o que foi alterado.

1. **Abra a aplicacao no browser** (via remote-browser) usando a URL publica do dominio
2. **Navegue ate a funcionalidade que foi criada/alterada**
3. **Valide visualmente** que a mudanca esta la — tire screenshot se necessario
4. Se a mudanca NAO aparecer:
   - Verifique se o build foi feito corretamente
   - Verifique se o pm2 restart pegou o build novo (\`pm2 logs nome-do-projeto --lines 20\`)
   - Limpe cache se necessario (\`pm2 delete\` + \`pm2 start\` do zero)
   - Repita ate confirmar

NAO diga ao usuario que esta pronto se voce nao verificou no browser que a alteracao esta de fato rodando.

### Passo 4 — Documentacao

1. Atualize o arquivo de task em \`docs/tasks/\` com status concluido, o que foi feito e arquivos alterados
2. Crie/atualize o **Guia de Uso** em \`docs/guides/\` (veja abaixo)
3. Reinicie o servidor de docs se necessario: \`pm2 restart docs-NOME-PROJETO\`

### Passo 5 — Commit e Push

Commit automatico com mensagem descritiva em portugues + push.

### Passo 6 — Entrega ao usuario

Responda ao usuario com a **Entrega Completa** no formato abaixo. Este e o momento mais importante — o usuario precisa sair com clareza total do que foi feito e como usar.

---

## Guia de Uso (docs/guides/)

Sempre que concluir uma demanda, crie ou atualize um guia em \`docs/guides/\` que ensine o usuario a explorar e usar o que foi feito. Isso e OBRIGATORIO.

### Estrutura

\`\`\`
docs/guides/
  guia-autenticacao.html    ← como usar o login/registro
  guia-dashboard.html       ← como usar o dashboard
  guia-api.html             ← endpoints disponiveis e como testar
\`\`\`

### Cada guia DEVE conter

1. **O que e** — descricao curta da funcionalidade
2. **Como acessar** — URL direta + caminho de navegacao
3. **Como usar** — passo a passo com screenshots ou descricoes visuais
4. **Funcionalidades disponiveis** — lista do que da pra fazer
5. **Exemplos praticos** — cenarios de uso real (ex: "Para cadastrar um usuario, clique em...")
6. **Endpoints da API** (se backend) — metodo, rota, body esperado, resposta, exemplo com curl
7. **Dicas** — atalhos, filtros, configuracoes uteis

### Formato

Os guias DEVEM ser em **HTML** (nao .md), seguindo o mesmo tema visual do frontend do projeto (cores, fontes, dark mode). O usuario acessa via browser pela URL dos docs.

---

## Formato da Entrega Completa

Ao finalizar, sua resposta ao usuario DEVE seguir este formato:

\`\`\`
📋 Progresso:
1. ✅ Estrutura do projeto
2. ✅ API de autenticacao
3. ✅ Tela de login ← concluido agora
4. ⬚ Dashboard

---

## O que foi feito

Implementei a tela de login com validacao de campos e integracao com a API.

**Alteracoes:**
- Criado LoginForm, LoginHeader e SocialLoginButtons
- Adicionada validacao com Zod (email obrigatorio, senha min 6 chars)
- Integrado com POST /api/auth/login
- Adicionado redirect para /dashboard apos login

**Testes:** 8/8 passando (3 servico + 5 browser)
**Commit:** "Implementa tela de login com validacao e integracao com API"

---

## Como usar

1. Acesse https://meu-app.ddw1sl.easypanel.host
2. Clique em "Entrar" no header
3. Preencha email e senha
4. Clique em "Login" — voce sera redirecionado para o dashboard
5. Para criar uma conta, clique em "Cadastre-se" abaixo do formulario

**Dica:** Use email: admin@teste.com / senha: 123456 para testar com o usuario seed.

---

## Links

| O que | URL |
|-------|-----|
| Aplicacao | https://meu-app.ddw1sl.easypanel.host |
| Docs e Guias | https://docs-meu-app.ddw1sl.easypanel.host |
| API Swagger | https://meu-app.ddw1sl.easypanel.host/docs |
| Guia do Login | https://docs-meu-app.ddw1sl.easypanel.host/guides/guia-login.html |

---

✅ Verificado: abri a aplicacao no browser e confirmei que a tela de login esta funcionando com as alteracoes.
\`\`\`

### Regras importantes

- A secao "Como usar" e OBRIGATORIA. Nao e opcional. O usuario precisa saber COMO explorar o que foi feito.
- A tabela de links DEVE listar TODOS os dominios/URLs relevantes do projeto.
- A linha "Verificado" so pode aparecer se voce DE FATO abriu no browser e confirmou.
- Se algo nao esta funcionando, NAO diga que esta pronto. Informe o problema e o que esta fazendo para resolver.
- Se a demanda nao altera o servidor (ex: editar um README), nao precisa rebuild/restart/browser check. Use bom senso.`
}
