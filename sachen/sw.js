/*
 * Service Worker der Sachen-App (sachen/) – macht sie ohne Netz benutzbar.
 *
 * Sein Geltungsbereich ist /Boxenstopp/sachen/ (dieser Ordner). Boxenstopp
 * hat /Boxenstopp/ mit eigenem Worker (../sw.js); für Seiten hier gilt der
 * genauere Bereich, also dieser. Beide teilen sich den Ursprung
 * (finanzdienste.github.io) und damit localStorage und Cache Storage. Darum:
 *
 *   - Die Vorräte hier heißen „sachen-…“, nie „boxenstopp-…“: Boxenstopps
 *     Worker räumt beim Aktivieren alles mit „boxenstopp-“ weg, was nicht
 *     seins ist. Dieser hier fasst nur „sachen-…“ an.
 *   - boxenstopp-sachen-v1 (die Fotos der Sachen) gehört beiden: Die Seite
 *     legt sie selbst hinein (../js/ansicht-inventar.js). Hier nie gelöscht.
 *
 * Eine Fassung ist immer ganz: SHELL (die App, ../js/, ../css/, ../schrift/)
 * kommt beim Installieren auf einmal in den Vorrat sachen-<VERSION> und wird
 * danach nur noch daraus beantwortet – nie im Hintergrund einzeln erneuert.
 * Sonst stünde nach einem Deploy, solange dieser Worker noch läuft, ein
 * gemischter Stand im Vorrat (eine neue ../js/bilder.js neben einer alten
 * ./app.js), und die App bliebe beim nächsten Start bei „wird geladen“
 * stehen. Strategien:
 *
 *   SHELL           nur aus dem Vorrat; fehlt eine Datei dort doch, aus dem
 *                   Netz holen und ablegen.
 *   die Seite       (./ und ./index.html, der Teil hinter # und ? zählt
 *                   nicht) genauso – sie gehört zur Fassung.
 *   andere Seiten   unter sachen/: erst Netz, bei Fehlschlag (oder nach
 *                   GEDULD ohne Antwort) der Vorrat – als Ersatz immer
 *                   ./index.html dieser App, nie Boxenstopps Seite.
 *                   Abgelegt ohne den Teil hinter # (darin steht der
 *                   Zugang, #zugang=…).
 *   alles andere    (gleicher Ursprung: die Bildchen …) sofort aus dem
 *                   Vorrat, parallel erneuern.
 *
 * GitHub-API, die Produktdatenbanken und Supabase sind ein fremder Ursprung –
 * nicht angefasst. Kein Push: Sachen schickt keine Nachrichten.
 *
 * Neue Fassungen kommen nur über eine neue VERSION: Der Browser sieht nach
 * sw.js bei Seitenaufrufen, die App beim Start (registration.update()) und
 * wenn sie nach einer Weile wieder nach vorn kommt („aktualisieren“, app.js).
 * Ist sw.js anders, lädt der neue Worker die ganze SHELL frisch in seinen
 * eigenen Vorrat – fehlt dabei eine Datei (schlechtes Netz), gilt das Update
 * nicht, die alte Fassung bleibt, und der Browser versucht es später noch
 * einmal. Sonst übernimmt er gleich (skipWaiting, claim), räumt die alte
 * Fassung weg, und app.js lädt die Seite einmal neu (controllerchange).
 *
 * Beim ersten Besuch hält vielleicht noch Boxenstopps Worker die Seite (sein
 * Bereich schließt diesen ein) und gibt ../js/ aus seinem Vorrat – passt der
 * nicht zur App, meldet ein kleines Skript in index.html diesen Worker gleich
 * an und lädt einmal neu, sobald er die Seite hält.
 *
 * VERSION hochzählen, sobald sich eine Datei aus SHELL ändert – auch eine
 * geteilte unter ../js/ oder ../css/styles.css (dann zählen beide hoch:
 * ../sw.js und dieser). Ohne neue VERSION bekommt kein Handy die Änderung.
 * SHELL nennt jedes Modul, das ./app.js über seine Importe lädt; kommt in
 * ../js/ ein Import dazu, gehört er auch hierher.
 */

const VERSION = 'v12';
const CACHE = `sachen-${VERSION}`;
/** So lange wartet die App aufs Netz, dann nimmt sie den Vorrat (die Antwort kommt trotzdem noch hinein). */
const GEDULD = 4000;

const SHELL = [
  './',
  './index.html',
  './app.js',
  './sachen.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  '../css/styles.css',
  // Alles, was ./app.js lädt (auch über Ecken)
  '../js/amy-import.js',
  '../js/amy.js',
  '../js/angebote.js',
  '../js/ansicht-inventar.js',
  '../js/bilder.js',
  '../js/boxen.js',
  '../js/essensplan.js',
  '../js/fehler.js',
  '../js/format.js',
  '../js/foto.js',
  '../js/bildzoom.js',
  '../js/haushalt.js',
  '../js/inventar-ki.js',
  '../js/inventar-netz.js',
  '../js/web.js',
  '../js/inventar.js',
  '../js/kern.js',
  '../js/ki-rezept.js',
  '../js/ki.js',
  '../js/kosten.js',
  '../js/liste.js',
  '../js/speisekammer.js',
  '../js/reste.js',
  '../js/notizbuch.js',
  '../js/profil.js',
  '../js/sachen.js',
  '../js/scanner.js',
  '../js/speicher.js',
  '../js/vertraeglich.js',
  '../js/wuensche.js',
  '../js/zeiten.js',
  '../js/zielrechner.js',
  '../js/zugang.js',
  // Die Schriften aus ../css/styles.css – ohne Netz soll es genauso aussehen
  '../schrift/bricolage-grotesque.woff2',
  '../schrift/figtree.woff2',
  '../schrift/ibm-plex-mono-400.woff2',
  '../schrift/ibm-plex-mono-500.woff2',
  '../schrift/ibm-plex-mono-600.woff2',
  '../schrift/permanent-marker.woff2',
  '../schrift/pacifico.woff2',
  '../schrift/fredoka.woff2',
];

