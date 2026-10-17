-- ============================================================================
-- HISTÓRICO — NÃO RODAR DE NOVO
-- Correções de DADOS das auditorias de jul/2026 (partes 10 a 13 do antigo
-- supabase_migration.sql). Já foram aplicadas em produção.
--
-- Em out/2026 o acervo inteiro foi reprocessado a partir dos PDFs oficiais
-- (scripts/importador_uerj/recortes.py + publicar_revisao.py). Rodar este
-- arquivo agora DESFARIA aquela revisão: a parte 10 apaga os gabaritos de
-- língua estrangeira e a parte 12 volta classificações antigas.
-- Fica guardado só como registro do que foi feito.
-- ============================================================================

-- ============================================================================
-- PARTE 10 — Correções de dados do acervo UERJ (auditoria de 08/07/2026).
-- Idempotente: rodar de novo não muda nada.
-- ============================================================================

-- 10a) Questões de língua estrangeira NUNCA têm gabarito: a coluna do
--      gabarito oficial é por idioma, e o pipeline pode ter casado a coluna
--      de outra língua quando só uma versão foi extraída. Melhor sem
--      correção do que corrigir o aluno com a resposta de outro idioma.
--      (O pipeline foi corrigido para não reintroduzir; isto limpa o legado.)
update public.questoes_uerj
   set resposta = null
 where disciplina in ('Inglês', 'Espanhol', 'Francês')
   and resposta is not null;

-- 10b) Área canônica derivada da disciplina (o rodapé de PDFs antigos traz a
--      forma combinada "Ciências da Natureza e Matemática" ou nada).
update public.questoes_uerj
   set area = case
       when disciplina in ('Português','Inglês','Espanhol','Francês','Redação')
         then 'Linguagens'
       when disciplina = 'Matemática' then 'Matemática'
       when disciplina in ('Biologia','Física','Química')
         then 'Ciências da Natureza'
       when disciplina in ('História','Geografia','Filosofia','Sociologia')
         then 'Ciências Humanas'
       else area
     end
 where disciplina is not null
   and disciplina <> 'Não Classificada'
   and (area is null or area = 'Ciências da Natureza e Matemática'
        or area is distinct from case
       when disciplina in ('Português','Inglês','Espanhol','Francês','Redação')
         then 'Linguagens'
       when disciplina = 'Matemática' then 'Matemática'
       when disciplina in ('Biologia','Física','Química')
         then 'Ciências da Natureza'
       when disciplina in ('História','Geografia','Filosofia','Sociologia')
         then 'Ciências Humanas'
       else area end);

-- ============================================================================
-- PARTE 11 — Cadernos discursivos de Língua Estrangeira mal classificados
-- (auditoria profunda de 08/07/2026). Idempotente.
--
-- CAUSA RAIZ: os PDFs "Linguas_estrangeiras.pdf"/"Lingua_Estrangeira.pdf"/
-- "Estrangeiras.pdf" (prova discursiva de Língua Portuguesa/Literatura +
-- Língua Estrangeira) não casavam nenhuma chave do mapa nome→disciplina do
-- crawler, então a prova ficava com disciplina=NULL e o classificador chutava
-- entre TODAS as disciplinas. Resultado: questões sobre textos em espanhol
-- (Isabel Allende, tirinhas do Quino/Gaturro) foram rotuladas como Matemática
-- e Biologia — e apareciam nesses filtros. O crawler (ROTULO_DISCIPLINA) e o
-- classificador (não chuta mais sem área) foram corrigidos na origem; este
-- bloco conserta o acervo já publicado sem exigir reimportação.
-- ------------------------------------------------------------

-- 11a) Todas as questões desses 3 cadernos são de LINGUAGENS. As que ficaram
--      em outras áreas viram Português (interpretação); Espanhol/Inglês/
--      Francês/Português já corretas são preservadas.
update public.questoes_uerj
   set disciplina = 'Português',
       area = 'Linguagens',
       assunto = case when assunto is null or assunto = 'Não Classificado'
                      then 'Interpretação de Texto' else assunto end,
       classificada = true
 where prova_id in (7, 67, 390)
   and disciplina in ('Matemática', 'Biologia', 'Não Classificada');

