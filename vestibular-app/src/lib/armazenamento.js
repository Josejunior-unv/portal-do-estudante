// Acesso seguro ao localStorage. Em modo privado, com cota cheia ou com o
// armazenamento bloqueado o navegador lança exceção; aqui isso vira "usa o
// padrão" na leitura e "segue sem persistir" na escrita.

export function lerJSON(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    if (bruto === null) return padrao;
    return JSON.parse(bruto) ?? padrao;
  } catch {
    return padrao;
  }
}

// Retorna false quando não conseguiu gravar (o valor vale só na sessão).
export function gravarJSON(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}
