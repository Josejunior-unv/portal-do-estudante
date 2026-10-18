import { useState } from "react";
import { Bolha, Botao } from "@/components/ui";
import OnboardingLayout from "@/features/onboarding/OnboardingLayout";

const OPCOES = [
  {
    id: "UERJ",
    nome: "UERJ",
    desc: "Exame de Qualificação e Exame Discursivo da Universidade do Estado do Rio de Janeiro.",
  },
  {
    id: "ENEM",
    nome: "ENEM",
    desc: "Exame Nacional do Ensino Médio: as quatro áreas e a redação.",
  },
];

export default function PassoVestibular({ onNext, inicial = "ENEM" }) {
  const [vestibular, setVestibular] = useState(inicial);

  return (
    <OnboardingLayout
      passo={1}
      titulo="Para qual vestibular você vai estudar?"
      subtitulo="Com isso montamos seu plano da semana. Dá para mudar depois."
    >
      <div role="radiogroup" aria-label="Vestibular" className="divide-y divide-white/[0.08] border-y border-white/[0.08] mb-6">
        {OPCOES.map((op) => {
          const ativo = vestibular === op.id;
          return (
            <button
              key={op.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => setVestibular(op.id)}
              className="w-full flex items-start gap-4 py-4 text-left"
            >
              <Bolha letra={ativo ? "✓" : ""} estado={ativo ? "marcada" : "vazia"} tamanho="md" />
              <span>
                <span className="block text-lg font-bold text-white">{op.nome}</span>
                <span className="block text-sm text-ink-400 mt-0.5 leading-6">{op.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Botao tamanho="lg" className="w-full" onClick={() => onNext({ vestibular })}>
        Continuar
      </Botao>
    </OnboardingLayout>
  );
}
