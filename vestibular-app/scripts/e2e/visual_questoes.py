"""Capturas da tela de questões da UERJ com dados REAIS da revisão.

Usa dados/revisao/pacote.json (gerado por scripts/importador_uerj/revisao) e
serve os recortes locais no lugar do Storage. O Supabase é simulado: nada é
lido nem gravado no banco de produção.

Uso (com `npm run dev` rodando):  python scripts/e2e/visual_questoes.py [pasta]
"""
import json
import os
import re
import sys
import time
import base64
from urllib.parse import urlparse, parse_qs, unquote

from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REV = os.path.join(RAIZ, "scripts", "importador_uerj", "dados", "revisao")
BASE = os.environ.get("E2E_BASE", "http://localhost:5173")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(OUT, exist_ok=True)
REF = "plyavsgrxdxfzhoidqwk"
TEMA = os.environ.get("E2E_TEMA", "light")

pacote = json.load(open(os.path.join(REV, "pacote.json"), encoding="utf-8"))
provas = {p["id"]: p for p in json.load(open(os.path.join(REV, "provas_uerj.json"), encoding="utf-8"))}

# Amostra: a prova de 2024 (1º EQ) inteira — tem texto de apoio, alternativas
# em imagem, química com índices e as versões em idioma.
amostra = [q for q in pacote["atualizar"] + pacote["inserir"] if "/77/" in q["recorte_local"].replace("\\", "/")]
apoios = {a["chave"]: a for a in pacote["apoios"]}
id_apoio = {k: i + 1 for i, k in enumerate(apoios)}
linhas = []
for i, q in enumerate(amostra):
    num = int(re.search(r"q(\d+)", os.path.basename(q["recorte_local"])).group(1))
    linhas.append({
        "id": q.get("id") or 900000 + i, "prova_id": 77, "numero": num,
        "enunciado": q["enunciado"], "alternativas": q["alternativas"], "resposta": q["resposta"],
        "anulada": q["anulada"], "disciplina": q["disciplina"], "area": q["area"], "assunto": q["assunto"],
        "dificuldade": "media", "pagina": q["pagina"], "imagens": [], "texto_confiavel": q.get("texto_confiavel", False),
        "recorte_url": "https://mock.local/lote/" + q["recorte_local"].replace("\\", "/").split("/lote/")[1],
        "apoio_ids": [id_apoio[k] for k in q["apoios_chaves"]],
        "prova": {k: provas[77][k] for k in ("id", "ano", "fase", "tipo", "titulo", "pdf_url", "url_original")},
    })
linhas.sort(key=lambda r: (r["numero"], r["disciplina"]))
apoio_linhas = [{"id": id_apoio[k], "imagens": ["https://mock.local/lote/" + f.replace("\\", "/").split("/lote/")[1] for f in a["arquivos"]], "texto": a["texto"]} for k, a in apoios.items()]


def b64(d):
    return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")


exp = int(time.time()) + 86400
UID = "11111111-2222-3333-4444-555555555555"
USER = {"id": UID, "aud": "authenticated", "role": "authenticated", "email": "teste@exemplo.com", "user_metadata": {"nome": "Aluno Teste"}, "app_metadata": {}}
SESSAO = {"access_token": f"{b64({'alg': 'HS256'})}.{b64({'sub': UID, 'exp': exp})}.x", "token_type": "bearer", "expires_in": 86400, "expires_at": exp, "refresh_token": "x", "user": USER}


def filtrar(rows, qs):
    for k, v in qs.items():
        v = v[0]
        if k in ("select", "order", "limit", "offset"):
            continue
        if v.startswith("eq."):
            rows = [r for r in rows if str(r.get(k)) == unquote(v[3:])]
        elif v.startswith("in.("):
            vals = set(unquote(v[4:-1]).replace('"', "").split(","))
            rows = [r for r in rows if str(r.get(k)) in vals]
    return rows


def rest(route):
    req = route.request
    u = urlparse(req.url)
    tabela = u.path.split("/rest/v1/")[1]
    qs = parse_qs(u.query)
    dados = []
    if tabela == "cronogramas":
        dados = [{"dados_cronograma": [{"nome": "Matemática", "horas": "3.0"}]}]
    elif tabela == "questoes_uerj":
        dados = filtrar(linhas, qs)
    elif tabela == "textos_apoio_uerj":
        dados = filtrar(apoio_linhas, qs)
    elif tabela == "provas_uerj":
        dados = [provas[77]]
    if req.method == "HEAD" or "count=exact" in req.headers.get("prefer", ""):
        return route.fulfill(status=200, json=dados, headers={"content-range": f"0-{max(len(dados) - 1, 0)}/{len(dados)}", "access-control-expose-headers": "content-range"})
    if "vnd.pgrst.object" in req.headers.get("accept", ""):
        return route.fulfill(status=200, json=dados[0] if dados else {})
    route.fulfill(status=200, json=dados, headers={"content-range": f"0-{max(len(dados) - 1, 0)}/{len(dados)}", "access-control-expose-headers": "content-range"})


def arquivo(route):
    rel = urlparse(route.request.url).path.split("/lote/")[1]
    route.fulfill(path=os.path.join(REV, "lote", *rel.split("/")), content_type="image/webp")


with sync_playwright() as p:
    b = p.chromium.launch()
    for nome, vp in (("desktop", {"width": 1440, "height": 1500}), ("celular", {"width": 390, "height": 1700})):
        ctx = b.new_context(viewport=vp, device_scale_factor=1)
        ctx.add_init_script(f"localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(SESSAO))}); localStorage.setItem('tema', '{TEMA}');")
        pg = ctx.new_page()
        erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        pg.on("console", lambda m: m.type == "error" and erros.append(m.text[:200]))
        pg.route(f"https://{REF}.supabase.co/rest/v1/**", rest)
        pg.route(f"https://{REF}.supabase.co/auth/v1/**", lambda r: r.fulfill(status=200, json=USER))
        pg.route(f"https://{REF}.supabase.co/realtime/**", lambda r: r.abort())
        pg.route("https://mock.local/**", arquivo)
        pg.goto(BASE + "/app/enem")
        pg.wait_for_load_state("networkidle")
        pg.screenshot(path=os.path.join(OUT, f"q_{nome}_1_hub.png"), full_page=True)
        pg.get_by_role("button", name=re.compile("Português")).first.click()
        pg.wait_for_timeout(1200)
        pg.screenshot(path=os.path.join(OUT, f"q_{nome}_2_lista.png"), full_page=True)
        abrir = pg.get_by_role("button", name=re.compile(r"Resolver|Questão 0?3|Começar", re.I))
        if abrir.count():
            abrir.first.click()
        else:
            pg.locator("li button, article button").first.click()
        pg.wait_for_timeout(1500)
        pg.screenshot(path=os.path.join(OUT, f"q_{nome}_3_questao.png"), full_page=True)
        alts = pg.get_by_role("button", name=re.compile(r"^(Alternativa )?[A-D]\b"))
        if alts.count():
            alts.nth(1).click()
            pg.wait_for_timeout(800)
            pg.screenshot(path=os.path.join(OUT, f"q_{nome}_4_respondida.png"), full_page=True)
        print(nome, "erros:", erros[:5])
        ctx.close()
    b.close()