update public.questoes_uerj
   set area = 'Linguagens'
 where prova_id in (7, 67, 390);

update public.provas_uerj
   set disciplina = 'Português'
 where id in (7, 67, 390) and disciplina is null;

-- 11b) Erros pontuais de área cruzada confirmados por leitura do enunciado:
--      metalinguagem gramatical/literária = Português; texto em espanhol =
--      Espanhol. (Todos verificados um a um; não é reclassificação em massa.)
--      6713/6323: "coesão textual"/"modalização do verbo parecer" → Português
--      6504: "emprego dos dois-pontos estabelece coesão" → Português
--      6763: poema sobre Lampião (cangaço/sertão) → Português (Literatura)
update public.questoes_uerj
   set disciplina = 'Português', area = 'Linguagens', classificada = true
 where id in (6713, 6323, 6504, 6763);

--      7986: "habla de la mujer del coronel" (García Márquez, espanhol) → Espanhol
--      resposta=null porque a 10a roda antes desta reclassificação — o gabarito
--      que ela carregava foi casado sob a disciplina errada (regra: idiomas
--      nunca têm gabarito, a coluna oficial é por língua).
update public.questoes_uerj
   set disciplina = 'Espanhol', area = 'Linguagens', classificada = true,
       resposta = null
 where id = 7986;

-- 11c) Conteúdo de Ciências Humanas rotulado como Natureza nos Exames Únicos
--      2022/2023 (a detecção de área por rodapé falha no formato de prova
--      única, e o chute por palavra-chave caiu na área errada). Verificados:
--      7143: Tratado de Versalhes / Guilherme II (1ª Guerra) → História
--      8024: restos mortais de Alexandre Dumas no Panteão (memória) → História
--      8028: zoológico humano de Tervuren / Leopoldo II (colonialismo) → História
--      7955: mapa do credo predominante por Estado → Geografia
--      7957: bandeira Whipala / multiculturalismo (identidade) → Sociologia
update public.questoes_uerj
   set disciplina = 'História', area = 'Ciências Humanas', classificada = true
 where id in (7143, 8024, 8028);
update public.questoes_uerj
   set disciplina = 'Geografia', area = 'Ciências Humanas', classificada = true
 where id = 7955;
update public.questoes_uerj
   set disciplina = 'Sociologia', area = 'Ciências Humanas', classificada = true
 where id = 7957;

-- ============================================================================
-- Verificação rápida (deve retornar as 4 linhas abaixo sem erro):
select 'materiais_estudo.tipo' as ok
  from information_schema.columns
  where table_name = 'materiais_estudo' and column_name = 'tipo'
union all select 'tabela tarefas_status' from information_schema.tables
  where table_name = 'tarefas_status'
union all select 'tabela noticias' from information_schema.tables
  where table_name = 'noticias'
union all select 'tabelas provas/questoes uerj' from information_schema.tables
  where table_name = 'questoes_uerj';


