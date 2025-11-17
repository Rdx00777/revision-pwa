const CACHE_NAME = 'revision-tracker-v2'; // Incremented cache name

// Use relative paths for local files
const URLS_TO_CACHE = [
    '.',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'audio/alarm.mp3',
    'icons/icon-192x192.png',
    'icons/icon-512x512.png',
    'https://cdn.jsdelivr.net/npm/idb@7/build/umd.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap'
];

// 1. Install the Service Worker and cache app assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // We use addAll, but if one file fails (e.g., alarm.mp3), the whole install fails.
                // Make sure all files are present!
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
                // Cache hit - return response from cache
                if (response) {
                    return response;
                }
                
                // Not in cache - fetch from network
                return fetch(event.request).then(
                    networkResponse => {
                        // Check if we received a valid response
                        if(!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }

                        // Don't cache requests that aren't GET
                        if(event.request.method !== 'GET') {
                            return networkResponse;
                        }

                        // Clone the response
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // Only cache http/https schemes, not chrome-extension://
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
            // You could return a specific offline fallback page here
        })
    );
});
