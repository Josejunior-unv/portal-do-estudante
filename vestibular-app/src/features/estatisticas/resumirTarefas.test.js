import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const { resumirTarefas } = await import("@/features/estatisticas/estatisticasService");

describe("resumirTarefas", () => {
  it("sem materiais", () => {
    expect(resumirTarefas([], {})).toEqual({ total: 0, feitas: 0, pendentes: 0, pct: 0, porMateria: [] });
  });

  it("agrega por matéria e ordena pela que tem mais materiais", () => {
    const materiais = [
      { id: 1, materia: "Física" },
      { id: 2, materia: "Química" },
      { id: 3, materia: "Química" },
      { id: 4, materia: "Química" },
    ];
    const r = resumirTarefas(materiais, { 1: true, 2: true });
    expect(r).toMatchObject({ total: 4, feitas: 2, pendentes: 2, pct: 50 });
    expect(r.porMateria).toEqual([
      { name: "Química", total: 3, feitas: 1, pct: 33 },
      { name: "Física", total: 1, feitas: 1, pct: 100 },
    ]);
  });
});
