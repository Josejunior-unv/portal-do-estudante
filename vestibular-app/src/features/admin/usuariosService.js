import { supabase } from "@/lib/supabase";

// RPCs SECURITY DEFINER (parte 6 do supabase_migration.sql). Ambas checam por
// dentro se quem chama é admin.

export async function listarUsuarios() {
  const { data, error } = await supabase.rpc("admin_listar_usuarios");
  if (error) throw error;
  return data || [];
}

export async function definirCargo(userId, novoCargo) {
  const { error } = await supabase.rpc("admin_definir_cargo", {
    alvo: userId,
    novo_cargo: novoCargo,
  });
  if (error) throw error;
}
