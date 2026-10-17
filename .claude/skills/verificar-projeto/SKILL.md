---
name: verificar-projeto
description: Verificação obrigatória do Vestibular App (UERJ Para Todos) antes de commitar, abrir PR ou dar push — lint, testes unitários, build e teste de fumaça E2E com o Supabase simulado. Use ao terminar qualquer mudança em vestibular-app/, quando pedirem "pode commitar", "testa aí", "tá funcionando?", e SEMPRE antes de push no master (o push faz deploy em produção).
---

# Verificar o projeto

O app fica em `vestibular-app/`. Rode tudo a partir dessa pasta.

## 1. Lint + testes + build (obrigatório)

```bash
npm run verificar        # = npm run lint && npm test && npm run build
```

- O lint usa `eslint-plugin-react-hooks` v7, que é estrito: nada de `setState`
  síncrono dentro de `useEffect` nem leitura de `ref.current` durante o render.
- Testes ficam ao lado do código (`*.test.js`) e cobrem regras puras. Ao criar
  uma regra de negócio nova (cálculo, filtro, validação), extraia uma função
  pura para o serviço da feature e teste-a.
- Mudou um serviço que importa `@/lib/supabase`? No teste, use
  `vi.mock("@/lib/supabase", () => ({ supabase: {} }))` + `await import(...)`.

## 2. Teste de fumaça E2E (quando mexer em telas, rotas ou sessão)

Com o servidor de desenvolvimento rodando (`npm run dev`) em outro terminal:

```bash
python scripts/e2e/smoke.py
```

- Abre todas as telas como visitante, aluno, aluno sem cronograma e admin.
- **O Supabase é simulado** pelo Playwright: nenhuma requisição chega ao banco
  de produção, então pode rodar à vontade.
- Screenshots em `scripts/e2e/screenshots/` (ignorados pelo git). Olhe pelo
  menos as telas que você alterou.
- Tela nova? Acrescente a rota na lista do `smoke.py`.

No Windows, se `npm ci` falhar com `EPERM ... lightningcss`, há um Vite
rodando e travando o arquivo: pare o `npm run dev` antes.

## 3. Antes do push

- `master` = produção (deploy automático na Vercel). Trabalho grande vai numa
  branch; a Vercel gera uma URL de preview para cada branch enviada.
- O CI (`.github/workflows/ci.yml`) roda lint + test + build em Linux. Import
  com maiúscula/minúscula errada passa no Windows e quebra lá — é esperado que
  o CI pegue.
- Veja também o skill `deploy-vercel`.
