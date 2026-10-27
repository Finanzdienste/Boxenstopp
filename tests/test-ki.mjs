/*
 * Die Resteverwertung: erst ohne Browser (Antwort prüfen, Mengen auf die
 * Ziele rechnen, Anfrage bauen, Strom lesen), dann im Browser gegen eine
 * nachgebaute Anthropic-API – mit zwei Handys und der GitHub-Attrappe, damit
 * ein behaltenes Rezept auch beim anderen ankommt.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL } from './hilfe.mjs';
import { kiBereinigen, mengenAnpassen, alsRezept, proBox, abstand, schoen, KI_ID } from '../js/ki-rezept.js';
import { anfrageBauen, anfrageBauenGemini, rumpfFuer, kiAnfragen, kostenCent, anbieterVon, ANBIETER, MODELL } from '../js/ki.js';
import { kiAus } from '../js/zugang.js';
import { bereinigen, anwenden, leer, opKiBehalten, opKiWeg, opZusammen } from '../js/liste.js';
import { zeitVon } from '../js/zeiten.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const ANTWORT = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'daten', 'ki-antwort.json'), 'utf8'));
const ZIEL = daten.ziel;
const einheiten = {};
for (const r of daten.rezepte) for (const it of r.items) if (it.k && typeof it.q === 'number') einheiten[it.k] = it.u;
const klon = (x) => JSON.parse(JSON.stringify(x));

/* ================================================================ ohne Browser */


// --- bereinigen
const { r: k0, fehler: f0 } = kiBereinigen({ ...ANTWORT, portionen: 8 });
check(k0 && !f0, `die Beispielantwort ist ein gültiges Rezept${f0 ? ` (${f0})` : ''}`);
check(k0.portionen === 8 && k0.zutaten.length === 9 && k0.schalen.length === 4 && k0.ablauf.map((p) => p.t).join() === 'Vorbereiten,Kochen,Portionieren', 'Portionen, Zutaten, Schalen und drei Abschnitte übernommen');
check(k0.ablauf[1].schritte[0].ruhe === 22 && k0.ablauf[0].schritte.some((s) => s.liste?.length === 5), 'Wartezeit und Liste im Schritt bleiben erhalten');
check(kiBereinigen(null).r === null && kiBereinigen({ name: 'X' }).r === null && kiBereinigen({ ...ANTWORT, kochen: [] }).r === null, 'Unsinn, keine Zutaten oder keine Kochschritte: kein Rezept');
const riesig = kiBereinigen({ ...ANTWORT, name: 'A'.repeat(500), zutaten: [{ ...ANTWORT.zutaten[0], menge: 99999, pro100: { kcal: 5000, p: -3, kh: 'x', f: 50 } }, ANTWORT.zutaten[1]] }).r;
check(riesig.name.length === 70 && riesig.zutaten[0].menge === 5000 && riesig.zutaten[0].pro100.kcal === 900 && riesig.zutaten[0].pro100.p === 0 && riesig.zutaten[0].pro100.kh === 0, 'zu lange Texte und unmögliche Zahlen werden begrenzt');
const doppelt = kiBereinigen({ ...ANTWORT, zutaten: [ANTWORT.zutaten[0], { ...ANTWORT.zutaten[0], name: 'Noch mehr Hähnchen' }] }).r;
check(doppelt.zutaten[0].id !== doppelt.zutaten[1].id, `doppelte ids werden eindeutig (${doppelt.zutaten.map((z) => z.id).join(', ')})`);
const mitSpeck = kiBereinigen({ ...ANTWORT, zutaten: [...ANTWORT.zutaten, { ...ANTWORT.zutaten[0], id: 'speck', name: 'Speckwürfel' }] });
check(mitSpeck.r === null && mitSpeck.art === 'verboten' && /Speck/.test(mitSpeck.fehler), 'Speck in den Zutaten: kein Rezept („das esst ihr nicht“)');
const mitFisch = kiBereinigen({ ...ANTWORT, gewuerze: [...ANTWORT.gewuerze, { name: 'Fischsauce', menge: '1 EL' }] });
check(mitFisch.art === 'verboten', 'Fischsauce bei den Gewürzen: kein Rezept');
check(kiBereinigen({ ...ANTWORT, zutaten: [...ANTWORT.zutaten, { ...ANTWORT.zutaten[0], id: 'paste', name: 'Rote Currypaste ohne Garnelen' }] }).r !== null, '„ohne Garnelen“ ist erlaubt');
check(kiBereinigen({ ...ANTWORT, zutaten: [...ANTWORT.zutaten, { ...ANTWORT.zutaten[0], id: 'hack', name: 'Putenhackfleisch' }] }).art === 'verboten', 'Putenhack: kein Rezept');

