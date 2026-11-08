/*
 * Ohne Netz – und alles, was dafür im Vorrat liegen muss.
 *
 * Erst ohne Browser: Jede Datei der App steht in SHELL (sw.js), jeden Eintrag
 * dort gibt es, jeder Import zeigt auf eine vorhandene Datei, die Rezepte
 * stehen nicht darin, das Manifest passt. Dann im Browser: einmal laden –
 * alle Rezeptfotos kommen von selbst in den Vorrat, nicht nur die gesehenen –,
 * Server aus, neu laden: Rezepte, Liste und jedes Foto sind noch da; fehlt
 * eins doch, steht das Ersatzbild da. Ein Update, während die Rezepte nicht
 * zu holen sind (sie lagen früher im Vorrat der Fassung – sie ziehen um),
 * ein Update, dem eine Datei fehlt (es gilt nicht, die alte Fassung bleibt),
 * Auffrischen ohne Neustart, und schlechtes Netz: Nach ein paar Sekunden
 * ohne Antwort kommen die Rezepte aus dem Vorrat.
 *
 * Server aus statt setOffline() – wie bei Freizeit: Playwrights
 * Offline-Schalter schneidet die Anfragen des Service Workers nicht ab.
 */
import { readFileSync, readdirSync, existsSync, mkdtempSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, pruefer } from './hilfe.mjs';
import { starte } from './server.mjs';

const { check, ende } = pruefer();
const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const shell = [...sw.match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const version = sw.match(/const VERSION = '([^']+)'/)[1];

const PORT = 8114;
const BASIS = `http://127.0.0.1:${PORT}`;
let server = await starte(PORT, 0);
const aus = () => new Promise((fertig) => { server.closeAllConnections(); server.close(() => fertig()); });
const an = async (wurzel = ROOT) => { server = await starte(PORT, 0, wurzel); };

/*
 * Eine andere Fassung der App zum Ausliefern: alles aus dem Projekt
 * (verknüpft), sw.js mit anderer VERSION; ohneDaten: daten/ fehlt (die Rezepte
 * sind nicht zu holen); ohne: eine Datei aus js/ fehlt; daten: eigene Inhalte.
 */
