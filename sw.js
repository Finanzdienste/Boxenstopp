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
 *   Seitenaufrufe    erst Netz, bei Fehlschlag (oder nach GEDULD ohne
 *                    Antwort – schlechtes Netz im Laden) der Zwischenspeicher.
 *   daten/*.json     genauso – neue Rezepte sollen sofort da sein, alte nur
 *                    ohne Netz. In einem eigenen Vorrat (DATEN), der ein
 *                    Update der App übersteht; gefragt wird mit „no-cache“
 *                    (unverändert: nur ein kurzes 304 statt 600 KB).
 *   bilder/rezepte/  aus einem eigenen Vorrat (BILDER), der ein Update der
 *                    App übersteht. Alle Fotos aus daten/rezepte.json holt
 *                    der Worker von selbst (fotosVorrat) – ohne Netz soll
 *                    jedes Rezept sein Foto haben, nicht nur die schon
 *                    gesehenen. Ein neues Rezeptfoto hat eine neue Adresse
 *                    (?v=…), das alte fliegt dann raus.
 *   Alles andere     sofort aus dem Zwischenspeicher, parallel erneuern –
 *                    auch die Zutaten-Bildchen, die schon beim Installieren
 *                    mitkommen (Liste in bilder/zutaten/alle.json).
 *
 * Ein Update gilt erst, wenn die ganze App (SHELL) geladen ist – sonst
 * bleibt die alte Fassung, und der Browser versucht es später noch einmal.
 * Auffrischen ohne Neustart: Kommt die App nach einer Weile wieder nach vorn,
 * schickt sie „aktualisieren“; auf Android (installiert) ruft Chrome
 * zusätzlich ab und zu „periodicsync“ – beides holt Daten und Fotos frisch
 * und schaut nach einer neuen Fassung.
 *
 * Die Einkaufsliste geht an api.github.com und damit nie durch diesen Worker
 * (fremder Ursprung, siehe unten).
 *
 * VERSION bei jeder Änderung an einer der unten gelisteten Dateien
 * hochzählen. Die Rezepte stehen bewusst nicht in SHELL: Wer nur ein Rezept
 * ändert, muss diese Datei nicht anfassen.
 */

const VERSION = 'v55';
const CACHE = `boxenstopp-${VERSION}`;
const BILDER = 'boxenstopp-bilder-v1';
const DATEN = 'boxenstopp-daten-v1';
const DATEN_DATEIEN = ['daten/rezepte.json', 'daten/angebote.json', 'daten/preisverlauf.json'];
/** So lange wartet die App aufs Netz, dann nimmt sie den Vorrat (die Antwort kommt trotzdem noch hinein). */
const GEDULD = 4000;

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
  './js/boxen.js',
  './js/ansicht-boxen.js',
  './js/reste.js',
  './js/ansicht-reste.js',
  './js/katalog.js',
  './js/ansicht-katalog.js',
  './js/doppel.js',
  './js/ansicht-doppel.js',
  './js/tempo.js',
  './js/kochstand.js',
  './js/kochmodus.js',
  './js/waage.js',
  './js/wiegen.js',
  './js/amy.js',
  './js/ansicht-amy.js',
  './js/amy-import.js',
  './js/push.js',
  './js/ansicht-push.js',
  './js/ansicht-einstellungen.js',
  './js/haushalt.js',
  './js/ansicht-haushalt.js',
  './js/ansicht-todo.js',
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
  './js/zielrechner.js',
  './js/ansicht-ziel.js',
  './js/profil.js',
  './js/speisekarte.js',
  './js/ansicht-speisekarte.js',
  './js/gaeste.js',
  './js/ansicht-gaeste.js',
  './js/einzelheiten.js',
  './js/ansicht-willkommen.js',
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
  './icon-lila.svg',
  './icon-lila-192.png',
  './icon-lila-512.png',
  './icon-lila-maskable-512.png',
  './manifest-lila.webmanifest',
];

/*
 * Am Zwischenspeicher des Browsers vorbei laden: GitHub Pages schickt die
 * Dateien mit zehn Minuten Haltbarkeit, ein gewöhnliches fetch() bekäme die
 * alte Fassung (die Lehre aus der Workout-App).
 */
const frisch = (eingabe) => fetch(new Request(eingabe, { cache: 'reload' }));

const gut = (res) => res && res.ok && !res.redirected && res.type === 'basic';

