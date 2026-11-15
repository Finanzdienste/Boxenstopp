/*
 * Amys Sachen als eigene App (sachen/, Daten in sachen.json – js/sachen.js).
 *
 * Ohne Browser: sachen.json bereinigen, Änderungen anwenden (Löschen merkt
 * sich weg, eine ältere Fassung kommt danach nicht zurück, Rückgängig nimmt
 * den Eintrag wieder heraus), die Commit-Nachricht, eigene Speicher-Schlüssel;
 * der Umzug aus liste.json (umzugZusammen, opUmgezogen); die beiden Service
 * Worker (SHELL nennt jedes Modul, das sachen/app.js lädt, Aufräumen,
 * Seitenaufrufe ohne Netz, Boxenstopps Worker lässt sachen/ in Ruhe) samt
 * Versionspflicht (tests/daten/sachen-fassung.json); Manifest und Seite.
 *
 * Im Browser gegen die nachgebaute GitHub-API: ohne Zugang, Links (mit und
 * ohne Namen, Gast), Amy legt Listen und Sachen an (sachen.json, nie
 * liste.json), sortiert, sucht, „Hab ich das schon?“, ein Foto, Tobis Handy,
 * Löschen mit Rückgängig; Scannen mit Nachschlagen (Kamera, Taschenlampe,
 * Open Beauty Facts, Claude, Shop-Bild, „Mit KI ausfüllen“ – alles
 * nachgebaut); das iPhone (Link kopieren, Einfügen); der Umzug beim Start
 * (auch, wenn er erst beim zweiten oder dritten Versuch klappt), der erste
 * Start ohne Netz, Verbinden nach einem Gast; die Service Worker ohne Netz –
 * gegen einen eigenen Server (Port 8137), der abgeschaltet wird (Playwrights
 * Offline-Schalter trifft den Worker nicht) –, ein Deploy, während der Worker
 * läuft (ohne neue VERSION bleibt die alte Fassung ganz, mit neuer kommt die
 * neue ganz), und der erste Besuch unter Boxenstopps Worker (auch dem alten
 * von v79, dessen Vorrat nicht zur App passt).
 */
import { readFileSync, existsSync, mkdtempSync, mkdirSync, readdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, ROOT, APP_URL, SACHEN_URL, SCHLUESSEL } from './hilfe.mjs';
import { starte } from './server.mjs';
import { sachenBereinigen, sachenAnwenden, sachenNachricht, leerSachen, umzugZusammen, ART_SACHEN, MAX_WEG, SACHEN_PFAD } from '../js/sachen.js';
import { ART_LISTE } from '../js/speicher.js';
import { opInvListe, opInvListeWeg, opDing, opDingWeg, opUmgezogen, MAX_DINGE, FOTO_PFAD } from '../js/inventar.js';
import { leer, anwenden, bereinigen, opZusammen } from '../js/liste.js';
import { INVENTAR_BILDER } from '../js/bilder.js';
import { PRODUKT_BILD } from '../js/inventar-netz.js';
import { ANBIETER } from '../js/ki.js';

const { check, ende } = pruefer();

/* ------------------------------------------------------------------ Node */

/** n Minuten nach 8 Uhr am 10.11.2026 – als Zeitpunkt einer Änderung. */
const zeit = (n) => new Date(Date.UTC(2026, 10, 10, 8, n)).toISOString();
const sortiert = (o) => JSON.stringify(Object.entries(o || {}).sort());

// sachen.json bereinigen
const LEER = JSON.stringify(leerSachen());
check([null, undefined, 'kaputt', 42, [1, 2]].every((x) => JSON.stringify(sachenBereinigen(x)) === LEER) && JSON.parse(LEER).version === 1 && JSON.parse(LEER).rev === 0 && LEER.includes('"weg":{}'), 'sachen.json kaputt, leer oder kein Objekt: ein leerer Stand (version 1, rev 0, keine Sachen, nichts gelöscht)');
check(sachenBereinigen({ rev: 7.8 }).rev === 7 && sachenBereinigen({ rev: '12' }).rev === 12 && sachenBereinigen({ rev: -3 }).rev === 0 && sachenBereinigen({ rev: 'x' }).rev === 0 && sachenBereinigen({ version: 9, rev: 2 }).version === 1, 'rev: eine ganze Zahl ab 0 (sonst 0), version immer 1');
const roh = {
  rev: 3,
  inventar: { listen: { 'sl-kleid001': { name: 'Kleidung', bild: 'dress' }, 'kaputt!': { name: 'x' } }, dinge: { 'sd-bluse001': { liste: 'sl-kleid001', name: 'Bluse', foto: { pfad: '../liste.json' } }, 'nicht-sd': {} } },
  weg: { 'sd-alt00001': zeit(1), 'sl-alt00001': zeit(2), quatsch: zeit(3), 'sd-leer0001': '', 'sd-zahl0001': 5, 'sd-lang0001': 'x'.repeat(41) },
  fremd: 'weg damit',
};
const b0 = sachenBereinigen(roh);
check(Object.keys(b0.inventar.listen).join() === 'sl-kleid001' && Object.keys(b0.inventar.dinge).join() === 'sd-bluse001' && b0.inventar.dinge['sd-bluse001'].foto === null && b0.rev === 3, 'inventar bereinigt wie in liste.json: falsche ids weg, ein Foto nur mit erlaubtem Pfad');
check(Object.keys(b0.weg).sort().join() === 'sd-alt00001,sl-alt00001' && !('fremd' in b0), 'weg: nur ids von Listen und Sachen mit Zeitpunkt – Kaputtes und Fremdes fällt raus');
const vieleWeg = Object.fromEntries(Array.from({ length: MAX_WEG + 5 }, (_, i) => [`sd-w${String(i).padStart(6, '0')}`, new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString()]));
const bw = sachenBereinigen({ weg: vieleWeg });
check(Object.keys(bw.weg).length === MAX_WEG && !bw.weg['sd-w000000'] && !bw.weg['sd-w000004'] && !!bw.weg['sd-w000005'] && !!bw.weg[`sd-w${String(MAX_WEG + 4).padStart(6, '0')}`], `weg merkt sich höchstens ${MAX_WEG} Löschungen – die neuesten`);

// Änderungen anwenden
const kleid = { id: 'sl-kleid001', name: 'Kleidung', bild: 'dress', reihe: 1 };
const bluse = { id: 'sd-bluse001', liste: 'sl-kleid001', name: 'Blümchenbluse', marke: 'Testmarke', notiz: 'Größe S', tags: ['Sommer'], code: '4006381333931', foto: null, reihe: 1 };
const rock = { id: 'sd-rock0001', liste: 'sl-kleid001', name: 'Abendrock', marke: '', notiz: '', tags: [], code: '', foto: null, reihe: 2 };
const start = leerSachen();
const s = sachenAnwenden(start, [opInvListe(kleid, 'Amy', zeit(10)), opDing(bluse, 'Amy', zeit(11)), opDing(rock, 'Amy', zeit(12))]);
check(s.inventar.listen['sl-kleid001']?.name === 'Kleidung' && s.inventar.dinge['sd-bluse001']?.marke === 'Testmarke' && !!s.inventar.dinge['sd-rock0001'] && s.inventar.dinge['sd-bluse001'].by === 'Amy' && JSON.stringify(start) === LEER, 'Änderungen anwenden (auch mehrere auf einmal): Liste und Sachen da – der alte Stand bleibt, wie er war');
const ohneBluse = sachenAnwenden(s, opDingWeg('sd-bluse001', zeit(20)));
check(!ohneBluse.inventar.dinge['sd-bluse001'] && ohneBluse.weg['sd-bluse001'] === zeit(20) && !!s.inventar.dinge['sd-bluse001'], 'Löschen: die Sache ist weg, in weg steht, wann');
const aeltere = sachenAnwenden(ohneBluse, opDing({ ...bluse, notiz: 'offline geändert' }, 'Tobi', zeit(15)));
check(!aeltere.inventar.dinge['sd-bluse001'] && aeltere.weg['sd-bluse001'] === zeit(20), 'eine ältere Fassung (von einem Handy, das offline war) kommt nach dem Löschen nicht zurück');
const neuere = sachenAnwenden(ohneBluse, opDing({ ...bluse, notiz: 'danach geändert' }, 'Amy', zeit(25)));
check(neuere.inventar.dinge['sd-bluse001']?.notiz === 'danach geändert' && !('sd-bluse001' in neuere.weg), 'eine neuere Fassung schon – dann ist sie nicht mehr gelöscht');
const frueh = sachenAnwenden(s, opDingWeg('sd-bluse001', zeit(5)));
check(!!frueh.inventar.dinge['sd-bluse001'] && !('sd-bluse001' in frueh.weg), 'Löschen, das älter ist als die letzte Änderung: die Sache bleibt, kein Eintrag in weg');
const ohneListe = sachenAnwenden(s, opInvListeWeg('sl-kleid001', zeit(30)));
check(!ohneListe.inventar.listen['sl-kleid001'] && !Object.keys(ohneListe.inventar.dinge).length && ['sl-kleid001', 'sd-bluse001', 'sd-rock0001'].every((id) => ohneListe.weg[id] === zeit(30)), 'Liste löschen: ihre Sachen gehen mit – die Liste und beide Sachen stehen in weg');
check(!sachenAnwenden(ohneListe, opDing(rock, 'Tobi', zeit(29))).inventar.dinge['sd-rock0001'] && !sachenAnwenden(ohneListe, opInvListe(kleid, 'Tobi', zeit(29))).inventar.listen['sl-kleid001'], 'auch die Liste und ihre Sachen kommen in einer älteren Fassung nicht zurück');
const zurueck = sachenAnwenden(ohneListe, opZusammen({}, {}, { inventar: s.inventar }));
check(!!zurueck.inventar.listen['sl-kleid001'] && Object.keys(zurueck.inventar.dinge).length === 2 && !Object.keys(zurueck.weg).length, 'Rückgängig (opZusammen mit den Sachen): alles wieder da, die Einträge in weg sind weg');
const nurBluse = sachenAnwenden(ohneBluse, opZusammen({}, {}, { inventar: { listen: {}, dinge: { 'sd-bluse001': s.inventar.dinge['sd-bluse001'] } } }));
check(!!nurBluse.inventar.dinge['sd-bluse001'] && !('sd-bluse001' in nurBluse.weg), 'Rückgängig nach dem Löschen einer Sache: wieder da, nicht mehr in weg');

// Die Commit-Nachricht und die Art für speicher.js github()
const zwei = [opDing(bluse, 'Amy'), opDing(rock, 'Amy')];
check(sachenNachricht(zwei, leerSachen(), s, { name: 'Amy' }) === 'Amy: Sachen, 2 Änderungen' && sachenNachricht([zwei[0]], leerSachen(), s, { name: 'Amy' }) === 'Amy: Sachen, 1 Änderung' && sachenNachricht(zwei[0], leerSachen(), s, { name: 'Amy' }) === 'Amy: Sachen, 1 Änderung', 'Commit-Nachricht: „Amy: Sachen, 2 Änderungen“ bzw. „Amy: Sachen, 1 Änderung“');
const nachrichten = [sachenNachricht(zwei, leerSachen(), s, { name: 'Amy' }), sachenNachricht([opDingWeg('sd-bluse001')], s, ohneBluse, { name: 'Tobi' }), ART_SACHEN.nachricht(zwei, leerSachen(), s, { name: 'Amy', rezeptName: () => 'Chili' })];
check(nachrichten.every((n) => !/Blümchenbluse|Abendrock|Testmarke|Größe|Sommer|Kleidung|4006381333931|Chili|Bescheid|To Do|·/.test(n)), `nie, was es ist – kein Name, keine Marke, kein „· Bescheid“ oder „· To Do“ (${nachrichten.join(' | ')})`);
const schluesselS = Object.values(ART_SACHEN.speicher);
const schluesselL = Object.values(ART_LISTE.speicher);
check(ART_SACHEN.pfad === 'sachen.json' && SACHEN_PFAD === 'sachen.json' && schluesselS.length === 2 && new Set(schluesselS).size === 2 && schluesselS.every((k) => /^boxenstopp\.sachen\./.test(k)) && !schluesselS.some((k) => schluesselL.includes(k)), `ART_SACHEN: sachen.json mit eigenen Speicher-Schlüsseln (${schluesselS.join(', ')}) – nicht die von liste.json (${schluesselL.join(', ')})`);
check(JSON.stringify(ART_SACHEN.leer()) === LEER && ART_SACHEN.bereinigen === sachenBereinigen && ART_SACHEN.anwenden === sachenAnwenden && ART_SACHEN.nachtrag().length === 0, 'ART_SACHEN rechnet mit sachen.js (leer, bereinigen, anwenden) und trägt nichts nach');

