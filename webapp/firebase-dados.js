// Leitura das Caminhadas direto do Firestore (banco online).
// Se o Firestore não responder ou não houver permissão, retorna null e o
// site usa o arquivo estático como reserva.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy, addDoc, serverTimestamp, doc, getDocFromServer, getDocsFromServer, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
  async carregarTexto(textoId) {
    if (!db) throw new Error("O serviço de leitura não está disponível.");
    if (typeof textoId !== "string" || !textoId.trim() || textoId.includes("/")) {
      throw new Error("ID de texto inválido.");
    }
    const salvo = await getDocFromServer(doc(db, "textos", textoId));
    if (!salvo.exists()) throw new Error("Texto não encontrado.");
    const dados = salvo.data();
    return { id: salvo.id, titulo: dados.titulo || "Sem título", conteudo: dados.conteudo };
  },
  async listarTextos() {
    if (!db) throw new Error("Serviço indisponível.");
    const snap = await getDocsFromServer(collection(db, "textos"));
    return snap.docs.map(d => ({ id: d.id, titulo: d.data().titulo || "Sem título" }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
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
try {
  if (app) auth = getAuth(app);
} catch (e) {
  auth = null;
}

window.DL_AUTH = {
  get usuario() { return usuario; },
  get pronta() { return authPronta; },
  async entrar() {
    if (!auth || !authPronta) throw new Error("Autenticação indisponível.");
    const provedor = new GoogleAuthProvider();
    provedor.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provedor);
  },
  async sair() {
    if (!auth || !authPronta) throw new Error("Autenticação indisponível.");
    await signOut(auth);
  },
};

if (auth) {
  onAuthStateChanged(auth, atual => {
    usuario = atual ? Object.freeze({ uid: atual.uid }) : null;
    authPronta = true;
    window.dispatchEvent(new Event("dl-auth-alterado"));
  });
}
window.dispatchEvent(new Event("dl-auth-alterado"));
