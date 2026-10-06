// Escopo /cards/. O shell usa IndexedDB: o SW raiz pode limpar CacheStorage
// sem remover os recursos desta página. Nenhum dado pessoal passa por este SW.
const DB='dl-cards-shell-v1';
const VERSAO='fundo-8';
const ARQUIVOS=['./','index.html','cards.css','cards.js','dados.js','offline.js','formato.js','texto-01.json','manifest.webmanifest','vendor/firebase-app.js','vendor/firebase-auth.js','vendor/firebase-firestore.js','../icons/icon-192.png','../icons/icon-512.png','../icons/icon-180.png'];
function abrir(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('assets');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
async function gravar(pares){const db=await abrir();try{await new Promise((ok,no)=>{const t=db.transaction('assets','readwrite');for(const [url,r] of pares)t.objectStore('assets').put(r,url);t.oncomplete=ok;t.onerror=()=>no(t.error);});}finally{db.close();}}
async function ler(url){const db=await abrir();try{return await new Promise((ok,no)=>{const t=db.transaction('assets'),r=t.objectStore('assets').get(url);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}finally{db.close();}}
async function instalar(){const pares=await Promise.all(ARQUIVOS.map(async p=>{const url=new URL(p,self.location).href;const r=await fetch(url,{cache:'reload'});if(!r.ok)throw Error('Recurso ausente: '+p);return [url,{body:await r.arrayBuffer(),type:r.headers.get('content-type')}];}));await gravar(pares);}
self.addEventListener('install',e=>e.waitUntil(instalar().then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{if(e.data==='verificar-shell')e.waitUntil((async()=>{const recursos=await Promise.all(ARQUIVOS.map(p=>ler(new URL(p,self.location).href)));e.ports[0].postMessage({pronto:recursos.every(Boolean),versao:VERSAO});})());});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
  const url=u.origin+u.pathname;
  if(!ARQUIVOS.some(p=>new URL(p,self.location).href===url)&&!(e.request.mode==='navigate'&&u.pathname.startsWith('/cards/')))return;
  e.respondWith(fetch(e.request).catch(async()=>{const r=await ler(e.request.mode==='navigate'?new URL('index.html',self.location).href:url);if(!r)return Response.error();return new Response(r.body,{headers:{'Content-Type':r.type}});}));
});