/** Die Adressen aus SHELL (ohne ? und #) – sie kommen nur aus dem Vorrat. */
const APP = new Set(SHELL.map((e) => new URL(e, self.location).href));
/** Die Seite der App: ./ und ./index.html. */
const SEITE = new URL('./', self.location).href;
const SEITEN = [SEITE, new URL('./index.html', self.location).href];

/**
 * Die Bildchen der Listen (INVENTAR_BILDER in ../js/bilder.js) und der Glitzer
 * im Kopf – sie dürfen beim Installieren fehlen (dann eben ohne Netz kein
 * Bildchen), ein Update hängt nicht daran.
 */
const BILDCHEN = ['womans-clothes', 'dress', 't-shirt', 'jeans', 'coat', 'high-heeled-shoe', 'running-shoe', 'lipstick', 'nail-polish', 'lotion-bottle', 'ring', 'gem-stone', 'handbag', 'sunglasses', 'books', 'package', 'sparkles'];

/*
 * Am Zwischenspeicher des Browsers vorbei laden: GitHub Pages schickt die
 * Dateien mit zehn Minuten Haltbarkeit, ein gewöhnliches fetch() bekäme die
 * alte Fassung (die Lehre aus der Workout-App).
 */
const frisch = (eingabe) => fetch(new Request(eingabe, { cache: 'reload' }));

const gut = (res) => res && res.ok && !res.redirected && res.type === 'basic';

self.addEventListener('install', (event) => {
  const holen = (cache, url) => frisch(url)
    .then((res) => (gut(res) ? cache.put(url, res) : null))
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
        ...BILDCHEN.map((b) => holen(cache, `../bilder/zutaten/${b}.svg`)),
      ]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Nur die eigenen alten Fassungen – nie etwas mit „boxenstopp-“ (Boxenstopps Vorräte, die Fotos der Sachen)
    const alte = (await caches.keys()).filter((k) => k.startsWith('sachen-') && k !== CACHE);
    await Promise.all(alte.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Kommt die App nach einer Weile wieder nach vorn (app.js): nach einer neuen Fassung schauen
self.addEventListener('message', (event) => {
  if (event.data?.boxenstopp === 'aktualisieren') event.waitUntil(self.registration.update().catch(() => null));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // GitHub-API, Datenbanken, Supabase und alles Fremde: nicht anfassen. Vom eigenen Ursprung nur, was zu Boxenstopp gehört.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('../', self.location).pathname)) return;

  const imVorrat = (req) => caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }));
  const ablegen = (req, res) => { const kopie = res.clone(); return caches.open(CACHE).then((c) => c.put(req, kopie)).catch(() => null); };
  // Die Adresse ohne ? und # – so steht SHELL im Vorrat; hinter # steht der Zugang (#zugang=), der gehört nie hinein
  const adresse = url.origin + url.pathname;

  /*
   * Ein Stück der Fassung (SHELL, die Seite): nur aus dem Vorrat. Fehlt es
   * dort doch, aus dem Netz – und dann abgelegt. Erneuert wird hier nichts:
   * Eine neue Fassung kommt ganz, mit dem nächsten Worker (s. o.).
   */
  const ausDerFassung = (schluessel) => event.respondWith((async () => {
    for (const k of schluessel) {
      const hit = await imVorrat(k);
      if (hit) return hit;
    }
    const res = await frisch(request);
    if (gut(res)) await ablegen(schluessel[0], res);
    return res;
  })());

  if (request.mode === 'navigate') {
    // Die eigene Seite (./, ./index.html – gleich, was hinter # oder ? steht): wie SHELL
    if (SEITEN.includes(adresse)) { ausDerFassung(adresse === SEITE ? SEITEN : [...SEITEN].reverse()); return; }
    /*
     * Eine andere Adresse unter sachen/: erst das Netz – aber nicht ewig:
     * Antwortet es nach GEDULD noch nicht, nimmt die Seite den Vorrat. Die
     * Antwort aus dem Netz kommt trotzdem noch hinein (dann ist es beim
     * nächsten Mal frisch). Ersatz ist immer die Seite dieser App –
     * ./index.html neben diesem Worker.
     */
    let ablage = Promise.resolve();
    const netz = frisch(request).then((res) => {
      if (gut(res)) ablage = ablegen(adresse, res);
      return res;
    });
    event.waitUntil(netz.then(() => ablage, () => null));
    const zuLange = new Promise((ok) => { setTimeout(() => ok(null), GEDULD); });
    event.respondWith(Promise.race([netz.catch(() => null), zuLange]).then(async (res) => {
      if (gut(res)) return res;
      const hit = (await imVorrat(adresse)) || (await imVorrat('./index.html'));
      if (hit) return hit;
      return res || netz.catch(() => Response.error());
    }));
    return;
  }

  if (APP.has(adresse)) { ausDerFassung([adresse]); return; }

  // Was nicht zur Fassung gehört (die Bildchen): sofort aus dem Vorrat, parallel erneuern
  let ablage = Promise.resolve();
  const erneuern = frisch(request).then((res) => {
    if (gut(res)) ablage = ablegen(request, res);
    return res;
  });
  event.waitUntil(erneuern.then(() => ablage, () => null));
  event.respondWith(imVorrat(request).then((hit) => hit || erneuern).catch(() => Response.error()));
});