// --- auf die Ziele rechnen
const vorher = proBox(k0);
const k1 = mengenAnpassen(k0, ZIEL);
const box = proBox(k1);
check(abstand(box, ZIEL) < abstand(vorher, ZIEL) / 4, `die Mengen rücken die Box viel näher ans Ziel (Abstand ${abstand(vorher, ZIEL).toFixed(1)} → ${abstand(box, ZIEL).toFixed(1)})`);
check(Math.abs(box.kcal - ZIEL.kcal) <= 10 && Math.abs(box.p - ZIEL.p) <= 1.5 && Math.abs(box.kh - ZIEL.kh) <= 2 && Math.abs(box.f - ZIEL.f) <= 1.2,
  `eine Box trifft das Ziel: ${box.kcal.toFixed(0)} kcal, ${box.p.toFixed(1)} P, ${box.kh.toFixed(1)} KH, ${box.f.toFixed(1)} F`);
check(k1.zutaten.every((z, i) => z.menge >= z.min && z.menge <= z.max && (z.anpassbar || z.menge === k0.zutaten[i].menge)), 'nur anpassbare Mengen bewegen sich, und alle bleiben zwischen min und max');
check(k1.zutaten.filter((z) => z.anpassbar).every((z) => z.menge % (z.menge >= 200 ? 10 : z.menge >= 30 ? 5 : 1) === 0), `runde Mengen (${k1.zutaten.filter((z) => z.anpassbar).map((z) => `${z.id} ${z.menge}`).join(', ')})`);
check(k1.zutaten.every((z, i) => z.vorschlag === k0.zutaten[i].menge), 'der Vorschlag der KI bleibt zum Vergleich gespeichert');
check(schoen(213, 0, 217) === 210 && schoen(47, 46, 49) === 47 && schoen(18.4) === 18, 'Runden: in 10ern, 5ern oder ganzen Gramm, nie aus dem Bereich');
const ohneFrei = mengenAnpassen({ ...k0, zutaten: k0.zutaten.map((z) => ({ ...z, anpassbar: false })) }, ZIEL);
check(JSON.stringify(ohneFrei.zutaten.map((z) => z.menge)) === JSON.stringify(k0.zutaten.map((z) => z.menge)), 'ohne anpassbare Zutaten bleibt alles, wie die KI es wollte');

// --- als Rezept der App
const R = alsRezept(k1, { id: 'ki-test1234', katalog: daten.katalog, einheiten, von: { by: 'Amy', at: '2026-10-27T17:00:00.000Z' } });
const texte = R.ablauf.flatMap((p) => p.schritte.flatMap((s) => [s.d, ...(s.liste || [])])).join(' ');
check(!/[{}]/.test(texte) && texte.includes(`${k1.zutaten.find((z) => z.id === 'reis').menge} g Reis`), 'Platzhalter in den Schritten werden zu den endgültigen Mengen');
const schluessel = Object.fromEntries(R.items.map((it) => [it.n, it.k]));
check(schluessel['Hähnchenbrustfilet'] === 'haehnchenbrust' && schluessel.Zwiebeln === 'zwiebeln' && schluessel.Feta === 'feta', 'Zutaten aus dem Katalog teilen sich die Zeile mit den festen Rezepten');
check(schluessel.Zucchini === 'ki-zucchini' && schluessel.Paprika === 'ki-paprika' && schluessel['Kichererbsen, abgetropft'] === 'ki-kichererbsen', 'andere Einheit als im Katalog (Paprika in Stück) oder nicht im Katalog: eigener Schlüssel ki-…');
check(R.items.find((it) => it.k === 'ki-kichererbsen').kat?.c === 'konserven', 'eigene Zutaten bringen Namen und Abteilung mit');
check(R.items.filter((it) => it.da).length === 4 && R.items.filter((it) => it.pantry).length === 1, 'vier Zutaten sind schon da, eine kommt aus dem Vorrat');
check(R.spices.find((s) => s.n === 'Paprika edelsüß').k === 'paprika-edelsuess' && R.spices.find((s) => s.n === 'Sumach').k === 'ki-g-sumach', 'Gewürze: aus dem Katalog, wenn es sie dort gibt');
check(R.m.kcal === Math.round(R.total[0] / 8) && JSON.stringify(R.zeit) === JSON.stringify(zeitVon(R)) && R.time === R.zeit.gesamt, `Nährwerte pro Box und Zeiten gerechnet (${R.m.kcal} kcal, ${R.zeit.gesamt} Min.)`);
check(R.ki.aenderungen.length >= 1 && R.ki.aenderungen.every((a) => a.vorher !== a.nachher), `die App zeigt, welche Mengen sie verschoben hat (${R.ki.aenderungen.map((a) => `${a.name} ${a.vorher}→${a.nachher}`).join(', ')})`);

