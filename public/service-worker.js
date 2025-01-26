// service-worker.js

importScripts('https://unpkg.com/idb@7/build/iife/index-min.js');

const dbPromise = idb.openDB('fotobiljeske-db', 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('photos')) {
            db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
        }
    },
});

const CACHE_NAME = 'fotobiljeske-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png' // Dodajte ovu liniju ako imate ovu ikonu
];

// Instalacija Service Workera i cacheiranje resursa
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Opened cache');
            return cache.addAll(urlsToCache);
        })
    );
});

// Aktivacija Service Workera i čišćenje starog cachea
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event za offline podršku i caching strategiju
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request)
        .then(response => {
            return response || fetch(event.request);
        })
    );
});

// Background Sync za sinkronizaciju fotografija
self.addEventListener('sync', event => {
    if (event.tag === 'sync-photos') {
        event.waitUntil(syncPhotos());
    }
});

// Funkcija za sinkronizaciju fotografija s poslužiteljem
async function syncPhotos() {
    const db = await dbPromise;
    const photos = await db.getAll('photos');

    for (const photo of photos) {
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image: photo.photo })
            });
            if (response.ok) {
                // Uklanjanje fotografije iz IndexedDB nakon uspješne sinkronizacije
                await db.delete('photos', photo.id);
            }
        } catch (err) {
            console.error('Greška pri sinkronizaciji fotografije:', err);
            throw err; // Ponovno bacanje greške kako bi Sync Manager znao da je sinkronizacija neuspješna
        }
    }

    // Slanje push notifikacije nakon sinkronizacije
    self.registration.showNotification('FotoBilješke', {
        body: 'Sve fotografije su sinkronizirane!',
        icon: '/icons/icon-192.png'
    });
}

// Push notifikacije
self.addEventListener('push', event => {
    console.log('Push event primljen:', event); // Dodani log
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'FotoBilješke';
    const options = {
        body: data.body || 'Nova notifikacija',
        icon: '/icons/icon-192.png'
    };
    event.waitUntil(self.registration.showNotification(title, options));
});
