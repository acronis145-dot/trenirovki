// Собрано инструменты/сайт.mjs — вручную не править.
const CACHE = 'trenirovki-b7119028c2f1';
const FILES = [
  "./",
  "data/pictures.mjs",
  "data/program.mjs",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "images/abduction-1.svg",
  "images/abduction-2.svg",
  "images/adduction-1.svg",
  "images/adduction-2.svg",
  "images/calfRaise-1.svg",
  "images/calfRaise-2.svg",
  "images/chestFly-1.jpg",
  "images/chestFly-2.jpg",
  "images/chestPress-1.svg",
  "images/chestPress-2.svg",
  "images/facePull.jpg",
  "images/latPulldown-1.jpg",
  "images/latPulldown-2.jpg",
  "images/lateralRaise-1.svg",
  "images/lateralRaise-2.svg",
  "images/legCurlLying-1.svg",
  "images/legCurlLying-2.svg",
  "images/legCurlSeated-1.svg",
  "images/legCurlSeated-2.svg",
  "images/legExtension-1.svg",
  "images/legExtension-2.svg",
  "images/legPress-1.svg",
  "images/legPress-2.svg",
  "images/romanianDeadlift-1.svg",
  "images/romanianDeadlift-2.svg",
  "images/seatedRow-1.svg",
  "images/seatedRow-2.svg",
  "images/shoulderPress-1.jpg",
  "images/shoulderPress-2.jpg",
  "images/tricepsPushdown-1.svg",
  "images/tricepsPushdown-2.svg",
  "index.html",
  "logic/plan.mjs",
  "logic/records.mjs",
  "logic/rest.mjs",
  "logic/restore.mjs",
  "logic/stats.mjs",
  "logic/storage.mjs",
  "logic/today.mjs",
  "logic/week.mjs",
  "logic/workout.mjs",
  "manifest.webmanifest",
  "styles.css",
  "ui/backup.mjs",
  "ui/card.mjs",
  "ui/chart.mjs",
  "ui/dom.mjs",
  "ui/main.mjs",
  "ui/progress.mjs",
  "ui/start.mjs",
  "ui/state.mjs",
  "ui/workout.mjs"
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
