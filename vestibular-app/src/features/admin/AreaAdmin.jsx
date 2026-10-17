import { useState } from "react";
import { LogOut, KeyRound } from "lucide-react";
import { BotaoTema } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import AlterarSenhaModal from "@/features/auth/AlterarSenhaModal";
import PainelAdmin from "@/features/admin/PainelAdmin";

const BOTAO_TOPO =
  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-ink-300 bg-ink-900 border border-white/[0.08] transition-all active:scale-95";

// Casca da rota /admin: barra de ações no topo + painel do professor.
export default function AreaAdmin() {
  const { sair } = useAuth();
  const [alterarSenhaAberto, setAlterarSenhaAberto] = useState(false);

  return (
    <div className="bg-ink-950 min-h-screen relative pt-16 pb-10">
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <BotaoTema className="bg-ink-900 border border-white/[0.08] rounded-xl" />
        <button
          onClick={() => setAlterarSenhaAberto(true)}
          className={`${BOTAO_TOPO} hover:text-gold-300 hover:border-gold-400/30`}
        >
          <KeyRound size={15} /> <span className="hidden sm:inline">Alterar senha</span>
        </button>
        <button onClick={sair} className={`${BOTAO_TOPO} hover:text-rose-300 hover:border-rose-500/30`}>
          <LogOut size={15} /> Sair
        </button>
      </div>
      <PainelAdmin />
      <AlterarSenhaModal aberto={alterarSenhaAberto} onFechar={() => setAlterarSenhaAberto(false)} />
    </div>
  );
}
