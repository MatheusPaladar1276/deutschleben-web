// Service worker do Deutschleben — instalação (PWA) e cache.
// Estratégia: rede-primeiro para navegação/JSON (conteúdo sempre atual),
// cache-primeiro para estáticos (ícones). Suba a versão ao publicar mudanças.
const CACHE = "deutschleben-v5";
const ESTATICOS = [
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ESTATICOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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
        .then((rede) => {
          const copia = rede.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
          return rede;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  evento.respondWith(
    caches.match(req).then((r) =>
      r ||
      fetch(req).then((rede) => {
        const copia = rede.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        return rede;
      })
    )
  );
});
