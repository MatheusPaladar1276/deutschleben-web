// Cole aqui o firebaseConfig do seu projeto (Console Firebase > Configurações do projeto > Seus apps).
// O site do vocabulário funciona SEM isto (os dados são estáticos). É necessário apenas
// se você quiser usar recursos do Firebase no navegador (Analytics, Firestore, etc.).

export const firebaseConfig = {
  apiKey: "AIzaSyDCueo_SJ8gAqU9VT6cMdyxyDhXGSP1ma4",
  authDomain: "ricardo-d6119.firebaseapp.com",
  projectId: "ricardo-d6119",
  storageBucket: "ricardo-d6119.firebasestorage.app",
  messagingSenderId: "436880673471",
  appId: "1:436880673471:web:f4c3f6178fa8aefc75140a",
};

// Inicialização opcional: só roda se você preencher os valores acima.
export async function iniciarFirebase() {
  if (firebaseConfig.apiKey.startsWith("SUA_")) return null;
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"
  );
  return initializeApp(firebaseConfig);
}
