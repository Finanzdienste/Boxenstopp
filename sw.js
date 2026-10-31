/*
 * Service Worker von Boxenstopp – macht die App ohne Netz benutzbar.
 *
 * Sein Geltungsbereich ist /Boxenstopp/. Im selben Ursprung
 * (finanzdienste.github.io) liegen Workout und Freizeit mit eigenen Workern;
 * die Bereiche überschneiden sich nicht, und beim Aufräumen fasst dieser
 * Worker nur Vorräte an, die mit „boxenstopp-“ beginnen.
 *
 * Vier Strategien:
 *
 *   Seitenaufrufe    erst Netz, bei Fehlschlag der Zwischenspeicher.
 *   daten/*.json     erst Netz, bei Fehlschlag der Zwischenspeicher – neue
 *                    Rezepte sollen sofort da sein, alte nur ohne Netz.
 *   bilder/rezepte/  aus einem eigenen Vorrat (BILDER), der ein Update der
 *                    App übersteht; nur, was fehlt, kommt aus dem Netz. Ein
 *                    neues Rezeptfoto hat eine neue Adresse (?v=…), das alte
 *                    fliegt dann raus.
 *   Alles andere     sofort aus dem Zwischenspeicher, parallel erneuern –
 *                    auch die Zutaten-Bildchen, die schon beim Installieren
 *                    mitkommen (Liste in bilder/zutaten/alle.json).
 *
 * Die Einkaufsliste geht an api.github.com und damit nie durch diesen Worker
 * (fremder Ursprung, siehe unten).
 *
 * VERSION bei jeder Änderung an einer der unten gelisteten Dateien
 * hochzählen. Die Rezepte stehen bewusst nicht in SHELL: Wer nur ein Rezept
 * ändert, muss diese Datei nicht anfassen.
 */

const VERSION = 'v27';
const CACHE = `boxenstopp-${VERSION}`;
const BILDER = 'boxenstopp-bilder-v1';

const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/kern.js',
  './js/format.js',
  './js/liste.js',
  './js/bereiche.js',
  './js/weg.js',
  './js/gleich.js',
  './js/zeiten.js',
  './js/tempo.js',
  './js/kochstand.js',
  './js/kochmodus.js',
  './js/amy.js',
  './js/ansicht-amy.js',
  './js/amy-import.js',
  './js/push.js',
  './js/ansicht-push.js',
  './js/preisverlauf.js',
  './js/ansicht-tablet.js',
  './js/ki-rezept.js',
  './js/ki.js',
  './js/ansicht-ki.js',
  './js/timer.js',
  './js/lob.js',
  './js/kosten.js',
  './js/angebote.js',
  './js/bilder.js',
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
  './schrift/pacifico.woff2',
  './schrift/fredoka.woff2',
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
  const holen = (cache, url) => frisch(url)
    .then((res) => (res && res.ok ? cache.put(url, res) : null))
    .catch(() => null);
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all([
        ...SHELL.map((url) => holen(cache, url)),
        // Die Zutaten-Bildchen gehören zur Einkaufsliste – die muss auch im Laden ohne Netz gehen
        frisch('./bilder/zutaten/alle.json')
          .then((res) => (res.ok ? res.json() : []))
          .then((namen) => Promise.all(namen
            .filter((n) => /^[a-z0-9-]+$/.test(n))
            .map((n) => holen(cache, `./bilder/zutaten/${n}.svg`))))
          .catch(() => null),
      ]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('boxenstopp-') && k !== CACHE && k !== BILDER)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/*
 * Push-Nachrichten (werkzeug/push.mjs im Daten-Repo schickt sie): jede zeigt
 * sich als Mitteilung – auf iPhone und iPad muss das so sein. Antippen holt
 * die App nach vorn, am richtigen Reiter.
 */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { text: event.data ? event.data.text() : '' }; }
  const titel = String(d.titel || 'Boxenstopp').slice(0, 80);
  event.waitUntil(self.registration.showNotification(titel, {
    body: String(d.text || '').slice(0, 240),
    tag: String(d.tag || 'boxenstopp').slice(0, 40),
    renotify: true,
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { ziel: String(d.ziel || '').replace(/[^\w#-]/g, '').slice(0, 60) },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ziel = event.notification.data?.ziel || '';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
    const da = fenster.find((c) => c.url.startsWith(self.registration.scope));
    if (da) { da.postMessage({ boxenstopp: 'zeige', ziel }); return da.focus(); }
    // Ein Timer („chili#5“) öffnet das Rezept
    const anker = ziel.split('#')[0];
    return self.clients.openWindow(`./index.html${anker ? `#${anker}` : ''}`);
  }));
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
  if (url.pathname.startsWith(new URL('./bilder/rezepte/', self.location).pathname)) {
    event.respondWith(caches.open(BILDER).then((c) => c.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (gut(res)) {
        // Ablegen und ältere Fassungen desselben Fotos (andere ?v=) wegräumen
        event.waitUntil(c.put(request, res.clone())
          .then(() => c.keys())
          .then((alle) => Promise.all(alle
            .filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; })
            .map((k) => c.delete(k))))
          .catch(() => null));
      }
      return res;
    }))).catch(() => Response.error()));
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