// Der Umzug aus liste.json
const L = (id, name, g) => ({ id, name, bild: 'dress', reihe: 1, at: zeit(0), geaendert: g, by: 'Amy' });
const D = (id, name, g, liste = 'sl-kleid001') => ({ id, liste, name, marke: '', notiz: '', tags: [], code: '', foto: null, reihe: 1, at: zeit(0), geaendert: g, by: 'Amy' });
const sachenVorher = sachenBereinigen({
  rev: 4,
  inventar: {
    listen: { 'sl-kleid001': L('sl-kleid001', 'Kleidung neu', zeit(30)) },
    dinge: { 'sd-alt00001': D('sd-alt00001', 'Neuere Fassung', zeit(30)), 'sd-ersatz01': D('sd-ersatz01', 'Alte Fassung', zeit(10)) },
  },
  weg: { 'sd-weg00001': zeit(30), 'sd-zurueck1': zeit(10) },
});
const ausListe = {
  listen: { 'sl-kleid001': L('sl-kleid001', 'Kleidung alt', zeit(20)), 'sl-schuh001': L('sl-schuh001', 'Schuhe', zeit(20)) },
  dinge: {
    'sd-neu00001': D('sd-neu00001', 'Neu dazu', zeit(20)),
    'sd-alt00001': D('sd-alt00001', 'Ältere Fassung', zeit(20)),
    'sd-ersatz01': D('sd-ersatz01', 'Neuere aus der Liste', zeit(20)),
    'sd-weg00001': D('sd-weg00001', 'Gelöscht', zeit(20)),
    'sd-zurueck1': D('sd-zurueck1', 'Nach dem Löschen geändert', zeit(20)),
  },
};
const vorherText = JSON.stringify(sachenVorher);
const u = umzugZusammen(sachenVorher, ausListe);
const ud = u.stand.inventar.dinge;
check(JSON.stringify(sachenVorher) === vorherText, 'umzugZusammen ändert den Stand, den es bekommt, nicht');
check(ud['sd-neu00001']?.name === 'Neu dazu' && u.stand.inventar.listen['sl-schuh001']?.name === 'Schuhe', 'Umzug: was in sachen.json fehlt, kommt dazu');
check(ud['sd-ersatz01']?.name === 'Neuere aus der Liste' && ud['sd-alt00001']?.name === 'Neuere Fassung' && u.stand.inventar.listen['sl-kleid001'].name === 'Kleidung neu', 'die neuere Fassung gewinnt – eine ältere aus der Liste ersetzt nichts');
check(!ud['sd-weg00001'] && u.stand.weg['sd-weg00001'] === zeit(30), 'eine Sache, die nach dieser Fassung gelöscht wurde, bleibt weg');
check(ud['sd-zurueck1']?.name === 'Nach dem Löschen geändert' && !('sd-zurueck1' in u.stand.weg), 'nach dem Löschen noch geändert: sie kommt wieder (und ist nicht mehr gelöscht)');
check(sortiert(u.umgezogen.listen) === sortiert({ 'sl-kleid001': zeit(20), 'sl-schuh001': zeit(20) }) && sortiert(u.umgezogen.dinge) === sortiert(Object.fromEntries(Object.keys(ausListe.dinge).map((id) => [id, zeit(20)]))), 'umgezogen: alles aus der Liste mit seiner Fassung – auch die ältere und die gelöschte (die dürfen aus liste.json weg)');
check(u.neu.listen === 1 && u.neu.dinge === 3 && u.stand.rev === 4, `neu: nur, was dazukam oder ersetzt wurde (1 Liste, 3 Sachen – ${u.neu.listen}, ${u.neu.dinge}); rev zählt erst beim Schreiben`);
const u2 = umzugZusammen(u.stand, ausListe);
check(u2.neu.listen === 0 && u2.neu.dinge === 0 && JSON.stringify(u2.stand) === JSON.stringify(u.stand) && sortiert(u2.umgezogen.dinge) === sortiert(u.umgezogen.dinge), 'zweimal hintereinander: beim zweiten Mal nichts Neues – der Stand bleibt, umgezogen ist dasselbe');
const volleDinge = Object.fromEntries(Array.from({ length: MAX_DINGE }, (_, i) => { const id = `sd-v${String(i).padStart(5, '0')}`; return [id, D(id, `Sache ${i}`, zeit(10))]; }));
const voll = sachenBereinigen({ inventar: { listen: {}, dinge: volleDinge } });
const zuviel = { listen: {}, dinge: { 'sd-zuviel01': D('sd-zuviel01', 'Zu viel', zeit(20)), 'sd-v00007': D('sd-v00007', 'Sache 7 neu', zeit(20)) } };
const uv = umzugZusammen(voll, zuviel);
check(Object.keys(uv.stand.inventar.dinge).length === MAX_DINGE && !uv.stand.inventar.dinge['sd-zuviel01'] && !('sd-zuviel01' in uv.umgezogen.dinge) && uv.stand.inventar.dinge['sd-v00007'].name === 'Sache 7 neu' && uv.umgezogen.dinge['sd-v00007'] === zeit(20) && uv.neu.dinge === 1, `sachen.json voll (${MAX_DINGE} Sachen): eine neue bleibt in der Liste (nicht umgezogen) – eine vorhandene wird trotzdem ersetzt`);
// opUmgezogen über liste.js: nur Fassungen, die höchstens so neu sind wie die umgezogene
const liste0 = bereinigen({ ...leer(), rev: 9, inventar: ausListe });
const liste1 = anwenden(liste0, opDing({ ...ausListe.dinge['sd-neu00001'], name: 'Danach in der Liste geändert' }, 'Tobi', zeit(40)));
const liste2 = anwenden(liste1, opUmgezogen(u.umgezogen));
check(Object.keys(liste2.inventar.dinge).join() === 'sd-neu00001' && liste2.inventar.dinge['sd-neu00001'].name === 'Danach in der Liste geändert' && !Object.keys(liste2.inventar.listen).length, 'opUmgezogen (liste.js anwenden) nimmt genau die umgezogenen Fassungen aus liste.json – eine danach geänderte bleibt für den nächsten Umzug');
const listeVoll = anwenden(bereinigen({ ...leer(), inventar: zuviel }), opUmgezogen(uv.umgezogen));
check(Object.keys(listeVoll.inventar.dinge).join() === 'sd-zuviel01', 'was nicht umziehen konnte (sachen.json voll), bleibt in liste.json');

/* ------------------------------------------------------- Service Worker */

