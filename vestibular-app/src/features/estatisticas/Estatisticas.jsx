import { useState, useEffect, useCallback } from "react";
import { resumirTarefas, processarEstatisticas, salvarSessaoEstudos } from "@/features/estatisticas/estatisticasService";
import { listarMateriais } from "@/features/materiais/materiaisService";
import { carregarConcluidas } from "@/features/tarefas/tarefasStatusService";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/features/auth/useAuth";
import { useInsercoesRealtime } from "@/hooks/useInsercoesRealtime";
import { CabecalhoPagina, CartaoResposta, SeloMateria } from "@/components/ui";
import { siglaDaMateria } from "@/constants/materias";

// Tooltip visual único, reaproveitado por todos os gráficos.
function DicaGrafico({ active, payload, label, sufixo = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-ink-950/95 border border-white/10 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-ink-300 text-xs font-bold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="font-bold">
            {p.value}
            {sufixo}
          </span>
        </p>
      ))}
    </div>
  );
}

const EIXO = { fill: "var(--color-ink-400)", fontSize: 11, fontWeight: 600 };

export default function Estatisticas() {
  const { userId } = useAuth();
  const [dados, setDados] = useState(null);
  const [tarefas, setTarefas] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ tipo: "", texto: "" });

  const dataHoje = new Date().toISOString().split("T")[0];

  const [materia, setMateria] = useState("");
  const [acertos, setAcertos] = useState("");
  const [erros, setErros] = useState("");
  const [dataEstudo, setDataEstudo] = useState(dataHoje);

  const carregarDados = useCallback(() => {
    processarEstatisticas(userId).then(setDados);
  }, [userId]);

  // Resumo das tarefas (materiais publicados × concluídos pelo aluno).
  useEffect(() => {
    let ativo = true;
    async function carregarTarefas() {
      const [{ data }, mapa] = await Promise.all([
        listarMateriais(),
        carregarConcluidas(userId),
      ]);
      if (ativo) setTarefas(resumirTarefas(data, mapa));
    }
    if (userId) carregarTarefas();
    return () => {
      ativo = false;
    };
  }, [userId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Tempo real: recarrega as métricas a cada questão respondida pelo aluno.
  useInsercoesRealtime({
    canal: `estatisticas_${userId}`,
    tabela: "questoes_respondidas",
    filtro: `usuario_id=eq.${userId}`,
    aoInserir: carregarDados,
    ativo: Boolean(userId),
  });

  const handleSalvarRegistro = async (e) => {
    e.preventDefault();
    const numAcertos = parseInt(acertos) || 0;
    const numErros = parseInt(erros) || 0;

    if (numAcertos === 0 && numErros === 0) {
      setStatusMsg({ tipo: "erro", texto: "Informe pelo menos um acerto ou erro." });
      setTimeout(() => setStatusMsg({ tipo: "", texto: "" }), 3000);
      return;
    }

    setIsSaving(true);
    setStatusMsg({ tipo: "", texto: "" });

    const { error } = await salvarSessaoEstudos(
      userId,
      numAcertos,
      numErros,
      materia,
      dataEstudo,
    );

    if (!error) {
      setMateria("");
      setAcertos("");
      setErros("");
      setDataEstudo(dataHoje);
      setStatusMsg({ tipo: "sucesso", texto: "Sessão registrada com sucesso!" });
      carregarDados();
    } else {
      setStatusMsg({ tipo: "erro", texto: "Falha ao salvar no banco." });
    }

    setIsSaving(false);
    setTimeout(() => setStatusMsg({ tipo: "", texto: "" }), 4000);
  };

  if (!dados)
    return (
      <div className="text-ink-500 text-center animate-pulse mt-10">
        Processando métricas...
      </div>
    );

  const totalCalculado = (parseInt(acertos) || 0) + (parseInt(erros) || 0);
  const g = dados.geral;

  return (
    <div className="w-full max-w-4xl">
      <CabecalhoPagina
        titulo="Estatísticas"
        descricao="Tudo o que você responde em Questões e Simulados entra aqui automaticamente."
      />

      {/* Resumo em frase + cartão-resposta (no lugar dos cartões de número) */}
      <section className="mb-10">
        {g.totalQuestoes > 0 ? (
          <>
            <CartaoResposta itens={(dados.ultimas || []).slice().reverse().map((u) => ({ acertou: u.acertou, rotulo: u.materia }))} />
            <p className="mt-4 text-lg text-ink-200 leading-8 max-w-2xl">
              Você acertou <strong className="text-white">{g.acertos}</strong> de{" "}
              <strong className="text-white">{g.totalQuestoes}</strong> questões (
              <strong className="text-white">{g.taxaAcerto}%</strong>) em {g.diasAtivos}{" "}
              {g.diasAtivos === 1 ? "dia" : "dias"} de estudo, uma média de {g.mediaDia}{" "}
              {g.mediaDia === 1 ? "questão" : "questões"} por dia.
              {g.melhorMateria && (
                <> Seu melhor resultado é em <strong className="text-white">{g.melhorMateria.name}</strong> ({g.melhorMateria.pct}%).</>
              )}
              {tarefas && tarefas.total > 0 && (
                <> Das tarefas publicadas, você concluiu {tarefas.feitas} de {tarefas.total}.</>
              )}
            </p>
          </>
        ) : (
          <p className="text-ink-300 max-w-xl leading-7">
            Responda questões ou faça um simulado: seus acertos e erros aparecem aqui, por
            matéria e por semana.
          </p>
        )}
      </section>

      {/* Evolução semanal + mensal (colunas limpas, série única) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-ink-900">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-400 mb-1">Evolução semanal</h3>
          <p className="text-xs text-ink-500 mb-4">Aproveitamento (%) por semana</p>
          <div className="h-52">
            {dados.semanal.length === 0 ? (
              <div className="h-full flex items-center justify-center text-ink-600 text-sm">
                Sem dados suficientes ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.semanal} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ink-700)" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="label" tick={EIXO} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={EIXO} tickLine={false} axisLine={false} width={36} />
                  <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<DicaGrafico sufixo="%" />} />
                  <Bar dataKey="pct" name="Aproveitamento" fill="var(--color-gold-400)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-ink-900">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-400 mb-1">Evolução mensal</h3>
          <p className="text-xs text-ink-500 mb-4">Questões respondidas por mês</p>
          <div className="h-52">
            {dados.mensal.length === 0 ? (
              <div className="h-full flex items-center justify-center text-ink-600 text-sm">
                Sem dados suficientes ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.mensal} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ink-700)" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="label" tick={EIXO} tickLine={false} axisLine={false} />
                  <YAxis tick={EIXO} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<DicaGrafico />} />
                  <Bar dataKey="total" name="Questões" fill="var(--color-gold-500)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Desempenho por matéria (barras horizontais) + Últimas atividades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-ink-900">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-400 mb-4">Desempenho por matéria</h3>
          {(dados.porMateria || []).length === 0 ? (
            <p className="text-ink-600 text-sm">Sem dados ainda.</p>
          ) : (
            <div className="space-y-4">
              {dados.porMateria.map((m) => (
                <div key={m.name}>
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <SeloMateria sigla={siglaDaMateria(m.name)} />
                      <span className="text-ink-100 font-semibold truncate">{m.name}</span>
                    </span>
                    <span className="text-ink-500 text-xs">
                      {m.acertos}/{m.total} · {m.pct}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-ink-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        m.pct >= 70
                          ? "bg-emerald-400"
                          : m.pct >= 40
                            ? "bg-gold-400"
                            : "bg-rose-400"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${m.pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-ink-900">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-400 mb-4">Últimas atividades</h3>
          {(dados.ultimas || []).length === 0 ? (
            <p className="text-ink-600 text-sm">Nenhuma atividade registrada.</p>
          ) : (
            <ul className="space-y-2">
              {dados.ultimas.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-ink-900/40 border border-white/5"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={a.acertou ? "text-emerald-400" : "text-rose-400"}>
                      {a.acertou ? "✓" : "✕"}
                    </span>
                    <span className="text-ink-300 text-sm truncate">{a.materia}</span>
                  </span>
                  <span className="text-ink-600 text-xs whitespace-nowrap">{a.data}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Progresso das Tarefas */}
      {tarefas && tarefas.total > 0 && (
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-ink-900 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-400">Progresso das tarefas</h3>
            <span className="text-gold-300 font-black text-lg">{tarefas.pct}%</span>
          </div>
          <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden mb-5">
            <motion.div
              className="h-full bg-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${tarefas.pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {tarefas.porMateria.map((m) => (
              <div key={m.name}>
                <div className="flex justify-between items-center mb-1 text-sm">
                  <span className="text-ink-300 font-medium truncate">{m.name}</span>
                  <span className="text-ink-500 text-xs">
                    {m.feitas}/{m.total}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-ink-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${m.pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulário de Registro */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-ink-900 relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-400">Registrar sessão de estudos</h3>
          {totalCalculado > 0 && (
            <span className="text-xs font-bold bg-ink-800 text-ink-300 px-3 py-1 rounded-full">
              Total: {totalCalculado} questões
            </span>
          )}
        </div>

        <form onSubmit={handleSalvarRegistro} className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="date"
              value={dataEstudo}
              onChange={(e) => setDataEstudo(e.target.value)}
              required
              className="bg-ink-900 border border-ink-700 rounded-xl px-4 py-3 text-ink-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            />
            <input
              type="text"
              placeholder="Matéria (ex: Cálculo, Programação)"
              value={materia}
              onChange={(e) => setMateria(e.target.value)}
              required
              list="materias-sugestoes"
              className="flex-1 bg-ink-900 border border-ink-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-ink-600"
            />
            <datalist id="materias-sugestoes">
              <option value="Cálculo" />
              <option value="Programação" />
              <option value="Física" />
              <option value="Matemática" />
            </datalist>
            <input
              type="number"
              placeholder="Acertos"
              value={acertos}
              onChange={(e) => setAcertos(e.target.value)}
              min="0"
              className="w-full md:w-28 bg-ink-900 border border-ink-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-ink-600"
            />
            <input
              type="number"
              placeholder="Erros"
              value={erros}
              onChange={(e) => setErros(e.target.value)}
              min="0"
              className="w-full md:w-28 bg-ink-900 border border-ink-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-ink-600"
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex-1">
              <AnimatePresence>
                {statusMsg.texto && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`text-sm font-medium ${statusMsg.tipo === "sucesso" ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {statusMsg.texto}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className={`bg-gold-400 hover:bg-gold-500 text-sobre-destaque font-bold py-3 px-8 rounded-xl transition-all shadow-[var(--shadow-gold)] ${isSaving ? "opacity-50 cursor-wait" : ""}`}
            >
              {isSaving ? "Registrando..." : "Salvar Sessão"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