-- ====================================================================
-- PARTE 12 — Auditoria completa de classificação (gerada 09/07/2026)
-- 115 correções de alta confiança validadas por leitura questão a questão.
-- Idempotente: UPDATE por id. Reclassifica questões de fronteira de bloco
-- mal rotuladas + classifica 'Não Classificada' de Natureza/Matemática/idiomas.
-- NÃO altera as 154 questões de Ciências Humanas objetivas (estrutura
-- oficial da UERJ é por ÁREA; subdisciplina seria inferência de baixa confiança).
-- ====================================================================
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Álgebra', classificada=true where id = 6116; -- conjunto de Cantor/fractal (sequência)
update public.questoes_uerj set disciplina='Geografia', area='Ciências Humanas', assunto='Geopolítica', classificada=true where id = 6118; -- Estado-nação/Estados plurinacionais
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Eletricidade', classificada=true where id = 6155; -- resistores em série/tensão-corrente — física, estava Matemática (nº35)
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Botânica', classificada=true where id = 6160; -- musgos briófitas/gametas flagelados
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 6268; -- encontro de trens/distância (cinemática)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 6273; -- fórmula óxido de arsênio As2O3 (alternativas)
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Álgebra', classificada=true where id = 6325; -- juros do cartão/matemática financeira
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 6366; -- corredores movimento uniforme/distância
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Ecologia', classificada=true where id = 6368; -- bioluminescência/vaga-lumes (comportamento)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 6370; -- apatita Ca3(PO4)2/ânion fosfato
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 6371; -- urânio-235/plutônio-239/nêutrons (estrutura atômica)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 6372; -- potência média = energia/tempo das bombas
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Zoologia', classificada=true where id = 6373; -- anelídeos oligoquetos/líquido celomático
update public.questoes_uerj set disciplina='Português', area='Linguagens', assunto='Interpretação de Texto', classificada=true where id = 6392; -- funções da linguagem (argumentar)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Óptica e Ondas', classificada=true where id = 6393; -- câmara escura/óptica geométrica
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 6394; -- iodeto de prata/redução Ag+ (fórmula)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 6435; -- energia cinética dos carneiros (joules)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Eletricidade', classificada=true where id = 6445; -- esferas condutoras/cargas elétricas/contato
update public.questoes_uerj set disciplina='Não Classificada', area='Ciências Humanas', assunto='Não Classificado', classificada=false where id = 6447; -- cobertura universal de saúde/liberalismo — rodapé Ciências Humanas; área errada
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 6545; -- mendelévio/símbolo Md — conteúdo 100% química, estava como Matemática (fronteira de bloco nº35)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Físico-Química', classificada=true where id = 6556; -- NaCl/solubilidade/mols (solução saturada)
update public.questoes_uerj set disciplina='Não Classificada', area='Ciências Humanas', assunto='Não Classificado', classificada=false where id = 6557; -- Nelson Sargento/Mangueira/cultura afro-brasileira — rodapé Ciências Humanas; área errada
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 6621; -- relatividade/dilatação do tempo
update public.questoes_uerj set disciplina='Português', area='Linguagens', assunto='Gramática', classificada=true where id = 6622; -- conectivo/coesão (no entanto)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 6663; -- xenônio/camada de valência — química, estava Matemática (nº35)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Eletricidade', classificada=true where id = 6665; -- lâmpada LED/potência/energia elétrica
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Ecologia', classificada=true where id = 6711; -- níveis tróficos (cadeia alimentar)
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Citologia e Genética', classificada=true where id = 6758; -- tipos celulares (melanócitos/astrócitos)
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Fisiologia', classificada=true where id = 6858; -- doping sanguíneo/eritrócitos
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Estequiometria', classificada=true where id = 6860; -- balanceamento KI+O3+H2SO4 (coeficientes)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Físico-Química', classificada=true where id = 6862; -- equilíbrio químico/pressão/deslocamento
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Álgebra', classificada=true where id = 6881; -- desperdício de água/aritmética
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 6926; -- mendelévio/número de átomos (mol)
update public.questoes_uerj set disciplina='Não Classificada', area='Ciências Humanas', assunto='Não Classificado', classificada=false where id = 6933; -- comércio justo/indústria da moda — Humanas; área errada
update public.questoes_uerj set disciplina='Português', area='Linguagens', assunto='Interpretação de Texto', classificada=true where id = 6947; -- estratégia argumentativa (autoridade)
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Probabilidade e Estatística', classificada=true where id = 6948; -- razão mortes/casos (proporção)
update public.questoes_uerj set disciplina='Português', area='Linguagens', assunto='Gramática', classificada=true where id = 6954; -- marca verbal/futuro do pretérito
update public.questoes_uerj set disciplina='Português', area='Linguagens', assunto='Interpretação de Texto', classificada=true where id = 6955; -- interlocução com o leitor (pergunta)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 6992; -- gases/substância composta (CO2)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 6995; -- engrenagens/período/frequência
update public.questoes_uerj set disciplina='Geografia', area='Ciências Humanas', assunto='Geografia Humana', classificada=true where id = 7003; -- favela da Maré/processo urbano — rodapé Ciências Humanas; área errada
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Geometria', classificada=true where id = 7021; -- teorema de Pitágoras/tripla pitagórica
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Geometria', classificada=true where id = 7022; -- simetria/mediatriz
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7023; -- colisão inelástica/momento linear
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Ecologia', classificada=true where id = 7063; -- líquens/rocha nua/sucessão ecológica
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Termologia', classificada=true where id = 7064; -- mudança de estado físico/vaporização
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 7065; -- NaCl/função química (sal)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Eletricidade', classificada=true where id = 7069; -- transformador/espiras primário-secundário
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Evolução e Microbiologia', classificada=true where id = 7070; -- dispersão de sementes/vantagem evolutiva
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Fisiologia', classificada=true where id = 7136; -- gestação/saco vitelínico (embriologia)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Orgânica', classificada=true where id = 7138; -- ácido 3-metilbutanoico/fórmula estrutural
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7139; -- força resultante/trajetória curva
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Estequiometria', classificada=true where id = 7141; -- vidro borossilicato/óxido básico/massa
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 7196; -- identificação de metal por propriedades químicas
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7206; -- equilíbrio de régua com moedas (torque)
update public.questoes_uerj set disciplina='Não Classificada', area='Ciências Humanas', assunto='Não Classificado', classificada=false where id = 7208; -- Hugh Glass/conquista do Oeste — Humanas; área errada (subdisciplina ambígua)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 7229; -- carbono-14/número de mols
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Álgebra', classificada=true where id = 7230; -- escala linear/proporção
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Termologia', classificada=true where id = 7269; -- pressão do gás x raio do balão
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Botânica', classificada=true where id = 7270; -- raízes de mangue/fixação
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 7271; -- ácidos de Arrhenius/H2SO4
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Fisiologia', classificada=true where id = 7273; -- capilares/troca de substâncias
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Orgânica', classificada=true where id = 7274; -- benzopireno/razão C:H
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7330; -- deslocamento do peixe por densidade (hidrostática)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7332; -- variação de pressão sobre o peixe (atm)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 7338; -- energia de ionização de novos elementos
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Evolução e Microbiologia', classificada=true where id = 7339; -- evolução de primatas/musculatura
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Termologia', classificada=true where id = 7340; -- calor latente de fusão (cal/g)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Estequiometria', classificada=true where id = 7341; -- dissolução/recuperação de ouro (massa)
update public.questoes_uerj set disciplina='Geografia', area='Ciências Humanas', assunto='Geografia Humana', classificada=true where id = 7345; -- cartograma de religiões/anamorfose — rodapé Ciências Humanas
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 7407; -- razão com número de Avogadro (6e23)
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Fisiologia', classificada=true where id = 7414; -- transporte de O2 no plasma sanguíneo
update public.questoes_uerj set disciplina='Geografia', area='Ciências Humanas', assunto='Geografia Humana', classificada=true where id = 7415; -- Ponte Rio-Niterói/conexão de rodovias — rodapé ciências humanas
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Orgânica', classificada=true where id = 7481; -- álcoois/centro quiral/solubilidade
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Físico-Química', classificada=true where id = 7484; -- decomposição do NaHCO3/CO2 x temperatura
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Fisiologia', classificada=true where id = 7545; -- salinidade/estresse osmótico em peixes
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Físico-Química', classificada=true where id = 7546; -- concentração de NaCl/massa a adicionar
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Termologia', classificada=true where id = 7553; -- gás/tanque de mergulho/pressão (Boyle)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7607; -- forças sobre bola de ferro/projétil
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Orgânica', classificada=true where id = 7612; -- guanina oxidada/átomo X (O)
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Físico-Química', classificada=true where id = 7614; -- curvas de solubilidade/massa de soluto
update public.questoes_uerj set disciplina='Geografia', area='Ciências Humanas', assunto='Geografia Humana', classificada=true where id = 7618; -- Zona Portuária do Rio/urbanização — Humanas
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Ecologia', classificada=true where id = 7671; -- corredor florestal/deriva gênica — biologia, estava Matemática (nº30)
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Fisiologia', classificada=true where id = 7673; -- glicogênio x gorduras (bioquímica/hidrólise)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7679; -- colisão inelástica/quantidade de movimento
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Estequiometria', classificada=true where id = 7680; -- decomposição do carbonato de cálcio/entalpia
update public.questoes_uerj set disciplina='Não Classificada', area='Ciências Humanas', assunto='Não Classificado', classificada=false where id = 7685; -- modelo produtivo fordista/pós-fordista — Humanas, estava Biologia (nº45, fronteira). Subdisciplina ambígua → NC/Humanas
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Físico-Química', classificada=true where id = 7735; -- neutralização ácido-base/concentração
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Probabilidade e Estatística', classificada=true where id = 7739; -- combinatória com baralho (quadra)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7742; -- lançamento oblíquo/alcance
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Termologia', classificada=true where id = 7749; -- calor específico/capacidade térmica/massa
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Geometria', classificada=true where id = 7751; -- área do círculo de contato entre bolhas
update public.questoes_uerj set disciplina='Matemática', area='Matemática', assunto='Probabilidade e Estatística', classificada=true where id = 7807; -- lógica de palpites (contagem)
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Eletricidade', classificada=true where id = 7808; -- lâmpadas em paralelo/potência dissipada
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Orgânica', classificada=true where id = 7811; -- aminofenóis/isomeria
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7814; -- queda de esferas/velocidade
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Ecologia', classificada=true where id = 7818; -- eutrofização de lago
update public.questoes_uerj set disciplina='História', area='Ciências Humanas', assunto='História Geral', classificada=true where id = 7825; -- Tintim no Congo/colonização — rodapé Ciências Humanas
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Orgânica', classificada=true where id = 7881; -- nanotubo de carbono/ligações duplas
update public.questoes_uerj set disciplina='Física', area='Ciências da Natureza', assunto='Mecânica', classificada=true where id = 7894; -- ferramenta/alavanca/menor força (torque)
update public.questoes_uerj set disciplina='Não Classificada', area='Ciências Humanas', assunto='Não Classificado', classificada=false where id = 7895; -- Congresso das Raças/branqueamento — Humanas; área errada (subdisciplina ambígua)
update public.questoes_uerj set disciplina='Espanhol', area='Linguagens', assunto='Leitura e Interpretação', classificada=true, resposta=null where id = 7921; -- texto em espanhol
update public.questoes_uerj set disciplina='Espanhol', area='Linguagens', assunto='Leitura e Interpretação', classificada=true, resposta=null where id = 7923; -- texto em espanhol
update public.questoes_uerj set disciplina='Espanhol', area='Linguagens', assunto='Leitura e Interpretação', classificada=true, resposta=null where id = 7925; -- texto em espanhol
update public.questoes_uerj set disciplina='Geografia', area='Ciências Humanas', assunto='Geografia Humana', classificada=true where id = 7956; -- estratégia locacional/modelo produtivo — rodapé GEOGRAFIA
update public.questoes_uerj set disciplina='Espanhol', area='Linguagens', assunto='Leitura e Interpretação', classificada=true, resposta=null where id = 7983; -- texto em espanhol (García Márquez)
update public.questoes_uerj set disciplina='Espanhol', area='Linguagens', assunto='Leitura e Interpretação', classificada=true, resposta=null where id = 7984; -- texto em espanhol (pronome le)
update public.questoes_uerj set disciplina='Espanhol', area='Linguagens', assunto='Leitura e Interpretação', classificada=true, resposta=null where id = 7985; -- texto em espanhol (expressão verbal)
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Fisiologia', classificada=true where id = 7994; -- mitocôndria/fosforilação oxidativa — biologia, estava Matemática (EU nº26)
update public.questoes_uerj set disciplina='Biologia', area='Ciências da Natureza', assunto='Fisiologia', classificada=true where id = 7998; -- aquecimento global/fisiologia de peixes
update public.questoes_uerj set disciplina='Química', area='Ciências da Natureza', assunto='Química Geral', classificada=true where id = 8008; -- reações de decomposição (CaCO3)
update public.questoes_uerj set disciplina='Geografia', area='Ciências Humanas', assunto='Geopolítica', classificada=true where id = 8018; -- mapa muçulmanos/Império árabe — rodapé geografia
update public.questoes_uerj set disciplina='Geografia', area='Ciências Humanas', assunto='Geopolítica', classificada=true where id = 8021; -- mapa Afeganistão/identidade nacional — rodapé geografia
update public.questoes_uerj set disciplina='História', area='Ciências Humanas', assunto='História Geral', classificada=true where id = 8025; -- plebiscito Chile 2020/heranças autoritárias — rodapé história
update public.questoes_uerj set disciplina='História', area='Ciências Humanas', assunto='História do Brasil', classificada=true where id = 8027; -- JK/Plano de Metas/rodovias — rodapé história

