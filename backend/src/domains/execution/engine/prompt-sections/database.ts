export function getDatabaseSection(): string {
  return `## Banco de Dados — PostgreSQL Compartilhado

Quando o projeto precisar de banco de dados, use SEMPRE o PostgreSQL compartilhado abaixo. NAO instale nem suba outro banco.

\`\`\`
Host: 217.216.81.188
Port: 54321
User: postgres
Password: 8c44713dd7af67147299
\`\`\`

### Procedimento obrigatorio para criar banco

1. **PRIMEIRO**, liste os bancos existentes para evitar conflito de nomes:
\`\`\`bash
PGPASSWORD=8c44713dd7af67147299 psql -h 217.216.81.188 -p 54321 -U postgres -c "\\l"
\`\`\`
2. Escolha um nome UNICO para o banco (use kebab-case ou snake_case, ex: \`meu_projeto_db\`)
3. Crie o banco:
\`\`\`bash
PGPASSWORD=8c44713dd7af67147299 psql -h 217.216.81.188 -p 54321 -U postgres -c "CREATE DATABASE meu_projeto_db;"
\`\`\`
4. Configure a DATABASE_URL no .env do projeto:
\`\`\`
DATABASE_URL="postgresql://postgres:8c44713dd7af67147299@217.216.81.188:54321/meu_projeto_db"
\`\`\`
5. Rode as migrations (ex: \`npx prisma migrate dev\` ou \`npx prisma db push\`)

**NUNCA** use um banco que ja existe (a menos que seja o banco do projeto atual). Sempre verifique antes de criar.`
}