// --- Anfrage
const rumpf = anfrageBauen({ text: '1 Zucchini, Feta', wuensche: 'was Griechisches', fotos: ['AAAA', 'BBBB'], portionen: 4, dazukaufen: false, ziel: ZIEL, katalog: daten.katalog, mag: ['Butter Chicken mit Reis'], magNicht: ['Spaghetti Bolognese'], vermeiden: ['Feta-Reispfanne'] });
check(rumpf.model === MODELL && rumpf.tool_choice?.name === 'rezept_ausgeben' && rumpf.tools[0].input_schema.required.includes('zutaten'), `Claude muss das Werkzeug rezept_ausgeben benutzen (${MODELL})`);
const inhalt = rumpf.messages[0].content;
check(inhalt.length === 3 && inhalt[0].type === 'image' && inhalt[0].source.media_type === 'image/jpeg' && inhalt[2].type === 'text', 'erst die Fotos, dann der Text');
check(/Portionen: 4/.test(inhalt[2].text) && /Dazukaufen: nein/.test(inhalt[2].text) && /was Griechisches/.test(inhalt[2].text) && /Daumen hoch\): Butter Chicken/.test(inhalt[2].text) && /nicht noch einmal: Feta-Reispfanne/.test(inhalt[2].text), 'im Text: Portionen, Dazukaufen, Wünsche, was ihr mögt und was nicht');
const sys = rumpf.system;
check(/Kein Fisch/.test(sys) && /Kein Schweinefleisch/.test(sys) && /kein Putenhack/.test(sys) && /Hüttenkäse/.test(sys), 'die Regeln gehen mit: kein Fisch, kein Schwein, kein Putenhack, kein Hüttenkäse');
check(sys.includes('443 kcal') && sys.includes('33 g Protein') && /Mise en place/.test(sys) && /Schale 2/.test(sys) && /\{id\}/.test(sys) && /nichts dazugekauft/.test(sys), 'Ziel, Mise en place, Schalen, Platzhalter und „nichts dazukaufen“ stehen im Auftrag');
check(sys.includes('haehnchenbrust=Hähnchenbrustfilet') && !sys.includes('backpapier='), 'der Katalog geht mit (ohne Haushalt)');

// --- Gemini: Schlüssel, Rumpf, Schema
const GKEY = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
check(anbieterVon(GKEY) === 'gemini' && anbieterVon('AIzaSyD-TEST0000000000000000000000000000') === 'gemini' && anbieterVon('sk-ant-api03-x_y') === 'anthropic' && anbieterVon('quatsch') === '', 'der Anfang des Schlüssels sagt, wer dran ist: AQ. oder AIza → Google, sk-ant- → Anthropic');
check(kiAus(GKEY) && kiAus('AIzaSyD-TEST0000000000000000000000000000') && kiAus('sk-ant-api03-TESTTESTTESTTESTTESTTEST_abc') && !kiAus('AQ.kurz') && !kiAus('AIza-kurz') && kiAus(`https://x.y/#zugang=abc&ki=${encodeURIComponent(GKEY)}`) === GKEY, 'alle Schlüsselformen werden erkannt, auch aus dem Link');
const rg = anfrageBauenGemini({ text: 'Feta', wuensche: '', fotos: ['AAAA'], portionen: 6, dazukaufen: true, ziel: ZIEL, katalog: daten.katalog });
check(rg.model === 'gemini-3.8-flash' && rg.response_format?.mime_type === 'application/json' && rg.response_format.schema?.required?.includes('zutaten') && rg.stream === true && rg.store === false, 'Gemini-Anfrage (Interactions-API): Modell, JSON nach Schema, gestreamt, nicht gespeichert');
check(rg.input[0].type === 'image' && rg.input[0].mime_type === 'image/jpeg' && rg.input[0].data === 'AAAA' && rg.input[1].type === 'text' && /Portionen: 6/.test(rg.input[1].text), 'Foto als Bild-Teil, Text dahinter');
check(/als JSON genau nach dem vorgegebenen Schema/.test(rg.system_instruction) && !/rezept_ausgeben/.test(rg.system_instruction) && /Kein Fisch/.test(rg.system_instruction), 'Gemini bekommt dieselben Regeln, nur ohne Werkzeug');
check(rumpfFuer('gemini', { ziel: ZIEL, katalog: {} }).response_format && rumpfFuer('anthropic', { ziel: ZIEL, katalog: {} }).tool_choice, 'rumpfFuer wählt nach Anbieter');
check(kostenCent({ ein: 5000, aus: 5000 }, 'gemini') === 0 && kostenCent({ ein: 5000, aus: 5000 }, 'anthropic') > 0 && ANBIETER.gemini.modell === 'gemini-3.8-flash' && ANBIETER.gemini.preis === null, 'Gemini (3.8 Flash) kostet nichts, Claude ein paar Cent');

