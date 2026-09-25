// Leitura das Caminhadas direto do Firestore (banco online).
// Se o Firestore não responder ou não houver permissão, retorna null e o
// site usa o arquivo estático como reserva.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCueo_SJ8gAqU9VT6cMdyxyDhXGSP1ma4",
  authDomain: "ricardo-d6119.firebaseapp.com",
  projectId: "ricardo-d6119",
  storageBucket: "ricardo-d6119.firebasestorage.app",
  messagingSenderId: "436880673471",
  appId: "1:436880673471:web:f4c3f6178fa8aefc75140a",
};

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  db = null;
}

window.DL_DADOS = {
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
