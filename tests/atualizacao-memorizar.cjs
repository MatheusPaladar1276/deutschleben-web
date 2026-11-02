// Atualizacao real de SW, SDK Auth e IndexedDB, somente em localhost.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const http = require('node:http'), assert = require('node:assert/strict');
const {spawn, execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..'), UID = 'uid-atualizacao';
const OLD = '2580f4f7e70fcbbb5a666f639afaa906f42630cb';
const PUBLISHED = 'd886d76b4ca231b22bceed55add7df43b0bfb57a';
const configuredUid = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8')
  .match(/request\.auth\.uid == "([^"]+)"/)[1];
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-atualizacao-memorizar-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let revision = 'old', holdWorkers = true, heldVersion = 'old', base, child, ws, sequence = 0, checks = 0;
const pending = new Map(), blobs = new Map(), network = [];
const results = [];
const check = (value, label) => {assert(value, label); checks++; results.push(label); console.log('PASS ' + label);};
function bytes(file, version = revision) {
  if (version === 'fixed') return fs.readFileSync(path.join(root, file));
  const ref = version === 'old' ? OLD : PUBLISHED, key = ref + ':' + file;
  if (!blobs.has(key)) blobs.set(key, execFileSync('git', ['-C', root, 'show', key], {stdio: ['ignore', 'pipe', 'ignore']}));
  return blobs.get(key);
}
function token(uid) {
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  return enc({alg: 'none', typ: 'JWT'}) + '.' + enc({iss: 'https://securetoken.google.com/demo-dl-textos',
    aud: 'demo-dl-textos', auth_time: now, user_id: uid, sub: uid, iat: now, exp: now + 3600,
    firebase: {sign_in_provider: 'custom'}}) + '.';
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {res.writeHead(204); res.end(); return;}
  if (req.method === 'POST' && /accounts:(signInWithCustomToken|lookup)/.test(req.url)) {
    let body = ''; for await (const part of req) body += part;
    const data = JSON.parse(body);
    const uid = data.token || JSON.parse(Buffer.from(data.idToken.split('.')[1], 'base64url')).sub;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data.token ? {idToken: token(uid), refreshToken: 'fixture-refresh', expiresIn: '3600', isNewUser: false}
      : {users: [{localId: uid, emailVerified: true, providerUserInfo: [], createdAt: '1700000000000', lastLoginAt: '1700000000000'}]}));
    return;
  }
  if (req.method !== 'GET') {res.writeHead(405); res.end(); return;}
  let name = decodeURIComponent(new URL(req.url, base).pathname).slice(1);
  if (!name || name.endsWith('/')) name += 'index.html';
  if (name.includes('..')) {res.writeHead(403); res.end(); return;}
  try {
    const worker = ['sw.js', 'cards/sw.js'].includes(name);
    let body = bytes('webapp/' + name, worker && holdWorkers ? heldVersion : revision);
    if (name === 'firebase-dados.js' || name === 'cards/dados.js' || name === 'textos.js') {
      body = body.toString().replaceAll('ricardo-d6119', 'demo-dl-textos').replaceAll(configuredUid, UID);
    }
    if (name === 'firebase-dados.js') {
      body = body.replace('onAuthStateChanged }', 'onAuthStateChanged, connectAuthEmulator, signInWithCustomToken }')
        .replace('if (app) auth = getAuth(app);',
          `if(app){auth=getAuth(app);connectAuthEmulator(auth,'${base}',{disableWarnings:true});window.DL_TEST={signIn:u=>signInWithCustomToken(auth,u).then(()=>true)}}`);
    }
    if (name === 'cards/dados.js') {
      body = body.replace('onAuthStateChanged }', 'onAuthStateChanged, connectAuthEmulator }')
        .replace('const auth=getAuth(app), db=getFirestore(app);',
          `const auth=getAuth(app), db=getFirestore(app);connectAuthEmulator(auth,'${base}',{disableWarnings:true});`);
    }
    if (name.endsWith('.html')) body = body.toString().replace('<head>', `<head><meta name="test-revision" content="${revision}">`);
    const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png'};
    res.setHeader('Content-Type', mime[path.extname(name)] || 'application/octet-stream');
    res.setHeader('Cache-Control', worker || name.endsWith('.html') ? 'no-store' : 'public,max-age=3600');
    res.end(body);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.status !== 128) console.error('Arquivo local indisponivel: ' + name);
    res.writeHead(404); res.end();
  }
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => {pending.delete(id); reject(Error('CDP timeout ' + method));}, 20000);
    pending.set(id, {resolve: value => {clearTimeout(timer); resolve(value);}, reject: error => {clearTimeout(timer); reject(error);}});
    ws.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression, label) {
  const end = Date.now() + 45000;
  while (Date.now() < end) {if (await evaluate(expression)) return; await sleep(150);}
  throw Error('Tempo esgotado: ' + label + '\n' + await evaluate('document.body.innerText'));
}
async function start(url = base + '/', offline = false) {
  const portFile = path.join(profile, 'DevToolsActivePort');
  if (fs.existsSync(portFile)) fs.unlinkSync(portFile);
  child = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ['--headless=new', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0',
      '--user-data-dir=' + profile, 'about:blank'], {windowsHide: true, stdio: 'ignore'});
  let launchError; child.on('error', error => {launchError = error;});
  for (let i = 0; i < 100 && (!fs.existsSync(portFile) || !child.pid); i++) {
    if (launchError || child.exitCode !== null) throw Error('Chrome nao iniciou.');
    await sleep(100);
  }
  assert(fs.existsSync(portFile), 'CDP indisponivel.');
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {ws.addEventListener('open', resolve, {once: true}); ws.addEventListener('error', reject, {once: true});});
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (request) {pending.delete(message.id); message.error ? request.reject(Error(message.error.message)) : request.resolve(message.result);}
    if (message.method === 'Network.requestWillBeSent' && /^https?:/.test(message.params.request.url) &&
      !message.params.request.url.startsWith(base + '/')) network.push(message.params.request.url.split('?')[0]);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', {urls: ['https://*', 'http://firestore.googleapis.com/*']});
  await send('Network.emulateNetworkConditions', {offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
  await navigate(url);
}
async function stop() {
  if (!child) return;
  if (ws?.readyState === WebSocket.OPEN) {
    try {await send('Browser.close');} catch (error) {if (child.exitCode === null) console.error(error.message);}
    ws.close();
  }
  if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), sleep(2000)]);
  if (child.exitCode === null) child.kill();
  if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), sleep(2000)]);
  assert(child.exitCode !== null, 'Chrome de teste permaneceu aberto.');
  child = null;
}
async function navigate(url) {
  await send('Page.navigate', {url});
  await until(`location.href===${JSON.stringify(url)} && document.readyState==='complete'
    && document.querySelector('meta[name="test-revision"]')?.content===${JSON.stringify(revision)}`, 'documento ' + revision);
}
const database = `(name,store)=>new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(store,name==='dl-cards-local-v1'?{keyPath:['uid','textoId']}:undefined);
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})`;
async function snapshot() {
  return evaluate(`(async()=>{const open=${database};const read=async(name,store)=>{const db=await open(name,store);
    try{return await new Promise((resolve,reject)=>{const t=db.transaction(store),r=t.objectStore(store).getAll();
      t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error)})}finally{db.close()}};
    const auth=await read('firebaseLocalStorageDb','firebaseLocalStorage');
    const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    const publicAsset=await caches.match('/data/DL_Preposicoes_Base_Revisada.json');
    return {uid:window.DL_AUTH?.usuario?.uid,authDigest:await digest(new TextEncoder().encode(JSON.stringify(auth))),
      cards:await read('dl-cards-local-v1','cards'),memo:await read('dl-memorizar-nuvem-v1','ciclos'),
      marker:localStorage.getItem('dl-atualizacao-sentinela'),
      publicDigest:publicAsset?await digest(await publicAsset.arrayBuffer()):null};})()`);
}
async function shell(versao) {
  const end = Date.now() + 45000;
  let ultimo;
  while (Date.now() < end) {
    const result = await evaluate(`new Promise((resolve,reject)=>{const c=new MessageChannel(),timer=setTimeout(()=>reject(Error('Timeout shell')),15000);
      c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();resolve(e.data)};
      navigator.serviceWorker.controller.postMessage('verificar-shell',[c.port2])})`);
    ultimo = result;
    if (!versao || result.versao === versao) return result;
    await sleep(150);
  }
  throw Error('Shell nao ativou a versao esperada: ' + versao + '; ultimo=' + JSON.stringify(ultimo) +
    '; aviso=' + await evaluate(`document.getElementById('recursos-status')?.textContent`));
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  await start();
  await until('window.DL_AUTH?.pronta && !!window.DL_TEST', 'Auth antigo');
  await evaluate(`window.DL_TEST.signIn('${UID}')`);
  await until(`window.DL_AUTH.usuario?.uid==='${UID}'`, 'sessao sintetica');
  await until(`navigator.serviceWorker.controller?.state==='activated'`, 'SW antigo');
  check(await evaluate(`caches.keys().then(k=>k.includes('deutschleben-v34-rg-01-10-v10'))`), 'SW raiz antigo real instalado');
  check(!await evaluate(`caches.match('/cards/offline.js?v=blocos-15').then(r=>r.text()).then(s=>s.includes('export async function isolarMemorizar'))`),
    'cache antigo nao exporta isolarMemorizar');
  await navigate(base + '/cards/');
  await until(`navigator.serviceWorker.controller?.scriptURL.endsWith('/cards/sw.js')`, 'SW Cards antigo');
  check((await shell()).versao === 'rg-previa-01-10-v10', 'shell Cards antigo real instalado');
  await navigate(base + '/');
  await until(`window.DL_AUTH?.usuario?.uid==='${UID}'`, 'sessao antiga reaberta');
  const inicio = Date.now(), ciclo = {versao: 1, textoId: 'texto-local', titulo: 'Ciclo local',
    original: 'Die Katze.', identificacao: {itens: {substantivos: [{lema: 'Katze', significado: 'gato'}],
      verbos: [], adverbios: []}, pendencias: [], excluidos: [], cobertura: 'fixture local'},
    inicio, fim: inicio + 7 * 86400000, quantidade: 7, unidade: 'dias'};
  await evaluate(`(async()=>{const open=${database};const put=async(name,store,value,key)=>{
    const db=await open(name,store);try{await new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');
      key===undefined?t.objectStore(store).put(value):t.objectStore(store).put(value,key);
      t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}finally{db.close()}};
    await put('dl-cards-local-v1','cards',{uid:'${UID}',textoId:'texto-local',titulo:'Card preservado',original:'Die Katze.',card:{fixture:true}});
    await put('dl-memorizar-nuvem-v1','ciclos',{uid:'${UID}',ciclo:${JSON.stringify(ciclo)},conteudo:${JSON.stringify(JSON.stringify(ciclo))}},'${UID}');
    localStorage.setItem('dl-atualizacao-sentinela','preservar');
    await fetch('/data/DL_Preposicoes_Base_Revisada.json').then(r=>caches.open('deutschleben-v34-rg-01-10-v10')
      .then(c=>c.put('/data/DL_Preposicoes_Base_Revisada.json',r)));})()`);
  const before = await snapshot();
  revision = 'published';
  await navigate(base + '/');
  await until(`Array.from(document.querySelectorAll('[role="alert"]')).some(e=>e.textContent.includes("does not provide an export named"))`, 'erro de export na atualizacao');
  const warning = await evaluate(`Array.from(document.querySelectorAll('[role="alert"]')).map(e=>e.textContent).join('\\n')`);
  check(warning.includes('isolarMemorizar'), 'reproduz erro fisico ao atualizar 2580f4f para d886d76');
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'erro reproduzido sem apagar sessao/Card/ciclo');
  if (process.argv.includes('--reproduzir')) return;

  if (process.argv.includes('--sw-publicado')) {
    heldVersion = 'published';
    await evaluate(`navigator.serviceWorker.getRegistration('/').then(r=>r.update())`);
    await until(`caches.keys().then(k=>k.includes('deutschleben-v36-memorizar-05')&&!k.includes('deutschleben-v34-rg-01-10-v10'))`,
      'SW offline-05 real antes da correcao');
    await navigate(base + '/');
    await until(`window.DL_AUTH?.usuario?.uid==='${UID}' && document.getElementById('nav-memorizar')`, 'offline-05 instalada');
    check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'offline-05 ja instalada preserva dados antes da correcao');
    check(await evaluate(`caches.match('/memorizar/nuvem.js').then(r=>r.text()).then(s=>s.includes('offline.js?v=blocos-15'))`),
      'SW publicado conserva grafo antigo nas URLs sem nova versao');
  }
  revision = 'fixed';
  await navigate(base + '/');
  await until(`window.DL_AUTH?.usuario?.uid==='${UID}' && document.getElementById('nav-memorizar')?.disabled===false`, 'fix sob SW antigo');
  check(!await evaluate(`document.body.innerText.includes('does not provide an export named')`), 'grafo corrigido carrega mesmo sob SW antigo');
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'primeira abertura corrigida preserva sessao e dados exatos');
  holdWorkers = false;
  await evaluate(`navigator.serviceWorker.getRegistration('/').then(r=>r.update())`);
  await until(`caches.keys().then(k=>k.includes('deutschleben-v38-memorizar-07')
    &&!k.includes('deutschleben-v34-rg-01-10-v10')&&!k.includes('deutschleben-v36-memorizar-05'))`, 'SW raiz corrigido');
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'ativacao do SW novo preserva IndexedDB e Auth');
  check((await snapshot()).publicDigest === before.publicDigest, 'acervo publico previamente armazenado preservado');
  await navigate(base + '/cards/');
  await until(`navigator.serviceWorker.controller?.scriptURL.endsWith('/cards/sw.js')`, 'Cards corrigido');
  const status = await shell('rg-previa-01-10-v10-memorizar-07');
  check(status.pronto && status.versao === 'rg-previa-01-10-v10-memorizar-07', 'shell Cards versionado completo');
  await navigate(base + '/');
  await until(`window.DL_AUTH?.usuario?.uid==='${UID}' && document.getElementById('nav-memorizar')`, 'root antes de reiniciar');
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'dois SW atualizados preservam dados e sessao');
  await stop(); await start(base + '/', true);
  await until(`window.DL_AUTH?.usuario?.uid==='${UID}' && document.getElementById('nav-memorizar')?.disabled===false`, 'root offline');
  await evaluate(`document.getElementById('nav-memorizar').click()`);
  await until(`!document.getElementById('memorizar').hidden && document.getElementById('mem-status').textContent.includes('local')`, 'ciclo offline');
  check((await snapshot()).memo[0].ciclo.quantidade === 7, 'reabertura offline mantem os 7 dias');
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'reabertura offline preserva Card/ciclo/Auth/localStorage');
  check(await evaluate(`window.DL_MEMORIZAR_CTX.verificarOffline().then(s=>s.startsWith('Pacote do app e cópia local do ciclo encontrados'))`),
    'verificacao offline usa as mesmas URLs versionadas do grafo');
  await navigate(base + '/cards/');
  await until(`document.getElementById('auth')?.textContent==='Sair'`, 'Cards offline com sessao');
  check(await evaluate(`document.getElementById('area').hidden===false`), 'Cards offline abre com sessao preservada');
  check((await shell()).pronto, 'SW Cards encontra todos os recursos offline versionados');
  check(await evaluate(`import('./offline.js?v=memorizar-07').then(m=>typeof m.isolarMemorizar==='function'&&typeof m.operarMemorizar==='function')`),
    'exports novos corretos offline no escopo Cards');
  check(await evaluate(`fetch('./offline.js?v=versao-nao-instalada').then(()=>false,()=>true)`),
    'SW Cards nao devolve modulo de outra versao ao ignorar query');
}
main().catch(error => {console.error(error); process.exitCode = 1;}).finally(async () => {
  await stop();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(profile, {recursive: true, force: true, maxRetries: 3, retryDelay: 500});
  if (process.env.DL_UPDATE_RESULT) fs.writeFileSync(process.env.DL_UPDATE_RESULT,
    JSON.stringify({checks, results, failure: process.exitCode ? true : false,
      environment: 'localhost, SDK Auth real com REST sintetico; ambos os SW reais; mesmo perfil antes/depois; HTTPS bloqueado',
      firestoreBackendUsed: false, publishedWorkerBeforeFix: process.argv.includes('--sw-publicado'),
      externalRequestsBlocked: network.length, updatedAt: new Date().toISOString()}, null, 2) + '\n');
});
