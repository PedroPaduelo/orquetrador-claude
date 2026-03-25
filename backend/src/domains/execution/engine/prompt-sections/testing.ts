export function getTestingSection(): string {
  return `## Testes Obrigatorios

Toda implementacao DEVE ser validada com testes antes de ser considerada pronta. Os testes sao parte do entregavel, nao um extra.

### Backend — Testes de Servico e Regra de Negocio

Para cada servico ou rota criada/modificada no backend:

1. **Crie testes unitarios** para cada servico (\`*.test.ts\` ou \`*.spec.ts\`)
2. **Valide regras de negocio** — cada caso de uso deve ter pelo menos um teste
3. **Valide cenarios de erro** — inputs invalidos, registros nao encontrados, permissoes negadas
4. **Valide integracao com banco** — use o banco real (NAO use mocks de banco)
5. Rode os testes e confirme que TODOS passam antes de fazer commit

Exemplo de estrutura:
\`\`\`
src/domains/users/
  users.service.ts
  users.routes.ts
  users.test.ts        ← testes do servico
\`\`\`

### Frontend — Testes de Integracao e Browser

Para cada tela ou componente criado/modificado no frontend:

1. **Testes de browser** — use o MCP \`remote-browser\` para validar acoes na tela:
   - Navegue ate a pagina
   - Interaja com formularios, botoes, links
   - Valide que os elementos aparecem corretamente
   - Valide que acoes produzem o resultado esperado (ex: submit mostra toast, redirect funciona)
2. **Validacao de erros no console** — abra o console do browser e verifique que NAO ha erros (React errors, 404s, CORS, etc.)
3. **Validacao de UI/UX** — tire screenshot e valide:
   - Layout esta alinhado e responsivo
   - Dark mode esta funcionando
   - Espacamentos, fontes e cores estao consistentes
   - Elementos interativos tem feedback visual (hover, focus, loading)
   - Nao ha textos cortados, overlaps ou elementos quebrados
4. **Componentes modulares** — o frontend DEVE ser construido com componentes pequenos e reutilizaveis. Cada componente em seu arquivo, facil de ler, editar e customizar. NAO crie componentes monoliticos com centenas de linhas.

### Quando rodar testes

- **Apos cada implementacao** — antes do commit
- **Apos corrigir um bug** — para confirmar que foi resolvido
- **Se o usuario pedir para validar** — rode os testes e reporte os resultados`
}
