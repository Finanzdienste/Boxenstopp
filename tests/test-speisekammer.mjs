/*
 * Die Speisekammer (js/speisekammer.js, js/kammer-ki.js, js/ansicht-
 * speisekammer.js): in Node Bereinigen, Mengen dazu und ab, was ein Haken
 * kauft und „Heute gekocht“ verbraucht, was bald weg muss, der Text für die
 * KI und das Lesen von Getipptem und Fotos; im Browser einkaufen (abhaken
 * legt hinein, der Haken zurück nimmt heraus), tippen, ☆ und ✓, „zu Hause“
 * auf der Liste, „Heute gekocht“ zieht ab, die KI bekommt die Speisekammer
 * (angetippt zuerst) und liest ein Foto. Alles mit erfundenen Daten.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL } from './hilfe.mjs';
import { leer, anwenden, bereinigen, beschreibung, opZusammen } from '../js/liste.js';
import {
  speisekammerBereinigen, opKammer, opKammerWeg, opKammerMenge, gekauftVon, verbrauchtVon, mussBaldWeg, kammerListe, kammerText, mengeKurz, alterTage, nameVon, MAX_KAMMER, FRISCH_TAGE,
} from '../js/speisekammer.js';
import { postenAusText, postenAusZeilen, erkanntAlsPosten, rumpfKammer, KAMMER_SCHEMA, kammerAusProdukt } from '../js/kammer-ki.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const { katalog, preise } = daten;
const einheiten = {};
for (const r of daten.rezepte) for (const it of r.items) if (it.k && typeof it.q === 'number') einheiten[it.k] = it.u;
const mehr = { einheiten, preise };
const TAG = 864e5;
const vor = (tage) => new Date(Date.now() - tage * TAG).toISOString();

/* ------------------------------------------------------------ Bereinigen */

const roh = {
  rinderhack: { name: 'Rinderhackfleisch', cat: 'fleisch', q: 500, u: 'g', at: vor(1) },
  feta: { name: 'Feta', cat: 'kuehl', q: -3, u: 'g' },
  'kaputt schlüssel': { name: 'X' },
  leer: { name: '  ' },
};
const sk = speisekammerBereinigen(roh);
check(Object.keys(sk).join() === 'rinderhack,feta' && sk.rinderhack.q === 500 && sk.feta.q === null && sk.feta.u === '' && sk.rinderhack.bald === false, 'Bereinigen: Schlüssel wie auf der Liste, ohne Namen weg, eine kaputte Menge heißt „ist da“');
const viele = Object.fromEntries(Array.from({ length: MAX_KAMMER + 5 }, (_, i) => [`n:sache-${i}`, { name: `Sache ${i}`, geaendert: vor(400 - i) }]));
check(Object.keys(speisekammerBereinigen(viele)).length === MAX_KAMMER && !speisekammerBereinigen(viele)['n:sache-0'], `höchstens ${MAX_KAMMER} – die zuletzt geänderten bleiben`);
check(Object.keys(bereinigen({ ...leer(), speisekammer: roh }).speisekammer).length === 2 && JSON.stringify(leer().speisekammer) === '{}', 'liste.json: unter speisekammer, leer am Anfang');

/* ------------------------------------------------------------- Änderungen */

