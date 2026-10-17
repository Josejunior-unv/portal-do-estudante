import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { redirecionamento } from "@/app/rotas";

// Renderiza a rota só se a sessão atende a exigência; senão redireciona.
export default function Guarda({ exigir, children }) {
  const sessao = useAuth();
  const destino = redirecionamento(sessao, exigir);
  return destino ? <Navigate to={destino} replace /> : children;
}
