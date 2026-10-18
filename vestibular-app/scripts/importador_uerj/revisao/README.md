# Revisão do acervo UERJ (out/2026)

Reprocessa todas as provas a partir dos PDFs oficiais e corrige o banco.

## Por que existe

A auditoria de 17/10/2026 (1.947 questões) achou erros sistemáticos da extração
por texto corrido (`extrair.py`):

| Problema | Antes | Depois |
| --- | --- | --- |
| Alternativa D "engolindo" rodapé e o texto-base da questão seguinte | 213 | 0 |
| Alternativa com mais de 500 caracteres (texto alheio) | 175 | 0 |
| Expoentes achatados ("3 × 108 m/s" no lugar de 3 × 10⁸) | sistemático | corrigido |
| Questões que existiam na prova e faltavam no banco | 125 | 0 |
| Questões sem gabarito (inclusive todas as de idioma) | 489 | 0* |
| Disciplina errada ou "Não Classificada" | 325 | 0 |
| Linhas de lixo (número 0, numeração deslocada) | 10 | 0 |

\* exceto 2020/1º EQ, cujo gabarito oficial não está no catálogo baixado (o
banco mantém o que já tinha) e as 7 questões **anuladas** pela UERJ, que
agora são marcadas como tal.

## Como funciona

`../recortes.py` trabalha pela **geometria da página**: acha o selo "QUESTÃO NN",
recorta a faixa da questão até a última alternativa (inclusive alternativas
em imagem e suas legendas) e separa o que sobra como **texto de apoio**, ligado
à(s) questão(ões) certas pelo aviso "RESPONDA ÀS QUESTÕES 07 E 08" ou pela
referência ao texto. O aluno vê o recorte, idêntico à prova; o texto (com
sobrescrito/subscrito) fica para busca e leitores de tela.

Validado visualmente em todos os layouts (2013–2027, objetivas, discursivas,
Exame Único, quatro idiomas).

## Passo a passo

Rodar de dentro desta pasta, com os PDFs já baixados em `../dados/downloads/`
(`python ../main.py` baixa).

```bash
python baixar_banco.py      # 0. estado atual do banco (leitura pública)
python auditar.py           # 1. relatório de erros do banco atual
python processar.py         # 2. recorta todas as provas (dados/revisao/lote/)
python gabaritos.py         # 3. lê os gabaritos oficiais (por idioma, anuladas)
python montar_pacote.py     # 4. junta tudo em dados/revisao/pacote.json
python publicar_revisao.py --simular   # 5a. confere
python publicar_revisao.py             # 5b. publica (precisa da PARTE 14)
python folha.py saida.png 77/q04.webp ...  # (QA) folha de contato p/ revisão visual
```

`disciplinas_revisadas.json` guarda as disciplinas decididas por leitura
(prova_id:numero). Elas têm prioridade sobre a classificação automática.

## Pendência

O pipeline principal (`../main.py`) ainda usa a extração por texto corrido.
Uma importação nova (ex.: provas de 2028) deve passar por esta revisão antes de
ir para o app — ou o `main.py` deve passar a usar `recortes.py` diretamente.