function fassung(neu, { ohneDaten = false, ohne = '', daten = null } = {}) {
  const wurzel = mkdtempSync(path.join(os.tmpdir(), 'boxenstopp-fassung-'));
  for (const f of readdirSync(ROOT)) {
    if (f === 'sw.js' || (f === 'daten' && (ohneDaten || daten)) || (f === 'js' && ohne)) continue;
    symlinkSync(path.join(ROOT, f), path.join(wurzel, f));
  }
  writeFileSync(path.join(wurzel, 'sw.js'), readFileSync(path.join(ROOT, 'sw.js'), 'utf8').replace(/const VERSION = '[^']+'/, `const VERSION = '${neu}'`));
  if (ohne) {
    mkdirSync(path.join(wurzel, 'js'));
    for (const f of readdirSync(path.join(ROOT, 'js'))) if (f !== ohne) symlinkSync(path.join(ROOT, 'js', f), path.join(wurzel, 'js', f));
  }
  if (daten) {
    mkdirSync(path.join(wurzel, 'daten'));
    for (const f of readdirSync(path.join(ROOT, 'daten'))) {
      if (daten[f]) writeFileSync(path.join(wurzel, 'daten', f), daten[f]);
      else symlinkSync(path.join(ROOT, 'daten', f), path.join(wurzel, 'daten', f));
    }
  }
  return wurzel;
}

// --- Ohne Browser
const module = readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
const fehlt = module.filter((f) => !shell.includes(`js/${f}`));
check(!fehlt.length, `jedes Modul unter js/ steht in SHELL${fehlt.length ? ` – es fehlen: ${fehlt.join(', ')}` : ''}`);
const schriften = readdirSync(path.join(ROOT, 'schrift')).filter((f) => f.endsWith('.woff2'));
check(schriften.every((f) => shell.includes(`schrift/${f}`)), 'jede Schrift steht in SHELL');
const tot = shell.filter((f) => f && !existsSync(path.join(ROOT, f)));
check(!tot.length, `jeden Eintrag in SHELL gibt es als Datei${tot.length ? ` – nicht da: ${tot.join(', ')}` : ''}`);
check(!shell.some((f) => f.startsWith('daten/')), 'die Rezepte stehen nicht in SHELL – wer ein Rezept ändert, muss sw.js nicht anfassen');
const kaputt = [];
module.forEach((f) => {
  const src = readFileSync(path.join(ROOT, 'js', f), 'utf8');
  [...src.matchAll(/^\s*import\s+(?:[^;]+?\s+from\s+)?'\.\/([\w.-]+)';/gm)].forEach((m) => {
    if (!module.includes(m[1])) kaputt.push(`${f} → ${m[1]}`);
  });
});
check(!kaputt.length, `jeder Import zeigt auf eine vorhandene Datei${kaputt.length ? `: ${kaputt.join(', ')}` : ''}`);
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const verweise = [...html.matchAll(/(?:href|src)="(?!https?:|#|data:)([^"]+)"/g)].map((m) => m[1].replace(/^\.\//, ''));
const ohneVorrat = verweise.filter((v) => !shell.includes(v));
check(verweise.length >= 4 && !ohneVorrat.length, `alles, was index.html lädt, steht in SHELL${ohneVorrat.length ? ` – nicht: ${ohneVorrat.join(', ')}` : ''}`);
const css = readFileSync(path.join(ROOT, 'css', 'styles.css'), 'utf8');
const cssDateien = [...css.matchAll(/url\("\.\.\/([^"]+)"\)/g)].map((m) => m[1]);
check(cssDateien.length >= 6 && cssDateien.every((f) => shell.includes(f)), 'alle Schriften aus styles.css liegen im Vorrat');
const aufraeumen = sw.match(/addEventListener\('activate'[\s\S]*?\n\}\);/)[0];
check(/startsWith\('boxenstopp-'\)/.test(aufraeumen), 'der Worker löscht beim Aktualisieren nur Vorräte, die mit „boxenstopp-“ beginnen (im selben Ursprung liegen Workout und Freizeit)');
check(/url\.origin !== self\.location\.origin\) return/.test(sw), 'Anfragen an die GitHub-API gehen am Worker vorbei');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
check(manifest.icons.every((i) => existsSync(path.join(ROOT, i.src))), 'jedes Symbol aus dem Manifest gibt es');
check(manifest.lang === 'de' && manifest.start_url === '.' && manifest.scope === '.' && manifest.display === 'standalone', 'Manifest: deutsch, eigenes Fenster, startet und bleibt im eigenen Ordner');
check(manifest.id === '/Boxenstopp/', `Manifest: eigene Kennung /Boxenstopp/ (${manifest.id}) – Android führt sie als eigene App`);
check(manifest.icons.some((i) => i.purpose === 'maskable') && manifest.icons.some((i) => i.sizes === '512x512'), 'Manifest: Symbol in 512 px, auch als „maskable“');

