// SDK Auth sem connectAuthEmulator; rede externa interceptada, perfil e SW reais.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const http = require('node:http'), assert = require('node:assert/strict');
const {spawn, execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..'), UID = 'sessao-offline-fixture';
const published = process.argv.includes('--publicado');
const expired = process.argv.includes('--expirado');
const local = process.argv.includes('--local-storage');
const ios = process.argv.includes('--ios');
const delayed = process.argv.includes('--rede-pendente');
const upgrade = process.argv.includes('--atualizar-06');
const focused = process.argv.includes('--textos-locais');
const ref = 'c0f2e3d6872f8fb34a82514f41d6c3f1473c3f6c';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-sessao-offline-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pending = new Map(), blobs = new Map(), external = [];
let child, ws, sequence = 0, base, checks = 0, offline = false, legacy = published || upgrade;
let holdRestore = false;
let closing = false;
const heldRestore = new Set();
const check = (v, label) => {assert(v, label); checks++; console.log('PASS ' + label);};
function source(file) {
  if (!legacy) return fs.readFileSync(path.join(root, 'webapp', file));
  if (!blobs.has(file)) {const e = Error('Arquivo fora do commit: ' + file); e.code = 'ENOENT'; throw e;}
  return blobs.get(file);
}
function loadPublished() {
  const files = execFileSync('git', ['-C', root, 'ls-tree', '-r', '--name-only', ref, '--', 'webapp'],
    {encoding: 'utf8'}).trim().split('\n');
  const bytes = execFileSync('git', ['-C', root, 'cat-file', '--batch'],
    {input: files.map(f => ref + ':' + f).join('\n') + '\n', maxBuffer: 32 * 1024 * 1024});
  let offset = 0;
  for (const file of files) {
    const end = bytes.indexOf(10, offset), header = bytes.subarray(offset, end).toString();
    assert(/^[0-9a-f]{40} blob \d+$/.test(header), 'Blob publicado invalido: ' + file);
    const size = Number(header.split(' ')[2]);
    blobs.set(file.slice(7), bytes.subarray(end + 1, end + 1 + size));
    offset = end + size + 2;
  }
}
const server = http.createServer((req, res) => {
  const file = new URL(req.url, base).pathname.slice(1) || 'index.html';
  const name = file.endsWith('/') ? file + 'index.html' : file;
  if (name.includes('..')) {res.writeHead(403); res.end(); return;}
  try {
    let body = source(name);
    if (name === 'textos.js') body = body.toString().replace(/const UID = "[^"]+"/, `const UID = "${UID}"`);
    if (focused && name === 'cards/cards.js') body = body.toString() + '\nwindow.DL_TEST_SHELL = shell;\n';
    res.setHeader('Content-Type', ({'.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
      '.json': 'application/json', '.webmanifest': 'application/manifest+json'})[path.extname(name)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(body);
  } catch (e) {
    if (e.code !== 'ENOENT' && e.status !== 128) console.error(e);
    res.writeHead(404); res.end();
  }
});
function token() {
  const now = Math.floor(Date.now() / 1000), enc = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  return enc({alg: 'none'}) + '.' + enc({sub: UID, user_id: UID, iat: now, exp: now + 3600,
    aud: 'demo-offline', iss: 'https://securetoken.google.com/demo-offline',
    auth_time: now, firebase: {sign_in_provider: 'google.com'}}) + '.';
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => {pending.delete(id); reject(Error('CDP timeout ' + method));}, 20000);
    pending.set(id, {resolve: v => {clearTimeout(timer); resolve(v);}, reject: e => {clearTimeout(timer); reject(e);}});
    ws.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function until(expression, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {if (await evaluate(expression)) return; await sleep(100);}
  throw Error('Tempo esgotado: ' + label);
}
async function intercept({requestId, request}) {
  if (request.url.startsWith(base + '/')) return send('Fetch.continueRequest', {requestId});
  external.push({url: request.url.split('?')[0], offline});
  if (offline && holdRestore && /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//.test(request.url)) {
    heldRestore.add(requestId); return;
  }
  // Modela uma falha de transporte ainda pendente, sem inventar usuario no app.
  if (offline && delayed && request.url.startsWith('https://apis.google.com/')) return;
  if (offline) return send('Fetch.failRequest', {requestId, errorReason: 'InternetDisconnected'});
  if (request.method === 'OPTIONS') return send('Fetch.fulfillRequest', {requestId, responseCode: 204,
    responseHeaders: [{name: 'Access-Control-Allow-Origin', value: '*'},
      {name: 'Access-Control-Allow-Methods', value: 'POST, GET, OPTIONS'},
      {name: 'Access-Control-Allow-Headers', value: '*'}]});
  const provider = {providerId: 'google.com', federatedId: 'fixture-google', rawId: 'fixture-google'};
  let body;
  if (request.url.includes('accounts:signInWithIdp')) {
    body = {localId: UID, idToken: token(), refreshToken: 'fixture-refresh', expiresIn: '3600',
      providerId: 'google.com', emailVerified: true};
  } else if (request.url.includes('accounts:lookup')) {
    body = {users: [{localId: UID, emailVerified: true, providerUserInfo: [provider]}]};
  } else if (request.url.includes('securetoken.googleapis.com')) {
    body = {user_id: UID, id_token: token(), refresh_token: 'fixture-refresh', expires_in: '3600'};
  } else return send('Fetch.failRequest', {requestId, errorReason: 'InternetDisconnected'});
  return send('Fetch.fulfillRequest', {requestId, responseCode: 200,
    responseHeaders: [{name: 'Content-Type', value: 'application/json'}, {name: 'Access-Control-Allow-Origin', value: '*'}],
    body: Buffer.from(JSON.stringify(body)).toString('base64')});
}
async function start(url, coldOffline = false, mobile = false) {
  closing = false;
  offline = coldOffline;
  const portFile = path.join(profile, 'DevToolsActivePort');
  if (fs.existsSync(portFile)) fs.unlinkSync(portFile);
  child = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ['--headless=new', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0',
      '--user-data-dir=' + profile, 'about:blank'], {windowsHide: true, stdio: 'ignore'});
  let launchError; child.on('error', e => {launchError = e;});
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    if (launchError || child.exitCode !== null) throw Error('Chrome nao iniciou.');
    try {
      const contents = fs.readFileSync(portFile, 'utf8');
      if (/^\d+\r?\n/.test(contents)) port = Number(contents.split('\n')[0]);
    } catch (e) {
      if (!['ENOENT', 'EBUSY'].includes(e.code)) throw e;
    }
    if (port) break;
    await sleep(100);
  }
  assert(port, 'Porta CDP nao ficou pronta.');
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {ws.addEventListener('open', resolve, {once: true}); ws.addEventListener('error', reject, {once: true});});
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data), p = pending.get(m.id);
    if (p) {pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);}
    if (m.method === 'Fetch.requestPaused' && !closing) intercept(m.params).catch(e => {
      if (e.name !== 'AbortError') {console.error(e); process.exitCode = 1;}
    });
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', {patterns: [{urlPattern: 'http*'}]});
  if (mobile) {
    const ua = ios
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
    await send('Network.setUserAgentOverride', {userAgent: ua});
    await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  }
  await send('Network.emulateNetworkConditions', {offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
  await send('Page.navigate', {url});
  await until(`location.href===${JSON.stringify(url)} && document.readyState!=='loading'`, 'documento');
}
async function stop() {
  if (!child) return;
  closing = true;
  if (ws?.readyState === WebSocket.OPEN) {
    try {await send('Browser.close');} catch (e) {if (child.exitCode === null) console.error(e.message);}
    ws.close();
  }
  if (child.exitCode === null) await Promise.race([new Promise(r => child.once('exit', r)), sleep(2000)]);
  if (child.exitCode === null) {child.kill(); await new Promise(r => child.once('exit', r));}
  child = null;
}
const database = `(name,store)=>new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(store,name==='dl-cards-local-v1'?{keyPath:['uid','textoId']}:undefined);
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})`;
async function snapshot() {
  return evaluate(`(async()=>{const open=${database}, read=async(name,store)=>{const db=await open(name,store);
    try{return await new Promise((resolve,reject)=>{const t=db.transaction(store),r=t.objectStore(store).getAll();
      t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error)})}finally{db.close()}};
    const persisted=(await read('firebaseLocalStorageDb','firebaseLocalStorage')).find(r=>r.fbase_key.startsWith('firebase:authUser:'))?.value
      || JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('firebase:authUser:'))) || 'null');
    const authDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(persisted)))),
      n=>n.toString(16).padStart(2,'0')).join('');
    return {authDigest,cards:await read('dl-cards-local-v1','cards'),memo:await read('dl-memorizar-nuvem-v1','ciclos'),
      sentinel:localStorage.getItem('dl-session-sentinel')};})()`);
}
async function validarTextosLocais(before) {
  await until(`window.DL_AUTH?.usuario?.uid==='${UID}' && !document.getElementById('nav-memorizar')?.disabled`, 'sessao restaurada para leitura local');
  await evaluate(`document.getElementById('escolher-textos').click()`);
  await until(`document.querySelectorAll('#escolha-lista .escolha-linha').length===3
    && document.getElementById('escolha-status').textContent.includes('cópias locais desta conta')`, 'lista offline da conta');
  check(await evaluate(`!document.getElementById('escolha-lista').textContent.includes('Outra conta')
    && !!document.querySelector('[data-texto-id="texto-card"]')
    && !!document.querySelector('[data-texto-id="texto-local"]')`), 'lista somente os originais locais dos Cards e do ciclo do UID restaurado');
  check(await evaluate(`document.querySelector('[data-texto-id="texto-sem-original"] .escolha-abrir').disabled
    && document.querySelector('[data-texto-id="texto-sem-original"]').textContent.includes('indisponível offline')`),
    'texto conhecido sem original recebe indicacao explicita e nao pode abrir offline');
  check(await evaluate(`document.getElementById('escolha-adicionar').disabled
    && [...document.querySelectorAll('.escolha-excluir')].every(b=>b.disabled)
    && document.querySelector('#seletor-texto option[value="adicionar"]').disabled
    && document.querySelector('#seletor-texto option[value="texto-sem-original"]').disabled`),
    'escolha e seletor offline nao oferecem adicionar, excluir ou abrir original ausente');
  await evaluate(`document.querySelector('[data-texto-id="texto-card"] .escolha-abrir').click()`);
  await until(`document.getElementById('original-texto').textContent==='Der Hund.' && !document.getElementById('estudo-texto').hidden`, 'original dos Cards');
  check(true, 'abre original ja disponibilizado nos Cards sem rede');
  await evaluate(`document.getElementById('escolher-textos').click()`);
  await until(`!!document.querySelector('[data-texto-id="texto-local"] .escolha-abrir:not(:disabled)')`, 'original do ciclo na escolha');
  await evaluate(`document.querySelector('[data-texto-id="texto-local"] .escolha-abrir').click()`);
  await until(`document.getElementById('original-texto').textContent==='Die Katze.'`, 'original do ciclo');
  check(true, 'abre o original que existe somente no ciclo local, sem criar outro ciclo');
  check(await evaluate(`Promise.all(['texto-ausente','texto-sem-original','texto-outra-conta'].map(id=>
    window.DL_DADOS.carregarTexto(id,'${UID}').then(()=>false,e=>e.code==='textos/indisponivel-offline'))).then(r=>r.every(Boolean))`),
    'IDs ausentes, incompletos ou de outra conta nao retornam conteudo');
  check(await evaluate(`Promise.all([
    window.DL_DADOS.listarTextos('outra-conta').then(()=>false,e=>e.message==='Conta desconectada.'),
    window.DL_DADOS.carregarTexto('texto-card','outra-conta').then(()=>false,e=>e.message==='Conta desconectada.')
  ]).then(r=>r.every(Boolean))`), 'adaptador recusa UID diferente do usuario restaurado pelo SDK');
  await evaluate(`document.getElementById('seletor-texto').add(new Option('Sem copia','texto-ausente'));
    document.getElementById('seletor-texto').value='texto-ausente';
    document.getElementById('seletor-texto').dispatchEvent(new Event('change'))`);
  await until(`document.getElementById('textos-status').textContent.includes('não está disponível na cópia local desta conta')`, 'aviso de copia ausente');
  check(await evaluate(`document.getElementById('original-texto').textContent==='Die Katze.'`),
    'tentativa sem copia informa a falta e preserva o texto aberto');
  await evaluate(`document.getElementById('nav-memorizar').click()`);
  await until(`!document.getElementById('memorizar').hidden && document.getElementById('mem-original').textContent.includes('Die Katze.')`, 'ciclo existente offline');
  check((await snapshot()).memo[0].ciclo.quantidade === 3, 'abre offline o ciclo existente de 3 dias');
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'Auth, ciclo e todos os registros locais permanecem identicos, inclusive os de outro UID');
  console.log('RESULTADO ' + checks + ' PASS; complemento local: versao Cards, textos locais por UID e ciclo existente');
}
async function main() {
  if (legacy) loadPublished();
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port;
  await start(base + '/');
  await until('window.DL_AUTH?.pronta && !!document.getElementById("nav-memorizar")', 'Auth inicial');
  if (!focused) check(await evaluate(`window.DL_AUTH.usuario===null && document.getElementById('nav-memorizar').disabled`),
    'perfil sem sessao nao inventa identidade nem habilita ciclo privado');
  await evaluate(`(async()=>{const sdk=await import('/cards/vendor/firebase-auth.js'),auth=sdk.getAuth();
    ${local ? 'await sdk.setPersistence(auth,sdk.browserLocalPersistence);' : ''}
    await sdk.signInWithCredential(auth,sdk.GoogleAuthProvider.credential('fixture-google-id-token'));})()`);
  await until(`window.DL_AUTH.usuario?.uid==='${UID}' && !document.getElementById('nav-memorizar').disabled`, 'sessao Google SDK');
  if (!focused) check(await evaluate(`import('/cards/vendor/firebase-auth.js').then(s=>s.getAuth().currentUser.providerData[0].providerId==='google.com')`),
    'sessao do SDK com provider Google, sem Auth emulator ou DL_AUTH sintetico');
  await until('navigator.serviceWorker.controller?.state==="activated"', 'SW raiz instalado', 30000);
  await send('Page.navigate', {url: base + '/cards/'});
  await until(`navigator.serviceWorker.controller?.scriptURL.endsWith('/cards/sw.js')`, 'SW Cards instalado', 30000);
  if (focused) {
    await until(`typeof window.DL_TEST_SHELL==='function'`, 'verificador real dos Cards');
    await evaluate(`window.DL_TEST_SHELL()`);
    check(true, 'versao interna dos Cards aceita o shell memorizar-07 real');
  }
  await send('Page.navigate', {url: base + '/'});
  await until(`window.DL_AUTH?.usuario?.uid==='${UID}' && !document.getElementById('nav-memorizar')?.disabled`, 'reabertura online sem login');
  const inicio = Date.now(), ciclo = {versao: 1, textoId: 'texto-local', titulo: 'Ciclo de 3 dias',
    original: 'Die Katze.', identificacao: {itens: {substantivos: [{lema: 'Katze', significado: 'gato'}],
      verbos: [], adverbios: []}, pendencias: [], excluidos: [], cobertura: 'fixture'},
    inicio, fim: inicio + 3 * 86400000, quantidade: 3, unidade: 'dias'};
  await evaluate(`(async()=>{const open=${database}, put=async(name,store,value,key)=>{const db=await open(name,store);
    try{await new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite'),s=t.objectStore(store);
      key===undefined?s.put(value):s.put(value,key);t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}finally{db.close()}};
    await put('dl-memorizar-nuvem-v1','ciclos',{uid:'${UID}',ciclo:${JSON.stringify(ciclo)},conteudo:${JSON.stringify(JSON.stringify(ciclo))}},'${UID}');
    await put('dl-cards-local-v1','cards',{uid:'${UID}',textoId:'${focused ? 'texto-card' : 'texto-local'}',titulo:'Card local',original:'${focused ? 'Der Hund.' : 'Die Katze.'}',card:{fixture:true}});
    ${focused ? `await put('dl-cards-local-v1','cards',{uid:'${UID}',textoId:'texto-sem-original',titulo:'Sem original',card:{fixture:true}});
    await put('dl-cards-local-v1','cards',{uid:'outra-conta',textoId:'texto-outra-conta',titulo:'Outra conta',original:'Nao exibir',card:{fixture:true}});` : ''}
    localStorage.setItem('dl-session-sentinel','preservar');})()`);
  if (upgrade) {
    const saved = await snapshot();
    check(await evaluate(`caches.keys().then(k=>k.includes('deutschleben-v37-memorizar-06'))`), 'perfil com memorizar-06 publicada instalada');
    legacy = false;
    await send('Page.navigate', {url: base + '/'});
    await until(`window.DL_AUTH?.usuario?.uid==='${UID}' && !document.getElementById('nav-memorizar')?.disabled`, 'novo grafo sob SW 06');
    check(JSON.stringify(await snapshot()) === JSON.stringify(saved), 'primeiro carregamento da correcao preserva Auth e ciclo da 06');
    await evaluate(`navigator.serviceWorker.getRegistration('/').then(r=>r.update())`);
    await until(`caches.keys().then(k=>k.includes('deutschleben-v39-estudo-11')&&!k.includes('deutschleben-v37-memorizar-06'))`, 'SW raiz novo', 30000);
    await send('Page.navigate', {url: base + '/cards/'});
    await until(`document.getElementById('auth')?.textContent==='Sair'`, 'Cards atualizado');
    await evaluate(`navigator.serviceWorker.getRegistration('/cards/').then(r=>r.update())`);
    await send('Page.navigate', {url: base + '/'});
    await until(`window.DL_AUTH?.usuario?.uid==='${UID}'`, 'sessao apos atualizacao');
    check(JSON.stringify(await snapshot()) === JSON.stringify(saved), 'atualizacao desde c0f2e3d preserva ciclo de 3 dias e sessao');
  }
  if (expired) {
    await evaluate(`(async()=>{const sdk=await import('/cards/vendor/firebase-auth.js'),auth=sdk.getAuth();
      const user=auth.currentUser.toJSON();user.stsTokenManager.expirationTime=Date.now()-3600000;
      ${local ? `localStorage.setItem('firebase:authUser:'+auth.config.apiKey+':'+auth.name,JSON.stringify(user));`
        : `const db=await (${database})('firebaseLocalStorageDb','firebaseLocalStorage');try{await new Promise((resolve,reject)=>{
          const t=db.transaction('firebaseLocalStorage','readwrite');t.objectStore('firebaseLocalStorage').put({
            fbase_key:'firebase:authUser:'+auth.config.apiKey+':'+auth.name,value:user});t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}finally{db.close()}`}})()`);
  }
  const before = await snapshot();
  await stop();
  const started = Date.now();
  holdRestore = !published && !focused;
  await start(base + '/', true, true);
  if (focused) return validarTextosLocais(before);
  if (published) {
    await sleep(3000);
    const state = await evaluate(`({pronta:window.DL_AUTH?.pronta,uid:window.DL_AUTH?.usuario?.uid,
      disabled:document.getElementById('nav-memorizar')?.disabled,
      gapi:!!document.querySelector('script[src*="apis.google.com"]')})`);
    console.log('REPRODUCAO ' + JSON.stringify(state));
    if (delayed) {
      check(!state.pronta && !state.uid && state.disabled && state.gapi, 'transporte GAPI pendente bloqueia restauracao no resolver mobile');
      await evaluate(`document.getElementById('escolher-textos').click()`);
      check(await evaluate(`document.getElementById('escolha-status').textContent.includes('Entre com a conta Google')`),
        'reproduz convite indevido de login enquanto SDK ainda restaura sessao');
    } else {
      check(state.pronta && state.uid === UID && !state.disabled, 'falha imediata de rede restaura sessao tambem na versao publicada');
    }
    check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'Auth, ciclo e Card locais preservados no controle publicado');
    return;
  }
  for (let i = 0; i < 50 && !heldRestore.size; i++) await sleep(100);
  check(heldRestore.size > 0, 'restauracao exercita REST real do SDK, sem substituir DL_AUTH');
  await evaluate(`document.getElementById('escolher-textos').click()`);
  check(await evaluate(`!window.DL_AUTH.pronta && document.getElementById('escolha-status').textContent.includes('Restaurando')
    && document.getElementById('auth-estado').textContent.includes('Restaurando')`),
    'restauracao pendente nao e anunciada como conta desconectada');
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'restauracao pendente nao limpa credenciais nem dados locais');
  holdRestore = false;
  for (const requestId of heldRestore) await send('Fetch.failRequest', {requestId, errorReason: 'InternetDisconnected'});
  heldRestore.clear();
  await until(`window.DL_AUTH?.usuario?.uid==='${UID}' && !document.getElementById('nav-memorizar')?.disabled`, 'sessao restaurada offline', 8000);
  check(Date.now() - started < 10000, 'sessao restaurada a frio offline sem aguardar timeout de Google iframe');
  check(!await evaluate(`!!document.querySelector('script[src*="apis.google.com"]')`), 'restauracao nao carrega GAPI/iframe de login');
  await evaluate(`document.getElementById('nav-memorizar').click()`);
  await until(`!document.getElementById('memorizar').hidden && document.getElementById('mem-original').textContent.includes('Die Katze.')`, 'ciclo local');
  check(await evaluate(`document.getElementById('mem-tempo').textContent.includes('3')`), 'ciclo local de 3 dias recuperado sem novo login');
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'ciclo, itens, Card e dados locais exatamente preservados');
  await evaluate(`document.getElementById('escolher-textos').click()`);
  await until(`document.getElementById('escolha-status').textContent.includes('cópias locais desta conta')`, 'escolha local');
  check(true, 'Escolher texto lista copias locais sem pedir novo login');
  await stop(); await start(base + '/cards/', true, true);
  await until(`document.body.innerText.includes('Card local')`, 'Cards com a mesma sessao offline');
  check(!await evaluate(`!!document.querySelector('script[src*="apis.google.com"]')`), 'entrada Cards tambem restaura sem GAPI');
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'entrada Cards tambem preserva sessao e ciclo offline');
  console.log('RESULTADO ' + checks + ' PASS; ' + (ios ? 'UA iOS em Chromium' : 'Android emulado') +
    '; ' + (local ? 'localStorage' : 'IndexedDB') + '; token ' + (expired ? 'expirado' : 'valido'));
}
main().catch(e => {console.error(e); process.exitCode = 1;}).finally(async () => {
  await stop();
  await new Promise(r => server.close(r));
  for (const p of pending.values()) {
    const e = Error('Teste encerrado'); e.name = 'AbortError'; p.reject(e);
  }
  // Somente o perfil sintetico criado por este teste.
  fs.rmSync(profile, {recursive: true, force: true, maxRetries: 10, retryDelay: 200});
});