// --- Strom lesen (mit nachgebautem fetch)
const STROM = (json, { stopp = 'tool_use', stueck = 150 } = {}) => {
  const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
  let s = ev({ type: 'message_start', message: { usage: { input_tokens: 3000, output_tokens: 1 } } });
  s += ev({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't1', name: 'rezept_ausgeben', input: {} } });
  for (let i = 0; i < json.length; i += stueck) s += ev({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: json.slice(i, i + stueck) } });
  s += ev({ type: 'content_block_stop', index: 0 });
  s += ev({ type: 'message_delta', delta: { stop_reason: stopp }, usage: { output_tokens: 4000 } });
  s += ev({ type: 'message_stop' });
  return s;
};
const echtFetch = globalThis.fetch;
const mitFetch = async (antwort, f) => {
  globalThis.fetch = async (url, opt) => { mitFetch.letzte = { url, opt }; return antwort(); };
  try { return await f(); } finally { globalThis.fetch = echtFetch; }
};
let fortschritt = 0;
const gelesen = await mitFetch(() => new Response(STROM(JSON.stringify(ANTWORT)), { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  () => kiAnfragen(rumpf, { schluessel: 'sk-ant-test', beiFortschritt: (p) => { fortschritt = p.zeichen; } }));
check(gelesen.eingabe.name === ANTWORT.name && gelesen.usage.ein === 3000 && gelesen.usage.aus === 4000 && fortschritt > 1000, 'der Strom wird gelesen: Rezept, Tokens, Fortschritt');
const kopf = mitFetch.letzte.opt.headers;
check(kopf['x-api-key'] === 'sk-ant-test' && kopf['anthropic-dangerous-direct-browser-access'] === 'true' && kopf['anthropic-version'] && JSON.parse(mitFetch.letzte.opt.body).stream === true, 'Anfrage mit Schlüssel, Browser-Freigabe, Version und stream');
check(Math.abs(kostenCent(gelesen.usage) - 4.6) < 0.01, `Kosten: ca. ${kostenCent(gelesen.usage).toFixed(1)} Cent`);
const fehlerArt = async (antwort) => { try { await mitFetch(antwort, () => kiAnfragen(rumpf, { schluessel: 'x' })); return 'kein Fehler'; } catch (e) { return e.art; } };
check(await fehlerArt(() => new Response(JSON.stringify({ error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401 })) === 'schluessel', '401: Schlüssel prüfen');
check(await fehlerArt(() => new Response(JSON.stringify({ error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } }), { status: 400 })) === 'guthaben', 'kein Guthaben wird erkannt');
check(await fehlerArt(() => new Response(JSON.stringify({ error: { type: 'overloaded_error', message: 'Overloaded' } }), { status: 529 })) === 'ueberlastet', '529: überlastet');
check(await fehlerArt(() => new Response(STROM(JSON.stringify(ANTWORT).slice(0, 500), { stopp: 'max_tokens' }), { status: 200 })) === 'zulang', 'abgeschnittene Antwort: zu lang');
check(await fehlerArt(() => { throw new TypeError('Failed to fetch'); }) === 'netz', 'ohne Netz: Verbindung prüfen');

// --- Gemini-Strom lesen (Interactions-API: step.delta, interaction.completed)
const GEMINI_STROM = (json, { status = 'completed', stueck = 400 } = {}) => {
  const ev = (o) => `event: ${o.event_type}\r\ndata: ${JSON.stringify(o)}\r\n\r\n`;
  let s = ev({ event_type: 'interaction.created', interaction: { id: 'ia_1', status: 'in_progress' } });
  for (let i = 0; i < json.length; i += stueck) s += ev({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: json.slice(i, i + stueck) } });
  s += ev({ event_type: 'interaction.completed', interaction: { id: 'ia_1', status, usage: { total_input_tokens: 2500, total_output_tokens: 3800, total_thought_tokens: 600, total_tokens: 6900 }, ...(status === 'failed' ? { error: { message: 'Blocked by safety filters' } } : {}) } });
  return s;
};
let gFortschritt = 0;
const gGelesen = await mitFetch(() => new Response(GEMINI_STROM(JSON.stringify(ANTWORT)), { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  () => kiAnfragen(rg, { schluessel: GKEY, beiFortschritt: (p) => { gFortschritt = p.zeichen; } }));
check(gGelesen.eingabe.name === ANTWORT.name && gGelesen.anbieter === 'gemini' && gGelesen.usage.ein === 2500 && gGelesen.usage.aus === 4400 && gFortschritt > 1000, 'Gemini-Strom: Rezept, Tokens (mit Denken), Fortschritt');
const gKopf = mitFetch.letzte.opt.headers;
check(gKopf['x-goog-api-key'] === GKEY && !('x-api-key' in gKopf) && /\/v1beta\/interactions\?alt=sse$/.test(mitFetch.letzte.url) && JSON.parse(mitFetch.letzte.opt.body).stream === true, 'Gemini-Anfrage: eigener Kopf, Interactions-Adresse mit SSE');
const gFehler = async (antwort) => { try { await mitFetch(antwort, () => kiAnfragen(rg, { schluessel: GKEY })); return 'kein Fehler'; } catch (e) { return `${e.art}|${e.message}`; } };
check((await gFehler(() => new Response(JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }), { status: 400 }))).startsWith('schluessel|Google lehnt'), 'Gemini 400 „API key not valid“: Google lehnt den Schlüssel ab');
check((await gFehler(() => new Response(JSON.stringify([{ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }]), { status: 429 }))).startsWith('grenze|Das Gratis-Kontingent'), 'Gemini 429 (auch als Liste): Gratis-Kontingent');
check((await gFehler(() => new Response(JSON.stringify({ error: { code: 503, message: 'The model is overloaded', status: 'UNAVAILABLE' } }), { status: 503 }))).startsWith('ueberlastet|Gemini'), 'Gemini 503: überlastet');
check((await gFehler(() => new Response(GEMINI_STROM(JSON.stringify(ANTWORT).slice(0, 300), { status: 'incomplete' }), { status: 200 }))).startsWith('zulang'), 'Gemini „incomplete“: zu lang');
check((await gFehler(() => new Response(GEMINI_STROM('', { status: 'failed' }), { status: 200 }))).startsWith('sicherheit'), 'Gemini „failed“ wegen Sicherheitsfilter: verständlicher Hinweis');
const ohneStrom = `event: interaction.completed\r\ndata: ${JSON.stringify({ event_type: 'interaction.completed', interaction: { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(ANTWORT) }] }], usage: { total_input_tokens: 1, total_output_tokens: 2 } } })}\r\n\r\n`;
check((await mitFetch(() => new Response(ohneStrom, { status: 200 }), () => kiAnfragen(rg, { schluessel: GKEY }))).eingabe.name === ANTWORT.name, 'kommt der Text erst am Ende in steps, wird er auch gelesen');
const umzaeunt = await mitFetch(() => new Response(GEMINI_STROM(`\`\`\`json\n${JSON.stringify(ANTWORT)}\n\`\`\``), { status: 200 }), () => kiAnfragen(rg, { schluessel: GKEY }));
check(umzaeunt.eingabe.name === ANTWORT.name, 'JSON in ```-Zaun wird trotzdem gelesen');

// --- in liste.json, für beide
const behalten = anwenden(leer(), opKiBehalten('ki-abcd1234', k1, 'Amy'));
check(behalten.ki['ki-abcd1234']?.r.name === ANTWORT.name && behalten.ki['ki-abcd1234'].by === 'Amy', 'Behalten legt das Rezept unter ki ab');
const roh = klon(behalten);
roh.ki['kaputt id'] = { r: k1 };
roh.ki['ki-leer1234'] = { r: { name: 'nix' } };
for (let i = 0; i < 14; i++) roh.ki[`ki-alt${String(i).padStart(4, '0')}`] = { r: k1, by: 'Tobi', at: `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00.000Z` };
const sauber = bereinigen(roh);
check(!sauber.ki['kaputt id'] && !sauber.ki['ki-leer1234'] && Object.keys(sauber.ki).length === 12 && sauber.ki['ki-abcd1234'] && !sauber.ki['ki-alt0000'], 'Bereinigen: kaputte Einträge fallen weg, höchstens 12, die ältesten zuerst');
check(Object.keys(sauber.ki).every((id) => KI_ID.test(id)), 'nur gültige ki-ids');
check(!anwenden(behalten, opKiWeg('ki-abcd1234')).ki['ki-abcd1234'], 'Löschen nimmt es wieder raus');
const zus = anwenden(anwenden(leer(), opKiBehalten('ki-bbbb1234', k1, 'Tobi')), opZusammen({}, behalten.ki));
check(Object.keys(zus.ki).length === 2, 'Einrichten der gemeinsamen Liste nimmt behaltene Rezepte mit');

/* ================================================================ im Browser */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4UaEBRwzEcQBTUhaBGaoOzwAAAABJRU5ErkJggg==', 'base64');
const KI_SCHLUESSEL = GKEY;

/** Nachgebaute Gemini-API (streamGenerateContent) – der normale Weg in der App. */
function geminiAttrappe() {
  const z = { anfragen: [], art: 'ok', verzoegerung: 0, antwort: ANTWORT };
  async function route(r) {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    z.anfragen.push({ url: req.url(), kopf: req.headers(), rumpf: JSON.parse(req.postData() || '{}') });
    if (z.verzoegerung) await new Promise((f) => { setTimeout(f, z.verzoegerung); });
    if (z.art === 'schluessel') return r.fulfill({ status: 400, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }) });
    if (z.art === 'ueberlastet') return r.fulfill({ status: 503, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' } }) });
    return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: GEMINI_STROM(JSON.stringify(z.antwort)) });
  }
  return { z, route };
}