const P = (k, q, u = 'g', name = k) => ({ k, name, cat: katalog[k]?.c || 'sonstiges', q, u });
let s = anwenden(leer(), opKammerMenge([P('rinderhack', 500), P('eier', 10, 'Stk')], 1, 'Tobi'));
check(s.speisekammer.rinderhack.q === 500 && s.speisekammer.eier.q === 10 && s.speisekammer.rinderhack.by === 'Tobi', 'Dazu: zwei Sachen');
s = anwenden(s, opKammerMenge([P('rinderhack', 250)], 1, 'Amy'));
check(s.speisekammer.rinderhack.q === 750 && s.speisekammer.rinderhack.by === 'Amy', 'Noch mehr davon: zusammengezählt');
s = anwenden(s, opKammerMenge([P('rinderhack', 600), P('eier', 4, 'Stk'), P('reis', 100)], -1, 'Tobi'));
check(s.speisekammer.rinderhack.q === 150 && s.speisekammer.eier.q === 6 && !s.speisekammer.reis, 'Ab: abgezogen; was nicht da ist, bleibt weg');
s = anwenden(s, opKammerMenge([P('rinderhack', 149)], -1, 'Tobi'));
check(!s.speisekammer.rinderhack, 'Bis auf einen Krümel verbraucht: weg');
s = anwenden(s, opKammerMenge([P('eier', 200, 'g')], -1, 'Tobi'));
check(s.speisekammer.eier.q === 6, 'Andere Einheit: nichts abgezogen');
s = anwenden(s, opKammerMenge([{ k: 'n:quark', name: 'Quark', cat: 'kuehl', q: null, u: '' }], 1, 'Amy'));
s = anwenden(s, opKammerMenge([P('n:quark', 200)], -1, 'Amy'));
check(s.speisekammer['n:quark']?.q === null, 'Ohne Menge („ist da“): Kochen nimmt es nicht weg');
s = anwenden(s, opKammerMenge([{ k: 'n:quark', name: 'Quark', q: null }], -1, 'Amy'));
check(!s.speisekammer['n:quark'], '… der Haken zurück schon (doch nicht gekauft)');
const t0 = '2099-01-10T10:00:00.000Z';
s = anwenden(s, opKammer({ k: 'eier', name: 'Eier', cat: 'kuehl', q: 4, u: 'Stk', bald: true }, 'Amy', t0));
check(s.speisekammer.eier.q === 4 && s.speisekammer.eier.bald && s.speisekammer.eier.geaendert === t0, 'Setzen: Menge und „muss bald weg“');
const alt = anwenden(s, opKammer({ k: 'eier', name: 'Eier', q: 9, u: 'Stk' }, 'Tobi', '2099-01-09T10:00:00.000Z'));
check(alt.speisekammer.eier.q === 4, 'Eine ältere Fassung kommt nicht über eine neuere');
check(anwenden(s, opKammerWeg('eier', '2099-01-09T10:00:00.000Z')).speisekammer.eier && !anwenden(s, opKammerWeg('eier', '2099-01-11T10:00:00.000Z')).speisekammer.eier, '„Ist alle“ – aber nicht über eine neuere Änderung');
check(beschreibung(leer(), s) === 'Speisekammer' && !/Eier|Hack/.test(beschreibung(leer(), s)), 'Commit: nur „Speisekammer“ – nie, was drin ist');
const zus = anwenden(anwenden(leer(), opKammerMenge([P('feta', 150)], 1, 'Tobi')), opZusammen({}, {}, { speisekammer: { feta: { name: 'Feta', q: 999, u: 'g' }, reis: { name: 'Reis', q: 500, u: 'g' } } }));
check(zus.speisekammer.feta.q === 150 && zus.speisekammer.reis.q === 500, 'Zusammenführen: was hier fehlt, kommt dazu – Vorhandenes bleibt');

/* -------------------------------------------------------- Einkauf, Kochen */

const d = { preise, katalog };
const zeileHack = { name: 'Rinderhackfleisch', cat: 'fleisch', parts: { chili: { q: 125, u: 'g', h: '1 × 500 g' }, bolognese: { q: 300, u: 'g', h: '1 × 500 g', done: true } } };
check(JSON.stringify(gekauftVon('rinderhack', zeileHack, ['chili'], d)) === JSON.stringify([{ k: 'rinderhack', name: 'Rinderhackfleisch', cat: 'fleisch', q: 500, u: 'g' }]), 'Haken: ganze Packungen – 125 g gebraucht, 500 g gekauft');
check(gekauftVon('rinderhack', zeileHack, null, d)[0].q === 500 && gekauftVon('haehnchenbrust', { name: 'Hähnchen', parts: { a: { q: 900, u: 'g', h: '3 × 400 g' } } }, null, d)[0].q === 1200, 'Mehr als eine Packung: 900 g gebraucht, 3 × 400 g gekauft');
check(gekauftVon('c-spueli', { name: 'Spülmittel', cat: 'haushalt', custom: true, parts: {} }, null, d).length === 0, 'Haushaltssachen kommen nicht in die Speisekammer');
check(JSON.stringify(gekauftVon('c-quark', { name: 'Quark', cat: 'kuehl', custom: true, parts: {} }, null, d)) === JSON.stringify([{ k: 'c-quark', name: 'Quark', cat: 'kuehl', q: null, u: '' }]), 'Ein eigener Eintrag ohne Menge: „ist da“');
check(nameVon('kokosmilch', '', katalog) === 'Kokosmilch' && nameVon('n:x', 'Dino Nuggets', {}) === 'Dino Nuggets', 'Name ohne Packungsangabe: „Kokosmilch, Dose à 400 ml“ → „Kokosmilch“');
const chili = daten.rezepte.find((r) => r.id === 'chili');
const verbraucht = verbrauchtVon(chili, katalog);
check(verbraucht.length > 5 && verbraucht.some((p) => p.k === 'rinderhack' && p.q === chili.items.find((x) => x.k === 'rinderhack').q) && verbraucht.every((p) => p.q > 0 && p.u), `Heute gekocht: alle Zutaten mit Menge (${verbraucht.length}, auch Öl und Gewürze aus dem Vorrat)`);

