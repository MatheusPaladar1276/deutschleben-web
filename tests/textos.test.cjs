// Run only against the dedicated local emulator. No production fallback.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), { createRequire } = require('node:module');
const deps = createRequire(path.join(process.env.DL_TEST_DEPS || path.join(os.tmpdir(), 'dl-textos-tests'), 'package.json'));
const { initializeTestEnvironment, assertSucceeds, assertFails } = deps('@firebase/rules-unit-testing');
const sdk = deps('firebase/firestore');
const { JSDOM } = deps('jsdom');
const ROOT = path.resolve(__dirname, '..'), UID = 'WuXcMYo6m3OuQttlk7z22gRjlvn1';
const ID = 'bc6DK46exhYZpk2eBLmJ';
const fixturePath = path.join(os.tmpdir(), 'dl-retomada-fixture.json');
const fixture = fs.existsSync(fixturePath) ? JSON.parse(fs.readFileSync(fixturePath, 'utf8')) :
  { id: ID, titulo: 'Vorstellung', conteudo: 'Mein Name ist Anna. Ich komme aus Österreich.' };
assert.equal(fixture.id, ID); assert.equal(fixture.titulo, 'Vorstellung');
sdk.setLogLevel('silent');
let checks = 0;
async function allow(p) { await assertSucceeds(p); checks++; }
async function deny(p) { await assertFails(p); checks++; }
const validText = () => ({ titulo: 'Test', conteudo: 'Hallo', estado: 'recebido', criadoEm: sdk.serverTimestamp() });
const summary = (extra = {}) => ({ uid: UID, textoId: 'rules-source', conteudo: 'Resumo', criadoEm: sdk.serverTimestamp(), atualizadoEm: sdk.serverTimestamp(), ...extra });
async function rulesTests(env) {
  const db = env.authenticatedContext(UID).firestore();
  const ref = sdk.doc(db, 'textos', 'rules-source');
  await allow(sdk.setDoc(ref, validText()));
  await allow(sdk.getDocFromServer(ref));
  await allow(sdk.getDocsFromServer(sdk.collection(db, 'textos')));
  await deny(sdk.updateDoc(ref, { conteudo: 'Modified original' }));
  // Exclusão com/sem resumo e atomicidade: textos-final.test.cjs.
  for (const bad of [{ conteudo: '' }, { conteudo: 2 }, { titulo: '' }, { titulo: 4 }, { estado: 'other' },
    { criadoEm: sdk.Timestamp.fromMillis(1) }, { extra: true }]) {
    await deny(sdk.setDoc(sdk.doc(db, 'textos', 'invalid'), { ...validText(), ...bad }));
  }
  const sum = sdk.doc(db, 'textos', 'rules-source', 'resumos', UID);
  await allow(sdk.getDocFromServer(sum)); // An absent summary is readable.
  for (const bad of [{ uid: 'other' }, { textoId: 'other' }, { conteudo: '' }, { conteudo: 1 },
    { conteudo: 'x'.repeat(30001) }, { compreensao: 'must not persist' }, { conversa: [] },
    { criadoEm: sdk.Timestamp.fromMillis(1) }, { atualizadoEm: sdk.Timestamp.fromMillis(1) }]) {
    await deny(sdk.setDoc(sum, summary(bad)));
  }
  const missing = summary(); delete missing.uid;
  await deny(sdk.setDoc(sum, missing));
  await deny(sdk.setDoc(sdk.doc(db, 'textos', 'absent', 'resumos', UID), summary({ textoId: 'absent' })));
  await deny(sdk.setDoc(sdk.doc(db, 'textos', 'rules-source', 'resumos', 'other'), summary()));
  await allow(sdk.setDoc(sum, summary()));
  const created = (await sdk.getDocFromServer(sum)).data().criadoEm;
  await allow(sdk.updateDoc(sum, { conteudo: 'Explicit revision', atualizadoEm: sdk.serverTimestamp() }));
  for (const change of [{ criadoEm: sdk.Timestamp.fromMillis(1) }, { uid: 'other' }, { textoId: 'other' },
    { compreensao: 'not allowed' }, { conteudo: '' }, { atualizadoEm: sdk.Timestamp.fromMillis(1) }]) {
    await deny(sdk.updateDoc(sum, { atualizadoEm: sdk.serverTimestamp(), ...change }));
  }
  assert.equal((await sdk.getDocFromServer(sum)).data().criadoEm.toMillis(), created.toMillis());
  await deny(sdk.getDocs(sdk.collection(db, 'textos', 'rules-source', 'resumos')));
  await deny(sdk.deleteDoc(sum));
  await deny(sdk.deleteDoc(ref)); // Não permite deixar o resumo conhecido órfão.
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('unauthorized')]) {
    const other = context.firestore(), t = sdk.doc(other, 'textos', 'rules-source');
    const s = sdk.doc(other, 'textos', 'rules-source', 'resumos', UID);
    await deny(sdk.getDocFromServer(t)); await deny(sdk.getDocsFromServer(sdk.collection(other, 'textos')));
    await deny(sdk.setDoc(sdk.doc(other, 'textos', 'new'), validText()));
    await deny(sdk.updateDoc(t, { conteudo: 'x' })); await deny(sdk.deleteDoc(t));
    await deny(sdk.getDocFromServer(s)); await deny(sdk.setDoc(s, summary()));
    await deny(sdk.updateDoc(s, { conteudo: 'x' })); await deny(sdk.deleteDoc(s));
    await deny(sdk.getDocs(sdk.collection(other, 'textos', 'rules-source', 'resumos')));
    await allow(sdk.getDocFromServer(sdk.doc(other, 'web_caminhadas', '1')));
    await allow(sdk.getDocsFromServer(sdk.collection(other, 'web_caminhadas')));
  }
  await deny(sdk.setDoc(sdk.doc(db, 'web_caminhadas', 'new'), { a: 1 }));
  console.log(`PASS rules: ${checks} permission cases; original immutable, UID restriction, summary schema/link/timestamps, public archive reads.`);
}
const wait = async (predicate, label) => {
  const until = Date.now() + 15000;
  while (!predicate()) { if (Date.now() > until) throw new Error('Timed out: ' + label); await new Promise(r => setTimeout(r, 20)); }
};
async function uiTests(env) {
  const html = fs.readFileSync(path.join(ROOT, 'webapp/index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://ricardo-d6119.web.app/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, $ = id => w.document.getElementById(id), authCallbacks = [];
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  let db = env.authenticatedContext(UID).firestore();
  const auth = { currentUser: { uid: UID } };
  for (const name of ['collection', 'getDocs', 'query', 'orderBy', 'addDoc', 'serverTimestamp', 'doc',
    'getDocFromServer', 'getDocsFromServer', 'runTransaction']) w[name] = sdk[name];
  Object.assign(w, { initializeApp: () => ({}), getFirestore: () => db, getAuth: () => auth,
    limparLocal: async () => {}, removerLocal: async () => {},
    GoogleAuthProvider: class {}, signInWithPopup: async () => {}, signOut: async () => switchAccount(null),
    onAuthStateChanged: (_a, f) => { authCallbacks.push(f); f(auth.currentUser); } });
  const switchAccount = id => {
    auth.currentUser = id ? { uid: id } : null;
    db = (id ? env.authenticatedContext(id) : env.unauthenticatedContext()).firestore();
    authCallbacks.forEach(f => f(auth.currentUser));
  };
  w.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, 'webapp', url), 'utf8')) });
  const firebaseSource = fs.readFileSync(path.join(ROOT, 'webapp/firebase-dados.js'), 'utf8').replace(/^import .*;\r?$/gm, '');
  // Run the adapter in the SDK realm; jsdom objects would otherwise fail SDK plain-object validation.
  const bindings = ['initializeApp', 'getFirestore', 'getAuth', 'GoogleAuthProvider', 'signInWithPopup', 'signOut', 'onAuthStateChanged',
    'collection', 'getDocs', 'query', 'orderBy', 'addDoc', 'serverTimestamp', 'doc', 'getDocFromServer', 'getDocsFromServer', 'runTransaction', 'limparLocal', 'removerLocal'];
  new Function('window', 'Event', ...bindings, firebaseSource)(w, w.Event, ...bindings.map(name => w[name]));
  for (const script of [...w.document.scripts]) if (!script.src && script.textContent.trim()) w.eval(script.textContent);
  w.eval(fs.readFileSync(path.join(ROOT, 'webapp/textos.js'), 'utf8'));
  const input = (id, text) => { $(id).value = text; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
  const choose = async id => {
    $('seletor-texto').value = id; $('seletor-texto').dispatchEvent(new w.Event('change'));
    await wait(() => $('titulo-texto').textContent === (id === ID ? fixture.titulo : 'Second'), 'open text');
    await wait(() => !$('salvar-resumo').disabled, 'summary loaded');
  };
  await wait(() => [...$('seletor-texto').options].some(o => o.value === ID), 'Firebase list');
  assert($('estudo-texto').hidden); assert(!$('abertura-textos').hidden);
  assert(!w.document.querySelector('#seletor-caminhada, #meu-texto-leitor-overlay, .visualizacao'));
  assert($('auth-estado').classList.contains('conectado'));
  // Existing records are consulted without loading a legacy C into the study view.
  w.localStorage.setItem('compreensao_1', JSON.stringify({ texto: 'Legacy saved' }));
  w.abrirProgresso(); assert($('prog-compreensoes-locais').textContent.includes('Legacy saved')); w.fecharProgresso();
  await choose(ID); assert.equal($('original-texto').textContent, fixture.conteudo);
  const before = (await sdk.getDocFromServer(sdk.doc(db, 'textos', ID))).data();
  input('texto-compreensao', 'My understanding\n<not HTML>');
  await choose('second'); input('texto-compreensao', 'Second draft'); await choose(ID);
  assert.equal($('texto-compreensao').value, 'My understanding\n<not HTML>');
  assert(!w.localStorage.getItem('dl:compreensao:' + ID));
  // Selection survives focus loss and contains contextual sentence.
  const node = $('original-texto').firstChild, start = fixture.conteudo.indexOf('Anna');
  const range = w.document.createRange(); range.setStart(node, start); range.setEnd(node, start + 4);
  w.getSelection().removeAllRanges(); w.getSelection().addRange(range);
  w.document.dispatchEvent(new w.Event('selectionchange'));
  let copied = '', opened = '';
  Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied = text; } } });
  w.open = url => { opened = url; };
  w.getSelection().removeAllRanges(); $('consultar-leo').click();
  assert(opened.endsWith('/Anna'));
  $('consultar-sda').click(); await wait(() => copied.includes('Frase de contexto'), 'copy selection');
  assert(copied.includes('Mein Name ist Anna.')); assert(copied.includes(fixture.titulo));
  // Unicode, punctuation and spaces must be encoded in the destination URL.
  const unicodeStart = fixture.conteudo.indexOf('Österreich');
  const unicodeRange = w.document.createRange(); unicodeRange.setStart(node, unicodeStart);
  unicodeRange.setEnd(node, unicodeStart + 'Österreich'.length);
  w.getSelection().removeAllRanges(); w.getSelection().addRange(unicodeRange);
  w.document.dispatchEvent(new w.Event('selectionchange')); $('consultar-leo').click();
  assert(opened.endsWith('/%C3%96sterreich'));
  await choose('second'); await choose(ID); // Reopening clears the prior selection.
  $('consultar-sda').click(); await wait(() => copied.includes('Original:'), 'copy study');
  assert(copied.includes('Te → Ka → Mo → Lo'));
  assert(copied.includes('My understanding\n<not HTML>')); assert(copied.includes(fixture.conteudo));
  Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } });
  $('consultar-sda').click(); await wait(() => !$('copia-manual').hidden, 'manual copy');
  assert($('copia-conteudo').readOnly); assert($('copia-conteudo').value.includes(fixture.conteudo));
  // No save on typing, successful explicit write, revision and error retention.
  const summaryRef = sdk.doc(db, 'textos', ID, 'resumos', UID);
  input('resumo-conteudo', 'Final summary from chat');
  assert.equal((await sdk.getDocFromServer(summaryRef)).exists(), false);
  $('salvar-resumo').click(); await wait(() => $('resumo-status').textContent.includes('sucesso'), 'save summary');
  let data = (await sdk.getDocFromServer(summaryRef)).data();
  assert.equal(data.conteudo, 'Final summary from chat');
  assert.deepEqual(Object.keys(data).sort(), ['uid', 'textoId', 'conteudo', 'criadoEm', 'atualizadoEm'].sort());
  const created = data.criadoEm.toMillis();
  await choose('second'); await choose(ID); assert.equal($('resumo-conteudo').value, 'Final summary from chat');
  input('resumo-conteudo', 'Revised summary'); $('salvar-resumo').click(); await wait(() => $('resumo-status').textContent.includes('sucesso'), 'revision');
  assert.equal((await sdk.getDocFromServer(summaryRef)).data().criadoEm.toMillis(), created);
  // Failed summary reads lock editing until recovery, without overwriting a remote summary.
  const realSummaryRead = w.DL_DADOS.carregarResumo;
  w.DL_DADOS.carregarResumo = async () => { throw Error('offline'); };
  $('seletor-texto').value = 'second'; $('seletor-texto').dispatchEvent(new w.Event('change'));
  await wait(() => !$('reler-resumo').hidden, 'summary read failed');
  assert($('resumo-conteudo').readOnly); assert($('salvar-resumo').disabled);
  w.DL_DADOS.carregarResumo = realSummaryRead; $('reler-resumo').click();
  await wait(() => !$('salvar-resumo').disabled, 'summary read recovered');
  await choose(ID);
  const realSave = w.DL_DADOS.salvarResumo; let failCount = 0;
  w.DL_DADOS.salvarResumo = async () => { failCount++; throw Error('offline'); };
  input('resumo-conteudo', 'Unsaved revision'); $('salvar-resumo').click();
  await wait(() => $('resumo-status').textContent.includes('mantido'), 'save failure');
  assert.equal($('resumo-conteudo').value, 'Unsaved revision'); assert.equal(failCount, 1);
  w.DL_DADOS.salvarResumo = realSave;
  // Auth changes immediately clear visible content and selection, then restore per-user drafts.
  switchAccount('unauthorized'); assert($('estudo-texto').hidden); assert.equal($('original-texto').textContent, '');
  switchAccount(null); assert(!$('auth-estado').classList.contains('conectado'));
  switchAccount(UID); await wait(() => [...$('seletor-texto').options].some(o => o.value === ID), 'list after auth');
  await choose(ID); assert.equal($('texto-compreensao').value, 'My understanding\n<not HTML>');
  assert.equal($('resumo-conteudo').value, 'Unsaved revision');
  assert.deepEqual((await sdk.getDocFromServer(sdk.doc(db, 'textos', ID))).data(), before);
  assert.equal(JSON.parse(w.localStorage.getItem('compreensao_1')).texto, 'Legacy saved');
  // Save succeeds then read fails: retry never creates another text (emulator only).
  $('adicionar-inicial').click(); input('adicionar-titulo', 'Emulator only'); input('adicionar-conteudo', 'Hallo');
  const realCreate = w.DL_DADOS.salvarTexto, realRead = w.DL_DADOS.carregarTexto;
  // A slow old read must not close an Add text form opened afterward.
  let releaseRead;
  w.DL_DADOS.carregarTexto = () => new Promise(resolve => { releaseRead = resolve; });
  $('adicionar-voltar').click();
  $('seletor-texto').value = 'second'; $('seletor-texto').dispatchEvent(new w.Event('change'));
  $('adicionar-inicial').click(); releaseRead({ id: 'second', titulo: 'Second', conteudo: 'Old response' });
  await new Promise(r => setTimeout(r, 40));
  assert($('adicionar-texto-overlay').classList.contains('aberta'));
  assert.equal($('adicionar-conteudo').value, 'Hallo');
  w.DL_DADOS.carregarTexto = realRead;
  let creates = 0;
  w.DL_DADOS.salvarTexto = async (...args) => { creates++; return realCreate(...args); };
  w.DL_DADOS.carregarTexto = async () => { throw Error('offline'); };
  $('form-adicionar-texto').dispatchEvent(new w.Event('submit', { cancelable: true }));
  $('form-adicionar-texto').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(() => !$('adicionar-reabrir').hidden, 'saved but cannot open'); assert.equal(creates, 1);
  assert($('adicionar-status').textContent.includes('foi salvo'));
  w.DL_DADOS.carregarTexto = realRead; $('adicionar-reabrir').click();
  await wait(() => $('titulo-texto').textContent === 'Emulator only', 'retry open'); assert.equal(creates, 1);
  dom.window.close();
  console.log('PASS UI + real emulator SDK: listing, empty opening, original, drafts, UID switch, selection/context, clipboard fallback, explicit summary/revision/error, legacy consultation, duplicate guard and read retry.');
}
(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-dl-textos', firestore: {
    host: '127.0.0.1', port: 8188, rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8') } });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await sdk.setDoc(sdk.doc(db, 'web_caminhadas', '1'), { numero: 1 });
      await sdk.setDoc(sdk.doc(db, 'textos', ID), { titulo: fixture.titulo, conteudo: fixture.conteudo, estado: 'recebido', criadoEm: sdk.Timestamp.fromMillis(1) });
      await sdk.setDoc(sdk.doc(db, 'textos', 'second'), { titulo: 'Second', conteudo: 'Zweiter Text.', estado: 'recebido', criadoEm: sdk.Timestamp.fromMillis(1) });
    });
    if (!process.argv.includes("--ui-only")) await rulesTests(env);
    await uiTests(env);
    console.log('ALL PASS. Only emulator writes; production is never contacted by this suite.');
  } finally { await env.cleanup(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
