"""Folha de contato: empilha recortes com um rótulo, para revisão visual.
Uso: python folha.py <saida.png> <prova/arquivo> [<prova/arquivo> ...]"""
import os
import sys

from PIL import Image, ImageDraw

import util

BASE = os.path.join(util.AUDIT, "lote")
LARG = 760
saida, itens = sys.argv[1], sys.argv[2:]
partes = []
for it in itens:
    im = Image.open(os.path.join(BASE, it)).convert("RGB")
    esc = LARG / im.width
    im = im.resize((LARG, max(1, int(im.height * esc))))
    rot = Image.new("RGB", (LARG, 22), (40, 40, 40))
    ImageDraw.Draw(rot).text((6, 5), it, fill=(255, 220, 90))
    partes += [rot, im, Image.new("RGB", (LARG, 10), (255, 255, 255))]
h = sum(p.height for p in partes)
tela = Image.new("RGB", (LARG, h), "white")
y = 0
for p in partes:
    tela.paste(p, (0, y))
    y += p.height
tela.save(saida)
print(saida, tela.size)