const browser = await starteBrowser();
const gh = githubAttrappe();
const ki = geminiAttrappe();
const tobi = await handy(browser, { attrappe: gh });
await tobi.ctx.route('https://generativelanguage.googleapis.com/**', ki.route);
const t = tobi.page;

// gemeinsame Liste einrichten
await t.click('.tab[data-tab="einkauf"]');
await t.click('[data-act="z-oeffnen"]');
await t.fill('#z-name', 'Tobi');
await t.fill('#z-token', SCHLUESSEL);
await t.click('#z-los');
await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt');
await t.click('.tab[data-tab="rezepte"]');

// --- einrichten
await t.click('.reste-karte');
check(!(await t.locator('#reste').isHidden()) && await t.locator('#k-schluessel').count() === 1, 'Resteverwertung öffnet – ohne Schlüssel zuerst das Einrichten');
await t.fill('#k-schluessel', 'falsch');
await t.click('#k-schluessel-form button[type="submit"]');
check((await t.locator('#k-schluessel-fehler').innerText()).includes('AQ.'), 'falscher Schlüssel: Hinweis, wie er aussieht');
await t.fill('#k-schluessel', KI_SCHLUESSEL);
await t.click('#k-schluessel-form button[type="submit"]');
check(await t.locator('#k-form').count() === 1, 'mit Schlüssel: das Formular');
check(await t.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.ki.v1')).schluessel.startsWith('AQ.')), 'der KI-Schlüssel liegt im Speicher dieses Handys');
check((await t.locator('#k-form .fine').first().innerText()).includes('kostenlos'), 'mit Google-Schlüssel: „kostenlos“');

// --- ohne Eingabe geht nichts
await t.click('#k-los');
check((await t.locator('#k-fehler').innerText()).includes('Schreib auf'), 'ohne Text und Foto: Hinweis statt Anfrage');
check(ki.z.anfragen.length === 0, 'und keine Anfrage an Google');

// --- Text, Foto, Portionen
await t.fill('#k-text', '500 g Hähnchen, 1 Zucchini, Feta, Reis');
await t.setInputFiles('#k-bilder', { name: 'kuehlschrank.png', mimeType: 'image/png', buffer: PNG });
check(await bis(async () => (await t.locator('.k-foto img').count()) === 1), 'das Foto erscheint als Vorschau');
await t.click('[data-portionen="8"]');
await t.fill('#k-wunsch', 'was Mediterranes');
await t.click('#k-los');
check(await bis(async () => (await t.locator('#d-title').count()) === 1 && (await t.locator('#d-title').innerText()) === ANTWORT.name, 10000), 'Claudes Rezept öffnet als Vorschlag');

const anfrage = ki.z.anfragen[0];
check(anfrage?.kopf['x-goog-api-key'] === KI_SCHLUESSEL && /\/v1beta\/interactions\?alt=sse/.test(anfrage.url) && anfrage.rumpf.model === 'gemini-3.8-flash', 'die Anfrage geht mit dem Schlüssel an Gemini 3.8 Flash (Interactions-API)');
const teile = anfrage.rumpf.input;
check(teile[0].type === 'image' && teile[0].mime_type === 'image/jpeg' && teile[0].data.length > 50 && /Portionen: 8/.test(teile.at(-1).text) && /Mediterranes/.test(teile.at(-1).text), 'mit Foto (als JPEG), Portionen und Wunsch');
check(anfrage.rumpf.response_format?.schema?.type === 'object', 'und dem Schema für die Antwort');
check((await t.locator('.ki-leiste').innerText()).includes('noch nicht gespeichert') && (await t.locator('.ki-leiste').innerText()).includes('gemini-3.8-flash, kostenlos'), 'Leiste: noch nicht gespeichert, Gemini, kostenlos');
check((await t.locator('.ki-anp').innerText()).includes('Auf eure Ziele gerechnet'), 'Leiste: welche Mengen die App angepasst hat');
const kcal = Number((await t.locator('.label .c-kcal .v').innerText()).replace(/\D/g, ''));
check(Math.abs(kcal - 443) <= 10, `das Etikett zeigt eine Box nahe am Ziel (${kcal} kcal)`);
const gruppen = await t.$$eval('#detail .sub-h', (hs) => hs.map((h) => h.textContent));
check(gruppen.includes('Einkaufen') && gruppen.includes('Ist schon da') && gruppen.includes('Aus dem Vorrat'), `Zutaten nach Einkaufen, Ist schon da, Vorrat (${gruppen.join(', ')})`);
check(!(await t.locator('#detail .steps').allInnerTexts()).join(' ').includes('{'), 'in den Schritten stehen Mengen, keine Platzhalter');
check(await t.locator('#detail .step .schale').count() >= 4, 'Schalen als Schilder in den Schritten');
check(await t.locator('[data-open^="ki-"]').count() === 0, 'ein Vorschlag steht noch nicht im Raster');

// --- neu laden: der Vorschlag ist noch da
await t.reload({ waitUntil: 'load' });
await t.waitForFunction(() => document.querySelector('#d-title'));
check((await t.locator('#d-title').innerText()) === ANTWORT.name, 'nach dem Neuladen ist der Vorschlag noch offen');

// --- auf die Liste: das behält das Rezept automatisch, und nur, was fehlt
await t.click('[data-act="alle-dazu"]');
check(await bis(() => Object.keys(gh.liste()?.ki || {}).length === 1), 'auf die Liste setzen behält das Rezept für beide');
check(await bis(async () => (await t.locator('.ki-leiste').innerText()).includes('für euch beide gespeichert')), 'Leiste: für euch beide gespeichert');
const items = gh.liste().items;
const rid = Object.keys(gh.liste().ki)[0];
const vonKi = Object.entries(items).filter(([, d]) => d.parts?.[rid]).map(([k]) => k).sort();
check(vonKi.join(',') === 'haehnchenbrust,ki-kichererbsen,ki-paprika,passata', `nur was fehlt kommt auf die Liste (${vonKi.join(', ')})`);
check(items['ki-kichererbsen'].name === 'Kichererbsen, abgetropft' && items['ki-kichererbsen'].cat === 'konserven', 'eigene Zutaten mit Namen und Abteilung');
await t.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await t.locator('#list-body .item-sub', { hasText: 'Feta-Reispfanne' }).count()) >= 4), 'auf der Liste steht, für welches Rezept');
await t.click('.tab[data-tab="rezepte"]');

