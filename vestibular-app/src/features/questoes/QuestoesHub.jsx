import { lazy, Suspense, useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { MATERIAS } from "@/constants/materias";
import { AREAS_CONHECIMENTO } from "@/constants/areasConhecimento";
import { contarQuestoesPorDisciplina } from "@/features/uerj/questoesUerjService";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Botao, CabecalhoPagina, EstadoVazio, SeloMateria } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";

const QuestoesEnem = lazy(() => import("@/features/questoes/QuestoesEnem"));
const UerjHub = lazy(() => import("@/features/uerj/UerjHub"));
const BancoQuestoesUerj = lazy(() => import("@/features/uerj/BancoQuestoesUerj"));

// ------------------------------------------------------------
// Hub da área de Questões: o banco oficial do ENEM em destaque
// e uma pasta por matéria com as questões da UERJ importadas
// pelo pipeline (scripts/importador_uerj). Pastas sem conteúdo
// mostram um estado vazio elegante.
// ------------------------------------------------------------

const CarregandoInterno = ({ texto }) => (
  <div className="mt-16 flex flex-col items-center gap-3 text-ink-400">
    <Loader2 size={22} className="animate-spin text-gold-300" />
    <span className="text-sm">{texto}</span>
  </div>
);

export default function QuestoesHub() {
  const { userId } = useAuth();
  // null = hub · "enem" = banco ENEM · nome de matéria = pasta aberta
  const [pasta, setPasta] = usePersistedState("questoes_pasta", null);
  const [contagens, setContagens] = useState(null); // null = ainda carregando
  const [totalUerj, setTotalUerj] = useState(0);

  useEffect(() => {
    let ativo = true;
    contarQuestoesPorDisciplina().then(({ contagens: c, total: t }) => {
      if (!ativo) return;
      setContagens(c);
      setTotalUerj(t);
    });
    return () => {
      ativo = false;
    };
  }, []);

  /* ---------- BANCO ENEM ---------- */
  if (pasta === "enem") {
    return (
      <div className="max-w-3xl">
        <button
          onClick={() => setPasta(null)}
          className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Todas as pastas
        </button>
        <div className="mb-6 cursor-default">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
            Banco de Questões ENEM
          </h1>
          <p className="text-sm text-ink-400 mt-2">
            Treine com as provas oficiais — correção e estatísticas automáticas.
          </p>
        </div>
        <Suspense fallback={<CarregandoInterno texto="Carregando questões..." />}>
          <QuestoesEnem userId={userId} />
        </Suspense>
      </div>
    );
  }

  /* ---------- CENTRAL UERJ ---------- */
  if (pasta === "uerj") {
    return (
      <Suspense fallback={<CarregandoInterno texto="Abrindo a Central UERJ..." />}>
        <UerjHub userId={userId} onVoltar={() => setPasta(null)} />
      </Suspense>
    );
  }

  /* ---------- PASTA DE MATÉRIA (banco UERJ filtrado) ---------- */
  if (pasta) {
    // Contagens ainda em voo (ex.: recarregou a página com a pasta salva):
    // mostra o loading em vez de um falso "nenhuma questão adicionada".
    if (contagens === null) {
      return <CarregandoInterno texto="Abrindo as questões..." />;
    }
    const qtd = contagens[pasta] ?? 0;
    if (qtd === 0) {
      return (
        <div className="max-w-3xl">
          <button
            onClick={() => setPasta(null)}
            className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Todas as pastas
          </button>
          <EstadoVazio
            icone={FolderOpen}
            titulo={`Ainda não há questões de ${pasta}`}
            descricao="Ainda não há questões dessa matéria no banco. Enquanto isso, treine com as questões do ENEM."
            acao={
              <Botao onClick={() => setPasta("enem")}>
                <GraduationCap size={16} /> Treinar com questões do ENEM
              </Botao>
            }
          />
        </div>
      );
    }
    return (
      <Suspense fallback={<CarregandoInterno texto="Abrindo as questões..." />}>
        <BancoQuestoesUerj
          userId={userId}
          filtrosIniciais={{ disciplina: pasta }}
          onVoltar={() => setPasta(null)}
        />
      </Suspense>
    );
  }

  /* ---------- HUB ---------- */
  const carregandoContagens = contagens === null;
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        titulo="Questões"
        descricao="Escolha a matéria. Cada questão aparece como na prova, com o texto de apoio e o gabarito oficial da UERJ."
      />

      {AREAS_CONHECIMENTO.map((area) => {
        const materias = MATERIAS.filter((m) => area.disciplinas.includes(m.nome));
        if (!materias.length) return null;
        return (
          <section key={area.id} className="mb-8">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-400 mb-2">
              {area.nome}
            </h2>
            <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {materias.map((m) => {
                const qtd = contagens?.[m.nome] ?? 0;
                return (
                  <li key={m.nome}>
                    <button
                      type="button"
                      onClick={() => setPasta(m.nome)}
                      className="group w-full flex items-center gap-4 py-3 text-left"
                    >
                      <SeloMateria sigla={m.sigla} />
                      <span className="flex-1 font-bold text-white group-hover:underline underline-offset-4 decoration-2 decoration-gold-400">
                        {m.nome}
                      </span>
                      <span className="font-mono text-sm text-ink-400 tabular-nums">
                        {carregandoContagens ? "…" : qtd === 0 ? "sem questões" : `${qtd} ${qtd === 1 ? "questão" : "questões"}`}
                      </span>
                      <ArrowRight size={16} className="text-ink-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="mt-12">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-400 mb-2">
          Outros jeitos de treinar
        </h2>
        <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          <li>
            <button type="button" onClick={() => setPasta("uerj")} className="group w-full flex items-center gap-4 py-4 text-left">
              <span className="flex-1">
                <span className="block font-bold text-white group-hover:underline underline-offset-4 decoration-2 decoration-gold-400">
                  Provas completas da UERJ
                </span>
                <span className="block text-sm text-ink-400 mt-0.5">
                  Resolva uma prova inteira, monte simulados e veja seu desempenho
                  {totalUerj > 0 ? ` (${totalUerj} questões de 2013 a 2027)` : ""}.
                </span>
              </span>
              <ArrowRight size={16} className="text-ink-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
            </button>
          </li>
          <li>
            <button type="button" onClick={() => setPasta("enem")} className="group w-full flex items-center gap-4 py-4 text-left">
              <span className="flex-1">
                <span className="block font-bold text-white group-hover:underline underline-offset-4 decoration-2 decoration-gold-400">
                  Questões do ENEM
                </span>
                <span className="block text-sm text-ink-400 mt-0.5">
                  Provas de 2009 a 2023, com filtro por área e dificuldade.
                </span>
              </span>
              <ArrowRight size={16} className="text-ink-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}
