const CACHE_NAME = 'revision-tracker-v1';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/audio/alarm.mp3',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
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
                // Use addAll for atomic cache, but be aware it fails if any one resource fails
                // For CDN resources, it's often safer to cache them on first fetch
                return cache.addAll(URLS_TO_CACHE).catch(err => {
                    console.warn("Couldn't cache all files on install:", err);
                });
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
                        if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            // Don't cache opaque responses (like from CDNs unless careful)
                            return networkResponse;
                        }

                        // Clone the response
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                );
            }
        ).catch(error => {
            // Handle fetch errors, especially for offline
            console.log('Fetch failed; returning offline page or fallback', error);
            // You could return a specific offline fallback page here if you had one
        })
    );
});
