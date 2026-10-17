"""Recorte fiel das questões da UERJ a partir do PDF (out/2026).

POR QUE
    A extração por texto corrido (`extrair.py`) dividia o PDF inteiro pelo
    regex "QUESTÃO NN". Em layouts com texto de apoio, rodapé e figuras isso
    gerava erros sistemáticos (auditoria de 17/10/2026, 1.947 questões):
      • a última alternativa "engolia" rodapé, número de página e o texto de
        apoio da questão seguinte (213 questões);
      • expoentes viravam números comuns ("3 × 108 m/s" em vez de 3 × 10⁸);
      • fórmulas se desmanchavam; alternativas em imagem sumiam;
      • imagens eram atribuídas à questão errada.

COMO
    Trabalha pela GEOMETRIA da página, não pelo texto corrido:
      1. Acha o selo "QUESTÃO" de cada questão (sempre na margem esquerda)
         e o número ao lado/em cima dele.
      2. A faixa da questão vai do selo até o selo seguinte (ou o rodapé).
         Dentro dela, a questão termina na última alternativa (incluindo
         alternativas em imagem). O que sobra abaixo é TEXTO DE APOIO da
         próxima questão.
      3. Cada questão e cada texto de apoio vira uma imagem (recorte) — é o
         que o aluno vê, idêntico à prova. O texto é extraído SÓ de dentro do
         recorte, com sobrescrito/subscrito convertidos (10⁸, H₂O), e serve
         para busca, filtros e leitores de tela.
      4. Texto de apoio vale para a questão logo depois dele e para as
         seguintes da mesma área/idioma que citam o texto ("(ℓ. 3-4)", "no
         texto", "verso"...), até aparecer outro texto de apoio.

Uso de inspeção:  python recortes.py caminho/prova.pdf [pasta_saida]
"""

import os
import re
import sys
from dataclasses import dataclass, field

import fitz  # PyMuPDF

RE_ROTULO = re.compile(r"^QUEST[ÃA]O(?:\s+(\d{1,3}))?$", re.IGNORECASE)
# "(A)", "A)" (2014) e "[A]"
RE_ALT = re.compile(r"^[\(\[]?\s*([A-E])\s*[\)\]]")
RE_REFERENCIA_TEXTO = re.compile(
    r"\((?:l|ℓ|v)\.\s*\d|\b\d+\s*[ºo°]\s*par[áa]grafo|\bpar[áa]grafo|"
    r"\b(?:no|do|o|pelo|ao|nesse|neste|desse|deste)\s+texto\b|\bversos?\b|\bestrofe|"
    r"\bt[íi]tulo do texto|\bo autor\b|\ba autora\b|\bnarrador",
    re.IGNORECASE,
)
RE_FONTE_PROPRIA = re.compile(r"Adaptado de|Dispon[íi]vel em|Fonte:|Extra[íi]do de", re.IGNORECASE)
RE_RESPOSTA = re.compile(r"^desenvolvimento e resposta:?$", re.IGNORECASE)
RE_RODAPE = re.compile(r"vestibular\s+estadual|exame\s+(de\s+qualifica|discursivo|[úu]nico)|^\d{1,2}$", re.IGNORECASE)
# "RESPONDA ÀS QUESTÕES 07 E 08", "AS QUESTÕES 09 A 22 REFEREM-SE...",
# "UTILIZE AS INFORMAÇÕES A SEGUIR PARA RESPONDER ÀS QUESTÕES 33 E 34"
RE_FAIXA = re.compile(r"QUEST[ÕO]ES\s+(?:DE\s+N[ÚU]MEROS?\s+)?(\d{1,3})\s*(A|E|À|AT[ÉE])\s*(\d{1,3})", re.IGNORECASE)

