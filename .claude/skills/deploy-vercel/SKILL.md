---
name: deploy-vercel
description: Checklist de deploy do Vestibular App na Vercel (produção em vest-app-nine.vercel.app, deploy automático a cada push no master, Root Directory vestibular-app). Use antes de push no master, ao configurar variáveis de ambiente, ao consumir uma API nova (CSP), ao mexer em rotas/SPA fallback ou quando o build quebrar só em produção.
---

# Deploy (Vercel)

- **Produção:** https://vest-app-nine.vercel.app — deploy automático a cada
  `git push` no `master`. Toda outra branch enviada ganha uma **URL de preview**
  (veja na aba *Deployments* da Vercel ou no PR do GitHub).
- **Root Directory = `vestibular-app`** (o repositório tem a app numa subpasta).
- **Node:** fixado em `engines.node` (`24.x`) e `.nvmrc`. A Vercel respeita o
  `engines`.

## Antes de mandar para o master

1. `npm run verificar` passou (skill `verificar-projeto`).
2. O CI do GitHub está verde na branch.
3. Abriu a URL de preview e testou o fluxo alterado.
4. Mudou o banco? A PARTE nova do `supabase_migration.sql` já rodou no
   Supabase de produção **antes** do deploy (o código novo pode depender dela).

## Armadilhas que já aconteceram

- **Caixa do nome do arquivo:** a Vercel é Linux. `import X from "./Login"`
  com o arquivo `login.jsx` funciona no Windows e quebra o build lá.
- **CSP (`vercel.json`):** a política é restrita. Ao chamar um domínio novo
  (API, imagem, fonte), inclua-o em `connect-src`/`img-src`/`font-src`, senão
  o navegador bloqueia em produção (no `npm run dev` não há CSP).
- **SPA fallback:** o `rewrites` do `vercel.json` manda toda rota para o
  `index.html`. Sem ele, recarregar `/app/...` dá 404.
- **Scripts inline são bloqueados pela CSP** (`script-src 'self'`). Por isso o
  tema é aplicado por `public/tema.js`, não por `<script>` inline.

## Variáveis de ambiente

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Settings → Environment
Variables). Só variáveis `VITE_*` chegam ao navegador — nunca coloque a
`service_role` com esse prefixo.

## Auth (e-mails de senha)

Novos domínios de deploy precisam estar em *Supabase → Authentication → URL
Configuration → Redirect URLs* (`https://<domínio>/redefinir-senha`), senão o
link de recuperação de senha volta para a Site URL. Detalhes em
`vestibular-app/docs/AUTENTICACAO_EMAIL.md`.