self.addEventListener('install', (event) => {
  const holen = (cache, url) => frisch(url)
    .then((res) => (res && res.ok ? cache.put(url, res) : null))
    .catch(() => null);
  // Die App selbst muss ganz da sein: Fehlt eine Datei (schlechtes Netz), gilt das Update nicht –
  // sonst flöge beim Aktivieren die alte, vollständige Fassung weg, und ohne Netz fehlte ein Stück
  const streng = (cache, url) => frisch(url).then((res) => {
    if (!res || !res.ok) throw new Error(`${url}: ${res ? res.status : 'kein Netz'}`);
    return cache.put(url, res);
  });
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all([
        ...SHELL.map((url) => streng(cache, url)),
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
  event.waitUntil((async () => {
    const daten = await caches.open(DATEN);
    const alte = (await caches.keys()).filter((k) => k.startsWith('boxenstopp-') && k !== CACHE && k !== BILDER && k !== DATEN);
    for (const k of alte) {
      // Früher lagen Rezepte & Co. im Vorrat der Fassung – erst retten, dann wegräumen
      // (sonst wären sie ohne Netz weg, bis die App sie neu lädt)
      try {
        const alt = await caches.open(k);
        for (const req of await alt.keys()) {
          if (!new URL(req.url).pathname.includes('/daten/') || await daten.match(req, { ignoreSearch: true })) continue;
          const res = await alt.match(req);
          if (res) await daten.put(new URL(req.url).href.split('?')[0], res);
        }
      } catch { /* dann eben nicht */ }
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

/*
 * Alle Rezeptfotos aus daten/rezepte.json in den Vorrat (BILDER): Was schon
 * da ist, bleibt; fehlende kommen aus dem Netz (je vier auf einmal), alte
 * Fassungen (anderes ?v=) und Fotos von Rezepten, die es nicht mehr gibt,
 * fliegen raus. Läuft nach jedem frischen daten/rezepte.json.
 */
let fotosLaeuft = null;
function fotosVorrat() {
  fotosLaeuft = fotosLaeuft || (async () => {
    const res = await (await caches.open(DATEN)).match(new URL('daten/rezepte.json', self.registration.scope).href, { ignoreSearch: true });
    if (!res) return;
    let rezepte = [];
    try { rezepte = (await res.json()).rezepte || []; } catch { return; }
    const soll = new Map(); // Pfad → Adresse mit ?v=
    for (const r of rezepte) {
      if (typeof r?.bild !== 'string' || !/^bilder\/rezepte\/[a-z0-9-]+\.webp(\?v=[0-9a-f]+)?$/.test(r.bild)) continue;
      const u = new URL(r.bild, self.registration.scope);
      soll.set(u.pathname, u.href);
    }
    if (!soll.size) return;
    const c = await caches.open(BILDER);
    const da = new Set();
    for (const k of await c.keys()) {
      const u = new URL(k.url);
      if (soll.get(u.pathname) === u.href) da.add(u.href);
      else await c.delete(k);
    }
    const fehlt = [...soll.values()].filter((href) => !da.has(href));
    for (let i = 0; i < fehlt.length; i += 4) {
      await Promise.all(fehlt.slice(i, i + 4).map((href) => fetch(href)
        .then((r) => (gut(r) ? c.put(href, r) : null))
        .catch(() => null)));
    }
  })().catch(() => null).finally(() => { fotosLaeuft = null; });
  return fotosLaeuft;
}

/** Daten und Fotos frisch in den Vorrat, und nachsehen, ob es eine neue App-Fassung gibt. */
let auffrischenLaeuft = null;
function auffrischen() {
  auffrischenLaeuft = auffrischenLaeuft || (async () => {
    const daten = await caches.open(DATEN);
    await Promise.all(DATEN_DATEIEN.map(async (pfad) => {
      const href = new URL(pfad, self.registration.scope).href;
      try {
        const res = await fetch(new Request(href, { cache: 'no-cache' }));
        if (gut(res)) await daten.put(href, res);
      } catch { /* ohne Netz: der Vorrat bleibt */ }
    }));
    await fotosVorrat();
    await self.registration.update().catch(() => null);
  })().catch(() => null).finally(() => { auffrischenLaeuft = null; });
  return auffrischenLaeuft;
}

// Kommt die App nach einer Weile wieder nach vorn (app.js), und auf Android ab und zu im Hintergrund
self.addEventListener('message', (event) => {
  if (event.data?.boxenstopp === 'aktualisieren') event.waitUntil(auffrischen());
});
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'boxenstopp-aktualisieren') event.waitUntil(auffrischen());
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

  const imVorrat = (req, name = CACHE) => caches.open(name).then((c) => c.match(req, { ignoreSearch: true }));
  const ablegen = (req, res) => { const kopie = res.clone(); caches.open(CACHE).then((c) => c.put(req, kopie)); };

  /*
   * Erst das Netz – aber nicht ewig: Antwortet es nach GEDULD noch nicht, nimmt
   * die Seite den Vorrat. Die Antwort aus dem Netz kommt trotzdem noch in den
   * Vorrat (dann ist es beim nächsten Mal frisch); danach: was dann noch zu tun ist.
   */
  const erstNetz = (laden, name, fallback, danach = null) => {
    let ablage = Promise.resolve();
    const netz = laden().then((res) => {
      if (gut(res)) {
        const kopie = res.clone();
        ablage = caches.open(name).then((c) => c.put(request, kopie)).then(() => danach?.()).catch(() => null);
      }
      return res;
    });
    event.waitUntil(netz.then(() => ablage, () => null));
    const zuLange = new Promise((ok) => { setTimeout(() => ok(null), GEDULD); });
    return Promise.race([netz.catch(() => null), zuLange]).then(async (res) => {
      if (gut(res)) return res;
      const hit = await fallback();
      if (hit) return hit;
      return res || netz.catch(() => Response.error());
    });
  };

  if (request.mode === 'navigate') {
    event.respondWith(erstNetz(() => frisch(request), CACHE, () => imVorrat(request).then((hit) => hit || imVorrat('./index.html'))));
    return;
  }
  if (url.pathname.startsWith(new URL('./daten/', self.location).pathname)) {
    const rezepte = url.pathname.endsWith('/daten/rezepte.json');
    event.respondWith(erstNetz(() => fetch(new Request(request, { cache: 'no-cache' })), DATEN, () => imVorrat(request, DATEN), rezepte ? fotosVorrat : null));
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
