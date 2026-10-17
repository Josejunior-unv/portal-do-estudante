import { supabase } from "@/lib/supabase";
import { lerJSON, gravarJSON } from "@/lib/armazenamento";

// Conclusão de tarefas por aluno. Fonte de verdade: tabela `tarefas_status`
// (sincroniza entre dispositivos, protegida por RLS). Se a tabela ainda não
// existir, cai graciosamente para o localStorage — assim nada quebra.

const chave = (userId) => `tarefas_concluidas_${userId || "anon"}`;

const localGet = (userId) => lerJSON(chave(userId), {});
const localSet = (userId, mapa) => gravarJSON(chave(userId), mapa);

// Após o primeiro erro do banco (tabela ausente), usamos só o local.
let dbIndisponivel = false;

export async function carregarConcluidas(userId) {
  if (!userId) return {};

  if (!dbIndisponivel) {
    const { data, error } = await supabase
      .from("tarefas_status")
      .select("material_id")
      .eq("usuario_id", userId)
      .eq("concluido", true);

    if (!error && data) {
      const mapa = {};
      data.forEach((r) => {
        mapa[r.material_id] = true;
      });
      localSet(userId, mapa); // mantém um cache local
      return mapa;
    }
    dbIndisponivel = true; // tabela indisponível → fallback local
  }

  return localGet(userId);
}

export async function definirConcluida(userId, materialId, concluido) {
  if (!userId) return;

  // Atualização otimista no cache local (sempre).
  const mapa = localGet(userId);
  if (concluido) mapa[materialId] = true;
  else delete mapa[materialId];
  localSet(userId, mapa);

  if (dbIndisponivel) return;

  if (concluido) {
    const { error } = await supabase
      .from("tarefas_status")
      .upsert(
        { usuario_id: userId, material_id: materialId, concluido: true },
        { onConflict: "usuario_id,material_id" },
      );
    if (error) dbIndisponivel = true;
  } else {
    const { error } = await supabase
      .from("tarefas_status")
      .delete()
      .eq("usuario_id", userId)
      .eq("material_id", materialId);
    if (error) dbIndisponivel = true;
  }
}
