import { supabase, HASH_INICIAL } from "../SUPABASE";

// Regras e chamadas de autenticação por e-mail (login, cadastro, recuperação e
// troca de senha). As telas só lidam com estado/UI; tudo que fala com o
// Supabase Auth passa por aqui.

export const SENHA_MINIMA = 6;
export const ROTA_REDEFINIR_SENHA = "/redefinir-senha";

// Traduz as mensagens de erro mais comuns do Supabase para o usuário final.
export function traduzErroAuth(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este e-mail já está cadastrado. Faça login.";
  if (m.includes("password should be at least"))
    return `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (m.includes("should be different from the old password"))
    return "A nova senha precisa ser diferente da atual.";
  if (m.includes("unable to validate email") || m.includes("invalid format")) return "E-mail inválido.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("signups not allowed")) return "Cadastro desativado no momento. Fale com o administrador.";
  if (m.includes("rate limit") || m.includes("security purposes") || m.includes("too many"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (m.includes("auth session missing") || m.includes("session_not_found"))
    return "Sua sessão expirou. Peça um novo link de recuperação.";
  return msg || "Ocorreu um erro. Tente novamente.";
}

// Valida a nova senha antes de mandar ao servidor. Retorna a mensagem de erro
// ou null quando está tudo certo.
export function validarNovaSenha(senha, confirmacao) {
  if (senha.length < SENHA_MINIMA) return `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (senha !== confirmacao) return "As senhas não coincidem.";
  return null;
}

// Envia o e-mail com o link de redefinição. O link volta para
// /redefinir-senha, onde o Supabase abre uma sessão de recuperação.
export async function solicitarRecuperacaoSenha(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}${ROTA_REDEFINIR_SENHA}`,
  });
  if (error) throw new Error(traduzErroAuth(error.message));
}

// Grava a nova senha do usuário da sessão atual (sessão de recuperação ou
// sessão normal já autenticada).
export async function definirNovaSenha(novaSenha) {
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw new Error(traduzErroAuth(error.message));
}

// Troca de senha de dentro do app: confirma a senha atual antes (evita que
// alguém num computador desbloqueado troque a senha do aluno).
export async function alterarSenha(senhaAtual, novaSenha) {
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) throw new Error("Sua sessão expirou. Entre novamente.");

  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email,
    password: senhaAtual,
  });
  if (erroLogin) {
    const msg = erroLogin.message.toLowerCase();
    throw new Error(
      msg.includes("invalid login credentials")
        ? "A senha atual está incorreta."
        : traduzErroAuth(erroLogin.message),
    );
  }

  await definirNovaSenha(novaSenha);
}

// Quando o link de recuperação está expirado/usado, o Supabase volta com o
// erro no hash da URL (#error=...&error_description=...). O hash é capturado
// antes de o cliente limpá-lo (ver SUPABASE.js).
export function erroDoLinkDeRecuperacao() {
  const params = new URLSearchParams(HASH_INICIAL.replace(/^#/, ""));
  const codigo = params.get("error_code") || params.get("error");
  if (!codigo) return null;
  if (codigo === "otp_expired")
    return "Este link expirou ou já foi usado. Peça um novo abaixo.";
  return "Não foi possível validar o link de recuperação. Peça um novo abaixo.";
}
