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
function avisarBlocos(){if(typeof BroadcastChannel==='function'){const c=new BroadcastChannel('dl-cards-contas');c.postMessage({tipo:'cards-alterados'});c.close();}}
export const removerLocal = (uid,id) => operar('readwrite',s=>s.delete([uid,id])).then(r=>{avisarBlocos();return r;});
export const limparLocal = async () => {
  await isolarMemorizar(null);
  return operar('readwrite',s=>s.clear());
};
export const guardarLocal = registro => operar('readwrite',s=>s.put(registro)).then(r=>{avisarBlocos();return r;});
export async function isolarLocal(uid) {
  await isolarMemorizar(uid);
  const todos=await operar('readonly',s=>s.getAll());
  await operar('readwrite',s=>{for(const c of todos) if(c.uid!==uid) s.delete([c.uid,c.textoId]);});
}

function bancoMemorizar() {
  return new Promise((resolve, reject) => {
    let encerrado = false;
    const r = indexedDB.open('dl-memorizar-nuvem-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('ciclos');
    r.onsuccess = () => {
      if (encerrado) { r.result.close(); return; }
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(Error('Não foi possível abrir a cópia local: ' + r.error.message));
    r.onblocked = () => {
      encerrado = true;
      reject(Error('Cópia local bloqueada. Feche outras abas do DL e tente novamente.'));
    };
  });
}
export async function operarMemorizar(modo, acao) {
  const local = await bancoMemorizar();
  try {
    return await new Promise((resolve, reject) => {
      const t = local.transaction('ciclos', modo);
      let r;
      try { r = acao(t.objectStore('ciclos')); }
      catch (e) { t.abort(); reject(e); return; }
      t.oncomplete = () => resolve(r?.result);
      t.onerror = () => reject(Error('Falha na cópia local: ' + t.error.message));
      t.onabort = () => reject(Error('Operação da cópia local cancelada. Nenhum ciclo local foi substituído.'));
    });
  } finally { local.close(); }
}
export async function isolarMemorizar(uid) {
  await operarMemorizar('readwrite', s => {
    const r = s.getAllKeys();
    r.onsuccess = () => { for (const chave of r.result) if (chave !== uid) s.delete(chave); };
    return r;
  });
}
