// Persistência de produção do Memorizar: o ciclo fica na conta do DL (Firestore),
// com uma cópia local por conta neste aparelho apenas para releitura offline.
// Reaproveita o app Firebase já iniciado por firebase-dados.js (não cria outro).
import { getApp, getApps, initializeApp } from '../cards/vendor/firebase-app.js';
import { getAuth } from '../cards/vendor/firebase-auth.js';
import { getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp } from '../cards/vendor/firebase-firestore.js';
import { validarCiclo } from './modelo.js';

const config = {
  apiKey: 'AIzaSyDCueo_SJ8gAqU9VT6cMdyxyDhXGSP1ma4',
  authDomain: 'ricardo-d6119.firebaseapp.com',
  projectId: 'ricardo-d6119',
  storageBucket: 'ricardo-d6119.firebasestorage.app',
  messagingSenderId: '436880673471',
  appId: '1:436880673471:web:f4c3f6178fa8aefc75140a',
};
const app = getApps().length ? getApp() : initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

const uidAtual = () => auth.currentUser?.uid || null;
// A conta precisa estar conectada e coincidir com a que a interface enxerga.
function conferir(u) {
  const painel = window.DL_AUTH?.usuario?.uid;
  if (!u || uidAtual() !== u || (painel && painel !== u)) throw Error('Conta desconectada. Entre novamente para usar o Memorizar.');
}
const ref = u => doc(db, 'memorizar', u);

// ---- Cópia local por conta (somente para releitura sem internet) ----
const BANCO = 'dl-memorizar-nuvem-v1';
function abrirEspelho() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('ciclos');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error || Error('Armazenamento local indisponível.'));
  });
}
function operarEspelho(modo, acao) {
  return abrirEspelho().then(db => new Promise((resolve, reject) => {
    const t = db.transaction('ciclos', modo), r = acao(t.objectStore('ciclos'));
    t.oncomplete = () => { db.close(); resolve(r && r.result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  }));
}
// Guarda o ciclo da conta atual e remove qualquer cópia de outra conta.
async function gravarEspelho(u, ciclo) {
  try {
    await operarEspelho('readwrite', s => {
      const chaves = s.getAllKeys();
      chaves.onsuccess = () => {
        for (const k of chaves.result) if (k !== u) s.delete(k);
        if (ciclo) s.put(ciclo, u); else s.delete(u);
      };
      return chaves;
    });
  } catch { /* a cópia local é auxiliar; a fonte é a conta. */ }
}
async function lerEspelho(u) {
  try {
    const bruto = await operarEspelho('readonly', s => s.get(u));
    return bruto === undefined ? null : validarCiclo(bruto);
  } catch { return null; }
}
export async function limparEspelho() {
  try { await operarEspelho('readwrite', s => s.clear()); } catch { /* nada a preservar. */ }
}

// ---- Leitura e gravação do ciclo ----
export async function carregarCiclo() {
  const u = uidAtual();
  conferir(u);
  try {
    const snap = await getDocFromServer(ref(u));
    conferir(u);
    const ciclo = snap.exists() ? validarCiclo(JSON.parse(snap.data().conteudo)) : null;
    await gravarEspelho(u, ciclo);
    return ciclo;
  } catch (e) {
    // Sem internet: reabre a última cópia desta conta neste aparelho.
    if (!navigator.onLine) return lerEspelho(u);
    throw e;
  }
}

// Só substitui o registro remoto se ele ainda for o mesmo que a interface leu.
export async function salvarCiclo(ciclo, anterior) {
  const u = uidAtual();
  conferir(u);
  const valido = validarCiclo(ciclo);
  const conteudo = JSON.stringify(valido);
  const esperado = anterior == null ? null : JSON.stringify(validarCiclo(anterior));
  await runTransaction(db, async tx => {
    const atual = await tx.get(ref(u));
    conferir(u);
    const atualConteudo = atual.exists() ? atual.data().conteudo : null;
    if (atualConteudo !== esperado) throw Error('O ciclo mudou em outro aparelho. Abra o Memorizar novamente antes de confirmar.');
    tx.set(ref(u), {
      uid: u, versao: 1, conteudo,
      criadoEm: atual.exists() ? atual.data().criadoEm : serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  });
  conferir(u);
  await gravarEspelho(u, valido);
}

// Card real do texto aberto, lido da conta. Null quando o texto não tem Card.
export async function carregarCard(textoId, u) {
  conferir(u);
  const snap = await getDocFromServer(doc(db, 'textos', textoId, 'cards', u));
  conferir(u);
  if (!snap.exists()) return null;
  return window.DL_CARD_FORMATO.validar(snap.data().conteudo);
}

// Conferência honesta do uso sem internet: app e acervos guardados neste aparelho.
export async function verificarOffline() {
  const alvo = document.getElementById('mem-offline');
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    if (alvo) alvo.textContent = 'Este navegador não guarda o app para uso sem internet.';
    return;
  }
  try {
    let espera;
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => { espera = setTimeout(() => rej(Error('app ainda não guardado neste aparelho')), 8000); }),
    ]).finally(() => clearTimeout(espera));
    const recursos = ['/index.html', '/memorizar/interface.js', '/memorizar/modelo.js', '/memorizar/nuvem.js',
      '/data/substantivos.json', '/data/verbos.json', '/data/adjetivos_adverbios.json'];
    const achados = await Promise.all(recursos.map(p => caches.match(p)));
    const ok = !!reg.active && achados.every(Boolean);
    if (alvo) alvo.textContent = ok
      ? 'App e acervos guardados neste aparelho: você pode reabrir e reler o ciclo sem internet. Iniciar ou alterar prazo exige conexão.'
      : 'Uso sem internet ainda não confirmado. Abra o site uma vez com conexão para guardar o app neste aparelho.';
  } catch (e) {
    if (alvo) alvo.textContent = 'Offline não confirmado: ' + e.message;
  }
}
