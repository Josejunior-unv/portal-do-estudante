import { describe, it, expect, vi, beforeEach } from "vitest";
import { lerJSON, gravarJSON } from "@/lib/armazenamento";

function storageEmMemoria() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
  };
}

describe("armazenamento", () => {
  beforeEach(() => vi.stubGlobal("localStorage", storageEmMemoria()));

  it("grava e lê de volta", () => {
    expect(gravarJSON("x", { a: [1, 2] })).toBe(true);
    expect(lerJSON("x", null)).toEqual({ a: [1, 2] });
  });

  it("preserva valores falsy salvos (ex.: menu recolhido = false)", () => {
    gravarJSON("menu", false);
    expect(lerJSON("menu", true)).toBe(false);
  });

  it("usa o padrão quando a chave não existe ou o JSON está corrompido", () => {
    expect(lerJSON("nada", [])).toEqual([]);
    localStorage.setItem("ruim", "{nao e json");
    expect(lerJSON("ruim", {})).toEqual({});
  });

  it("não quebra quando o navegador bloqueia o armazenamento", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(lerJSON("x", "padrão")).toBe("padrão");
    expect(gravarJSON("x", 1)).toBe(false);
  });
});
