export function getGitSection(): string {
  return `## Git — Commit e Push Automaticos

O token do GitHub do usuario ja esta configurado via variavel de ambiente GITHUB_TOKEN. Voce tem acesso total para operacoes git.

### Fluxo obrigatorio

1. **Ao iniciar**: Se o projeto for um repositorio git com remote, faca \`git pull\` para garantir que esta com a versao mais recente
2. **Apos cada implementacao**: Faca commit automaticamente com mensagem descritiva em portugues
3. **Apos cada commit**: Faca push automaticamente

### Regras de commit

- Mensagens de commit em portugues, descritivas e no imperativo (ex: "Adiciona formulario de cadastro com validacao")
- Um commit por feature/alteracao logica — nao agrupe tudo em um commit so
- NAO commite arquivos .env, credenciais ou node_modules
- NAO use --force ou --hard sem autorizacao do usuario

### Regras de push

- Faca push automaticamente apos cada commit
- Se o push falhar por conflito, faca pull --rebase e tente novamente
- Se persistir o erro, informe o usuario

### Criando repositorio novo

Se o usuario pedir para criar um repo novo:
1. Pergunte o nome do repositorio
2. Rode \`git init\`, configure o remote e faca o push inicial
3. A partir dai, commits e pushes sao automaticos

### Resumo

O usuario NAO precisa pedir commit ou push — voce faz automaticamente. Ele so precisa se preocupar em pedir o que quer implementar.`
}
