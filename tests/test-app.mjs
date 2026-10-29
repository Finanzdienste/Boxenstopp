/*
 * Die App im Browser, ohne gemeinsame Liste (nur dieses Handy).
 *
 * Rezepte filtern und öffnen, alles auf die Liste, Mengen aus zwei Rezepten,
 * einzelne Zutaten, abhaken, eigene Einträge, löschen und rückgängig,
 * Erledigtes weg, Frühstück, Portionsrechner – und nach dem Neuladen ist
 * alles noch da.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, tierAttrappe, TIER_HOSTS, ROOT, APP_URL } from './hilfe.mjs';
import { woche } from '../js/angebote.js';

const { check, ende } = pruefer();
const browser = await starteBrowser();
const tiere = tierAttrappe();
const { ctx, page, fehler } = await handy(browser, { tiere });

const text = (sel) => page.locator(sel).innerText();
const zeile = (name) => page.locator('#list-body .item', { has: page.locator('.item-name', { hasText: new RegExp(`^${name}$`) }) });
const badge = async () => ((await page.locator('#badge').isHidden()) ? 0 : Number(await page.locator('#badge').innerText()));

// --- Rezepte
check(await page.locator('#grid .box').count() === 50, '50 Rezeptboxen');
check((await page.locator('#r-eyebrow').textContent()).startsWith('50 Rezepte'), 'Überschrift zählt die Rezepte');
check((await text('#sync-text')) === 'Nur lokal', 'ohne Schlüssel: „Nur lokal“');
await page.click('[data-filter="haehnchen"]');
check(await page.locator('#grid .box').count() === 30, 'Filter Hähnchen: 30');
await page.click('[data-filter="rind"]');
check(await page.locator('#grid .box').count() === 17, 'Filter Rind: 17 (Putenhack ist raus)');
await page.click('[data-filter="bulgur"]');
check(await page.locator('#grid .box').count() === 4, 'Filter Bulgur & Co.: 4 (Bulgur, Couscous, Tortillas)');
check(await page.locator('[data-filter="veggie"]').count() === 0, 'kein Veggie-Filter mehr – Mac & Cheese hat jetzt Hähnchen');
await page.click('[data-filter="schnell"]');
const schnell = await page.$$eval('#grid .box .box-time', (xs) => xs.map((x) => x.textContent));
const minuten = (t) => { const m = t.match(/^(?:(\d+) Std\.)? ?(?:(\d+) Min\.)?$/); return m ? Number(m[1] || 0) * 60 + Number(m[2] || 0) : NaN; };
check(schnell.length >= 5 && schnell.every((t) => minuten(t) < 90), `Filter „Unter 1½ Std.“: ${schnell.join(', ')}`);
await page.click('[data-filter="alle"]');
// Suche: Name, Zutat, Gericht – mit Umlauten egal wie geschrieben
await page.fill('#suche', 'kichererbsen');
check(await page.locator('#grid .box').count() === 3, `Suche „kichererbsen“ findet 3 (${await page.locator('#grid .box').count()})`);
await page.fill('#suche', 'Hähnchen ofen');
const ofen = await page.$$eval('#grid .box .tape', (xs) => xs.map((x) => x.textContent));
check(ofen.length >= 4 && ofen.length < 50 && ofen.includes('Ofen-Hähnchen'), `Suche „Hähnchen ofen“ (${ofen.length}, beide Wörter müssen passen)`);
await page.fill('#suche', 'gibtsnicht');
check((await page.locator('#grid .empty').textContent()).includes('Nichts gefunden'), 'Suche ohne Treffer sagt es');
await page.fill('#suche', '');
check(await page.locator('#grid .box').count() === 50, 'Suche leer: wieder alle 50');
check((await page.locator('[data-filter="haehnchen"] .n').textContent()) === '30', 'Chip-Zahlen folgen der Suche');
// Bilder: jede Karte hat ihr KI-Foto (mit Prüfsumme in der Adresse), geladen erst beim Hinscrollen.
// Ein neues Rezept bekommt seins erst von der Action „Rezeptfotos“ – bis dahin stehen Bildchen da.
const mitFoto = Object.fromEntries(JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8')).rezepte.map((r) => [r.id, r.bild || '']));
const fotos = await page.$$eval('#grid .box', (bs) => bs.map((b) => [b.dataset.open, b.querySelector('.box-foto img')?.getAttribute('src') || '', b.querySelectorAll('.box-foto-ersatz img').length]));
const falscheFotos = fotos.filter(([id, src, ersatz]) => (mitFoto[id] ? src !== mitFoto[id] : ersatz < 1)).map(([id]) => id);
check(fotos.length === 50 && !falscheFotos.length && (await page.locator('#grid .box-foto img[loading="lazy"]').count()) >= fotos.filter(([, src]) => src).length, `jede Karte zeigt ihr Foto, ohne Foto ihre Bildchen (${fotos.filter(([, src]) => src).length} Fotos${falscheFotos.length ? ` – falsch: ${falscheFotos.join(', ')}` : ''})`);
check(await page.evaluate(async () => { const img = document.querySelector('[data-open="chili"] .box-foto img'); img.scrollIntoView(); for (let i = 0; i < 40 && !img.complete; i++) await new Promise((r) => { setTimeout(r, 50); }); return img.naturalWidth === 800 && img.naturalHeight === 600; }), 'das Foto lädt: 800 × 600');
check((await page.locator('[data-open="gulasch"] .box-time').textContent()) === '3 Std. 40 Min.', `Gulasch ehrlich: 3 Std. 40 Min. (${await page.locator('[data-open="gulasch"] .box-time').textContent()})`);

await page.click('[data-open="butter-chicken"]');
check((await text('#d-title')) === 'Butter Chicken mit Reis', 'Butter Chicken öffnet');
check(/^bilder\/rezepte\/butter-chicken\.webp\?v=/.test(await page.getAttribute('.d-foto img', 'src')) && (await page.getAttribute('.d-foto img', 'alt')) === 'Butter Chicken mit Reis' && (await text('.d-foto figcaption')) === 'KI-Bild', 'im Rezept: das Foto groß, mit Namen als Alternativtext und „KI-Bild“');
const zutatBilder = await page.$$eval('.ings .ing', (ls) => ls.map((l) => [l.querySelector('.ing-name')?.textContent, l.querySelector('img.zb')?.getAttribute('src')]));
check(zutatBilder.length > 10 && zutatBilder.every(([, src]) => /^bilder\/zutaten\/[a-z-]+\.svg$/.test(src || '')) && zutatBilder.find(([n]) => /Hähnchen/.test(n))?.[1] === 'bilder/zutaten/poultry-leg.svg' && zutatBilder.find(([n]) => /Garam Masala/.test(n))?.[1] === 'bilder/zutaten/salt.svg', `jede Zutat mit Bildchen: Hähnchen 🍗, Gewürze 🧂 (${zutatBilder.slice(0, 3).map(([n, s]) => `${n} ${s?.split('/').pop()}`).join(', ')})`);
check((await page.$$eval('.phase-name', (hs) => hs.map((h) => h.textContent))).join(' → ') === 'Vorbereiten → Kochen → Portionieren', 'Zubereitung in drei Abschnitten: Vorbereiten → Kochen → Portionieren');
check(await page.locator('.mise .schalen li').count() === 5, 'oben steht, welche 5 Schalen bereitstehen sollen');
const marinade = page.locator('.step', { has: page.locator('.step-l') }).first();
check(await marinade.locator('.mg').count() >= 8, `die Marinade als Liste, jede Menge hervorgehoben (${await marinade.locator('.mg').count()})`);
const haehnchenSchritt = page.locator('.step', { hasText: '800 g Hähnchenbrust' }).first();
check(await haehnchenSchritt.locator('.schale').textContent() === 'Schale 2Hähnchen in Marinade', `„→ Schale 2“ wird zum Schild mit Inhalt (${await haehnchenSchritt.locator('.schale').textContent()})`);
check(Number(await haehnchenSchritt.getAttribute('data-step')) < await page.locator('.steps').first().locator('.step').count(), '„800 g Hähnchenbrust“ steht im Vorbereiten, nicht erst beim Kochen');
const haehnchenLi = page.locator('.step-li', { has: haehnchenSchritt });
check((await haehnchenLi.locator('.step-z').innerText()) === '7 Min.' && (await haehnchenLi.locator('.step-timer').innerText()).trim() === '30 Min.', `Schneiden 7 Min. steht klein im Text, der Timer für 30 Min. marinieren daneben (${await haehnchenLi.locator('.step-z').innerText()} / ${await haehnchenLi.locator('.step-timer').innerText()})`);
// Timer nur, wo man einen braucht: köcheln, backen, marinieren – nicht bei jedem Schritt
const mitTimer = await page.$$eval('#detail .step-li', (ls) => ls.filter((l) => l.querySelector('.step-timer')).map((l) => Number(l.dataset.li)));
check(JSON.stringify(mitTimer) === JSON.stringify([4, 19, 21, 26, 28, 30, 37]), `nur 7 von 38 Schritten haben einen Timer (${mitTimer.join(', ')})`);
check(await page.locator('.step-li[data-li="0"] .step-timer').count() === 0 && (await page.locator('.step-li[data-li="0"] .step-z').innerText()) === '2 Min.' && await page.locator('.step-li[data-li="9"] .step-timer').count() === 0, 'Knoblauch reiben und Ofen vorheizen: kein Timer, die Minuten stehen klein im Text');
check((await page.locator('.step-li[data-li="28"] .step-timer').innerText()).trim() === '12 + 10 Min.' && (await page.locator('.step-li[data-li="26"] .step-timer').innerText()).trim() === '15 Min.', 'Reis: 12 + 10 Min. (garen, dann ruhen), Sauce: 15 Min.');
const timerHoehe = await page.locator('.step-li[data-li="26"] .step-timer').evaluate((b) => b.getBoundingClientRect().height);
check(timerHoehe <= 32, `der Timer-Knopf ist klein (${Math.round(timerHoehe)} px hoch)`);
check(await page.locator('.step.neben .step-k').first().textContent() === 'währenddessen', 'was nebenbei passiert, steht als „währenddessen“ da');
await page.click('.step[data-step="0"]');
check(await page.getAttribute('.step[data-step="0"]', 'aria-pressed') === 'true', 'Schritt 1 abgehakt');
check(await page.locator('.step[data-step="1"].jetzt').count() === 1, 'der nächste offene Schritt ist markiert');

// --- Timer: Minuten antippen, Leiste oben, Neuladen, fertig, Notizen
const nr = Number(await haehnchenSchritt.getAttribute('data-step'));
await haehnchenLi.locator('.step-timer').click();
check((await haehnchenLi.locator('.step-timer').innerText()).includes('29:5') || (await haehnchenLi.locator('.step-timer').innerText()).includes('30:00'), `Timer läuft über die Wartezeit: 30 Min. marinieren (${(await haehnchenLi.locator('.step-timer').innerText()).replace(/\s+/g, ' ')})`);
check(await page.locator('#timerleiste .tm').count() === 1 && (await page.locator('#timerleiste .tm-label').innerText()).startsWith('Butter Chicken:'), 'oben in der Leiste steht der Timer mit dem Rezept');
await page.locator('.step-li[data-li="28"] .step-timer').click();
check(await page.locator('#timerleiste .tm').count() === 2, 'zwei Timer nebeneinander');
check((await page.locator('.step-li[data-li="28"] .step-timer').innerText()).replace(/\s+/g, ' ').match(/^1[12]:\d\d 1\/2$/), `der Reis-Timer läuft in Stufe 1 von 2 (${(await page.locator('.step-li[data-li="28"] .step-timer').innerText()).replace(/\s+/g, ' ')})`);
// Stufe 1 ist um: Er meldet sich mit dem, was jetzt dran ist, und läuft mit den 10 Min. weiter
await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('boxenstopp.timer.v1')); const reis = t.find((x) => x.schritt === 28); reis.ende = Date.now() + 1200; localStorage.setItem('boxenstopp.timer.v1', JSON.stringify(t)); });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('#timerleiste .tm'));
check(await bis(async () => (await page.locator('#toast').innerText()).startsWith('Jetzt: 10 Min. ruhen lassen'), 5000), `nach 12 Min.: „Jetzt: 10 Min. ruhen lassen“ (${await page.locator('#toast').innerText()})`);
const reisJetzt = (await page.locator('.step-li[data-li="28"] .step-timer').innerText()).replace(/\s+/g, ' ');
check(/^(9:5\d|10:00) 2\/2$/.test(reisJetzt) && await page.locator('#timerleiste .tm-fertig').count() === 0, `und läuft in Stufe 2 weiter (${reisJetzt})`);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('#timerleiste .tm'));
check(await page.locator('#timerleiste .tm').count() === 2, 'nach dem Neuladen laufen beide weiter');
await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('boxenstopp.timer.v1')); t[0].ende = Date.now() + 1200; localStorage.setItem('boxenstopp.timer.v1', JSON.stringify(t)); });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('#timerleiste .tm'));
check(await bis(async () => (await page.locator('#timerleiste .tm-fertig').count()) === 1, 5000), 'ist die Zeit um, blinkt der Timer „fertig“');
check(await bis(async () => (await page.locator('#toast').innerText()).startsWith('Fertig:')), 'und unten steht „Fertig: …“');
check(await page.locator('.step-li .step-timer.fertig').count() === 1, 'auch am Schritt selbst');
await page.click('#timerleiste .tm-fertig [data-timer-plus]');
check(await page.locator('#timerleiste .tm-fertig').count() === 0 && await page.locator('#timerleiste .tm').count() === 2, '+1: eine Minute dazu, Timer läuft wieder');
await page.click('#timerleiste .tm:nth-child(1) [data-timer-stopp]');
await page.click('#timerleiste .tm [data-timer-stopp]');
check(await page.locator('#timerleiste').isHidden(), 'alle Timer aus: Leiste weg');
check(await page.locator(`.step-li[data-li="${nr}"] .step-timer.laeuft`).count() === 0 && (await page.locator(`.step-li[data-li="${nr}"] .step-timer`).innerText()).trim() === '30 Min.', 'der Knopf zeigt wieder die Minuten');
await page.fill('#notiz-feld', 'Nächstes Mal weniger Chili');
await page.press('#notiz-feld', 'Enter');
check(await bis(async () => (await page.locator('#d-notizen .notiz').count()) === 1), 'Notiz gespeichert');
check((await page.locator('#d-notizen .notiz-t').innerText()) === 'Nächstes Mal weniger Chili' && (await page.inputValue('#notiz-feld')) === '', 'steht in der Liste, das Feld ist leer');
await page.click('#d-notizen [data-notiz-weg]');
check(await bis(async () => (await page.locator('#d-notizen .notiz').count()) === 0), 'Notiz gelöscht');
await page.click('#toast button');
check(await bis(async () => (await page.locator('#d-notizen .notiz').count()) === 1), 'rückgängig: Notiz wieder da');
check((await page.locator('.facts .pill').first().textContent()) === 'ca. 1 Std. 40 Min.', `im Kopf steht die ehrliche Zeit (${await page.locator('.facts .pill').first().textContent()})`);
check(/^≈ 1,\d\d € pro Box$/.test(await page.locator('.facts .pill-cost').textContent()), `und was eine Box kostet (${await page.locator('.facts .pill-cost').textContent()})`);
check(/Kostet ≈ \d+(,\d\d)? € für 8 Boxen/.test(await text('#d-kosten')) && (await text('#d-kosten')).includes('Richtpreise Discounter'), 'bei den Zutaten: Gesamtkosten mit Hinweis auf Richtpreise');
check(/≈ \d,\d\d €\/Box/.test(await page.locator('[data-open="chili"] .box-cost').textContent()), 'auf der Karte: Kosten pro Box');
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
check((await text('.label .c-kcal .v')).startsWith('433'), 'Etikett: 433 kcal pro Box');
check((await text('.label .c-kcal .dlt')) === '−10', 'Etikett: 10 kcal unter dem Ziel');
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
check(/≈ \d+(,\d\d)? €/.test(await text('#l-count')), `die Liste summiert die Richtpreise (${await text('#l-count')})`);
check((await zeile('Knoblauch').locator('.item-qty').innerText()).replace(/\s+/g, ' ') === '10 Zehen ≈ 1 Knolle', 'Knoblauch: 10 Zehen, etwa 1 Knolle');
check((await zeile('Öl, neutral').innerText()).includes('Butter Chicken: 10 g'), 'Öl mit Text statt Menge');
check(await page.locator('#forrow .forchip').count() === 2, '„Für“: Butter Chicken und Teriyaki Bowl');
// Angebote auf der Liste und die Empfehlung (tests/daten/angebote.json: das Aldi-Hähnchen, 600 g 5,19 € – 24 % unter dem Richtpreis)
const huhnAngebote = zeile('Hähnchenbrustfilet').locator('.l-angebote');
const txt = async (loc) => (await loc.innerText().catch(() => '–')).replace(/\s+/g, ' ');
check(await bis(async () => (await huhnAngebote.count()) === 1) && (await txt(huhnAngebote.locator('.l-angebot'))) === '−24 % am günstigsten bei Aldi: 600 g 5,19 € · 8,65 €/kg', `auf der Liste: wo Hähnchen gerade am günstigsten ist (${await txt(huhnAngebote)})`);
check(await zeile('Basmati- oder Jasminreis').locator('.l-angebote').count() === 0, 'Reis nicht – der ist nirgends im Angebot');
check(await bis(async () => (await page.locator('#l-tipp').isVisible()) && (await txt(page.locator('#l-tipp'))).includes('Aldi – 1 Sache im Angebot, ≈')), `oben über der Liste: am günstigsten einkaufen bei Aldi (${await txt(page.locator('#l-tipp'))})`);
// Ein eigenes Angebot dazu: Lidl hat das Hähnchen auch, je Kilo etwas teurer
await page.click('.tab[data-tab="angebote"]');
await page.click('.a-eigene summary');
await page.fill('#a-text', 'Lidl Hähnchenbrustfilet 400 g 3,79');
await page.click('#a-los');
await page.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await huhnAngebote.locator('.l-auch').count()) === 1) && (await txt(huhnAngebote.locator('.l-auch'))) === 'Auch: Lidl 9,48 €/kg', `und wo es sonst noch im Angebot ist, mit dem Preis je Kilo (${await txt(huhnAngebote)})`);
await page.click('.tab[data-tab="angebote"]');
const tipp = page.locator('.a-tipp');
check(await bis(async () => (await tipp.count()) === 1) && (await tipp.locator('.a-tipp-k').textContent()) === 'Empfehlung für eure Liste' && (await tipp.locator('.a-tipp-t b').innerText()) === 'Aldi' && (await txt(tipp.locator('.a-tipp-d'))) === '1 Sache von eurer Liste im Angebot: Hähnchenbrustfilet −24 %.' && (await txt(tipp.locator('.a-tipp-n'))).startsWith('Danach: Lidl ≈'), `oben die Empfehlung: Aldi, wegen des Hähnchens; danach Lidl (${(await txt(tipp)).slice(0, 140)})`);
check((await txt(tipp.locator('.a-nur'))).startsWith('Nur in einen Laden? Das beste Rezept dort') && (await tipp.locator('.a-nur-b').count()) >= 2, `darunter je Laden das beste Rezept, wenn man nur dort einkauft (${(await tipp.locator('.a-nur-b').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ')).join(' | ')})`);
await tipp.locator('[data-a-laden="Aldi"]').click();
const nurAldi = await txt(tipp);
check(await page.locator('.a-laeden-chips [data-a-laden="Aldi"][aria-pressed="true"]').count() === 1 && (await tipp.locator('.a-tipp-k').textContent()) === 'Nur Aldi – das beste Rezept diese Woche' && (await tipp.locator('.a-tipp-r').count()) === 1 && /\d Zutaten? im Angebot/.test(nurAldi) && nurAldi.includes('Von eurer Liste: 1 Sache bei Aldi im Angebot'), `„Zu Aldi“: nur noch Aldi – oben das Rezept mit den meisten Zutaten dort im Angebot (${nurAldi})`);
const bestesAldi = await tipp.locator('.a-tipp-r').getAttribute('data-a-open');
await tipp.locator('[data-a-liste]').click();
check(await bis(async () => (await tipp.locator('.a-tipp-ok').count()) === 1) && (await page.locator(`#forrow [data-rmrec="${bestesAldi}"]`).count()) === 1, `„Auf die Liste“ setzt ${bestesAldi} auf die Liste – dann steht da „✓ auf der Liste“`);
await page.click('.tab[data-tab="einkauf"]');
await page.click(`#forrow [data-rmrec="${bestesAldi}"]`);
check(await bis(async () => (await page.locator(`#forrow [data-rmrec="${bestesAldi}"]`).count()) === 0), 'und wieder runter');
await page.click('.tab[data-tab="angebote"]');
await page.click('.a-laeden-chips [data-a-laden="Lidl"]');
await page.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await huhnAngebote.locator('.l-dein').count()) === 1) && (await txt(huhnAngebote.locator('.l-dein'))) === 'Bei Lidl: 400 g 3,79 € · 9,48 €/kg −16 %' && (await huhnAngebote.locator('.l-auch').count()) === 0 && (await txt(huhnAngebote.locator('.l-angebot'))).includes('am günstigsten bei Aldi'), `mit Lidl gewählt: am günstigsten bleibt Aldi, darunter das Angebot bei Lidl (${await txt(huhnAngebote)})`);
await page.click('.tab[data-tab="angebote"]');
await page.click('.a-laeden-chips [data-a-laden="Kaufland"]');
await page.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await huhnAngebote.locator('.l-dein').count()) === 0 && (await huhnAngebote.locator('.l-auch').count()) === 1), 'mit Kaufland gewählt (hat kein Hähnchen): wieder „Auch: Lidl“');
await page.click('.tab[data-tab="angebote"]');
await page.click('.a-laeden-chips [data-a-laden=""]');
await page.click('[data-act="a-leeren"]');
await page.click('[data-act="a-leeren-ja"]');
await page.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await huhnAngebote.locator('.l-auch').count()) === 0 && (await huhnAngebote.locator('.l-angebot').count()) === 1), 'eigenes Angebot wieder weg: nur noch Aldi');
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
check((await zeile('Bananen').locator('img.zb').getAttribute('src')) === 'bilder/zutaten/banana.svg' && (await zeile('Zahnpasta').locator('img.zb').getAttribute('src')) === 'bilder/zutaten/toothbrush.svg' && (await zeile('Möhren').locator('img.zb').getAttribute('src')) === 'bilder/zutaten/carrot.svg', 'auf der Liste: Bildchen nach Zutat, auch für Getipptes (Bananen 🍌, Zahnpasta 🪥)');
check(await page.evaluate(() => [...document.querySelectorAll('#list-body img.zb')].every((i) => i.getAttribute('alt') === '')), 'die Bildchen sind Schmuck (alt leer) – der Name steht daneben');
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

// --- Belohnung: Phase fertig → ein Satz, alles fertig → ein Tier mit Spruch
await page.click('.tab[data-tab="rezepte"]');
if (await page.locator('[data-act="zurueck"]').count()) await page.click('[data-act="zurueck"]');
await page.click('[data-open="gnocchi"]');
await page.waitForSelector('#detail .step');
check(await bis(async () => tiere.zaehler.bilder >= 1, 4000), 'sobald ein Rezept offen ist, wird ein Tier vorgeladen');
const phasen = await page.evaluate(async () => (await (await fetch('daten/rezepte.json')).json()).rezepte.find((r) => r.id === 'gnocchi').ablauf.map((p) => p.schritte.length));
for (let i = 0; i < phasen[0]; i++) await page.locator('#detail .step').nth(i).click();
const toast = () => page.evaluate(() => { const t = document.querySelector('#toast'); return t.classList.contains('show') ? { art: t.dataset.art, text: t.textContent } : null; });
check(await bis(async () => (await toast())?.art === 'lob'), `Vorbereiten komplett: ein Lob unten (${((await toast())?.text || '').slice(0, 40)}…)`);
check(await page.locator('#lob').isHidden(), 'aber noch kein Tier');
const alle = phasen.reduce((a, b) => a + b, 0);
for (let i = phasen[0]; i < alle; i++) await page.locator('#detail .step').nth(i).click();
check(await bis(async () => await page.locator('#lob:not([hidden]) .lob-karte').count() === 1, 6000), 'letztes Häkchen: die Belohnung kommt');
const tier1 = await page.getAttribute('#lob .lob-tier', 'data-lob-tier');
check(!!tier1 && await page.locator('#lob .lob-medium').evaluate((m) => m.naturalWidth > 0), `ein echtes Tierbild läuft rein (${tier1})`);
check((await page.locator('#lob-titel').innerText()).length > 10 && (await page.locator('#lob .lob-eyebrow').textContent()).includes('Gnocchi'), `mit Spruch: „${await page.locator('#lob-titel').innerText()}“`);
check(await page.locator('#lob .lob-konfetti i').count() > 30, 'und Konfetti');
await page.click('[data-lob="noch"]');
check(await bis(async () => (await page.getAttribute('#lob .lob-tier', 'data-lob-tier')) !== tier1, 8000), `„Noch ein Tier“: ein anderes (${await page.getAttribute('#lob .lob-tier', 'data-lob-tier')})`);
await page.click('[data-lob="zu"]');
check(await page.locator('#lob').isHidden() && (await page.evaluate(() => document.body.classList.contains('lob-offen'))) === false, '„Danke!“ macht zu');
await page.click('[data-act="gekocht"]');
check(await bis(async () => ((await toast())?.text || '').startsWith('Eingetragen')) && await page.locator('#lob').isHidden(), '„Heute gekocht“ direkt danach: kein zweites Tier fürs selbe Rezept, nur die Meldung');
// Sprüche wiederholen sich nicht gleich wieder
const sprueche = await page.evaluate(async () => {
  const { spruch, SPRUECHE } = await import('./js/lob.js');
  const g = { sprueche: [], tiere: [], rezepte: {}, phasen: {}, klein: [] };
  const aus = Array.from({ length: 20 }, () => spruch('Amy', g));
  return { n: new Set(aus).size, gesamt: SPRUECHE.length, mitName: aus.filter((t) => t.includes('Amy')).length, ohneKlammer: aus.every((t) => !t.includes('{')) };
});
check(sprueche.n === 20 && sprueche.gesamt >= 50 && sprueche.ohneKlammer, `20 Sprüche am Stück, keiner doppelt (aus ${sprueche.gesamt}), Name eingesetzt`);
// Ohne Netz: ein gemaltes Tier
await ctx.unroute(TIER_HOSTS);
await ctx.route(TIER_HOSTS, (r) => r.abort('blockedbyclient'));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0 || document.querySelector('#detail:not([hidden])'));
if (await page.locator('[data-act="zurueck"]').count()) await page.click('[data-act="zurueck"]');
await page.click('[data-open="teriyaki"]');
await page.waitForSelector('#detail .step');
const n2 = await page.locator('#detail .step').count();
for (let i = 0; i < n2; i++) await page.locator('#detail .step').nth(i).click();
check(await bis(async () => await page.locator('#lob:not([hidden]) .lob-offline .lob-emoji').count() === 1, 12000), `ohne Netz kommt ein gemaltes Tier (${await page.getAttribute('#lob .lob-tier', 'data-lob-tier')})`);
await page.keyboard.press('Escape');
check(await page.locator('#lob').isHidden(), 'Escape macht zu');
await page.click('[data-act="zurueck"]');
await page.click('.tab[data-tab="einkauf"]');

// --- Liste leeren mit Rückfrage
await page.click('[data-act="leeren"]');
check(await page.locator('.confirm').count() === 1, 'Liste leeren fragt nach');
await page.click('[data-act="leeren-ja"]');
check(await bis(async () => (await page.locator('#list-body .empty-state').count()) === 1), 'Liste leer');

// --- Rezept: „Zum Rezept“, Bereiche auf- und zuklappen, anpinnen („läuft gerade“)
await page.click('.tab[data-tab="rezepte"]');
await page.click('[data-open="gulasch"]');
check(await page.locator('#detail .d-top [data-act="zum-rezept"]').count() === 1, 'oben im Rezept: „Zum Rezept“');
await page.click('[data-act="zum-rezept"]');
check(await bis(async () => Math.abs(await page.evaluate(() => document.querySelector('#s-zubereitung').getBoundingClientRect().top)) < 120), '„Zum Rezept“ springt zur Zubereitung');
const offen = (id) => page.evaluate((x) => document.querySelector(`#s-${x}`)?.open, id);
await page.click('#s-zutaten > summary');
check(!(await offen('zutaten')) && !(await page.locator('#s-zutaten .ings').first().isVisible()), 'Zutaten zugeklappt');
await page.click('[data-act="zurueck"]');
await page.click('[data-open="chili"]');
check(!(await offen('zutaten')) && (await offen('zubereitung')) && (await offen('notizen')), 'im nächsten Rezept bleiben die Zutaten zu, der Rest offen');
await page.reload({ waitUntil: 'load' });
check(await bis(async () => (await page.locator('#d-title').count()) === 1) && !(await offen('zutaten')), 'auch nach dem Neuladen');
await page.click('#s-zubereitung > summary');
await page.click('[data-act="zum-rezept"]');
check(await offen('zubereitung'), '„Zum Rezept“ klappt die Zubereitung wieder auf');
await page.click('#s-zutaten > summary');
check(await offen('zutaten'), 'Zutaten wieder auf');
await page.click('[data-act="anpinnen"]');
check(await bis(async () => (await page.locator('[data-act="anpinnen"][aria-pressed="true"]').count()) === 1) && (await page.locator('#d-laeuft').innerText()).includes('Läuft gerade'), 'angepinnt: Knopf gedrückt, oben „Läuft gerade“');
await page.click('[data-step="0"]');
await page.click('[data-act="zurueck"]');
const leiste = page.locator('#gepinnt [data-open="chili"]');
check(await bis(async () => (await leiste.count()) === 1) && (await page.locator('.box[data-open="chili"] .pill-pin').count()) === 1, 'oben bei den Rezepten „Läuft gerade“ mit dem Chili, auf der Karte die Pille');
check((await leiste.locator('small').innerText()).startsWith('1 von 26 Schritten'), `mit dem Fortschritt beim Kochen (${await leiste.locator('small').innerText()})`);
check(await page.evaluate(() => document.querySelector('#gepinnt').getBoundingClientRect().top < document.querySelector('#r-title').getBoundingClientRect().top), 'die Leiste steht ganz oben, über der Überschrift');
await leiste.click();
check(await bis(async () => (await page.locator('#d-title').innerText()) === 'Chili con Carne mit Süßkartoffel'), 'antippen öffnet das Rezept');
await page.click('[data-act="schritte-zurueck"]');
await page.click('[data-act="anpinnen"]');
await page.click('[data-act="zurueck"]');
check(await bis(async () => page.locator('#gepinnt').isHidden()) && (await page.locator('.box .pill-pin').count()) === 0, 'gelöst: Leiste und Pille sind weg');

// --- Preis und Reihenfolge: zusätzlich zum Chip, das Handy merkt sie sich
const kosten = () => page.$$eval('#grid .box', (bs) => bs.map((b) => { const m = b.querySelector('.box-cost')?.textContent.match(/(\d+),(\d\d)/); return m ? Number(`${m[1]}.${m[2]}`) : null; }));
const zeiten = () => page.$$eval('#grid .box .box-time', (xs) => xs.map((x) => x.textContent));
await page.selectOption('#r-preis', '2');
let preise = await kosten();
check(preise.length >= 5 && preise.length < 50 && preise.every((x) => x !== null && x <= 2), `„Bis 2 €“: nur Rezepte bis 2 € pro Box (${preise.length})`);
check((await page.locator('#r-preis option:checked').textContent()) === `Bis 2 € (${preise.length})` && (await page.locator('.sel.an').count()) === 1, `im Auswahlfeld steht, wie viele es sind (${await page.locator('#r-preis option:checked').textContent()})`);
check(Number(await page.locator('[data-filter="alle"] .n').textContent()) === preise.length, 'die Chips zählen mit dem Preis');
await page.selectOption('#r-sort', 'preis');
preise = await kosten();
check(preise.every((x, i) => !i || preise[i - 1] <= x), `„Günstigste“: billigste zuerst (${preise.slice(0, 3).join(', ')} …)`);
await page.click('[data-filter="haehnchen"]');
const huhnBillig = await kosten();
check(huhnBillig.length >= 1 && huhnBillig.length < 30 && huhnBillig.every((x, i) => x <= 2 && (!i || huhnBillig[i - 1] <= x)), `Hähnchen bis 2 €, billigste zuerst (${huhnBillig.length})`);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#grid .box');
check((await page.inputValue('#r-preis')) === '2' && (await page.inputValue('#r-sort')) === 'preis' && (await kosten()).length === huhnBillig.length, 'nach dem Neuladen noch so eingestellt');
await page.click('[data-filter="alle"]');
await page.selectOption('#r-preis', '0');
await page.selectOption('#r-sort', 'zeit');
const zs = (await zeiten()).map(minuten);
check(zs.length === 50 && zs.every((x, i) => !i || zs[i - 1] <= x), `„Schnellste“: kürzeste zuerst (${(await zeiten()).slice(0, 2).join(', ')} … ${(await zeiten()).slice(-1)})`);
await page.selectOption('#r-sort', 'standard');
check((await page.locator('#grid .box').first().getAttribute('data-open')) === 'chili' && (await page.locator('.sel.an').count()) === 0, 'zurück auf „Empfohlen“: Chili wieder vorne');

// --- Tempo: Beim Abhaken misst das Handy mit …
await page.click('[data-open="tomaten-pasta"]');
await page.click('[data-step="0"]');
await page.click('[data-step="1"]');
const offenerLauf = await page.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.tempo.v1') || '{}').offen?.['tomaten-pasta']?.h?.length);
check(offenerLauf === 2, `zwei Haken – das Handy misst mit (${offenerLauf})`);
await page.click('[data-act="schritte-zurueck"]');
await page.click('[data-act="zurueck"]');
// … und so sieht es aus, wenn es dein Tempo kennt (hier vorgegeben: Vorbereiten 1,5×, Gulasch zuletzt 4 Std. 10 Min.)
await page.evaluate(() => {
  const proben = Array.from({ length: 8 }, () => ['', 'vor', 5, 7.5]);
  localStorage.setItem('boxenstopp.tempo.v1', JSON.stringify({ offen: {}, proben, gesamt: { gulasch: [[250, '2026-10-24']] } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#grid .box');
const gulaschZeit = page.locator('[data-open="gulasch"] .box-time');
check((await gulaschZeit.textContent()) === '4 Std. 10 Min.' && (await gulaschZeit.getAttribute('class')).includes('is-tempo'), `Gulasch: 4 Std. 10 Min. wie beim letzten Mal, hervorgehoben (${await gulaschZeit.textContent()})`);
const chiliZeit = minuten(await page.locator('[data-open="chili"] .box-time').textContent());
check(chiliZeit > 115 && (await page.locator('[data-open="chili"] .box-time').getAttribute('class')).includes('is-tempo'), `Chili: länger als die Standard-1 Std. 55 Min., weil du langsamer schnippelst (${chiliZeit} Min.)`);
await page.click('[data-open="chili"]');
check((await page.locator('.facts .pill').first().textContent()).includes('dein Tempo') && (await text('#d-tempo')).includes('Zeiten in deinem Tempo (Vorbereiten 1,5× so lange wie Standard)'), `im Rezept: „Zeiten in deinem Tempo (Vorbereiten 1,5×)“ (${await text('#d-tempo')})`);
const ersterSchritt = page.locator('.step-li[data-li="0"] .step-z');
check((await ersterSchritt.getAttribute('class')).includes('is-tempo') && (await page.locator('.zeiten.is-tempo').count()) === 1, `die Minuten der Schritte in deinem Tempo (${await ersterSchritt.textContent()})`);
await page.click('[data-act="zurueck"]');
await page.click('[data-open="gulasch"]');
check((await text('#d-tempo')).includes('Letztes Mal hat das ganze Rezept 4 Std. 10 Min. gedauert (24.10.)'), `Gulasch: „Letztes Mal … 4 Std. 10 Min.“ (${await text('#d-tempo')})`);
await page.click('#d-tempo [data-act="tempo-weg"]');
check(await bis(async () => (await page.locator('#toast').innerText()).startsWith('Tempo vergessen')) && (await page.locator('.facts .pill').first().textContent()) === 'ca. 3 Std. 40 Min.' && (await text('#d-tempo')).includes('Hak beim Kochen die Schritte ab'), 'Tempo vergessen: wieder die Standardzeiten');
await page.click('#toast button');
check(await bis(async () => (await page.locator('.facts .pill').first().textContent()).startsWith('ca. 4 Std. 10 Min.')), 'Rückgängig: wieder in deinem Tempo');
await page.click('#d-tempo [data-act="tempo-weg"]');
await page.click('[data-act="zurueck"]');

// --- Angebote der nächsten Woche: im Abruf zwei Penny-Angebote ab nächstem Montag
const naechste = woche('naechste');
const mitNaechster = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'daten', 'angebote.json'), 'utf8'));
mitNaechster.angebote.push(
  { id: 'a-next001', laden: 'Penny', name: 'Hähnchenbrustfilet XXL', preis: 4.44, menge: 600, einheit: 'g', von: naechste.montag, bis: naechste.bis, k: 'haehnchenbrust' },
  { id: 'a-next002', laden: 'Penny', name: 'Paprika rot', preis: 0.99, menge: 500, einheit: 'g', von: naechste.montag, bis: naechste.bis, k: 'paprika' },
);
const nx = await handy(browser);
await nx.page.route('**/daten/angebote.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mitNaechster) }));
await nx.page.reload({ waitUntil: 'load' });
await nx.page.click('.tab[data-tab="angebote"]');
await nx.page.waitForSelector('.a-woche');
const wocheText = async (art) => (await nx.page.locator(`[data-a-woche="${art}"]`).innerText()).replace(/\s+/g, ' ');
const badgeVorher = await nx.page.locator('#a-badge').innerText();
check((await wocheText('diese')).includes('Diese Woche') && (await wocheText('naechste')).startsWith(`Nächste Woche KW ${naechste.kw} ·`), `oben: Diese Woche / Nächste Woche mit Kalenderwoche (${await wocheText('naechste')})`);
check(!(await nx.page.locator('#a-auto').innerText()).includes('Hähnchenbrustfilet XXL') && (await nx.page.locator('#a-auto').innerText()).includes('Hähnchenbrustfilet-Teilstücke'), 'diese Woche: das Penny-Hähnchen ab Montag steht noch nicht da, das Aldi-Hähnchen schon');
await nx.page.click('[data-a-woche="naechste"]');
check((await nx.page.locator('#a-title').innerText()) === 'Angebote nächste Woche' && await nx.page.locator('[data-a-woche="naechste"][aria-pressed="true"]').count() === 1, 'nächste Woche gewählt: Überschrift „Angebote nächste Woche“');
check((await nx.page.locator('#a-auto .a-grp[data-laden="Penny"]').innerText()).includes('Hähnchenbrustfilet XXL') && (await nx.page.locator('#a-auto .a-stand').innerText()).startsWith(`KW ${naechste.kw}`), 'und die Angebote ab Montag stehen in der Liste, darunter die KW');
check((await nx.page.locator('#a-badge').innerText()) === badgeVorher, 'die Zahl am Reiter bleibt bei dieser Woche');
await nx.page.click('.a-laeden-chips [data-a-laden="Penny"]');
const pennyNaechste = (await nx.page.locator('.a-tipp').innerText()).replace(/\s+/g, ' ');
check(pennyNaechste.includes('das beste Rezept nächste Woche'.toUpperCase()) || pennyNaechste.toLowerCase().includes('das beste rezept nächste woche'), `Nur Penny, nächste Woche: das beste Rezept dort (${pennyNaechste.slice(0, 120)})`);
await nx.ctx.close();

// --- iPhone, App vom Home-Bildschirm: eigener Speicher, getrennt von Safari – der Hinweis sagt, was zu tun ist
const iphone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', serviceWorkers: 'block', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
await iphone.route('https://api.github.com/**', (r) => r.abort('blockedbyclient'));
await iphone.addInitScript(() => { Object.defineProperty(Object.getPrototypeOf(navigator), 'standalone', { get: () => true, configurable: true }); });
const ip = await iphone.newPage();
await ip.goto(APP_URL, { waitUntil: 'load' });
await ip.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await ip.locator('#zugang .zugang-banner').innerText()).includes('eigenen Speicher')), 'iPhone, vom Home-Bildschirm: der Hinweis erklärt, dass der Link dort nochmal eingefügt werden muss');
check(!(await page.locator('#zugang .zugang-banner').innerText().catch(() => '')).includes('eigenen Speicher'), 'auf Android steht der Hinweis nicht');
await iphone.close();

// --- Layout
check(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'kein seitliches Scrollen auf dem Handy');
check(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
