"""Caminhos e leitura compartilhados pelas ferramentas da revisão."""
import json
import os

REVISAO = os.path.dirname(os.path.abspath(__file__))
IMPORTADOR = os.path.dirname(REVISAO)
# Tudo o que é gerado (dump do banco, recortes, pacote) fica fora do git.
AUDIT = os.path.join(IMPORTADOR, "dados", "revisao")
os.makedirs(AUDIT, exist_ok=True)


def provas():
    return {x["id"]: x for x in json.load(open(os.path.join(AUDIT, "provas_uerj.json"), encoding="utf-8"))}


def questoes():
    return json.load(open(os.path.join(AUDIT, "questoes_uerj.json"), encoding="utf-8"))


def manifesto():
    return json.load(open(os.path.join(IMPORTADOR, "dados", "cache", "manifesto.json"), encoding="utf-8"))


def caminho_local(entrada):
    """O manifesto guarda o caminho da máquina onde foi gerado; remapeia
    para a pasta `dados/` atual."""
    rel = entrada["caminho_local"].replace("\\", "/").split("importador_uerj/dados/")[1]
    return os.path.join(IMPORTADOR, "dados", *rel.split("/"))


def entrada_da_prova(prova):
    for e in manifesto().values():
        if e["url"] == prova["url_original"]:
            e = dict(e)
            e["caminho_local"] = caminho_local(e)
            return e
    return None
