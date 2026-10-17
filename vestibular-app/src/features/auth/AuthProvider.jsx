import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AuthContext } from "@/features/auth/useAuth";
import { ROTA_REDEFINIR_SENHA } from "@/features/auth/authService";
import { buscarCargo } from "@/features/auth/perfilService";
import { buscarCronograma } from "@/features/onboarding/cronogramaService";

// Fonte única da sessão: quem está logado, o cargo e o cronograma. Telas leem
// com useAuth() em vez de chamar supabase.auth.getUser() (que é uma ida ao
// servidor a cada chamada).
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cargo, setCargo] = useState("aluno");
  const [cronograma, setCronograma] = useState(null);
  const [carregando, setCarregando] = useState(true);
  // Id do usuário já processado. O Supabase re-emite eventos da MESMA sessão
  // (foco na aba, refresh de token, minimizar/restaurar); recarregar nesses
  // casos remontava a árvore e apagava o estado da tela.
  const usuarioIdRef = useRef(undefined);

  const recarregarCronograma = useCallback(async (userId) => {
    try {
      setCronograma(await buscarCronograma(userId));
    } catch {
      setCronograma(null);
    }
  }, []);

  const carregarDadosSessao = useCallback(
    async (userId) => {
      setCarregando(true);
      // Perfil + cronograma juntos, e só então libera a tela: evita "flashes"
      // de redirecionamento enquanto os dados chegam.
      await Promise.all([
        buscarCargo(userId)
          .then(setCargo)
          .catch((erro) => console.error("Erro ao buscar cargo:", erro)),
        recarregarCronograma(userId),
      ]);
      setCarregando(false);
    },
    [recarregarCronograma],
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, session) => {
      // Link de "esqueci minha senha" aberto: leva para a tela de nova senha,
      // mesmo que o Supabase tenha redirecionado para outra rota (ex.: a raiz,
      // quando a URL de retorno não está na allow-list do projeto).
      if (evento === "PASSWORD_RECOVERY") navigate(ROTA_REDEFINIR_SENHA, { replace: true });

      const usuario = session?.user ?? null;
      const novoId = usuario?.id ?? null;
      if (novoId === usuarioIdRef.current) return;
      usuarioIdRef.current = novoId;

      setUser(usuario);
      if (usuario) {
        carregarDadosSessao(usuario.id);
      } else {
        setCarregando(false);
        setCronograma(null);
        setCargo("aluno");
      }
    });
    return () => subscription.unsubscribe();
  }, [carregarDadosSessao, navigate]);

  // O onAuthStateChange limpa o estado e os guards de rota levam ao /login.
  const sair = useCallback(() => supabase.auth.signOut(), []);

  const valor = useMemo(
    () => ({
      user,
      userId: user?.id ?? null,
      email: user?.email ?? "",
      nome: (user?.user_metadata?.nome || "").trim(),
      cargo,
      cronograma,
      temCronograma: Boolean(cronograma),
      carregando,
      recarregarCronograma: () => (user ? recarregarCronograma(user.id) : Promise.resolve()),
      sair,
    }),
    [user, cargo, cronograma, carregando, recarregarCronograma, sair],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
