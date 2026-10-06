// Somente conteúdo explicitamente disponibilizado. Sem credenciais próprias.
export function banco() {
  return new Promise((resolve,reject) => {
    const r = indexedDB.open('dl-cards-local-v1',1);
    r.onupgradeneeded = () => r.result.createObjectStore('cards',{keyPath:['uid','textoId']});
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
export async function operar(modo, acao) {
  const db = await banco();
  try { return await new Promise((resolve,reject) => {
    const t = db.transaction('cards',modo), s=t.objectStore('cards'); let resultado;
    const r=acao(s); if(r) r.onsuccess=()=>{resultado=r.result;};
    t.oncomplete=()=>resolve(resultado); t.onerror=()=>reject(t.error); t.onabort=()=>reject(t.error || Error('Armazenamento cancelado.'));
  }); } finally { db.close(); }
}
export const listarLocal = uid => operar('readonly',s=>s.getAll()).then(a=>a.filter(x=>x.uid===uid));
export const removerLocal = (uid,id) => operar('readwrite',s=>s.delete([uid,id]));
export const limparLocal = () => operar('readwrite',s=>s.clear());
export const guardarLocal = registro => operar('readwrite',s=>s.put(registro));
export async function isolarLocal(uid) {
  const todos=await operar('readonly',s=>s.getAll());
  await operar('readwrite',s=>{for(const c of todos) if(c.uid!==uid) s.delete([c.uid,c.textoId]);});
}
