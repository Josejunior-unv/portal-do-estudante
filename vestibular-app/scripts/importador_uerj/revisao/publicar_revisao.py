"""Passo 5: aplica dados/revisao/pacote.json no Supabase.

Pré-requisito: PARTE 14 do supabase_migration.sql já rodada (colunas
recorte_url/anulada/apoio_ids e tabela textos_apoio_uerj).

Autenticação (igual ao publicar.py): SUPABASE_SERVICE_ROLE_KEY, ou
UERJ_ADMIN_EMAIL + UERJ_ADMIN_SENHA + SUPABASE_ANON_KEY (login de admin).

Uso:
    python publicar_revisao.py --simular   # só mostra o que faria
    python publicar_revisao.py             # publica (retomável)
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import util

sys.path.insert(0, util.IMPORTADOR)
from publicar import Publicador  # noqa: E402

SIMULAR = "--simular" in sys.argv
PACOTE = json.load(open(os.path.join(util.AUDIT, "pacote.json"), encoding="utf-8"))
PROGRESSO = os.path.join(util.AUDIT, "publicado.json")
progresso = json.load(open(PROGRESSO, encoding="utf-8")) if os.path.exists(PROGRESSO) else {"arquivos": {}}

CAMPOS = ("enunciado", "alternativas", "resposta", "anulada", "disciplina", "area", "assunto",
          "pagina", "imagens", "classificada", "texto_confiavel")


def salvar_progresso():
    json.dump(progresso, open(PROGRESSO, "w", encoding="utf-8"), ensure_ascii=False)


def destino(local, pasta, prova_id):
    return f"{pasta}/{prova_id}/{os.path.basename(local)}"


def main():
    n_imgs = len(PACOTE["atualizar"]) + len(PACOTE["inserir"]) + sum(len(a["arquivos"]) for a in PACOTE["apoios"])
    print(f"Pacote: {len(PACOTE['atualizar'])} atualizar, {len(PACOTE['inserir'])} inserir, "
          f"{len(PACOTE['apagar'])} apagar, {len(PACOTE['apoios'])} textos de apoio, {n_imgs} imagens.")
    if SIMULAR:
        print("Simulação: nada foi enviado.")
        return

    pub = Publicador()
    s, base = pub.sessao, pub.base

    # 1) estrutura (PARTE 14)
    r = s.get(f"{base}/rest/v1/textos_apoio_uerj?select=id&limit=1")
    r2 = s.get(f"{base}/rest/v1/questoes_uerj?select=recorte_url,anulada,apoio_ids,texto_confiavel&limit=1")
    if r.status_code in (401, 403) or r2.status_code in (401, 403):
        raise SystemExit(f"Chave recusada pelo Supabase ({r.status_code}): {r.text[:200]}")
    if r.status_code >= 300 or r2.status_code >= 300:
        raise SystemExit("Rode antes a PARTE 14 do supabase_migration.sql no SQL Editor do Supabase. "
                         f"({r.status_code} {r.text[:150]} | {r2.status_code} {r2.text[:150]})")

    # 2) imagens (paralelo, retomável)
    # recortes ficam em dados/revisao/lote/<prova_id>/: a pasta dá a prova
    pendentes = {}
    for q in PACOTE["atualizar"]:
        pendentes[q["recorte_local"]] = destino(q["recorte_local"], "recortes", os.path.basename(os.path.dirname(q["recorte_local"])))
    for q in PACOTE["inserir"]:
        pendentes[q["recorte_local"]] = destino(q["recorte_local"], "recortes", q["prova_id"])
    for a in PACOTE["apoios"]:
        for f in a["arquivos"]:
            pendentes[f] = destino(f, "apoios", a["prova_id"])
    falta = {k: v for k, v in pendentes.items() if k not in progresso["arquivos"]}
    print(f"Imagens: {len(pendentes) - len(falta)} já enviadas, {len(falta)} a enviar.")
    with ThreadPoolExecutor(max_workers=8) as ex:
        futuros = {ex.submit(pub.enviar_arquivo, local, rel): local for local, rel in falta.items()}
        for i, fut in enumerate(as_completed(futuros), 1):
            progresso["arquivos"][futuros[fut]] = fut.result()
            if i % 100 == 0:
                salvar_progresso()
                print(f"  {i}/{len(falta)}")
    salvar_progresso()
    url = progresso["arquivos"]

    # 3) textos de apoio (upsert por prova+ordem)
    linhas = [{"prova_id": a["prova_id"], "ordem": a["ordem"],
               "imagens": [url[f] for f in a["arquivos"]], "texto": a["texto"]} for a in PACOTE["apoios"]]
    r = s.post(f"{base}/rest/v1/textos_apoio_uerj?on_conflict=prova_id,ordem", json=linhas,
               headers={"Prefer": "resolution=merge-duplicates,return=representation"})
    if r.status_code >= 300:
        raise SystemExit(f"textos_apoio_uerj {r.status_code}: {r.text[:300]}")
    id_apoio = {f"{x['prova_id']}:{x['ordem']}": x["id"] for x in r.json()}
    print("Textos de apoio gravados:", len(id_apoio))

    def corpo(q):
        c = {k: q[k] for k in CAMPOS}
        c["recorte_url"] = url[q["recorte_local"]]
        c["apoio_ids"] = [id_apoio[k] for k in q["apoios_chaves"]]
        return c

    # 4) apaga o lixo ANTES de inserir (evita colisão de número)
    if PACOTE["apagar"]:
        ids = ",".join(str(i) for i in PACOTE["apagar"])
        r = s.delete(f"{base}/rest/v1/questoes_uerj?id=in.({ids})")
        if r.status_code >= 300:
            raise SystemExit(f"apagar {r.status_code}: {r.text[:300]}")
        print("Apagadas:", len(PACOTE["apagar"]))

    # 5) atualiza (PATCH por id, em paralelo)
    def patch(q):
        r = s.patch(f"{base}/rest/v1/questoes_uerj?id=eq.{q['id']}", json=corpo(q),
                    headers={"Prefer": "return=minimal"})
        if r.status_code >= 300:
            raise RuntimeError(f"questão {q['id']}: {r.status_code} {r.text[:200]}")
    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, fut in enumerate(as_completed([ex.submit(patch, q) for q in PACOTE["atualizar"]]), 1):
            fut.result()
            if i % 250 == 0:
                print(f"  atualizadas {i}/{len(PACOTE['atualizar'])}")
    print("Atualizadas:", len(PACOTE["atualizar"]))

    # 6) insere as que faltavam
    novas = [{"prova_id": q["prova_id"], "numero": q["numero"], "url_original": q["url_original"], **corpo(q)}
             for q in PACOTE["inserir"]]
    if novas:
        r = s.post(f"{base}/rest/v1/questoes_uerj", json=novas, headers={"Prefer": "return=minimal"})
        if r.status_code >= 300:
            raise SystemExit(f"inserir {r.status_code}: {r.text[:300]}")
    print("Inseridas:", len(novas))

    s.post(f"{base}/rest/v1/uerj_import_logs", json={
        "nivel": "info", "evento": "revisao_recortes_out2026",
        "detalhes": {"atualizadas": len(PACOTE["atualizar"]), "inseridas": len(novas),
                     "apagadas": len(PACOTE["apagar"]), "textos_apoio": len(id_apoio)},
    })
    print("Pronto.")


if __name__ == "__main__":
    main()
