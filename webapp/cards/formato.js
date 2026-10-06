// Formato público DL Cards v1. Todos os campos de conteúdo são texto, nunca HTML.
(function(root) {
  const secoes = ['duvidas', 'blocos', 'sentencas', 'substantivos', 'verbos', 'adjetivos', 'adverbios'];
  const nomes = ['Dúvidas e esquecimentos', 'Blocos de sentido', 'Sentenças', 'Substantivos', 'Verbos', 'Adjetivos', 'Advérbios'];
  function validar(entrada) {
    if (typeof entrada === 'string' && entrada.length > 60000) throw Error('Limite: 60.000 caracteres.');
    let c; try { c = typeof entrada === 'string' ? JSON.parse(entrada) : entrada; } catch { throw Error('JSON inválido. Confira aspas e vírgulas.'); }
    const keys = (o, allowed) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(k => allowed.includes(k));
    const str = (s, max=4000) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
    if (!keys(c, ['versao','numero','titulo','secoes']) || c.versao !== 1 || !Number.isInteger(c.numero) || c.numero < 1 || c.numero > 9999 || !str(c.titulo,200) || !keys(c.secoes,secoes)) throw Error('Esperado formato v1, número, título e seções válidas.');
    for (const nome of secoes) {
      const itens = c.secoes[nome];
      if (!Array.isArray(itens) || itens.length > 100) throw Error('Seção inválida: '+nome);
      for (const i of itens) {
        if (!keys(i,['de','pt','origem','essencial']) || !str(i.de) || !str(i.pt) || typeof i.essencial !== 'boolean' || ('origem' in i && !str(i.origem))) throw Error('Item inválido em '+nome+': use de, pt, essencial e origem opcional.');
        if (['blocos','duvidas'].includes(nome) && (!i.essencial || !str(i.origem))) throw Error(nome+': cada item deve ser essencial e ter frase de origem.');
      }
    }
    if (!c.secoes.blocos.length || !c.secoes.duvidas.length || JSON.stringify(c).length > 60000) throw Error('Inclua blocos e dúvidas dentro do limite de 60.000 caracteres.');
    return JSON.parse(JSON.stringify(c));
  }
  function vincular(c, original) {
    validar(c);
    for (const itens of Object.values(c.secoes)) for (const i of itens) if (i.origem && !original.includes(i.origem)) throw Error('Frase de origem não encontrada no texto escolhido: '+i.origem);
    return c;
  }
  root.DL_CARD_FORMATO = { validar, vincular, secoes, nomes };
  if (typeof module !== 'undefined') module.exports = root.DL_CARD_FORMATO;
})(typeof window !== 'undefined' ? window : globalThis);
