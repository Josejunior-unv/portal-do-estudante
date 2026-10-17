import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {},
  HASH_INICIAL: "#error=access_denied&error_code=otp_expired&error_description=expirou",
}));

const { traduzErroAuth, validarNovaSenha, erroDoLinkDeRecuperacao, SENHA_MINIMA } = await import(
  "@/features/auth/authService"
);

const MUITAS_TENTATIVAS = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";

describe("traduzErroAuth", () => {
  it.each([
    ["Invalid login credentials", "E-mail ou senha incorretos."],
    ["User already registered", "Este e-mail já está cadastrado. Faça login."],
    ["New password should be different from the old password.", "A nova senha precisa ser diferente da atual."],
    ["Email rate limit exceeded", MUITAS_TENTATIVAS],
    ["For security purposes, you can only request this after 52 seconds.", MUITAS_TENTATIVAS],
    ["Auth session missing!", "Sua sessão expirou. Peça um novo link de recuperação."],
  ])("%s", (original, traduzida) => {
    expect(traduzErroAuth(original)).toBe(traduzida);
  });

  it("mantém mensagens desconhecidas e tem um padrão para vazio", () => {
    expect(traduzErroAuth("algo novo")).toBe("algo novo");
    expect(traduzErroAuth("")).toMatch(/Tente novamente/);
  });
});

describe("validarNovaSenha", () => {
  it("exige o tamanho mínimo", () => {
    const curta = "a".repeat(SENHA_MINIMA - 1);
    expect(validarNovaSenha(curta, curta)).toMatch(/pelo menos/);
  });
  it("exige confirmação igual", () => {
    expect(validarNovaSenha("segredo1", "segredo2")).toBe("As senhas não coincidem.");
  });
  it("aceita senha válida", () => {
    expect(validarNovaSenha("segredo1", "segredo1")).toBeNull();
  });
});

describe("erroDoLinkDeRecuperacao", () => {
  it("reconhece link expirado pelo hash da URL", () => {
    expect(erroDoLinkDeRecuperacao()).toMatch(/expirou/);
  });
});
