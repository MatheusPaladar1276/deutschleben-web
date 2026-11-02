// Leitura das Caminhadas direto do Firestore (banco online).
// Se o Firestore não responder ou não houver permissão, retorna null e o
// site usa o arquivo estático como reserva.
import { initializeApp } from "./cards/vendor/firebase-app.js";
import { GoogleAuthProvider, browserPopupRedirectResolver, signInWithPopup, signOut, onAuthStateChanged } from "./cards/vendor/firebase-auth.js";
import { getAuth } from "./cards/sessao.js?v=memorizar-07";
import { getFirestore, collection, getDocs, query, orderBy, addDoc, serverTimestamp, doc, getDocFromServer, getDocsFromServer, runTransaction } from "./cards/vendor/firebase-firestore.js";
import './cards/formato.js?v=cards-construcoes-21';
import { listarLocal, limparLocal, removerLocal, operarMemorizar } from './cards/offline.js?v=memorizar-07';
import { validarCiclo } from './memorizar/modelo.js';

const firebaseConfig = {
  apiKey: "AIzaSyDCueo_SJ8gAqU9VT6cMdyxyDhXGSP1ma4",
  authDomain: "ricardo-d6119.firebaseapp.com",
  projectId: "ricardo-d6119",
  storageBucket: "ricardo-d6119.firebasestorage.app",
  messagingSenderId: "436880673471",
  appId: "1:436880673471:web:f4c3f6178fa8aefc75140a",
};

let app = null;
let db = null;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  db = null;
}

