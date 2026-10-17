"""Teste de fumaça E2E: abre todas as telas com o Supabase SIMULADO.

Nenhuma requisição chega ao banco real: auth, REST e storage são
interceptados pelo Playwright e respondidos com dados falsos. Serve para
garantir que nenhuma tela quebra (erro de console / exceção) depois de uma
refatoração.

Uso (com o `npm run dev` rodando em outro terminal):
    pip install playwright && python -m playwright install chromium
    python scripts/e2e/smoke.py [pasta_screenshots]

Variáveis: E2E_BASE (padrão http://localhost:5173).
"""
import base64
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:5173")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(OUT, exist_ok=True)

REF = "plyavsgrxdxfzhoidqwk"  # projeto Supabase (mesmo de src/lib/supabase.js)
UID = "11111111-2222-3333-4444-555555555555"
CRONOGRAMA = [
    {"nome": "Matemática", "horas": "3.0"},
    {"nome": "Português", "horas": "2.0"},
    {"nome": "Física", "horas": "2.0"},
]


def b64(d):
    return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")


def sessao_falsa():
    exp = int(time.time()) + 86400
    jwt = ".".join([
        b64({"alg": "HS256", "typ": "JWT"}),
        b64({"sub": UID, "exp": exp, "role": "authenticated", "aud": "authenticated"}),
        "assinatura",
    ])
    user = {
        "id": UID, "aud": "authenticated", "role": "authenticated", "email": "teste@exemplo.com",
        "user_metadata": {"nome": "Aluno Teste"}, "app_metadata": {"provider": "email"},
        "created_at": "2026-01-01T00:00:00Z",
    }
    return user, {"access_token": jwt, "token_type": "bearer", "expires_in": 86400,
                  "expires_at": exp, "refresh_token": "falso", "user": user}


USER, SESSAO = sessao_falsa()


def simular_supabase(page, cargo, com_cronograma=True):
    def rest(route):
        req = route.request
        tabela = req.url.split("/rest/v1/")[1].split("?")[0]
        if req.method != "GET" and not tabela.startswith("rpc/"):
            return route.fulfill(status=201, json=[])
        dados = []
        if tabela == "profiles":
            dados = [{"cargo": cargo}] if cargo == "admin" else []
        elif tabela == "cronogramas" and com_cronograma:
            dados = [{"dados_cronograma": CRONOGRAMA}]
        elif tabela == "questoes_respondidas":
            dados = [{"usuario_id": UID, "acertou": i % 2 == 0, "materia": "Matemática",
                      "data": f"2026-10-1{i % 7}"} for i in range(6)]
        if "vnd.pgrst.object" in req.headers.get("accept", ""):
            return route.fulfill(status=200, json=dados[0] if dados else {})
        return route.fulfill(status=200, json=dados, headers={
            "content-range": f"0-{max(len(dados) - 1, 0)}/{len(dados)}",
            "access-control-expose-headers": "content-range",
        })

    base = f"https://{REF}.supabase.co"
    page.route(f"{base}/rest/v1/**", rest)
    page.route(f"{base}/auth/v1/user**", lambda r: r.fulfill(status=200, json=USER))
    page.route(f"{base}/auth/v1/logout**", lambda r: r.fulfill(status=204, body=""))
    page.route(f"{base}/storage/v1/**", lambda r: r.fulfill(status=200, json=[]))
    page.route(f"{base}/realtime/**", lambda r: r.abort())


falhas = []


def checar(nome, cond, detalhe=""):
    print(f"  {'ok ' if cond else 'FALHOU'} {nome} {detalhe}")
    if not cond:
        falhas.append(nome)


def nova_pagina(browser, cargo, com_cronograma=True, logado=True):
    ctx = browser.new_context(viewport={"width": 1280, "height": 860})
    if logado:
        ctx.add_init_script(f"localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(SESSAO))})")
    page = ctx.new_page()
    page.erros = []
    page.on("console", lambda m: m.type == "error" and page.erros.append(m.text[:200]))
    page.on("pageerror", lambda e: page.erros.append("EXCEÇÃO " + str(e)[:200]))
    simular_supabase(page, cargo, com_cronograma)
    return page


def visitar(page, rota, foto):
    page.erros.clear()
    page.goto(BASE + rota)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(OUT, foto + ".png"))
    return page.url.replace(BASE, "")


with sync_playwright() as p:
    browser = p.chromium.launch()

    print("Visitante")
    pg = nova_pagina(browser, "aluno", logado=False)
    checar("rota protegida leva ao login", visitar(pg, "/app/estatisticas", "visitante_login") == "/login")
    pg.get_by_text("Esqueceu a senha?").click()
    checar("modo recuperar senha", pg.get_by_role("button", name="Enviar link de recuperação").is_visible())
    visitar(pg, "/redefinir-senha#error=access_denied&error_code=otp_expired", "visitante_link_expirado")
    checar("link expirado avisa", "expirou" in pg.locator("body").inner_text())
    checar("sem erros de console", not pg.erros, str(pg.erros))

    print("Aluno")
    pg = nova_pagina(browser, "aluno")
    for aba in ["cronograma", "tarefas", "simulados", "enem", "materiais", "estatisticas"]:
        final = visitar(pg, f"/app/{aba}", f"aluno_{aba}")
        checar(f"/app/{aba}", final == f"/app/{aba}" and not pg.erros, str(pg.erros or final))
    checar("aluno não entra no /admin", visitar(pg, "/admin", "aluno_admin_negado") == "/app/cronograma")
    pg.get_by_role("button", name="Alterar senha").first.click()
    pg.wait_for_timeout(400)
    checar("modal Alterar senha", pg.get_by_role("heading", name="Alterar senha").is_visible())
    pg.keyboard.press("Escape")
    pg.goto(BASE + "/app/cronograma")
    pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name="Sair da conta").first.click()
    pg.wait_for_url("**/login")
    checar("Sair volta ao login", pg.url.endswith("/login"))

    print("Aluno sem cronograma")
    pg = nova_pagina(browser, "aluno", com_cronograma=False)
    checar("vai para o onboarding", visitar(pg, "/app/cronograma", "aluno_onboarding") == "/onboarding" and not pg.erros, str(pg.erros))

    print("Admin")
    pg = nova_pagina(browser, "admin")
    checar("/admin", visitar(pg, "/admin", "admin") == "/admin" and not pg.erros, str(pg.erros))
    for secao in ["Materiais", "Provas UERJ", "Notícias", "Usuários"]:
        pg.erros.clear()
        pg.get_by_role("button", name=secao, exact=True).first.click()
        pg.wait_for_timeout(800)
        pg.screenshot(path=os.path.join(OUT, f"admin_{secao.replace(' ', '_')}.png"))
        checar(f"seção {secao}", not pg.erros, str(pg.erros))

    browser.close()

print(f"\n{len(falhas)} falha(s)" + (f": {falhas}" if falhas else " — tudo certo"))
sys.exit(1 if falhas else 0)
