importScripts('./referencia-sw.js');
// Service worker do Deutschleben — instalação (PWA) e cache.
// Estratégia: rede-primeiro para navegação/JSON (conteúdo sempre atual),
// cache-primeiro para estáticos (ícones). Suba a versão ao publicar mudanças.
const CACHE = "deutschleben-v34-rg-01-10-v10";
const ACERVO_CONSTRUCOES = "/data/DL_Preposicoes_Base_Revisada.json";
const ESTATICOS = [
  "./referencia.js?v=rg-01-10-v10", "./referencia-dados.js?v=rg-01-10-v10", "./referencia.css?v=rg-01-10-v10", "./referencia-sw.js",
  "./textos.js?v=rg-01-10-v10",
  "./index.html",
  "./acessibilidade.css?v=2",
  "./pacote-final.css?v=4",
  "./apostila.js?v=rg-01-10-v10",
  "./blocos.js",
  "./destaques-blocos.js?v=blocos-16",
  "./caixas-leitura.css?v=blocos-controles-17",
  "./firebase-dados.js?v=cards-construcoes-21",
  "./cards/formato.js?v=cards-construcoes-21",
  "./cards/offline.js?v=blocos-15",
  "./cards/texto-01.json",
  "./cards/vendor/firebase-app.js",
  "./cards/vendor/firebase-auth.js",
  "./cards/vendor/firebase-firestore.js",
  "./data/substantivos.json",
  "./data/verbos.json",
  "./data/adjetivos_adverbios.json",
  "./data/blocos.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll(ESTATICOS);
      // Preserva somente um acervo público já consultado; não o baixa na instalação.
      const anterior = await caches.match(ACERVO_CONSTRUCOES);
      if (anterior?.ok) await c.put(ACERVO_CONSTRUCOES, anterior);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE && k.startsWith("deutschleben-")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function ehNavegacaoOuDados(req) {
  return req.mode === "navigate" || req.destination === "document" || req.url.endsWith(".json");
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;

  // Só intercepta o próprio site; deixa Firebase/Google (auth/firestore) passar direto.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (ehNavegacaoOuDados(req)) {
    evento.respondWith(
      fetch(req)
        .then(async (rede) => {
          if (rede.ok) {
            const copia = rede.clone();
            const guardar = caches.open(CACHE).then((c) => c.put(req, copia));
            if (url.pathname === ACERVO_CONSTRUCOES) await guardar.catch(() => {});
            else guardar.catch(() => {});
          }
          return rede;
        })
        .catch(async () => (await rgRecursoOffline(req)) || caches.match(req).then((r) => r || (url.pathname === ACERVO_CONSTRUCOES || url.pathname.includes("/data/referencia/")
          ? new Response('{"erro":"Acervo ainda não armazenado."}', {status:503,headers:{'Content-Type':'application/json; charset=utf-8'}})
          : caches.match("./index.html"))))
    );
    return;
  }

  evento.respondWith(
    caches.match(req).then((r) =>
      r ||
      fetch(req).catch(async () => (await rgRecursoOffline(req)) || Response.error()).then((rede) => {
        const copia = rede.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        return rede;
      })
    )
  );
});
