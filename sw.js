/* ══════════════════════════════════════════════════
   Service Worker - Kanji-trad
   Stratégie : Network-first pour HTML/JSON, Cache-first pour assets
══════════════════════════════════════════════════ */

const CACHE_NAME = 'kanji-trad-v2-20250903';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json'
];

/* ══════════════════════════════════════════════════
   INSTALLATION - Préparer le cache
══════════════════════════════════════════════════ */
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installation');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Pré-cachage des assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Si le pré-cachage échoue, continuer quand même
        console.warn('⚠️ Certains fichiers n\'ont pas pu être cachés');
      });
    })
  );
  
  // Force l'activation immédiate
  self.skipWaiting();
});

/* ══════════════════════════════════════════════════
   ACTIVATION - Nettoyer les anciens caches
══════════════════════════════════════════════════ */
self.addEventListener('activate', (event) => {
  console.log('✨ Service Worker: Activation');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Service Worker: Suppression du cache ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Prendre le contrôle immédiatement
  self.clients.claim();
});

/* ══════════════════════════════════════════════════
   FETCH - Stratégie de cache intelligente
══════════════════════════════════════════════════ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }
  
  // Stratégie 1 : NETWORK-FIRST pour HTML et JSON (données dynamiques)
  if (url.pathname.endsWith('.html') || 
      url.pathname.endsWith('.json') ||
      url.pathname.includes('/data/')) {
    event.respondWith(networkFirst(request));
  } 
  // Stratégie 2 : CACHE-FIRST pour images/fonts (assets statiques rares à changer)
  else if (url.pathname.endsWith('.png') || 
           url.pathname.endsWith('.jpg') ||
           url.pathname.endsWith('.webp') ||
           url.pathname.endsWith('.woff') ||
           url.pathname.endsWith('.woff2')) {
    event.respondWith(cacheFirst(request));
  }
  // Stratégie 3 : NETWORK-FIRST pour CSS/JS (code applicatif, change souvent)
  else if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith(networkFirst(request));
  }
  // Par défaut : NETWORK-FIRST
  else {
    event.respondWith(networkFirst(request));
  }
});

/* ══════════════════════════════════════════════════
   STRATÉGIES DE CACHE
══════════════════════════════════════════════════ */

// Network-first : essayer le réseau en priorité
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Mettre en cache les réponses réussies
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Si réseau échoue, utiliser le cache
    console.log(`📡 Réseau échoué pour ${request.url}, utilisation du cache`);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Pas de cache, retourner une erreur
    return new Response('Offline - Fichier non disponible', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Cache-first : utiliser le cache en priorité
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Mettre en cache la réponse
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`❌ Impossible de charger ${request.url}`);
    return new Response('Ressource non disponible', {
      status: 404,
      statusText: 'Not Found'
    });
  }
}

/* ══════════════════════════════════════════════════
   MESSAGE DU SERVICE WORKER
══════════════════════════════════════════════════ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('✨ Cache cleared');
    });
  }
});

console.log('✅ Service Worker registré');
