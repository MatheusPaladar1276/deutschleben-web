import '../firebase-dados.js?v=memorizar-07';
import { getApp } from '../cards/vendor/firebase-app.js';
import { getAuth } from '../cards/vendor/firebase-auth.js';
import { getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp } from '../cards/vendor/firebase-firestore.js';
import { operarMemorizar as operarEspelho, isolarMemorizar as isolarEspelho } from '../cards/offline.js?v=memorizar-07';
import { validarCiclo } from './modelo.js';

const app = getApp(), auth = getAuth(app), db = getFirestore(app);
let conta, epoca = 0, bloqueada = false, isolamento = Promise.resolve();
let conexao = 0;
window.addEventListener('offline', () => { conexao++; });
const contaAtual = () => window.DL_AUTH?.usuario?.uid || null;
export const sessao = () => epoca;
export const contaPronta = () => window.DL_AUTH?.pronta && !!contaAtual() && !bloqueada;

function conferir(s) {
  if (bloqueada || s.epoca !== epoca || !s.uid || s.uid !== conta ||
      s.uid !== contaAtual() || s.uid !== auth.currentUser?.uid) {
    throw Error('A conta mudou ou foi desconectada. Abra Memorizar novamente.');
  }
}
async function acesso() {
  const s = {uid: contaAtual(), epoca};
  conferir(s);
  await isolamento;
  conferir(s);
  return s;
}
function avisarConta() {
  window.dispatchEvent(new Event('dl-memorizar-conta'));
}
function atualizarConta() {
  if (!window.DL_AUTH?.pronta || conta === contaAtual()) return;
  conta = contaAtual(); epoca++; bloqueada = false;
  const uid = conta, rodada = epoca;
  avisarConta();
  // Serializa limpezas; uma sessão antiga nunca volta a habilitar a interface.
  isolamento = isolamento.then(() => isolarEspelho(uid), () => isolarEspelho(uid));
  isolamento.catch(e => {
    if (rodada === epoca) window.dispatchEvent(new CustomEvent('dl-memorizar-erro', {detail: e.message}));
  });
}
window.addEventListener('dl-auth-alterado', atualizarConta);
atualizarConta();

export async function prepararSaida() {
  bloqueada = true; epoca++; avisarConta();
  isolamento = isolamento.then(() => isolarEspelho(null), () => isolarEspelho(null));
  try { await isolamento; }
  catch (e) { throw Error('Não foi possível limpar o ciclo local; saída não concluída. ' + e.message); }
}
window.DL_MEMORIZAR_CONTA = {prepararSaida};

