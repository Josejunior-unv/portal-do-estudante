# Skills do projeto

O Claude Code carrega automaticamente os skills desta pasta quando a sessão é
aberta no repositório. Cada um tem um `SKILL.md` com a descrição de quando usar.

## Do projeto (escritos para este código)

| Skill | Para quê |
| --- | --- |
| `verificar-projeto` | lint + testes + build + teste de fumaça E2E antes de commit/push |
| `nova-tela` | onde cada arquivo mora, regras da arquitetura, receitas de aba/rota/seção |
| `banco-supabase` | convenções do `supabase_migration.sql`, RLS, funções de admin, acervo UERJ |
| `deploy-vercel` | checklist de deploy, CSP, variáveis, armadilhas já vividas |

## De terceiros (copiados sem alteração, com a licença original)

| Skill | Origem | Licença |
| --- | --- | --- |
| `supabase` | [supabase/agent-skills](https://github.com/supabase/agent-skills) @ `c9be0e9` | MIT |
| `supabase-postgres-best-practices` | [supabase/agent-skills](https://github.com/supabase/agent-skills) @ `c9be0e9` | MIT |
| `vercel-react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) @ `063bee9` | MIT (declarada no README/frontmatter) |
| `vercel-composition-patterns` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) @ `063bee9` | MIT (declarada no README/frontmatter) |
| `webapp-testing` | Anthropic | Apache 2.0 (`LICENSE.txt`) |
| `frontend-design` | Anthropic | Apache 2.0 (`LICENSE.txt`) |

Observações:

- `vercel-react-best-practices` foi escrito pensando em Next.js. Aqui é uma SPA
  com Vite, então as regras `server-*` não se aplicam; as de `async-`,
  `bundle-`, `rerender-` e `client-` sim.
- **Não incluído de propósito:** `web-design-guidelines` (Vercel). Ele baixa as
  instruções de uma URL externa a cada uso, então o conteúdo pode mudar sem
  revisão.
- Para atualizar um skill de terceiros, copie a pasta nova do repositório de
  origem, leia o diff e atualize o commit na tabela acima.
