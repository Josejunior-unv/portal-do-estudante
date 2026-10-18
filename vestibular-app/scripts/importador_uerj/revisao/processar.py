"""Passo 2: recorta todas as provas com questões no banco e casa com o banco.
Saída: dados/revisao/lote/<prova_id>/*.webp + dados/revisao/lote/resultado.json
Uso: python processar.py [prova_id ...]  (sem argumentos = todas)"""
import collections
import json
import os
import re
import sys

import fitz
import util

sys.path.insert(0, util.IMPORTADOR)
import extrair  # noqa: E402
import recortes as R  # noqa: E402

SAIDA = os.path.join(util.AUDIT, "lote")
IDIOMAS = ("Inglês", "Espanhol", "Francês")

provas = util.provas()
qs_db = util.questoes()
por_prova = collections.defaultdict(list)
for q in qs_db:
    por_prova[q["prova_id"]].append(q)

alvo = [int(x) for x in sys.argv[1:]] or sorted(por_prova)
resultado = {}
if os.path.exists(os.path.join(SAIDA, "resultado.json")):
    resultado = json.load(open(os.path.join(SAIDA, "resultado.json"), encoding="utf-8"))

for pid in alvo:
    p = provas[pid]
    e = util.entrada_da_prova(p)
    if not e or not os.path.exists(e["caminho_local"]):
        print(pid, "SEM PDF LOCAL")
        continue
    doc = fitz.open(e["caminho_local"])
    textos = [doc[n].get_text("text") for n in range(doc.page_count)]

    def ctx(n):
        area, idioma = extrair._area_da_pagina(textos[n])
        return area, idioma or R.idioma_do_cabecalho(doc[n])

    objetiva = p["tipo"] == "qualificacao"
    doc, d = R.analisar(e["caminho_local"], objetiva=objetiva, area_idioma_da_pagina=ctx)
    pasta = os.path.join(SAIDA, str(pid))
    os.makedirs(pasta, exist_ok=True)

    # linhas do banco por (numero, idioma)
    db = {}
    for q in por_prova[pid]:
        idi = q["disciplina"] if q["disciplina"] in IDIOMAS else None
        db.setdefault((q["numero"], idi), []).append(q)

    itens, alertas = [], []
    vistos = collections.Counter()
    for q in d.questoes:
        idi = q.idioma
        chave = (q.numero, idi)
        vistos[chave] += 1
        nome = f"q{q.numero:02d}{'_' + idi[:2].lower() if idi else ''}"
        if vistos[chave] > 1:
            alertas.append(f"duplicada {chave}")
            nome += f"_dup{vistos[chave]}"
        R.renderizar(doc, q.blocos, os.path.join(pasta, nome + ".webp"))
        altura = sum(b.rect.height for b in q.blocos)
        n_alts = len(q.texto["alternativas"])
        if objetiva and not q.tem_alternativas:
            alertas.append(f"{nome}: objetiva sem (A)-(D) no recorte")
        if altura > 680:
            alertas.append(f"{nome}: recorte muito alto ({altura:.0f}pt)")
        if altura < 35:
            alertas.append(f"{nome}: recorte muito baixo ({altura:.0f}pt)")
        linha_db = db.get(chave, [None])[0]
        if linha_db is None:
            # o banco às vezes rotulou errado o idioma (ex.: a 28 de
            # Matemática marcada "Inglês"): casa pelo número se for única
            mesmas = [r for (n, _), rs in db.items() if n == q.numero for r in rs]
            if len(mesmas) == 1 and sum(1 for x in d.questoes if x.numero == q.numero) == 1:
                linha_db = mesmas[0]
        itens.append({
            "numero": q.numero, "idioma": idi, "area": q.area, "pagina": q.selo.pagina + 1,
            "arquivo": nome + ".webp", "apoios": q.apoios, "tem_alternativas": q.tem_alternativas,
            "enunciado": q.texto["enunciado"], "alternativas": q.texto["alternativas"],
            "tem_figura": q.texto["tem_figura"], "tem_formula": q.texto["tem_formula"],
            "db_id": linha_db["id"] if linha_db else None,
            "altura": round(altura),
        })
    for i, a in enumerate(d.apoios):
        R.renderizar_separados(doc, a, os.path.join(pasta, f"apoio{i:02d}"))
    apoios_txt = [" ".join(R.texto_dos_blocos(doc, a, {}))[:4000] for a in d.apoios]

    # 2ª passada: número repetido (versões por idioma) ou rótulo errado no
    # banco -> casa pelo CONTEÚDO do enunciado.
    import difflib

    def norm(t):
        return re.sub(r"[^a-z0-9à-ú]+", " ", (t or "").lower())[:500]

    usados = {it["db_id"] for it in itens if it["db_id"]}
    sobra_db = [r for rs in db.values() for r in rs if r["id"] not in usados]
    for it in itens:
        if it["db_id"] or not sobra_db:
            continue
        cands = [r for r in sobra_db if r["numero"] == it["numero"]]
        if not cands:
            continue
        melhor = max(cands, key=lambda r: difflib.SequenceMatcher(None, norm(r["enunciado"]), norm(it["enunciado"])).ratio())
        if difflib.SequenceMatcher(None, norm(melhor["enunciado"]), norm(it["enunciado"])).ratio() >= 0.35:
            it["db_id"] = melhor["id"]
            sobra_db.remove(melhor)

    casados = {it["db_id"] for it in itens if it["db_id"]}
    faltam_no_pdf = sorted((r["numero"], r["disciplina"]) for rs in db.values() for r in rs if r["id"] not in casados)
    novas = sorted((it["numero"], it["idioma"]) for it in itens if not it["db_id"])
    resultado[str(pid)] = {
        "titulo": p["titulo"], "tipo": p["tipo"], "itens": itens, "apoios": apoios_txt,
        "apoios_paginas": [[b.pagina + 1 for b in a] for a in d.apoios],
        "db_total": len(por_prova[pid]), "pdf_total": len(d.questoes),
        "faltam_no_pdf": faltam_no_pdf, "novas": novas, "alertas": alertas,
    }
    print(f"{pid:>4} {p['titulo'][:46]:46} banco={len(por_prova[pid]):>3} pdf={len(d.questoes):>3} "
          f"apoios={len(d.apoios):>2} alertas={len(alertas):>2} "
          f"{'| sem par no PDF: ' + str(faltam_no_pdf[:6]) if faltam_no_pdf else ''}"
          f"{' | novas: ' + str(novas[:6]) if novas else ''}")

json.dump(resultado, open(os.path.join(SAIDA, "resultado.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
