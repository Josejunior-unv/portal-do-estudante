"""Baixa provas_uerj e questoes_uerj (leitura pública) para dados/revisao/."""
import json
import os
import sys
import urllib.request

import util

sys.path.insert(0, util.IMPORTADOR)
from config import SUPABASE_URL  # noqa: E402

# Chave publishable do app (pública por design; só leitura via RLS).
CHAVE = os.environ.get("SUPABASE_ANON_KEY", "sb_publishable__GrVY6C5aG9TnTXbUqd4xQ_e2aIoLrq")


def todos(tabela):
    linhas, ini = [], 0
    while True:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/{tabela}?select=*&order=id",
            headers={"apikey": CHAVE, "Authorization": f"Bearer {CHAVE}", "Range": f"{ini}-{ini + 999}"},
        )
        lote = json.load(urllib.request.urlopen(req, timeout=60))
        linhas += lote
        if len(lote) < 1000:
            return linhas
        ini += 1000


for tabela in ("provas_uerj", "questoes_uerj"):
    dados = todos(tabela)
    json.dump(dados, open(os.path.join(util.AUDIT, f"{tabela}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(tabela, len(dados))
