import { Flame } from "lucide-react";

// Tela cheia exibida enquanto a sessão carrega ou uma rota lazy é baixada.
export default function TelaCarregando({ texto = "Carregando seu painel..." }) {
  return (
    <div className="bg-ink-950 min-h-screen flex flex-col items-center justify-center gap-4">
      <span className="w-12 h-12 rounded-2xl bg-gold-400 text-sobre-destaque flex items-center justify-center shadow-[var(--shadow-gold)] animate-brilho">
        <Flame size={22} strokeWidth={2.5} />
      </span>
      <p className="text-ink-400 text-sm font-medium">{texto}</p>
    </div>
  );
}
