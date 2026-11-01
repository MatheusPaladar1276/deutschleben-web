import '../cards/formato.js';
import {identificar, criarCiclo, continuarCiclo, marcador, diasDoPrazo} from './modelo.js';
import {carregarCiclo as carregarCicloLocal, salvarCiclo as salvarCicloLocal} from './persistencia.js';

// Contexto opcional de produção (definido por entrada.js). Vazio na prévia local.
const ctx = window.DL_MEMORIZAR_CTX || {};
const carregarCiclo = ctx.carregarCiclo || carregarCicloLocal;
const salvarCiclo = ctx.salvarCiclo || salvarCicloLocal;

const $ = id => document.getElementById(id);
const css = document.createElement('link');
css.rel = 'stylesheet'; css.href = new URL('./memorizar.css', import.meta.url); document.head.append(css);
const botao = document.createElement('button');
botao.id = 'nav-memorizar'; botao.type = 'button'; botao.className = 'nav';
botao.textContent = 'Memorizar'; botao.setAttribute('aria-expanded', 'false'); botao.setAttribute('aria-controls', 'memorizar');
document.querySelector('.navegacao').insertBefore(botao, document.querySelector('.caminhadas-controle'));
const painel = document.createElement('aside');
painel.id = 'memorizar'; painel.className = 'cartao'; painel.hidden = true;
painel.setAttribute('aria-labelledby', 'memorizar-titulo');
painel.innerHTML = `
  <div class="mem-cabecalho"><div><p class="mem-selo">${ctx.selo || 'PRÉVIA LOCAL · sem nuvem'}</p><h2 id="memorizar-titulo" tabindex="-1">Memorizar</h2></div>
    <button type="button" class="secundario" id="mem-fechar" aria-label="Fechar Memorizar">Fechar</button></div>
  <p id="mem-status" role="status" aria-live="polite" tabindex="-1"></p>
  <p id="mem-vinculo"></p>
  <div class="mem-contagem-linha"><p id="mem-tempo" role="status"></p>
    <button type="button" class="secundario" id="mem-alterar-prazo" hidden>Alterar prazo</button></div>
  <p id="mem-aviso-prazo" role="alert" tabindex="-1" hidden></p>
  <progress id="mem-progresso" max="1" value="0" aria-label="Tempo do ciclo" hidden></progress>
  <div id="mem-fim" hidden><button type="button" class="botao" id="mem-continuar">Continuar estudando</button>
    <button type="button" class="secundario" id="mem-novo">Iniciar novo conjunto</button></div>
  <form id="mem-prazo" hidden>
    <h3 id="mem-form-titulo">Escolher prazo</h3>
    <div class="mem-campos"><label>Prazo em dias <input id="mem-quantidade" type="number" min="1" max="10" step="1" value="3" required></label></div>
    <p>Escolha de 1 a 10 dias. A contagem é por dias de calendário e inclui hoje como o primeiro dia.
      Os mesmos itens ficam com você até o fim. Nada é trocado automaticamente.</p>
    <button class="botao" id="mem-iniciar" type="submit">Iniciar ciclo</button>
    <button class="secundario" id="mem-cancelar" type="button" hidden>Cancelar</button>
  </form>
  <details id="mem-releitura" hidden><summary>Reler o texto deste ciclo</summary><p id="mem-original" lang="de"></p></details>
  <p id="mem-cobertura"></p><div id="mem-pendencias"></div>
  <p id="mem-contagem"></p><div id="mem-itens" tabindex="0" role="region" aria-label="Todos os itens do conjunto"></div>
  <details><summary>Neste aparelho, offline e em outros dispositivos</summary>
    <p id="mem-offline">Preparando verificação do pacote offline…</p>
    ${ctx.armazenamentoHtml || `<p>O ciclo é uma cópia fixa no IndexedDB desta prévia, separada dos Cards pessoais.
      Fechar ou recarregar não apaga o ciclo. Limpar os dados do navegador, mudar de navegador, porta ou aparelho não preserva essa cópia.</p>
    <p>Não há sincronização entre computador e celular nesta prévia. Login e Cards remotos já existem no DL,
      mas não armazenam o ciclo e as regras atuais não autorizam esse novo registro.
      O relógio usa a data deste aparelho; a contagem é por dias de calendário locais e inclui o dia de início,
      avançando a cada meia-noite mesmo com a prévia fechada.</p>`}</details>`;
