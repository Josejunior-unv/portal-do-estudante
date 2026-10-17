"""Passo 4: monta dados/revisao/pacote.json, que o publicar_revisao.py aplica."""
import collections
import json
import os

import util

A = util.AUDIT
R = json.load(open(os.path.join(A, "lote", "resultado.json"), encoding="utf-8"))
G = json.load(open(os.path.join(A, "gabaritos.json"), encoding="utf-8"))
# Decisões de disciplina tomadas por leitura (versionadas no git).
C = json.load(open(os.path.join(util.REVISAO, "disciplinas_revisadas.json"), encoding="utf-8"))["disciplinas"]
DB = {q["id"]: q for q in util.questoes()}
P = util.provas()

AREA = {"Português": "Linguagens", "Inglês": "Linguagens", "Espanhol": "Linguagens", "Francês": "Linguagens",
        "Matemática": "Matemática", "Física": "Ciências da Natureza", "Química": "Ciências da Natureza",
        "Biologia": "Ciências da Natureza", "História": "Ciências Humanas", "Geografia": "Ciências Humanas",
        "Filosofia": "Ciências Humanas", "Sociologia": "Ciências Humanas"}

apoios, atualizar, inserir = [], [], []
st = collections.Counter()
for pid, v in R.items():
    pid_i = int(pid)
    prova = P[pid_i]
    pasta = os.path.join(A, "lote", pid)
    # textos de apoio usados por alguma questão
    usados = sorted({a for it in v["itens"] for a in it["apoios"]})
    for idx in usados:
        arqs = sorted(f for f in os.listdir(pasta) if f.startswith(f"apoio{idx:02d}_"))
        apoios.append({"chave": f"{pid}:{idx}", "prova_id": pid_i, "ordem": idx,
                       "arquivos": [os.path.join(pasta, f) for f in arqs],
                       "texto": v["apoios"][idx]})
    g = G.get(pid, {})
    for it in v["itens"]:
        k = f"{pid}:{it['numero']}"
        d = DB.get(it["db_id"]) if it["db_id"] else None
        idioma = it["idioma"]
        if idioma:
            disc = idioma
        elif prova["tipo"] == "discursivo" and prova["disciplina"] and not (prova["disciplina"] == "Português" and prova["paginas"] == 24):
            disc = prova["disciplina"]
        else:
            disc = C.get(k) or (d["disciplina"] if d else None)
        if disc not in AREA:
            st["SEM DISCIPLINA"] += 1
            raise SystemExit(f"sem disciplina: {k} {disc}")
        oficial = g.get(f"{it['numero']}|{idioma or ''}")
        anulada = oficial == "ANULADA"
        if prova["tipo"] != "qualificacao":
            resposta = None
        elif anulada:
            resposta = None
        else:
            resposta = oficial or (d["resposta"] if d else None)
        mudou_disc = (d is None) or (d["disciplina"] != disc)
        campos = {
            "enunciado": it["enunciado"] or "(ver imagem da questão)",
            "alternativas": it["alternativas"] if it["alternativas"] else (
                [{"letra": l, "texto": ""} for l in "ABCD"] if prova["tipo"] == "qualificacao" else []),
            "resposta": resposta,
            "anulada": anulada,
            "disciplina": disc,
            "area": AREA[disc],
            "assunto": "Não Classificado" if mudou_disc else (d["assunto"] or "Não Classificado"),
            "pagina": it["pagina"],
            "imagens": [],
            "classificada": True,
            "recorte_local": os.path.join(pasta, it["arquivo"]),
            "apoios_chaves": [f"{pid}:{a}" for a in it["apoios"]],
        }
        if d:
            atualizar.append({"id": d["id"], **campos})
            st["atualizar"] += 1
            if d["resposta"] != resposta:
                st["gabarito muda" if d["resposta"] else "gabarito novo"] += 1
            if mudou_disc:
                st["disciplina muda"] += 1
        else:
            inserir.append({"prova_id": pid_i, "numero": it["numero"], "url_original": prova["url_original"], **campos})
            st["inserir"] += 1
        st["anuladas"] += anulada

casados = {u["id"] for u in atualizar}
apagar = sorted(i for i, q in DB.items() if q["prova_id"] in {int(p) for p in R} and i not in casados)
st["apagar"] = len(apagar)
st["apoios"] = len(apoios)

# unicidade (prova, numero, disciplina) no estado final
chaves = collections.Counter()
for u in atualizar:
    q = DB[u["id"]]
    chaves[(q["prova_id"], q["numero"], u["disciplina"])] += 1
for n in inserir:
    chaves[(n["prova_id"], n["numero"], n["disciplina"])] += 1
dup = [k for k, c in chaves.items() if c > 1]
print(dict(st))
print("duplicadas no estado final:", dup)
print("apagar:", [(i, DB[i]["prova_id"], DB[i]["numero"], DB[i]["disciplina"]) for i in apagar])
json.dump({"apoios": apoios, "atualizar": atualizar, "inserir": inserir, "apagar": apagar},
          open(os.path.join(A, "pacote.json"), "w", encoding="utf-8"), ensure_ascii=False)
