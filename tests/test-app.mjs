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
check(await page.locator('#grid .box').count() === 10, 'Filter Hähnchen: 10');
await page.click('[data-filter="rind"]');
check(await page.locator('#grid .box').count() === 5, 'Filter Rind: 5 (Putenhack ist raus)');
check(await page.locator('[data-filter="veggie"]').count() === 0, 'kein Veggie-Filter mehr – Mac & Cheese hat jetzt Hähnchen');
await page.click('[data-filter="schnell"]');
const schnell = await page.$$eval('#grid .box .box-time', (xs) => xs.map((x) => x.textContent));
const minuten = (t) => { const m = t.match(/^(?:(\d+) Std\.)? ?(?:(\d+) Min\.)?$/); return m ? Number(m[1] || 0) * 60 + Number(m[2] || 0) : NaN; };
check(schnell.length >= 5 && schnell.every((t) => minuten(t) < 90), `Filter „Unter 1½ Std.“: ${schnell.join(', ')}`);
await page.click('[data-filter="alle"]');
check((await page.locator('[data-open="gulasch"] .box-time').textContent()) === '3 Std. 40 Min.', `Gulasch ehrlich: 3 Std. 40 Min. (${await page.locator('[data-open="gulasch"] .box-time').textContent()})`);

await page.click('[data-open="butter-chicken"]');
check((await text('#d-title')) === 'Butter Chicken mit Reis', 'Butter Chicken öffnet');
check((await page.$$eval('.phase-name', (hs) => hs.map((h) => h.textContent))).join(' → ') === 'Vorbereiten → Kochen → Portionieren', 'Zubereitung in drei Abschnitten: Vorbereiten → Kochen → Portionieren');
check(await page.locator('.mise .schalen li').count() === 5, 'oben steht, welche 5 Schalen bereitstehen sollen');
const marinade = page.locator('.step', { has: page.locator('.step-l') }).first();
check(await marinade.locator('.mg').count() >= 8, `die Marinade als Liste, jede Menge hervorgehoben (${await marinade.locator('.mg').count()})`);
const haehnchenSchritt = page.locator('.step', { hasText: '800 g Hähnchenbrust' }).first();
check(await haehnchenSchritt.locator('.schale').textContent() === 'Schale 2Hähnchen in Marinade', `„→ Schale 2“ wird zum Schild mit Inhalt (${await haehnchenSchritt.locator('.schale').textContent()})`);
check(Number(await haehnchenSchritt.getAttribute('data-step')) < await page.locator('.steps').first().locator('.step').count(), '„800 g Hähnchenbrust“ steht im Vorbereiten, nicht erst beim Kochen');
const haehnchenLi = page.locator('.step-li', { has: haehnchenSchritt });
check((await haehnchenLi.locator('.step-min').innerText()).replace(/\s+/g, ' ') === '7 Min. +30 warten', `Schneiden 7 Min., dann 30 Min. marinieren (${await haehnchenLi.locator('.step-min').innerText()})`);
check(await page.locator('.step.neben .step-k').first().textContent() === 'währenddessen', 'was nebenbei passiert, steht als „währenddessen“ da');
await page.click('.step[data-step="0"]');
check(await page.getAttribute('.step[data-step="0"]', 'aria-pressed') === 'true', 'Schritt 1 abgehakt');
check(await page.locator('.step[data-step="1"].jetzt').count() === 1, 'der nächste offene Schritt ist markiert');

