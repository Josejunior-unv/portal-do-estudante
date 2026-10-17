import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { ROTA_REDEFINIR_SENHA } from "@/features/auth/authService";
import Login from "@/features/auth/Login";
import RedefinirSenha from "@/features/auth/RedefinirSenha";
import AppShell from "@/features/layout/AppShell";
import Guarda from "@/app/Guarda";
import TelaCarregando from "@/app/TelaCarregando";
import { rotaInicial } from "@/app/rotas";

// Áreas que nem todo usuário visita: o aluno nunca baixa o código do painel
// do professor, e o onboarding só é baixado no primeiro acesso.
const AreaAdmin = lazy(() => import("@/features/admin/AreaAdmin"));
const Onboarding = lazy(() => import("@/features/onboarding/Onboarding"));

function App() {
  const sessao = useAuth();
  if (sessao.carregando) return <TelaCarregando />;

  return (
    <Suspense fallback={<TelaCarregando texto="Carregando..." />}>
      <Routes>
        <Route path="/login" element={<Guarda exigir="visitante"><Login /></Guarda>} />

        {/* Destino do link de recuperação enviado por e-mail. Também serve
            para quem já está logado e quer trocar a senha. */}
        <Route
          path={ROTA_REDEFINIR_SENHA}
          element={<RedefinirSenha key={sessao.userId ?? "anonimo"} user={sessao.user} />}
        />

        <Route path="/admin" element={<Guarda exigir="admin"><AreaAdmin /></Guarda>} />
        <Route path="/onboarding" element={<Guarda exigir="onboarding"><Onboarding /></Guarda>} />
        <Route path="/app" element={<Navigate to="/app/cronograma" replace />} />
        <Route path="/app/:aba" element={<Guarda exigir="aluno"><AppShell /></Guarda>} />

        <Route path="*" element={<Navigate to={rotaInicial(sessao)} replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