// --- Im Browser
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
await ctx.route('https://api.github.com/**', (r) => r.abort('blockedbyclient'));
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(e.message));
const REZEPTE = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8')).rezepte;
const FOTOS = REZEPTE.filter((r) => r.bild).map((r) => `/${r.bild}`);
const warte = (ms) => new Promise((f) => { setTimeout(f, ms); });
/** Die Einträge eines Vorrats (Pfad mit ?v=). */
const imVorrat = (name) => page.evaluate(async (n) => (await caches.has(n) ? (await (await caches.open(n)).keys()).map((r) => { const u = new URL(r.url); return u.pathname + u.search; }) : []), name);
const bis = async (fn, ms = 10000) => { const ende = Date.now() + ms; for (;;) { const x = await fn(); if (x || Date.now() > ende) return x; await warte(150); } };
const rasterZahl = async () => { await page.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0, null, { timeout: 9000 }).catch(() => {}); return page.locator('#grid .box').count(); };
/** Das ganze Raster durchscrollen (die Fotos laden faul) – dann: wie viele Fotos sind da, wie viele kaputt, wie viele als Ersatzbild. */
async function fotosImRaster() {
  for (let y = 0; y < 40000; y += 500) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await warte(40); }
  await warte(1200);
  const z = await page.evaluate(() => { const imgs = [...document.querySelectorAll('#grid .box-foto:not(.box-foto-ersatz) img')]; return { da: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, kaputt: imgs.filter((i) => i.complete && i.naturalWidth === 0).length, ersatz: document.querySelectorAll('#grid .box-foto-ersatz').length }; });
  await page.evaluate(() => window.scrollTo(0, 0));
  return z;
}

await page.goto(`${BASIS}/index.html`, { waitUntil: 'networkidle' });
const bereich = await page.evaluate(async () => {
  for (let i = 0; i < 100; i++) {
    const r = await navigator.serviceWorker.getRegistration();
    if (r && r.active && r.active.state === 'activated') return r.scope;
    await new Promise((f) => { setTimeout(f, 100); });
  }
  return null;
});
check(bereich === `${BASIS}/`, `der Worker ist aktiv und gilt für den Ordner der App (${bereich})`);
await page.reload({ waitUntil: 'networkidle' });
const steuert = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '');
check(steuert === `${BASIS}/sw.js`, `nach dem Neuladen steuert der Worker die Seite (${steuert})`);
check(await rasterZahl() === 50, 'mit Netz: 50 Rezepte');
await page.click('.tab[data-tab="einkauf"]');
await page.fill('#add-input', 'Bananen');
await page.press('#add-input', 'Enter');
await page.click('.tab[data-tab="rezepte"]');

const vorrat = await bis(async () => { const k = await imVorrat(`boxenstopp-${version}`); return k.length >= shell.length - 1 ? k : null; }) || await imVorrat(`boxenstopp-${version}`);
check(vorrat.filter((k) => !k.startsWith('/daten/')).length >= shell.length - 1, `im Vorrat liegt die App (${vorrat.length} Dateien, SHELL hat ${shell.length})`);
const daten = await bis(async () => { const k = await imVorrat('boxenstopp-daten-v1'); return ['rezepte', 'angebote', 'preisverlauf'].every((d) => k.includes(`/daten/${d}.json`)) ? k : null; });
check(!!daten && !vorrat.some((k) => k.startsWith('/daten/')), `die zuletzt geladenen Rezepte, Angebote und der Preisverlauf liegen in einem eigenen Vorrat, der Updates übersteht (${(daten || []).join(', ')})`);
const bildchen = JSON.parse(readFileSync(path.join(ROOT, 'bilder', 'zutaten', 'alle.json'), 'utf8'));
const ohneBildchen = bildchen.filter((b) => !vorrat.includes(`/bilder/zutaten/${b}.svg`));
check(!ohneBildchen.length, `alle ${bildchen.length} Zutaten-Bildchen liegen schon nach dem Installieren im Vorrat${ohneBildchen.length ? ` – nicht: ${ohneBildchen.slice(0, 5).join(', ')}` : ''}`);
// Alle Rezeptfotos – nicht nur die, die man oben gesehen hat (so fehlten ohne Netz 40 von 50)
const fotosDa = await bis(async () => { const k = await imVorrat('boxenstopp-bilder-v1'); return FOTOS.every((f) => k.includes(f)) ? k : null; }, 20000);
check(FOTOS.length === 50 && !!fotosDa && fotosDa.length === FOTOS.length, `alle ${FOTOS.length} Rezeptfotos liegen nach dem ersten Start im Vorrat, ohne dass man hinscrollt (${(fotosDa || await imVorrat('boxenstopp-bilder-v1')).length})`);

