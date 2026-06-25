const CACHE = 'nutri-check-v1';
const FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/defaults.js',
  './js/predict.js',
  './js/app.js',
  './models/vht_model.json',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
