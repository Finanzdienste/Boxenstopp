/*
 * Reiter „Einstellungen“: die Leiste unten (fünf Reiter, Kurzform, wenn es
 * eng wird; Reiter ausblenden, einer bleibt, gemerkt), die gemeinsame Liste
 * (Einrichten über den Hinweis oder einen Link, danach zur Liste), der
 * KI-Schlüssel, was die App gelernt hat (Tempo, Wege, Preisalarme, Bons),
 * die Fassung – und breit das Zahnrad oben.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';

const { check, ende } = pruefer();
const GKEY = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
const VERSION = /const VERSION = '(v\d+)'/.exec(readFileSync(path.join(ROOT, 'sw.js'), 'utf8'))[1];
const browser = await starteBrowser();
const tab = (p) => p.evaluate(() => document.querySelector('#app').dataset.tab);
const sichtbareReiter = (p) => p.$$eval('.tabbar .tab:not([hidden])', (xs) => xs.map((x) => x.dataset.tab));
const abgeschnitten = (p) => p.$$eval('.tabbar .tab:not([hidden]) span:not(.badge)', (xs) => xs.filter((s) => s.offsetWidth && s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent));

// --- Ein Handy, schmal, noch nicht geteilt
const h = await handy(browser, { viewport: { width: 360, height: 780 } });
const p = h.page;
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['rezepte', 'amy', 'einkauf', 'angebote', 'einstellungen']), 'unten fünf Reiter, die Einstellungen ganz rechts');
check(await p.evaluate(() => document.querySelector('.tabbar').classList.contains('kurz')) && (await p.locator('.tab[data-tab="amy"]').innerText()).trim() === 'Amy' && (await p.locator('.tab[data-tab="einkauf"]').innerText()).includes('Liste'), '360 px breit: die Kurzform („Amy“, „Liste“)');
check((await abgeschnitten(p)).length === 0, `keine Beschriftung abgeschnitten (${(await abgeschnitten(p)).join(', ')})`);
await p.setViewportSize({ width: 430, height: 900 });
check(await bis(async () => (await abgeschnitten(p)).length === 0), '430 px: alles lesbar');
await p.setViewportSize({ width: 360, height: 780 });
await p.click('.tab[data-tab="einstellungen"]');
check(await tab(p) === 'einstellungen' && JSON.stringify(await p.$$eval('#view-einstellungen .e-karte > h2', (xs) => xs.map((x) => x.textContent))) === JSON.stringify(['Gemeinsame Liste', 'Push-Nachrichten', 'KI-Schlüssel', 'Darstellung', 'Reiter unten', 'Gelernt und gemerkt', 'Über die App']), 'Einstellungen: sieben Bereiche');
check(await p.locator('#e-zugang #z-form').isVisible() && !(await p.locator('#e-zugang [data-act="z-abbrechen"]').count()), 'nicht geteilt: hier gleich das Formular (ohne Abbrechen)');
check((await p.locator('#push-bereich').innerText()).includes('sobald die gemeinsame Liste eingerichtet ist'), 'Push: erst nach dem Einrichten');
// Über der Liste der Hinweis – „Einrichten“ führt hierher
await p.fill('#z-name', 'Tobi');
await p.click('.tab[data-tab="einkauf"]');
check(await p.locator('#zugang .zugang-banner').isVisible(), 'über der Liste: „Nur auf diesem Handy“');
await p.click('#zugang [data-act="z-oeffnen"]');
check(await tab(p) === 'einstellungen' && await p.evaluate(() => document.activeElement?.id) === 'z-name' && (await p.inputValue('#z-name')) === 'Tobi', '„Einrichten“ springt in die Einstellungen, der Name ist noch da');

// Reiter ausblenden
await p.click('#e-reiter [data-reiter="amy"]');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['rezepte', 'einkauf', 'angebote', 'einstellungen']), 'Amys Rezepte ausgeblendet: vier Reiter');
check(await bis(async () => !(await p.evaluate(() => document.querySelector('.tabbar').classList.contains('kurz')))), 'jetzt passt die lange Beschriftung wieder');
await p.click('.tab[data-tab="rezepte"]');
check(await p.locator('#browse .amy-link').isVisible(), 'dafür steht bei den Rezepten die Karte „Amys Rezepte“');
await p.click('#browse .amy-link');
check(await tab(p) === 'amy', '…und sie führt hin');
await p.click('.tab[data-tab="einstellungen"]');
for (const t of ['rezepte', 'angebote']) await p.click(`#e-reiter [data-reiter="${t}"]`);
check(await p.locator('#e-reiter [data-reiter="einkauf"]').isDisabled() && (await p.locator('#e-reiter').innerText()).includes('einer bleibt'), 'nur noch die Einkaufsliste: die lässt sich nicht auch noch ausblenden');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['einkauf', 'einstellungen']), 'unten: Einkaufsliste und Einstellungen');
await p.click('.tab[data-tab="einkauf"]');
await p.reload({ waitUntil: 'load' });
await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['einkauf', 'einstellungen']) && await tab(p) === 'einkauf', 'nach dem Neuladen: gemerkt');
await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('boxenstopp.ansicht.v1')); a.tab = 'angebote'; localStorage.setItem('boxenstopp.ansicht.v1', JSON.stringify(a)); });
await p.reload({ waitUntil: 'load' });
await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await tab(p) === 'einkauf', 'stand man zuletzt auf einem ausgeblendeten Reiter: es geht beim ersten sichtbaren los');
await p.click('.tab[data-tab="einstellungen"]');
for (const t of ['rezepte', 'amy', 'angebote']) await p.click(`#e-reiter [data-reiter="${t}"]`);
check((await sichtbareReiter(p)).length === 5, 'alle wieder an');

// Reihenfolge: die Angebote nach vorn
for (let n = 0; n < 3; n++) await p.click('#e-reiter [data-reiter-hoch="angebote"]');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['angebote', 'rezepte', 'amy', 'einkauf', 'einstellungen']), 'dreimal ↑: die Angebote stehen unten ganz links');
check(await p.locator('#e-reiter [data-reiter-hoch="angebote"]').isDisabled() && await p.evaluate(() => document.activeElement?.dataset.reiterRunter) === 'angebote', 'ganz vorn: ↑ geht nicht mehr, der Fokus springt auf ↓');
check(JSON.stringify(await p.$$eval('#e-reiter [data-reiter]', (xs) => xs.map((x) => x.dataset.reiter))) === JSON.stringify(['angebote', 'rezepte', 'amy', 'einkauf']) && await p.locator('#e-reiter [data-reiter-runter="einkauf"]').isDisabled(), 'in den Einstellungen in derselben Reihenfolge, ganz hinten kein ↓');
await p.click('#e-reiter [data-reiter-runter="rezepte"]');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['angebote', 'amy', 'rezepte', 'einkauf', 'einstellungen']), '↓ bei den Rezepten: einen nach rechts');
await p.reload({ waitUntil: 'load' });
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['angebote', 'amy', 'rezepte', 'einkauf', 'einstellungen']), 'nach dem Neuladen: gleich in dieser Reihenfolge');
await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await p.click('.tab[data-tab="einstellungen"]');
for (let i = 0; i < 2; i++) await p.click('#e-reiter [data-reiter-hoch="rezepte"]');
await p.click('#e-reiter [data-reiter-runter="angebote"]');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['rezepte', 'amy', 'angebote', 'einkauf', 'einstellungen']), 'zurückgeschoben');
await p.click('#e-reiter [data-reiter-runter="angebote"]');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['rezepte', 'amy', 'einkauf', 'angebote', 'einstellungen']), 'wieder wie am Anfang');

// Hell oder dunkel
const hintergrund = () => p.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
const leiste = () => p.$$eval('meta[name="theme-color"]', (ms) => ms.map((m) => m.content).join());
await p.emulateMedia({ colorScheme: 'light' });
check(await p.locator('#e-design input[value="auto"]').isChecked() && await hintergrund() === 'rgb(237, 241, 239)', 'Darstellung: „Wie das Gerät“, hell');
await p.click('#e-design .e-wahl:has(input[value="dunkel"])');
check(await p.evaluate(() => document.documentElement.dataset.design) === 'dunkel' && await hintergrund() === 'rgb(14, 20, 18)' && await leiste() === '#0E1412,#0E1412', '„Dunkel“: dunkel, auch wenn das Gerät hell ist – oben die dunkle Leiste');
await p.reload({ waitUntil: 'load' });
check(await p.evaluate(() => document.documentElement.dataset.design) === 'dunkel' && await hintergrund() === 'rgb(14, 20, 18)', 'nach dem Neuladen: gleich dunkel');
await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await p.click('.tab[data-tab="amy"]');
check(await hintergrund() === 'rgb(35, 16, 25)', 'Amys Reiter: in ihrem dunklen Rosa');
await p.click('.tab[data-tab="einstellungen"]');
await p.emulateMedia({ colorScheme: 'dark' });
await p.click('#e-design .e-wahl:has(input[value="hell"])');
check(await hintergrund() === 'rgb(237, 241, 239)' && await leiste() === '#EDF1EF,#EDF1EF', '„Hell“: hell, auch wenn das Gerät dunkel ist');
await p.click('#e-design .e-wahl:has(input[value="auto"])');
check(await p.evaluate(() => document.documentElement.dataset.design === undefined && localStorage.getItem('boxenstopp.design.v1') === null) && await hintergrund() === 'rgb(14, 20, 18)', '„Wie das Gerät“: folgt wieder dem Gerät (hier dunkel)');
await p.emulateMedia({ colorScheme: 'light' });
// Der Punkt oben führt auch her
await p.click('.tab[data-tab="rezepte"]');
await p.click('#sync');
check(await tab(p) === 'einstellungen', '„Nur lokal“ oben antippen: Einstellungen');

// KI-Schlüssel
await p.fill('#e-ki-feld', 'quatsch');
await p.press('#e-ki-feld', 'Enter');
check((await p.locator('#e-ki .zugang-fehler').innerText()).includes('AQ.'), 'kein Schlüssel: Hinweis, wie er aussieht');
await p.fill('#e-ki-feld', GKEY);
await p.press('#e-ki-feld', 'Enter');
check(await bis(async () => (await p.locator('#e-ki').innerText()).includes('Google')) && await p.evaluate((k) => JSON.parse(localStorage.getItem('boxenstopp.ki.v1')).schluessel === k, GKEY), 'gespeichert: „Ein Schlüssel von Google ist eingetragen“');
await p.click('#e-ki [data-act="e-ki-aendern"]');
check(await p.locator('#e-ki-feld').isVisible() && await p.evaluate(() => document.activeElement?.id) === 'e-ki-feld', '„Schlüssel ändern“: das Feld');
await p.click('#e-ki [data-act="e-ki-zu"]');
await p.click('#e-ki [data-act="e-ki-weg"]');
check(await p.evaluate(() => localStorage.getItem('boxenstopp.ki.v1')) === null && (await p.locator('#e-ki').innerText()).includes('aistudio'), 'entfernt');
await p.click('#toast button');
check(await bis(async () => await p.evaluate((k) => JSON.parse(localStorage.getItem('boxenstopp.ki.v1') || '{}').schluessel === k, GKEY)) && (await p.locator('#e-ki').innerText()).includes('Google'), 'Rückgängig: wieder da');

// Tempo
await p.evaluate(() => localStorage.setItem('boxenstopp.tempo.v1', JSON.stringify({ offen: {}, gesamt: {}, proben: [['chili:a1', 'vor', 3, 4], ['chili:a2', 'vor', 4, 6], ['chili:a3', 'vor', 5, 7], ['chili:a4', 'vor', 6, 8], ['chili:a5', 'vor', 4, 6], ['chili:a6', 'koch', 3, 3]] })));
await p.reload({ waitUntil: 'load' });
await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check((await p.locator('#e-tempo').innerText()).includes('Gelernt aus 6 abgehakten Schritten'), `Tempo: gelernt aus 6 Schritten (${(await p.locator('#e-tempo').innerText()).replace(/\s+/g, ' ')})`);
await p.click('#e-tempo [data-act="tempo-weg"]');
check(await bis(async () => (await p.locator('#e-tempo').innerText()).includes('Noch nichts gelernt')), '„Tempo vergessen“: weg');
await p.click('#toast button');
check(await bis(async () => (await p.locator('#e-tempo').innerText()).includes('Gelernt aus 6')), 'Rückgängig: wieder da');
// Über die App: ohne Service Worker gibt es nur das Neuladen
await p.click('#e-ueber [data-act="e-update"]');
check(await bis(async () => (await p.locator('#toast').innerText()).includes('neu laden')), '„Nach Updates suchen“ ohne Offline-Speicher: neu laden');
check(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'kein seitliches Scrollen');

// --- Geteilt: Link öffnet das Einrichten, danach die Liste; was die App gemerkt hat
const t0 = '2026-10-28T10:00:00.000Z';
const gh = githubAttrappe();
gh.zustand.datei = JSON.stringify({
  version: 1, rev: 3, items: {},
  wege: { Aldi: { n: 3, at: t0, k: { zwiebeln: { c: 'obst', p: [0.1, 0.12] } } }, Lidl: { n: 1, at: t0, k: { reis: { c: 'trocken', p: [0.5] } } } },
  preisalarm: { haehnchenbrust: { max: 7.5, u: 'kg', name: 'Hähnchenbrustfilet', by: 'Tobi', at: t0 } },
  bons: { haehnchenbrust: [{ eur: 9.99, q: 1000, u: 'g', laden: 'Lidl', by: 'Amy', at: 'b1' }, { eur: 8.99, q: 1000, u: 'g', laden: 'Aldi', by: 'Amy', at: 'b2' }] },
});
gh.zustand.version = 3;
gh.zustand.sha = 'sha3';
const a = (await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` }));
const ap = a.page;
check(await tab(ap) === 'einstellungen' && (await ap.inputValue('#z-token')) === SCHLUESSEL, 'Link mit Schlüssel: die Einstellungen, der Schlüssel steht drin');
await ap.fill('#z-name', 'Amy');
await ap.click('#z-los');
check(await bis(async () => (await ap.locator('#sync-text').innerText()) === 'Geteilt') && await bis(async () => (await tab(ap)) === 'einkauf'), 'verbunden: weiter zur Liste');
await ap.click('.tab[data-tab="einstellungen"]');
check((await ap.locator('#teilen .e-status').innerText()).startsWith('Du bist Amy · Geteilt') && await ap.locator('#teilen [data-act="z-link"]').isVisible() && !(await ap.locator('#e-zugang #z-form').count()), 'jetzt: „Du bist Amy · Geteilt“, Link fürs zweite Handy, kein Formular');
check(await bis(async () => (await ap.locator('#push-bereich [data-act="push-paar"]').count()) === 1, 8000), 'Push: Einrichten');
const gemerkt = (await ap.locator('#e-gemerkt').innerText()).replace(/\s+/g, ' ');
check(gemerkt.includes('Aldi gelernt aus 3 Einkäufen, zuletzt 28.10.') && gemerkt.includes('Lidl gelernt aus 1 Einkauf'), `Wege: Aldi und Lidl (${gemerkt.slice(0, 160)})`);
check(gemerkt.includes('Hähnchenbrustfilet höchstens 7,50 €/kg · von Tobi'), 'Preisalarm mit Wunschpreis und von wem');
check(gemerkt.includes('zuletzt 8,99 € für 1 kg bei Aldi · 2 Bons'), 'Preise vom Bon: der letzte, wie viele');
await ap.click('#e-wege [data-act="weg-vergessen"][data-laden="Aldi"]');
check(await bis(() => !gh.liste()?.wege?.Aldi && !!gh.liste()?.wege?.Lidl, 8000) && (await ap.locator('#toast').innerText()).includes('Aldi vergessen'), 'Aldi vergessen – Lidl bleibt');
await ap.click('#toast button');
check(await bis(() => gh.liste()?.wege?.Aldi?.n === 3, 8000), 'Rückgängig: Aldi wieder da');
await ap.click('#e-alarme [data-alarm-weg="haehnchenbrust"]');
check(await bis(() => !gh.liste()?.preisalarm?.haehnchenbrust, 8000) && await bis(async () => (await ap.locator('#e-alarme').innerText()).includes('Keiner')), 'Preisalarm gelöscht');
await ap.click('#e-bons [data-e-bons-weg="haehnchenbrust"]');
check(await bis(() => !gh.liste()?.bons?.haehnchenbrust, 8000), 'Preise vom Bon gelöscht');
await ap.click('#toast button');
check(await bis(() => gh.liste()?.bons?.haehnchenbrust?.length === 2 && gh.liste().bons.haehnchenbrust[1].eur === 8.99, 8000), 'Rückgängig: beide Bons wieder da, in der Reihenfolge');

// --- Breit: das Zahnrad oben, die Liste bleibt rechts
const b = await handy(browser, { viewport: { width: 1280, height: 860 } });
const bp = b.page;
check(await bp.locator('.tabbar').isHidden() && await bp.locator('.kopf-einst').isVisible(), 'breit: keine Leiste unten, oben das Zahnrad');
await bp.click('.kopf-einst');
check(await bp.locator('#view-einstellungen').isVisible() && await bp.locator('#view-list').isVisible() && await bp.locator('#view-recipes').isHidden(), 'Einstellungen links, die Liste bleibt rechts');
await bp.click('#view-einstellungen .back');
check(await bp.locator('#view-recipes').isVisible() && await bp.locator('#view-einstellungen').isHidden(), '„Alle Rezepte“ führt zurück');

// --- Mit Service Worker: die laufende Fassung
const w = await handy(browser, { ohneWorker: false });
await bis(() => w.page.evaluate(async () => (await caches.keys()).some((k) => /^boxenstopp-v\d+$/.test(k))), 15000);
await w.page.click('.tab[data-tab="einstellungen"]');
check(await bis(async () => (await w.page.locator('#e-ueber .e-fassung').innerText().catch(() => '')) === VERSION, 10000), `Über die App: Fassung ${VERSION} (wie in sw.js)`);

const fehler = [...h.fehler, ...a.fehler, ...b.fehler, ...w.fehler];
check(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
