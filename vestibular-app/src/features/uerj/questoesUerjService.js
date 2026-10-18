import { supabase } from "@/lib/supabase";
import { areaDaDisciplina } from "@/constants/areasConhecimento";
import { coletarTudo } from "@/lib/consultas";

// Camada única de acesso às provas/questões da UERJ importadas pelo
// pipeline (scripts/importador_uerj). Todas as funções degradam com
// elegância quando a migração ainda não foi executada (tabela ausente):
// devolvem listas vazias em vez de quebrar a tela.

export async function listarProvasUerj() {
  const { data, error } = await supabase
    .from("provas_uerj")
    .select("*")
    .order("ano", { ascending: false });
  return { data: data || [], error };
}

/** Contagem de questões por disciplina — alimenta as pastas do hub. */
export async function contarQuestoesPorDisciplina() {
  const { data, error } = await coletarTudo(() =>
    supabase.from("questoes_uerj").select("disciplina"),
  );
  if (error) return { contagens: {}, total: 0, error };

  const contagens = {};
  (data || []).forEach((q) => {
    const d = q.disciplina || "Não Classificada";
    contagens[d] = (contagens[d] || 0) + 1;
  });
  return { contagens, total: data?.length || 0, error: null };
}

/** Questões de uma disciplina, com a prova de origem embutida. */
export async function listarQuestoesUerj(disciplina) {
  const montar = () => {
    let consulta = supabase
      .from("questoes_uerj")
      .select("*, prova:provas_uerj(id, ano, fase, tipo, titulo, pdf_url)")
      .order("prova_id", { ascending: false })
      .order("numero", { ascending: true });
    if (disciplina) consulta = consulta.eq("disciplina", disciplina);
    return consulta;
  };
  const { data, error } = await coletarTudo(montar);
  return { data: data || [], error };
}

/**
 * Anexa a cada questão os seus textos de apoio (`apoios`), buscando todos de
 * uma vez. Sem a PARTE 14 da migration (tabela ausente), devolve as questões
 * como estão.
 */
export async function anexarApoios(questoes) {
  const ids = [...new Set(questoes.flatMap((q) => q.apoio_ids || []))];
  if (!ids.length) return questoes;
  const { data, error } = await supabase
    .from("textos_apoio_uerj")
    .select("id, imagens, texto")
    .in("id", ids);
  if (error) return questoes;
  const porId = new Map(data.map((a) => [a.id, a]));
  return questoes.map((q) => ({
    ...q,
    apoios: (q.apoio_ids || []).map((id) => porId.get(id)).filter(Boolean),
  }));
}

/** Adapta uma questão UERJ para o formato que o QuestaoCard consome. */
export function adaptarParaCard(q) {
  return {
    index: q.numero,
    year: q.prova?.ano > 0 ? q.prova.ano : "",
    origem: "UERJ",
    materiaNome: q.disciplina,
    context: q.enunciado,
    // Com o recorte da prova, as figuras antigas (extraídas soltas e às
    // vezes trocadas) não são mais exibidas.
    files: q.recorte_url ? [] : Array.isArray(q.imagens) ? q.imagens : [],
    alternatives: (q.alternativas || []).map((a) => ({
      letter: a.letra,
      text: a.texto,
    })),
    correctAlternative: q.anulada ? null : q.resposta || null,
    recorte: q.recorte_url || null,
    apoios: q.apoios || [],
    anulada: Boolean(q.anulada),
    discursiva: q.prova?.tipo === "discursivo",
    pdf: q.prova?.pdf_url || null,
    pagina: q.pagina || null,
    textoConfiavel: Boolean(q.texto_confiavel),
  };
}

// ------------------------------------------------------------- admin

export async function estatisticasUerj() {
  const [provas, questoes, naoClassificadas] = await Promise.all([
    supabase.from("provas_uerj").select("id", { count: "exact", head: true }),
    supabase.from("questoes_uerj").select("id", { count: "exact", head: true }),
    supabase
      .from("questoes_uerj")
      .select("id", { count: "exact", head: true })
      .eq("classificada", false),
  ]);
  if (provas.error || questoes.error || naoClassificadas.error) {
    return { erro: provas.error || questoes.error || naoClassificadas.error };
  }
  return {
    provas: provas.count || 0,
    questoes: questoes.count || 0,
    naoClassificadas: naoClassificadas.count || 0,
    erro: null,
  };
}

export async function listarLogsUerj(limite = 30) {
  const { data, error } = await supabase
    .from("uerj_import_logs")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limite);
  return { data: data || [], error };
}

export async function listarNaoClassificadas(limite = 50) {
  const { data, error } = await supabase
    .from("questoes_uerj")
    .select("id, numero, enunciado, disciplina, assunto, prova:provas_uerj(ano, fase)")
    .eq("classificada", false)
    .limit(limite);
  return { data: data || [], error };
}

export async function corrigirClassificacao(id, disciplina, assunto) {
  const { error } = await supabase
    .from("questoes_uerj")
    .update({
      disciplina,
      assunto: assunto || "Não Classificado",
      // Mantém a área coerente com a disciplina corrigida.
      area: areaDaDisciplina(disciplina)?.nome ?? null,
      classificada: true,
    })
    .eq("id", id);
  return { error };
}

export async function excluirProvaUerj(id) {
  // As questões caem junto (FK on delete cascade).
  const { error } = await supabase.from("provas_uerj").delete().eq("id", id);
  return { error };
}