/* ------------------------------------------------------------------ Lesen */

const k2 = speisekammerBereinigen({
  rinderhack: { name: 'Rinderhackfleisch', cat: 'fleisch', q: 375, u: 'g', at: vor(FRISCH_TAGE + 1) },
  reis: { name: 'Basmatireis', cat: 'trocken', q: 1000, u: 'g', at: vor(30) },
  feta: { name: 'Feta', cat: 'kuehl', q: 150, u: 'g', at: vor(1) },
  eier: { name: 'Eier', cat: 'kuehl', q: 6, u: 'Stk', at: vor(1), bald: true },
});
check(alterTage(k2.rinderhack) === FRISCH_TAGE + 1 && mussBaldWeg(k2.rinderhack, katalog) && !mussBaldWeg(k2.reis, katalog) && !mussBaldWeg(k2.feta, katalog) && mussBaldWeg(k2.eier, katalog), `Muss bald weg: angetippt, oder Frisches seit ${FRISCH_TAGE} Tagen – Reis nie`);
check(kammerListe(k2, katalog).map((e) => e.k).join() === 'rinderhack,eier,feta,reis', 'Reihenfolge: was weg muss zuerst, dann nach Abteilung');
check(mengeKurz(k2.reis) === '1 kg' && mengeKurz(k2.rinderhack) === '375 g' && mengeKurz(k2.eier) === '6 Stk' && mengeKurz({ q: null }) === '', 'Mengen kurz: 1 kg, 375 g, 6 Stk');
const kt = kammerText(k2, ['feta'], katalog);
check(kt === 'Unbedingt verwenden: 150 g Feta\nWenn es passt, auch: 375 g Rinderhackfleisch, 6 Stk Eier\nAußerdem in der Speisekammer: 1 kg Basmatireis', `Für die KI: Angetipptes, was bald weg muss, der Rest (${kt.replace(/\n/g, ' | ')})`);
check(kammerText(k2, [], katalog).startsWith('Am besten verwenden (muss bald weg): 375 g Rinderhackfleisch') && kammerText({}, [], katalog) === '', 'Nichts angetippt: was bald weg muss zuerst; leer: kein Text');