// --- Timer: Minuten antippen, Leiste oben, Neuladen, fertig, Notizen
const nr = Number(await haehnchenSchritt.getAttribute('data-step'));
await haehnchenLi.locator('.step-min').click();
check((await haehnchenLi.locator('.step-min').innerText()).includes('29:5') || (await haehnchenLi.locator('.step-min').innerText()).includes('30:00'), `Timer läuft über die Wartezeit: 30 Min. marinieren (${(await haehnchenLi.locator('.step-min').innerText()).replace(/\s+/g, ' ')})`);
check(await page.locator('#timerleiste .tm').count() === 1 && (await page.locator('#timerleiste .tm-label').innerText()).startsWith('Butter Chicken:'), 'oben in der Leiste steht der Timer mit dem Rezept');
await page.locator('.step-li[data-li="0"] .step-min').click();
check(await page.locator('#timerleiste .tm').count() === 2, 'zwei Timer nebeneinander');
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('#timerleiste .tm'));
check(await page.locator('#timerleiste .tm').count() === 2, 'nach dem Neuladen laufen beide weiter');
await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('boxenstopp.timer.v1')); t[0].ende = Date.now() + 1200; localStorage.setItem('boxenstopp.timer.v1', JSON.stringify(t)); });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('#timerleiste .tm'));
check(await bis(async () => (await page.locator('#timerleiste .tm-fertig').count()) === 1, 5000), 'ist die Zeit um, blinkt der Timer „fertig“');
check(await bis(async () => (await page.locator('#toast').innerText()).startsWith('Fertig:')), 'und unten steht „Fertig: …“');
check(await page.locator('.step-li .step-min.fertig').count() === 1, 'auch am Schritt selbst');
await page.click('#timerleiste .tm-fertig [data-timer-plus]');
check(await page.locator('#timerleiste .tm-fertig').count() === 0 && await page.locator('#timerleiste .tm').count() === 2, '+1: eine Minute dazu, Timer läuft wieder');
await page.click('#timerleiste .tm:nth-child(1) [data-timer-stopp]');
await page.click('#timerleiste .tm [data-timer-stopp]');
check(await page.locator('#timerleiste').isHidden(), 'alle Timer aus: Leiste weg');
check(await page.locator(`.step-li[data-li="${nr}"] .step-min.laeuft`).count() === 0, 'der Knopf zeigt wieder die Minuten');
await page.fill('#notiz-feld', 'Nächstes Mal weniger Chili');
await page.press('#notiz-feld', 'Enter');
check(await bis(async () => (await page.locator('#d-notizen .notiz').count()) === 1), 'Notiz gespeichert');
check((await page.locator('#d-notizen .notiz-t').innerText()) === 'Nächstes Mal weniger Chili' && (await page.inputValue('#notiz-feld')) === '', 'steht in der Liste, das Feld ist leer');
await page.click('#d-notizen [data-notiz-weg]');
check(await bis(async () => (await page.locator('#d-notizen .notiz').count()) === 0), 'Notiz gelöscht');
await page.click('#toast button');
check(await bis(async () => (await page.locator('#d-notizen .notiz').count()) === 1), 'rückgängig: Notiz wieder da');
check((await page.locator('.facts .pill').first().textContent()) === 'ca. 1 Std. 40 Min.', `im Kopf steht die ehrliche Zeit (${await page.locator('.facts .pill').first().textContent()})`);
check(await page.locator('.sub-h', { hasText: 'Extras' }).count() === 1, 'Backpapier steht unter Extras');
check((await text('.bew-von')).startsWith('Noch nicht bewertet'), 'Daumen: noch nicht bewertet');
await page.click('[data-bewerten="hoch"]');
check(await page.getAttribute('[data-bewerten="hoch"]', 'aria-pressed') === 'true', 'Daumen hoch gedrückt');
check((await text('.bew-von')).startsWith('Daumen hoch'), 'unter den Daumen steht „Daumen hoch“');
await page.click('[data-bewerten="runter"]');
check(await page.getAttribute('[data-bewerten="runter"]', 'aria-pressed') === 'true' && await page.getAttribute('[data-bewerten="hoch"]', 'aria-pressed') === 'false', 'umentscheiden: jetzt Daumen runter');
await page.click('[data-bewerten="runter"]');
check((await text('.bew-von')).startsWith('Noch nicht bewertet'), 'nochmal tippen nimmt den Daumen weg');
await page.click('[data-bewerten="hoch"]');
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
check(await page.locator('[data-open="butter-chicken"] .pill.p-hoch').count() === 1, 'die Box zeigt den Daumen hoch');
await page.click('[data-filter="top"]');
check(await page.locator('#grid .box').count() === 1, 'Filter „Daumen hoch“: genau das eine Gericht');
await page.click('[data-filter="alle"]');

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
