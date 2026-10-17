import { describe, it, expect } from "vitest";
import { rotaInicial, redirecionamento } from "@/app/rotas";

const visitante = { user: null, cargo: "aluno", temCronograma: false };
const novoAluno = { user: { id: "a" }, cargo: "aluno", temCronograma: false };
const aluno = { user: { id: "a" }, cargo: "aluno", temCronograma: true };
const admin = { user: { id: "b" }, cargo: "admin", temCronograma: false };

describe("rotaInicial", () => {
  it.each([
    ["visitante", visitante, "/login"],
    ["aluno novo", novoAluno, "/onboarding"],
    ["aluno", aluno, "/app"],
    ["admin", admin, "/admin"],
  ])("%s → %s", (_nome, sessao, esperado) => {
    expect(rotaInicial(sessao)).toBe(esperado);
  });
});

describe("redirecionamento", () => {
  // [quem, sessão, exigência, destino esperado (null = acesso liberado)]
  it.each([
    ["visitante", visitante, "visitante", null],
    ["aluno", aluno, "visitante", "/app"],
    ["admin", admin, "visitante", "/admin"],

    ["visitante", visitante, "admin", "/login"],
    ["aluno", aluno, "admin", "/app"],
    ["admin", admin, "admin", null],

    ["visitante", visitante, "onboarding", "/login"],
    ["admin", admin, "onboarding", "/admin"],
    ["aluno", aluno, "onboarding", "/app"],
    ["aluno novo", novoAluno, "onboarding", null],

    ["visitante", visitante, "aluno", "/login"],
    ["admin", admin, "aluno", "/admin"],
    ["aluno novo", novoAluno, "aluno", "/onboarding"],
    ["aluno", aluno, "aluno", null],
  ])("%s exigindo '%s'", (_nome, sessao, exigencia, esperado) => {
    expect(redirecionamento(sessao, exigencia)).toBe(esperado);
  });

  it("recusa exigência desconhecida", () => {
    expect(() => redirecionamento(aluno, "professor")).toThrow(/desconhecida/);
  });
});
