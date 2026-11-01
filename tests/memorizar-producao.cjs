// Caminho de produção, SDK real, Auth REST sintético e Firestore emulado.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const http = require('node:http'), assert = require('node:assert/strict');
const {spawn} = require('node:child_process'), {createRequire} = require('node:module');
const deps = createRequire(path.join(process.env.DL_TEST_DEPS || path.join(os.tmpdir(), 'mapc-coleta-web-envio-tests'), 'package.json'));
const {initializeTestEnvironment} = deps('@firebase/rules-unit-testing');
const sdk = deps('firebase/firestore');
sdk.setLogLevel('silent');
const root = path.resolve(__dirname, '..'), PORT = 8806, EMULATOR = 8188;
const webroot = path.resolve(root, process.env.DL_TEST_WEBAPP || 'webapp');
const UID = 'WuXcMYo6m3OuQttlk7z22gRjlvn1', OTHER = 'memorizar-outra-conta-sintetica';
const projectId = 'demo-dl-textos', base = `http://127.0.0.1:${PORT}`;
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-memorizar-producao-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let env, verificacoes = 0;
const check = (v, msg) => { assert(v, msg); verificacoes++; };
const equal = (a, b, msg) => { assert.deepEqual(a, b, msg); verificacoes++; };
const original = 'Die Katze läuft heute.';
const item = (de, pt, extra = {}) => ({de, pt, essencial: true, origem: original, ...extra});
const card = {versao: 1, numero: 1, titulo: 'Card sintético do Memorizar', secoes: {
  duvidas: [item('heute', 'hoje')], blocos: [item('Die Katze', 'O gato')],
  sentencas: [], substantivos: [item('die Katze', 'o gato')],
  verbos: [item('läuft', 'corre', {infinitivo: 'laufen'})],
  adjetivos: [], adverbios: [item('heute', 'hoje')]
}};
const fixtures = new Map([
  ['textos/mem-com-card', {titulo: 'Memorizar sintético com Card', conteudo: original, estado: 'recebido'}],
  ['textos/mem-sem-card', {titulo: 'Memorizar sintético sem Card', conteudo: 'Heute regnet es.', estado: 'recebido'}],
  [`textos/mem-com-card/cards/${UID}`, {uid: UID, textoId: 'mem-com-card', versao: 1, conteudo: JSON.stringify(card)}]
]);
const documentosIniciais = new Map();
function jwt(uid) {
  const enc = x => Buffer.from(JSON.stringify(x)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  return enc({alg: 'none', typ: 'JWT'}) + '.' + enc({
    iss: `https://securetoken.google.com/${projectId}`, aud: projectId, auth_time: now,
    user_id: uid, sub: uid, iat: now, exp: now + 3600, firebase: {sign_in_provider: 'custom'}
  }) + '.';
}
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*'); res.writeHead(204); res.end(); return;
  }
  if (req.method === 'POST' && /accounts:(signInWithCustomToken|lookup)/.test(req.url)) {
    let body = ''; for await (const c of req) body += c;
    const data = JSON.parse(body);
    const uid = data.token || JSON.parse(Buffer.from(data.idToken.split('.')[1], 'base64url')).sub;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data.token
      ? {idToken: jwt(uid), refreshToken: 'sintetico-' + uid, expiresIn: '3600', isNewUser: false}
      : {users: [{localId: uid, email: `${uid}@example.test`, emailVerified: true, providerUserInfo: []}]}));
    return;
  }
  let relative = decodeURIComponent(new URL(req.url, base).pathname).replace(/^\//, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const file = path.resolve(webroot, relative);
  if (!file.startsWith(webroot + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    let b = fs.readFileSync(file);
    if (relative === 'firebase-dados.js') {
      b = b.toString().replace('onAuthStateChanged }', 'onAuthStateChanged, connectAuthEmulator, signInWithCustomToken }')
        .replace('runTransaction }', 'runTransaction, connectFirestoreEmulator }')
        .replace(/ricardo-d6119/g, projectId)
        .replace('db = getFirestore(app);', `db = getFirestore(app); connectFirestoreEmulator(db,'127.0.0.1',${EMULATOR});`)
        .replace('if (app) auth = getAuth(app);', `if(app){auth=getAuth(app);connectAuthEmulator(auth,'${base}',{disableWarnings:true});window.DL_TEST={signIn:u=>signInWithCustomToken(auth,u).then(()=>true)};}`);
    }
    if (relative === 'cards/dados.js') {
      b = b.toString().replace('onAuthStateChanged }', 'onAuthStateChanged, connectAuthEmulator }')
        .replace('deleteDoc }', 'deleteDoc, connectFirestoreEmulator }').replace(/ricardo-d6119/g, projectId)
        .replace('const auth=getAuth(app), db=getFirestore(app);',
          `const auth=getAuth(app), db=getFirestore(app);connectAuthEmulator(auth,'${base}',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',${EMULATOR});`);
    }
    // O adaptador, a entrada, a interface, as regras e o SW não são substituídos.
    const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', `connect-src 'self' http://127.0.0.1:${EMULATOR} ws://127.0.0.1:${EMULATOR};`);
    res.end(b);
  } catch (e) {
    if (e.code !== 'ENOENT') console.error(e);
    res.writeHead(404); res.end();
  }
});
class Navegador {
  constructor(nome, port) {
    this.nome = nome; this.port = port; this.seq = 0; this.pending = new Map();
    this.externo = []; this.bloqueados = new Set(); this.erros = []; this.pausados = []; this.chrome = null;
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq, timer = setTimeout(() => {
        this.pending.delete(id); reject(Error(`${this.nome}: CDP timeout ${method}`));
      }, 45000);
      this.pending.set(id, {resolve: v => {clearTimeout(timer); resolve(v);}, reject: e => {clearTimeout(timer); reject(e);}});
      this.ws.send(JSON.stringify({id, method, params}));
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  async until(expression) {
    for (let i = 0; i < 200; i++) { if (await this.evaluate(expression)) return; await sleep(100); }
    throw Error(`${this.nome}: tempo esgotado: ${expression}\n` + await this.evaluate('document.body.innerText'));
  }
  async start(offline = false) {
    this.chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
        '--remote-debugging-port=' + this.port, '--user-data-dir=' + path.join(out, this.nome), 'about:blank'],
      {windowsHide: true, stdio: 'ignore'});
    let tabs;
    for (let i = 0; i < 80; i++) {
      try { tabs = await (await fetch(`http://127.0.0.1:${this.port}/json`)).json(); if (tabs.some(t => t.type === 'page')) break; } catch {}
      await sleep(100);
    }
    assert(tabs?.some(t => t.type === 'page'), 'Chrome não iniciou');
    this.ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => this.ws.addEventListener('open', resolve, {once: true}));
    this.ws.addEventListener('message', e => {
      const m = JSON.parse(e.data), p = this.pending.get(m.id);
      if (p) { this.pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
      if (m.method === 'Network.requestWillBeSent' && /^https?:/.test(m.params.request.url) &&
          !m.params.request.url.startsWith(base + '/') && !m.params.request.url.startsWith(`http://127.0.0.1:${EMULATOR}/`)) this.externo.push({id: m.params.requestId, url: m.params.request.url});
      if (m.method === 'Network.loadingFailed' && m.params.blockedReason) this.bloqueados.add(m.params.requestId);
      if (m.method === 'Runtime.exceptionThrown') this.erros.push(m.params.exceptionDetails.text);
      if (m.method === 'Fetch.requestPaused') this.pausados.push(m.params.requestId);
    });
    await this.send('Page.enable'); await this.send('Runtime.enable'); await this.send('Network.enable');
    if (this.nome === 'celular') {
      await this.send('Emulation.setDeviceMetricsOverride', {width: 375, height: 667, deviceScaleFactor: 1, mobile: true});
      await this.send('Emulation.setTouchEmulationEnabled', {enabled: true});
    }
    await this.send('Network.setBlockedURLs', {urls: ['https://*', 'http://firestore.googleapis.com/*']});
    await this.offline(offline);
    await this.send('Page.navigate', {url: base + '/'});
    await this.until(`window.DL_AUTH?.pronta && document.getElementById('nav-memorizar')`);
  }
  async offline(v) {
    await this.send('Network.emulateNetworkConditions', {offline: v, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
  }
  async stop() {
    if (!this.chrome) return;
    const child = this.chrome;
    const exited = new Promise(resolve => child.once('exit', resolve));
    try { await Promise.race([this.send('Browser.close'), exited, sleep(3000)]); }
    catch (e) { console.error('Fechamento CDP:', e.message); }
    for (const p of this.pending.values()) p.reject(Error('Chrome encerrado'));
    this.pending.clear();
    this.ws?.close();
    await Promise.race([exited, sleep(3000)]);
    if (child.exitCode === null) child.kill();
    await sleep(300); this.chrome = null;
  }
  async login(uid = UID) {
    await this.evaluate(`window.DL_TEST.signIn(${JSON.stringify(uid)})`);
    await this.until(`window.DL_AUTH.usuario?.uid === ${JSON.stringify(uid)} && !document.getElementById('nav-memorizar').disabled`);
  }
  async click(id) {
    await this.until(`document.getElementById(${JSON.stringify(id)}) && !document.getElementById(${JSON.stringify(id)}).disabled`);
    await this.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  }
  async abrir() {
    await this.click('nav-memorizar');
    await this.until(`!document.getElementById('memorizar').hidden && (!document.getElementById('mem-iniciar').disabled || !navigator.onLine) && !document.getElementById('mem-status').textContent.startsWith('Lendo')`);
  }
  async reabrir() { await this.click('mem-fechar'); await this.abrir(); }
  async texto(id) {
    await this.until(`document.querySelector('#seletor-texto option[value="${id}"]')`);
    await this.evaluate(`document.getElementById('seletor-texto').value=${JSON.stringify(id)};document.getElementById('seletor-texto').dispatchEvent(new Event('change'))`);
    await this.until(`window.DL_TEXTOS.obterAtivo()?.id === ${JSON.stringify(id)}`);
  }
  status() { return this.evaluate(`document.getElementById('mem-status').textContent`); }
  avisoVisivel() {
    return this.evaluate(`(()=>{
      const aviso=document.getElementById('mem-aviso-prazo'),r=aviso.getBoundingClientRect(),s=getComputedStyle(aviso);
      return !aviso.hidden && s.display!=='none' && s.visibility==='visible' && r.height>0 &&
        r.top>=0 && r.bottom<=visualViewport.height && r.left>=0 && r.right<=document.documentElement.clientWidth &&
        aviso.contains(document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2));
    })()`);
  }
  async confirmar(dias) {
    await this.evaluate(`document.getElementById('mem-quantidade').value=${dias}`);
    await this.click('mem-iniciar');
    await this.until(`!document.getElementById('mem-iniciar').disabled`);
  }
  async prazo(dias) {
    await this.click('mem-alterar-prazo');
    if (await this.evaluate(`!document.getElementById('mem-prazo').hidden`)) await this.confirmar(dias);
  }
  espelho() {
    return this.evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('dl-memorizar-nuvem-v1',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('ciclos'),q=t.objectStore('ciclos').get(${JSON.stringify(UID)});t.oncomplete=()=>{d.close();resolve(q.result)};t.onerror=()=>reject(t.error)};r.onerror=()=>reject(r.error)})`);
  }
  keys() {
    return this.evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('dl-memorizar-nuvem-v1',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('ciclos'),q=t.objectStore('ciclos').getAllKeys();t.oncomplete=()=>{d.close();resolve(q.result)};t.onerror=()=>reject(t.error)};r.onerror=()=>reject(r.error)})`);
  }
}
const a = new Navegador('computador', 9496), b = new Navegador('celular', 9497);
async function remoto() {
  let resultado;
  await env.withSecurityRulesDisabled(async ctx => {
    const snap = await sdk.getDoc(sdk.doc(ctx.firestore(), 'memorizar', UID));
    resultado = snap.exists() ? snap.data() : null;
  });
  return resultado;
}
async function cicloRemoto() { return JSON.parse((await remoto()).conteudo); }
const tem = (s, trecho) => s.includes(trecho);
async function main() {
  const formato = require('../webapp/cards/formato.js'); formato.validar(card); formato.vincular(card, original);
  env = await initializeTestEnvironment({projectId, firestore: {host: '127.0.0.1', port: EMULATOR,
    rules: fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8')}});
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const [id, data] of fixtures) {
      const salvo = {...data, criadoEm: sdk.Timestamp.now(),
        ...(id.includes('/cards/') ? {atualizadoEm: sdk.Timestamp.now()} : {})};
      documentosIniciais.set(id, salvo);
      await sdk.setDoc(sdk.doc(db, id), salvo);
    }
  });
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  await a.start(); await a.login();
  await a.abrir();
  check(tem(await a.status(), 'Nenhum ciclo na conta'), 'Abre sem texto e sem ciclo');
  await a.click('mem-fechar'); await a.texto('mem-sem-card'); await a.abrir();
  check(tem(await a.evaluate(`document.getElementById('mem-cobertura').textContent`), 'Sem Card'), 'Texto sem Card não inventa identificação');
  equal(await remoto(), null, 'Consulta sem Card não grava ciclo');
  await a.click('mem-fechar'); await a.texto('mem-com-card'); await a.abrir();
  equal(await a.evaluate(`document.querySelectorAll('.mem-grupos button').length`), 3, 'Três categorias');
  for (const grupo of ['substantivos', 'verbos', 'adverbios']) {
    await a.evaluate(`document.querySelector('button[aria-controls="mem-grupo-${grupo}"]').click()`);
    check(await a.evaluate(`!document.getElementById('mem-grupo-${grupo}').hidden`), 'Troca de categoria ' + grupo);
  }
  equal(await a.evaluate(`['min','max'].map(k=>document.getElementById('mem-quantidade')[k])`), ['1', '10']);
  await a.confirmar(0); equal(await remoto(), null, 'Formulário recusa zero');
  await a.confirmar(11); equal(await remoto(), null, 'Formulário recusa onze');
  await a.confirmar(1);
  check(tem(await a.status(), 'Ciclo salvo na sua conta'), 'Salvamento confirmado');
  const inicial = await cicloRemoto(), itens = inicial.identificacao;
  const criacaoInicial = (await remoto()).criadoEm;
  const itensVisiveis = await a.evaluate(`document.getElementById('mem-itens').textContent`);
  equal(inicial.quantidade, 1); equal(inicial.original, original);
  check(itens.itens.substantivos.length === 1 && itens.itens.verbos.length === 1 && itens.itens.adverbios.length === 1, 'Itens do Card real sintético');
  check(await a.evaluate(`!!document.getElementById('mem-tempo').textContent`), 'Contagem exibida');
  await a.click('mem-alterar-prazo'); await a.click('mem-cancelar');
  equal((await cicloRemoto()).quantidade, 1, 'Cancelar mantém o prazo');
  await a.prazo(3); equal((await cicloRemoto()).identificacao, itens, 'Alterar mantém os itens');
  await a.until(`navigator.serviceWorker.controller`);
  await a.reabrir();
  await a.until(`document.getElementById('mem-offline').textContent.includes('Pacote do app e cópia local')`);
  await b.start(); await b.login(); await b.abrir();
  check(tem(await b.status(), 'Ciclo carregado da sua conta'), 'Segundo perfil lê o servidor');
  equal(await b.evaluate(`document.getElementById('mem-original').textContent`), original);
  await a.click('mem-alterar-prazo');
  await b.prazo(4);
  const salvoNoCelular = await remoto();
  await a.confirmar(2);
  equal(await remoto(), salvoNoCelular, 'Computador com formulario antigo nao sobrescreve os 4 dias do celular');
  equal(await a.espelho(), await b.espelho(), 'Conflito carrega automaticamente a versao de 4 dias no computador');
  const avisoAtualizacao = 'O ciclo mudou em outro aparelho. Sua alteração não foi salva. A versão mais recente foi carregada.';
  equal(await a.status(), avisoAtualizacao, 'Conflito explica recusa e leitura da versao recente');
  equal(await a.evaluate(`document.getElementById('mem-quantidade').value`), '4', 'Rascunho de 2 dias volta aos 4 dias carregados');
  check(await a.evaluate(`document.getElementById('mem-prazo').hidden`), 'Conflito encerra o formulario antigo');
  check(await a.avisoVisivel(), 'Aviso de conflito inteiro visivel junto ao prazo no computador');
  await a.evaluate(`window.dispatchEvent(new Event('dl-texto-alterado'))`);
  equal(await a.evaluate(`document.getElementById('mem-aviso-prazo').textContent`), avisoAtualizacao, 'Renderizacao posterior nao apaga explicacao do conflito');
  check(await a.avisoVisivel(), 'Aviso continua visivel apos atualizacao dos controles');
  await a.reabrir();
  equal(await a.espelho(), await b.espelho(), 'Fechar e reabrir apos conflito mantem o ciclo recente');
  check(await a.evaluate(`document.getElementById('mem-aviso-prazo').hidden && document.getElementById('mem-aviso-prazo').textContent===''`), 'Reabertura remove o aviso de conflito anterior');
  await a.click('mem-alterar-prazo');
  equal(await a.evaluate(`document.getElementById('mem-quantidade').value`), '4', 'Nova edicao usa a base recente, nao o rascunho recusado');
  check(await a.evaluate(`document.getElementById('mem-aviso-prazo').hidden`), 'Nova acao explicita limpa aviso anterior');
  await a.click('mem-cancelar');
  const espelhoAntesDaFalha = await a.espelho();
  const invalido = {...salvoNoCelular, versao: 2, conteudo: 'registro-sintetico-invalido'};
  await env.withSecurityRulesDisabled(async ctx => { await sdk.setDoc(sdk.doc(ctx.firestore(), 'memorizar', UID), invalido); });
  await a.prazo(2);
  equal(await remoto(), invalido, 'Falha ao recarregar nao escreve sobre o registro remoto');
  equal(await a.espelho(), espelhoAntesDaFalha, 'Leitura invalida apos conflito preserva espelho anterior');
  check(await a.avisoVisivel() && tem(await a.status(), 'Não foi possível carregar a versão mais recente'), 'Erro de recarga fica visivel e explicito');
  check(!tem(await a.status(), 'A versão mais recente foi carregada'), 'Falha de recarga nao afirma sucesso');
  await env.withSecurityRulesDisabled(async ctx => { await sdk.setDoc(sdk.doc(ctx.firestore(), 'memorizar', UID), salvoNoCelular); });
  await a.reabrir();
  await env.withSecurityRulesDisabled(async ctx => { await sdk.deleteDoc(sdk.doc(ctx.firestore(), 'memorizar', UID)); });
  await a.prazo(2);
  equal(await remoto(), null, 'Conflito com remocao remota nao recria o ciclo');
  equal(await a.espelho(), espelhoAntesDaFalha, 'Remocao remota nao apaga silenciosamente o espelho');
  check(await a.avisoVisivel() && tem(await a.status(), 'foi removido em outro aparelho'), 'Remocao remota tem aviso proprio visivel');
  check(!tem(await a.status(), 'A versão mais recente foi carregada'), 'Ausencia remota nao promete ciclo carregado');
  await env.withSecurityRulesDisabled(async ctx => { await sdk.setDoc(sdk.doc(ctx.firestore(), 'memorizar', UID), salvoNoCelular); });
  await a.reabrir();
  await a.prazo(3); await b.reabrir();
  await a.prazo(7); await b.prazo(5);
  check(tem(await b.status(), 'mudou em outro aparelho'), 'Alteração obsoleta é recusada');
  equal((await cicloRemoto()).quantidade, 7, 'Conflito não substitui o servidor');
  equal((await b.espelho()).ciclo.quantidade, 7, 'Conflito no celular tambem atualiza o espelho');
  check(await b.avisoVisivel(), 'Aviso de conflito inteiro visivel em 375x667');
  await b.reabrir();
  await b.until(`navigator.serviceWorker.controller`);
  await b.stop();
  await b.start(true);
  equal(await b.evaluate('window.DL_TEXTOS.obterAtivo()'), null, 'Reabertura completa sem texto ativo');
  await b.abrir();
  check(tem(await b.status(), 'recuperado da cópia local'), 'Origem offline explícita após reinício do Chrome');
  equal(await b.evaluate('document.documentElement.clientWidth'), 375, 'Perfil celular usa largura real de 375 pixels CSS');
  check(await b.evaluate(`!!document.getElementById('mem-aviso-prazo') && !document.getElementById('mem-aviso-prazo').hidden && document.getElementById('mem-aviso-prazo').textContent==='Para alterar o prazo, conecte-se à internet. Seu prazo foi mantido.'`), 'Aviso simples aparece offline mesmo quando confirmar esta desabilitado');
  check(await b.evaluate(`document.getElementById('memorizar').getBoundingClientRect().height>0 && !document.getElementById('fase-textos').hidden`), 'Painel visível fora do estudo');
  equal(await b.evaluate(`document.getElementById('mem-original').textContent`), original, 'Original recuperado sem buscar texto');
  equal(await b.evaluate(`document.getElementById('mem-itens').textContent`), itensVisiveis, 'Todos os itens restaurados offline');
  for (const grupo of ['substantivos', 'verbos', 'adverbios']) {
    await b.evaluate(`document.querySelector('button[aria-controls="mem-grupo-${grupo}"]').click()`);
    check(await b.evaluate(`!document.getElementById('mem-grupo-${grupo}').hidden`), 'Categoria funciona offline: ' + grupo);
  }
  await a.prazo(10);
  const espelhoOffline = await b.espelho();
  const toque = await b.evaluate(`(()=>{
    const botao=document.getElementById('mem-alterar-prazo');
    botao.scrollIntoView({block:'end'});
    const r=botao.getBoundingClientRect();
    return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};
  })()`);
  await b.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [toque]});
  await b.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await b.until(`document.activeElement.id==='mem-aviso-prazo'`);
  check(await b.avisoVisivel(), 'Toque offline deixa aviso inteiro visivel na tela de 375x667, sem sobreposicao');
  await b.prazo(4);
  equal(await b.status(), 'Para alterar o prazo, conecte-se à internet. Seu prazo foi mantido.', 'Edição offline apresenta aviso simples');
  equal((await cicloRemoto()).quantidade, 10);
  equal(await b.espelho(), espelhoOffline, 'Tentativa offline nao muda o espelho persistido');
  check(await b.evaluate(`document.getElementById('mem-prazo').hidden`), 'Offline nao deixa formulario parecer salvo');
  for (const dias of [5, 6, 9]) await b.prazo(dias);
  equal(await b.espelho(), espelhoOffline, 'Tentativas repetidas offline nao alteram dados locais');
  equal(await b.evaluate(`document.getElementById('mem-quantidade').value`), String(espelhoOffline.ciclo.quantidade), 'Campo volta ao prazo persistido');
  check(await b.evaluate(`document.getElementById('mem-iniciar').disabled && document.getElementById('mem-quantidade').disabled`), 'Controles de gravacao bloqueados offline');
  const adapterOffline = await b.evaluate(`(async()=>{const n=await import('/memorizar/nuvem.js'),m=await import('/memorizar/modelo.js'),e=await n.carregarCiclo();try{await n.salvarCiclo(m.continuarCiclo(e.ciclo,4,'dias'),e);return {salvou:true}}catch(erro){return {salvou:false,mensagem:erro.message}}})()`);
  check(!adapterOffline.salvou && tem(adapterOffline.mensagem, 'não foi salvo nem colocado em fila'), 'Adaptador recusa gravacao offline mesmo sem a interface');
  await b.stop(); await b.start(true); await b.abrir();
  check(await b.evaluate(`!document.getElementById('mem-aviso-prazo').hidden && document.getElementById('mem-aviso-prazo').textContent==='Para alterar o prazo, conecte-se à internet. Seu prazo foi mantido.'`), 'Reabertura offline conserva explicacao junto aos controles');
  equal(await b.espelho(), espelhoOffline, 'Reinicio completo offline preserva o ciclo apos tentativas');
  equal(await b.evaluate(`document.getElementById('mem-itens').textContent`), itensVisiveis, 'Itens preservados apos tentativas e reinicio offline');
  check(await b.evaluate(`indexedDB.databases().then(d=>!d.some(i=>i.name==='dl-memorizar-demo-v1'))`), 'Nao usa armazenamento da previa como fallback');
  await b.offline(false);
  await b.until(`document.getElementById('mem-status').textContent.includes('Nenhuma alteração foi enviada automaticamente')`);
  check(await b.evaluate(`document.getElementById('mem-aviso-prazo').hidden`), 'Reconexao remove aviso offline desatualizado');
  await sleep(1000);
  equal((await cicloRemoto()).quantidade, 10, 'Reconexão não envia fila silenciosa');
  await b.prazo(4);
  check(tem(await b.status(), 'mudou em outro aparelho'), 'Reconexão recusa base local obsoleta');
  await b.reabrir(); await b.prazo(8); await a.reabrir();
  equal((await cicloRemoto()).quantidade, 8, 'Sincronização de volta ao computador');
  await Promise.all([a.click('mem-alterar-prazo'), b.click('mem-alterar-prazo')]);
  await Promise.all([a.confirmar(6), b.confirmar(9)]);
  const estados = await Promise.all([a.status(), b.status()]);
  equal(estados.filter(s => tem(s, 'Ciclo salvo na sua conta')).length, 1, 'Apenas uma transação concorrente vence');
  equal(estados.filter(s => tem(s, 'mudou em outro aparelho')).length, 1, 'Outra transação avisa conflito: ' + JSON.stringify(estados));
  equal((await cicloRemoto()).identificacao, itens, 'Concorrência preserva itens');
  await a.reabrir();
  await a.evaluate(`window.DL_TEST.put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='ciclos')throw new DOMException('quota sintética','QuotaExceededError');return window.DL_TEST.put.apply(this,args)}`);
  await a.prazo(2);
  check(tem(await a.status(), 'Ciclo salvo na sua conta') && tem(await a.status(), 'cópia local não pôde ser salva'), 'Servidor salvo / espelho falhou não é sucesso silencioso');
  equal((await cicloRemoto()).quantidade, 2, 'Sucesso remoto não é relatado como falha total');
  await a.evaluate('IDBObjectStore.prototype.put=window.DL_TEST.put');
  await a.reabrir();
  await a.evaluate(`window.DL_TEST.open=indexedDB.open.bind(indexedDB);indexedDB.open=function(nome,...args){if(nome!=='dl-memorizar-nuvem-v1')return window.DL_TEST.open(nome,...args);const r={error:new DOMException('armazenamento sintético indisponível','UnknownError')};queueMicrotask(()=>r.onerror?.());return r}`);
  await a.offline(true); await a.reabrir();
  check(tem(await a.status(), 'Não foi possível abrir a cópia local'), 'Falha de leitura local explícita');
  equal(await a.evaluate(`document.getElementById('mem-itens').textContent`), '', 'Não exibe ciclo antigo como recuperado');
  await a.evaluate('indexedDB.open=window.DL_TEST.open'); await a.offline(false); await a.reabrir();
  await a.send('Network.setBlockedURLs', {urls: ['https://*', `http://127.0.0.1:${EMULATOR}/*`]});
  await a.prazo(4);
  check(tem(await a.status(), 'Não foi possível confirmar o salvamento'), 'Falha de transporte não vira sucesso nem fila: ' + await a.status());
  equal((await cicloRemoto()).quantidade, 2, 'Falha de transporte mantém o ciclo remoto');
  await a.reabrir();
  check(tem(await a.status(), 'recuperado da cópia local') && tem(await a.status(), 'servidor não respondeu'),
    'Servidor inacessível com navigator online usa cópia local explicitamente');
  await a.send('Network.setBlockedURLs', {urls: ['https://*']});
  await sleep(1000);
  equal((await cicloRemoto()).quantidade, 2, 'Retorno do transporte não reenvia a alteração');
  await a.reabrir();
  const falhasAntes = a.bloqueados.size;
  await a.send('Network.setBlockedURLs', {urls: ['https://*', `http://127.0.0.1:${EMULATOR}/*`]});
  const confirmacaoInterrompida = a.prazo(4);
  for (let i = 0; i < 100 && a.bloqueados.size === falhasAntes; i++) await sleep(20);
  check(a.bloqueados.size > falhasAntes, 'Transporte da tentativa falhou enquanto navigator ainda dizia online');
  await a.send('Network.setBlockedURLs', {urls: ['https://*']});
  await confirmacaoInterrompida;
  await sleep(1500);
  equal((await cicloRemoto()).quantidade, 2, 'Falha de transporte nao e repetida automaticamente na reconexao');
  check(!tem(await a.status(), 'Ciclo salvo na sua conta'), 'Falha nao vira sucesso tardio sem nova confirmacao');
  check(await a.evaluate(`document.getElementById('mem-prazo').hidden`), 'Falha de transporte restaura visual do ciclo anterior');
  check(await a.evaluate(`(()=>{
    const aviso=document.getElementById('mem-aviso-prazo'),r=aviso.getBoundingClientRect();
    return navigator.onLine && !aviso.hidden && aviso.textContent===document.getElementById('mem-status').textContent &&
      aviso.textContent.includes('Nenhuma alteração foi colocada em fila') && r.height>0 && r.top>=0 && r.bottom<=innerHeight;
  })()`), 'Falha de transporte tambem deixa erro visivel junto ao prazo quando navegador diz online');
  await a.reabrir();
  const espelhoAntesDoRascunho = await a.espelho();
  await a.click('mem-alterar-prazo');
  await a.evaluate(`document.getElementById('mem-quantidade').value='9'`);
  await a.offline(true);
  await a.until(`document.getElementById('mem-prazo').hidden`);
  equal(await a.espelho(), espelhoAntesDoRascunho, 'Queda de rede descarta rascunho aberto sem persistir');
  equal(await a.evaluate(`document.getElementById('mem-quantidade').value`), '2', 'Queda de rede restaura prazo confirmado');
  await a.offline(false); await sleep(1500);
  equal((await cicloRemoto()).quantidade, 2, 'Reconexao apos rascunho descartado nao grava');
  await a.reabrir();
  const espelhoAntesDaQueda = await a.espelho();
  await a.send('Fetch.enable', {patterns: [{urlPattern: `http://127.0.0.1:${EMULATOR}/*:batchGet*`, requestStage: 'Request'}]});
  await a.click('mem-alterar-prazo');
  const confirmacaoPausada = a.confirmar(6);
  for (let i = 0; i < 100 && !a.pausados.length; i++) await sleep(20);
  check(a.pausados.length === 1, 'Leitura da tentativa pausada para simular queda e retorno de rede');
  await a.offline(true);
  await a.until(`!document.getElementById('mem-fechar').disabled`);
  await a.offline(false);
  await a.send('Fetch.disable');
  a.pausados.length = 0;
  await confirmacaoPausada;
  equal((await cicloRemoto()).quantidade, 2, 'Tentativa interrompida nao grava apos reconexao');
  equal(await a.espelho(), espelhoAntesDaQueda, 'Tentativa invalidada pela queda nao altera o espelho');
  check(tem(await a.status(), 'Conexão perdida') || tem(await a.status(), 'Nenhuma alteração foi enviada automaticamente'), 'Queda durante tentativa apresenta aviso explicito apos reconexao');
  await a.reabrir();
  const antesAusencia = await remoto();
  await env.withSecurityRulesDisabled(async ctx => { await sdk.deleteDoc(sdk.doc(ctx.firestore(), 'memorizar', UID)); });
  await a.reabrir();
  check(tem(await a.status(), 'Nenhuma cópia local anterior foi apagada'), 'Ausência remota não apaga silenciosamente a cópia anterior');
  equal(await a.keys(), [UID], 'Espelho preservado quando o registro remoto desaparece');
  await env.withSecurityRulesDisabled(async ctx => { await sdk.setDoc(sdk.doc(ctx.firestore(), 'memorizar', UID), antesAusencia); });
  await a.reabrir();
  await a.click('mem-fechar'); await a.offline(true);
  // Retarda apenas a abertura real do IndexedDB de uma operação já iniciada.
  await a.evaluate(`window.DL_TEST.pausar=true;indexedDB.open=function(...args){const r=window.DL_TEST.open(...args);if(args[0]==='dl-memorizar-nuvem-v1'&&window.DL_TEST.pausar){window.DL_TEST.pausar=false;Object.defineProperty(r,'onsuccess',{set(fn){r.addEventListener('success',e=>{window.DL_TEST.liberar=()=>fn.call(r,e);window.DL_TEST.pausado=true},{once:true})}})}return r}`);
  await a.click('nav-memorizar'); await a.until('window.DL_TEST.pausado');
  await a.offline(false); await a.login(OTHER);
  await a.evaluate('window.DL_TEST.liberar();indexedDB.open=window.DL_TEST.open');
  await a.until(`document.getElementById('memorizar').hidden`);
  equal(await a.evaluate(`document.getElementById('mem-original').textContent+document.getElementById('mem-itens').textContent`), '', 'Resultado atrasado da conta anterior não aparece');
  await a.abrir();
  check(!tem(await a.status(), 'Ciclo carregado') && !tem(await a.status(), 'recuperado'), 'Outra conta não lê ciclo de Ricardo');
  equal(await a.keys(), [], 'Troca de conta remove espelho anterior');
  await a.login(); await a.abrir();
  check(tem(await a.status(), 'Ciclo carregado da sua conta'), 'Conta original restaura do servidor');
  equal((await cicloRemoto()).identificacao, itens);
  const antesTroca = (await remoto()).conteudo;
  await a.send('Fetch.enable', {patterns: [{urlPattern: `http://127.0.0.1:${EMULATOR}/*:batchGet*`, requestStage: 'Request'}]});
  await a.click('mem-alterar-prazo');
  await a.evaluate(`document.getElementById('mem-quantidade').value=4`);
  await a.click('mem-iniciar');
  for (let i = 0; i < 100 && !a.pausados.length; i++) await sleep(100);
  check(a.pausados.length === 1, 'Transação real pausada antes da leitura');
  await a.login(OTHER);
  await a.send('Fetch.continueRequest', {requestId: a.pausados.shift()});
  await a.send('Fetch.disable');
  await sleep(1000);
  equal((await remoto()).conteudo, antesTroca, 'Troca de conta invalida salvamento iniciado na sessão anterior');
  equal(await a.evaluate(`document.getElementById('mem-status').textContent+document.getElementById('mem-original').textContent`), '', 'Salvamento atrasado não reapresenta dados antigos');
  await a.login(); await a.abrir();
  await a.evaluate(`indexedDB.open=function(nome,...args){if(nome!=='dl-memorizar-nuvem-v1')return window.DL_TEST.open(nome,...args);const r={error:new DOMException('falha sintética de limpeza','UnknownError')};queueMicrotask(()=>r.onerror?.());return r}`);
  const erroSaida = await a.evaluate(`window.DL_AUTH.sair().then(()=>'',e=>e.message)`);
  check(tem(erroSaida, 'saída não concluída'), 'Falha de limpeza interrompe logout explicitamente');
  check(await a.evaluate(`document.getElementById('memorizar').hidden && document.getElementById('nav-memorizar').disabled`), 'Falha no logout bloqueia reutilização da sessão');
  equal(await a.evaluate('window.DL_AUTH.usuario?.uid'), UID, 'Falha não simula logout concluído');
  await a.evaluate('indexedDB.open=window.DL_TEST.open;window.DL_AUTH.sair()');
  await a.until('window.DL_AUTH.usuario === null');
  equal(await a.keys(), [], 'Logout concluído remove espelho');
  equal(await a.evaluate(`document.getElementById('mem-original').textContent+document.getElementById('mem-itens').textContent`), '', 'Logout limpa conteúdo do DOM');
  equal((await cicloRemoto()).identificacao, itens, 'Logout não exclui ciclo da conta');
  await b.reabrir();
  check(tem(await b.status(), 'Ciclo carregado da sua conta'), 'Outro perfil mantém acesso');
  equal(await b.keys(), [UID]);
  await b.send('Page.navigate', {url: base + '/cards/'});
  await b.until(`import('./dados.js?v=blocos-15').then(m=>m.uid()===${JSON.stringify(UID)})`);
  await b.offline(true);
  await b.evaluate(`import('./dados.js?v=blocos-15').then(m=>m.sair()).then(()=>true)`);
  await b.until(`import('./dados.js?v=blocos-15').then(m=>m.uid()===null)`);
  equal(await b.keys(), [], 'Logout offline pela página separada dos Cards também remove o espelho do Memorizar');
  equal((await cicloRemoto()).identificacao, itens, 'Logout dos Cards preserva o ciclo remoto');
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const [id, data] of fixtures) {
      const atual = (await sdk.getDoc(sdk.doc(db, id))).data();
      for (const [key, val] of Object.entries(data)) equal(atual[key], val, 'Texto/Card não foi alterado: ' + id + '/' + key);
      equal(atual, documentosIniciais.get(id), 'Documento completo, inclusive datas, preservado: ' + id);
    }
  });
  equal((await remoto()).criadoEm, criacaoInicial, 'Alterações de prazo preservam a criação do ciclo');
  for (const navegador of [a, b]) {
    check(navegador.externo.every(r => /^https:\/\/www\.google\.com\/images\/cleardot\.gif\?/.test(r.url) && navegador.bloqueados.has(r.id)),
      'Nenhum acesso externo: eventual teste de conectividade do SDK foi bloqueado antes do envio');
  }
  equal(a.erros, [], 'Sem exceções não tratadas no computador');
  equal(b.erros, [], 'Sem exceções não tratadas no celular');
  console.log(`Memorizar produção: ${verificacoes} verificações PASS. Dois perfis, SDK real, regras reais, reinício offline e nenhum dado de produção.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  await Promise.all([a.stop(), b.stop()]);
  await env?.cleanup();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(out, {recursive: true, force: true});
});