check(JSON.stringify(postenAusText('500 g Hackfleisch', katalog, mehr)) === JSON.stringify({ k: 'rinderhack', name: 'Rinderhackfleisch', cat: 'fleisch', q: 500, u: 'g' }), 'Getippt: „500 g Hackfleisch“ findet Rinderhackfleisch im Katalog');
check(postenAusText('1 Packung Feta', katalog, mehr)?.q === 150 && postenAusText('1 Packung Feta', katalog, mehr)?.u === 'g' && postenAusText('1 Dose Kokosmilch', katalog, mehr)?.u === 'Dose', 'In der Einheit der Rezepte: eine Packung Feta sind 150 g, Kokosmilch bleibt in Dosen');
check(postenAusText('Salz', katalog, mehr) === null && postenAusText('Feta', katalog, mehr)?.q === null, 'Salz kommt nicht hinein, Feta ohne Menge „ist da“');
check(postenAusZeilen('6 Eier, 1,5 kg Kartoffeln; Feta\nMais', katalog, mehr).map((p) => `${p.k}:${p.q}`).join() === 'eier:6,kartoffeln:1500,feta:null,mais:null', 'Mehrere auf einmal (Komma, Semikolon, Zeile) – „1,5 kg“ bleibt eine Zahl');
const erkannt = erkanntAlsPosten({ sachen: [{ name: 'Basmatireis', menge: 500, einheit: 'g' }, { name: 'Mais', menge: 2, einheit: 'Stk' }, { name: 'Mais', menge: 1, einheit: 'Stk' }, { name: 'Spülmittel', menge: 1, einheit: 'Stk' }, { name: '', menge: 1 }] }, katalog, mehr);
check(erkannt.find((p) => p.k === 'reis')?.q === 500 && erkannt.find((p) => p.k === 'mais')?.q === 3 && erkannt.find((p) => p.k === 'mais')?.u === 'Dose', `Vom Foto: Reis 500 g, zweimal Mais zusammen (3 Dosen) (${erkannt.map((p) => `${p.name} ${p.q} ${p.u}`).join(', ')})`);
const aus = (name, menge) => kammerAusProdukt({ name, notiz: menge ? `Menge: ${menge}\nInhaltsstoffe: x` : '' }, katalog, mehr);
check(JSON.stringify(aus('Kokosmilch', '400 ml')) === JSON.stringify({ k: 'kokosmilch', name: 'Kokosmilch', cat: 'konserven', q: 1, u: 'Dose' }) && aus('Kidney Bohnen', '400 g')?.u === 'Dose' && aus('Basmati Reis', '1 kg')?.q === 1000 && aus('Skyr Natur', '450 g')?.q === 450, 'Gescannt: 400 ml Kokosmilch ist 1 Dose (die Packung steht im Katalog), 1 kg Reis 1000 g, Skyr 450 g');
check(aus('Feta', '')?.q === null && kammerAusProdukt({ name: '', marke: '' }, katalog, mehr) === null && aus('Tomatensauce Mama', '2 x 400 g')?.q === 400, 'Ohne Menge: „ist da“; ohne Namen: nichts; „2 x 400 g“ nimmt die Packung');
const rk = rumpfKammer({ anbieter: 'anthropic', fotos: ['AAA', 'BBB'] });
const rg = rumpfKammer({ anbieter: 'gemini', fotos: ['AAA'] });
check(rk.messages[0].content.filter((c) => c.type === 'image').length === 2 && rk.output_config?.format?.type === 'json_schema' && rg.input[0].type === 'image' && rg.response_format.schema === KAMMER_SCHEMA && /Speisekammer/.test(rk.system), 'Foto-Anfrage: Claude mit Schema, Gemini mit Schema, Bilder dabei');

/* ============================================================ im Browser */

const KI = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
const ANTWORT = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'daten', 'ki-antwort.json'), 'utf8'));
const STROM = (json) => {
  const ev = (o) => `event: ${o.event_type}\r\ndata: ${JSON.stringify(o)}\r\n\r\n`;
  return ev({ event_type: 'interaction.created', interaction: { id: 'ia_1', status: 'in_progress' } })
    + ev({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: json } })
    + ev({ event_type: 'interaction.completed', interaction: { id: 'ia_1', status: 'completed', usage: { total_input_tokens: 10, total_output_tokens: 10, total_tokens: 20 } } });
};
const anfragen = [];
async function gemini(r) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  const rumpf = JSON.parse(r.request().postData() || '{}');
  anfragen.push(rumpf);
  const foto = !!rumpf.response_format?.schema?.properties?.sachen;
  const antwort = foto ? { sachen: [{ name: 'Basmatireis', menge: 500, einheit: 'g' }, { name: 'Kokosmilch', menge: 2, einheit: 'Stk' }] } : ANTWORT;
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: STROM(JSON.stringify(antwort)) });
}

