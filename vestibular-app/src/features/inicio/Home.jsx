import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { processarEstatisticas } from "@/features/estatisticas/estatisticasService";
import NoticiasDestaque from "@/features/noticias/NoticiasDestaque";
import { Botao, Esqueleto, Grifo, CartaoResposta, SeloMateria } from "@/components/ui";
import { siglaDaMateria } from "@/constants/materias";
import { useAuth } from "@/features/auth/useAuth";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const dataLonga = () =>
  new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

// Próximos passos, do mais usado ao menos usado.
const CAMINHOS = [
  { aba: "enem", titulo: "Questões da UERJ e do ENEM", texto: "Por matéria, com o gabarito oficial e o texto de apoio." },
  { aba: "simulados", titulo: "Simulado com tempo", texto: "Escolha a área e quantas questões quer fazer." },
  { aba: "materiais", titulo: "Provas antigas em PDF", texto: "Todas as provas e gabaritos da UERJ desde 2012." },
];

function Secao({ titulo, children, className = "" }) {
  return (
    <section className={className}>
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-400 mb-3">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function Home({ aoNavegar }) {
  const { userId, nome: nomeCompleto, cronograma: salvo } = useAuth();
  const nome = nomeCompleto.split(" ")[0];
  const cronograma = Array.isArray(salvo) ? salvo : [];
  const [stats, setStats] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    processarEstatisticas(userId).then((s) => {
      if (!ativo) return;
      setStats(s);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [userId]);

  const geral = stats?.geral;
  const ultimas = (stats?.ultimas || []).slice().reverse(); // mais antiga → mais recente
  const total = geral?.totalQuestoes ?? 0;
  const maxHoras = Math.max(1, ...cronograma.map((m) => Number.parseFloat(m.horas) || 0));

  return (
    <div className="max-w-3xl">
      {/* Saudação */}
      <header className="mb-10">
        <p className="text-sm text-ink-400 first-letter:uppercase">{dataLonga()}</p>
        <h1 className="text-4xl sm:text-5xl font-black text-white mt-1 leading-[1.05]">
          {saudacao()}
          {nome && (
            <>
              , <Grifo>{nome}</Grifo>
            </>
          )}
          .
        </h1>
      </header>

      {/* Cartão-resposta: as últimas questões respondidas */}
      <Secao titulo="Suas últimas respostas" className="mb-10">
        {carregando ? (
          <Esqueleto className="h-24" />
        ) : total === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-600 p-6">
            <p className="text-ink-200">
              Você ainda não respondeu nenhuma questão. Cada resposta aparece aqui como no
              cartão-resposta da prova: verde para acerto, vermelho para erro.
            </p>
            <Botao className="mt-4" onClick={() => aoNavegar?.("enem")}>
              Responder a primeira questão
            </Botao>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5 sm:p-6">
            <CartaoResposta
              itens={ultimas.map((u) => ({ acertou: u.acertou, rotulo: u.materia }))}
            />
            <p className="mt-4 text-ink-200 leading-7">
              <strong className="text-white">{geral.acertos}</strong> de{" "}
              <strong className="text-white">{total}</strong> certas no total (
              {geral.taxaAcerto}%), em {geral.diasAtivos}{" "}
              {geral.diasAtivos === 1 ? "dia" : "dias"} de estudo.
              {geral.melhorMateria && (
                <>
                  {" "}
                  Seu melhor desempenho é em{" "}
                  <strong className="text-white">{geral.melhorMateria.name}</strong> (
                  {geral.melhorMateria.pct}%).
                </>
              )}
            </p>
          </div>
        )}
      </Secao>

      {/* Por onde continuar */}
      <Secao titulo="Por onde continuar" className="mb-10">
        <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {CAMINHOS.map((c) => (
            <li key={c.aba}>
              <button
                type="button"
                onClick={() => aoNavegar?.(c.aba)}
                className="group w-full flex items-center gap-4 py-4 text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-white group-hover:underline underline-offset-4 decoration-2 decoration-gold-400">
                    {c.titulo}
                  </span>
                  <span className="block text-sm text-ink-400 mt-0.5">{c.texto}</span>
                </span>
                <ArrowRight
                  size={18}
                  className="text-ink-500 transition-transform group-hover:translate-x-1 group-hover:text-white"
                />
              </button>
            </li>
          ))}
        </ul>
      </Secao>

      <NoticiasDestaque />

      {/* Plano da semana: é uma tabela de verdade (matéria × horas) */}
      {cronograma.length > 0 && (
        <Secao titulo="Seu plano da semana" className="mt-10">
          <table className="w-full text-left">
            <caption className="sr-only">Horas de estudo por matéria na semana</caption>
            <tbody className="divide-y divide-white/[0.08]">
              {cronograma.map((m) => {
                const horas = Number.parseFloat(m.horas) || 0;
                return (
                  <tr key={m.id ?? m.nome}>
                    <td className="py-3 pr-3 w-14">
                      <SeloMateria sigla={siglaDaMateria(m.nome)} />
                    </td>
                    <th scope="row" className="py-3 pr-4 font-semibold text-ink-100">
                      {m.nome}
                    </th>
                    <td className="py-3 w-2/5 hidden sm:table-cell">
                      <span className="block h-2 rounded-full bg-ink-800 overflow-hidden">
                        <span
                          className="block h-full bg-gold-400"
                          style={{ width: `${(horas / maxHoras) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right font-mono text-sm text-ink-200 whitespace-nowrap">
                      {horas.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Secao>
      )}
    </div>
  );
}