const SW_S = readFileSync(path.join(ROOT, 'sachen', 'sw.js'), 'utf8');
const SW_B = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const VERSION_S = /const VERSION = '([^']+)'/.exec(SW_S)?.[1];
const VERSION_B = /const VERSION = '([^']+)'/.exec(SW_B)?.[1];
/** Die Einträge einer Liste in sw.js (SHELL, BILDCHEN) – ohne Kommentare. */
const swListe = (src, name) => [...(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(src)?.[1] || '').replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
const SHELL_S = swListe(SW_S, 'SHELL');
const BILDCHEN_S = swListe(SW_S, 'BILDCHEN');
/** Pfad im Repo – relativ zu sachen/ (SHELL, Seite) oder zu einer Datei. */
const imRepo = (von, eintrag) => path.relative(ROOT, path.resolve(ROOT, von, eintrag)).split(path.sep).join('/');
const SHELL_REPO = SHELL_S.map((e) => (e === './' ? 'sachen/index.html' : imRepo('sachen', e)));
const ERLAUBT = /^(?:sachen|js|css|schrift|bilder)\//;

/** Alle Module, die eine Datei über ihre Importe lädt (statisch und dynamisch, nur relative) – Pfade im Repo; fehlt eins, steht es in fehlen. */
function importe(datei, gesehen = new Set(), fehlen = []) {
  if (gesehen.has(datei)) return { gesehen, fehlen };
  gesehen.add(datei);
  let src = '';
  try { src = readFileSync(path.join(ROOT, datei), 'utf8'); } catch { fehlen.push(datei); return { gesehen, fehlen }; }
  const muster = [/^\s*(?:import|export)\s[^;]*?\bfrom\s*['"]([^'"]+)['"]/gm, /^\s*import\s*['"]([^'"]+)['"]/gm, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g];
  for (const re of muster) {
    for (const m of src.matchAll(re)) if (m[1].startsWith('.')) importe(imRepo(path.dirname(datei), m[1]), gesehen, fehlen);
  }
  return { gesehen, fehlen };
}
const { gesehen: geladenSet, fehlen: importFehlt } = importe('sachen/app.js');
const GELADEN = [...geladenSet];
const nichtInShell = GELADEN.filter((f) => !SHELL_REPO.includes(f));
check(GELADEN.length > 20 && !importFehlt.length && !nichtInShell.length, `SHELL (sachen/sw.js) nennt jedes Modul, das sachen/app.js über seine Importe lädt, auch über Ecken in ../js/ (${GELADEN.length})${nichtInShell.length ? ` – es fehlen: ${nichtInShell.join(', ')}` : ''}${importFehlt.length ? ` – Import ins Leere: ${importFehlt.join(', ')}` : ''}`);
const tot = SHELL_REPO.filter((f) => !existsSync(path.join(ROOT, f)));
check(SHELL_S.includes('./') && SHELL_S.includes('./index.html') && !tot.length, `jeden Eintrag in SHELL gibt es als Datei${tot.length ? ` – nicht da: ${tot.join(', ')}` : ''}`);
const cssUrls = ['css/styles.css', 'sachen/sachen.css'].flatMap((c) => [...readFileSync(path.join(ROOT, c), 'utf8').matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]).filter((x) => !/^(?:data:|https?:|#)/.test(x)).map((x) => imRepo(path.dirname(c), x)));
check(cssUrls.length >= 6 && cssUrls.every((f) => SHELL_REPO.includes(f)), `alles, was die Stylesheets laden (die Schriften), steht in SHELL${cssUrls.filter((f) => !SHELL_REPO.includes(f)).map((f) => ` – nicht: ${f}`).join('')}`);
const ohneBildchen = INVENTAR_BILDER.filter((x) => !BILDCHEN_S.includes(x));
check(!ohneBildchen.length && BILDCHEN_S.includes('sparkles') && BILDCHEN_S.every((x) => existsSync(path.join(ROOT, 'bilder', 'zutaten', `${x}.svg`))), `BILDCHEN enthält INVENTAR_BILDER (js/bilder.js) und den Glitzer, jedes gibt es unter bilder/zutaten/${ohneBildchen.length ? ` – es fehlen: ${ohneBildchen.join(', ')}` : ''}`);
check(/const CACHE = `sachen-\$\{VERSION\}`;/.test(SW_S) && [...SW_S.matchAll(/caches\.open\(([^)]*)\)/g)].every((m) => m[1].trim() === 'CACHE'), 'sachen/sw.js: der Vorrat heißt sachen-<VERSION> – einen anderen öffnet er nicht');

/**
 * Einen Worker in Node laden (vm) – mit nachgebautem self, caches und einem
 * fetch ohne Netz. vorrat: „<Vorrat> <Adresse>“ → () => Response.
 */
function workerLaden(datei, ort, { vorraete = [], vorrat = {} } = {}) {
  const hoerer = {};
  const geoeffnet = [];
  const geloescht = [];
  const adresse = (x) => new URL(typeof x === 'string' ? x : x.url, ort).href;
  const caches = {
    keys: async () => [...vorraete],
    has: async (n) => vorraete.includes(n),
    delete: async (n) => { geloescht.push(n); return true; },
    open: async (name) => {
      geoeffnet.push(name);
      return { match: async (req) => vorrat[`${name} ${adresse(req)}`]?.(), put: async () => {}, keys: async () => [], delete: async () => true };
    },
  };
  class Anfrage { constructor(e, o = {}) { this.url = adresse(e); this.method = e.method || 'GET'; this.mode = e.mode || 'cors'; this.cache = o.cache || 'default'; } }
  const self = {
    location: new URL(ort),
    addEventListener: (typ, f) => { hoerer[typ] = f; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => null },
    registration: { scope: new URL('./', ort).href, update: async () => {}, showNotification: async () => {} },
  };
  vm.runInNewContext(readFileSync(path.join(ROOT, datei), 'utf8'), { self, caches, fetch: async () => { throw new TypeError('Failed to fetch'); }, Request: Anfrage, Response, URL, setTimeout, clearTimeout, console });
  /** Ein fetch-Ereignis: die Antwort als Text – oder null, wenn der Worker nicht antwortet (dann geht es ans Netz). */
  const holen = async (url, mode = 'navigate') => {
    let antwort = null;
    hoerer.fetch({ request: { url, method: 'GET', mode }, respondWith: (p) => { antwort = Promise.resolve(p); }, waitUntil: () => {} });
    if (!antwort) return null;
    const res = await antwort.catch(() => null);
    return typeof res?.text === 'function' ? res.text() : '(keine Antwort)';
  };
  const aktivieren = async () => { let p = null; hoerer.activate({ waitUntil: (x) => { p = x; } }); await p; return geloescht; };
  return { hoerer, geoeffnet, holen, aktivieren };
}

const ORT = 'https://finanzdienste.github.io/Boxenstopp/';
const VORRAETE = ['boxenstopp-v1', `boxenstopp-${VERSION_B}`, 'boxenstopp-sachen-v1', 'boxenstopp-bilder-v1', 'boxenstopp-daten-v1', 'sachen-v0', `sachen-${VERSION_S}`, 'workout-v263'];
const ws = workerLaden('sachen/sw.js', `${ORT}sachen/sw.js`, {
  vorraete: VORRAETE,
  vorrat: { [`sachen-${VERSION_S} ${ORT}sachen/index.html`]: () => new Response('SACHEN'), [`boxenstopp-${VERSION_B} ${ORT}index.html`]: () => new Response('BOXENSTOPP') },
});
const wegS = await ws.aktivieren();
check(JSON.stringify(wegS) === '["sachen-v0"]', `sachen/sw.js beim Aktivieren: nur eigene alte Vorräte (sachen-…) weg – nichts mit boxenstopp- (gelöscht: ${wegS.join(', ')})`);
const seiteS = await ws.holen(`${ORT}sachen/irgendwo?x=1#zugang=geheim`);
check(seiteS === 'SACHEN', `sachen/sw.js: ein Seitenaufruf ohne Netz bekommt ./index.html der Sachen-App (${seiteS})`);
check(ws.geoeffnet.length > 0 && ws.geoeffnet.every((n) => n === `sachen-${VERSION_S}`) && await ws.holen('https://api.github.com/repos/x/y/contents/sachen.json', 'cors') === null, `sachen/sw.js öffnet nur seinen Vorrat (${[...new Set(ws.geoeffnet)].join(', ')}), GitHub fasst er nicht an`);
const wb = workerLaden('sw.js', `${ORT}sw.js`, { vorraete: VORRAETE, vorrat: { [`boxenstopp-${VERSION_B} ${ORT}index.html`]: () => new Response('BOXENSTOPP') } });
const wegB = await wb.aktivieren();
check(JSON.stringify(wegB) === '["boxenstopp-v1"]', `Boxenstopps sw.js beim Aktivieren: sachen-… und boxenstopp-sachen-v1 bleiben stehen (gelöscht: ${wegB.join(', ')})`);
const sachenAnfragen = [[`${ORT}sachen/`, 'navigate'], [`${ORT}sachen`, 'navigate'], [`${ORT}sachen/index.html#zugang=x`, 'navigate'], [`${ORT}sachen/app.js`, 'cors'], [`${ORT}sachen/manifest.webmanifest`, 'cors']];
const beantwortet = [];
for (const [url, mode] of sachenAnfragen) if (await wb.holen(url, mode) !== null) beantwortet.push(url);
check(!beantwortet.length && /if \(zurSachenApp\(url\.href\)\) return;/.test(SW_B), `Boxenstopps sw.js beantwortet keine Anfrage unter sachen/ (zurSachenApp)${beantwortet.length ? ` – doch: ${beantwortet.join(', ')}` : ''}`);
check(await wb.holen(`${ORT}index.html`) === 'BOXENSTOPP' && await wb.holen(`${ORT}sachenkiste`) === 'BOXENSTOPP', 'Boxenstopps eigene Seiten (auch eine, die nur mit „sachen“ anfängt) beantwortet er weiter – ohne Netz aus seinem Vorrat');

/*
 * Versionspflicht: Ein Abdruck über alles, was der Worker der Sachen-App
 * vorhält (SHELL, die Bildchen) – auch die geteilten Dateien unter ../js/
 * und ../css/styles.css. Ändert sich eine, muss VERSION in sachen/sw.js
 * hochzählen (sonst holen die Handys sie nie: der Worker gibt die App nur aus
 * seinem Vorrat), und hier wird der neue Stand gemerkt. Eine VERSION zählt
 * nur hoch (vN, als Zahl): Weicht sie von der gemerkten ab, geht es nur
 * weiter, wenn sie größer ist – kleiner oder gleich ist ein Fehler, und
 * vorgeschlagen wird nie, die gemerkte zurückzusetzen (eine Fassung, die die
 * Handys schon kennen, bekämen sie nicht noch einmal).
 */
const ABDRUCK_DATEIEN = [...new Set([...SHELL_REPO, ...BILDCHEN_S.map((x) => `bilder/zutaten/${x}.svg`)])].sort();
const hash = createHash('sha256');
for (const f of ABDRUCK_DATEIEN) {
  hash.update(`${f}\n`);
  hash.update(existsSync(path.join(ROOT, f)) ? readFileSync(path.join(ROOT, f)) : 'fehlt');
  hash.update('\n');
}
const ABDRUCK = hash.digest('hex');
const FASSUNG = path.join(ROOT, 'tests', 'daten', 'sachen-fassung.json');
let gemerkt = null;
try { gemerkt = JSON.parse(readFileSync(FASSUNG, 'utf8')); } catch { gemerkt = null; }
const neueWerte = (version) => `{ "version": "${version}", "abdruck": "${ABDRUCK}" }`;
/** Die Nummer einer VERSION (v12 → 12) – null, wenn sie nicht so aussieht. */
const nummer = (v) => { const m = /^v(\d+)$/.exec(String(v ?? '')); return m ? Number(m[1]) : null; };
const naechste = (v) => (nummer(v) === null ? `${v}+1` : `v${nummer(v) + 1}`);
if (!gemerkt) check(false, `tests/daten/sachen-fassung.json fehlt – anlegen: ${neueWerte(VERSION_S)}`);
else if (gemerkt.version === VERSION_S && gemerkt.abdruck !== ABDRUCK) check(false, `sachen/sw.js: VERSION hochzählen (eine Datei aus SHELL hat sich geändert) und tests/daten/sachen-fassung.json nachziehen: ${neueWerte(naechste(VERSION_S))}`);
else if (gemerkt.version === VERSION_S) check(true, `sachen/sw.js: VERSION ${VERSION_S} passt zum Stand der ${ABDRUCK_DATEIEN.length} Dateien aus SHELL und BILDCHEN (tests/daten/sachen-fassung.json)`);
else if (nummer(VERSION_S) !== null && nummer(gemerkt.version) !== null && nummer(VERSION_S) > nummer(gemerkt.version)) check(false, `sachen/sw.js: VERSION von ${gemerkt.version} auf ${VERSION_S} hochgezählt – jetzt tests/daten/sachen-fassung.json nachziehen: ${neueWerte(VERSION_S)}`);
else {
  const weiter = naechste(gemerkt.version);
  check(false, `sachen/sw.js: VERSION ${VERSION_S} ist nicht größer als die gemerkte ${gemerkt.version} (tests/daten/sachen-fassung.json) – eine VERSION zählt nur hoch, nie zurück, und die gemerkte bleibt stehen. In sachen/sw.js VERSION auf ${weiter} setzen, dann tests/daten/sachen-fassung.json nachziehen: ${neueWerte(weiter)}`);
}

/* ------------------------------------------------------ Manifest, Seite */

const M = JSON.parse(readFileSync(path.join(ROOT, 'sachen', 'manifest.webmanifest'), 'utf8'));
check(M.id === '/Boxenstopp/sachen/' && M.scope === './' && M.start_url === './' && M.display === 'standalone' && JSON.parse(readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8')).id !== M.id, `Manifest: eigene Kennung /Boxenstopp/sachen/ (${M.id}) – eine eigene App neben Boxenstopp –, startet und bleibt in sachen/, eigenes Fenster`);
check(/^#[0-9a-f]{6}$/i.test(M.background_color) && /^#[0-9a-f]{6}$/i.test(M.theme_color) && M.lang === 'de' && M.short_name === 'Sachen', `Manifest: Farben (${M.background_color}, ${M.theme_color}), deutsch, kurz „Sachen“`);
/** Breite×Höhe aus dem Kopf einer PNG-Datei – null, wenn es keine ist. */
function pngGroesse(datei) {
  const x = readFileSync(datei);
  if (x.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || x.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return `${x.readUInt32BE(16)}x${x.readUInt32BE(20)}`;
}
const symbolFehler = M.icons.map((i) => {
  const f = path.join(ROOT, 'sachen', i.src);
  if (!existsSync(f)) return `${i.src}: fehlt`;
  if (i.type === 'image/png') { const g = pngGroesse(f); return g === i.sizes ? '' : `${i.src}: ${g || 'kein PNG'} statt ${i.sizes}`; }
  if (i.type === 'image/svg+xml') return i.sizes === 'any' && /<svg[\s>]/.test(readFileSync(f, 'utf8')) ? '' : `${i.src}: kein SVG`;
  return `${i.src}: ${i.type}?`;
}).filter(Boolean);
check(M.icons.length >= 3 && !symbolFehler.length && M.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512') && M.icons.some((i) => i.sizes === '192x192'), `jedes Symbol gibt es und hat laut PNG-Kopf die angegebene Größe (192, 512, maskable)${symbolFehler.length ? ` – ${symbolFehler.join('; ')}` : ''}`);
check(M.icons.every((i) => SHELL_S.includes(`./${i.src}`)) && SHELL_S.includes('./manifest.webmanifest'), 'Manifest und Symbole liegen im Vorrat (SHELL)');
const HTML = readFileSync(path.join(ROOT, 'sachen', 'index.html'), 'utf8');
const TAGS = [...HTML.matchAll(/<(link|script|img|source|iframe|video|audio)\b([^>]*)>/g)].map((m) => ({ tag: m[1], attr: Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])) }));
const rel = (r) => TAGS.find((t) => t.tag === 'link' && t.attr.rel === r)?.attr.href;
check(rel('manifest') === 'manifest.webmanifest' && rel('icon') === 'icon.svg' && rel('apple-touch-icon') === 'icon-192.png' && TAGS.some((t) => t.tag === 'link' && t.attr.rel === 'stylesheet' && t.attr.href === '../css/styles.css') && TAGS.some((t) => t.tag === 'script' && t.attr.type === 'module' && t.attr.src === 'app.js'), 'sachen/index.html: Manifest, Symbole (auch fürs iPhone), ../css/styles.css und app.js als Modul');
const seiteLaedt = TAGS.map((t) => t.attr.href || t.attr.src).filter((x) => x && !/^(?:https?:|data:|#)/.test(x)).map((x) => imRepo('sachen', x));
const appImporte = [...readFileSync(path.join(ROOT, 'sachen', 'app.js'), 'utf8').matchAll(/^\s*import\s[^;]*?\bfrom\s*'([^']+)'/gm)].map((m) => imRepo('sachen', m[1]));
const alles = [...seiteLaedt, ...GELADEN, ...SHELL_REPO, ...cssUrls, ...BILDCHEN_S.map((x) => imRepo('sachen', `../bilder/zutaten/${x}.svg`))];
const ausDerWurzel = [...new Set(alles.filter((f) => !ERLAUBT.test(f)))];
check(!ausDerWurzel.length && appImporte.length > 5 && appImporte.every((f) => /^js\//.test(f)) && seiteLaedt.every((f) => SHELL_REPO.includes(f)), `Keine Seite der App lädt etwas aus Boxenstopps Wurzel – nur sachen/, ../js, ../css, ../schrift, ../bilder; alles von der Seite liegt im Vorrat${ausDerWurzel.length ? ` – doch: ${ausDerWurzel.join(', ')}` : ''}`);
check(/serviceWorker\.register\('\.\/sw\.js'\)/.test(readFileSync(path.join(ROOT, 'sachen', 'app.js'), 'utf8')), 'sachen/app.js meldet ./sw.js an (den eigenen Worker, nicht ../sw.js)');

/* --------------------------------------------------------------- Browser */

const browser = await starteBrowser();
const ORIGIN = new URL(APP_URL).origin;
const SACHEN_ADRESSE = new URL('sachen/', APP_URL).href;
const AKEY = 'sk-ant-api03-TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST-TESTTEST';
const CODE = '4006381333931';
const LIPPEN = '4000000000013';
const SCHUHE = '4000000000044';
const SEITE = 'https://www.beispiel-shop.de/p/wanderschuhe-grau-123';
const BILD = path.join(ROOT, 'icon-512.png');
const BILD_ROH = readFileSync(BILD);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const BEREIT = () => document.documentElement.dataset.bereit === '1';
const ohneSchluessel = (t) => String(t || '').split(SCHLUESSEL).join('<Schlüssel>');
const alleFehler = [];

// Chrome auf Android liest Strichcodes selbst – nachgebaut (mit __still: noch keiner im Bild)
const LESER = 'window.BarcodeDetector = class { static async getSupportedFormats() { return ["ean_13", "ean_8", "qr_code"]; } async detect() { return window.__still ? [] : [{ rawValue: window.__code || "4006381333931", format: "ean_13" }]; } };';
// Eine Kamera hinten (nachgebaut, wie in test-inventar): ein Bild mit Strichen und eine Taschenlampe – was mit ihr geschieht, steht in __kamera
const KAMERA = `(() => {
  window.__kamera = { licht: [], gestoppt: 0, anfragen: 0 };
  navigator.mediaDevices.enumerateDevices = async () => [{ deviceId: 'haupt', label: 'camera2 0, facing back', kind: 'videoinput', groupId: 'g' }];
  navigator.mediaDevices.getUserMedia = async () => {
    window.__kamera.anfragen++;
    const cv = document.createElement('canvas');
    cv.width = 640;
    cv.height = 480;
    const g = cv.getContext('2d');
    const malen = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 480); g.fillStyle = '#000'; for (let x = 80; x < 560; x += 14) g.fillRect(x, 150, 7, 180); };
    malen();
    const takt = setInterval(malen, 100);
    const s = cv.captureStream(15);
    const t = s.getVideoTracks()[0];
    t.getSettings = () => ({ deviceId: 'haupt', width: 640, height: 480 });
    t.getCapabilities = () => ({ torch: true });
    t.applyConstraints = async (k) => { const a = k?.advanced?.[0] || {}; if ('torch' in a) window.__kamera.licht.push(a.torch); };
    const stop = t.stop.bind(t);
    t.stop = () => { window.__kamera.gestoppt++; clearInterval(takt); stop(); };
    return s;
  };
})();`;

/**
 * Ein Handy mit der Sachen-App (hilfe.mjs handy mit adresse: SACHEN_URL) –
 * die KI-Anbieter nie echt (wer sie braucht, legt danach seine Attrappe
 * darüber). zugang/ki: vorher eingetragen, dann neu geladen.
 */
async function geraet({ attrappe = null, zugang = null, ki = '', adresse = SACHEN_URL, skript = null, datenbank = null, userAgent, rechte = null } = {}) {
  const h = await handy(browser, { attrappe, adresse, skript, datenbank, userAgent, rechte, takt: 400 });
  await h.ctx.route('https://api.anthropic.com/**', (r) => r.abort('blockedbyclient'));
  await h.ctx.route('https://generativelanguage.googleapis.com/**', (r) => r.abort('blockedbyclient'));
  if (zugang || ki) {
    await h.page.evaluate(([z, k]) => {
      if (z) localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify(z));
      if (k) localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: k, stand: new Date().toISOString() }));
    }, [zugang, ki]);
    await h.page.reload();
    await h.page.waitForFunction(BEREIT);
  }
  alleFehler.push(h.fehler);
  return h;
}
const gespeichert = (p, k) => p.evaluate((x) => JSON.parse(localStorage.getItem(x) || 'null'), k);
const vorschlaege = (p) => bis(async () => (await p.locator('#inv [data-inv-vorschlag]').count()) > 0);

// --- Ohne Zugang: die Karte zum Verbinden
{
  const { ctx, page } = await geraet({ attrappe: githubAttrappe() });
  check(await page.isVisible('#s-form') && await page.isHidden('#sachen') && (await page.textContent('#sync-text')) === 'Nicht verbunden' && (await page.innerText('#s-karte')).includes('Mit eurer Liste verbinden') && (await page.title()) === 'Sachen', 'Ohne Zugang: die Karte zum Verbinden – keine Sachen, oben „Nicht verbunden“');
  await ctx.close();
}

// --- Ein Link ohne fuer: das Formular
{
  const a = githubAttrappe();
  const { ctx, page } = await geraet({ attrappe: a, adresse: `${SACHEN_URL}#zugang=${SCHLUESSEL}` });
  check(await page.isVisible('#s-form') && (await page.inputValue('#s-token')) === SCHLUESSEL && !(await gespeichert(page, 'boxenstopp.zugang.v1')), 'Link ohne fuer: das Formular, der Schlüssel steht drin – verbunden ist noch nicht');
  await page.fill('#s-name', 'Amy');
  await page.click('#s-los');
  check(await vorschlaege(page) && (await gespeichert(page, 'boxenstopp.zugang.v1'))?.name === 'Amy' && await page.isHidden('#s-karte'), 'mit Namen „Verbinden“: verbunden, die Sachen (noch leer, mit Vorschlägen) stehen da');
  await ctx.close();
}

// --- Ein Gast (eigene Liste): die Karte „in Boxenstopp“, GitHub wird nichts gefragt
{
  const a = githubAttrappe({ repo: 'Boxenstopp-Testgast' });
  let anGithub = 0;
  const { ctx, page } = await geraet({ attrappe: { route: (r) => { anGithub++; return a.route(r); } }, zugang: { token: SCHLUESSEL, name: 'Gast', daten: 'Finanzdienste/Boxenstopp-Testgast' } });
  await page.waitForTimeout(1200);
  check((await page.innerText('#s-karte')).includes('Deine Sachen sind in Boxenstopp') && (await page.getAttribute('#s-karte a.amy-btn', 'href')) === '../' && (await page.textContent('#sync-text')) === 'In Boxenstopp' && await page.isHidden('#sachen'), 'Gast mit eigener Liste: die Karte „Deine Sachen sind in Boxenstopp“ mit dem Weg dorthin, oben „In Boxenstopp“');
  check(anGithub === 0 && a.zustand.gets === 0 && !Object.keys(a.zustand.lesen).length, `und GitHub wird nichts gefragt (${anGithub} Anfragen)`);
  await ctx.close();
}
{
  const { ctx, page } = await geraet({ attrappe: githubAttrappe(), adresse: `${SACHEN_URL}#zugang=${SCHLUESSEL}&daten=Finanzdienste/Boxenstopp-Testgast&fuer=Gast` });
  check((await page.innerText('#s-karte')).includes('Der Link gehört zu Boxenstopp') && (await page.getAttribute('#s-karte a.amy-btn', 'href')).startsWith('../#zugang=') && !(await gespeichert(page, 'boxenstopp.zugang.v1')), 'Der Link einer eigenen Liste: „Der Link gehört zu Boxenstopp“ – mit dem Link dorthin, hier nicht verbunden');
  await ctx.close();
}

// --- Amy: der Link mit Namen und KI-Schlüssel verbindet gleich
const gh = githubAttrappe();
const sachen = () => gh.datei('sachen.json');
const dinge = () => Object.values(sachen()?.inventar?.dinge || {});
const sache = (name) => dinge().find((d) => d.name === name);
const mitNummer = (c) => dinge().find((d) => d.code === c);
const listeId = (name) => Object.values(sachen()?.inventar?.listen || {}).find((l) => l.name === name)?.id;
const amyH = await geraet({ attrappe: gh, adresse: `${SACHEN_URL}#zugang=${SCHLUESSEL}&fuer=Amy&ki=${AKEY}`, skript: LESER });
const amy = amyH.page;
const zA = await bis(() => gespeichert(amy, 'boxenstopp.zugang.v1'));
check(zA?.token === SCHLUESSEL && zA.name === 'Amy' && (await amy.evaluate(() => location.hash)) === '', 'Link mit fuer=Amy: gleich verbunden (boxenstopp.zugang.v1 mit Namen), die Adresse danach ohne #');
check((await gespeichert(amy, 'boxenstopp.ki.v1'))?.schluessel === AKEY, 'der KI-Schlüssel aus dem Link steht in boxenstopp.ki.v1');
check(await vorschlaege(amy) && await amy.isHidden('#s-karte') && await bis(async () => (await amy.textContent('#sync-text')) === 'Geteilt') && /nur für dich/i.test(await amy.innerText('#s-kopf')) && await amy.isHidden('#s-ios-dlg'), 'danach: die Sachen (noch leer, mit Vorschlägen), keine Karte, oben „Geteilt“, im Kopf „nur für dich“ – auf Android kein iPhone-Popup');

// Liste aus dem Vorschlag, eine Sache mit allem
await amy.click('#inv [data-inv-vorschlag="Kleidung"]');
check(await bis(() => !!listeId('Kleidung')) && (await amy.innerText('#inv-titel')) === 'Kleidung', 'Liste aus dem Vorschlag: „Kleidung“ steht in sachen.json und ist gleich offen');
const kleidungId = listeId('Kleidung');
await amy.click('[data-act="inv-ding-neu"]');
await amy.fill('#inv-name', 'Blümchenbluse');
await amy.fill('#inv-marke', 'Testmarke');
await amy.fill('#inv-notiz', 'Größe S, ausgedacht');
await amy.fill('#inv-tag-text', 'Sommer');
await amy.press('#inv-tag-text', 'Enter');
await amy.fill('#inv-code', CODE);
await amy.press('#inv-code', 'Enter');
check(await bis(() => { const d = sache('Blümchenbluse'); return d?.marke === 'Testmarke' && d.notiz === 'Größe S, ausgedacht' && d.tags.join() === 'Sommer' && d.code === CODE && d.liste === kleidungId && d.by === 'Amy'; }, 8000), 'eine Sache mit Name, Marke, Notiz, Tag und Strichcode – in sachen.json');
const nachSachen = () => gh.zustand.commits.filter((c) => c.pfad === 'sachen.json').reverse().map((c) => c.message);
check(nachSachen().length >= 2 && nachSachen().every((m) => /^Amy: Sachen, \d+ Änderung(?:en)?$/.test(m)) && nachSachen()[0] === 'Amy: Sachen, 1 Änderung', `Commits an sachen.json: „Amy: Sachen, n Änderung(en)“ (${nachSachen().join(' | ')})`);
check(!gh.zustand.nachrichten.some((m) => /Blümchenbluse|Testmarke|Größe|Sommer|Kleidung|4006381333931|Bescheid|To Do/.test(m)), 'nie, was es ist – kein Name, keine Marke, kein „· Bescheid“, kein „· To Do“');
const textS = gh.zustand.dateien['sachen.json'];
check(textS === `${JSON.stringify(JSON.parse(textS), null, 1)}\n` && JSON.parse(textS).version === 1, 'sachen.json: JSON mit 1 Leerzeichen Einrückung, Zeilenumbruch am Ende, version 1');
check(gh.zustand.puts === 0 && gh.zustand.datei === null, 'liste.json wird nicht geschrieben');

// Sortieren, Suchen, „Hab ich das schon?“
await amy.click('[data-act="inv-ding-zu"]');
await amy.click('[data-act="inv-ding-neu"]');
await amy.fill('#inv-name', 'Abendrock');
await amy.click('[data-act="inv-ding-zu"]');
const namen = () => amy.locator('.inv-ding-k b').allInnerTexts().then((x) => x.join());
check(await bis(async () => (await namen()) === 'Blümchenbluse,Abendrock') && await bis(() => !!sache('Abendrock')), 'eine zweite Sache: in eigener Reihenfolge ans Ende');
await amy.selectOption('#inv-sort', 'name');
check(await bis(async () => (await namen()) === 'Abendrock,Blümchenbluse'), 'Sortieren: Name A–Z');
await amy.selectOption('#inv-sort', 'eigen');
await amy.click('[data-act="inv-zu"]');
await amy.fill('#inv-suche', 'testmarke');
check(await bis(async () => (await amy.locator('#inv-inhalt .inv-ding-k b').allInnerTexts()).join() === 'Blümchenbluse'), 'Suchen: „testmarke“ findet die Blümchenbluse');
await amy.fill('#inv-suche', '');
await amy.click('[data-act="inv-scannen"][data-zweck="finden"]');
await amy.waitForSelector('#scan-dlg[open]');
await amy.setInputFiles('#scan-datei', BILD);
check(await bis(async () => (await amy.locator('#inv-name').count()) === 1 && (await amy.inputValue('#inv-name')) === 'Blümchenbluse') && await bis(async () => (await amy.innerText('#toast')).includes('Hast du schon')), '„Hab ich das schon?“ mit einem Strichcode, den es gibt: öffnet die Sache – „Hast du schon“');

// Ein Foto: ins Daten-Repo, in sachen.json nur pfad und sha
await amy.setInputFiles('#inv-foto-datei', BILD);
const fotoPfad = () => sache('Blümchenbluse')?.foto?.pfad || '';
check(await bis(() => FOTO_PFAD.test(fotoPfad()) && !!gh.zustand.roh[fotoPfad()], 8000) && gh.zustand.roh[fotoPfad()].subarray(0, 3).toString('hex') === 'ffd8ff', `Foto: als JPEG ins Daten-Repo unter sachen/sd-…jpg (${fotoPfad()})`);
check(Object.keys(sache('Blümchenbluse').foto).sort().join() === 'pfad,sha' && sache('Blümchenbluse').foto.sha === gh.zustand.shas[fotoPfad()] && !/base64|data:image/.test(gh.zustand.dateien['sachen.json']), 'in sachen.json nur pfad und sha – kein Bild darin');
check(gh.zustand.commits.some((c) => c.pfad === fotoPfad() && c.message === 'Amy: Foto für die Sachen'), 'der Commit dazu: „Amy: Foto für die Sachen“');

// Hineinzoomen (Tobi: „Man soll auch ranzoomen können“): das Foto antippen → ganz und groß; zwei Finger, doppelt tippen, Rad, −, verschieben, zu
await amy.click('[data-act="inv-zoom"]');
check(await bis(() => amy.evaluate(() => {
  const b = document.querySelector('#zoom-dlg[open] .zoom-bild');
  return !!b && /^blob:/.test(b.src) && b.complete && b.naturalWidth > 0;
})), 'Foto antippen: groß im Zoom (#zoom-dlg, das Foto der Sache)');
const zStufe = () => amy.evaluate(() => Number(document.querySelector('#zoom-dlg').dataset.zoom));
const zVersatz = () => amy.evaluate(() => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(document.querySelector('#zoom-dlg .zoom-bild').style.transform); return m ? [Number(m[1]), Number(m[2])] : null; });
const zFlaeche = () => amy.evaluate(() => { const r = document.querySelector('#zoom-dlg .zoom-flaeche').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
check(await zStufe() === 1 && (await amy.evaluate(() => window.getComputedStyle(document.querySelector('#zoom-dlg .zoom-bild')).objectFit)) === 'contain' && (await amy.evaluate(() => window.getComputedStyle(document.querySelector('#zoom-dlg .zoom-flaeche')).touchAction)) === 'none', 'erst ganz zu sehen (1-fach, nicht beschnitten); die Seite selbst zoomt nicht mit (touch-action: none)');
const zf = await zFlaeche();
// Zwei Finger auseinander, um die Mitte: von 80 auf 240 px Abstand
await amy.evaluate(() => {
  const f = document.querySelector('#zoom-dlg .zoom-flaeche');
  const r = f.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const ev = (typ, id, x) => f.dispatchEvent(new window.PointerEvent(typ, { pointerId: id, clientX: x, clientY: cy, pointerType: 'touch', isPrimary: id === 11, bubbles: true }));
  ev('pointerdown', 11, cx - 40);
  ev('pointerdown', 12, cx + 40);
  for (let i = 1; i <= 8; i++) { ev('pointermove', 11, cx - 40 - i * 10); ev('pointermove', 12, cx + 40 + i * 10); }
  ev('pointerup', 11, cx - 120);
  ev('pointerup', 12, cx + 120);
});
const zPinch = await zStufe();
const [px, py] = (await zVersatz()) || [NaN, NaN];
check(Math.abs(zPinch - 3) < 0.05, `zwei Finger auseinander: dreifach hineingezoomt (${zPinch}-fach)`);
check(Math.abs(px - (zf.w / 2 - (zf.w / 2) * zPinch)) < 2 && Math.abs(py - (zf.h / 2 - (zf.h / 2) * zPinch)) < 2, `die Stelle zwischen den Fingern bleibt, wo sie war (${Math.round(px)}, ${Math.round(py)})`);
// Mit einem Finger (hier der Maus) verschieben – nie weiter, als das Bild reicht
await amy.mouse.move(zf.l + zf.w / 2, zf.t + zf.h / 2);
await amy.mouse.down();
await amy.mouse.move(zf.l + zf.w / 2 + 60, zf.t + zf.h / 2 + 30, { steps: 6 });
await amy.mouse.up();
const [vx, vy] = await zVersatz();
check(Math.abs(vx - px - 60) < 2 && Math.abs(vy - py - 30) < 2, `gezoomt: mit einem Finger verschieben (+60, +30 → ${Math.round(vx - px)}, ${Math.round(vy - py)})`);
await amy.mouse.move(zf.l + 5, zf.t + 5);
await amy.mouse.down();
await amy.mouse.move(zf.l + zf.w - 5, zf.t + zf.h - 5, { steps: 6 });
await amy.mouse.move(zf.l + zf.w - 5 + 2000, zf.t + zf.h - 5 + 2000, { steps: 4 });
await amy.mouse.up();
const [rx, ry] = await zVersatz();
// Bis an den Rand des Fotos selbst – nicht in den schwarzen Rand daneben (object-fit: contain)
const zRand = await amy.evaluate(() => {
  const b = document.querySelector('#zoom-dlg .zoom-bild');
  const r = document.querySelector('#zoom-dlg .zoom-flaeche').getBoundingClientRect();
  const s = Number(document.querySelector('#zoom-dlg').dataset.zoom);
  const g = Math.min(r.width / b.naturalWidth, r.height / b.naturalHeight);
  return [-((r.width - b.naturalWidth * g) / 2) * s, -((r.height - b.naturalHeight * g) / 2) * s];
});
check(Math.abs(rx - zRand[0]) < 2 && Math.abs(ry - zRand[1]) < 2, `nicht über den Rand hinaus: höchstens bis an die Kante des Fotos (${Math.round(rx)}, ${Math.round(ry)} = ${Math.round(zRand[0])}, ${Math.round(zRand[1])})`);
// Doppelt tippen: gezoomt → zurück auf 1; noch einmal → 2,5-fach an der Stelle
await amy.mouse.dblclick(zf.l + zf.w / 2, zf.t + zf.h / 2);
check(await bis(async () => (await zStufe()) === 1), 'doppelt tippen, gezoomt: zurück auf ganz');
await amy.mouse.dblclick(zf.l + zf.w / 4, zf.t + zf.h / 4);
check(await bis(async () => (await zStufe()) === 2.5), 'doppelt tippen: 2,5-fach hinein');
await amy.mouse.move(zf.l + zf.w / 2, zf.t + zf.h / 2);
await amy.mouse.wheel(0, -4000);
check(await bis(async () => (await zStufe()) === 6), 'Mausrad: hinein, höchstens 6-fach');
await amy.click('#zoom-dlg [data-zoom-stufe="aus"]');
check(Math.abs((await zStufe()) - 6 / 1.6) < 0.02, `„−“: heraus (${await zStufe()}-fach)`);
await amy.click('#zoom-dlg .zoom-zu');
check(await bis(() => amy.evaluate(() => !document.querySelector('#zoom-dlg[open]'))) && (await amy.inputValue('#inv-name')) === 'Blümchenbluse', '× schließt – die Sache ist noch offen');
await amy.click('[data-act="inv-zoom"]');
await amy.keyboard.press('Escape');
check(await bis(() => amy.evaluate(() => !document.querySelector('#zoom-dlg[open]'))), 'Esc schließt auch');

// Neu laden: was die Seite lädt – nur aus sachen/, ../js, ../css, ../schrift, ../bilder, alles da
await amy.click('[data-act="inv-ding-zu"]');
await amy.click('[data-act="inv-zu"]');
const angefragt = [];
const anfragen = [];
const merkeAnfrage = (r) => { const x = new URL(r.url()); if (x.origin === ORIGIN) angefragt.push(x.pathname); };
const merke = (r) => { const x = new URL(r.url()); if (x.origin === ORIGIN) anfragen.push({ pfad: x.pathname, status: r.status() }); };
const fehlgeschlagen = [];
// Abgebrochen (ERR_ABORTED) heißt nur: Die Ansicht hat sich neu gezeichnet, bevor ein Bildchen da war – kein Fehler
const merkeFehl = (r) => { if (new URL(r.url()).origin === ORIGIN && !/ERR_ABORTED/.test(r.failure()?.errorText || '')) fehlgeschlagen.push(`${new URL(r.url()).pathname} (${r.failure()?.errorText})`); };
amy.on('request', merkeAnfrage);
amy.on('response', merke);
amy.on('requestfailed', merkeFehl);
await amy.reload();
await amy.waitForFunction(BEREIT);
await bis(async () => (await amy.locator('#inv .inv-liste-k').count()) > 0);
await bis(() => amy.evaluate(() => [...document.images].every((i) => i.complete)), 4000);
amy.off('request', merkeAnfrage);
amy.off('response', merke);
amy.off('requestfailed', merkeFehl);
const fremd = [...new Set(angefragt.filter((x) => !/^\/(?:sachen|js|css|schrift|bilder)\//.test(x)))];
const kaputt = anfragen.filter((x) => x.status >= 400).map((x) => `${x.status} ${x.pfad}`);
check(anfragen.length > 20 && !fremd.length && !kaputt.length && !fehlgeschlagen.length, `Die Seite lädt nur aus sachen/, ../js, ../css, ../schrift und ../bilder – und alles ist da (${anfragen.length} Anfragen${fremd.length ? `; aus der Wurzel: ${fremd.join(', ')}` : ''}${kaputt.length ? `; kaputt: ${kaputt.join(', ')}` : ''}${fehlgeschlagen.length ? `; fehlgeschlagen: ${fehlgeschlagen.join(', ')}` : ''})`);
const gezeigt = [...new Set(angefragt.map((x) => /^\/bilder\/zutaten\/([a-z0-9-]+)\.svg$/.exec(x)?.[1]).filter(Boolean))];
check(gezeigt.length >= 3 && gezeigt.every((x) => BILDCHEN_S.includes(x)), `jedes Bildchen, das die Seite zeigt, liegt im Vorrat des Workers (BILDCHEN: ${gezeigt.join(', ')})`);

// Ein zweites Gerät: Tobi mit demselben Schlüssel
const tobiH = await geraet({ attrappe: gh, zugang: { token: SCHLUESSEL, name: 'Tobi' } });
const tobi = tobiH.page;
check(await bis(async () => /Kleidung\s*2 Sachen/.test(await tobi.locator('#inv').innerText())), 'Ein zweites Gerät (Tobi, derselbe Schlüssel): „Kleidung“ mit 2 Sachen');
await tobi.click(`[data-inv-liste="${kleidungId}"]`);
check(await bis(async () => (await tobi.locator('.inv-ding-k').count()) === 2) && await bis(async () => (await tobi.locator('.inv-ding-k img.inv-foto-img[src^="blob:"]').count()) === 1, 8000) && gh.zustand.lesen[fotoPfad()] >= 1, 'und die Blümchenbluse mit Foto – das holt es mit dem Schlüssel aus dem Daten-Repo');

// Löschen mit Rückgängig
const rockId = sache('Abendrock').id;
await amy.click(`[data-inv-liste="${kleidungId}"]`);
await amy.click('[data-inv-ding]:has-text("Abendrock")');
await amy.click('[data-act="inv-ding-weg"]');
check(await bis(async () => (await amy.innerText('#toast')).includes('„Abendrock“ gelöscht')) && await bis(() => !sache('Abendrock') && !!sachen()?.weg?.[rockId]), 'Löschen: weg aus sachen.json, in weg steht sie – unten „Rückgängig“');
await amy.click('#toast button');
check(await bis(() => !!sache('Abendrock') && !(rockId in (sachen()?.weg || {}))), 'Rückgängig: wieder da, nicht mehr in weg');
await bis(async () => (await amy.locator('#inv-name').count()) === 1 && (await amy.inputValue('#inv-name')) === 'Abendrock');
await amy.click('[data-act="inv-ding-weg"]');
check(await bis(() => !sache('Abendrock') && !!sachen()?.weg?.[rockId]), 'noch einmal gelöscht: gelöscht steht in weg');
check(await bis(async () => (await tobi.locator('.inv-ding-k').count()) === 1, 8000), 'und auf Tobis Handy ist sie auch weg');
await tobiH.ctx.close();

// --- Scannen mit Nachschlagen: Kamera, Taschenlampe, Open Beauty Facts, Claude, Shop-Bild, KI – alles nachgebaut
const db = { anfragen: [], bilder: 0, produkte: { [LIPPEN]: { name: 'lippenstift testrot', marke: 'testmarke,testkonzern' } } };
const dbRoute = async (r) => {
  const req = r.request();
  const x = new URL(req.url());
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'X-User-Agent', 'access-control-allow-methods': 'GET, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  if (x.hostname.startsWith('images.')) { db.bilder++; return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: BILD_ROH }); }
  const code = x.pathname.split('/').pop();
  db.anfragen.push({ host: x.hostname, code });
  const p = x.hostname === 'world.openbeautyfacts.org' ? db.produkte[code] : null;
  const json = (status, body) => r.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!p) return json(404, { code, status: 'failure', result: { id: 'product_not_found' }, errors: [{ message: { id: 'product_not_found' }, field: { id: 'code', value: code } }] });
  return json(200, { code, status: 'success', result: { id: 'product_found' }, product: { code, product_name: p.name, brands: p.marke, product_type: 'beauty', image_front_url: `https://images.openbeautyfacts.org/images/products/${code}/front_de.3.400.jpg` } });
};
// Claude: mit Werkzeugen (die Suche, ohne Strom) antwortet es claude.antwort, im Strom („Mit KI ausfüllen“) claude.strom als JSON
const claude = { anfragen: [], antwort: null, strom: null };
const STROM = (text) => [
  { type: 'message_start', message: { id: 'msg_2', type: 'message', role: 'assistant', model: ANBIETER.anthropic.modell, usage: { input_tokens: 800, output_tokens: 1 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 40 } },
  { type: 'message_stop' },
].map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const claudeRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  const rumpf = JSON.parse(req.postData() || '{}');
  claude.anfragen.push({ kopf: req.headers(), rumpf });
  if (rumpf.stream) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: STROM(JSON.stringify(claude.strom)) });
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(claude.antwort) });
};
const claudeFindet = (json, url) => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: ANBIETER.anthropic.modell, stop_reason: 'end_turn',
  usage: { input_tokens: 2000, output_tokens: 90, server_tool_use: { web_search_requests: 1 } },
  content: [
    { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'Strichcode' } },
    { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url, title: 'Treffer', encrypted_content: 'e' }] },
    { type: 'text', text: JSON.stringify(json) },
  ],
});
// Die Supabase-Funktion produkt-bild (das Bild von der Shopseite)
const shop = { anfragen: [] };
const shopRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-schluessel-hash', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  shop.anfragen.push({ kopf: req.headers(), rumpf: JSON.parse(req.postData() || '{}') });
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: BILD_ROH });
};