// Rezeptfotos: eigener Vorrat, der ein Update übersteht; eine neue Fassung räumt die alte weg
const chiliFoto = REZEPTE.find((r) => r.id === 'chili').bild;
const fotos = await page.evaluate(async (foto) => {
  const c = await caches.open('boxenstopp-bilder-v1');
  const namen = async () => (await c.keys()).map((r) => { const u = new URL(r.url); return u.pathname + u.search; });
  const vorher = await namen();
  // So täte es eine ältere Fassung: anderes ?v=, gleiche Datei
  const alt = foto.replace(/\?v=.*$/, '?v=00000000');
  await c.delete(`/${foto}`);
  await c.put(`/${alt}`, new Response('alt', { headers: { 'content-type': 'image/webp' } }));
  const res = await fetch(foto);
  const groesse = (await res.arrayBuffer()).byteLength;
  let nachher = [];
  for (let i = 0; i < 30; i++) {
    nachher = await namen();
    if (nachher.includes(`/${foto}`) && !nachher.includes(`/${alt}`)) break;
    await new Promise((f) => { setTimeout(f, 100); });
  }
  return { vorher, nachher, alt, groesse };
}, chiliFoto);
check(fotos.vorher.includes(`/${chiliFoto}`) && !fotos.vorher.some((k) => k.startsWith('/bilder/zutaten/')), `die Rezeptfotos liegen im eigenen Vorrat, die Bildchen nicht (${fotos.vorher.length} Fotos)`);
check(fotos.groesse > 1000 && fotos.nachher.includes(`/${chiliFoto}`) && !fotos.nachher.includes(`/${fotos.alt}`), 'eine neue Fassung eines Fotos räumt die alte (anderes ?v=) aus dem Vorrat');
// Ein Foto, das doch fehlt (hier: eben aus dem Vorrat genommen), zeigt ohne Netz das Ersatzbild statt eines kaputten Bilds
const letztes = REZEPTE.at(-1);
await page.evaluate((f) => caches.open('boxenstopp-bilder-v1').then((c) => c.delete(f)), `/${letztes.bild}`);

await aus();
await page.reload({ waitUntil: 'load' });
check(await page.title() === 'Boxenstopp', 'ohne Server öffnet die App');
check(await rasterZahl() === 50, 'ohne Server: alle 50 Rezepte');
check(await page.locator('#list-body .item-name', { hasText: 'Bananen' }).count() === 1, 'ohne Server: die Liste mit den Bananen');
const ohneNetz = await fotosImRaster();
check(ohneNetz.da === 49 && ohneNetz.kaputt === 0, `ohne Server: jedes Rezept mit Foto, auch die, die man nie gesehen hat (${ohneNetz.da} da, ${ohneNetz.kaputt} kaputt)`);
check(ohneNetz.ersatz === 1 && await page.locator(`[data-open="${letztes.id}"] .box-foto-ersatz img`).count() >= 1, 'das eine fehlende Foto: das Ersatzbild aus den Zutaten-Bildchen, kein kaputtes Bild');
// Ein Bild ist da, wenn es geladen ist (die Bilder laden faul, also erst, wenn ihr Reiter offen ist)
const bildDa = (loc) => loc.evaluate(async (img) => {
  if (!img.complete) {
    await Promise.race([
      new Promise((f) => { img.addEventListener('load', f, { once: true }); img.addEventListener('error', f, { once: true }); }),
      new Promise((f) => { setTimeout(f, 3000); }),
    ]);
  }
  return { breite: img.naturalWidth, src: img.getAttribute('src') || '' };
}).catch(() => ({ breite: 0, src: '' }));
await page.click('.tab[data-tab="einkauf"]');
const banane = await bildDa(page.locator('#list-body .item', { hasText: 'Bananen' }).locator('.zb').first());
check(banane.breite > 0 && banane.src.endsWith('/banana.svg'), `ohne Server: das Bildchen der Bananen ist da (${banane.src || 'keins'})`);
await page.click('.tab[data-tab="rezepte"]');
const foto = await bildDa(page.locator('[data-open="chili"] .box-foto img'));
check(foto.breite === 800, `ohne Server: das Chili-Foto kommt aus dem Vorrat (${foto.breite} px breit)`);
await page.click('[data-open="gulasch"]');
check((await page.locator('#d-title').innerText()) === 'Rindergulasch mit Kartoffeln', 'ohne Server: ein Rezept öffnet');
check((await bildDa(page.locator('#detail .d-foto img'))).breite === 800, 'ohne Server: das große Foto im Rezept ist da');
const schrift = await page.evaluate(() => document.fonts.check('16px "Permanent Marker"'));
check(schrift, 'ohne Server: die Kreppband-Schrift ist da');
await page.click('#detail .back').catch(() => page.evaluate(() => { location.hash = ''; }));