// --- das zweite Handy sieht es
const einladung = `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}&ki=${encodeURIComponent(KI_SCHLUESSEL)}`;
await t.click('.tab[data-tab="einkauf"]');
const linkFeld = await t.evaluate(() => document.querySelector('#z-linkfeld')?.value || '');
check(linkFeld.includes('&ki=AQ.'), 'der Link fürs zweite Handy enthält jetzt auch den KI-Schlüssel');
await t.click('.tab[data-tab="rezepte"]');
const amy = await handy(browser, { attrappe: gh, adresse: einladung });
const a = amy.page;
check(await a.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.ki.v1') || '{}').schluessel?.startsWith('AQ.')), 'Amy: der KI-Schlüssel kommt über den Link');
await a.fill('#z-name', 'Amy');
await a.click('#z-los');
await bis(async () => (await a.locator('#sync-text').innerText()) === 'Geteilt');
await a.click('.tab[data-tab="rezepte"]');
check(await bis(async () => (await a.locator('[data-filter="reste"]').isVisible()) && (await a.locator('[data-filter="reste"] .n').innerText()) === '1'), 'Amy: Filter „Resteverwertung“ mit 1 Rezept');
await a.click('[data-filter="reste"]');
check(await a.locator('#grid .box').count() === 1 && (await a.locator('#grid .box .pill-ki').count()) === 1, 'Amy sieht Tobis Rezept im Raster');
await a.click('#grid .box');
check((await a.locator('.ki-leiste').innerText()).includes('von Tobi'), 'mit „von Tobi“');

// --- Fehler
ki.z.art = 'ueberlastet';
await t.click('[data-act="ki-neu"]');
check(await bis(async () => (await t.locator('#k-fehler').count()) === 1 && (await t.locator('#k-fehler').innerText()).includes('überlastet')), 'Gemini überlastet: Hinweis, nochmal versuchen');
check(ki.z.anfragen.at(-1).rumpf.input.at(-1).text.includes('Bitte nicht noch einmal'), 'ein neuer Vorschlag soll ein anderes Gericht sein');
ki.z.art = 'schluessel';
await t.click('#k-los');
check(await bis(async () => (await t.locator('#k-schluessel-fehler').count()) === 1 && (await t.locator('#k-schluessel-fehler').innerText()).includes('lehnt den Schlüssel ab')), 'Schlüssel abgelehnt: zurück zum Einrichten');
await t.click('[data-act="k-einrichten-zu"]');
ki.z.art = 'ok';
ki.z.verzoegerung = 4000;
await t.click('#k-los');
check(await bis(async () => (await t.locator('.ki-lauf').count()) === 1), 'während Claude kocht: Fortschritt mit Abbrechen');
await t.click('[data-act="k-abbrechen"]');
check(await bis(async () => (await t.locator('#k-form').count()) === 1) && (await t.locator('#k-fehler').isHidden()), 'Abbrechen: zurück zum Formular, ohne Fehler');
ki.z.verzoegerung = 0;
ki.z.antwort = { ...ANTWORT, zutaten: [...ANTWORT.zutaten, { ...ANTWORT.zutaten[0], id: 'speck', name: 'Speckwürfel' }] };
await t.click('#k-los');
check(await bis(async () => (await t.locator('#k-fehler').innerText().catch(() => '')).includes('das esst ihr nicht')), 'Speck im Rezept: Hinweis statt Rezept');
ki.z.antwort = ANTWORT;

// --- löschen und rückgängig
await t.click('[data-act="reste-zu"]');
await t.click('[data-filter="reste"]');
await t.click('#grid .box');
await t.click('[data-act="ki-loeschen"]');
check(await bis(() => !Object.keys(gh.liste()?.ki || {}).length && !Object.values(gh.liste().items).some((d) => d.parts?.[rid])), 'Löschen nimmt das Rezept und seine Zeilen auf der Liste weg');
await t.click('#toast button');
check(await bis(() => Object.keys(gh.liste()?.ki || {}).length === 1 && Object.values(gh.liste().items).filter((d) => d.parts?.[rid]).length === 4), 'Rückgängig bringt beides zurück');

check(await t.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'kein seitliches Scrollen');
for (const h of [tobi, amy]) check(h.fehler.length === 0, `keine Fehler in der Konsole${h.fehler.length ? `: ${h.fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
