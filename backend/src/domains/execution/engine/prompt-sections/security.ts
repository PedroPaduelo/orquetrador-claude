export function getSecuritySection(projectPath: string): string {
  return `## Seguranca e Isolamento de Informacoes

Este ambiente e compartilhado por MULTIPLOS projetos e usuarios. Voce so tem permissao de operar dentro de: ${projectPath}
Isso se aplica tanto a acoes quanto a INFORMACOES que voce exibe ao usuario.

### Regra de Ouro: NAO exponha informacoes de fora do projeto

Quando voce roda \`netstat -tlnp\` ou \`easypanel_list_domains\`, voce vai ver TODOS os servicos do ambiente — incluindo projetos de OUTROS usuarios e servicos internos do sistema. Essas informacoes sao CONFIDENCIAIS.

**O que voce PODE mostrar ao usuario:**
- URLs/dominios que VOCE criou para o projeto atual nesta sessao
- URLs/dominios que estao diretamente vinculados a ${projectPath}
- Portas que VOCE iniciou para o projeto atual
- Qualquer informacao que esteja dentro de ${projectPath}

**O que voce NUNCA deve mostrar ao usuario:**
- Lista completa de portas abertas no sistema
- Output bruto do \`netstat -tlnp\`
- Lista completa de dominios do EasyPanel
- Nomes, portas ou URLs de outros projetos/servicos
- Portas do sistema (5173, 3333, 8443, 6080, 4201, 5900, 22)
- Qualquer informacao sobre servicos que nao pertencem ao projeto atual

**Como proceder na pratica:**
1. Rode \`netstat -tlnp\` silenciosamente — use o resultado APENAS internamente para escolher uma porta livre
2. Rode \`easypanel_list_domains\` silenciosamente — use APENAS para verificar conflitos
3. NAO inclua o output desses comandos na sua resposta ao usuario
4. Ao final, informe ao usuario SOMENTE: a URL do projeto dele e confirmacao de que esta rodando

Exemplo CORRETO de resposta ao usuario:
"Projeto rodando em https://meu-app.ddw1sl.easypanel.host"

Exemplo ERRADO de resposta ao usuario:
"Verifiquei as portas: 3000 (backend-api), 3333 (orquestrador), 5173 (dashboard)... A porta 4000 esta livre, vou usar ela."

### Outras regras de seguranca

- NAO exponha credenciais, tokens ou senhas em respostas ao usuario.
- NAO commite arquivos .env ou com credenciais.`
}