// Ein Update, während die Rezepte nicht zu holen sind – und die Rezepte liegen noch, wie bis v39, im Vorrat
// der Fassung (der beim Aktivieren wegfliegt): Sie ziehen erst um. Die Seite lädt hier selbst neu.
await page.evaluate(async (alt) => {
  sessionStorage.setItem('boxenstopp.neugeladen', '1');
  const d = await caches.open('boxenstopp-daten-v1');
  const c = await caches.open(`boxenstopp-${alt}`);
  for (const req of await d.keys()) await c.put(req, await d.match(req));
  await caches.delete('boxenstopp-daten-v1');
}, version);
/**
 * Nach einer neuen Fassung sehen; fertig, wenn sie aktiv ist (der alte Vorrat weg) – oder, wenn sie scheitert, sie weg ist.
 * Erst, wenn nichts mehr installiert oder aktiviert wird: Auf einem langsamen Rechner (CI) dauert das Laden der App
 * länger als ein paar Sekunden, und dazwischen ist die alte Fassung noch da, obwohl die neue gleich übernimmt.
 */
const update = (neu, alt) => page.evaluate(async ([n, a]) => {
  const reg = await navigator.serviceWorker.getRegistration();
  try { await reg.update(); } catch (e) { return { fehler: e.message }; }
  for (let i = 0; i < 300; i++) {
    const keys = await caches.keys();
    const ruhig = !reg.installing && !reg.waiting && (!reg.active || reg.active.state === 'activated');
    if (ruhig && (keys.includes(`boxenstopp-${n}`) || i > 20) && (!keys.includes(`boxenstopp-${a}`) || i > 40)) return { keys, aktiv: !keys.includes(`boxenstopp-${a}`) };
    await new Promise((f) => { setTimeout(f, 100); });
  }
  return { keys: await caches.keys(), aktiv: null };
}, [neu, alt]);
await an(fassung('v9001', { ohneDaten: true }));
const u1 = await update('v9001', version);
check(u1.aktiv === true && u1.keys.includes('boxenstopp-daten-v1') && u1.keys.includes('boxenstopp-bilder-v1'), `Update auf v9001: aktiv, die alte Fassung weg (${(u1.keys || []).join(', ')})`);
check((await imVorrat('boxenstopp-daten-v1')).includes('/daten/rezepte.json'), 'die Rezepte sind aus dem alten Vorrat umgezogen');
await page.reload({ waitUntil: 'load' });
check(await rasterZahl() === 50, 'nach dem Update, die Rezepte gerade nicht zu holen: trotzdem alle 50 (aus dem Vorrat)');
check((await imVorrat('boxenstopp-bilder-v1')).length === 49, 'die Fotos haben das Update überstanden');

