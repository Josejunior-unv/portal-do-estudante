---
name: banco-supabase
description: Convenções do banco do Vestibular App — o arquivo único e idempotente supabase_migration.sql (dividido em PARTES), RLS, funções de admin SECURITY DEFINER e o pipeline do importador UERJ. Use ao criar/alterar tabela, coluna, policy, função RPC, bucket ou ao corrigir dados do acervo UERJ. Complementa os skills oficiais `supabase` e `supabase-postgres-best-practices`.
---

# Banco de dados (Supabase)

Leia também os skills oficiais `supabase` (checklist de segurança) e
`supabase-postgres-best-practices` (índices, RLS performática).

## Como o schema é versionado aqui

- **Um arquivo só:** `vestibular-app/supabase_migration.sql`. O dono roda o
  arquivo **inteiro** no *SQL Editor* do Supabase (não usamos Supabase CLI).
  Rodar só um trecho deixa policies antigas ativas.
- **Tem que ser idempotente** (rodar 2x não pode quebrar nem duplicar):
  `create table if not exists`, `add column if not exists`,
  `drop policy if exists ...; create policy ...`, `create or replace function`,
  `on conflict do nothing/update` em dados.
- Mudança nova = **nova PARTE no fim do arquivo**, com cabeçalho
  `-- PARTE N — o quê (data)` explicando o motivo. Não reescreva partes antigas.
- Não temos acesso ao banco daqui. Depois de mudar o SQL, **diga ao usuário
  qual parte rodar** e o que verificar. O frontend deve degradar com elegância
  se a parte ainda não rodou (tabela ausente → lista vazia, não tela quebrada).

## Segurança (não negociável)

- **RLS ligada em toda tabela de `public`.** Policies por dono usam
  `to authenticated using ((select auth.uid()) = user_id)`; UPDATE precisa de
  `using` **e** `with check`.
- Escrita de conteúdo (materiais, notícias, provas) só para admin: a checagem
  é `exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.cargo = 'admin')`.
- **Cargo nunca vem de `user_metadata`** (o usuário consegue editar). Cargo
  mora em `public.profiles.cargo`.
- Funções de admin (`admin_listar_usuarios`, `admin_definir_cargo`) são
  `security definer` + `set search_path = public` e **checam por dentro** se
  `auth.uid()` é admin. Função nova desse tipo segue o mesmo molde.
- A chave anon/publishable no frontend é pública por design. A
  `service_role` só existe no importador Python (variável de ambiente), nunca
  no `src/` nem no git.

## Acervo UERJ

- Tabelas `provas_uerj`, `questoes_uerj`, `uerj_import_logs` são alimentadas
  pelo pipeline `scripts/importador_uerj/` (ver o README de lá).
- Correção de dados publicados = nova PARTE com `update ... where id in (...)`
  verificada; e corrija também a causa no pipeline para não reintroduzir.
- Questões de língua estrangeira **nunca** recebem gabarito.

## No frontend

Consultas ficam em `src/features/<feature>/<x>Service.js`. Mais de 1000
linhas → `coletarTudo` (`@/lib/consultas`). RPC de admin →
`src/features/admin/usuariosService.js` como modelo.
