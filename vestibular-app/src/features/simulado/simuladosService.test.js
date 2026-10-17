import { describe, it, expect } from "vitest";
import {
  medalhaDe,
  ranking,
  resumoHistorico,
  conquistas,
  recomendacoes,
  progressoMeta,
} from "@/features/simulado/simuladosService";

const sim = (pct, extra = {}) => ({
  pct,
  tempoSegundos: 600,
  totalQuestoes: 10,
  dataISO: new Date().toISOString(),
  ...extra,
});

describe("medalhaDe", () => {
  it.each([
    [100, "ouro"],
    [80, "prata"],
    [60, "bronze"],
  ])("%i%% → %s", (pct, id) => {
    expect(medalhaDe(pct).id).toBe(id);
  });
  it("abaixo de 60% não tem medalha", () => {
    expect(medalhaDe(59)).toBeNull();
  });
});

describe("ranking", () => {
  it("ordena por % e desempata pelo menor tempo", () => {
    const lista = [sim(70), sim(90, { tempoSegundos: 900 }), sim(90, { tempoSegundos: 300 })];
    expect(ranking(lista).map((s) => [s.pct, s.tempoSegundos])).toEqual([
      [90, 300],
      [90, 900],
      [70, 600],
    ]);
  });
  it("não altera o histórico original", () => {
    const lista = [sim(10), sim(90)];
    ranking(lista);
    expect(lista[0].pct).toBe(10);
  });
});

describe("resumoHistorico", () => {
  it("histórico vazio", () => {
    expect(resumoHistorico([])).toEqual({ total: 0, melhorPct: 0, mediaPct: 0, ultimaPct: null });
  });
  it("calcula melhor, média e o mais recente (primeiro da lista)", () => {
    expect(resumoHistorico([sim(50), sim(100), sim(60)])).toEqual({
      total: 3,
      melhorPct: 100,
      mediaPct: 70,
      ultimaPct: 50,
    });
  });
});

describe("conquistas", () => {
  it("um gabarito libera Primeiro Passo, Ouro e Nota Mil", () => {
    const ok = conquistas([sim(100)])
      .filter((c) => c.ok)
      .map((c) => c.id);
    expect(ok).toEqual(expect.arrayContaining(["primeiro", "ouro", "milagre"]));
    expect(ok).not.toContain("maratona");
  });
});

describe("recomendacoes", () => {
  it("sugere começar quando não há histórico", () => {
    expect(recomendacoes([])[0].materia).toBe("Comece agora");
  });
  it("aponta primeiro a matéria mais fraca", () => {
    const hist = [
      sim(50, { porMateria: { Física: { acertos: 1, total: 5 }, Química: { acertos: 4, total: 5 } } }),
    ];
    const [primeira] = recomendacoes(hist);
    expect(primeira.materia).toBe("Física");
    expect(primeira.texto).toMatch(/reforce/);
  });
});

describe("progressoMeta", () => {
  it("conta só os simulados desta semana", () => {
    const antigo = sim(80, { dataISO: "2020-01-01T00:00:00Z" });
    const r = progressoMeta([sim(80), sim(70), antigo], { simuladosPorSemana: 2 });
    expect(r).toEqual({ feitos: 2, alvo: 2, pct: 100, concluida: true });
  });
});