-- ==========================================================================
-- PARTE 13 — Recuperação de gabaritos de objetivas (gerada por gerar_part13.py)
-- --------------------------------------------------------------------------
-- Gabaritos-tabela antigos (nome sem ano/fase, conteúdo sem "Vestibular
-- Estadual") eram descartados pelo pipeline antes do fallback por pasta, e
-- a prova da mesma pasta ficava sem gabarito. Aqui a recuperação é cirúrgica
-- (sem reimport, preserva IDs e a Part 12). Cada letra foi VALIDADA: o mesmo
-- casamento reproduz 100% dos gabaritos que produção já tinha, 0 divergência.
-- Idempotente e aditivo: `and resposta is null` nunca sobrescreve.
-- Nenhuma questão de idioma entra aqui (idioma nunca tem gabarito).
-- Total: 53 questões.
-- ==========================================================================
update public.questoes_uerj set resposta = 'D' where id = 6877 and resposta is null; -- prova 94 nº1 Biologia
update public.questoes_uerj set resposta = 'A' where id = 6878 and resposta is null; -- prova 94 nº2 Português
update public.questoes_uerj set resposta = 'D' where id = 6879 and resposta is null; -- prova 94 nº3 Biologia
update public.questoes_uerj set resposta = 'B' where id = 6880 and resposta is null; -- prova 94 nº4 Português
update public.questoes_uerj set resposta = 'B' where id = 6881 and resposta is null; -- prova 94 nº5 Matemática
update public.questoes_uerj set resposta = 'C' where id = 6882 and resposta is null; -- prova 94 nº6 Física
update public.questoes_uerj set resposta = 'C' where id = 6883 and resposta is null; -- prova 94 nº7 Química
update public.questoes_uerj set resposta = 'D' where id = 6884 and resposta is null; -- prova 94 nº8 Física
update public.questoes_uerj set resposta = 'A' where id = 6885 and resposta is null; -- prova 94 nº9 Matemática
update public.questoes_uerj set resposta = 'A' where id = 6886 and resposta is null; -- prova 94 nº10 Português
update public.questoes_uerj set resposta = 'D' where id = 6887 and resposta is null; -- prova 94 nº11 Português
update public.questoes_uerj set resposta = 'C' where id = 6888 and resposta is null; -- prova 94 nº12 Português
update public.questoes_uerj set resposta = 'A' where id = 6889 and resposta is null; -- prova 94 nº13 Português
update public.questoes_uerj set resposta = 'B' where id = 6890 and resposta is null; -- prova 94 nº14 Português
update public.questoes_uerj set resposta = 'A' where id = 6891 and resposta is null; -- prova 94 nº15 Português
update public.questoes_uerj set resposta = 'B' where id = 6892 and resposta is null; -- prova 94 nº16 Português
update public.questoes_uerj set resposta = 'D' where id = 6893 and resposta is null; -- prova 94 nº17 Português
update public.questoes_uerj set resposta = 'A' where id = 6894 and resposta is null; -- prova 94 nº18 Português
update public.questoes_uerj set resposta = 'D' where id = 6895 and resposta is null; -- prova 94 nº19 Português
update public.questoes_uerj set resposta = 'C' where id = 6896 and resposta is null; -- prova 94 nº20 Português
update public.questoes_uerj set resposta = 'B' where id = 6897 and resposta is null; -- prova 94 nº21 Português
update public.questoes_uerj set resposta = 'C' where id = 6915 and resposta is null; -- prova 94 nº29 Matemática
update public.questoes_uerj set resposta = 'D' where id = 6916 and resposta is null; -- prova 94 nº30 Matemática
update public.questoes_uerj set resposta = 'C' where id = 6917 and resposta is null; -- prova 94 nº31 Matemática
update public.questoes_uerj set resposta = 'D' where id = 6918 and resposta is null; -- prova 94 nº32 Matemática
update public.questoes_uerj set resposta = 'A' where id = 6919 and resposta is null; -- prova 94 nº33 Matemática
update public.questoes_uerj set resposta = 'B' where id = 6920 and resposta is null; -- prova 94 nº34 Matemática
update public.questoes_uerj set resposta = 'B' where id = 6921 and resposta is null; -- prova 94 nº35 Biologia
update public.questoes_uerj set resposta = 'A' where id = 6922 and resposta is null; -- prova 94 nº36 Biologia
update public.questoes_uerj set resposta = 'A' where id = 6923 and resposta is null; -- prova 94 nº37 Biologia
update public.questoes_uerj set resposta = 'A' where id = 6924 and resposta is null; -- prova 94 nº38 Física
update public.questoes_uerj set resposta = 'C' where id = 6925 and resposta is null; -- prova 94 nº39 Química
update public.questoes_uerj set resposta = 'B' where id = 6926 and resposta is null; -- prova 94 nº40 Química
update public.questoes_uerj set resposta = 'D' where id = 6927 and resposta is null; -- prova 94 nº41 Biologia
update public.questoes_uerj set resposta = 'D' where id = 6928 and resposta is null; -- prova 94 nº42 Física
update public.questoes_uerj set resposta = 'D' where id = 6929 and resposta is null; -- prova 94 nº43 Biologia
update public.questoes_uerj set resposta = 'B' where id = 6930 and resposta is null; -- prova 94 nº44 Química
update public.questoes_uerj set resposta = 'C' where id = 6931 and resposta is null; -- prova 94 nº45 Biologia
update public.questoes_uerj set resposta = 'C' where id = 6932 and resposta is null; -- prova 94 nº46 Física
update public.questoes_uerj set resposta = 'A' where id = 6933 and resposta is null; -- prova 94 nº47 Não Classificada
update public.questoes_uerj set resposta = 'C' where id = 6934 and resposta is null; -- prova 94 nº48 Não Classificada
update public.questoes_uerj set resposta = 'B' where id = 6935 and resposta is null; -- prova 94 nº49 Não Classificada
update public.questoes_uerj set resposta = 'B' where id = 6936 and resposta is null; -- prova 94 nº50 Não Classificada
update public.questoes_uerj set resposta = 'B' where id = 6937 and resposta is null; -- prova 94 nº51 Geografia
update public.questoes_uerj set resposta = 'B' where id = 6938 and resposta is null; -- prova 94 nº52 Não Classificada
update public.questoes_uerj set resposta = 'D' where id = 6939 and resposta is null; -- prova 94 nº53 História
update public.questoes_uerj set resposta = 'C' where id = 6940 and resposta is null; -- prova 94 nº54 Filosofia
update public.questoes_uerj set resposta = 'C' where id = 6941 and resposta is null; -- prova 94 nº55 Filosofia
update public.questoes_uerj set resposta = 'A' where id = 6942 and resposta is null; -- prova 94 nº56 Filosofia
update public.questoes_uerj set resposta = 'C' where id = 6943 and resposta is null; -- prova 94 nº57 História
update public.questoes_uerj set resposta = 'A' where id = 6944 and resposta is null; -- prova 94 nº58 Geografia
update public.questoes_uerj set resposta = 'D' where id = 6945 and resposta is null; -- prova 94 nº59 Não Classificada
update public.questoes_uerj set resposta = 'D' where id = 6946 and resposta is null; -- prova 94 nº60 Não Classificada
