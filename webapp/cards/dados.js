import { initializeApp } from './vendor/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from './vendor/firebase-auth.js';
import { getFirestore, collection, doc, getDocsFromServer, getDocFromServer, runTransaction, serverTimestamp, deleteDoc } from './vendor/firebase-firestore.js';
import { limparLocal, isolarLocal } from './offline.js';
const app=initializeApp({apiKey:'AIzaSyDCueo_SJ8gAqU9VT6cMdyxyDhXGSP1ma4',authDomain:'ricardo-d6119.firebaseapp.com',projectId:'ricardo-d6119',storageBucket:'ricardo-d6119.firebasestorage.app',messagingSenderId:'436880673471',appId:'1:436880673471:web:f4c3f6178fa8aefc75140a'});
const auth=getAuth(app), db=getFirestore(app);
export const uid=()=>auth.currentUser?.uid || null;
const conferir=u=>{if(!u || uid()!==u) throw Error('Conta desconectada.');};
const ref=(id,u)=>doc(db,'textos',id,'cards',u);
export function observar(fn) { let anterior; return onAuthStateChanged(auth,async user=>{
  const atual=user?.uid || null;
  fn(null,false); // Remover imediatamente qualquer conteúdo da conta anterior.
  try { if(anterior!==undefined && anterior!==atual) await limparLocal(); else await isolarLocal(atual); }
  catch { fn(null,true,'Não foi possível isolar o armazenamento. Feche a página e tente novamente.'); return; }
  anterior=atual; if(uid()===atual) fn(atual,true);
}); }
export const entrar=()=>signInWithPopup(auth,new GoogleAuthProvider());
export async function sair(){await limparLocal(); await signOut(auth);}
export async function textos(u){conferir(u); const s=await getDocsFromServer(collection(db,'textos')); conferir(u); return s.docs.map(d=>({id:d.id,titulo:d.data().titulo || 'Sem título'})).sort((a,b)=>a.titulo.localeCompare(b.titulo,'pt'));}
export async function carregar(id,u){conferir(u); const [t,c]=await Promise.all([getDocFromServer(doc(db,'textos',id)),getDocFromServer(ref(id,u))]); conferir(u); if(!t.exists()) throw Error('Original não encontrado.'); return {uid:u,textoId:id,titulo:t.data().titulo || 'Sem título',original:t.data().conteudo,card:c.exists()?window.DL_CARD_FORMATO.validar(c.data().conteudo):null};}
export async function salvar(id,u,c){conferir(u); const conteudo=JSON.stringify(window.DL_CARD_FORMATO.validar(c)); await runTransaction(db,async tx=>{
  const [t,ant]=await Promise.all([tx.get(doc(db,'textos',id)),tx.get(ref(id,u))]); conferir(u);
  if(!t.exists()) throw Error('Original não encontrado.'); window.DL_CARD_FORMATO.vincular(c,t.data().conteudo);
  tx.set(ref(id,u),{uid:u,textoId:id,versao:1,conteudo,criadoEm:ant.exists()?ant.data().criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});
}); conferir(u);}
export async function excluir(id,u){conferir(u); await deleteDoc(ref(id,u)); conferir(u);}
