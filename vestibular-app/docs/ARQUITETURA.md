# Arquitetura do frontend

SPA em React 19 + Vite 8 + Tailwind v4, com Supabase (Auth + Postgres + Storage
+ Realtime) como backend. Organização **por funcionalidade**: cada pasta de
`src/features/` junta as telas e os serviços de um domínio.

```
src/
├── main.jsx                 BrowserRouter → AuthProvider → App
├── app/
│   ├── App.jsx              só as rotas (admin e onboarding carregados sob demanda)
│   ├── Guarda.jsx           aplica a regra de acesso de cada rota
│   ├── rotas.js             regras de acesso puras (+ rotas.test.js)
│   └── TelaCarregando.jsx
├── lib/                     infraestrutura sem regra de negócio
│   ├── supabase.js          cliente + HASH_INICIAL (link de recuperação de senha)
│   ├── armazenamento.js     lerJSON / gravarJSON (localStorage à prova de falha)
│   └── consultas.js         coletarTudo (paginação do PostgREST, limite de 1000)
├── hooks/                   usePersistedState, useTema, useInsercoesRealtime
├── components/ui/           kit visual (Botao, Cartao, Modal, CampoSenha...)
├── constants/               matérias, áreas do conhecimento
└── features/
    ├── auth/                AuthProvider + useAuth, Login, RedefinirSenha,
    │                        AlterarSenhaModal, authService, perfilService
    ├── layout/              AppShell (sidebar + abas do aluno)
    ├── inicio/              Home (dashboard)
    ├── onboarding/          assistente + cronograma.js + cronogramaService
    ├── tarefas/             MinhasTarefas + tarefasStatusService
    ├── materiais/           materiaisService, storageService (PDFs)
    ├── biblioteca/          BibliotecaProvas
    ├── questoes/            QuestoesHub, QuestoesEnem, QuestaoCard, enemService
    ├── uerj/                banco/provas/simulado UERJ + serviços
    ├── simulado/            Simulado ENEM + simuladosService
    ├── estatisticas/        Estatisticas + estatisticasService
    ├── noticias/            NoticiasDestaque + noticiasService
    └── admin/               AreaAdmin, PainelAdmin, Gerenciar*, usuariosService
```

## Fluxo da sessão

1. `AuthProvider` escuta `supabase.auth.onAuthStateChange`. Quando o usuário
   muda (login, logout, troca de conta), carrega **cargo** (`profiles`) e
   **cronograma** (`cronogramas`) em paralelo e só então libera a tela.
   Re-emissões da mesma sessão (foco na aba, refresh de token) são ignoradas
   para não remontar a árvore e perder o estado da tela.
2. Evento `PASSWORD_RECOVERY` (link do e-mail) → navega para `/redefinir-senha`.
3. Qualquer componente lê a sessão com `useAuth()`:
   `{ user, userId, email, nome, cargo, cronograma, temCronograma, carregando, recarregarCronograma, sair }`.

## Rotas

| Rota | Exigência | Quem passa |
| --- | --- | --- |
| `/login` | `visitante` | só quem não está logado |
| `/redefinir-senha` | — | todos (a tela decide pelo `user`) |
| `/onboarding` | `onboarding` | aluno sem cronograma |
| `/app/:aba` | `aluno` | aluno com cronograma |
| `/admin` | `admin` | `cargo = 'admin'` |

Quem não passa é redirecionado para `rotaInicial()` (ver `rotas.js`).

## Regras da casa

- Imports absolutos com `@/` (alias no `vite.config.js` e `jsconfig.json`).
- Telas não chamam o Supabase: consultas ficam no `*Service.js` da feature.
- Nada de `supabase.auth.getUser()` em tela: use `useAuth()`.
- localStorage só via `@/lib/armazenamento` ou `usePersistedState`.
- Regra de negócio nova = função pura no serviço + teste ao lado.
- Visual: kit de `components/ui` e semântica `ink`/`gold`/`white`, sem
  variantes `dark:`/`light:`.

## Identidade visual

Tirada da prova da UERJ: tema PAPEL (padrão, segue o sistema) e NOITE; amarelo
marca-texto (`gold-400`) só como preenchimento/grifo, laranja do selo
"QUESTÃO" (`text-laranja`), verde/vermelho da correção. Títulos em Archivo
condensada; texto em Atkinson Hyperlegible Next (+ Mono para números e
letras). Peças do kit: `Grifo`, `Bolha`, `CartaoResposta`, `SeloMateria`.

A questão da UERJ é exibida pelo **recorte** do PDF oficial (`recorte_url`),
com o texto de apoio ao lado em tela larga. No celular abre como texto quando
`texto_confiavel` (sem figura nem fração). Ver `scripts/importador_uerj/revisao/`.

## Qualidade

| Comando | O quê |
| --- | --- |
| `npm run verificar` | lint + 55 testes unitários + build |
| `npm run test:watch` | testes em modo observação |
| `python scripts/e2e/smoke.py` | abre todas as telas com o Supabase simulado (precisa do `npm run dev`) |
| `python scripts/e2e/visual_questoes.py` | capturas da tela de questão com dados reais da revisão (`E2E_TEMA=dark` para o modo noite) |

O CI (`.github/workflows/ci.yml`, na raiz do repositório) roda lint + testes
+ build em Linux a cada push e PR.

## Skills do Claude Code

`.claude/skills/` (raiz do repositório) traz skills do projeto
(`verificar-projeto`, `nova-tela`, `banco-supabase`, `deploy-vercel`) e skills
oficiais do Supabase, da Vercel e da Anthropic. Ver `.claude/skills/README.md`.