const browser = await starteBrowser();
const gh = githubAttrappe();
// Strichcodes: das Handy liest sie selbst (BarcodeDetector wie in Chrome auf Android), Open Food Facts ist nachgebaut
const LESER = 'window.BarcodeDetector = class { static async getSupportedFormats() { return ["ean_13"]; } async detect() { return [{ rawValue: window.__code || "", format: "ean_13" }]; } };';
const PRODUKTE = { 4000000000012: { name: 'Kokosmilch', quantity: '400 ml' }, 4000000000029: { name: 'Basmati Reis', quantity: '1 kg' } };
const datenbank = { route: async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'X-User-Agent', 'access-control-allow-methods': 'GET, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  const u = new URL(req.url());
  const code = u.pathname.split('/').pop();
  const p = PRODUKTE[code];
  const art = /openfoodfacts/.test(u.hostname) ? 'food' : 'beauty';
  const json = (status, body) => r.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!p) return json(404, { code, status: 'failure', errors: [{ message: { id: 'product_not_found' } }] });
  if (art !== 'food') return json(404, { code, status: 'failure', errors: [{ message: { id: 'product_found_with_a_different_product_type' }, field: { id: 'product_type', value: 'food' } }] });
  return json(200, { code, status: 'success', product: { code, product_name: p.name, quantity: p.quantity, product_type: 'food' } });
} };
const tobi = await handy(browser, { attrappe: gh, skript: LESER, datenbank });
await tobi.ctx.route('https://generativelanguage.googleapis.com/**', gemini);
const t = tobi.page;
const kammer = () => gh.liste()?.speisekammer || {};
const zurueck = async () => { if (await t.locator('#detail:not([hidden]) [data-act="zurueck"]').count()) await t.click('#detail [data-act="zurueck"]'); };
// Das Tier nach „Heute gekocht“ (und dem letzten Haken) wieder zu
const lobZu = async () => { await t.waitForTimeout(300); if (await t.locator('#lob:not([hidden])').count()) await t.click('[data-lob="zu"]'); };
await t.click('.tab[data-tab="einkauf"]');
await t.click('[data-act="z-oeffnen"]');
await t.fill('#z-name', 'Tobi');
await t.fill('#z-token', SCHLUESSEL);
await t.click('#z-los');
check(await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt'), 'Tobi: an der gemeinsamen Liste');

// Einkaufen: das Chili auf die Liste, Hack abhaken – es liegt in der Speisekammer
await t.click('.tab[data-tab="rezepte"]');
await t.click('#grid [data-open="chili"]');
await t.click('[data-act="alle-dazu"]');
await t.click('.tab[data-tab="einkauf"]');
await bis(() => !!gh.liste()?.items?.rinderhack?.parts?.chili, 8000);
const hackGebraucht = gh.liste().items.rinderhack.parts.chili.q;
await t.click('[data-check="rinderhack"]');
check(await bis(() => kammer().rinderhack?.q >= hackGebraucht && kammer().rinderhack.q % 500 === 0), `Abhaken: das Hack liegt in der Speisekammer – ganze Packungen (${kammer().rinderhack?.q} g für ${hackGebraucht} g)`);
await t.click('[data-check="rinderhack"]');
check(await bis(() => !kammer().rinderhack), 'Den Haken zurück: wieder raus');
await t.click('[data-check="rinderhack"]');
await t.click('[data-check="zwiebeln"]');
check(await bis(() => !!kammer().rinderhack && !!kammer().zwiebeln), 'Wieder abgehakt, dazu die Zwiebeln');

// Die Speisekammer: ohne KI-Schlüssel zu sehen, tippen, ☆, ✓
await t.click('.tab[data-tab="rezepte"]');
await zurueck();
await t.click('#browse .abk-reste');
check(await bis(async () => (await t.locator('#kammer').count()) === 1) && (await t.locator('#k-titel').innerText()) === 'Was ist noch da?' && (await t.locator('#kammer .kammer-z').count()) === 2, 'Rezepte → Speisekammer: auch ohne KI-Schlüssel, mit dem Eingekauften');
await t.fill('#kammer-neu', '6 Eier, 1 Packung Feta');
await t.click('#kammer-dazu-form button[type="submit"]');
check(await bis(() => kammer().eier?.q === 6 && kammer().feta?.q === 150) && await bis(async () => (await t.locator('#kammer .kammer-z').count()) === 4) && (await t.inputValue('#kammer-neu')) === '', 'Getippt: 6 Eier und eine Packung Feta (150 g) – das Feld ist wieder leer');
await t.click('[data-kammer-bald="feta"]');
check(await bis(() => kammer().feta?.bald === true) && await bis(async () => (await t.locator('#kammer .kammer-z').first().innerText()).includes('Feta')), '☆: Feta muss bald weg – und steht ganz oben');
await t.click('[data-kammer-menge="eier"]');
await t.fill('#kammer-menge', '4');
await t.press('#kammer-menge', 'Enter');
check(await bis(() => kammer().eier?.q === 4), 'Menge antippen und ändern: 4 Eier');
await t.click('[data-kammer-weg="zwiebeln"]');
check(await bis(() => !kammer().zwiebeln) && await bis(async () => (await t.locator('#kammer .kammer-z').count()) === 3), '✓: die Zwiebeln sind alle');

// Auf der Einkaufsliste: was zu Hause ist
await t.click('[data-act="reste-zu"]');
await t.click('#grid [data-open="gebratener-reis"]');
await t.click('[data-act="alle-dazu"]');
await t.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await t.locator('li.item:has([data-check="eier"]) .item-da').innerText().catch(() => '')) === 'zu Hause: 4 Stk'), 'Auf der Liste: „zu Hause: 4 Stk“ bei den Eiern');

