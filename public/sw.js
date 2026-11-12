const CACHE_NAME = 'smartschool-attendance-v2';
const APP_SHELL = [
    '/attendance-offline.js',
    '/assets/style.css',
    '/assets/theme.css',
    '/assets/theme.js',
    '/assets/global-navigation.css',
    '/assets/global-navigation.js',
    '/assets/smartschool-icon.svg',
    '/manifest.webmanifest'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(async () => {
                try {
                    const response = await fetch('/attendance.html', { cache: 'no-store' });
                    if (
                        response.ok &&
                        !response.redirected &&
                        new URL(response.url).pathname === '/attendance.html' &&
                        response.headers.get('content-type')?.includes('text/html')
                    ) {
                        await (await caches.open(CACHE_NAME)).put('/attendance.html', response);
                    }
                } catch (error) {
                    console.warn('Attendance page could not be cached during install.', error);
                }
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key.startsWith('smartschool-attendance-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    const url = new URL(request.url);
    if (request.mode === 'navigate' && url.pathname === '/attendance.html') {
        event.respondWith(
            (async () => {
                try {
                    const response = await fetch(request);
                    if (
                        response.ok &&
                        !response.redirected &&
                        new URL(response.url).pathname === '/attendance.html' &&
                        response.headers.get('content-type')?.includes('text/html')
                    ) {
                        await (await caches.open(CACHE_NAME)).put(request, response.clone());
                    }
                    return response;
                } catch (error) {
                    return (await caches.match(request)) || Response.error();
                }
            })()
        );
        return;
    }

    if (APP_SHELL.includes(url.pathname)) {
        event.respondWith(
            (async () => {
                const cached = await caches.match(request, { ignoreSearch: true });
                if (cached) return cached;
                const response = await fetch(request);
                if (response.ok) {
                    const copy = response.clone();
                    await caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            })()
        );
    }
});