// Ein Update, dem eine Datei fehlt (schlechtes Netz beim Laden): Es gilt nicht – die vollständige alte Fassung bleibt
await aus();
await an(fassung('v9002', { ohneDaten: true, ohne: 'lob.js' }));
const u2 = await update('v9002', 'v9001');
check(u2.aktiv === false && u2.keys.includes('boxenstopp-v9001'), `Update auf v9002 ohne js/lob.js: gilt nicht, v9001 bleibt (${(u2.keys || []).join(', ')})`);
await aus();
await page.reload({ waitUntil: 'load' });
check(await rasterZahl() === 50 && fehler.length === 0, `danach ohne Server: die App läuft vollständig, alle 50 Rezepte${fehler.length ? ` – Fehler: ${fehler[0]}` : ''}`);

// Auffrischen ohne Neustart (die App schickt das, wenn sie nach einer Weile wieder nach vorn kommt):
// Rezepte, Angebote und Preisverlauf kommen frisch in den Vorrat – fürs nächste Öffnen ohne Netz
const neueRezepte = readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8').replace(/^\{/, '{"probe":"frisch",');
let langsam = 0;
const innen = await starte(PORT + 1, 0, fassung('v9001', { daten: { 'rezepte.json': neueRezepte } }));
const vorne = http.createServer((req, res) => {
  const weiter = () => {
    const p = http.request({ host: '127.0.0.1', port: PORT + 1, path: req.url, method: req.method, headers: req.headers }, (a) => { res.writeHead(a.statusCode, a.headers); a.pipe(res); });
    p.on('error', () => { res.destroy(); });
    req.pipe(p);
  };
  if (langsam && req.url.includes('/daten/')) setTimeout(weiter, langsam); else weiter();
});
await new Promise((ok) => { vorne.listen(PORT, '127.0.0.1', ok); });
const probeImVorrat = () => page.evaluate(async () => { const r = await (await caches.open('boxenstopp-daten-v1')).match(new URL('daten/rezepte.json', location.href).href); return r ? (await r.text()).startsWith('{"probe":"frisch"') : false; });
check(!(await probeImVorrat()), 'vorher: die alten Rezepte im Vorrat');
await page.evaluate(() => navigator.serviceWorker.controller.postMessage({ boxenstopp: 'aktualisieren' }));
check(await bis(probeImVorrat, 10000), '„aktualisieren“: die neuen Rezepte liegen im Vorrat, ohne dass die App neu startet');
check(await bis(async () => (await imVorrat('boxenstopp-bilder-v1')).length === 50, 10000), '… und das fehlende Foto ist nachgeholt');
check(/self\.addEventListener\('periodicsync'[\s\S]*?boxenstopp-aktualisieren/.test(readFileSync(path.join(ROOT, 'sw.js'), 'utf8')) && /periodicSync\.register\('boxenstopp-aktualisieren'/.test(readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8')), 'auf Android auch im Hintergrund (periodicsync, wenn Chrome es erlaubt)');

// Schlechtes Netz: Die Rezepte brauchen 20 s – nach ein paar Sekunden kommen sie aus dem Vorrat
langsam = 20000;
const t0 = Date.now();
await page.reload({ waitUntil: 'load' });
const zahl = await rasterZahl();
const dauerte = Date.now() - t0;
check(zahl === 50 && dauerte < 8500, `schlechtes Netz (Rezepte erst nach 20 s): nach ${(dauerte / 1000).toFixed(1)} s alle 50 aus dem Vorrat`);
langsam = 0;

check(fehler.length === 0, `keine Fehler in der Seite${fehler.length ? `: ${fehler.slice(0, 2).join(' | ')}` : ''}`);
await browser.close();
await new Promise((ok) => { vorne.closeAllConnections(); vorne.close(ok); });
await new Promise((ok) => { innen.closeAllConnections(); innen.close(ok); });
ende();
