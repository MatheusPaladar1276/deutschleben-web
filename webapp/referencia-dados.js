// Pacote exclusivamente público. Nenhum Card ou texto pessoal é armazenado aqui.
export const VERSAO = 'rg-previa-01-10-v10';
const raiz = new URL('./', import.meta.url);
const manifestoURL = new URL('data/referencia/manifesto.json', raiz).href;
const prefixo = 'dl-rg-publico-';
const normalizar = s => String(s || '').normalize('NFC').toLocaleLowerCase('de');
export const urlPublica = caminho => new URL(caminho, raiz).href;
const digest = async buffer => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(b => b.toString(16).padStart(2, '0')).join('');
function validarManifesto(m) {
  if (m.schema_version !== 1 || m.versao !== VERSAO || !Array.isArray(m.recursos) || !m.recursos.length || !Array.isArray(m.modulos) || !m.modulos.length || !m.modulos.every(n=>typeof n==='string'&&/^\d{2}$/.test(n)) || new Set(m.modulos).size!==m.modulos.length) throw Error('Versão do pacote indisponível.');
  const urls = new Set();
  for (const r of m.recursos) {
    const u = new URL(r.url, raiz);
    if (u.origin !== raiz.origin || !u.pathname.startsWith(raiz.pathname) || !/^[a-f0-9]{64}$/.test(r.sha256) || urls.has(u.href)) throw Error('Manifesto público inválido.');
    urls.add(u.href);
  }
  return m;
}
async function cachePronto() {
  for (const nome of (await caches.keys()).filter(n => n.startsWith(prefixo)).reverse()) {
    const cache = await caches.open(nome), r = await cache.match(manifestoURL);
    if (r) { try { const m = validarManifesto(await r.json()); return {cache, m, nome}; } catch {} }
  }
  return null;
}
async function manifesto() {
  try {
    const r = await fetch(manifestoURL, {cache:'no-store'});
    if (!r.ok) throw Error();
    return validarManifesto(await r.json());
  } catch {
    const pronto = await cachePronto();
    if (pronto) return pronto.m;
    throw Error('O pacote desta referência ainda não está disponível neste aparelho. Conecte-se e prepare o uso sem internet.');
  }
}
async function recurso(m, caminho) {
  const url = urlPublica(caminho), esperado = m.recursos.find(r => urlPublica(r.url) === url);
  if (!esperado) throw Error('Recurso fora do pacote.');
  let resposta;
  try { resposta = await fetch(url, {cache:'no-store'}); } catch {}
  if (resposta?.ok) {
    const buffer = await resposta.clone().arrayBuffer();
    if (await digest(buffer) === esperado.sha256) return resposta;
  }
  const pronto = await cachePronto(), local = await pronto?.cache.match(url);
  if (local && await digest(await local.clone().arrayBuffer()) === esperado.sha256) return local;
  throw Error('Recurso desta referência indisponível ou de outra versão. Conecte-se para carregar o pacote completo.');
}
let pendente;
export function carregarReferencia() {
  if (!pendente) pendente = (async () => {
    const m = await manifesto();
    const [base, vinculos, sobre, ...modulos] = await Promise.all(['base','vinculos','sobre',...m.modulos.map(n=>'modulo-'+n)].map(async nome => (await recurso(m, 'data/referencia/'+nome+'.json')).json()));
    const consultas = modulos.flatMap(modulo => modulo.consultas.map(c => ({...c, modulo:modulo.numero, assunto:modulo.titulo})));
    const ids = new Set([...base.modulos,...consultas].map(c => c.id));
    if (ids.size !== consultas.length + base.modulos.length || !vinculos.vinculos.every(v => ids.has(v.consulta_id)) || ![...base.modulos,...consultas].every(c=>(c.relacionados||[]).every(id=>ids.has(id))) || !(vinculos.entre_consultas||[]).every(v=>ids.has(v.origem)&&ids.has(v.destino))) throw Error('Vínculos da referência inválidos.');
    return {manifesto:m, base:base.modulos, modulos, consultas, vinculos, sobre};
  })().catch(e => { pendente = null; throw e; });
  return pendente;
}
// Campos explícitos de estudo. A correspondência completa não atravessa campos.
const tokens = s => normalizar(s).match(/[\p{L}\p{N}]+/gu)||[];
function camposEstudo(c) {
  return [c.titulo,c.assunto,...(c.palavras_chave||[]),...(c.termos_busca||[]),
    ...(c.explicacao||[]),...(c.apresentacao||[]).map(p=>p.texto),
    ...(c.exemplos||[]).flatMap(e=>[e.de,e.pt,e.alemao,e.portugues]),
    ...(c.tabelas||[]).flatMap(t=>[t.titulo,...t.colunas,...t.linhas.flat(),t.nota])]
    .filter(s=>typeof s==='string'&&s.length);
}
export function textoBusca(c) {
  return normalizar(camposEstudo(c).join(' '));
}
export function priorizarConsultas(consultas, termo) {
  const t=normalizar(termo.trim());
  if(!t)return consultas;
  const score=c=>{
    const termos=(c.termos_busca||[]).map(normalizar),titulo=normalizar(c.titulo);
    return (termos.includes(t)?1000:termos.some(x=>x.includes(t))?500:0)
      +(titulo===t?400:titulo.includes(t)?250:0)
      +(c.tipo_consulta==='uso'?100:c.tipo_consulta==='comparacao'?20:0);
  };
  return [...consultas].sort((a,b)=>score(b)-score(a));
}
export function buscarConsultas(d, termo, modulo='todos') {
  const t = normalizar(termo.trim());
  return priorizarConsultas(d.consultas.filter(c => c.tipo_consulta!=='ajuda' && (modulo==='todos'||c.modulo===modulo) && (!t||textoBusca(c).includes(t))),termo);
}
// Artigos são pistas secundárias quando há outras palavras na consulta.
// A lista não analisa casos, regência nem o sentido da frase.
const formasGenericas=new Set(['der','die','das','den','dem','des','ein','eine','einer','einen','einem','eines']);
export function pesquisarReferencia(d, trecho, modulo='todos') {
  const sequencia=tokens(trecho),palavras=[...new Set(sequencia)],expressao=sequencia.join(' ');
  const vazio={modo:'vazio',resultados:[],secundarios:[],palavras:[]};
  if(!palavras.length)return vazio;
  const informativas=palavras.filter(p=>!formasGenericas.has(p));
  const relevantes=informativas.length?informativas:palavras;
  const base=d.base.map(c=>({...c,palavras_chave:[...(c.gatilhos||[]),...(c.itens||[]),...(c.detalhes||[]),...(c.dativo||[]),...(c.acusativo||[]),...(c.dativo_ou_acusativo||[])]}));
  const universo=[...(modulo==='todos'?base:[]),...d.consultas.filter(c=>c.tipo_consulta!=='ajuda'&&(modulo==='todos'||c.modulo===modulo))];
  const identidade=c=>tokens([c.titulo,c.assunto,...(c.palavras_chave||[]),...(c.termos_busca||[])].join(' '));
  const indice=universo.map(c=>{
    const campos=camposEstudo(c).map(s=>tokens(s)),conjunto=new Set(campos.flat()),ident=new Set(identidade(c));
    const formas=[c.titulo.split('—')[0].trim(),...(c.palavras_chave||[]),...(c.termos_busca||[])].map(normalizar);
    return {c,completa:campos.some(campo=>(' '+campo.join(' ')+' ').includes(' '+expressao+' ')),
      encontradas:palavras.filter(p=>conjunto.has(p)),
      conteudo:relevantes.filter(p=>conjunto.has(p)).length,
      identidade:relevantes.filter(p=>ident.has(p)).length,
      diretas:relevantes.filter(p=>formas.includes(p)).length,
      posicao:relevantes.findIndex(p=>ident.has(p))};
  }).filter(i=>i.encontradas.length);
  if(!indice.length)return vazio;
  const ordemInicial=new Map(priorizarConsultas(indice.map(i=>i.c),trecho).map((c,i)=>[c.id,i]));
  indice.sort((a,b)=>b.diretas-a.diretas||b.identidade-a.identidade||a.posicao-b.posicao||b.conteudo-a.conteudo||b.encontradas.length-a.encontradas.length||ordemInicial.get(a.c.id)-ordemInicial.get(b.c.id));
  const completas=indice.filter(i=>i.completa);
  // Uma expressão registrada em exemplo/explicação tem a mesma validade de busca
  // que uma expressão do título. Fichas que cobrem as palavras relevantes por
  // título/termos cadastrados também participam, antes de exemplos incidentais.
  // Isso não confirma uma interpretação gramatical.
  const porForma=indice.some(i=>i.identidade>0);
  const principais=completas.length?indice.filter(i=>i.completa||i.identidade===relevantes.length):indice.filter(i=>porForma?i.identidade>0:i.conteudo>0);
  const ids=new Set(principais.map(i=>i.c.id));
  return {modo:completas.length?'expressao':'palavras',resultados:principais.map(i=>i.c),
    secundarios:indice.filter(i=>!ids.has(i.c.id)).map(i=>i.c),
    palavras:palavras.filter(p=>indice.some(i=>i.encontradas.includes(p)))};
}
export function candidatos(d, trecho, usoId=null) {
  const palavras = s => normalizar(s).match(/[\p{L}\p{N}]+/gu)||[];
  const termos = new Set(palavras(trecho)), usos = new Set(usoId?[usoId]:[]), ids = new Set();
  for (const termo of [...termos]) if (Object.hasOwn(d.vinculos.contracoes, termo)) termos.add(palavras(d.vinculos.contracoes[termo])[0]);
  // Léxico do acervo é fornecido pela reconciliação, nunca inferido pelo número.
  for (const v of d.vinculos.vinculos) {
    if (usos.has(v.uso_id) || (!usoId && termos.has(normalizar(v.palavra)))) ids.add(v.consulta_id);
  }
  // Formas separáveis são uma lista editorial explícita; não um analisador de sufixos.
  for (const pista of d.vinculos.pistas_exatas) if (termos.has(normalizar(pista.forma))) for (const id of pista.consultas) ids.add(id);
  const especificas=new Set(d.vinculos.vinculos.filter(v=>v.uso_id===usoId&&v.relacao==='uso_revisado').map(v=>v.consulta_id));
  return priorizarConsultas(d.consultas.filter(c=>c.tipo_consulta!=='ajuda'&&ids.has(c.id)),trecho).sort((a,b)=>Number(especificas.has(b.id))-Number(especificas.has(a.id)));
}
async function workerConfirmado() {
  if (!navigator.serviceWorker?.controller) throw Error('Reabra esta página com conexão para ativar o uso sem internet.');
  const canal = new MessageChannel();
  const versao = await new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(Error('Não foi possível verificar o suporte offline. Reabra a página e tente novamente.')),5000);
    canal.port1.onmessage=e=>{clearTimeout(timer);canal.port1.close();resolve(e.data?.versao);};
    navigator.serviceWorker.controller.postMessage('verificar-referencia', [canal.port2]);
  });
  if (versao !== VERSAO) throw Error('O suporte offline ainda é de outra versão. Reabra a página com conexão.');
}
export async function verificarOffline() {
  await workerConfirmado();
  const pronto=await cachePronto();
  if (!pronto) return false;
  const atual=await manifesto();
  if (JSON.stringify(pronto.m)!==JSON.stringify(atual)) return false;
  for (const r of pronto.m.recursos) {
    const local=await pronto.cache.match(urlPublica(r.url));
    if (!local || await digest(await local.arrayBuffer())!==r.sha256) return false;
  }
  return true;
}
let preparando;
export function prepararOffline(progresso=()=>{}) {
  if (preparando) return preparando;
  preparando=(async()=>{
    await workerConfirmado();
    const m=await manifesto(), nome=prefixo+VERSAO+'-'+Date.now(), cache=await caches.open(nome);
    try {
      let i=0;
      for (const r of m.recursos) {
        const resposta=await recurso(m,r.url);
        await cache.put(urlPublica(r.url),resposta);
        progresso(++i,m.recursos.length);
      }
      // O manifesto é o marcador de conclusão: escrito somente depois dos recursos.
      for (const r of m.recursos) {
        const salvo=await cache.match(urlPublica(r.url));
        if (!salvo || await digest(await salvo.arrayBuffer())!==r.sha256) throw Error('A verificação do pacote não foi concluída.');
      }
      await cache.put(manifestoURL,new Response(JSON.stringify(m),{headers:{'Content-Type':'application/json; charset=utf-8'}}));
      if (!await verificarOffline()) throw Error('Não foi possível confirmar todos os recursos offline.');
      // Só remove pacotes públicos anteriores após confirmar o novo. Cards são intocados.
      for (const antigo of (await caches.keys()).filter(n=>n.startsWith(prefixo)&&n!==nome)) await caches.delete(antigo);
      return VERSAO;
    } catch(e) { await caches.delete(nome); throw e; }
  })().finally(()=>{preparando=null;});
  return preparando;
}
