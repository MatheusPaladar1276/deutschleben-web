const copiar = valor => JSON.parse(JSON.stringify(valor));
const texto = valor => typeof valor === 'string' && valor.trim().length > 0;
const grupos = ['substantivos', 'verbos', 'adverbios'];
const DIA = 86400000;
export const SEM_CLASSIFICACAO = 'classificação não informada';

export function classificacaoConferida(registro) {
  return registro?.classificacaoConferida === true &&
    texto(registro.fonteClassificacao) &&
    ['regular', 'irregular', 'misto'].includes(registro.classificacao)
    ? registro.classificacao : SEM_CLASSIFICACAO;
}

// O ID estabelece o vínculo. Título, número e coincidência lexical não o substituem.
export function identificar(aberto, registro, acervos, revisao = []) {
  const itens = {substantivos: [], verbos: [], adverbios: []}, pendencias = [], excluidos = [];
  const pendente = (grupo, palavra, motivo) => pendencias.push({grupo, palavra, motivo});
  if (registro && (registro.textoId !== aberto.id || registro.original !== aberto.conteudo)) {
    throw Error('O Card não corresponde ao ID e ao conteúdo do texto aberto.');
  }
  const card = registro?.card;
  for (const secao of Object.values(card?.secoes || {})) for (const i of secao) {
    if (i.origem && !aberto.conteudo.includes(i.origem)) throw Error('Frase de origem do Card não encontrada no texto aberto.');
  }
  const adicionar = (grupo, item) => {
    const iguais = itens[grupo].filter(i => i.lema === item.lema);
    if (!iguais.some(i => i.significado === item.significado && i.plural === item.plural)) itens[grupo].push(item);
  };
  for (const i of card?.secoes.substantivos || []) {
    const partes = i.de.split(';').map(s => s.trim());
    const singular = partes[0].match(/^(der|die|das)\s+(.+)$/u);
    if (!singular) { pendente('Substantivos', i.de, 'Artigo ou lema não estruturado no Card.'); continue; }
    const [, artigo, lema] = singular;
    const candidatos = acervos.substantivos.filter(n => n.palavra === lema && n.artigo === artigo);
    const complemento = candidatos.length === 1 ? candidatos[0] : null;
    const plural = partes[1] || complemento?.plural;
    const significado = i.pt || complemento?.significado;
    if (!plural || !significado) pendente('Substantivos', lema, 'Falta plural ou significado.');
    adicionar('substantivos', {lema, artigo, plural: plural || 'plural não informado',
      significado: significado || 'significado não informado', fonte: 'Card vinculado ao texto', contexto: i.origem || ''});
  }
  for (const i of card?.secoes.verbos || []) {
    const partes = i.de.split(';').map(s => s.trim());
    // O segundo campo declara o infinitivo nos Cards antigos. Não lematizar por sufixo.
    const lema = i.infinitivo || (partes.length === 2 ? partes[1] :
      partes.length === 1 && acervos.verbos.some(v => v.verbo === partes[0]) ? partes[0] : null);
    if (!lema) { pendente('Verbos', i.de, 'Infinitivo não declarado; não foi inferido.'); continue; }
    const registros = acervos.verbos.filter(v => v.verbo === lema);
    const classes = [...new Set(registros.map(classificacaoConferida).filter(c => c !== SEM_CLASSIFICACAO))];
    adicionar('verbos', {lema, significado: i.pt, forma: partes[0], contexto: i.origem || '',
      classificacao: classes.length === 1 ? classes[0] : SEM_CLASSIFICACAO, fonte: 'Card vinculado ao texto'});
  }
  for (const i of card?.secoes.adverbios || []) {
    // O próprio Card explicita este uso como partícula de zurückgehen.
    if (i.de === 'zurück' && i.pt.includes('parte de zurückgehen')) {
      excluidos.push('zurück: partícula de zurückgehen neste uso, não advérbio independente.');
      continue;
    }
    adicionar('adverbios', {lema: i.de, significado: i.pt, contexto: i.origem || '', fonte: 'Sentido do Card neste texto'});
  }
  for (const r of revisao) {
    if (r.textoId !== aberto.id || r.conferido !== true || !texto(r.origem) ||
        !aberto.conteudo.includes(r.origem) || !r.origem.includes(r.forma)) {
      throw Error('Vínculo de revisão incompatível com o texto aberto.');
    }
    if (r.grupo === 'substantivos') {
      const encontrados = acervos.substantivos.filter(n => n.palavra === r.lema && n.artigo === r.artigo);
      if (encontrados.length !== 1) {
        pendente('Substantivos', r.lema, encontrados.length ? 'Mais de uma entrada; sentido precisa de conferência.' : 'Substantivo reconhecido na revisão da demonstração, ausente do acervo e do Card.');
        continue;
      }
      const n = encontrados[0];
      adicionar(r.grupo, {lema: n.palavra, artigo: n.artigo, plural: n.plural || 'plural não informado',
        significado: n.significado, nota: n.nota_uso || '', contexto: r.origem, fonte: 'Acervo + vínculo conferido na demonstração'});
      if (!n.plural) pendente('Substantivos', n.palavra, 'Plural não informado no acervo.');
    } else if (r.grupo === 'verbos') {
      const encontrados = acervos.verbos.filter(v => v.verbo === r.lema);
      if (!encontrados.length) { pendente('Verbos', r.lema, 'Verbo reconhecido na revisão, ausente do acervo.'); continue; }
      adicionar(r.grupo, {lema: r.lema, significado: r.significado, forma: r.forma, contexto: r.origem,
        classificacao: classificacaoConferida(encontrados[0]), fonte: 'Acervo + vínculo contextual conferido na demonstração'});
    } else {
      throw Error('Grupo de revisão não suportado.');
    }
  }
  return {itens, pendencias, excluidos, cobertura: card
    ? 'Itens declarados no Card vinculado' + (revisao.length ? ', mais vínculos explicitamente conferidos da demonstração' : '') + '. Não é uma análise completa do alemão.'
    : 'Sem Card vinculado: não é possível afirmar quais palavras foram identificadas. Nenhuma lista de ausências foi inferida.'};
}

