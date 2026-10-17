import { describe, it, expect } from "vitest";
import { coletarTudo } from "@/lib/consultas";

// Imita o builder do PostgREST: .range(ini, fim) devolve a fatia da tabela.
const tabela = (n, { erroNoInicio } = {}) => () => ({
  range: async (ini, fim) => {
    if (ini === erroNoInicio) return { data: null, error: new Error("falhou") };
    return { data: Array.from({ length: n }, (_, i) => i).slice(ini, fim + 1), error: null };
  },
});

describe("coletarTudo", () => {
  it("junta todas as páginas", async () => {
    const { data, error } = await coletarTudo(tabela(5), 2);
    expect(error).toBeNull();
    expect(data).toEqual([0, 1, 2, 3, 4]);
  });

  it("para quando a última página vem cheia e a seguinte vazia", async () => {
    const { data } = await coletarTudo(tabela(4), 2);
    expect(data).toEqual([0, 1, 2, 3]);
  });

  it("devolve o que já coletou junto com o erro", async () => {
    const { data, error } = await coletarTudo(tabela(10, { erroNoInicio: 2 }), 2);
    expect(data).toEqual([0, 1]);
    expect(error.message).toBe("falhou");
  });
});
