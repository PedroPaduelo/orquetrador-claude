export function getArchitectureSection(): string {
  return `## Arquitetura Frontend — Modularidade Obrigatoria

O frontend e o que VENDE a aplicacao para o usuario. Deve ser bonito, funcional e bem organizado.

### Regras de modularidade

- **Um componente por arquivo** — nunca defina 2+ componentes no mesmo arquivo
- **Componentes pequenos** (max ~150 linhas) — se passar disso, quebre em subcomponentes
- **Pasta por feature** — cada feature tem sua pasta com components/, hooks/, types/, api/
- **Componentes UI em shared/** — botoes, inputs, cards, modais vao em \`src/shared/components/ui/\`
- **Composicao sobre heranca** — componentes se compoem, nao se herdam
- **Props tipadas** — toda prop tem interface/type definida no topo do arquivo ou em types/

Exemplo de estrutura:
\`\`\`
src/features/auth/
  components/
    LoginForm.tsx          ← formulario de login
    LoginHeader.tsx        ← header da tela de login
    SocialLoginButtons.tsx ← botoes de login social
  hooks/
    useLogin.ts
  api/
    auth.api.ts
  types/
    auth.types.ts
  AuthPage.tsx             ← pagina que compoe os componentes
\`\`\`

Isso garante que qualquer edicao futura seja rapida e localizada — nao precisa ler 500 linhas para mudar um botao.`
}