const scanH = await geraet({ attrappe: gh, zugang: { token: SCHLUESSEL, name: 'Amy' }, ki: AKEY, skript: `${LESER}\n${KAMERA}`, datenbank: { route: dbRoute } });
await scanH.ctx.route('https://api.anthropic.com/**', claudeRoute);
await scanH.ctx.route(PRODUKT_BILD, shopRoute);
const sc = scanH.page;
await bis(async () => (await sc.locator('#inv [data-inv-vorschlag="Make-up"]').count()) === 1);
check((await sc.locator('.inv-fein').innerText()).includes('sucht Claude im Internet'), 'Scannen in der Sachen-App: der Hinweis sagt, dass Claude sucht, wenn die Datenbanken die Nummer nicht kennen');
await sc.click('#inv [data-inv-vorschlag="Make-up"]');
check(await bis(() => !!listeId('Make-up')) && await bis(async () => (await sc.innerText('#inv-titel')) === 'Make-up'), 'eine zweite Liste: „Make-up“');
const makeupId = listeId('Make-up');
await sc.evaluate(() => { window.__still = true; });
await sc.click('[data-act="inv-scannen"][data-zweck="neu"]');
check(await bis(() => sc.locator('[data-scan="licht"]').isVisible()) && await sc.evaluate(() => document.querySelector('#scan-video').srcObject instanceof window.MediaStream), '„Scannen“ in der Liste: das Live-Bild der Kamera, mit Knopf für die Taschenlampe');
await sc.click('[data-scan="licht"]');
check(await bis(async () => (await sc.locator('[data-scan="licht"]').getAttribute('aria-pressed')) === 'true') && JSON.stringify(await sc.evaluate(() => window.__kamera.licht)) === '[true]', 'Taschenlampe an (torch: true)');
await sc.click('[data-scan="licht"]');
check(await bis(async () => (await sc.locator('[data-scan="licht"]').getAttribute('aria-pressed')) === 'false') && JSON.stringify(await sc.evaluate(() => window.__kamera.licht)) === '[true,false]', 'und wieder aus');
await sc.evaluate((c) => { window.__code = c; window.__still = false; }, LIPPEN);
check(await bis(async () => (await sc.locator('#scan-dlg[open]').count()) === 0) && await bis(() => { const d = mitNummer(LIPPEN); return d?.name === 'Lippenstift testrot' && d.marke === 'Testmarke' && d.liste === makeupId; }, 8000), 'Das Handy liest den Code im Live-Bild, der Scanner geht zu: in Open Beauty Facts nachgeschlagen und gleich angelegt – Name, Marke, in „Make-up“');
check(await bis(() => FOTO_PFAD.test(mitNummer(LIPPEN)?.foto?.pfad || '') && gh.zustand.roh[mitNummer(LIPPEN).foto.pfad]?.subarray(0, 3).toString('hex') === 'ffd8ff', 8000) && db.bilder >= 1 && db.anfragen[0]?.host === 'world.openbeautyfacts.org', 'das Bild der Datenbank ist ihr Foto – als JPEG ins Daten-Repo');
check(await sc.evaluate(() => window.__kamera.gestoppt >= 1), 'danach ist die Kamera aus');

