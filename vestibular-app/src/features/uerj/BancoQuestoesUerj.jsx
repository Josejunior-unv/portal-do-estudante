import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Search,
  Star,
  Bookmark,
  Flag,
  ExternalLink,
  Download,
  FilterX,
  FileQuestion,
  Timer,
} from "lucide-react";
import QuestaoCard from "@/features/questoes/QuestaoCard";
import AvisoUerj from "@/features/uerj/AvisoUerj";
import { adaptarParaCard } from "@/features/uerj/questoesUerjService";
import { registrarRespostaEnem } from "@/features/estatisticas/estatisticasService";
import {
  FILTROS_STATUS,
  buscarIdsFiltrados,
  buscarQuestoesPorIds,
  opcoesDeFiltro,
  carregarEstudo,
  registrarResposta,
  alternarMarcacao,
  denunciarQuestao,
} from "@/features/uerj/uerjEstudoService";
import { AREAS_CONHECIMENTO, areaPorId } from "@/constants/areasConhecimento";
import {
  Botao,
  Bolha,
  CampoSelect,
  EstadoVazio,
  Esqueleto,
  Alerta,
} from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { lerJSON, gravarJSON } from "@/lib/armazenamento";

const POR_PAGINA = 10;

const CHAVE_FILTROS = "uerj_banco_filtros";
const FILTROS_PADRAO = {
  area: "",
  disciplina: "",
  assunto: "",
  ano: "",
  tipoProva: "",
  dificuldade: "",
  status: "todas",
  comImagem: false,
};

const filtrosGuardados = () => lerJSON(CHAVE_FILTROS, {});


/* ================= PÁGINA DA QUESTÃO ================= */

