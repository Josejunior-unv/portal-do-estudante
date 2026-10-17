"""Lê os gabaritos oficiais por BLOCO (idioma) e marca anuladas.
Passo 3. Saída: dados/revisao/gabaritos.json  {prova_id: {"numero|idioma": "A".."E"|"ANULADA"}}"""
import collections
import json
import os
import re
import sys

import fitz
import util

IDIOMAS = {"INGLES": "Inglês", "ESPANHOL": "Espanhol", "FRANCES": "Francês"}


def sem_acento(t):
    import unicodedata
    return unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode().upper()


def ler(caminho):
    """{(numero, idioma|None): letra|'ANULADA'} lendo a tabela pela geometria."""
    doc = fitz.open(caminho)
    out = {}
    for pg in doc:
        ws = pg.get_text("words")
        titulos = []
        for w in ws:
            t = sem_acento(w[4]).strip(":")
            if t in IDIOMAS or t in ("LINGUAGENS", "MATEMATICA", "NATUREZA", "HUMANAS", "BASE", "PORTUGUESA", "ESTRANGEIRA", "QUALIFICACAO"):
                titulos.append((w[0], w[1], IDIOMAS.get(t)))
        nums = [((w[0] + w[2]) / 2, w[1], w[3], int(w[4])) for w in ws if re.fullmatch(r"\d{1,3}", w[4]) and 1 <= int(w[4]) <= 120]
        resp = [((w[0] + w[2]) / 2, w[1], w[4]) for w in ws if re.fullmatch(r"[A-Ea-e]", w[4]) or re.fullmatch(r"(?i)anulad[ao]s?", w[4])]
        # Formato antigo (até 2022): tabela VERTICAL, letra à direita do
        # número na mesma linha; blocos de idioma empilhados na coluna.
        vert = {}
        for nx, ny, ny1, n in nums:
            cands = [(lx - nx, l) for lx, ly, l in resp if abs(ly - ny) < 4 and 0 < lx - nx < 90]
            if not cands:
                continue
            letra = min(cands)[1]
            letra = "ANULADA" if letra.lower().startswith("anulad") else letra.upper()
            acima = [t for t in titulos if t[1] < ny and abs(t[0] - nx) < 80]
            idioma = max(acima, key=lambda t: t[1])[2] if acima else None
            vert.setdefault((n, idioma), letra)
        horiz = {}
        for nx, ny, ny1, n in nums:
            cands = [(abs(lx - nx) + 0.3 * (ly - ny), l) for lx, ly, l in resp if 0 < ly - ny < 40 and abs(lx - nx) < 14]
            if not cands:
                continue
            letra = min(cands)[1]
            letra = "ANULADA" if letra.lower().startswith("anulad") else letra.upper()
            acima = [t for t in titulos if t[1] < ny and t[0] <= nx + 5 and ny - t[1] < 90]
            idioma = max(acima, key=lambda t: (round(t[1] / 6), t[0]))[2] if acima else None
            horiz.setdefault((n, idioma), letra)
        for k, v in (vert if len(vert) > len(horiz) else horiz).items():
            out.setdefault(k, v)
    # Questão de idioma é a que aparece em 2+ blocos de idioma; um número
    # que herdou o rótulo "Inglês" só por estar abaixo do bloco volta a ser
    # comum.
    idiomas_do_num = collections.defaultdict(set)
    for (n, i) in out:
        if i:
            idiomas_do_num[n].add(i)
    corrigido = {}
    for (n, i), l in out.items():
        if i and len(idiomas_do_num[n]) < 2:
            corrigido.setdefault((n, None), l)
        else:
            corrigido[(n, i)] = l
    return corrigido


if __name__ == "__main__":
    provas = util.provas()
    man = list(util.manifesto().values())
    alvo = {pid: p for pid, p in provas.items() if p["tipo"] == "qualificacao"}
    resultado, relato = {}, []
    for pid, p in sorted(alvo.items(), key=lambda x: (x[1]["ano"], x[1]["fase"] or "")):
        gabs = [m for m in man if m.get("tipo") == "gabarito" and m.get("ano") == p["ano"] and (m.get("fase") == p["fase"] or p["fase"] == "EU")]
        melhor = {}
        for g in gabs:
            caminho = util.caminho_local(g)
            if not os.path.exists(caminho):
                continue
            try:
                m = ler(caminho)
            except Exception as e:
                relato.append(f"{pid} erro {e}")
                continue
            if len(m) > len(melhor):
                melhor, origem = m, os.path.basename(caminho)
        if melhor:
            resultado[str(pid)] = {f"{n}|{i or ''}": l for (n, i), l in melhor.items()}
        idi = collections.Counter(i for (_, i) in melhor)
        anul = [n for (n, i), l in melhor.items() if l == "ANULADA"]
        print(f"{pid:>4} {p['ano']} {p['fase']:4} gabaritos={len(gabs)} respostas={len(melhor):>3} por idioma={dict(idi)} anuladas={anul} {origem if melhor else ''}")
    json.dump(resultado, open(os.path.join(util.AUDIT, "gabaritos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n".join(relato))
