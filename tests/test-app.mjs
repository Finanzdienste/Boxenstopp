/*
 * Die App im Browser, ohne gemeinsame Liste (nur dieses Handy).
 *
 * Rezepte filtern und öffnen, alles auf die Liste, Mengen aus zwei Rezepten,
 * einzelne Zutaten, abhaken, eigene Einträge, löschen und rückgängig,
 * Erledigtes weg, Frühstück, Portionsrechner – und nach dem Neuladen ist
 * alles noch da.
 */
import { pruefer, starteBrowser, handy, bis } from './hilfe.mjs';

const { check, ende } = pruefer();
const browser = await starteBrowser();
const { page, fehler } = await handy(browser);

const text = (sel) => page.locator(sel).innerText();
const zeile = (name) => page.locator('#list-body .item', { has: page.locator('.item-name', { hasText: new RegExp(`^${name}$`) }) });
const badge = async () => ((await page.locator('#badge').isHidden()) ? 0 : Number(await page.locator('#badge').innerText()));

// --- Rezepte
check(await page.locator('#grid .box').count() === 16, '16 Rezeptboxen');
check((await page.locator('#r-eyebrow').textContent()).startsWith('16 Rezepte'), 'Überschrift zählt die Rezepte');
check((await text('#sync-text')) === 'Nur lokal', 'ohne Schlüssel: „Nur lokal“');
await page.click('[data-filter="haehnchen"]');
check(await page.locator('#grid .box').count() === 9, 'Filter Hähnchen: 9');
await page.click('[data-filter="veggie"]');
check(await page.locator('#grid .box').count() === 1, 'Filter Veggie: 1');
await page.click('[data-filter="alle"]');

await page.click('[data-open="butter-chicken"]');
check((await text('#d-title')) === 'Butter Chicken mit Reis', 'Butter Chicken öffnet');
const mengenImSchritt = await page.$$eval('.step-d', (ds) => ds[0].querySelectorAll('.mg').length);
check(mengenImSchritt >= 8, `Schritt 1 nennt die Mengen und hebt sie hervor (${mengenImSchritt})`);
check((await page.locator('.step-d').first().innerText()).includes('800 g Hähnchenbrust'), '„800 g Hähnchenbrust“ steht direkt im ersten Schritt');
check(await page.locator('.sub-h', { hasText: 'Extras' }).count() === 1, 'Backpapier steht unter Extras');
check((await text('.label .c-kcal .v')).startsWith('434'), 'Etikett: 434 kcal pro Box');
check((await text('.label .c-kcal .dlt')) === '−9', 'Etikett: 9 kcal unter dem Ziel');
await page.click('[data-act="alle-dazu"]');
check(await bis(async () => (await badge()) === 10), `alles auf die Liste: 10 offen (${await badge()})`);
check(await page.locator('.onlist').count() === 1, '„Alle 10 Zutaten stehen auf der Liste“');
// Öl aus dem Vorrat einzeln dazu
const oel = page.locator('.ing', { has: page.locator('.ing-name', { hasText: /^Öl$/ }) }).locator('.tog');
await oel.click();
check(await oel.getAttribute('aria-pressed') === 'true', 'Öl aus dem Vorrat einzeln auf der Liste');
await page.locator('.ing', { has: page.locator('.ing-name', { hasText: /^Garam Masala$/ }) }).locator('.tog').click();
await page.fill('#pot-empty', '2150');
await page.fill('#pot-full', '5450');
check((await text('#per-box b')) === '413 g', `Portionsrechner: 413 g pro Box (${await text('#per-box b')})`);
await page.click('[data-act="zurueck"]');

await page.click('[data-open="teriyaki"]');
await page.click('[data-act="alle-dazu"]');
await page.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await zeile('Basmati- oder Jasminreis').count()) === 1), 'Reis steht einmal auf der Liste');
check((await zeile('Basmati- oder Jasminreis').locator('.item-qty').innerText()).startsWith('520 g'), 'Reis aus beiden Rezepten: 520 g');
check((await zeile('Knoblauch').locator('.item-qty').innerText()).replace(/\s+/g, ' ') === '10 Zehen ≈ 1 Knolle', 'Knoblauch: 10 Zehen, etwa 1 Knolle');
check((await zeile('Öl, neutral').innerText()).includes('Butter Chicken: 10 g'), 'Öl mit Text statt Menge');
check(await page.locator('#forrow .forchip').count() === 2, '„Für“: Butter Chicken und Teriyaki Bowl');
const offenVorher = await badge();
check(offenVorher === 17, `17 offene Einträge (${offenVorher})`);

