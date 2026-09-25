// Integração com o Firebase (Firestore) para salvar a compreensão na nuvem.
// Usa login anônimo. Se o Firestore/Auth ainda não estiverem habilitados no
// projeto, tudo falha em silêncio e o app continua salvando no navegador.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCueo_SJ8gAqU9VT6cMdyxyDhXGSP1ma4",
  authDomain: "ricardo-d6119.firebaseapp.com",
  projectId: "ricardo-d6119",
  storageBucket: "ricardo-d6119.firebasestorage.app",
  messagingSenderId: "436880673471",
  appId: "1:436880673471:web:f4c3f6178fa8aefc75140a",
};

let db = null;
let uid = null;
let pronto = false;

async function iniciar() {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    db = getFirestore(app);
    await signInAnonymously(auth).catch(() => {});
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 4000);
      onAuthStateChanged(auth, (u) => {
        if (u) { uid = u.uid; }
        clearTimeout(t);
        resolve();
      });
    });
    pronto = !!uid;
  } catch (e) {
    pronto = false;
  }
  window.dispatchEvent(new CustomEvent("dl-fb-status", { detail: { pronto } }));
}

window.DL_FB = {
  pronto: () => pronto && !!uid,

  async salvarCompreensao(numero, texto) {
    if (!this.pronto()) return false;
    try {
      await setDoc(
        doc(db, "usuarios", uid, "compreensoes", String(numero)),
        { texto, atualizado: serverTimestamp() }
      );
      return true;
    } catch (e) {
      return false;
    }
  },

  async lerCompreensao(numero) {
    if (!this.pronto()) return null;
    try {
      const snap = await getDoc(doc(db, "usuarios", uid, "compreensoes", String(numero)));
      return snap.exists() ? (snap.data().texto || null) : null;
    } catch (e) {
      return null;
    }
  },
};

iniciar();