claude.antwort = claudeFindet({ gefunden: true, name: 'Wanderschuhe Grau', marke: 'Bergfest', liste: 'Make-up', tags: ['grau'], url: SEITE, seite: 'beispiel-shop.de' }, SEITE);
await sc.click('[data-act="inv-ding-zu"]');
await sc.evaluate((c) => { window.__code = c; }, SCHUHE);
await sc.click('[data-act="inv-scannen"][data-zweck="neu"]');
check(await bis(() => { const d = mitNummer(SCHUHE); return d?.name === 'Wanderschuhe Grau' && d.marke === 'Bergfest' && d.quelle?.url === SEITE && d.liste === makeupId; }, 10000), 'Kennt keine Datenbank die Nummer: mit dem Schlüssel von Anthropic sucht Claude (nachgebaut) – Name, Marke, die Seite als Quelle');
check(await bis(() => FOTO_PFAD.test(mitNummer(SCHUHE)?.foto?.pfad || '') && gh.zustand.roh[mitNummer(SCHUHE).foto.pfad]?.subarray(0, 3).toString('hex') === 'ffd8ff', 8000) && shop.anfragen.length === 1 && shop.anfragen[0].rumpf.seite === SEITE && shop.anfragen[0].kopf['x-schluessel-hash'] === createHash('sha256').update(AKEY).digest('hex') && !JSON.stringify(shop.anfragen[0]).includes(AKEY), 'das Bild der Shopseite (Funktion produkt-bild, nachgebaut) ist ihr Foto – an die Funktion nur die Seite und die Prüfsumme');
const suche = claude.anfragen.find((x) => Array.isArray(x.rumpf.tools));
check(suche?.kopf['x-api-key'] === AKEY && suche.rumpf.messages[0].content[0].text.endsWith(SCHUHE) && !JSON.stringify(suche.rumpf).includes('Blümchenbluse'), 'an Claude nur die Nummer (und die Namen der Listen) – nichts von den Sachen');