SUPER = str.maketrans("0123456789+-−–=()abcdeiknmtxy", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁻⁼⁽⁾ᵃᵇᶜᵈᵉⁱᵏⁿᵐᵗˣʸ")
# Fonte "Symbol" (provas antigas): letras latinas que desenham letras gregas.
GREGO = str.maketrans("abgdeqlmprsftwDFGLPQSW", "αβγδεθλμπρσφτωΔΦΓΛΠΘΣΩ")
SUB = str.maketrans("0123456789+-−–=()", "₀₁₂₃₄₅₆₇₈₉₊₋₋₋₌₍₎")

ZOOM = 2.0  # 144 dpi: nítido em telas retina sem pesar demais
MARGEM = 4  # pt de respiro em volta do recorte


@dataclass
class Selo:
    pagina: int  # 0-based
    numero: int
    rect: fitz.Rect
    extras: list = field(default_factory=list)  # spans do número (não entram no texto)

    @property
    def topo(self):
        """Início da questão: o mais alto entre o rótulo e o número (em 2015
        o número fica acima do rótulo vertical, alinhado à 1ª linha)."""
        return min([self.rect.y0] + [e.y0 for e in self.extras])


@dataclass
class Bloco:
    """Região retangular de conteúdo numa página."""
    pagina: int
    rect: fitz.Rect


@dataclass
class Questao:
    numero: int
    selo: Selo
    blocos: list
    tem_alternativas: bool
    idioma: str = None
    area: str = None
    apoios: list = field(default_factory=list)  # índices em Documento.apoios
    texto: dict = None


@dataclass
class Documento:
    questoes: list
    apoios: list  # lista de listas de Bloco


# --------------------------------------------------------------------------
# Leitura da página
# --------------------------------------------------------------------------

def _spans(pagina):
    out = []
    for b in pagina.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if s["text"].strip():
                    out.append(s)
    return out


def _limites(pagina, spans):
    """Faixa útil da página: abaixo do cabeçalho e acima do rodapé.

    O rodapé é reconhecido pelo CONTEÚDO ("VESTIBULAR ESTADUAL 2024 …",
    número da página), não só pela posição: alternativas podem ficar bem no
    pé da página e não podem ser cortadas.
    """
    h = pagina.rect.height
    topo = [s["bbox"][3] for s in spans if s["bbox"][3] < 0.068 * h]
    w = pagina.rect.width

    def eh_rodape(s):
        t = s["text"].strip()
        if re.fullmatch(r"\d{1,2}", t):
            # número de página fica no canto e bem no pé; um "2" solto é
            # índice químico (CaO₂) ou denominador de fração e NÃO pode
            # virar rodapé.
            return s["bbox"][1] > 0.93 * h and (s["bbox"][0] < 0.08 * w or s["bbox"][0] > 0.88 * w)
        return bool(RE_RODAPE.search(t))

    base = [s["bbox"][1] for s in spans if s["bbox"][1] > 0.86 * h and eh_rodape(s)]
    return (max(topo) + 2 if topo else 0.05 * h), (min(base) - 2 if base else 0.975 * h)


def achar_selos(doc):
    selos = []
    for n in range(doc.page_count):
        pg = doc[n]
        spans = _spans(pg)
        for s in spans:
            txt = s["text"].strip()
            m = RE_ROTULO.match(txt)
            if not m or s["bbox"][0] > 0.2 * pg.rect.width:
                continue
            r = fitz.Rect(s["bbox"])
            extras = []
            numero = int(m.group(1)) if m.group(1) else None
            if numero is None:
                cands = [
                    t for t in spans
                    if re.fullmatch(r"\d{1,3}", t["text"].strip())
                    and abs(t["bbox"][0] - r.x0) < 100
                    # selo na vertical (2015): o número fica ACIMA do rótulo
                    and (-14 if r.width > r.height else -60) < t["bbox"][1] - r.y0 < 60
                    and (t["size"] >= 13 or abs(t["bbox"][1] - r.y0) < 4)
                ]
                if cands:
                    c = min(cands, key=lambda t: abs(t["bbox"][1] - r.y0) + abs(t["bbox"][0] - r.x0))
                    numero = int(c["text"].strip())
                    extras.append(fitz.Rect(c["bbox"]))
            if numero is None:
                continue
            selos.append(Selo(n, numero, r, extras))
    selos.sort(key=lambda s: (s.pagina, s.topo))
    return selos


RE_IDIOMA_CAB = re.compile(r"^(ingl[êe]s|espanhol|franc[êe]s)$", re.IGNORECASE)
NOME_IDIOMA = {"ingles": "Inglês", "espanhol": "Espanhol", "frances": "Francês"}


def idioma_do_cabecalho(pagina):
    """Idioma impresso sozinho no cabeçalho ("espanhol", "Francês"): Exame
    Único e discursivas de Língua Portuguesa e Estrangeira."""
    h = pagina.rect.height
    for s in _spans(pagina):
        t = s["text"].strip()
        if s["bbox"][1] < 0.08 * h and RE_IDIOMA_CAB.match(t):
            chave = t.lower().replace("ê", "e")
            return NOME_IDIOMA[chave]
    return None


def _elementos(pagina, faixa, ignorar):
    """Linhas de texto, imagens e desenhos relevantes dentro de uma faixa."""
    linhas, figuras = [], []
    for b in pagina.get_text("dict")["blocks"]:
        if b["type"] == 1:
            r = fitz.Rect(b["bbox"])
            if r.intersects(faixa) and faixa.y0 - 2 <= (r.y0 + r.y1) / 2 <= faixa.y1:
                figuras.append(r)
            continue
        for l in b.get("lines", []):
            spans = [s for s in l["spans"] if s["text"].strip()
                     and not any(fitz.Rect(s["bbox"]).intersects(i) for i in ignorar)]
            if not spans:
                continue
            r = fitz.Rect(spans[0]["bbox"])
            for s in spans[1:]:
                r |= fitz.Rect(s["bbox"])
            cy = (r.y0 + r.y1) / 2
            if faixa.y0 <= cy <= faixa.y1:
                linhas.append((r, spans))
    largura = pagina.rect.width
    for d in pagina.get_drawings():
        r = d["rect"]
        cy = (r.y0 + r.y1) / 2
        if not (faixa.y0 <= cy <= faixa.y1) or r.is_empty and r.width < 1:
            continue
        if any(r.intersects(i) for i in ignorar):
            continue
        # Moldura/pauta do espaço de resposta (discursivas) e fundos enormes
        # não são conteúdo.
        if r.height < 2.5 and r.width > 0.55 * largura:
            continue
        if r.width > 0.7 * largura and r.height > 60 and d.get("fill") is None:
            continue
        # enfeite pequeno no canto inferior da página (provas de 2014)
        if r.y0 > 0.85 * pagina.rect.height and r.width < 45 and r.height < 45                 and (r.x0 > 0.8 * largura or r.x1 < 0.2 * largura):
            continue
        figuras.append(r)
    linhas.sort(key=lambda x: (x[0].y0, x[0].x0))
    return linhas, figuras


def _uniao(rects):
    u = fitz.Rect(rects[0])
    for r in rects[1:]:
        u |= r
    return u


# --------------------------------------------------------------------------
# Segmentação
# --------------------------------------------------------------------------

def _fim_das_alternativas(linhas, figuras, largura=581, primeira="A", minimo=4):
    """y final da questão quando há alternativas (A)…(D/E); None se não há."""
    # Marcas "(A)"…"(E)" em QUALQUER posição da linha: em grades 2×2 de
    # alternativas-imagem, "(A)" e "(B)" dividem a mesma linha.
    marcas = []
    for r, sp in linhas:
        for s in sp:
            m = RE_ALT.match(s["text"].strip())
            if m:
                sr = fitz.Rect(s["bbox"])
                marcas.append((round(sr.y0 / 4), sr.x0, m.group(1), r if sr.x0 - r.x0 < 4 else sr))
    marcas.sort(key=lambda x: (x[0], x[1]))
    # sequência estrita A, B, C, D[, E]
    seq, esperado = [], primeira
    for _, _, letra, r in marcas:
        if letra == esperado:
            seq.append(r)
            esperado = chr(ord(esperado) + 1)
    if len(seq) < minimo:
        return None, len(seq)
    ultima = seq[-1]
    fim = ultima.y1
    # continuação do texto da última alternativa: linha colada e RECUADA
    # (alinhada ao texto depois de "(D) "). Um texto de apoio que começa logo
    # abaixo fica alinhado ao próprio "(D)" e não pode ser engolido.
    for r, _ in linhas:
        if r.y0 > ultima.y0 + 1 and r.y0 - fim < 6 and r.x0 >= ultima.x0 + 6:
            fim = max(fim, r.y1)
    # alternativas em imagem/gráfico: figuras que começam na zona das
    # alternativas. Caixas de largura total (fundo do texto de apoio que vem
    # logo depois) ficam de fora — alternativa-imagem ocupa no máximo ~meia
    # página.
    inicio_alts = seq[0].y0 - 4
    imgs_alt = [f for f in figuras if inicio_alts <= f.y0 <= ultima.y1 + 12 and f.width < 0.6 * largura]
    for f in imgs_alt:
        fim = max(fim, f.y1)
    # legendas logo abaixo de cada alternativa-imagem ("Os operários",
    # Tarsila do Amaral, 1933) — inclusive em 2 linhas
    base_por_img = {i: f.y1 for i, f in enumerate(imgs_alt)}
    for r, _ in linhas:
        for i, f in enumerate(imgs_alt):
            sobrepoe = min(r.x1, f.x1) - max(r.x0, f.x0) > 0.3 * min(r.width, f.width)
            if sobrepoe and 0 <= r.y0 - base_por_img[i] < 10:
                base_por_img[i] = r.y1
                fim = max(fim, r.y1)
    return fim, len(seq)


def _conteudo(linhas, figuras):
    rects = [r for r, sp in linhas if not RE_RESPOSTA.match(" ".join(s["text"] for s in sp).strip())]
    rects += figuras
    return _uniao(rects) if rects else None


def segmentar(doc, objetiva=True):
    selos = achar_selos(doc)
    limites = {}
    for n in range(doc.page_count):
        limites[n] = _limites(doc[n], _spans(doc[n]))

    eventos = []  # ("q", Questao) | ("apoio", [Bloco]) em ordem de leitura

    def ignorar_da_pagina(n):
        out = []
        for s in selos:
            if s.pagina == n:
                out.append(s.rect)
                out += s.extras
        return out

    # 1) conteúdo de cada página ANTES do primeiro selo (ou a página toda)
    def topo_da_pagina(n, ate):
        topo, base = limites[n]
        faixa = fitz.Rect(0, topo, doc[n].rect.width, min(ate, base))
        if faixa.height < 8:
            return None
        linhas, figuras = _elementos(doc[n], faixa, ignorar_da_pagina(n))
        c = _conteudo(linhas, figuras)
        if c is None or (c.height < 12 and not figuras):
            return None
        return Bloco(n, c)

    por_pagina = {}
    for s in selos:
        por_pagina.setdefault(s.pagina, []).append(s)

    pendente = None  # questão objetiva que continua na página seguinte
    pendente_alts = 0
    for n in range(doc.page_count):
        lista = por_pagina.get(n, [])
        primeiro_y = lista[0].topo - 3 if lista else limites[n][1]
        b = topo_da_pagina(n, primeiro_y)
        if b is not None:
            if pendente is not None:
                linhas, figuras = _elementos(doc[n], b.rect, ignorar_da_pagina(n))
                ja = pendente_alts
                fim, _ = _fim_das_alternativas(linhas, figuras, doc[n].rect.width,
                                               primeira=chr(ord("A") + ja), minimo=max(1, 4 - ja))
                if fim is not None:
                    cont = Bloco(n, fitz.Rect(b.rect.x0, b.rect.y0, b.rect.x1, fim))
                    pendente.blocos.append(cont)
                    pendente.tem_alternativas = True
                    resto = fitz.Rect(b.rect.x0, fim + 3, b.rect.x1, b.rect.y1)
                    if resto.height > 12:
                        l2, f2 = _elementos(doc[n], resto, ignorar_da_pagina(n))
                        c2 = _conteudo(l2, f2)
                        if c2 is not None:
                            eventos.append(("apoio", [Bloco(n, c2)]))
                else:
                    # sem as alternativas que faltavam: não é continuação
                    # (ex.: tabela periódica no fim da prova)
                    eventos.append(("apoio", [b]))
                pendente = None
            else:
                eventos.append(("apoio", [b]))
        pendente = None

        for i, s in enumerate(lista):
            topo, base = limites[n]
            fim_faixa = lista[i + 1].topo - 3 if i + 1 < len(lista) else base
            faixa = fitz.Rect(0, s.topo - 3, doc[n].rect.width, fim_faixa)
            linhas, figuras = _elementos(doc[n], faixa, ignorar_da_pagina(n))
            if not linhas and not figuras:
                continue
            fim, n_alts = _fim_das_alternativas(linhas, figuras, doc[n].rect.width)
            if fim is not None:
                corpo_l = [(r, sp) for r, sp in linhas if r.y0 <= fim + 1]
                corpo_f = [f for f in figuras if f.y0 <= fim + 1]
                rect = _conteudo(corpo_l, corpo_f)
                rect.y1 = max(rect.y1, fim)
                q = Questao(s.numero, s, [Bloco(n, rect)], True)
                eventos.append(("q", q))
                # sobra abaixo da última alternativa = texto de apoio seguinte
                resto = fitz.Rect(0, fim + 3, doc[n].rect.width, fim_faixa)
                if resto.height > 12:
                    l2, f2 = _elementos(doc[n], resto, ignorar_da_pagina(n))
                    c2 = _conteudo(l2, f2)
                    if c2 is not None and (c2.height > 14 or f2):
                        eventos.append(("apoio", [Bloco(n, c2)]))
            else:
                rect = _conteudo(linhas, figuras)
                if rect is None:
                    continue
                q = Questao(s.numero, s, [Bloco(n, rect)], False)
                eventos.append(("q", q))
                # objetiva sem as 4 alternativas na página: continua na próxima
                if objetiva and i == len(lista) - 1 and n_alts < 4:
                    pendente = q
                    pendente_alts = n_alts

    return eventos


# --------------------------------------------------------------------------
# Texto (com sobrescrito/subscrito)
# --------------------------------------------------------------------------

def _texto_linha(spans):
    tam = max(s["size"] for s in spans)
    base = max((s["origin"][1] for s in spans if s["size"] >= tam - 0.3), default=spans[0]["origin"][1])
    partes = []
    for s in spans:
        t = s["text"]
        if "symbol" in s.get("font", "").lower():
            t = t.translate(GREGO)
        pequeno = s["size"] < tam * 0.82
        if (s["flags"] & 1 or (pequeno and s["origin"][1] < base - 1.2)) and len(t.strip()) <= 6:
            t = t.strip().translate(SUPER)
        elif pequeno and s["origin"][1] > base + 0.8 and len(t.strip()) <= 4:
            t = t.strip().translate(SUB)
        partes.append(t)
    return re.sub(r"[ \t]+", " ", "".join(partes)).strip()


def texto_dos_blocos(doc, blocos, ignorar):
    linhas_txt = []
    for b in blocos:
        pg = doc[b.pagina]
        linhas, _ = _elementos(pg, b.rect, ignorar.get(b.pagina, []))
        ant = None
        for r, spans in linhas:
            if not (b.rect.x0 - 2 <= r.x0 <= b.rect.x1):
                continue
            t = _texto_linha(spans)
            if not t:
                continue
            # mesma linha visual (spans em blocos diferentes): junta
            if ant is not None and abs(r.y0 - ant.y0) < 2.5 and linhas_txt:
                linhas_txt[-1] += " " + t
            else:
                linhas_txt.append(t)
            ant = r
    return linhas_txt


def avaliar_conteudo(doc, blocos, ignorar):
    """(tem_figura, tem_formula) dentro dos blocos de uma questão.

    tem_formula = barra de fração: traço horizontal curto com texto logo
    ACIMA e logo ABAIXO (um sublinhado só tem texto acima). Questão sem
    figura e sem fórmula pode ser lida como texto sem perder nada.
    """
    figura = formula = False
    for b in blocos:
        linhas, figuras = _elementos(doc[b.pagina], b.rect, ignorar.get(b.pagina, []))
        for f in figuras:
            if f.width > 40 and f.height > 25:
                figura = True
            elif f.height < 2.5 and 4 < f.width < 140:
                acima = any(r.y1 <= f.y0 + 1 and f.y0 - r.y1 < 12 and min(r.x1, f.x1) - max(r.x0, f.x0) > 2 for r, _ in linhas)
                abaixo = any(r.y0 >= f.y1 - 1 and r.y0 - f.y1 < 12 and min(r.x1, f.x1) - max(r.x0, f.x0) > 2 for r, _ in linhas)
                if acima and abaixo:
                    formula = True
        if any(ch in "√∫∑∏" for _, sp in linhas for s in sp for ch in s["text"]):
            formula = True
    # Sinais no TEXTO de fração empilhada: linha só com um número curto
    # ("1" numa linha, "2" na outra) ou expoente solto antes de vírgula/
    # espaço+número ("(¹, ¹ ," / "¹²ᶜ 13").
    for t in texto_dos_blocos(doc, blocos, ignorar):
        t = t.strip()
        if re.fullmatch(r"[\dA-Za-zπ⁰¹²³⁴⁵⁶⁷⁸⁹ᶜ+\-−]{1,4}", t) and not RE_ALT.match(t):
            formula = True
        if re.search(r"[⁰¹²³⁴⁵⁶⁷⁸⁹]\s*[,)]|[⁰¹²³⁴⁵⁶⁷⁸⁹ᶜ]\s+\d", t):
            formula = True
    return figura, formula


def separar_alternativas(linhas):
    enunciado, alts, atual = [], [], None
    quebradas = []
    for l in linhas:
        quebradas += re.split(r"\s+(?=\(\s*[B-E]\s*\)(?:\s|$))", l) if RE_ALT.match(l) else [l]
    for l in quebradas:
        m = RE_ALT.match(l)
        if m and (not alts and m.group(1) == "A" or alts and m.group(1) == chr(ord(alts[-1]["letra"]) + 1)):
            atual = {"letra": m.group(1), "texto": l[m.end():].strip()}
            alts.append(atual)
        elif atual is not None:
            atual["texto"] = (atual["texto"] + " " + l).strip()
        else:
            enunciado.append(l)
    texto = "\n".join(enunciado)
    texto = re.sub(r"(\w)-\n(\w)", r"\1\2", texto)  # hifenização da quebra
    return texto.strip(), (alts if len(alts) >= 4 else [])


# --------------------------------------------------------------------------
# Montagem
# --------------------------------------------------------------------------

def analisar(caminho_pdf, objetiva=True, area_idioma_da_pagina=None):
    """Segmenta o PDF. `area_idioma_da_pagina(n)` -> (area, idioma) opcional."""
    doc = fitz.open(caminho_pdf)
    eventos = segmentar(doc, objetiva)
    ignorar = {}
    for _, q in (e for e in eventos if e[0] == "q"):
        ignorar.setdefault(q.selo.pagina, []).extend([q.selo.rect] + q.selo.extras)

    def decorativo(bl):
        linhas, figuras = _elementos(doc[bl.pagina], bl.rect, ignorar.get(bl.pagina, []))
        # Sem nenhuma linha de texto: fio divisório, fundo decorativo ou
        # página de rascunho. Na auditoria de out/2026 nenhum bloco assim era
        # texto de apoio de verdade.
        return not linhas

    # Funde apoios consecutivos (sem questão no meio), ignora a capa e
    # descarta fios/linhas divisórias soltas.
    fundidos = []
    for tipo, obj in eventos:
        if tipo == "apoio":
            obj = [bl for bl in obj if bl.pagina > 0 and not decorativo(bl)]
            if not obj:
                continue
            if fundidos and fundidos[-1][0] == "apoio":
                fundidos[-1][1].extend(obj)
                continue
        fundidos.append((tipo, obj))

    questoes, apoios, faixas = [], [], []
    ultimo_apoio = {}  # (area, idioma) -> índice do apoio vigente (sem faixa)
    acabou_de_vir = None
    for tipo, obj in fundidos:
        if tipo == "apoio":
            apoios.append(obj)
            idx = len(apoios) - 1
            texto = " ".join(texto_dos_blocos(doc, obj, ignorar))
            m = RE_FAIXA.search(texto)
            if m:
                ini, fim = int(m.group(1)), int(m.group(3))
                nums = set(range(ini, fim + 1)) if m.group(2).upper() in ("A", "ATÉ", "ATE") else {ini, fim}
                ctx = area_idioma_da_pagina(obj[0].pagina) if area_idioma_da_pagina else (None, None)
                faixas.append((idx, nums, ctx))
                acabou_de_vir = None
            else:
                acabou_de_vir = idx
            continue
        q = obj
        if area_idioma_da_pagina:
            q.area, q.idioma = area_idioma_da_pagina(q.selo.pagina)
        linhas = texto_dos_blocos(doc, q.blocos, ignorar)
        enunciado, alts = separar_alternativas(linhas)
        figura, formula = avaliar_conteudo(doc, q.blocos, ignorar)
        q.texto = {"enunciado": enunciado, "alternativas": alts,
                   "tem_figura": figura, "tem_formula": formula}
        chave = (q.area, q.idioma)
        explicitos = [i for i, nums, ctx in faixas
                      if q.numero in nums and (ctx[1] is None or ctx[1] == q.idioma)]
        if explicitos:
            q.apoios = explicitos[-2:]
        if acabou_de_vir is not None:
            q.apoios = q.apoios + [acabou_de_vir]
            ultimo_apoio[chave] = acabou_de_vir
            acabou_de_vir = None
        elif not explicitos and chave in ultimo_apoio and RE_REFERENCIA_TEXTO.search(enunciado)                 and not RE_FONTE_PROPRIA.search(enunciado):
            q.apoios = [ultimo_apoio[chave]]
        questoes.append(q)
    return doc, Documento(questoes, apoios)


def renderizar_separados(doc, blocos, base_destino):
    """Um arquivo por bloco (textos de apoio longos, de várias páginas)."""
    caminhos = []
    for i, b in enumerate(blocos):
        caminhos.append(renderizar(doc, [b], f"{base_destino}_{i}.webp"))
    return caminhos


def renderizar(doc, blocos, destino, largura_max=None):
    """Renderiza 1+ blocos empilhados numa única imagem WebP."""
    from PIL import Image

    imgs = []
    for b in blocos:
        pg = doc[b.pagina]
        r = fitz.Rect(b.rect)
        r.x0 = max(r.x0 - MARGEM, 0)
        r.y0 = max(r.y0 - MARGEM, 0)
        r.x1 = min(r.x1 + MARGEM, pg.rect.width)
        r.y1 = min(r.y1 + MARGEM, pg.rect.height)
        pix = pg.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), clip=r, alpha=False)
        imgs.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    w = max(i.width for i in imgs)
    h = sum(i.height for i in imgs) + 16 * (len(imgs) - 1)
    tela = Image.new("RGB", (w, h), "white")
    y = 0
    for i in imgs:
        tela.paste(i, (0, y))
        y += i.height + 16
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    tela.save(destino, "WEBP", quality=82, method=6)
    return destino


if __name__ == "__main__":
    caminho = sys.argv[1]
    saida = sys.argv[2] if len(sys.argv) > 2 else os.path.join("dados", "imagens", "_recortes_teste")
    doc, d = analisar(caminho)
    for q in d.questoes:
        renderizar(doc, q.blocos, os.path.join(saida, f"q{q.numero:02d}_p{q.selo.pagina + 1}.webp"))
        print(q.numero, "pág", q.selo.pagina + 1, "alts:", len(q.texto["alternativas"]), "apoios:", q.apoios,
              "|", q.texto["enunciado"][:80].replace("\n", " "))
    for i, a in enumerate(d.apoios):
        renderizar(doc, a, os.path.join(saida, f"apoio{i:02d}_p{a[0].pagina + 1}.webp"))
    print(len(d.questoes), "questões,", len(d.apoios), "textos de apoio")
