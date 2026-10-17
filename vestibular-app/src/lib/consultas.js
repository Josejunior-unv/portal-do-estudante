/**
 * Coleta TODAS as linhas de uma consulta, paginando de 1000 em 1000.
 * O PostgREST do Supabase limita cada resposta a 1000 linhas: consultas sem
 * paginação (ou um `.range(0, 4999)`) devolvem silenciosamente só as 1000
 * primeiras, o que fazia contagens e filtros ignorarem parte do acervo.
 *
 * `montarConsulta` precisa devolver uma consulta NOVA a cada chamada.
 */
export async function coletarTudo(montarConsulta, tamanho = 1000) {
  const linhas = [];
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await montarConsulta().range(inicio, inicio + tamanho - 1);
    if (error) return { data: linhas, error };
    linhas.push(...(data || []));
    if (!data || data.length < tamanho) return { data: linhas, error: null };
  }
}