await sc.click('[data-act="inv-ding-zu"]');
await sc.click('[data-act="inv-ding-neu"]');
await sc.setInputFiles('#inv-foto-datei', BILD);
check(await bis(() => sc.locator('[data-act="inv-ki"]:not([disabled])').isVisible(), 10000), 'Eine Sache mit Foto: „Mit KI ausfüllen“ (mit KI-Schlüssel)');
claude.strom = { name: 'Nagellack Rosé', marke: 'Testlack', liste: 'Make-up', tags: ['rosa'], code: '' };
const vorKi = claude.anfragen.length;
await sc.click('[data-act="inv-ki"]');
check(await bis(() => { const d = sache('Nagellack Rosé'); return d?.marke === 'Testlack' && d.tags.join() === 'rosa' && !!d.foto && d.liste === makeupId; }, 8000) && await bis(async () => (await sc.inputValue('#inv-name')) === 'Nagellack Rosé'), '„Mit KI ausfüllen“: die KI (Claude, nachgebaut) trägt Name, Marke und Tag ein – auch im offenen Formular');
const kiAnfrage = claude.anfragen.slice(vorKi).find((x) => x.rumpf.stream);
check(kiAnfrage?.kopf['x-api-key'] === AKEY && kiAnfrage.rumpf.messages[0].content.some((c) => c.type === 'image') && /Make-up/.test(JSON.stringify(kiAnfrage.rumpf.system || '')), 'an die KI: das Foto als Bild und die Namen der Listen');
await scanH.ctx.close();

// rev zählt je Schreiben um genau 1 – über alle Geräte
const fassungen = gh.zustand.commits.filter((c) => c.pfad === 'sachen.json').reverse().map((c) => gh.zustand.fassungen[c.sha]);
const revs = fassungen.map((t) => JSON.parse(t).rev);
check(revs.length >= 8 && revs.every((r, i) => r === i + 1), `rev in sachen.json zählt je Schreiben um genau 1 (${revs.join(', ')})`);
check(fassungen.every((t) => t === `${JSON.stringify(JSON.parse(t), null, 1)}\n`) && gh.zustand.puts === 0 && gh.zustand.datei === null, 'jede Fassung mit 1 Leerzeichen Einrückung und Zeilenumbruch am Ende – liste.json nie geschrieben');
await amyH.ctx.close();

// --- iPhone in Safari nach dem Link: „auf den Home-Bildschirm“ mit „Link kopieren“
{
  const a = githubAttrappe();
  const { ctx, page } = await geraet({ attrappe: a, userAgent: IPHONE, rechte: ['clipboard-read', 'clipboard-write'], adresse: `${SACHEN_URL}#zugang=${SCHLUESSEL}&fuer=Amy` });
  check(await bis(() => page.isVisible('#s-ios-dlg')) && (await page.innerText('#s-ios-dlg')).includes('Home-Bildschirm'), 'iPhone in Safari nach dem Link: das Popup „auf den Home-Bildschirm“');
  await page.click('[data-act="s-ios-link"]');
  const kopiert = await bis(() => page.evaluate(() => navigator.clipboard.readText()));
  check(kopiert === `${SACHEN_ADRESSE}#zugang=${SCHLUESSEL}&fuer=Amy`, `„Link kopieren“: …/sachen/#zugang=…&fuer=Amy in der Zwischenablage (${ohneSchluessel(kopiert)})`);
  await page.click('#s-ios-dlg [data-act="s-ios-zu"]');
  check(await page.isHidden('#s-ios-dlg'), 'Schließen schließt das Popup');
  await ctx.close();
}
// Vom Home-Bildschirm (navigator.standalone), ohne Zugang: „Einfügen“
{
  const a = githubAttrappe();
  const { ctx, page } = await geraet({ attrappe: a, userAgent: IPHONE, rechte: ['clipboard-read', 'clipboard-write'], skript: 'Object.defineProperty(navigator, "standalone", { get: () => true });' });
  check(await page.isVisible('[data-act="s-einfuegen"]'), 'iPhone vom Home-Bildschirm, ohne Zugang: der Knopf „Einfügen“');
  await page.evaluate((t) => navigator.clipboard.writeText(t), `Hier dein Link: ${SACHEN_ADRESSE}#zugang=${SCHLUESSEL}&fuer=Amy ♡`);
  await page.click('[data-act="s-einfuegen"]');
  check(await vorschlaege(page) && (await gespeichert(page, 'boxenstopp.zugang.v1'))?.name === 'Amy' && await page.isHidden('#s-ios-dlg') && await page.isHidden('#s-karte'), '„Einfügen“ mit dem Link in der Zwischenablage: verbunden – ohne Namen zu tippen, ohne Popup');
  await ctx.close();
}

// --- Umzug: was in liste.json noch unter inventar steht, kommt beim Start nach sachen.json
{
  const a = githubAttrappe();
  const T = '2026-11-10T10:00:00.000Z';
  const inventar = {
    listen: { 'sl-schuh0001': { id: 'sl-schuh0001', name: 'Schuhe', bild: 'high-heeled-shoe', reihe: 1, by: 'Amy', at: T, geaendert: T } },
    dinge: {
      'sd-pumps0001': { id: 'sd-pumps0001', liste: 'sl-schuh0001', name: 'Testpumps', marke: 'Ausgedacht', notiz: '', tags: [], code: '', foto: null, reihe: 1, by: 'Amy', at: T, geaendert: T },
      'sd-sneak0001': { id: 'sd-sneak0001', liste: 'sl-schuh0001', name: 'Testsneaker', marke: '', notiz: '', tags: ['Sommer'], code: '', foto: null, reihe: 2, by: 'Amy', at: T, geaendert: T },
    },
  };
  a.zustand.datei = `${JSON.stringify({ ...leer(), rev: 5, inventar }, null, 1)}\n`;
  a.zustand.version = 5;
  a.zustand.sha = 'sha5';
  const vorher = a.zustand.datei;
  const { ctx, page } = await geraet({ attrappe: a, zugang: { token: SCHLUESSEL, name: 'Amy' } });
  check(/Schuhe\s*2 Sachen/.test(await page.locator('#inv').innerText()), 'Umzug: sobald die Sachen-App bereit ist, stehen die Sachen aus liste.json da (Schuhe, 2 Sachen)');
  const umzug = await bis(() => a.zustand.commits.find((c) => c.pfad === 'sachen.json' && /^Umzug/.test(c.message)), 8000);
  check(umzug?.message === 'Umzug: Sachen aus der Liste – 1 Liste, 2 Sachen', `sachen.json bekommt den Umzug-Commit (${umzug?.message})`);
  const su = a.datei('sachen.json');
  check(su?.rev === 1 && Object.values(su.inventar.dinge).map((d) => d.name).sort().join() === 'Testpumps,Testsneaker' && su.inventar.listen['sl-schuh0001']?.name === 'Schuhe', 'sachen.json: rev 1, die Liste und beide Sachen');
  check(a.zustand.datei === vorher && a.zustand.puts === 0, 'liste.json wird nicht geschrieben (dort heraus nimmt sie Boxenstopp)');
  const commits = a.zustand.commits.length;
  const gets = a.zustand.gets;
  await page.reload();
  await page.waitForFunction(BEREIT);
  const gelesen = await bis(() => a.zustand.gets > gets, 8000);
  await page.waitForTimeout(800);
  check(gelesen && a.zustand.commits.length === commits && a.datei('sachen.json').rev === 1 && Object.keys(a.datei('sachen.json').inventar.dinge).length === 2, `ein zweiter Start liest liste.json wieder, schreibt aber nichts doppelt (${a.zustand.commits.map((c) => c.message).join(' | ')})`);
  await ctx.close();
}

/** Wie oben: liste.json mit Schuhen (1 Liste, 2 Sachen) unter inventar, die noch umziehen müssen. */
function sachenInDerListe(a) {
  const T = '2026-11-10T10:00:00.000Z';
  const inventar = {
    listen: { 'sl-schuh0001': { id: 'sl-schuh0001', name: 'Schuhe', bild: 'high-heeled-shoe', reihe: 1, by: 'Amy', at: T, geaendert: T } },
    dinge: {
      'sd-pumps0001': { id: 'sd-pumps0001', liste: 'sl-schuh0001', name: 'Testpumps', marke: 'Ausgedacht', notiz: '', tags: [], code: '', foto: null, reihe: 1, by: 'Amy', at: T, geaendert: T },
      'sd-sneak0001': { id: 'sd-sneak0001', liste: 'sl-schuh0001', name: 'Testsneaker', marke: '', notiz: '', tags: [], code: '', foto: null, reihe: 2, by: 'Amy', at: T, geaendert: T },
    },
  };
  a.zustand.datei = `${JSON.stringify({ ...leer(), rev: 5, inventar }, null, 1)}\n`;
  a.zustand.version = 5;
  a.zustand.sha = 'sha5';
}
const umzugCommit = (a) => a.zustand.commits.find((c) => c.pfad === 'sachen.json' && /^Umzug/.test(c.message));
const KOPF_T = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };

// --- Der Umzug klappt beim ersten Mal nicht (liste.json nicht zu lesen, dann will GitHub nicht schreiben): beim nächsten Abgleich noch einmal, nicht erst beim nächsten Start
{
  const a = githubAttrappe();
  sachenInDerListe(a);
  const listeGelesen = [];
  let listeKaputt = 1;
  let schreibenKaputt = 1;
  const route = (r) => {
    const req = r.request();
    const u = req.url().split('?')[0];
    if (u === `${a.basis}/contents/liste.json` && req.method() === 'GET') {
      listeGelesen.push(Date.now());
      if (listeKaputt-- > 0) return r.fulfill({ status: 502, headers: KOPF_T, body: '{"message":"Bad Gateway"}' });
    }
    if (u === `${a.basis}/contents/sachen.json` && req.method() === 'PUT' && schreibenKaputt-- > 0) return r.fulfill({ status: 500, headers: KOPF_T, body: '{"message":"Server Error"}' });
    return a.route(r);
  };
  const { ctx, page } = await geraet({ attrappe: { route }, zugang: { token: SCHLUESSEL, name: 'Amy' }, skript: 'localStorage.setItem("__umzugPause", "1500");' });
  await page.evaluate(() => { window.__gleicherStart = true; });
  const umzug = await bis(() => umzugCommit(a), 15000);
  check(umzug?.message === 'Umzug: Sachen aus der Liste – 1 Liste, 2 Sachen' && listeGelesen.length === 3 && await page.evaluate(() => window.__gleicherStart === true), `Umzug geht schief (liste.json 502, dann sachen.json 500): beim nächsten Abgleich noch einmal, im selben Start – beim dritten Versuch der Umzug-Commit (${listeGelesen.length} Versuche, ${umzug?.message})`);
  const abstaende = listeGelesen.slice(1).map((t, i) => t - listeGelesen[i]);
  check(abstaende.length === 2 && abstaende.every((x) => x >= 1400), `zwischen den Versuchen die Pause (__umzugPause, sonst 60 s – wie Boxenstopp): ${abstaende.join(' ms, ')} ms`);
  check(await bis(async () => /Schuhe\s*2 Sachen/.test(await page.locator('#inv').innerText())) && a.zustand.puts === 0, 'danach stehen die Sachen da (Schuhe, 2 Sachen) – liste.json nicht geschrieben');
  await page.waitForTimeout(2000);
  check(listeGelesen.length === 3 && a.zustand.commits.filter((c) => /^Umzug/.test(c.message)).length === 1, `nach dem geglückten Umzug kein weiterer Versuch in diesem Start (${listeGelesen.length} Mal liste.json gelesen)`);
  await ctx.close();
}

