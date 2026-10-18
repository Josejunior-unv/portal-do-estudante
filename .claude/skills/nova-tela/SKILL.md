---
name: nova-tela
description: Como criar ou reorganizar telas, abas, serviços e hooks no Vestibular App seguindo a arquitetura por features (src/features), a sessão via useAuth, o kit de UI e o code-splitting. Use ao adicionar uma funcionalidade, aba do aluno, seção do painel do admin, rota nova ou ao decidir "onde esse arquivo deve ficar".
---

# Nova tela / funcionalidade

Arquitetura completa em `vestibular-app/docs/ARQUITETURA.md`. Resumo das regras:

## Onde cada coisa mora

| Pasta | O quê |
| --- | --- |
| `src/app/` | `App.jsx` (só rotas), `Guarda.jsx`, `rotas.js` (regras de acesso puras) |
| `src/features/<feature>/` | Telas **e** serviços de um domínio (`questoes`, `uerj`, `simulado`, `admin`...) |
| `src/components/ui/` | Kit visual compartilhado (`Botao`, `Cartao`, `Modal`, `CampoSenha`...) |
| `src/lib/` | Infra sem regra de negócio: cliente Supabase, `armazenamento`, `consultas` |
| `src/hooks/` | Hooks genéricos (`usePersistedState`, `useTema`, `useInsercoesRealtime`) |
| `src/constants/` | Listas fixas (matérias, áreas do conhecimento) |

Um arquivo usado por uma única feature fica dentro dela. Só suba para
`lib/`, `hooks/` ou `components/ui/` quando 2+ features precisarem.

## Regras

1. **Imports com `@/`** (ex.: `@/features/auth/useAuth`), nunca `../../`.
2. **Telas não falam com o Supabase.** Toda consulta vai para um
   `<algo>Service.js` da feature. A tela chama a função do serviço.
3. **Quem está logado:** `const { userId, nome, email, cargo, cronograma } = useAuth()`.
   Nunca chame `supabase.auth.getUser()` numa tela (é uma ida ao servidor).
   Páginas leem o contexto; componentes internos recebem props.
4. **localStorage:** só via `lerJSON`/`gravarJSON` de `@/lib/armazenamento`
   ou `usePersistedState` (para lembrar filtros/aba/matéria aberta).
5. **Mais de 1000 linhas do banco:** `coletarTudo` de `@/lib/consultas`
   (o PostgREST corta em 1000 silenciosamente).
6. **Tempo real:** `useInsercoesRealtime({ canal, tabela, filtro, aoInserir })`.
7. **Visual (identidade "prova + cartão-resposta", out/2026):** use o kit e a
   semântica `ink`/`gold`/`white`; nunca variantes `dark:`/`light:` (os temas
   PAPEL e NOITE trocam as variáveis sozinhos).
   - `gold-400` = amarelo de PREENCHIMENTO (botão, grifo, bolha marcada), com
     texto `text-sobre-destaque`. Como cor de TEXTO use `text-gold-300` (âmbar
     escuro no papel). Hover de botão amarelo: `hover:bg-gold-500`.
   - Peças da marca: `Grifo` (marca-texto), `Bolha`/`CartaoResposta` (respostas,
     progresso, escolhas), `SeloMateria` (sigla; **nada de emoji**).
   - Sem brilhos, glass/blur, gradientes decorativos, selos "Novo" e cartões de
     "número grande": prefira frase + lista/tabela. Copy em frases simples,
     sem slogan. Ícones: `lucide-react` (traço).
8. **Nomes:** componentes em PascalCase (`MinhasTarefas.jsx`), serviços em
   camelCase terminando em `Service.js`. O deploy é Linux: a caixa do nome
   do arquivo tem que bater com o import.

## Receitas

**Nova aba do aluno:** crie `src/features/<x>/<Tela>.jsx`, adicione em `MENU`
e no `switch` de `src/features/layout/AppShell.jsx` com `lazy(() => import(...))`
+ `<Suspense>` se for pesada. Acrescente `/app/<aba>` no `scripts/e2e/smoke.py`.

**Nova seção do admin:** componente em `src/features/admin/`, botão na lista de
seções do `PainelAdmin.jsx`. O admin inteiro já é carregado sob demanda.

**Nova rota:** em `src/app/App.jsx`, envolvida por `<Guarda exigir="...">`.
Se precisar de uma exigência nova, adicione em `rotas.js` **e** em `rotas.test.js`.

**Tabela nova:** veja o skill `banco-supabase`.

Termine com o skill `verificar-projeto`.