export const PRAZO_MIN_DIAS = 1, PRAZO_MAX_DIAS = 10;
export function prazoEmMs(quantidade, unidade) {
  if (!Number.isSafeInteger(quantidade) || quantidade < 1 || !['dias', 'semanas'].includes(unidade)) {
    throw Error('Escolha um prazo inteiro positivo em dias ou semanas.');
  }
  const ms = quantidade * (unidade === 'semanas' ? 7 : 1) * DIA;
  if (!Number.isSafeInteger(ms)) throw Error('Prazo fora do intervalo suportado.');
  return ms;
}
// Qualquer ciclo é normalizado para um total de dias de calendário.
// Ciclos antigos em semanas são preservados: 1 semana = 7 dias.
export function diasDoPrazo(quantidade, unidade) {
  return quantidade * (unidade === 'semanas' ? 7 : 1);
}
function validarPrazoNovo(quantidade) {
  if (!Number.isSafeInteger(quantidade) || quantidade < PRAZO_MIN_DIAS || quantidade > PRAZO_MAX_DIAS) {
    throw Error('Escolha um prazo de 1 a 10 dias.');
  }
}
export function criarCiclo(aberto, identificacao, quantidade, unidade, agora = Date.now()) {
  if (!grupos.some(g => identificacao.itens[g].length)) throw Error('Nenhum item identificado com segurança para iniciar o ciclo.');
  if (unidade !== 'dias') throw Error('Nesta prévia o prazo é contado somente em dias.');
  validarPrazoNovo(quantidade);
  const fim = agora + prazoEmMs(quantidade, unidade);
  if (!Number.isFinite(new Date(fim).getTime())) throw Error('Prazo fora do intervalo suportado.');
  return {versao: 1, textoId: aberto.id, titulo: aberto.titulo, original: aberto.conteudo,
    identificacao: copiar(identificacao), inicio: agora, fim, quantidade, unidade};
}
export function validarCiclo(ciclo) {
  if (ciclo?.versao !== 1 || !texto(ciclo.textoId) || !texto(ciclo.titulo) || !texto(ciclo.original) ||
      !Number.isSafeInteger(ciclo.inicio) || !Number.isSafeInteger(ciclo.fim) ||
      ciclo.fim - ciclo.inicio !== prazoEmMs(ciclo.quantidade, ciclo.unidade) ||
      !Number.isFinite(new Date(ciclo.fim).getTime()) ||
      !grupos.every(g => Array.isArray(ciclo.identificacao?.itens?.[g]) &&
        ciclo.identificacao.itens[g].every(i => texto(i.lema) && texto(i.significado))) ||
      !Array.isArray(ciclo.identificacao.pendencias) || !Array.isArray(ciclo.identificacao.excluidos) ||
      !texto(ciclo.identificacao.cobertura)) throw Error('Ciclo local inválido. Nenhum dado foi substituído.');
  return copiar(ciclo);
}
export function continuarCiclo(ciclo, quantidade, unidade, agora = Date.now()) {
  validarCiclo(ciclo);
  return criarCiclo({id: ciclo.textoId, titulo: ciclo.titulo, conteudo: ciclo.original}, ciclo.identificacao, quantidade, unidade, agora);
}
function inicioDoDiaLocal(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
// Diferença em dias de calendário locais, avança a cada virada de meia-noite,
// mesmo com a prévia fechada: é recalculada a partir de inicio ao reabrir.
export function diasDecorridos(inicio, agora) {
  return Math.round((inicioDoDiaLocal(agora) - inicioDoDiaLocal(inicio)) / DIA);
}
export function marcador(ciclo, agora = Date.now()) {
  const total = diasDoPrazo(ciclo.quantidade, ciclo.unidade);
  const decorridos = Math.max(0, diasDecorridos(ciclo.inicio, agora));
  const restantes = total - decorridos;
  const concluido = restantes <= 0;
  const fracao = total > 0 ? Math.max(0, Math.min(1, decorridos / total)) : 1;
  const texto = concluido ? 'Prazo concluído.'
    : `${restantes} ${restantes === 1 ? 'dia restante' : 'dias restantes'}`;
  return {concluido, restantes, total, decorridos, fracao, texto};
}
