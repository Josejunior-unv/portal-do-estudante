import { supabase } from "@/lib/supabase";

// Cargo do usuário. Aluno recém-criado não tem linha em `profiles` — por isso
// maybeSingle (sem 406) e o padrão 'aluno'.
export async function buscarCargo(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.cargo ?? "aluno";
}
