// Auxiliar compartilhado pelos workers DL e Cards. Só lê pacotes públicos completos.
const RG_VERSAO='rg-previa-01-10-v10';
self.addEventListener('message',e=>{
  if(e.data==='verificar-referencia')e.ports[0]?.postMessage({versao:RG_VERSAO});
});
async function rgRecursoOffline(req){
  const raiz=new URL(self.registration.scope.includes('/cards/')?'../':'./',self.registration.scope);
  const url=new URL(req.url),manifesto=new URL('data/referencia/manifesto.json',raiz).href;
  if(url.origin!==raiz.origin)return null;
  for(const nome of (await caches.keys()).filter(n=>n.startsWith('dl-rg-publico-')).reverse()){
    const cache=await caches.open(nome),r=await cache.match(manifesto);if(!r)continue;
    let m;try{m=await r.json();}catch{continue;}if(m.versao!==RG_VERSAO)continue;
    if(url.href===manifesto)return cache.match(manifesto);
    // A navegação inicial / equivale a index.html; consultas não alteram os dados públicos.
    let caminho=url.pathname;if(caminho===raiz.pathname)caminho+='index.html';
    const item=m.recursos.find(x=>new URL(x.url,raiz).pathname===caminho);
    if(item){const local=await cache.match(new URL(item.url,raiz).href);if(local)return local;}
  }
  return null;
}
