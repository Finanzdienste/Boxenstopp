/*
 * Service Worker von Boxenstopp – macht die App ohne Netz benutzbar.
 *
 * Sein Geltungsbereich ist /Boxenstopp/. Im selben Ursprung
 * (finanzdienste.github.io) liegen Workout und Freizeit mit eigenen Workern;
 * die Bereiche überschneiden sich nicht, und beim Aufräumen fasst dieser
 * Worker nur Vorräte an, die mit „boxenstopp-“ beginnen.
 *
 * Drei Strategien:
 *
 *   Seitenaufrufe    erst Netz, bei Fehlschlag der Zwischenspeicher.
 *   daten/*.json     erst Netz, bei Fehlschlag der Zwischenspeicher – neue
 *                    Rezepte sollen sofort da sein, alte nur ohne Netz.
 *   Alles andere     sofort aus dem Zwischenspeicher, parallel erneuern.
 *
 * Die Einkaufsliste geht an api.github.com und damit nie durch diesen Worker
 * (fremder Ursprung, siehe unten).
 *
 * VERSION bei jeder Änderung an einer der unten gelisteten Dateien
 * hochzählen. Die Rezepte stehen bewusst nicht in SHELL: Wer nur ein Rezept
 * ändert, muss diese Datei nicht anfassen.
 */

const VERSION = 'v17';
const CACHE = `boxenstopp-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/kern.js',
  './js/format.js',
  './js/liste.js',
  './js/bereiche.js',
  './js/zeiten.js',
  './js/ki-rezept.js',
  './js/ki.js',
  './js/ansicht-ki.js',
  './js/timer.js',
  './js/lob.js',
  './js/kosten.js',
  './js/angebote.js',
  './js/ansicht-angebote.js',
  './js/ansicht-anpassen.js',
  './js/speicher.js',
  './js/zugang.js',
  './js/ansicht-rezepte.js',
  './js/ansicht-liste.js',
  './schrift/bricolage-grotesque.woff2',
  './schrift/figtree.woff2',
  './schrift/ibm-plex-mono-400.woff2',
  './schrift/ibm-plex-mono-500.woff2',
  './schrift/ibm-plex-mono-600.woff2',
  './schrift/permanent-marker.woff2',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
];

/*
 * Am Zwischenspeicher des Browsers vorbei laden: GitHub Pages schickt die
 * Dateien mit zehn Minuten Haltbarkeit, ein gewöhnliches fetch() bekäme die
 * alte Fassung (die Lehre aus der Workout-App).
 */
const frisch = (eingabe) => fetch(new Request(eingabe, { cache: 'reload' }));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => frisch(url)
        .then((res) => (res && res.ok ? cache.put(url, res) : null))
        .catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('boxenstopp-') && k !== CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // GitHub-API und alles Fremde: nicht anfassen.
  if (url.origin !== self.location.origin) return;

  const imVorrat = (req) => caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }));
  const gut = (res) => res && res.ok && !res.redirected && res.type === 'basic';
  const ablegen = (req, res) => { const kopie = res.clone(); caches.open(CACHE).then((c) => c.put(req, kopie)); };

  const erstNetz = (fallback) => frisch(request)
    .then((res) => {
      if (gut(res)) { ablegen(request, res); return res; }
      return fallback().then((hit) => hit || res);
    })
    .catch(() => fallback().then((hit) => hit || Response.error()));

  if (request.mode === 'navigate') {
    event.respondWith(erstNetz(() => imVorrat(request).then((hit) => hit || imVorrat('./index.html'))));
    return;
  }
  if (url.pathname.startsWith(new URL('./daten/', self.location).pathname)) {
    event.respondWith(erstNetz(() => imVorrat(request)));
    return;
  }

  event.respondWith(
    imVorrat(request).then((hit) => {
      const erneuern = frisch(request)
        .then((res) => { if (gut(res)) ablegen(request, res); return res; })
        .catch(() => hit);
      return hit || erneuern;
    }),
  );
});
