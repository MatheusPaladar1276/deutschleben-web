const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const web = path.resolve(__dirname, '..', '..', 'webapp');
const demo = require('./demo.json');
const card = JSON.parse(fs.readFileSync(path.join(web, 'cards', 'texto-01.json'), 'utf8'));
const registro = {textoId: demo.texto.id, original: demo.texto.conteudo, card};
const bloqueado = `async()=>{throw Error('Prévia local: gravação remota bloqueada.');}`;
const main = `
window.DL_MEMORIZAR_DEMO=${JSON.stringify({registros: [registro], revisao: demo.revisao})};
window.DL_AUTH={pronta:true,usuario:{uid:'WuXcMYo6m3OuQttlk7z22gRjlvn1'},entrar:${bloqueado},sair:${bloqueado}};
const textos=${JSON.stringify([demo.texto, demo.semCard])};
window.DL_DADOS={
 listarTextos:async()=>textos.map(({id,titulo})=>({id,titulo})),
 carregarTexto:async id=>{const t=textos.find(t=>t.id===id);if(!t)throw Error('Texto de demonstração não encontrado.');return {...t};},
 carregarResumo:async()=>'',listarResumos:async()=>[],listarBlocosCards:async()=>({registros:[]}),
 carregarCaminhadas:async()=>null,salvarResumo:${bloqueado},salvarTexto:${bloqueado},excluirTexto:${bloqueado}
};
window.dispatchEvent(new Event('dl-auth-alterado'));`;
const cards = `
const u='WuXcMYo6m3OuQttlk7z22gRjlvn1',registro=${JSON.stringify(registro)};
export const uid=()=>u;
export function observar(fn){queueMicrotask(()=>fn(u,true));}
export const textos=async()=>[{id:registro.textoId,titulo:registro.card.titulo}];
export const carregar=async()=>({...registro,uid:u,titulo:registro.card.titulo});
export const salvar=${bloqueado},excluir=${bloqueado},entrar=${bloqueado},sair=${bloqueado};`;
const recursos = [
  '/index.html', '/firebase-dados.js', '/textos.js', '/apostila.js', '/blocos.js',
  '/referencia.js', '/referencia-dados.js', '/referencia.css', '/referencia-sw.js',
  '/destaques-blocos.js', '/acessibilidade.css', '/pacote-final.css', '/caixas-leitura.css',
  '/manifest.webmanifest', '/memorizar/entrada.js', '/memorizar/interface.js',
  '/memorizar/modelo.js', '/memorizar/persistencia.js', '/memorizar/memorizar.css',
  '/data/substantivos.json', '/data/verbos.json', '/data/adjetivos_adverbios.json',
  '/data/blocos.json', '/data/DL_Preposicoes_Base_Revisada.json',
  '/cards/index.html', '/cards/cards.js', '/cards/cards.css', '/cards/dados.js',
  '/cards/formato.js', '/cards/offline.js', '/cards/texto-01.json', '/cards/modelo.json',
  '/cards/verbos-consulta.json', '/cards/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-180.png',
  ...fs.readdirSync(path.join(web, 'data', 'referencia')).filter(f => f.endsWith('.json')).map(f => '/data/referencia/' + f)
];
const worker = `
const CACHE='dl-memorizar-previa-v7',RECURSOS=${JSON.stringify(recursos)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(RECURSOS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(nomes=>Promise.all(
 nomes.filter(n=>n.startsWith('dl-memorizar-previa-')&&n!==CACHE).map(n=>caches.delete(n))
)).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{
 if(e.data?.tipo==='conferir-memorizar')e.waitUntil((async()=>{
  const c=await caches.open(CACHE),todos=await Promise.all(RECURSOS.map(p=>c.match(p)));
  e.ports[0].postMessage({ok:todos.every(r=>r?.ok)});
 })());
});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(u.origin!==self.location.origin||e.request.method!=='GET')return;
 let p=u.pathname;if(p.endsWith('/'))p+='index.html';
 if(!RECURSOS.includes(p))return;
 e.respondWith(caches.open(CACHE).then(async c=>(await c.match(p))||fetch(e.request)));
});`;
const permitidos = new Set([...recursos, '/sw.js', '/cards/sw.js', '/icons/favicon.ico']);
const banner = '<aside style="padding:10px;background:#fff0c7;color:#403c2d;font:700 16px Arial;text-align:center">PRÉVIA LOCAL · demonstração sem Firebase · nenhum dado pessoal · abra Textos e escolha o Texto 01</aside>';
function criarServidor() {
  return http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://local').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (rel.endsWith('/')) rel += 'index.html';
    if (!permitidos.has(rel)) { res.writeHead(404); res.end('Fora do pacote de demonstração.'); return; }
    try {
      let b;
      if (rel === '/firebase-dados.js') b = main;
      else if (rel === '/cards/dados.js') b = cards;
      else if (rel === '/sw.js') b = worker;
      else if (rel === '/cards/sw.js') b = `self.addEventListener('install',()=>self.skipWaiting());`;
      else {
        b = fs.readFileSync(path.join(web, ...rel.split('/').filter(Boolean)));
        if (rel === '/index.html' || rel === '/cards/index.html') b = b.toString('utf8').replace(/<body[^>]*>/i, m => m + banner);
      }
      res.setHeader('Content-Type', ({'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json', '.png': 'image/png'})[path.extname(rel)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Security-Policy', "default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'");
      res.end(req.method === 'HEAD' ? undefined : b);
    } catch (e) {
      res.writeHead(500); res.end('Falha ao carregar recurso da prévia: ' + e.code);
    }
  });
}
module.exports = {criarServidor, demo, registro};
if (require.main === module) {
  const porta = Number(process.env.DL_MEMORIZAR_PORT || 8796);
  const servidor = criarServidor();
  servidor.on('error', e => { console.error('Não foi possível iniciar a prévia:', e.message); process.exitCode = 1; });
  servidor.listen(porta, '127.0.0.1', () => console.log(`Memorizar: http://127.0.0.1:${porta}/ · somente demonstração, sem Firebase.`));
}
