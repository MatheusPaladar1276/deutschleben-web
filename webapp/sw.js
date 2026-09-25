// Service worker do Deutschleben — habilita instalação (PWA) e cache básico.
const CACHE = "deutschleben-v1";
const ATIVOS = [
  "./",
  "./index.html",
  "./data/caminhadas.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ATIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    caches.match(evento.request).then((resposta) =>
      resposta ||
      fetch(evento.request)
        .then((rede) => {
          const copia = rede.clone();
          caches.open(CACHE).then((c) => c.put(evento.request, copia)).catch(() => {});
          return rede;
        })
        .catch(() => caches.match("./index.html"))
    )
  );
});
