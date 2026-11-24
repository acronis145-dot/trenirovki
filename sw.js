// Собрано инструменты/сайт.mjs — вручную не править.
const CACHE = 'trenirovki-329ee60c95b7';
const FILES = [
  "./",
  "data/program.mjs",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "index.html",
  "logic/plan.mjs",
  "logic/records.mjs",
  "logic/storage.mjs",
  "logic/today.mjs",
  "logic/week.mjs",
  "logic/workout.mjs",
  "manifest.webmanifest",
  "styles.css",
  "ui/main.mjs"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('trenirovki-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Свои файлы — из памяти этой версии; чужие адреса (YouTube) — как обычно.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE)
    .then((c) => c.match(e.request, { ignoreSearch: true }))
    .then((hit) => hit ?? fetch(e.request)));
});
