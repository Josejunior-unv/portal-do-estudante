import { CheckCircle2 } from "lucide-react";
import { cx } from "@/components/ui/cx";

// Nota no topo das telas da UERJ. Desde a revisão de out/2026 as questões
// são recortadas dos PDFs oficiais e conferidas com os gabaritos da UERJ;
// a nota diz isso e aponta o "Reportar erro" para o que ainda escapar.
export default function AvisoUerj({ className = "" }) {
  return (
    <p className={cx("flex items-start gap-2 mb-5 text-sm text-ink-400 leading-6", className)}>
      <CheckCircle2 size={16} className="shrink-0 mt-1 text-emerald-300" />
      <span>
        Questões tiradas das provas oficiais da UERJ, com o gabarito oficial. Achou algum
        erro? Use <strong className="text-ink-200">Reportar erro</strong> na questão.
      </span>
    </p>
  );
}