// Heute gekocht: das Chili verbraucht sein Hack
await t.click('.tab[data-tab="rezepte"]');
await zurueck();
await t.click('#grid [data-open="chili"]');
const vorher = kammer().rinderhack.q;
await t.click('[data-act="gekocht"]');
await lobZu();
check(await bis(() => (kammer().rinderhack?.q || 0) === Math.max(0, vorher - hackGebraucht) || (!kammer().rinderhack && vorher <= hackGebraucht)), `Heute gekocht: ${hackGebraucht} g Hack raus (vorher ${vorher} g)`);
check(kammer().feta?.q === 150, 'Was das Chili nicht braucht, bleibt');
// Strichcode scannen: nachgeschlagen, in der Einheit der Rezepte hinein (400 ml Kokosmilch → 1 Dose)
await zurueck();
await t.click('#browse .abk-reste');
const BILD = { name: 'code.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4UaEBRwzEcQBTUhaBGaoOzwAAAABJRU5ErkJggg==', 'base64') };
const scanne = async (code) => {
  await t.evaluate((c) => { window.__code = c; }, code);
  await t.click('[data-act="kammer-scannen"]');
  await t.waitForSelector('#scan-dlg[open]');
  await t.setInputFiles('#scan-datei', BILD);
};
await scanne('4000000000012');
check(await bis(() => kammer().kokosmilch?.q === 1 && kammer().kokosmilch.u === 'Dose', 8000) && await bis(async () => (await t.locator('#toast').innerText()).includes('Kokosmilch (1 Dose) ist in der Speisekammer')), 'Scannen: Kokosmilch 400 ml – als 1 Dose in der Speisekammer, wie die Rezepte rechnen');
await scanne('4000000000029');
check(await bis(() => kammer().reis?.q === 1000 && kammer().reis.u === 'g', 8000), 'Basmati 1 kg: 1000 g Reis');
await scanne('4000000000999');
check(await bis(async () => (await t.locator('#toast').innerText()).includes('kennt keine Datenbank')), 'Unbekannte Nummer: „kennt keine Datenbank – tipp ein, was es ist“');
await t.click('[data-act="kammer-wahl-weg"]').catch(() => {});
await t.click('[data-act="reste-zu"]');

// Mit der KI: angetippt zuerst, und ein Foto liest ein, was da ist
await t.evaluate((k) => localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: k })), KI);
await zurueck();
await t.click('#browse .abk-reste');
await bis(async () => (await t.locator('#kammer').count()) === 1);
await t.click('[data-kammer-wahl="eier"]');
check(await bis(async () => (await t.locator('[data-act="kammer-los"]').innerText()) === 'Rezept mit dem Angetippten'), 'Eier angetippt: „Rezept mit dem Angetippten“');
await t.click('[data-act="kammer-los"]');
check(await bis(() => anfragen.length === 1, 10000), 'Die KI bekommt die Anfrage – ohne getippten Text');
const text = JSON.stringify(anfragen[0]);
check(text.includes('Unbedingt verwenden: 4 Stk Eier') && text.includes('Feta'), 'Darin: „Unbedingt verwenden: 4 Stk Eier“ und der Rest der Speisekammer');
check(await bis(async () => (await t.locator('#d-title').count()) === 1, 10000), 'Das Rezept öffnet');
check(await t.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.kammer.wahl.v1') || '[]').length) === 0, 'Danach ist nichts mehr angetippt');
if (await t.locator('#detail [data-act="ki-verwerfen"]').count()) await t.click('#detail [data-act="ki-verwerfen"]');
await zurueck();
if (await t.locator('#reste').isHidden()) await t.click('#browse .abk-reste');
await bis(async () => (await t.locator('#kammer-foto').count()) === 1);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4UaEBRwzEcQBTUhaBGaoOzwAAAABJRU5ErkJggg==', 'base64');
await t.setInputFiles('#kammer-foto', { name: 'regal.png', mimeType: 'image/png', buffer: PNG });
check(await bis(() => kammer().reis?.q === 1500 && kammer().kokosmilch?.q === 3 && kammer().kokosmilch?.u === 'Dose', 10000), 'Ein Foto: die KI liest ab – 500 g Reis und 2 Dosen Kokosmilch kommen dazu (jetzt 1,5 kg und 3 Dosen)');
check(anfragen.at(-1).input.some((x) => x.type === 'image'), 'mit dem Bild in der Anfrage');
check(gh.zustand.nachrichten.some((x) => /Speisekammer/.test(x)), 'Im Commit steht „Speisekammer“');
check(tobi.fehler.length === 0, `keine Fehler im Browser (${tobi.fehler.join(' | ')})`);

await browser.close();
ende();
