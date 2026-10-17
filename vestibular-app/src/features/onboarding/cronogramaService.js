import { supabase } from "@/lib/supabase";

// Cronograma salvo do aluno, ou null no primeiro acesso.
export async function buscarCronograma(userId) {
  const { data, error } = await supabase
    .from("cronogramas")
    .select("dados_cronograma")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.dados_cronograma ?? null;
}

export async function salvarCronograma(userId, lista) {
  const { error } = await supabase.from("cronogramas").upsert(
    { user_id: userId, dados_cronograma: lista, updated_at: new Date() },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
