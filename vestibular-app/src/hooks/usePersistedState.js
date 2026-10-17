import { useState, useEffect } from "react";
import { lerJSON, gravarJSON } from "@/lib/armazenamento";

// useState que persiste automaticamente em localStorage, restaurando o valor ao
// recarregar a página / reabrir o app. Usado para lembrar a navegação profunda
// (matéria aberta, seção, filtros, busca...) que não fica na URL.
export function usePersistedState(chave, valorInicial) {
  const [valor, setValor] = useState(() => lerJSON(chave, valorInicial));

  useEffect(() => {
    gravarJSON(chave, valor);
  }, [chave, valor]);

  return [valor, setValor];
}