document.querySelector('#estudo-texto .grade').append(painel);

let ciclo = null, candidato = null, modo = null, ocupado = false, pacote, estado = null, operacao = 0;
let mensagemPrazo = '';
const aviso = mensagem => { $('mem-status').textContent = mensagem; };
function conferirSessao(sessao) {
  if (ctx.sessao && ctx.sessao() !== sessao) throw Error('A conta mudou. Abra Memorizar novamente.');
}
function posicionar() {
  if (!ctx.independente) return;
  const destino = window.DL_TEXTOS?.obterAtivo()
    ? document.querySelector('#estudo-texto .grade') : $('fase-textos');
  destino.append(painel);
}
async function conferirPacote() {
  if (!ctx.verificarOffline) return;
  const sessao = ctx.sessao();
  try {
    const mensagem = await ctx.verificarOffline();
    if (sessao === ctx.sessao()) $('mem-offline').textContent = mensagem;
  } catch (e) {
    if (sessao === ctx.sessao()) $('mem-offline').textContent = 'Offline não confirmado: ' + e.message;
  }
}
async function dados() {
  if (!pacote) pacote = Promise.all(['substantivos', 'verbos', 'adjetivos_adverbios'].map(async nome => {
    const r = await fetch(new URL('../data/' + nome + '.json', import.meta.url));
    if (!r.ok) throw Error('Acervo indisponível: ' + nome + '. Tente novamente com conexão.');
    return r.json();
  })).then(([substantivos, verbos, adverbios]) => ({substantivos, verbos, adverbios}))
    .catch(e => { pacote = null; throw e; });
  return pacote;
}
// Fonte do Card/registro e da revisão: demonstração (padrão) ou produção (ctx).
const obterRegistro = ctx.carregarRegistro || (aberto => window.DL_MEMORIZAR_DEMO.registros.find(r => r.textoId === aberto.id) || null);
const obterRevisao = ctx.revisao || (aberto => window.DL_MEMORIZAR_DEMO.revisao.filter(r => r.textoId === aberto.id));
async function preparar() {
  const sessao = ctx.sessao?.();
  const aberto = window.DL_TEXTOS.obterAtivo();
  if (!aberto) throw Error('Escolha um texto antes de iniciar um conjunto.');
  const registro = await obterRegistro(aberto);
  if (registro) {
    window.DL_CARD_FORMATO.validar(registro.card);
    window.DL_CARD_FORMATO.vincular(registro.card, aberto.conteudo);
  }
  const acervos = await dados();
  conferirSessao(sessao);
  if (window.DL_TEXTOS.obterAtivo()?.id !== aberto.id) throw Error('O texto mudou durante a identificação. Abra Memorizar novamente.');
  return {aberto, identificacao: identificar(aberto, registro, acervos, obterRevisao(aberto))};
}
function linha(destino, rotulo, valor) {
  const p = document.createElement('p'), b = document.createElement('strong');
  b.textContent = rotulo + ': '; p.append(b, document.createTextNode(valor)); destino.append(p);
}
function mostrarItens(identificacao) {
  $('mem-cobertura').textContent = identificacao.cobertura;
  $('mem-pendencias').replaceChildren();
  if (identificacao.pendencias.length) {
    const detalhes = document.createElement('details'), resumo = document.createElement('summary');
    resumo.textContent = 'Informações não comprovadas (' + identificacao.pendencias.length + ')';
    detalhes.append(resumo);
    for (const p of identificacao.pendencias) linha(detalhes, p.palavra, p.motivo);
    $('mem-pendencias').append(detalhes);
  }
  $('mem-itens').replaceChildren();
  const nomes = {substantivos: 'Substantivos', verbos: 'Verbos', adverbios: 'Advérbios'};
  $('mem-contagem').textContent = Object.entries(nomes).map(([g, nome]) => identificacao.itens[g].length + ' ' + nome.toLowerCase()).join(' · ');
  const barra = document.createElement('div'); barra.className = 'mem-grupos';
  barra.setAttribute('role', 'group'); barra.setAttribute('aria-label', 'Categorias do conjunto');
  const conteudo = document.createElement('div'); conteudo.className = 'mem-grupo-conteudo';
  const botoes = {};
  const selecionar = alvo => {
    for (const [g, b] of Object.entries(botoes)) {
      const ativo = g === alvo;
      b.classList.toggle('mem-grupo-ativo', ativo);
      b.setAttribute('aria-expanded', String(ativo));
      $('mem-grupo-' + g).hidden = !ativo;
    }
  };
  for (const [grupo, nome] of Object.entries(nomes)) {
    const total = identificacao.itens[grupo].length;
    const listaId = 'mem-grupo-' + grupo;
    const botaoGrupo = document.createElement('button');
    botaoGrupo.type = 'button'; botaoGrupo.className = 'nav mem-grupo-botao'; botaoGrupo.id = listaId + '-botao';
    botaoGrupo.setAttribute('aria-expanded', 'false'); botaoGrupo.setAttribute('aria-controls', listaId);
    botaoGrupo.textContent = nome + ' (' + total + ')';
    const lista = document.createElement('div');
    lista.id = listaId; lista.className = 'mem-grupo-lista'; lista.hidden = true;
    lista.setAttribute('role', 'region'); lista.setAttribute('aria-label', nome);
    botaoGrupo.onclick = () => selecionar(botaoGrupo.getAttribute('aria-expanded') === 'true' ? null : grupo);
    if (!total) linha(lista, 'Identificação', 'Nenhum item disponível com vínculo seguro.');
    for (const i of identificacao.itens[grupo]) {
      const item = document.createElement('article'), titulo = document.createElement('h4');
      item.className = 'mem-item'; titulo.lang = 'de'; titulo.textContent = i.artigo ? i.artigo + ' ' + i.lema : i.lema;
      item.append(titulo);
      if (grupo === 'substantivos') linha(item, 'Plural', i.plural === '—' ? '— (sem plural neste uso)' : i.plural);
      linha(item, grupo === 'adverbios' ? 'No contexto' : 'Significado', i.significado);
      if (grupo === 'verbos') {
        linha(item, 'Forma no texto', i.forma);
        if (['regular', 'irregular', 'misto'].includes(i.classificacao)) {
          const p = document.createElement('p');
          p.className = 'mem-classificacao'; p.textContent = 'Classificação revisada: ' + i.classificacao;
          item.append(p);
        }
      }
      if (i.nota) linha(item, 'Uso', i.nota);
      lista.append(item);
    }
    botoes[grupo] = botaoGrupo;
    barra.append(botaoGrupo); conteudo.append(lista);
  }
  $('mem-itens').append(barra, conteudo);
}
function tempo() {
  if (!ciclo || modo) return;
  const m = marcador(ciclo);
  $('mem-tempo').textContent = m.texto;
  $('mem-alterar-prazo').hidden = false;
  $('mem-fim').hidden = !m.concluido;
  $('mem-progresso').hidden = false;
  $('mem-progresso').value = m.fracao;
  $('mem-progresso').setAttribute('aria-valuetext', m.texto);
}
function render() {
  $('mem-prazo').hidden = !modo; $('mem-cancelar').hidden = !ciclo;
  $('mem-fim').hidden = true; $('mem-progresso').hidden = true;
  $('mem-alterar-prazo').hidden = !ciclo || !!modo;
  const identificacao = modo && candidato ? candidato.identificacao : ciclo?.identificacao;
  if (identificacao) mostrarItens(identificacao);
  else {
    for (const id of ['mem-itens', 'mem-contagem', 'mem-cobertura', 'mem-pendencias']) $(id).replaceChildren();
  }
  const titulo = modo && candidato ? candidato.aberto.titulo : ciclo?.titulo;
  const ativo = window.DL_TEXTOS?.obterAtivo();
  const mesmoTexto = ativo?.id === ciclo?.textoId && ativo?.conteudo === ciclo?.original;
  $('mem-releitura').hidden = !ciclo || !!modo || mesmoTexto;
  $('mem-original').textContent = ciclo?.original || '';
  $('mem-vinculo').textContent = titulo ? 'Conjunto de: ' + titulo +
    (ciclo && !modo && !mesmoTexto ? (ativo
      ? ' · Atenção: o texto aberto ao lado é outro; este conjunto não foi substituído.'
      : ' · O texto original deste ciclo está disponível em Reler o texto deste ciclo.') : '') : '';
  $('mem-form-titulo').textContent = modo === 'continuar' ? 'Novo prazo para as mesmas palavras' : 'Escolher prazo para este conjunto';
  $('mem-iniciar').textContent = modo === 'continuar' ? 'Iniciar nova contagem' : ciclo ? 'Confirmar novo conjunto' : 'Iniciar ciclo';
  $('mem-tempo').textContent = modo ? (ciclo ? 'O ciclo anterior continua salvo até sua confirmação.' : 'Conjunto para conferência · ainda não salvo') : '';
  tempo();
  atualizarControles();
}
function atualizarControles() {
  for (const b of painel.querySelectorAll('button,input,select')) b.disabled = ocupado;
  const offline = ctx.independente && !navigator.onLine;
  const mensagem = $('mem-aviso-prazo');
  mensagem.textContent = offline ? (ciclo
    ? 'Para alterar o prazo, conecte-se à internet. Seu prazo foi mantido.'
    : 'Para iniciar um ciclo, conecte-se à internet.') : mensagemPrazo;
  mensagem.hidden = !mensagem.textContent;
  if (offline) {
    $('mem-quantidade').disabled = true;
    $('mem-iniciar').disabled = true;
  }
}
function restaurarCiclo() {
  modo = null; candidato = null;
  $('mem-quantidade').value = String(ciclo ? Math.min(10, diasDoPrazo(ciclo.quantidade, ciclo.unidade)) : 3);
  render();
}
function recusarOffline() {
  if (!ctx.independente || navigator.onLine) return false;
  mensagemPrazo = '';
  restaurarCiclo();
  const mensagem = $('mem-aviso-prazo');
  aviso(mensagem.textContent);
  destacarAvisoPrazo();
  return true;
}
function destacarAvisoPrazo() {
  const mensagem = $('mem-aviso-prazo');
  mensagem.scrollIntoView({block: 'center'});
  mensagem.focus({preventScroll: true});
}
async function executar(fn) {
  if (ocupado) return;
  const rodada = ++operacao, sessao = ctx.sessao?.();
  const atual = () => rodada === operacao && (!ctx.sessao || sessao === ctx.sessao());
  let destacarErro = false;
  ocupado = true;
  for (const b of painel.querySelectorAll('button,input,select')) b.disabled = true;
  try { await fn(); } catch (e) {
    if (atual()) {
      let mensagem = e.message;
      const conflito = ctx.independente && e.code === 'memorizar/conflito';
      if (conflito) {
        try {
          const recente = await carregarCiclo();
          if (!atual()) return;
          if (recente.origem !== 'servidor') {
            throw Error('O servidor não confirmou a leitura. A cópia local pode estar desatualizada. ' + recente.aviso);
          }
          estado = recente; ciclo = recente.ciclo;
          mensagem = (ciclo
            ? 'O ciclo mudou em outro aparelho. Sua alteração não foi salva. A versão mais recente foi carregada.'
            : 'O ciclo foi removido em outro aparelho. Sua alteração não foi salva. Reabra Memorizar para conferir a conta.') +
            (estado.aviso ? ' ' + estado.aviso : '');
        } catch (erroLeitura) {
          if (!atual()) return;
          mensagem = 'O ciclo mudou em outro aparelho. Sua alteração não foi salva. Não foi possível carregar a versão mais recente. Reabra Memorizar com internet. ' + erroLeitura.message;
        }
      }
      if (ctx.independente && (modo || conflito)) {
        mensagemPrazo = mensagem;
        restaurarCiclo();
        destacarErro = true;
      }
      aviso(mensagem);
    }
  }
  finally {
    if (rodada === operacao) {
      ocupado = false;
      atualizarControles();
      if (destacarErro) destacarAvisoPrazo();
    }
  }
}
botao.onclick = () => executar(async () => {
  if (!painel.hidden) { fechar(); return; }
  if (!ctx.independente && !window.DL_TEXTOS.obterAtivo()) {
    $('textos-status').textContent = 'Escolha um texto para abrir Memorizar.'; return;
  }
  posicionar();
  painel.hidden = false; document.body.classList.add('memorizando'); botao.setAttribute('aria-expanded', 'true');
  ciclo = candidato = modo = estado = null;
  mensagemPrazo = '';
  $('mem-prazo').hidden = true; $('mem-fim').hidden = true; $('mem-progresso').hidden = true;
  $('mem-releitura').hidden = true; $('mem-alterar-prazo').hidden = true;
  for (const id of ['mem-itens', 'mem-contagem', 'mem-vinculo', 'mem-tempo', 'mem-original', 'mem-cobertura', 'mem-pendencias', 'mem-aviso-prazo']) $(id).replaceChildren();
  if (ctx.independente) $('mem-offline').replaceChildren();
  $('memorizar-titulo').focus(); aviso(ctx.msgLendo || 'Lendo ciclo local…');
  const sessao = ctx.sessao?.(), lido = await carregarCiclo();
  conferirSessao(sessao);
  estado = ctx.independente ? lido : null;
  ciclo = ctx.independente ? lido.ciclo : lido;
  if (!ciclo && ctx.independente && !window.DL_TEXTOS?.obterAtivo()) {
    render(); aviso('Nenhum ciclo na conta. Escolha um texto com Card para iniciar um conjunto. ' + estado.aviso);
  } else {
    const preparado = ciclo ? null : await preparar();
    conferirSessao(sessao);
    modo = ciclo ? null : 'novo'; candidato = preparado;
    render();
    aviso(ciclo ? (estado ? (estado.origem === 'local'
      ? 'Ciclo recuperado da cópia local deste aparelho. Pode estar desatualizado; reabra com conexão para conferir a conta.'
      : 'Ciclo carregado da sua conta.') + (estado.aviso ? ' ' + estado.aviso : '')
      : 'Ciclo restaurado neste navegador. Sem sincronização com outros aparelhos.')
      : 'Confira os itens e escolha seu prazo.' + (estado?.aviso ? ' ' + estado.aviso : ''));
  }
  conferirPacote();
});
function fechar() {
  painel.hidden = true; document.body.classList.remove('memorizando');
  botao.setAttribute('aria-expanded', 'false'); botao.focus();
}
$('mem-fechar').onclick = fechar;
function escolherPrazo() {
  if (recusarOffline()) return;
  mensagemPrazo = '';
  modo = 'continuar'; candidato = null;
  $('mem-quantidade').value = String(Math.min(10, diasDoPrazo(ciclo.quantidade, ciclo.unidade)));
  render(); aviso('Escolha de 1 a 10 dias e confirme. O ciclo atual e seus itens ficam salvos até você confirmar.');
  $('mem-quantidade').focus();
}
$('mem-continuar').onclick = escolherPrazo;
$('mem-alterar-prazo').onclick = escolherPrazo;
$('mem-novo').onclick = () => executar(async () => {
  if (recusarOffline()) return;
  mensagemPrazo = '';
  candidato = await preparar(); modo = 'novo'; render(); aviso('Confira o texto e os itens. O conjunto anterior só será substituído ao confirmar.');
  $('mem-quantidade').focus();
});
$('mem-cancelar').onclick = () => { modo = null; candidato = null; mensagemPrazo = ''; render(); aviso('O ciclo anterior foi mantido.'); };
$('mem-prazo').onsubmit = e => {
  e.preventDefault();
  if (recusarOffline()) return;
  executar(async () => {
    const quantidade = Number($('mem-quantidade').value), unidade = 'dias';
    if (modo === 'novo' && window.DL_TEXTOS.obterAtivo()?.id !== candidato?.aberto.id) throw Error('O texto mudou. Feche e abra Memorizar antes de iniciar.');
    const novo = modo === 'continuar' ? continuarCiclo(ciclo, quantidade, unidade)
      : criarCiclo(candidato.aberto, candidato.identificacao, quantidade, unidade);
    const sessao = ctx.sessao?.();
    const salvo = await salvarCiclo(novo, ctx.independente ? estado : ciclo);
    conferirSessao(sessao);
    if (ctx.independente) estado = salvo;
    ciclo = novo; modo = null; candidato = null; mensagemPrazo = ''; render();
    aviso((ctx.msgSalvo || 'Ciclo salvo neste navegador. Os itens ficam fixos; não há sincronização entre dispositivos.') +
      (estado?.aviso ? ' ' + estado.aviso : ''));
    conferirPacote();
    $('mem-status').focus();
  });
};
window.addEventListener('dl-texto-alterado', () => {
  if (!painel.hidden) {
    if (ctx.independente && ciclo) { modo = null; candidato = null; posicionar(); render(); }
    else if (!window.DL_TEXTOS.obterAtivo()) fechar();
    else { modo = null; candidato = null; render(); }
  }
});
if (ctx.independente) {
  function limparConta() {
    operacao++; ocupado = false; ciclo = candidato = modo = estado = null;
    mensagemPrazo = '';
    painel.hidden = true; document.body.classList.remove('memorizando');
    botao.setAttribute('aria-expanded', 'false'); botao.disabled = !ctx.contaPronta();
    for (const id of ['mem-status', 'mem-itens', 'mem-contagem', 'mem-vinculo', 'mem-tempo', 'mem-original', 'mem-offline', 'mem-cobertura', 'mem-pendencias', 'mem-aviso-prazo']) $(id).replaceChildren();
    atualizarControles();
    $('mem-quantidade').value = '3';
  }
  window.addEventListener('dl-memorizar-conta', limparConta);
  window.addEventListener('dl-memorizar-erro', e => { $('auth-erro').textContent = 'Memorizar: ' + e.detail; });
  window.addEventListener('offline', () => {
    if (!painel.hidden) recusarOffline();
    atualizarControles();
  });
  window.addEventListener('online', () => {
    atualizarControles();
    if (!painel.hidden) aviso('Conexão restabelecida. Reabra Memorizar para conferir a conta. Nenhuma alteração foi enviada automaticamente.');
  });
  limparConta();
}
document.addEventListener('visibilitychange', tempo);
setInterval(tempo, 30000);
async function verificarOffline() {
  if (!navigator.serviceWorker) throw Error('Este navegador não oferece service worker. O uso offline não está disponível.');
  let espera;
  const registro = await Promise.race([navigator.serviceWorker.ready, new Promise((resolve, reject) => {
    espera = setTimeout(() => reject(Error('Pacote offline ainda não confirmado. Reabra com conexão.')), 10000);
  })]).finally(() => clearTimeout(espera));
  const canal = new MessageChannel();
  const resultado = new Promise((resolve, reject) => {
    const limite = setTimeout(() => reject(Error('Sem confirmação do pacote offline. Reabra com conexão.')), 10000);
    canal.port1.onmessage = e => { clearTimeout(limite); canal.port1.close(); resolve(e.data); };
  });
  registro.active.postMessage({tipo: 'conferir-memorizar'}, [canal.port2]);
  const pronto = await resultado;
  $('mem-offline').textContent = pronto.ok ? 'Pacote de demonstração conferido para uso sem internet neste navegador. Nenhum dado pessoal foi incluído.'
    : 'Pacote offline incompleto. Abra novamente com conexão antes de depender do uso sem internet.';
}
if (!ctx.independente) verificarOffline().catch(e => { $('mem-offline').textContent = 'Offline não confirmado: ' + e.message; });
