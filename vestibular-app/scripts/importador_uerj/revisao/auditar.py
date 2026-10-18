"""Passo 1: auditoria do banco atual (lista erros por categoria)."""
import json, re, sys, collections, os

import util

D = util.AUDIT
provas = {p["id"]: p for p in json.load(open(f"{D}/provas_uerj.json", encoding="utf-8"))}
qs = json.load(open(f"{D}/questoes_uerj.json", encoding="utf-8"))

LIXO = [
    (r"QUEST[ÃA]O\s+\d+", "marcador 'QUESTÃO NN' dentro do texto"),
    (r"VESTIBULAR\s+ESTADUAL", "cabeçalho 'VESTIBULAR ESTADUAL'"),
    (r"EXAME\s+(DE\s+QUALIFICA|DISCURSIVO|[ÚU]NICO)", "cabeçalho do exame"),
    (r"\bRASCUNHO\b", "'RASCUNHO'"),
    (r"(CI[ÊE]NCIAS DA NATUREZA|CI[ÊE]NCIAS HUMANAS|LINGUAGENS, C[ÓO]DIGOS|MATEM[ÁA]TICA,? E SUAS TECNOLOGIAS)", "rodapé de área"),
    (r"\(cid:\d+\)", "lixo de PDF (cid)"),
    (r"�", "caractere inválido �"),
    (r"[ﬀ-ﬆ]", "ligadura (ﬁ/ﬂ)"),
    (r"\bP[áa]gina\s+\d+\b|^\s*\d{1,2}\s*$", "número de página solto"),
    (r"\b[A-Za-zÀ-ú]{2,}-\n[a-zà-ú]", "palavra hifenizada na quebra"),
    (r"Utilize as informa[çc][õo]es|Com base nas informa[çc][õo]es a seguir, responda", "instrução de bloco (pode ser legítima)"),
    (r"\bUERJ\s+20\d\d\b", "'UERJ 20xx' (cabeçalho?)"),
]
CITA_FIG = re.compile(r"\b(figura|gr[áa]fico|tabela|imagem|esquema|charge|tirinha|ilustra|mapa|quadro|diagrama|cartum)\b", re.I)

prob = collections.defaultdict(list)
def marca(cat, q, extra=""):
    prob[cat].append((q["id"], q["prova_id"], q["numero"], q.get("disciplina"), extra))

por_prova = collections.defaultdict(list)
for q in qs:
    por_prova[q["prova_id"]].append(q)
    en = q.get("enunciado") or ""
    alts = q.get("alternativas") or []
    p = provas.get(q["prova_id"], {})
    objetiva = p.get("tipo") == "qualificacao" or len(alts) > 0

    if len(en.strip()) < 40: marca("enunciado vazio/curto (<40)", q, repr(en[:60]))
    if len(en) > 4000: marca("enunciado enorme (>4000 chars)", q, len(en))
    for rx, nome in LIXO:
        for campo, texto in [("enunciado", en)] + [(f"alt {a.get('letra')}", a.get("texto") or "") for a in alts]:
            m = re.search(rx, texto, re.M)
            if m:
                marca(f"lixo: {nome}", q, f"{campo}: …{texto[max(0,m.start()-30):m.end()+30]!r}…")
                break
    if objetiva:
        letras = [a.get("letra") for a in alts]
        if len(alts) != 4: marca(f"objetiva com {len(alts)} alternativas", q, letras)
        if len(set(letras)) != len(letras): marca("letras de alternativa repetidas", q, letras)
        if any(l not in "ABCDE" for l in letras if l): marca("letra fora de A-E", q, letras)
        for a in alts:
            t = (a.get("texto") or "").strip()
            if not t: marca("alternativa vazia", q, a.get("letra"))
            elif len(t) > 700: marca("alternativa muito longa (>700, engoliu texto?)", q, f"{a.get('letra')}: {len(t)}")
        if q.get("resposta") and q["resposta"] not in letras: marca("gabarito fora das alternativas", q, f"{q['resposta']} vs {letras}")
    if q.get("resposta") and q.get("disciplina") in ("Inglês", "Espanhol", "Francês", "Língua Estrangeira"):
        marca("idioma com gabarito (proibido)", q, q["resposta"])
    if q.get("disciplina") in (None, "", "Não Classificada"): marca("disciplina não classificada", q)
    if CITA_FIG.search(en) and not (q.get("imagens") or []): marca("cita figura/tabela mas sem imagem", q, CITA_FIG.search(en).group(0))
    if objetiva and not q.get("resposta") and q.get("disciplina") not in ("Inglês", "Espanhol", "Francês"):
        marca("objetiva sem gabarito", q)

# numeração por prova
for pid, lista in por_prova.items():
    nums = sorted({q["numero"] for q in lista})
    faltam = sorted(set(range(1, max(nums) + 1)) - set(nums)) if nums else []
    if faltam:
        prob["prova com buracos na numeração"].append((None, pid, None, provas.get(pid, {}).get("titulo"), f"faltam {faltam[:15]}{'…' if len(faltam)>15 else ''} (total {len(faltam)}) de {max(nums)}"))
    cont = collections.Counter((q["numero"], q.get("disciplina")) for q in lista)
    for (n, disc), c in cont.items():
        if c > 1: prob["número duplicado na mesma prova"].append((None, pid, n, disc, c))
    # enunciados idênticos (duplicação)
    textos = collections.Counter((q.get("enunciado") or "")[:200] for q in lista if len(q.get("enunciado") or "") > 60)
    for t, c in textos.items():
        if c > 1 and not re.search(r"(Ingl|Espanh|Franc)", str([q.get("disciplina") for q in lista if (q.get("enunciado") or "")[:200]==t])):
            prob["enunciado duplicado na prova"].append((None, pid, None, None, f"{c}x: {t[:70]!r}"))

provas_sem_q = [p for p in provas.values() if p["id"] not in por_prova]
tipos = collections.Counter(p["tipo"] for p in provas.values())
print("Provas por tipo:", dict(tipos))
print("Provas sem nenhuma questão:", len(provas_sem_q), collections.Counter(p["tipo"] for p in provas_sem_q))
print("Provas com status != importada/processada:", [(p["id"], p["status"]) for p in provas.values() if p["status"] not in ("importada", "processada")])
print("Provas sem pdf_url:", sum(1 for p in provas.values() if not p.get("pdf_url")))
print()
for cat, itens in sorted(prob.items(), key=lambda x: -len(x[1])):
    print(f"== {cat}: {len(itens)}")
    for it in itens[:4]:
        print("    ", it)
json.dump({k: v for k, v in prob.items()}, open(f"{D}/problemas.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