// --- Erster Start ohne Netz (nichts gemerkt): keine leeren Vorschläge, sondern ein Satz – und mit Netz kommen die Sachen
{
  const a = githubAttrappe();
  sachenInDerListe(a);
  a.zustand.netzWeg = true;
  const { ctx, page } = await geraet({ attrappe: a, zugang: { token: SCHLUESSEL, name: 'Amy' } });
  const text = await bis(async () => ((await page.locator('#s-ohne-netz').count()) ? page.innerText('#s-ohne-netz') : ''));
  check(text === 'Ohne Netz – deine Sachen kommen, sobald das Handy wieder online ist.' && (await page.locator('[data-inv-vorschlag]').count()) === 0 && (await page.textContent('#sync-text')) === 'Offline' && await page.evaluate(() => document.documentElement.dataset.bereit === '1'), `Erster Start ohne Netz, nichts gemerkt: „${text}“ statt der leeren Vorschläge (ein Tipp auf „Kleidung“ legte sonst eine zweite Liste an) – html[data-bereit] trotzdem, oben „Offline“`);
  a.zustand.netzWeg = false;
  check(await bis(async () => /Schuhe\s*2 Sachen/.test(await page.locator('#inv').innerText()), 10000) && !!umzugCommit(a) && (await page.locator('#s-ohne-netz').count()) === 0, 'wieder Netz: Abgleich und Umzug – die Sachen stehen da (Schuhe, 2 Sachen), der Satz ist weg');
  a.zustand.netzWeg = true;
  await page.reload();
  await page.waitForFunction(BEREIT);
  check(await bis(async () => /Schuhe\s*2 Sachen/.test(await page.locator('#inv').innerText())) && (await page.locator('#s-ohne-netz').count()) === 0, 'noch einmal ohne Netz, jetzt mit gemerktem Stand: die Sachen, die das Gerät kennt – kein Satz');
  await ctx.close();
}

// --- Verbinden in der Sachen-App, wo vorher ein Gast (eigene Liste) verbunden war: dessen offene Änderungen gehen nicht mit
{
  const a = githubAttrappe();
  const { ctx, page } = await geraet({ attrappe: a });
  const GAST_SCHLUESSEL = 'github_pat_11GASTGASTGAST0000000000_abcdefghijklmnopqrstuvwxyz';
  // Boxenstopps Speicher für die Liste (speicher.js ART_LISTE): was offen ist, der zuletzt gelesene Stand – hier die des Gasts
  const { offen: OFFEN_L, github: STAND_L } = ART_LISTE.speicher;
  await page.evaluate(([t, op, ko, ks]) => {
    localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: t, name: 'Gast', daten: 'Finanzdienste/Boxenstopp-Testgast' }));
    localStorage.setItem(ko, JSON.stringify([op]));
    localStorage.setItem(ks, JSON.stringify({ sha: 'gast1', etag: null, stand: { rev: 3 }, format: '', ort: 'Finanzdienste/Boxenstopp-Testgast' }));
  }, [GAST_SCHLUESSEL, opZusammen({}, {}, { notizbuch: {} }), OFFEN_L, STAND_L]);
  await page.goto(`${SACHEN_ADRESSE}#zugang=${SCHLUESSEL}&fuer=Amy`);
  await page.waitForFunction(BEREIT);
  check((await page.innerText('#s-karte')).includes('Mit dem neuen Schlüssel verbinden?') && (await gespeichert(page, OFFEN_L))?.length === 1 && !!(await gespeichert(page, STAND_L)), 'Ein Gast war verbunden, dann Amys Link: erst „Mit dem neuen Schlüssel verbinden?“ – die offene Änderung des Gasts steht noch da');
  await page.click('#s-los');
  const z = await bis(async () => { const x = await gespeichert(page, 'boxenstopp.zugang.v1'); return x?.token === SCHLUESSEL ? x : null; });
  check(z?.name === 'Amy' && !z.daten && await gespeichert(page, OFFEN_L) === null && await gespeichert(page, STAND_L) === null, `nach „Verbinden“: Amy in der gemeinsamen Liste – was vom Gast noch offen war (${OFFEN_L}) und sein Stand (${STAND_L}) sind weg, Boxenstopp schickt es also nicht in eure liste.json`);
  check(a.zustand.puts === 0, 'liste.json wird dabei nicht geschrieben');
  await ctx.close();
}

const browserFehler = alleFehler.flat();
check(!browserFehler.length, `keine Fehler im Browser${browserFehler.length ? ` (${browserFehler.join(' | ')})` : ''}`);

// --- Service Worker – gegen einen eigenen Server, der sich abschalten lässt
const PORT = 8137;
const B = `http://127.0.0.1:${PORT}`;
let server = await starte(PORT, 0);
const aus = () => new Promise((fertig) => { server.closeAllConnections(); server.close(() => fertig()); });
const an = async (wurzel = ROOT) => { server = await starte(PORT, 0, wurzel); };
const CACHE_S = `sachen-${VERSION_S}`;
const SOLL = [...new Set([...SHELL_S.map((e) => new URL(e, `${B}/sachen/sw.js`).pathname), ...BILDCHEN_S.map((x) => `/bilder/zutaten/${x}.svg`)])];
const swFehler = [];
/** Ein Gerät mit Service Workern, nur am eigenen Server – Fehler der Seiten in fehler. */
async function swGeraet({ fehler = swFehler } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', serviceWorkers: 'allow' });
  // Nur der eigene Server – nichts geht ins Netz
  await ctx.route((x) => !x.href.startsWith(`${B}/`), (r) => r.abort('blockedbyclient'));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.goto(`${B}/icon.svg`);
  await page.evaluate(() => {
    localStorage.clear();
    for (const k of ['boxenstopp.dashboard.hinweis.v1', 'boxenstopp.sachen.hinweis.v1', 'boxenstopp.willkommen.v1']) localStorage.setItem(k, 'true');
    localStorage.setItem('__takt', '400');
  });
  return { ctx, page };
}
/** Bis ein Worker im Bereich bereich aktiv ist und die Seite einen Worker hat – sein Skript (oder null). */
const workerAktiv = (page, bereich = '/') => page.evaluate(async (b) => {
  for (let i = 0; i < 200; i++) {
    const r = await navigator.serviceWorker.getRegistration(b);
    if (r?.active?.state === 'activated' && navigator.serviceWorker.controller) return r.active.scriptURL;
    await new Promise((f) => { setTimeout(f, 100); });
  }
  return null;
}, bereich);
/** Wie oft die Seite ganz geladen hat (load) – page.on('load') zählt mit, null hört auf. */
function ladungenZaehlen(page) {
  const z = { n: 0, aus: () => page.off('load', plus) };
  const plus = () => { z.n += 1; };
  page.on('load', plus);
  return z;
}
/** Die Kopien zum Ausliefern – auch wenn der Test abbricht, wieder weg. */
const ordner = [];
process.on('exit', () => { for (const o of ordner) rmSync(o, { recursive: true, force: true }); });
/**
 * Eine Fassung zum Ausliefern (wie ein Deploy): alles aus dem Projekt
 * verknüpft, nur die Dateien in dateien (Pfad im Repo → Inhalt) eigen.
 */
function fassungMit(dateien) {
  const wurzel = mkdtempSync(path.join(os.tmpdir(), 'boxenstopp-sachen-'));
  ordner.push(wurzel);
  const fuellen = (rel) => {
    for (const f of readdirSync(path.join(ROOT, rel))) {
      if (!rel && (f === '.git' || f === 'node_modules')) continue;
      const r = rel ? `${rel}/${f}` : f;
      if (r in dateien) writeFileSync(path.join(wurzel, r), dateien[r]);
      else if (Object.keys(dateien).some((k) => k.startsWith(`${r}/`))) { mkdirSync(path.join(wurzel, r)); fuellen(r); }
      else symlinkSync(path.join(ROOT, r), path.join(wurzel, r));
    }
  };
  fuellen('');
  return wurzel;
}
const vorratVon = (page, name) => page.evaluate(async (n) => (await caches.has(n) ? (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname) : []), name);
const titelUndRaster = async (page) => ({ titel: await page.title().catch(() => ''), raster: await page.locator('#grid').count().catch(() => 0) });

{
  const { ctx, page } = await swGeraet();
  await page.goto(`${B}/sachen/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(BEREIT);
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, url: r.active?.scriptURL }; });
  check(reg.scope === `${B}/sachen/` && reg.url === `${B}/sachen/sw.js`, `Service Worker: die App meldet /sachen/sw.js an, mit dem Bereich …/sachen/ (${reg.scope})`);
  const vorrat = await bis(async () => { const k = await vorratVon(page, CACHE_S); return SOLL.every((p) => k.includes(p)) ? k : null; }, 15000) || await vorratVon(page, CACHE_S);
  const fehlt = SOLL.filter((p) => !vorrat.includes(p));
  check(!fehlt.length, `der Vorrat ${CACHE_S} enthält die ganze SHELL und die Bildchen (${vorrat.length} Dateien)${fehlt.length ? ` – es fehlen: ${fehlt.join(', ')}` : ''}`);
  check((await page.evaluate(() => caches.keys())).every((k) => k.startsWith('sachen-')), 'nur Vorräte „sachen-…“ (ohne Boxenstopp)');
  await page.reload();
  await page.waitForFunction(BEREIT);
  check(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL) === `${B}/sachen/sw.js`, 'nach dem Neuladen steuert der eigene Worker die Seite');
  await aus();
  await page.reload({ waitUntil: 'load' }).catch(() => null);
  await page.waitForFunction(BEREIT, null, { timeout: 8000 }).catch(() => null);
  const stile = await page.evaluate(() => [...document.styleSheets].map((x) => x.cssRules.length)).catch(() => []);
  check((await page.title()) === 'Sachen' && await page.isVisible('#s-kopf') && await page.isVisible('#s-form') && (await page.locator('#grid').count()) === 0 && stile.length >= 2 && stile.every((n) => n > 0), 'Ohne Netz (Server aus) neu geladen: die Sachen-App aus dem Vorrat, mit beiden Stylesheets – nicht Boxenstopp');
  await page.goto(`${B}/sachen/gibts-nicht`, { waitUntil: 'load' }).catch(() => null);
  check((await titelUndRaster(page)).titel === 'Sachen', 'ohne Netz, eine andere Adresse unter sachen/: der Ersatz ist ./index.html der Sachen-App');
  await an();
  await ctx.close();
}

/*
 * Ein Deploy, während der Worker läuft: Ohne neue VERSION bleibt die alte
 * Fassung ganz – keine Datei wird im Hintergrund einzeln erneuert (sonst
 * stünde ein gemischter Stand im Vorrat). Mit neuer VERSION kommt die neue
 * ganz: alle Dateien, und die Seite lädt einmal neu.
 */
{
  const quelle = (f) => readFileSync(path.join(ROOT, f), 'utf8');
  const NEU = {
    'sachen/index.html': quelle('sachen/index.html').replace('<title>Sachen</title>', '<title>Sachen</title>\n<meta name="fassung" content="neu">'),
    'sachen/app.js': `${quelle('sachen/app.js')}\nwindow.__fassungApp = 'neu';\n`,
    'js/format.js': `${quelle('js/format.js')}\nglobalThis.__fassungFormat = 'neu';\n`,
  };
  const MARKE = { '/sachen/index.html': 'name="fassung"', '/sachen/app.js': '__fassungApp', '/js/format.js': '__fassungFormat' };
  const VERSION_NEU = `${VERSION_S}-neu`;
  const ohneVersion = fassungMit(NEU);
  const mitVersion = fassungMit({ ...NEU, 'sachen/sw.js': SW_S.replace(/const VERSION = '[^']+'/, `const VERSION = '${VERSION_NEU}'`) });
  /** Was die Seite zeigt: die Seite, ./app.js, ../js/format.js – je „alt“ oder „neu“. */
  const fassung = (page) => page.evaluate(() => [document.querySelector('meta[name="fassung"]')?.content, window.__fassungApp, globalThis.__fassungFormat].map((x) => x || 'alt').join());
  /** Dieselben drei, wie sie im Vorrat liegen. */
  const imVorrat = (page, name) => page.evaluate(async ([n, marke]) => {
    const c = await caches.open(n);
    return Promise.all(Object.entries(marke).map(async ([p, m]) => { const r = await c.match(p); return !r ? 'fehlt' : (await r.text()).includes(m) ? 'neu' : 'alt'; }));
  }, [name, MARKE]).then((x) => x.join());
  const { ctx, page } = await swGeraet();
  await page.goto(`${B}/sachen/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(BEREIT);
  await bis(async () => { const k = await vorratVon(page, CACHE_S); return SOLL.every((p) => k.includes(p)); }, 15000);
  await page.reload();
  await page.waitForFunction(BEREIT);
  const vorher = await fassung(page);
  // Der Deploy: dieselbe VERSION, drei Dateien anders
  await aus();
  await an(ohneVersion);
  await page.reload();
  await page.waitForFunction(BEREIT);
  const erst = await fassung(page);
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForFunction(BEREIT);
  const dann = await fassung(page);
  const vorratAlt = await imVorrat(page, CACHE_S);
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { warten: !!(r.installing || r.waiting), vorraete: await caches.keys() }; });
  check(vorher === 'alt,alt,alt' && erst === 'alt,alt,alt' && dann === 'alt,alt,alt' && vorratAlt === 'alt,alt,alt' && !reg.warten && reg.vorraete.join() === CACHE_S, `Deploy ohne neue VERSION (die Seite, ./app.js und ../js/format.js anders): Die App bleibt ganz die alte – auch nach update() und noch einmal Neuladen, im Vorrat nichts einzeln erneuert (Seite, app.js, format.js: ${erst} / ${dann}, im Vorrat ${vorratAlt})`);
  // Der Deploy mit neuer VERSION
  await aus();
  await an(mitVersion);
  const ladungen = ladungenZaehlen(page);
  await page.reload();
  const neuGeladen = await bis(() => ladungen.n >= 2, 20000);
  await page.waitForFunction(BEREIT);
  await page.waitForTimeout(1500);
  ladungen.aus();
  const nachher = await fassung(page);
  const keys = await page.evaluate(() => caches.keys());
  const vorratNeu = await imVorrat(page, `sachen-${VERSION_NEU}`);
  const sollNeu = await vorratVon(page, `sachen-${VERSION_NEU}`);
  check(neuGeladen && ladungen.n === 2 && nachher === 'neu,neu,neu' && vorratNeu === 'neu,neu,neu' && SOLL.every((p) => sollNeu.includes(p)) && keys.join() === `sachen-${VERSION_NEU}` && await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL) === `${B}/sachen/sw.js`, `mit neuer VERSION (${VERSION_NEU}): Der neue Worker holt die ganze Fassung in seinen Vorrat, übernimmt, räumt die alte weg, und die Seite lädt einmal von selbst neu – dann ist alles neu (Seite, app.js, format.js: ${nachher}; ${ladungen.n - 1} Mal von selbst neu geladen; Vorräte: ${keys.join(', ')})`);
  await aus();
  await an();
  await ctx.close();
}