async function gravarEspelho(s, estado) {
  conferir(s);
  await operarEspelho('readwrite', store => {
    conferir(s);
    return store.put({uid: s.uid, ciclo: estado.ciclo, conteudo: estado.conteudo}, s.uid);
  });
  conferir(s);
}
async function lerEspelho(s) {
  const bruto = await operarEspelho('readonly', store => {
    conferir(s);
    return store.get(s.uid);
  });
  conferir(s);
  if (!bruto) throw Error('Não há ciclo local desta conta neste aparelho. Reconecte para consultar a conta.');
  if (bruto.uid !== s.uid || typeof bruto.conteudo !== 'string') {
    throw Error('Cópia local incompatível. Reconecte para recuperar o ciclo da conta.');
  }
  let ciclo;
  try { ciclo = validarCiclo(JSON.parse(bruto.conteudo)); }
  catch (e) { throw Error('Cópia local inválida. Reconecte para recuperar o ciclo da conta. ' + e.message); }
  if (JSON.stringify(ciclo) !== JSON.stringify(bruto.ciclo)) throw Error('Cópia local inconsistente. Reconecte para recuperar o ciclo.');
  return {uid: s.uid, sessao: s.epoca, ciclo, conteudo: bruto.conteudo, origem: 'local', aviso: ''};
}
function interpretar(s, snap) {
  if (!snap.exists()) return {uid: s.uid, sessao: s.epoca, ciclo: null, conteudo: null, origem: 'servidor',
    aviso: 'Se esperava um ciclo, confira a conta antes de iniciar outro. Nenhuma cópia local anterior foi apagada.'};
  const dados = snap.data();
  if (dados.uid !== s.uid || dados.versao !== 1 || typeof dados.conteudo !== 'string') {
    throw Error('Registro do ciclo inválido na conta. Nenhum dado foi substituído.');
  }
  return {uid: s.uid, sessao: s.epoca, ciclo: validarCiclo(JSON.parse(dados.conteudo)),
    conteudo: dados.conteudo, origem: 'servidor', aviso: ''};
}
async function espelhar(s, estado) {
  try { await gravarEspelho(s, estado); }
  catch (e) {
    conferir(s);
    estado.aviso = 'A cópia local não pôde ser salva. Não dependa do uso offline. ' + e.message;
  }
  return estado;
}
export async function carregarCiclo() {
  const s = await acesso();
  if (!navigator.onLine) return lerEspelho(s);
  let snap;
  try { snap = await getDocFromServer(doc(db, 'memorizar', s.uid)); }
  catch (e) {
    conferir(s);
    if (['unavailable', 'deadline-exceeded'].includes(e.code)) {
      const local = await lerEspelho(s);
      local.aviso = 'O servidor não respondeu. Esta cópia pode estar desatualizada.';
      return local;
    }
    throw e;
  }
  conferir(s);
  const estado = interpretar(s, snap);
  return estado.ciclo ? espelhar(s, estado) : estado;
}
function erroDeConflito() {
  const erro = Error('O ciclo mudou em outro aparelho. Nada foi substituído. Feche e abra Memorizar para conferir antes de confirmar.');
  erro.code = 'memorizar/conflito';
  return erro;
}
export async function salvarCiclo(ciclo, anterior) {
  const conexaoInicial = conexao;
  const s = await acesso();
  if (!anterior || anterior.uid !== s.uid || anterior.sessao !== s.epoca) throw Error('Reabra Memorizar para conferir o ciclo desta conta.');
  if (!navigator.onLine) throw Error('Sem conexão: o ciclo não foi salvo nem colocado em fila. Os itens e o prazo anteriores foram mantidos.');
  const valido = validarCiclo(ciclo), conteudo = JSON.stringify(valido);
  if (new TextEncoder().encode(conteudo).length > 200000) throw Error('O ciclo excede o limite de 200.000 bytes. O conjunto anterior foi mantido.');
  const ref = doc(db, 'memorizar', s.uid);
  const erroDeConexao = () => Error('Conexão perdida. O ciclo não foi colocado em fila; reabra para conferir o estado da conta.');
  const conferirConexao = () => {
    if (!navigator.onLine || conexao !== conexaoInicial) throw erroDeConexao();
  };
  // Uma retentativa do SDK poderia gravar ao reconectar sem nova confirmacao.
  try { await runTransaction(db, async tx => {
    conferirConexao();
    let cancelarLeitura;
    const interrompida = new Promise((_, reject) => {
      cancelarLeitura = () => reject(erroDeConexao());
      window.addEventListener('offline', cancelarLeitura, {once: true});
    });
    let atual;
    try { atual = await Promise.race([tx.get(ref), interrompida]); }
    finally { window.removeEventListener('offline', cancelarLeitura); }
    conferir(s);
    conferirConexao();
    const atualConteudo = atual.exists() ? atual.data().conteudo : null;
    if (atualConteudo !== anterior.conteudo) {
      throw erroDeConflito();
    }
    tx.set(ref, {uid: s.uid, versao: 1, conteudo,
      criadoEm: atual.exists() ? atual.data().criadoEm : serverTimestamp(), atualizadoEm: serverTimestamp()});
  }, {maxAttempts: 1}); } catch (e) {
    conferir(s);
    if (!e.code || e.code === 'memorizar/conflito') throw e;
    if (['aborted', 'failed-precondition'].includes(e.code)) throw erroDeConflito();
    throw Error('Não foi possível confirmar o salvamento na conta. Nenhuma alteração foi colocada em fila. Reabra Memorizar para conferir o estado antes de tentar novamente. ' + e.message);
  }
  conferir(s);
  return espelhar(s, {uid: s.uid, sessao: s.epoca, ciclo: valido, conteudo, origem: 'servidor', aviso: ''});
}
export async function carregarCard(textoId, uid) {
  const s = await acesso();
  if (uid !== s.uid) throw Error('O texto aberto pertence a outra sessão.');
  const snap = await getDocFromServer(doc(db, 'textos', textoId, 'cards', uid));
  conferir(s);
  return snap.exists() ? window.DL_CARD_FORMATO.validar(snap.data().conteudo) : null;
}
export async function verificarOffline() {
  const s = await acesso();
  const local = await lerEspelho(s);
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller || !window.caches) {
    return 'O ciclo tem cópia local, mas o pacote do app ainda não está controlado para reabertura offline.';
  }
  const recursos = ['/index.html', '/memorizar/entrada.js?v=memorizar-07', '/memorizar/interface.js',
    '/memorizar/modelo.js', '/memorizar/nuvem.js?v=memorizar-07', '/memorizar/persistencia.js', '/memorizar/memorizar.css',
    '/firebase-dados.js?v=memorizar-07', '/cards/sessao.js?v=memorizar-07', '/cards/formato.js',
    '/cards/formato.js?v=cards-construcoes-21', '/cards/offline.js?v=memorizar-07',
    '/cards/vendor/firebase-app.js', '/cards/vendor/firebase-auth.js', '/cards/vendor/firebase-firestore.js'];
  const achados = await Promise.all(recursos.map(p => caches.match(p)));
  conferir(s);
  return local.ciclo && achados.every(r => r?.ok)
    ? 'Pacote do app e cópia local do ciclo encontrados neste navegador. A retenção depende do navegador; confirme a reabertura sem conexão antes de depender dela.'
    : 'Pacote offline incompleto. Abra com conexão antes de depender da reabertura.';
}
