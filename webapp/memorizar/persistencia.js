import {validarCiclo} from './modelo.js';
const BANCO = 'dl-memorizar-demo-v1';
function abrir() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('ciclos');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(Error('Não foi possível abrir o armazenamento local: ' + r.error.message));
    r.onblocked = () => reject(Error('Armazenamento bloqueado. Feche outras abas desta prévia e tente novamente.'));
  });
}
async function operar(modo, acao) {
  const db = await abrir();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction('ciclos', modo);
      const r = acao(t.objectStore('ciclos'));
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(Error('Falha no armazenamento local: ' + t.error.message));
      t.onabort = () => reject(Error('A gravação local foi cancelada; o ciclo anterior foi preservado.'));
    });
  } finally { db.close(); }
}
export async function carregarCiclo() {
  const c = await operar('readonly', s => s.get('ativo'));
  return c === undefined ? null : validarCiclo(c);
}
// Compara com o estado lido: outra aba não pode substituir um ciclo silenciosamente.
export async function salvarCiclo(ciclo, anterior) {
  const valido = validarCiclo(ciclo), db = await abrir();
  try {
    await new Promise((resolve, reject) => {
      const t = db.transaction('ciclos', 'readwrite'), s = t.objectStore('ciclos');
      let conflito = false;
      s.get('ativo').onsuccess = e => {
        if (JSON.stringify(e.target.result || null) !== JSON.stringify(anterior)) { conflito = true; t.abort(); }
        else s.put(valido, 'ativo');
      };
      t.oncomplete = resolve;
      t.onerror = () => reject(Error('Não foi possível salvar o ciclo neste aparelho.'));
      t.onabort = () => reject(Error(conflito ? 'O ciclo mudou em outra aba. Feche e abra Memorizar antes de tentar novamente.' : 'Gravação cancelada. O ciclo anterior foi preservado.'));
    });
  } finally { db.close(); }
}
