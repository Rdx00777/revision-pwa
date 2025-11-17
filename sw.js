const CACHE_NAME = 'revision-tracker-v3'; // Incremented cache name

// Use relative paths and updated file names
const URLS_TO_CACHE = [
    '.',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'audio/mixkit-forest-birds-singing-1212.wav', // *** CHANGED ***
    'icons/Focus Mode Wallpaper.jfif', // *** CHANGED ***
    'https://cdn.jsdelivr.net/npm/idb@7/build/umd.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display.swap'
];

// 1. Install the Service Worker and cache app assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(URLS_TO_CACHE);
            })
            .catch(err => {
                console.error("Cache install failed:", err);
            })
    );
});

// 2. Activate event - clean up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 3. Fetch event - serve cached assets first (Offline-First)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    networkResponse => {
                        if(!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }
                        if(event.request.method !== 'GET') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                if(event.request.url.startsWith('http')) {
                                    cache.put(event.request, responseToCache);
                                }
                            });
                        return networkResponse;
                    }
                );
            }
        ).catch(error => {
            console.error('Fetch failed:', error);
        })
    );
});