// Beide Worker: erst Boxenstopp, dann die Sachen-App, dann ein Update von Boxenstopp
{
  const { ctx, page } = await swGeraet();
  await page.goto(`${B}/index.html`, { waitUntil: 'load' });
  const bReg = await page.evaluate(async () => {
    for (let i = 0; i < 150; i++) {
      const r = await navigator.serviceWorker.getRegistration();
      if (r?.active?.state === 'activated' && navigator.serviceWorker.controller) return r.scope;
      await new Promise((f) => { setTimeout(f, 100); });
    }
    return null;
  });
  check(bReg === `${B}/` && (await bis(async () => (await page.evaluate(() => caches.keys())).includes(`boxenstopp-${VERSION_B}`))), `Boxenstopps Worker ist aktiv (Bereich ${bReg})`);
  // Ohne Netz, bevor der Worker der Sachen-App da ist: /sachen/ bekommt nicht Boxenstopps Seite
  await aus();
  await page.goto(`${B}/sachen/index.html`, { waitUntil: 'load' }).catch(() => null);
  const ohne = await titelUndRaster(page);
  check(ohne.titel !== 'Boxenstopp' && ohne.raster === 0, `ohne Netz und noch ohne eigenen Worker: /sachen/ bekommt nicht Boxenstopps Seite (Titel „${ohne.titel}“)`);
  await an();
  // Boxenstopps Worker hält die Seite (erster Besuch): Das Skript in index.html meldet gleich den eigenen an und lädt einmal neu, sobald er übernimmt
  const ladungen = ladungenZaehlen(page);
  await page.goto(`${B}/sachen/index.html`, { waitUntil: 'load' });
  const neu = await bis(() => ladungen.n >= 2, 20000);
  await page.waitForFunction(BEREIT);
  await page.waitForTimeout(800);
  ladungen.aus();
  check(neu && ladungen.n === 2 && await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL) === `${B}/sachen/sw.js`, `erster Besuch unter Boxenstopps Worker: einmal neu geladen, dann hält der eigene Worker die Seite (${ladungen.n - 1} Mal von selbst neu geladen)`);
  const sReg = await page.evaluate(async () => {
    for (let i = 0; i < 150; i++) {
      const r = await navigator.serviceWorker.getRegistration('./');
      if (r?.active?.state === 'activated' && r.scope.endsWith('/sachen/')) return r.scope;
      await new Promise((f) => { setTimeout(f, 100); });
    }
    return null;
  });
  const sVorrat = await bis(async () => { const k = await vorratVon(page, CACHE_S); return SOLL.every((p) => k.includes(p)) ? k : null; }, 15000);
  check(sReg === `${B}/sachen/` && !!sVorrat, `dann die Sachen-App: ihr Worker (${sReg}) und ihr Vorrat ${CACHE_S} neben Boxenstopp`);
  await page.evaluate(() => caches.open('boxenstopp-sachen-v1').then((c) => c.put('/sachen/test-foto.jpg', new Response('foto', { headers: { 'content-type': 'image/jpeg' } }))));
  // Ein Update von Boxenstopp (andere VERSION): sein Aktivieren räumt auf – sachen-v1 und boxenstopp-sachen-v1 bleiben
  const fassungOrdner = fassungMit({ 'sw.js': SW_B.replace(/const VERSION = '[^']+'/, `const VERSION = '${VERSION_B}-test'`) });
  await aus();
  await an(fassungOrdner);
  const nachUpdate = await page.evaluate(async ([neu, alt]) => {
    const r = await navigator.serviceWorker.getRegistration('/');
    await r.update().catch(() => null);
    for (let i = 0; i < 200; i++) {
      const k = await caches.keys();
      if (k.includes(neu) && !k.includes(alt)) return k;
      await new Promise((f) => { setTimeout(f, 100); });
    }
    return caches.keys();
  }, [`boxenstopp-${VERSION_B}-test`, `boxenstopp-${VERSION_B}`]);
  const fotoDa = await page.evaluate(() => caches.open('boxenstopp-sachen-v1').then((c) => c.match('/sachen/test-foto.jpg')).then((x) => !!x));
  const sachenVorrat = await vorratVon(page, CACHE_S);
  check(nachUpdate.includes(`boxenstopp-${VERSION_B}-test`) && !nachUpdate.includes(`boxenstopp-${VERSION_B}`) && nachUpdate.includes(CACHE_S) && nachUpdate.includes('boxenstopp-sachen-v1') && fotoDa && SOLL.every((p) => sachenVorrat.includes(p)), `Boxenstopps Aktivieren (ein Update) räumt seine alte Fassung weg – ${CACHE_S} und boxenstopp-sachen-v1 bleiben stehen, mit allem darin (${nachUpdate.join(', ')})`);
  // Ohne Netz, mit beiden Workern: /sachen/ bekommt nie Boxenstopps Seite
  await aus();
  await page.goto(`${B}/sachen/index.html`, { waitUntil: 'load' }).catch(() => null);
  await page.waitForFunction(BEREIT, null, { timeout: 8000 }).catch(() => null);
  const t1 = await titelUndRaster(page);
  check(t1.titel === 'Sachen' && t1.raster === 0 && await page.isVisible('#s-kopf'), 'ohne Netz, mit beiden Workern: /sachen/index.html ist die Sachen-App');
  await page.goto(`${B}/sachen/`, { waitUntil: 'load' }).catch(() => null);
  const t2 = await titelUndRaster(page);
  await page.goto(`${B}/sachen/irgendwo`, { waitUntil: 'load' }).catch(() => null);
  const t3 = await titelUndRaster(page);
  await page.goto(`${B}/sachen`, { waitUntil: 'load' }).catch(() => null);
  const t4 = await titelUndRaster(page);
  check(t2.titel === 'Sachen' && t3.titel === 'Sachen' && t2.raster === 0 && t3.raster === 0 && t4.titel !== 'Boxenstopp' && t4.raster === 0, `/sachen/ und jede Adresse darunter: die Sachen-App; /sachen ohne Schrägstrich (außerhalb ihres Bereichs) bekommt auch nicht Boxenstopps Seite (Titel „${t4.titel}“)`);
  await page.goto(`${B}/index.html`, { waitUntil: 'load' }).catch(() => null);
  check((await titelUndRaster(page)).titel === 'Boxenstopp', 'Boxenstopp selbst geht ohne Netz weiter (sein Vorrat ist da)');
  await an();
  await ctx.close();
}
/*
 * Erster Besuch auf einem Gerät mit Boxenstopp v79 (382449e): Dessen Worker
 * hält /sachen/ und gibt ../js/ aus seinem Vorrat von damals – bilder.js
 * ohne bildBasis, der Modulgraph passt nicht zu sachen/app.js. Das Skript in
 * index.html meldet den eigenen Worker an und lädt einmal neu, sobald er die
 * Seite hält – dann läuft die App.
 */
{
  const V79 = '382449ef0a5d234536867f2722d8f7e7fc863b98';
  const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
  let tar = null;
  try { tar = git('archive', V79); } catch {
    // Ein flacher Checkout (wie in der Prüfung bei GitHub) kennt den Commit nicht: einmal holen
    try { git('fetch', '--quiet', '--no-tags', '--depth=1', 'origin', V79); tar = git('archive', V79); } catch { tar = null; }
  }
  check(!!tar, `Boxenstopp v79 (${V79.slice(0, 7)}) zum Ausliefern${tar ? '' : ' – nicht zu holen (git archive, git fetch)'}`);
  if (tar) {
    const alt = mkdtempSync(path.join(os.tmpdir(), 'boxenstopp-v79-'));
    ordner.push(alt);
    execFileSync('tar', ['-x', '-C', alt], { input: tar });
    const fehler = [];
    const { ctx, page } = await swGeraet({ fehler });
    const a = githubAttrappe();
    sachenInDerListe(a);
    await ctx.route('https://api.github.com/**', a.route);
    await aus();
    await an(alt);
    await page.goto(`${B}/index.html`, { waitUntil: 'load' });
    const v79 = await workerAktiv(page);
    const v79Vorrat = await bis(async () => (await page.evaluate(() => caches.keys())).includes('boxenstopp-v79'), 15000);
    check(v79 === `${B}/sw.js` && v79Vorrat && (await page.title()) === 'Boxenstopp', `Boxenstopp v79 ist installiert: sein Worker hält die Seite, sein Vorrat boxenstopp-v79 (${v79})`);
    // Der Deploy: der heutige Stand, Boxenstopps Worker von v79 läuft noch
    await aus();
    await an();
    await page.evaluate((z) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify(z)); }, { token: SCHLUESSEL, name: 'Amy' });
    fehler.length = 0;
    const ladungen = ladungenZaehlen(page);
    await page.goto(`${B}/sachen/`, { waitUntil: 'load' });
    const neu = await bis(() => ladungen.n >= 2, 20000);
    const laeuft = neu && await page.waitForFunction(BEREIT, null, { timeout: 15000 }).then(() => true, () => false);
    const steuert = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL).catch(() => '');
    const sachenDa = laeuft && await bis(async () => /Schuhe\s*2 Sachen/.test(await page.locator('#inv').innerText().catch(() => '')), 10000);
    await page.waitForTimeout(800);
    ladungen.aus();
    check(laeuft && ladungen.n === 2 && steuert === `${B}/sachen/sw.js` && sachenDa, `erster Besuch unter Boxenstopps Worker von v79: einmal neu geladen, dann hält der eigene Worker die Seite, html[data-bereit], die Sachen-App läuft (Amys Schuhe aus der Attrappe) – nicht „wird geladen“ (${ladungen.n - 1} Mal von selbst neu geladen, Worker ${steuert || 'keiner'})`);
    const linkFehler = fehler.filter((m) => /does not provide an export named/.test(m));
    check(linkFehler.length === 1 && fehler.length === 1, `keine Fehler außer dem erwarteten ersten: ../js/ aus dem Vorrat von v79 passt nicht zu app.js (${fehler.join(' | ') || 'keiner'})`);
    await ctx.close();
  }
}

/*
 * Unter Boxenstopps Worker mit dem Link (#zugang=…&fuer=Amy): Das eine
 * Neuladen bringt den Link wieder mit – war das Verbinden noch unterwegs
 * (app.js hat den Link schon aus der Adresse genommen), geht es danach weiter.
 */
{
  const { ctx, page } = await swGeraet();
  await page.goto(`${B}/index.html`, { waitUntil: 'load' });
  const bWorker = await workerAktiv(page);
  const a = githubAttrappe();
  const ladungen = ladungenZaehlen(page);
  let erstePruefung = true;
  await ctx.route('https://api.github.com/**', async (r) => {
    if (erstePruefung && r.request().method() === 'GET' && r.request().url().split('?')[0] === a.basis) {
      // Die erste Prüfung des Schlüssels hängt, bis die Seite neu geladen hat
      erstePruefung = false;
      await bis(() => ladungen.n >= 2, 20000);
      return a.route(r).catch(() => null);
    }
    return a.route(r);
  });
  await page.goto(`${B}/sachen/#zugang=${SCHLUESSEL}&fuer=Amy`, { waitUntil: 'load' });
  const neu = await bis(() => ladungen.n >= 2, 20000);
  const z = await bis(() => gespeichert(page, 'boxenstopp.zugang.v1').catch(() => null), 10000);
  await page.waitForTimeout(800);
  ladungen.aus();
  check(bWorker === `${B}/sw.js` && neu && ladungen.n === 2 && !erstePruefung && z?.token === SCHLUESSEL && z.name === 'Amy' && await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL) === `${B}/sachen/sw.js` && (await page.evaluate(() => location.hash)) === '', `mit dem Link unter Boxenstopps Worker, das Verbinden noch unterwegs: Das eine Neuladen bringt den Link wieder mit – danach verbunden (Amy), die Adresse ohne # (${ladungen.n - 1} Mal von selbst neu geladen)`);
  await ctx.close();
}

check(!swFehler.length, `keine Fehler im Browser mit den Workern${swFehler.length ? ` (${swFehler.join(' | ')})` : ''}`);

await aus();
await browser.close();
ende();
