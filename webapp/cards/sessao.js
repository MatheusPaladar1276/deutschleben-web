import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence } from './vendor/firebase-auth.js';

export function getAuth(app) {
  // Mantem a persistencia padrao do SDK, sem carregar o iframe de login na restauracao.
  return initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
  });
}
