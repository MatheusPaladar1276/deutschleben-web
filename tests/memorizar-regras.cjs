// Testes das regras do Firestore para o ciclo do Memorizar (coleção /memorizar/{uid}).
// Roda apenas contra o emulador local dedicado. Sem acesso à produção.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createRequire } = require('node:module');
const deps = createRequire(path.join(process.env.DL_TEST_DEPS || path.join(os.tmpdir(), 'dl-rules', 'deps'), 'package.json'));
const { initializeTestEnvironment, assertSucceeds, assertFails } = deps('@firebase/rules-unit-testing');
const sdk = deps('firebase/firestore');
const ROOT = path.resolve(__dirname, '..'), UID = 'WuXcMYo6m3OuQttlk7z22gRjlvn1';
sdk.setLogLevel('silent');
let checks = 0;
const allow = async p => { await assertSucceeds(p); checks++; };
const deny = async p => { await assertFails(p); checks++; };
const valido = (extra = {}) => ({ uid: UID, versao: 1, conteudo: '{"ciclo":"ok"}',
  criadoEm: sdk.serverTimestamp(), atualizadoEm: sdk.serverTimestamp(), ...extra });

async function regras(env) {
  const db = env.authenticatedContext(UID).firestore();
  const ref = sdk.doc(db, 'memorizar', UID);

  // Criação válida, leitura, atualização e exclusão pela própria conta autorizada.
  await allow(sdk.setDoc(ref, valido()));
  await allow(sdk.getDocFromServer(ref));
  const criado = (await sdk.getDocFromServer(ref)).data().criadoEm;
  await allow(sdk.updateDoc(ref, { conteudo: '{"ciclo":"novo"}', atualizadoEm: sdk.serverTimestamp() }));
  // criadoEm preservado na atualização.
  const depois = (await sdk.getDocFromServer(ref)).data().criadoEm;
  if (depois.toMillis() !== criado.toMillis()) throw new Error('criadoEm mudou na atualização.');

  // Esquema inválido na criação: recusar cada desvio.
  for (const bad of [{ uid: 'other' }, { versao: 2 }, { versao: '1' }, { conteudo: '' }, { conteudo: 7 },
    { conteudo: 'x'.repeat(200001) }, { criadoEm: sdk.Timestamp.fromMillis(1) },
    { atualizadoEm: sdk.Timestamp.fromMillis(1) }, { extra: true }]) {
    await deny(sdk.setDoc(sdk.doc(db, 'memorizar', UID), valido(bad)));
  }
  // Campo obrigatório ausente.
  const semUid = valido(); delete semUid.uid;
  await deny(sdk.setDoc(ref, semUid));

  // Atualização que tenta mexer no criadoEm ou no uid é recusada.
  for (const change of [{ criadoEm: sdk.Timestamp.fromMillis(1) }, { uid: 'other' },
    { atualizadoEm: sdk.Timestamp.fromMillis(1) }, { conteudo: '' }]) {
    await deny(sdk.updateDoc(ref, { atualizadoEm: sdk.serverTimestamp(), ...change }));
  }
  // Listar a coleção é proibido.
  await deny(sdk.getDocs(sdk.collection(db, 'memorizar')));
  await allow(sdk.deleteDoc(ref));

  // Nenhuma outra conta (anônima ou não autorizada) acessa o ciclo de UID nem o próprio.
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('unauthorized')]) {
    const other = context.firestore();
    for (const alvo of [UID, 'unauthorized']) {
      const d = sdk.doc(other, 'memorizar', alvo);
      await deny(sdk.getDocFromServer(d));
      await deny(sdk.setDoc(d, { uid: alvo, versao: 1, conteudo: '{}', criadoEm: sdk.serverTimestamp(), atualizadoEm: sdk.serverTimestamp() }));
      await deny(sdk.updateDoc(d, { atualizadoEm: sdk.serverTimestamp() }));
      await deny(sdk.deleteDoc(d));
    }
    await deny(sdk.getDocs(sdk.collection(other, 'memorizar')));
  }
  console.log(`PASS memorizar rules: ${checks} casos; conta única, esquema, criadoEm imutável, lista negada, isolamento por conta.`);
}

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-dl-memorizar', firestore: {
    host: '127.0.0.1', port: 8188, rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8') } });
  try { await env.clearFirestore(); await regras(env); }
  finally { await env.cleanup(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
