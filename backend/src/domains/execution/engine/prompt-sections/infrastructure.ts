export function getInfrastructureSection(): string {
  return `## Acesso Externo e Dominios

O usuario NAO tem acesso direto as portas do container. Todo acesso e feito via dominios publicos HTTPS do EasyPanel. Sem dominio = sem acesso para o usuario.

### Portas INTOCAVEIS (NUNCA USE, NUNCA MATE, NUNCA MODIFIQUE)

Estas portas sao de servicos criticos do sistema. Se voce tocar nelas, voce QUEBRA o ambiente inteiro.

| Porta | Servico | Dominio |
|-------|---------|---------|
| 5173  | Orquestrador Frontend | orquestrador.app.ddw1sl.easypanel.host |
| 3333  | Orquestrador API | orquestrador.api.ddw1sl.easypanel.host |
| 8443  | Code Server (IDE) | lab-myke-lab-myke-2.ddw1sl.easypanel.host |
| 6080  | noVNC (Desktop remoto) | novnc.ddw1sl.easypanel.host |
| 4201  | Serende | serende.ddw1sl.easypanel.host |
| 5900  | VNC Server (interno) | — |
| 22    | SSH | — |

**NUNCA** faca NADA com essas portas: nao mate processos nelas, nao inicie servidores nelas, nao redirecione para elas, nao altere configs delas.

### Procedimento Obrigatorio para Servidores

ANTES de iniciar qualquer servidor:

1. Rode \`netstat -tlnp\` para ver portas ocupadas
2. Use \`easypanel_list_domains\` para ver dominios ativos
3. **VALIDE** que a porta escolhida NAO esta na lista de portas intocaveis acima
4. **VALIDE** que a porta escolhida NAO esta sendo usada por outro processo (verifique com netstat)
5. Se houver conflito, escolha OUTRA porta livre na faixa 3000-9000
6. Crie o dominio com \`easypanel_create_domain\` (nome limpo, kebab-case, sem prefixos como "lab-" ou "myke-")
7. Inicie o servidor com **pm2** (veja regra critica abaixo)
8. **REGISTRE** a porta e dominio no arquivo \`project-infra.json\` (veja secao abaixo)
9. Informe a URL \`https://{subdominio}.ddw1sl.easypanel.host\` ao usuario

### Registro de Infraestrutura — project-infra.json (OBRIGATORIO)

Todo projeto DEVE manter um arquivo \`project-infra.json\` na RAIZ do projectPath. Este arquivo registra todas as portas e dominios utilizados pelo projeto. Sem ele, outros usuarios e sessoes futuras nao sabem quais recursos estao em uso e podem causar conflitos.

**Ao iniciar o trabalho em um projeto**, verifique se o arquivo \`project-infra.json\` ja existe:
- **Se existir**: leia-o PRIMEIRO para saber quais portas e dominios ja estao em uso. Reutilize-os — NAO crie novos dominios/portas se os atuais ainda funcionam.
- **Se NAO existir**: crie-o assim que subir o primeiro servidor.

**Estrutura do arquivo:**

\`\`\`json
{
  "projectName": "nome-do-projeto",
  "createdAt": "2026-03-17T10:00:00Z",
  "updatedAt": "2026-03-17T12:30:00Z",
  "services": [
    {
      "name": "backend",
      "port": 4000,
      "pm2Name": "meu-projeto-backend",
      "domain": "meu-projeto-api.ddw1sl.easypanel.host",
      "url": "https://meu-projeto-api.ddw1sl.easypanel.host",
      "type": "api",
      "startCommand": "pm2 start npm --name meu-projeto-backend -- run start"
    },
    {
      "name": "frontend",
      "port": 4001,
      "pm2Name": "meu-projeto-frontend",
      "domain": "meu-projeto.ddw1sl.easypanel.host",
      "url": "https://meu-projeto.ddw1sl.easypanel.host",
      "type": "frontend",
      "startCommand": "pm2 start npx --name meu-projeto-frontend -- vite --port 4001 --host 0.0.0.0"
    },
    {
      "name": "docs",
      "port": 4002,
      "pm2Name": "docs-meu-projeto",
      "domain": "docs-meu-projeto.ddw1sl.easypanel.host",
      "url": "https://docs-meu-projeto.ddw1sl.easypanel.host",
      "type": "docs",
      "startCommand": "pm2 start npx --name docs-meu-projeto -- serve docs/ -l 4002 --no-clipboard"
    }
  ]
}
\`\`\`

**Regras do project-infra.json:**

1. **SEMPRE** atualize o arquivo quando criar, remover ou alterar um servico (porta, dominio, pm2 name)
2. **SEMPRE** atualize o campo \`updatedAt\` a cada modificacao
3. O campo \`startCommand\` deve conter o comando EXATO para reiniciar o servico — isso permite que sessoes futuras relevantem o projeto sem adivinhar
4. O campo \`type\` identifica o papel do servico: \`api\`, \`frontend\`, \`docs\`, \`worker\`, \`websocket\`, etc.
5. **NAO** inclua este arquivo no .gitignore — ele DEVE ser commitado para que todos os usuarios/sessoes tenham acesso
6. Ao encerrar/remover um servico, REMOVA a entrada correspondente do arquivo

**Por que isso e importante:** Este ambiente e multi-usuario. Sem este arquivo, uma nova sessao ou outro usuario pode escolher a mesma porta, criar dominio duplicado, ou nao saber como reiniciar os servicos do projeto. O \`project-infra.json\` e a fonte de verdade da infraestrutura do projeto.

### REGRA CRITICA: Servidores DEVEM rodar com pm2 — Ambiente Multi-Usuario

Este ambiente e compartilhado por MULTIPLOS usuarios, cada um rodando seus proprios projetos. Isso significa que existem DEZENAS de processos pm2, portas e dominios ativos simultaneamente. Se voce nao seguir as regras abaixo, voce pode DERRUBAR o projeto de outro usuario.

Voce opera dentro de um CLI que abre, executa, e FECHA. Se voce rodar um servidor vinculado ao seu processo (ex: \`npm run dev\` direto), quando o CLI fechar, o servidor MORRE junto e o usuario perde o acesso.

**SEMPRE** use \`pm2\` para gerenciar servidores. O pm2 garante que o processo:
- Continua rodando apos o CLI fechar
- Reinicia automaticamente se crashar
- Tem logs organizados e acessiveis
- E IDENTIFICAVEL por nome — outros usuarios/sessoes podem ver o que esta rodando sem conflito

#### Regras de convivencia multi-usuario

1. **Nomes pm2 UNICOS e descritivos** — use o padrao \`{nome-do-projeto}-{servico}\` (ex: \`loja-virtual-backend\`, \`loja-virtual-frontend\`). NUNCA use nomes genericos como \`server\`, \`app\`, \`backend\`, \`dev\` — eles vao colidir com outros projetos.
2. **NUNCA mate processos que nao sao seus** — ao rodar \`pm2 list\`, voce vera processos de OUTROS projetos/usuarios. NAO faca \`pm2 stop\`, \`pm2 delete\`, \`pm2 restart\` ou \`pm2 kill\` em processos que nao pertencem ao seu projeto. Identifique os seus pelo nome que voce definiu.
3. **NUNCA faca \`pm2 kill\`** — isso mata TODOS os processos de TODOS os usuarios. Se precisar parar seus processos, use \`pm2 stop nome-do-seu-servico\` e \`pm2 delete nome-do-seu-servico\` individualmente.
4. **NUNCA use \`killall\`, \`pkill\` ou \`kill -9\` em processos de porta** sem verificar que o processo e SEU. Verifique o PID com \`netstat -tlnp\` e confirme que pertence ao seu projeto.
5. **Portas sao recursos compartilhados** — antes de usar uma porta, SEMPRE verifique se esta livre. Se estiver ocupada, NAO mate o processo — escolha outra porta.

\`\`\`bash
# Instalar pm2 se nao tiver (so precisa uma vez)
npm install -g pm2 2>/dev/null

# Iniciar servidor Node/Express/Fastify
pm2 start npm --name "meu-projeto-backend" -- run start

# Iniciar com script especifico
pm2 start server.js --name "meu-projeto-backend"

# Iniciar Vite (dev server)
pm2 start npx --name "meu-projeto-frontend" -- vite --port 4000 --host 0.0.0.0

# Iniciar Next.js
pm2 start npx --name "meu-projeto-frontend" -- next start -p 4000

# Iniciar Python
pm2 start python --name "meu-projeto-api" -- app.py

# Ver APENAS seus processos (filtre visualmente pelo nome do projeto)
pm2 list

# Ver logs do SEU servico
pm2 logs meu-projeto-backend

# Parar APENAS o seu servico
pm2 stop meu-projeto-backend

# Deletar APENAS o seu servico
pm2 delete meu-projeto-backend

# Reiniciar APENAS o seu servico apos alteracoes
pm2 restart meu-projeto-backend
\`\`\`

**NUNCA** rode servidores assim:
- \`npm run dev\` (sem pm2)
- \`npx vite\` (sem pm2)
- \`node server.js\` (sem pm2)
- \`nohup ... &\` (use pm2 em vez de nohup, e mais facil de gerenciar)

### Siga a Estrutura Proposta — Excecoes Apenas com Justificativa

As regras acima (pm2, nomes unicos, project-infra.json, dominios via EasyPanel) sao o PADRAO OBRIGATORIO. Voce so pode desviar delas em DUAS situacoes:

1. **O projeto ja tem uma estrutura de deploy diferente e funcional** (ex: Docker Compose proprio, scripts de deploy customizados, Makefile com targets de start/stop). Nesse caso, respeite a estrutura existente e adapte-se a ela — mas AINDA assim registre portas e dominios no \`project-infra.json\`.
2. **O usuario pede explicitamente** para usar outra abordagem (ex: "use Docker em vez de pm2", "nao precisa de dominio").

Fora dessas duas situacoes, **SIGA O PADRAO**. Nao invente, nao "melhore", nao substitua. A padronizacao e o que permite que multiplos usuarios coexistam sem conflito neste ambiente.

### Projetos Vite — Configuracao de allowedHosts OBRIGATORIA

Quando criar ou modificar um projeto que usa Vite (React, Vue, Svelte, etc.), voce DEVE configurar o \`vite.config\` para liberar TODOS os hosts. Sem isso, o Vite bloqueia requisicoes externas e o usuario recebe erro "Blocked request. This host is not allowed."

**SEMPRE** use \`allowedHosts: 'all'\` no server E no preview. NAO use array de hosts especificos — use sempre \`'all'\` para evitar problemas com dominios do EasyPanel.

\`\`\`ts
// vite.config.ts
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: PORTA_ESCOLHIDA,
    allowedHosts: 'all',   // OBRIGATORIO — libera qualquer host
    cors: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: 'all',   // OBRIGATORIO — libera qualquer host
    cors: true,
  },
  // ... resto da config
})
\`\`\`

Se o projeto ja existir e voce estiver apenas subindo o servidor, verifique se o \`vite.config\` ja tem \`allowedHosts: 'all'\`. Se tiver \`allowedHosts: true\` ou um array de hosts, troque para \`'all'\` ANTES de iniciar o servidor.

Apos iniciar, verifique se o processo esta rodando: \`netstat -tlnp | grep PORTA\`

### Ao encerrar um projeto

1. Pare o processo: \`pm2 stop nome-do-projeto && pm2 delete nome-do-projeto\`
2. Delete o dominio com \`easypanel_delete_domain\` usando o ID do dominio
3. Confirme que a porta foi liberada com \`netstat -tlnp | grep PORTA\``
}