// --- abhaken, eigene Einträge, löschen
await zeile('Brokkoli').locator('.cb').click();
check(await bis(async () => (await page.locator('.grp-done .item-name', { hasText: 'Brokkoli' }).count()) === 1), 'abgehakt: Brokkoli liegt „Im Wagen“');
check((await badge()) === offenVorher - 1, 'Zahl am Reiter zählt runter');
await page.fill('#add-input', 'Bananen');
await page.press('#add-input', 'Enter');
await page.fill('#add-input', 'Zahnpasta');
await page.click('#add-btn');
const gruppeVon = (name) => page.locator('#list-body .grp', { has: page.locator('.item-name', { hasText: new RegExp(`^${name}$`) }) }).getAttribute('data-bereich');
check((await gruppeVon('Bananen')) === 'frisch', 'Bananen landen bei Frisches');
check((await gruppeVon('Zahnpasta')) === 'extras', 'Zahnpasta bei Extras');
const bereiche = await page.$$eval('#list-body .grp:not(.grp-done)', (gs) => gs.map((g) => g.dataset.bereich));
check(bereiche.join(' > ') === 'frisch > tierisch > trocken > gewuerze > extras', `Bereiche von oben nach unten (${bereiche.join(' > ')})`);
// Kopieren: der Text kommt in die Zwischenablage (hier abgefangen)
await page.evaluate(() => { window.__kopie = null; navigator.clipboard.writeText = async (t) => { window.__kopie = t; }; });
await page.click('#kopieren');
const kopie = await page.evaluate(() => window.__kopie || '');
check(kopie.startsWith('Frisches:\n') && kopie.includes('\n\nTierisches:\n') && kopie.includes('\n800 g Hähnchenbrustfilet\n') && kopie.includes('\n\nGewürze:\nGaram Masala\n') && kopie.includes('Extras:\nZahnpasta'), `Liste kopieren: nach Bereichen, mit Mengen (${kopie.split('\n').slice(0, 3).join(' | ')} …)`);
check(!kopie.includes('Brokkoli'), 'Abgehakter Brokkoli fehlt im kopierten Text');
if (process.env.ZEIGEN) console.log(kopie);
// Ohne Zwischenablage: Text zum Markieren
await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('nein'); }; });
await page.click('#kopieren');
check(await bis(async () => !(await page.locator('#kopie-feld').isHidden())), 'ohne Zwischenablage: der Text steht markiert im Feld');
check((await page.inputValue('#kopie-feld')).startsWith('Frisches:'), 'im Feld steht dieselbe Liste');
check((await page.inputValue('#add-input')) === '', 'Eingabefeld ist danach leer');
await zeile('Sesam').locator('.x').click();
check(await zeile('Sesam').count() === 0, 'Sesam gelöscht');
await page.click('#toast button');
check(await bis(async () => (await zeile('Sesam').count()) === 1), 'rückgängig: Sesam wieder da');
await page.click('[data-act="erledigte-weg"]');
check(await bis(async () => (await zeile('Brokkoli').count()) === 0), 'Erledigte entfernen: Brokkoli weg');
check((await zeile('Möhren').count()) === 1, 'Teriyaki-Möhren bleiben');
await page.click('#quick-breakfast');
check(await bis(async () => (await zeile('Haferflocken').count()) === 1), 'Frühstück: Haferflocken auf der Liste');
check((await zeile('Skyr natur').locator('.item-qty').innerText()).startsWith('1,287 kg'), 'Skyr: Butter Chicken 300 g + Frühstück 987 g');
check((await page.getAttribute('#quick-breakfast', 'aria-pressed')) === 'true', 'Frühstücksknopf zeigt „steht drauf“');

// --- Neuladen: alles noch da
const anzahl = await page.locator('#list-body .item').count();
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('#list-body .item').length > 0);
check(await page.locator('#list-body .item').count() === anzahl, `nach dem Neuladen: dieselben ${anzahl} Einträge`);
check(await page.evaluate(() => document.querySelector('#app').dataset.tab) === 'einkauf', 'nach dem Neuladen: wieder die Einkaufsliste');

// --- Liste leeren mit Rückfrage
await page.click('[data-act="leeren"]');
check(await page.locator('.confirm').count() === 1, 'Liste leeren fragt nach');
await page.click('[data-act="leeren-ja"]');
check(await bis(async () => (await page.locator('.empty-state').count()) === 1), 'Liste leer');

// --- Layout
check(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'kein seitliches Scrollen auf dem Handy');
check(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