async function textosLocais(uid) {
  const conferir = () => {
    if (!authPronta || !uid || usuario?.uid !== uid || auth?.currentUser?.uid !== uid) {
      throw new Error("Conta desconectada.");
    }
  };
  conferir();
  const [cards, espelho] = await Promise.all([
    listarLocal(uid), operarMemorizar('readonly', store => store.get(uid)),
  ]);
  conferir();
  const textos = new Map(cards.map(r => [r.textoId, {
    id: r.textoId, titulo: r.titulo || "Sem título",
    conteudo: typeof r.original === 'string' && r.original.trim() ? r.original : null,
  }]));
  if (espelho) {
    if (espelho.uid !== uid || typeof espelho.conteudo !== 'string') {
      throw new Error("Cópia local do ciclo incompatível. Nenhum dado foi alterado.");
    }
    let ciclo;
    try { ciclo = validarCiclo(JSON.parse(espelho.conteudo)); }
    catch (e) { throw new Error("Cópia local do ciclo inválida. Nenhum dado foi alterado. " + e.message); }
    if (JSON.stringify(ciclo) !== JSON.stringify(espelho.ciclo)) {
      throw new Error("Cópia local do ciclo inconsistente. Nenhum dado foi alterado.");
    }
    if (!textos.get(ciclo.textoId)?.conteudo) {
      textos.set(ciclo.textoId, {id: ciclo.textoId, titulo: ciclo.titulo, conteudo: ciclo.original});
    }
  }
  return [...textos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
}

window.DL_DADOS = {
  async salvarTexto(conteudo, titulo = "") {
    if (typeof conteudo !== "string" || !conteudo.trim()) {
      throw new Error("Informe o texto em alemão.");
    }
    if (!db) throw new Error("O serviço de salvamento não está disponível.");
    const dados = { conteudo, criadoEm: serverTimestamp(), estado: "recebido" };
    const tituloInformado = titulo.trim();
    if (tituloInformado) dados.titulo = tituloInformado;
    const salvo = await addDoc(collection(db, "textos"), dados);
    return salvo.id;
  },
  async carregarTexto(textoId, uid = usuario?.uid) {
    if (typeof textoId !== "string" || !textoId.trim() || textoId.includes("/")) {
      throw new Error("ID de texto inválido.");
    }
    if (!navigator.onLine) {
      const texto = (await textosLocais(uid)).find(t => t.id === textoId);
      if (!texto?.conteudo) {
        const erro = new Error("Este texto não está disponível na cópia local desta conta. Conecte-se para abrir o original.");
        erro.code = 'textos/indisponivel-offline';
        throw erro;
      }
      return texto;
    }
    if (!db) throw new Error("O serviço de leitura não está disponível.");
    const salvo = await getDocFromServer(doc(db, "textos", textoId));
    if (!salvo.exists()) throw new Error("Texto não encontrado.");
    const dados = salvo.data();
    return { id: salvo.id, titulo: dados.titulo || "Sem título", conteudo: dados.conteudo };
  },
  async listarTextos(uid = usuario?.uid) {
    if (!navigator.onLine) {
      return (await textosLocais(uid)).map(t => ({
        id: t.id, titulo: t.titulo, disponivelOffline: !!t.conteudo,
      }));
    }
    if (!db) throw new Error("Serviço indisponível.");
    const snap = await getDocsFromServer(collection(db, "textos"));
    return snap.docs.map(d => ({ id: d.id, titulo: d.data().titulo || "Sem título" }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
  },
  async listarBlocosCards(uid) {
    const conferir=()=>{if(!db || !auth?.currentUser || auth.currentUser.uid!==uid)throw Error('Conta desconectada.');};
    conferir();
    let locais=[];try{locais=await listarLocal(uid);}catch{}conferir();
    const validar=r=>{try{return {...r,card:window.DL_CARD_FORMATO.validar(r.card)};}catch{return null;}};
    locais=locais.map(validar).filter(Boolean);
    if(!navigator.onLine)return {registros:locais,offline:true,parcial:false};
    let textos;
    try{textos=await getDocsFromServer(collection(db,'textos'));}catch{conferir();return {registros:locais,offline:false,parcial:true};}
    conferir();let parcial=false;
    const registros=await Promise.all(textos.docs.map(async t=>{
      try{
        const c=await getDocFromServer(doc(db,'textos',t.id,'cards',uid));conferir();
        if(!c.exists())return null;
        const card=window.DL_CARD_FORMATO.validar(c.data().conteudo);
        window.DL_CARD_FORMATO.vincular(card,t.data().conteudo);
        return {uid,textoId:t.id,titulo:t.data().titulo||card.titulo,card};
      }catch{parcial=true;return locais.find(l=>l.textoId===t.id)||null;}
    }));
    conferir();return {registros:registros.filter(Boolean),offline:false,parcial};
  },
  async carregarResumo(textoId, uid) {
    if (!db || !auth?.currentUser || auth.currentUser.uid !== uid) throw new Error("Conta desconectada.");
    const snap = await getDocFromServer(doc(db, "textos", textoId, "resumos", uid));
    return snap.exists() ? snap.data().conteudo : "";
  },
  async salvarResumo(textoId, uid, conteudo) {
    if (!db || !auth?.currentUser || auth.currentUser.uid !== uid) throw new Error("Conta desconectada.");
    if (typeof conteudo !== "string" || !conteudo.trim() || conteudo.length > 30000) {
      throw new Error("Informe um resumo de até 30.000 caracteres.");
    }
    const ref = doc(db, "textos", textoId, "resumos", uid);
    // A transação só conclui após confirmação do backend; não há salvamento automático.
    await runTransaction(db, async transacao => {
      const anterior = await transacao.get(ref);
      transacao.set(ref, { uid, textoId, conteudo,
        criadoEm: anterior.exists() ? anterior.data().criadoEm : serverTimestamp(),
        atualizadoEm: serverTimestamp() });
    });
  },
  async listarResumos(uid) {
    if (!db || !auth?.currentUser || auth.currentUser.uid !== uid) throw new Error("Conta desconectada.");
    const textos = await this.listarTextos();
    const resumos = await Promise.all(textos.map(async texto => {
      const conteudo = await this.carregarResumo(texto.id, uid);
      return { ...texto, conteudo };
    }));
    if (auth.currentUser?.uid !== uid) throw new Error("Conta desconectada.");
    return resumos.filter(resumo => resumo.conteudo.trim());
  },
  async excluirTexto(textoId, uid) {
    if (!db || !auth?.currentUser || auth.currentUser.uid !== uid) throw new Error("Conta desconectada.");
    if (typeof textoId !== "string" || !textoId.trim() || textoId.includes("/")) throw new Error("ID de texto inválido.");
    const original = doc(db, "textos", textoId), resumo = doc(db, "textos", textoId, "resumos", uid);
    const card = doc(db, "textos", textoId, "cards", uid);
    // Transação online: lê ambos antes de escrever e só conclui após o backend.
    await runTransaction(db, async transacao => {
      const texto = await transacao.get(original);
      const salvo = await transacao.get(resumo);
      const cardSalvo = await transacao.get(card);
      if (auth.currentUser?.uid !== uid) throw new Error("Conta desconectada.");
      if (!texto.exists()) throw new Error("Texto não encontrado; atualize a lista antes de excluir.");
      if (salvo.exists()) transacao.delete(resumo);
      if (cardSalvo.exists()) transacao.delete(card);
      transacao.delete(original);
    });
    await removerLocal(uid, textoId);
    if (typeof BroadcastChannel === 'function') {
      const canal = new BroadcastChannel('dl-cards-contas');
      canal.postMessage({ tipo: 'excluir-texto', id: textoId }); canal.close();
    }
  },
  async carregarCaminhadas() {
    if (!db) return null;
    try {
      const q = query(collection(db, "web_caminhadas"), orderBy("numero"));
      const snap = await getDocs(q);
      const lista = [];
      snap.forEach((d) => lista.push(d.data()));
      return lista.length ? lista : null;
    } catch (e) {
      return null;
    }
  },
};

// O SDK gerencia a autenticação. Não copiamos credenciais para armazenamento próprio.
let auth = null;
let usuario = null;
let authPronta = false;
let authErro = '';
try {
  if (app) auth = getAuth(app);
} catch (e) {
  authErro = 'Não foi possível restaurar a sessão. Seus dados locais não foram apagados.';
  console.error(authErro, e);
}

window.DL_AUTH = {
  get usuario() { return usuario; },
  get pronta() { return authPronta; },
  get erro() { return authErro; },
  async entrar() {
    if (!auth || !authPronta) throw new Error("Autenticação indisponível.");
    const provedor = new GoogleAuthProvider();
    provedor.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provedor, browserPopupRedirectResolver);
  },
  async sair() {
    if (!auth || !authPronta) throw new Error("Autenticação indisponível.");
    await window.DL_MEMORIZAR_CONTA?.prepararSaida();
    await limparLocal();
    if (typeof BroadcastChannel === 'function') {
      const canal = new BroadcastChannel('dl-cards-contas');
      canal.postMessage({ tipo: 'sair' }); canal.close();
    }
    await signOut(auth);
  },
};

if (auth) {
  onAuthStateChanged(auth, atual => {
    usuario = atual ? Object.freeze({ uid: atual.uid }) : null;
    authErro = '';
    authPronta = true;
    window.dispatchEvent(new Event("dl-auth-alterado"));
  }, e => {
    authErro = 'Não foi possível restaurar a sessão. Seus dados locais não foram apagados.';
    console.error(authErro, e);
    window.dispatchEvent(new Event("dl-auth-alterado"));
  });
}
window.dispatchEvent(new Event("dl-auth-alterado"));
