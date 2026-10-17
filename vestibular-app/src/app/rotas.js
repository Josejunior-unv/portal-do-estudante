// Regras de acesso às rotas, como funções puras (testadas em rotas.test.js).
// `sessao` = { user, cargo, temCronograma } vindo do useAuth().

// Para onde mandar o usuário quando ele cai numa rota que não é a dele.
export function rotaInicial({ user, cargo, temCronograma }) {
  if (!user) return "/login";
  if (cargo === "admin") return "/admin";
  if (!temCronograma) return "/onboarding";
  return "/app";
}

// Exigências possíveis de cada rota:
//  - 'visitante'   → só quem NÃO está logado (login)
//  - 'admin'       → painel do professor
//  - 'onboarding'  → aluno que ainda não montou o cronograma
//  - 'aluno'       → aluno com cronograma (painel principal)
// Retorna o caminho de redirecionamento, ou null quando o acesso é permitido.
export function redirecionamento(sessao, exigencia) {
  const { user, cargo, temCronograma } = sessao;
  switch (exigencia) {
    case "visitante":
      return user ? rotaInicial(sessao) : null;
    case "admin":
      if (!user) return "/login";
      return cargo === "admin" ? null : "/app";
    case "onboarding":
      if (!user) return "/login";
      if (cargo === "admin") return "/admin";
      return temCronograma ? "/app" : null;
    case "aluno":
      if (!user) return "/login";
      if (cargo === "admin") return "/admin";
      return temCronograma ? null : "/onboarding";
    default:
      throw new Error(`Exigência de rota desconhecida: ${exigencia}`);
  }
}
