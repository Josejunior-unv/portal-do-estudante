import { useEffect, useEffectEvent } from "react";
import { supabase } from "@/lib/supabase";

// Assina os INSERTs de uma tabela via Supabase Realtime enquanto o componente
// está montado. `aoInserir` recebe a linha nova; pode mudar a cada render sem
// reabrir o canal.
export function useInsercoesRealtime({ canal, tabela, filtro, aoInserir, ativo = true }) {
  const notificar = useEffectEvent((linha) => aoInserir(linha));

  useEffect(() => {
    if (!ativo) return;
    const assinatura = supabase
      .channel(canal)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: tabela, ...(filtro ? { filter: filtro } : {}) },
        (payload) => notificar(payload.new),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(assinatura);
    };
  }, [canal, tabela, filtro, ativo]);
}
