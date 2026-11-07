/*
 * Reiter „Einstellungen“: die Leiste unten (sechs Reiter, Kurzform, wenn es
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
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['rezepte', 'amy', 'einkauf', 'angebote', 'haushalt', 'einstellungen']), 'unten sechs Reiter, die Einstellungen ganz rechts');
// Bei den Rezepten keine großen Karten mehr – nur die Kacheln „Reste“ und „Speisekarte“ (die haben keinen Reiter); was unten ein Reiter ist, steht nicht doppelt da
const kacheln = () => p.$$eval('#browse .abk', (xs) => xs.filter((x) => x.offsetParent).map((x) => x.querySelector('.abk-t').innerText.trim()));
check(JSON.stringify(await kacheln()) === JSON.stringify(['Neues Rezept', 'Resteverwertung', 'Speisekarte']) && await p.locator('#browse .reste-karte').count() === 0, `bei den Rezepten nur Neues Rezept, Resteverwertung und Speisekarte – Amy, Haushalt und Angebote sind ja Reiter (${(await kacheln()).join(', ')})`);
const kachelHoehe = await p.locator('#browse .abk-reste').evaluate((x) => x.getBoundingClientRect().height);
check(kachelHoehe < 60, `ein schmaler Knopf (${Math.round(kachelHoehe)} px hoch)`);
check(await p.evaluate(() => document.querySelector('.tabbar').classList.contains('kurz')) && (await p.locator('.tab[data-tab="amy"]').innerText()).trim() === 'Amy' && (await p.locator('.tab[data-tab="einkauf"]').innerText()).includes('Liste'), '360 px breit: die Kurzform („Amy“, „Liste“)');
check((await abgeschnitten(p)).length === 0, `keine Beschriftung abgeschnitten (${(await abgeschnitten(p)).join(', ')})`);
await p.setViewportSize({ width: 430, height: 900 });
check(await bis(async () => (await abgeschnitten(p)).length === 0), '430 px: alles lesbar');
await p.setViewportSize({ width: 360, height: 780 });
await p.click('.tab[data-tab="einstellungen"]');
check(await tab(p) === 'einstellungen' && JSON.stringify(await p.$$eval('#view-einstellungen .e-karte > h2', (xs) => xs.map((x) => x.textContent))) === JSON.stringify(['Gemeinsame Liste', 'Ziel pro Box', 'Boxen pro Rezept', 'Gäste & Überblick', 'Push-Nachrichten', 'Microsoft To Do', 'KI-Schlüssel', 'Darstellung', 'Reiter unten', 'Gelernt und gemerkt', 'Über die App']), 'Einstellungen: elf Bereiche');
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
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['rezepte', 'einkauf', 'angebote', 'haushalt', 'einstellungen']), 'Amys Rezepte ausgeblendet: fünf Reiter');
check(await bis(async () => !(await p.evaluate(() => document.querySelector('.tabbar').classList.contains('kurz')))), 'jetzt passt die lange Beschriftung wieder');
await p.click('.tab[data-tab="rezepte"]');
check(await p.locator('#browse .abk-amy').isHidden() && JSON.stringify(await kacheln()) === JSON.stringify(['Neues Rezept', 'Resteverwertung', 'Speisekarte']), 'ausgeblendet ist weg: auch bei den Rezepten keine Kachel „Amy“ – zurück geht es in den Einstellungen');
await p.click('.tab[data-tab="einstellungen"]');
for (const t of ['rezepte', 'angebote', 'haushalt']) await p.click(`#e-reiter [data-reiter="${t}"]`);
check(await p.evaluate(() => [...document.querySelectorAll('#browse .abk')].filter((x) => window.getComputedStyle(x).display !== 'none').map((x) => x.dataset.act || x.dataset.tab).join()) === 'wunsch,reste,speisekarte', 'alles außer der Liste ausgeblendet: bei den Rezepten trotzdem nur Neues Rezept, Resteverwertung und Speisekarte');
check((await p.locator('#e-reiter').innerText()).includes('holst du hier wieder zurück'), 'der Hinweis: zurück geht es hier');
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
for (const t of ['rezepte', 'amy', 'angebote', 'haushalt']) await p.click(`#e-reiter [data-reiter="${t}"]`);
check((await sichtbareReiter(p)).length === 6, 'alle wieder an');

// Reihenfolge: die Angebote nach vorn
for (let n = 0; n < 3; n++) await p.click('#e-reiter [data-reiter-hoch="angebote"]');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['angebote', 'rezepte', 'amy', 'einkauf', 'haushalt', 'einstellungen']), 'dreimal ↑: die Angebote stehen unten ganz links');
check(await p.locator('#e-reiter [data-reiter-hoch="angebote"]').isDisabled() && await p.evaluate(() => document.activeElement?.dataset.reiterRunter) === 'angebote', 'ganz vorn: ↑ geht nicht mehr, der Fokus springt auf ↓');
check(JSON.stringify(await p.$$eval('#e-reiter [data-reiter]', (xs) => xs.map((x) => x.dataset.reiter))) === JSON.stringify(['angebote', 'rezepte', 'amy', 'einkauf', 'haushalt']) && await p.locator('#e-reiter [data-reiter-runter="haushalt"]').isDisabled(), 'in den Einstellungen in derselben Reihenfolge, ganz hinten kein ↓');
await p.click('#e-reiter [data-reiter-runter="rezepte"]');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['angebote', 'amy', 'rezepte', 'einkauf', 'haushalt', 'einstellungen']), '↓ bei den Rezepten: einen nach rechts');
await p.reload({ waitUntil: 'load' });
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['angebote', 'amy', 'rezepte', 'einkauf', 'haushalt', 'einstellungen']), 'nach dem Neuladen: gleich in dieser Reihenfolge');
await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await p.click('.tab[data-tab="einstellungen"]');
for (let i = 0; i < 2; i++) await p.click('#e-reiter [data-reiter-hoch="rezepte"]');
await p.click('#e-reiter [data-reiter-runter="angebote"]');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['rezepte', 'amy', 'angebote', 'einkauf', 'haushalt', 'einstellungen']), 'zurückgeschoben');
await p.click('#e-reiter [data-reiter-runter="angebote"]');
check(JSON.stringify(await sichtbareReiter(p)) === JSON.stringify(['rezepte', 'amy', 'einkauf', 'angebote', 'haushalt', 'einstellungen']), 'wieder wie am Anfang');

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

// --- KI-Schlüssel für alle Handys der Liste: freigeben → ki.json, ein anderes Handy übernimmt ihn, ein eigener neuerer bleibt
const AKEY = 'sk-ant-api03-TESTTESTTESTTESTTESTTESTTESTTEST_abc';
await ap.fill('#e-ki-feld', AKEY);
await ap.press('#e-ki-feld', 'Enter');
check(await bis(async () => (await ap.locator('#e-ki').innerText()).includes('Anthropic')) && (await ap.locator('#e-ki [data-act="e-ki-teilen"]').count()) === 1 && !(await p.locator('#e-ki [data-act="e-ki-teilen"]').count()), 'mit Zugang: „Für alle Handys dieser Liste freigeben“ – ohne Zugang (erstes Handy) nicht');
await ap.click('#e-ki [data-act="e-ki-teilen"]');
const kiDatei = () => { try { return JSON.parse(gh.zustand.dateien['ki.json']); } catch { return null; } };
check(await bis(() => kiDatei()?.schluessel === AKEY, 8000) && kiDatei().von === 'Amy' && /^\d{4}-/.test(kiDatei().stand) && await bis(async () => (await ap.locator('#e-ki .e-ki-teilen').innerText()).includes('Freigegeben für alle Handys')) && (await ap.locator('#toast').innerText()).includes('Freigegeben'), 'freigegeben: ki.json mit Schlüssel, von Amy und Stand; „Freigegeben für alle Handys dieser Liste“');
const c = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
const cp = c.page;
await cp.fill('#z-name', 'Tobi');
await cp.click('#z-los');
check(await bis(async () => await cp.evaluate((k) => JSON.parse(localStorage.getItem('boxenstopp.ki.v1') || '{}').schluessel === k, AKEY), 8000) && await cp.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.ki.v1')).geteilt === true) && await bis(async () => (await cp.locator('#toast').innerText()).includes('KI-Schlüssel von Amy übernommen')), 'das zweite Handy bekommt den Schlüssel beim Verbinden, als geteilt gemerkt, mit Hinweis');
await cp.click('.tab[data-tab="einstellungen"]');
check(await bis(async () => (await cp.locator('#e-ki').innerText()).includes('Anthropic')) && (await cp.locator('#e-ki .e-ki-teilen').innerText()).includes('Freigegeben für alle Handys dieser Liste (von Amy)'), 'dort steht: Anthropic, freigegeben von Amy');
// Ein eigener, neuerer Schlüssel bleibt beim Neuladen – der geteilte ist älter
await cp.click('#e-ki [data-act="e-ki-aendern"]');
await cp.fill('#e-ki-feld', GKEY);
await cp.press('#e-ki-feld', 'Enter');
check(await bis(async () => (await cp.locator('#e-ki').innerText()).includes('Google')), 'eigener Google-Schlüssel eingetragen');
await cp.reload({ waitUntil: 'load' });
await cp.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await new Promise((f) => { setTimeout(f, 1500); });
check(await cp.evaluate((k) => JSON.parse(localStorage.getItem('boxenstopp.ki.v1')).schluessel === k, GKEY), 'nach dem Neuladen: der eigene, neuere Schlüssel bleibt');
// Nicht mehr teilen: ki.json ohne Schlüssel – wer ihn hat, behält ihn; ein neues Handy bekommt nichts
await ap.click('#e-ki [data-act="e-ki-teilen-weg"]');
check(await bis(() => kiDatei()?.schluessel === '', 8000) && await bis(async () => (await ap.locator('#e-ki .e-ki-teilen').innerText()).includes('freigeben')) && await ap.evaluate((k) => JSON.parse(localStorage.getItem('boxenstopp.ki.v1')).schluessel === k, AKEY), 'nicht mehr geteilt: ki.json leer, Amys Schlüssel bleibt auf ihrem Handy');
const d = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
await d.page.fill('#z-name', 'Marielle');
await d.page.click('#z-los');
await bis(async () => (await d.page.locator('#sync-text').innerText()) === 'Geteilt', 8000);
await new Promise((f) => { setTimeout(f, 1500); });
check(await d.page.evaluate(() => localStorage.getItem('boxenstopp.ki.v1')) === null, 'ein neues Handy bekommt keinen Schlüssel mehr');
await c.ctx.close();
await d.ctx.close();

// --- Breit: das Zahnrad oben, die Liste bleibt rechts
const b = await handy(browser, { viewport: { width: 1280, height: 860 } });
const bp = b.page;
check(await bp.locator('.tabbar').isHidden() && await bp.locator('.kopf-einst').isVisible(), 'breit: keine Leiste unten, oben das Zahnrad');
const breitKacheln = await bp.$$eval('#browse .abk', (xs) => xs.filter((x) => x.offsetParent).map((x) => x.querySelector('.abk-t').innerText.trim()));
check(JSON.stringify(breitKacheln) === JSON.stringify(['Neues Rezept', 'Resteverwertung', 'Speisekarte', 'Amys Rezepte', 'Haushalt', 'Angebote']), `breit (ohne Leiste unten): alle sechs Kacheln, ausgeschrieben (${breitKacheln.join(', ')})`);
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
