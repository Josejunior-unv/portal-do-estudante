import { describe, it, expect } from "vitest";
import { calcularCronograma } from "@/features/onboarding/cronograma";

const MATERIAS = [
  { nome: "Matemática", peso: 3 },
  { nome: "Português", peso: 1 },
];

describe("calcularCronograma", () => {
  it("com 4+ dias divide as horas proporcionalmente ao peso", () => {
    // 5 dias × 4 h = 20 h; pesos 3:1 → 15 h e 5 h
    expect(calcularCronograma(5, 4, MATERIAS)).toEqual([
      { nome: "Matemática", horas: "15.0" },
      { nome: "Português", horas: "5.0" },
    ]);
  });

  it("com 3 dias garante pelo menos 1 h por matéria", () => {
    const muitas = [...MATERIAS, { nome: "Física", peso: 1 }, { nome: "Química", peso: 1 }];
    const lista = calcularCronograma(3, 1, muitas);
    expect(lista.every((m) => Number(m.horas) >= 1)).toBe(true);
  });

  it("com menos de 3 dias usa 1,5 h fixas", () => {
    expect(calcularCronograma(2, 6, MATERIAS).map((m) => m.horas)).toEqual(["1.5", "1.5"]);
  });

  it("matéria sem peso conta como peso 1", () => {
    const [a, b] = calcularCronograma(4, 2, [{ nome: "A" }, { nome: "B", peso: 1 }]);
    expect(a.horas).toBe(b.horas);
  });
});
