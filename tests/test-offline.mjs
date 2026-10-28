/*
 * Ohne Netz – und alles, was dafür im Vorrat liegen muss.
 *
 * Erst ohne Browser: Jede Datei der App steht in SHELL (sw.js), jeden Eintrag
 * dort gibt es, jeder Import zeigt auf eine vorhandene Datei, die Rezepte
 * stehen nicht darin, das Manifest passt. Dann im Browser: einmal laden,
 * Server aus, neu laden – Rezepte und Liste sind noch da.
 *
 * Server aus statt setOffline() – wie bei Freizeit: Playwrights
 * Offline-Schalter schneidet die Anfragen des Service Workers nicht ab.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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
const server = await starte(PORT, 0);
const aus = () => new Promise((fertig) => { server.closeAllConnections(); server.close(() => fertig()); });

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
await page.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await page.locator('#grid .box').count() === 50, 'mit Netz: 50 Rezepte');
await page.click('.tab[data-tab="einkauf"]');
await page.fill('#add-input', 'Bananen');
await page.press('#add-input', 'Enter');

const vorrat = await page.evaluate(async (v) => {
  const namen = async () => (await (await caches.open(`boxenstopp-${v}`)).keys()).map((r) => new URL(r.url).pathname);
  for (let i = 0; i < 50; i++) {
    const keys = await namen();
    if (keys.includes('/daten/rezepte.json')) return keys;
    await new Promise((f) => { setTimeout(f, 100); });
  }
  return namen();
}, version);
check(vorrat.filter((k) => !k.startsWith('/daten/')).length >= shell.length - 1, `im Vorrat liegt die App (${vorrat.length} Dateien, SHELL hat ${shell.length})`);
check(vorrat.includes('/daten/rezepte.json'), 'die zuletzt geladenen Rezepte liegen ebenfalls im Vorrat');
const bildchen = JSON.parse(readFileSync(path.join(ROOT, 'bilder', 'zutaten', 'alle.json'), 'utf8'));
const ohneBildchen = bildchen.filter((b) => !vorrat.includes(`/bilder/zutaten/${b}.svg`));
check(!ohneBildchen.length, `alle ${bildchen.length} Zutaten-Bildchen liegen schon nach dem Installieren im Vorrat${ohneBildchen.length ? ` – nicht: ${ohneBildchen.slice(0, 5).join(', ')}` : ''}`);

// Rezeptfotos: eigener Vorrat, der ein Update übersteht; eine neue Fassung räumt die alte weg
const chiliFoto = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8')).rezepte.find((r) => r.id === 'chili').bild;
const fotos = await page.evaluate(async (foto) => {
  const c = await caches.open('boxenstopp-bilder-v1');
  const namen = async () => (await c.keys()).map((r) => { const u = new URL(r.url); return u.pathname + u.search; });
  let vorher = [];
  for (let i = 0; i < 50; i++) {
    vorher = await namen();
    if (vorher.includes(`/${foto}`)) break;
    await new Promise((f) => { setTimeout(f, 100); });
  }
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

await aus();
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0, null, { timeout: 5000 }).catch(() => {});
check(await page.title() === 'Boxenstopp', 'ohne Server öffnet die App');
check(await page.locator('#grid .box').count() === 50, 'ohne Server: alle 50 Rezepte');
check(await page.locator('#list-body .item-name', { hasText: 'Bananen' }).count() === 1, 'ohne Server: die Liste mit den Bananen');
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
const schrift = await page.evaluate(() => document.fonts.check('16px "Permanent Marker"'));
check(schrift, 'ohne Server: die Kreppband-Schrift ist da');

check(fehler.length === 0, `keine Fehler in der Seite${fehler.length ? `: ${fehler.slice(0, 2).join(' | ')}` : ''}`);
await browser.close();
ende();