function PaginaQuestao({ questao, userId, onVoltar, onNavegar, posicao, total }) {
  const [estudo, setEstudo] = useState(() => carregarEstudo(userId));
  const registroExistente = estudo.respostas[questao.id];
  const [resposta, setResposta] = useState(registroExistente?.letra);
  const [tempoGasto, setTempoGasto] = useState(registroExistente?.tempo ?? null);
  const [denuncia, setDenuncia] = useState(false);
  const [motivoDenuncia, setMotivoDenuncia] = useState("");
  const [statusDenuncia, setStatusDenuncia] = useState("");
  const inicioRef = useRef(0);

  useEffect(() => {
    inicioRef.current = Date.now();
  }, []);

  // Anulada pela UERJ: sem resposta oficial (não conta acerto nem erro).
  const temGabarito = !!questao.resposta && !questao.anulada;
  const favorita = estudo.favoritas.includes(questao.id);
  const paraRevisar = estudo.revisar.includes(questao.id);

  const responder = useCallback(
    (letra) => {
      const tempo = (Date.now() - inicioRef.current) / 1000;
      setResposta(letra);
      setTempoGasto(Math.round(tempo));
      setEstudo(registrarResposta(userId, questao, letra, tempo));
      if (temGabarito && userId) {
        registrarRespostaEnem(
          userId,
          letra === questao.resposta,
          questao.disciplina || "UERJ",
        ).catch(() => {});
      }
    },
    [questao, userId, temGabarito],
  );

  async function enviarDenuncia() {
    const { error } = await denunciarQuestao(userId, questao.id, motivoDenuncia);
    setStatusDenuncia(
      error
        ? "Não foi possível enviar agora — tente novamente mais tarde."
        : "Denúncia enviada. A equipe vai revisar esta questão. Obrigado!",
    );
    if (!error) {
      setDenuncia(false);
      setMotivoDenuncia("");
    }
  }

  const prova = questao.prova;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} /> Voltar à lista
        </button>
        <div className="flex items-center gap-2">
          <Botao
            variante="fantasma"
            tamanho="sm"
            onClick={() => onNavegar(-1)}
            disabled={posicao <= 0}
          >
            <ChevronLeft size={14} /> Anterior
          </Botao>
          <span className="text-xs text-ink-500 tabular-nums">
            {posicao + 1} / {total}
          </span>
          <Botao
            variante="fantasma"
            tamanho="sm"
            onClick={() => onNavegar(1)}
            disabled={posicao >= total - 1}
          >
            Próxima <ChevronRight size={14} />
          </Botao>
        </div>
      </div>

      {/* Contexto da questão (o resto está no cabeçalho do cartão) */}
      <p className="mb-3 text-sm text-ink-400">
        {prova?.titulo || (prova?.ano > 0 ? `UERJ ${prova.ano}` : "UERJ")}
        {questao.assunto && questao.assunto !== "Não Classificado" && ` · ${questao.assunto}`}
        {tempoGasto !== null && (
          <span className="inline-flex items-center gap-1 ml-2 align-middle">
            · <Timer size={12} /> {tempoGasto}s
          </span>
        )}
      </p>

      <QuestaoCard
        questao={adaptarParaCard(questao)}
        dificuldade={questao.dificuldade}
        resposta={resposta}
        onResponder={resposta ? undefined : responder}
        revelar={!!resposta && temGabarito}
      />

      {resposta && !temGabarito && !questao.anulada && prova?.tipo !== "discursivo" && (
        <Alerta variante="neutro" className="mt-3">
          Resposta registrada: alternativa {resposta}. Esta prova não tem gabarito
          oficial no banco.
        </Alerta>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2 flex-wrap mt-4">
        <Botao
          variante={favorita ? "primario" : "secundario"}
          tamanho="sm"
          onClick={() =>
            setEstudo(alternarMarcacao(userId, questao.id, "favoritas"))
          }
        >
          <Star size={14} className={favorita ? "fill-current" : ""} />
          {favorita ? "Favoritada" : "Favoritar"}
        </Botao>
        <Botao
          variante={paraRevisar ? "contorno" : "secundario"}
          tamanho="sm"
          onClick={() =>
            setEstudo(alternarMarcacao(userId, questao.id, "revisar"))
          }
        >
          <Bookmark size={14} className={paraRevisar ? "fill-current" : ""} />
          {paraRevisar ? "Na revisão" : "Revisar depois"}
        </Botao>
        {prova?.pdf_url && (
          <>
            <Botao
              as="a"
              href={prova.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              variante="secundario"
              tamanho="sm"
            >
              <ExternalLink size={14} /> Prova original
            </Botao>
            <Botao
              as="a"
              href={prova.pdf_url}
              download
              variante="fantasma"
              tamanho="sm"
            >
              <Download size={14} /> Baixar PDF
            </Botao>
          </>
        )}
        <Botao
          variante="fantasma"
          tamanho="sm"
          onClick={() => setDenuncia((v) => !v)}
          className="ml-auto"
        >
          <Flag size={14} /> Reportar erro
        </Botao>
      </div>

      {/* Denúncia */}
      <AnimatePresence>
        {denuncia && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 rounded-2xl bg-ink-900 border border-white/[0.08] flex gap-2 flex-wrap">
              <input
                value={motivoDenuncia}
                onChange={(e) => setMotivoDenuncia(e.target.value)}
                placeholder="O que está errado? (classificação, gabarito, enunciado...)"
                className="flex-1 min-w-[220px] bg-ink-950/60 border border-ink-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-ink-500 focus:outline-none focus:border-gold-400/70 transition"
              />
              <Botao tamanho="sm" onClick={enviarDenuncia} disabled={!motivoDenuncia.trim()}>
                Enviar
              </Botao>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {statusDenuncia && (
        <Alerta variante="neutro" className="mt-3">
          {statusDenuncia}
        </Alerta>
      )}
    </div>
  );
}

/* ================= LISTA + FILTROS ================= */

export default function BancoQuestoesUerj({
  userId,
  filtrosIniciais = {},
  onVoltar,
}) {
  const [opcoes, setOpcoes] = useState({ disciplinas: [], assuntos: [], anos: [] });
  const [busca, setBusca] = useState(filtrosIniciais.busca || "");
  // Filtros: quando a tela é aberta por uma pasta de matéria ou atalho de
  // revisão (filtrosIniciais), parte do PADRÃO + iniciais — misturar os
  // filtros salvos da sessão anterior (assunto/área/ano de OUTRA matéria)
  // gerava combinações impossíveis que retornavam 0 questões. Sem iniciais,
  // restaura os salvos normalmente.
  const [filtros, setFiltros] = useState(() => {
    const iniciais = { ...filtrosIniciais };
    delete iniciais.busca; // busca tem estado próprio
    return Object.keys(iniciais).length
      ? { ...FILTROS_PADRAO, ...iniciais }
      : { ...FILTROS_PADRAO, ...filtrosGuardados() };
  });
  useEffect(() => {
    gravarJSON(CHAVE_FILTROS, filtros); // cota cheia: valem só na sessão
  }, [filtros]);
  const [ids, setIds] = useState([]);
  const [pagina, setPagina] = useState(0);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState(null); // {questao, posicao}

  useEffect(() => {
    opcoesDeFiltro().then(setOpcoes);
  }, []);

  // Etapa 1: ids filtrados (busca com debounce). O flag `ativo` invalida a
  // resposta de QUALQUER execução superada (filtro OU busca trocados) — um
  // guard só pela busca deixava a resposta antiga, mais lenta, sobrescrever
  // a lista quando o usuário trocava dois filtros em sequência.
  useEffect(() => {
    let ativo = true;
    const t = setTimeout(
      () => {
        buscarIdsFiltrados({ ...filtros, busca, userId }).then(({ ids: novos }) => {
          if (!ativo) return;
          setIds(novos);
          setPagina(0);
        });
      },
      busca ? 350 : 0,
    );
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [filtros, busca, userId]);

  // Etapa 2: detalhes da página visível. A lista anterior permanece na
  // tela até a nova chegar (sem flicker de skeleton a cada filtro).
  useEffect(() => {
    let ativo = true;
    const fatia = ids.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
    buscarQuestoesPorIds(fatia).then(({ data }) => {
      if (!ativo) return;
      setItens(data);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [ids, pagina]);

  const definirFiltro = (campo, valor) =>
    setFiltros((prev) => {
      const novo = { ...prev, [campo]: valor };
      // Filtros dependentes: trocar a disciplina invalida o assunto; trocar
      // a área invalida disciplina/assunto que não pertencem a ela.
      if (campo === "disciplina" && valor !== prev.disciplina) novo.assunto = "";
      if (campo === "area" && valor !== prev.area) {
        const area = areaPorId(valor);
        if (area && novo.disciplina && !area.disciplinas.includes(novo.disciplina)) {
          novo.disciplina = "";
          novo.assunto = "";
        }
      }
      return novo;
    });

  const limpar = () => {
    setFiltros({ ...FILTROS_PADRAO });
    setBusca("");
  };

  const temFiltro =
    Boolean(busca) ||
    Object.keys(FILTROS_PADRAO).some((k) => filtros[k] !== FILTROS_PADRAO[k]);

  // Disciplinas visíveis respeitam a área escolhida; assuntos, a disciplina.
  const areaAtiva = areaPorId(filtros.area);
  const disciplinasVisiveis = areaAtiva
    ? opcoes.disciplinas.filter((d) => areaAtiva.disciplinas.includes(d))
    : opcoes.disciplinas;
  const assuntosVisiveis = filtros.disciplina
    ? [...(opcoes.assuntosPorDisciplina?.[filtros.disciplina] || [])].sort()
    : opcoes.assuntos;

  // Progresso local: recarrega só quando pode ter mudado (voltar de uma
  // questão respondida), não a cada tecla digitada na busca — o JSON.parse
  // do estudo inteiro a cada render ficava caro com muitas respostas salvas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const estudo = useMemo(() => carregarEstudo(userId), [userId, aberta]);

  // Navegação dentro da lista filtrada a partir da página da questão.
  const abrirPosicao = useCallback(
    async (posicao) => {
      const id = ids[posicao];
      if (id == null) return;
      const { data } = await buscarQuestoesPorIds([id]);
      if (data[0]) setAberta({ questao: data[0], posicao });
    },
    [ids],
  );

  if (aberta) {
    return (
      <PaginaQuestao
        // A key força o remount ao trocar de questão: sem ela, os estados
        // internos (resposta, tempo, denúncia) da questão anterior vazavam
        // para a seguinte, que aparecia "já respondida" com a letra errada.
        key={aberta.questao.id}
        questao={aberta.questao}
        userId={userId}
        posicao={aberta.posicao}
        total={ids.length}
        onVoltar={() => setAberta(null)}
        onNavegar={(delta) => abrirPosicao(aberta.posicao + delta)}
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(ids.length / POR_PAGINA));

  return (
    <div className="max-w-4xl">
      {onVoltar && (
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-5 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      )}

      <AvisoUerj />

      {/* FILTROS */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no enunciado das questões..."
            className="w-full bg-ink-950/60 border border-ink-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-ink-500 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40 transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <CampoSelect
            value={filtros.area}
            onChange={(e) => definirFiltro("area", e.target.value)}
            className="!w-auto py-2 text-xs"
            aria-label="Filtrar por área do conhecimento"
          >
            <option value="">Área do conhecimento</option>
            {AREAS_CONHECIMENTO.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </CampoSelect>
          <CampoSelect
            value={filtros.disciplina}
            onChange={(e) => definirFiltro("disciplina", e.target.value)}
            className="!w-auto py-2 text-xs"
            aria-label="Filtrar por disciplina"
          >
            <option value="">Disciplina</option>
            {disciplinasVisiveis.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </CampoSelect>
          <CampoSelect
            value={filtros.assunto}
            onChange={(e) => definirFiltro("assunto", e.target.value)}
            className="!w-auto py-2 text-xs"
            aria-label="Filtrar por assunto"
          >
            <option value="">Assunto</option>
            {assuntosVisiveis.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </CampoSelect>
          <CampoSelect
            value={filtros.ano}
            onChange={(e) => definirFiltro("ano", e.target.value)}
            className="!w-auto py-2 text-xs"
          >
            <option value="">Ano</option>
            {opcoes.anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </CampoSelect>
          <CampoSelect
            value={filtros.tipoProva}
            onChange={(e) => definirFiltro("tipoProva", e.target.value)}
            className="!w-auto py-2 text-xs"
          >
            <option value="">Tipo de prova</option>
            <option value="qualificacao">Qualificação (objetiva)</option>
            <option value="discursivo">Discursiva</option>
          </CampoSelect>
          <CampoSelect
            value={filtros.dificuldade}
            onChange={(e) => definirFiltro("dificuldade", e.target.value)}
            className="!w-auto py-2 text-xs"
          >
            <option value="">Dificuldade</option>
            <option value="facil">Fácil</option>
            <option value="media">Média</option>
            <option value="dificil">Difícil</option>
          </CampoSelect>
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex p-1 gap-0.5 bg-ink-950/60 border border-ink-700 rounded-xl flex-wrap">
            {FILTROS_STATUS.map((s) => (
              <button
                key={s.id}
                onClick={() => definirFiltro("status", s.id)}
                className={cx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200",
                  filtros.status === s.id
                    ? "bg-gold-400 text-sobre-destaque"
                    : "text-ink-400 hover:text-ink-100",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {temFiltro && (
            <Botao variante="fantasma" tamanho="sm" onClick={limpar}>
              <FilterX size={14} /> Limpar
            </Botao>
          )}
          <span className="ml-auto text-xs text-ink-500 tabular-nums">
            {ids.length} {ids.length === 1 ? "questão" : "questões"}
          </span>
        </div>
      </div>

      {/* LISTA */}
      {carregando ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-28" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <EstadoVazio
          icone={FileQuestion}
          titulo="Nenhuma questão com esses filtros"
          descricao="Ajuste a busca ou limpe os filtros para ver o banco completo."
          acao={
            <Botao variante="secundario" tamanho="sm" onClick={limpar}>
              <FilterX size={14} /> Limpar filtros
            </Botao>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {itens.map((q, i) => {
              const registro = estudo.respostas[q.id];
              const favorita = estudo.favoritas.includes(q.id);
              const estado = !registro
                ? "vazia"
                : registro.acertou === true
                  ? "certa"
                  : registro.acertou === false
                    ? "errada"
                    : "marcada";
              const situacao = !registro
                ? "não respondida"
                : registro.acertou === true
                  ? "você acertou"
                  : registro.acertou === false
                    ? "você errou"
                    : `você marcou ${registro.letra}`;
              return (
                <li key={q.id}>
                  <button
                    onClick={() => abrirPosicao(pagina * POR_PAGINA + i)}
                    className="group w-full flex items-start gap-4 py-4 text-left"
                  >
                    <Bolha
                      estado={estado}
                      letra={estado === "certa" ? "✓" : estado === "errada" ? "✕" : String(q.numero).padStart(2, "0")}
                      tamanho="md"
                      className="mt-0.5 text-xs"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs text-ink-400 mb-1">
                        Questão {q.numero} · {q.prova?.titulo || (q.prova?.ano > 0 ? `UERJ ${q.prova.ano}` : "UERJ")}
                        {q.disciplina && ` · ${q.disciplina}`} · {situacao}
                        {q.anulada && " · anulada"}
                      </span>
                      <span className="block text-[15px] text-ink-100 line-clamp-2 leading-6 group-hover:text-white">
                        {q.enunciado}
                      </span>
                    </span>
                    {favorita && (
                      <Star size={15} className="mt-1 text-gold-300 fill-current shrink-0" aria-label="favorita" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* PAGINAÇÃO */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <Botao
                variante="secundario"
                tamanho="sm"
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={pagina === 0}
              >
                <ChevronLeft size={14} /> Anterior
              </Botao>
              <span className="text-xs text-ink-500 tabular-nums">
                Página {pagina + 1} de {totalPaginas}
              </span>
              <Botao
                variante="secundario"
                tamanho="sm"
                onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={pagina >= totalPaginas - 1}
              >
                Próxima <ChevronRight size={14} />
              </Botao>
            </div>
          )}
        </>
      )}
    </div>
  );
}
