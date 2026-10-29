/*
 * Rezept-Import für Amy: erst amy-import.js in Node (Link erkennen, die
 * Anfrage für Gemini und Claude, JSON aus der Antwort, Bereinigen), dann im
 * Browser mit einer nachgebauten Gemini-API – Text, Link, Foto, Rückgängig,
 * Abbrechen, Fehler, ohne Schlüssel, Claude-Schlüssel mit Link – und Speichern.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';
import { linkAus, rumpfImport, importSystem, jsonAus, importBereinigen, IMPORT_SCHEMA, WERKZEUG_IMPORT } from '../js/amy-import.js';
import { ANBIETER } from '../js/ki.js';

const { check, ende } = pruefer();

// --- Link erkennen
const CK = 'https://www.chefkoch.de/rezepte/1234567/shakshuka.html';
check(linkAus(CK) === CK && linkAus(`Das hier: ${CK}`) === CK && linkAus(`(${CK}).`) === CK, 'nur ein Link (auch mit ein paar Worten oder Satzzeichen drumherum)');
check(linkAus(`Shakshuka\n1 Dose Tomaten\n4 Eier\nZwiebel anschwitzen, Tomaten dazu, 10 Min. köcheln\nQuelle: ${CK}`) === '' && linkAus('Kein Link') === '', 'ein Rezepttext mit Quelle ist kein Link');

// --- Die Anfrage
const text = rumpfImport({ anbieter: 'gemini', text: 'Shakshuka\n1 Dose Tomaten', tags: ['Omas Küche'] });
check(text.model === ANBIETER.gemini.modell && text.store === false && text.stream === true && text.response_format?.schema === IMPORT_SCHEMA && !text.tools, 'Gemini mit Text: festes Schema, nichts gespeichert, Strom');
check(text.input.length === 1 && text.input[0].text === 'Das Rezept:\nShakshuka\n1 Dose Tomaten' && text.system_instruction.includes('Es kommt als Foto') && text.system_instruction.includes('Omas Küche, gesund'), 'der Text als Eingabe; Amys eigene Tags zuerst im Vorschlag');
const link = rumpfImport({ anbieter: 'gemini', text: CK });
check(JSON.stringify(link.tools) === JSON.stringify([{ type: 'url_context' }]) && !link.response_format && link.input[0].text === `Das Rezept steht hier: ${CK}` && link.system_instruction.includes('Lies dazu die Webseite') && link.system_instruction.includes('Antworte nur mit dem JSON'), 'Gemini mit Link: liest die Seite selbst (url_context), ohne Schema – nur JSON zurück');
const fotos = rumpfImport({ anbieter: 'gemini', fotos: ['AAAA', 'BBBB'] });
check(fotos.input.length === 3 && fotos.input[0].type === 'image' && fotos.input[0].mime_type === 'image/jpeg' && fotos.input[1].data === 'BBBB' && fotos.input[2].text === 'Das Rezept steht auf den 2 Fotos.', 'Gemini mit zwei Fotos: beide Bilder, dann der Satz');
const claude = rumpfImport({ anbieter: 'anthropic', text: 'Shakshuka', fotos: ['AAAA'] });
check(claude.model === ANBIETER.anthropic.modell && claude.tools[0].name === WERKZEUG_IMPORT && claude.tools[0].input_schema === IMPORT_SCHEMA && claude.tool_choice.name === WERKZEUG_IMPORT && claude.messages[0].content[0].source.data === 'AAAA' && claude.messages[0].content[1].text === 'Das Rezept:\nShakshuka' && claude.system.includes(`Werkzeug ${WERKZEUG_IMPORT}`), 'Claude: Werkzeug mit dem Schema, Foto und Text');
check(rumpfImport({ anbieter: 'anthropic', text: CK }).messages[0].content[0].text === `Das Rezept:\n${CK}`, 'Claude liest keine Links – der Link bleibt nur Text (die App sagt vorher Bescheid)');
check(importSystem({}).includes('cups, oz') && importSystem({}).includes('erfinde nichts dazu'), 'die Anweisung: nichts dazuerfinden, US-Maße umrechnen');

// --- Die Antwort
const R = { name: 'Shakshuka', portionen: 2, zeit: 25, zutaten: ['- 1 Dose Tomaten (400 g)', '• 4 Eier', '1 Zwiebel, gewürfelt', ''], schritte: ['Soße:', 'Zwiebel anschwitzen', 'Tomaten dazu, 10 Min. köcheln', 'Eier:', 'Eier hineinschlagen, 8 Min. stocken lassen'], notiz: 'Von Chefkoch', tags: ['schnell', 'vegetarisch', 'gesund', 'günstig'] };
check(jsonAus(JSON.stringify(R)).name === 'Shakshuka' && jsonAus(`\`\`\`json\n${JSON.stringify(R)}\n\`\`\``).name === 'Shakshuka' && jsonAus(`Hier ist das Rezept:\n${JSON.stringify(R)}\nGuten Appetit!`).name === 'Shakshuka' && jsonAus('Leider nein.') === null, 'JSON auch im Zaun oder mit Text drumherum');
const b = importBereinigen(R);
check(b.zutaten === '1 Dose Tomaten (400 g)\n4 Eier\n1 Zwiebel, gewürfelt' && b.schritte.split('\n').length === 5 && b.schritte.startsWith('Soße:'), `Zeilen ohne Spiegelstriche, Abschnitte bleiben (${JSON.stringify(b.zutaten)})`);
check(b.portionen === 2 && b.zeit === 25 && b.tags.join() === 'schnell,vegetarisch,gesund' && b.notiz === 'Von Chefkoch', 'Portionen, Zeit, höchstens drei Tags, Notiz');
const leer = importBereinigen({ name: 'X', zutaten: ['Mehl'], schritte: [], portionen: 0, zeit: 0 });
check(leer.portionen === 4 && leer.zeit === '' && importBereinigen({ zutaten: [], schritte: [], fehler: 'Auf dem Foto ist kein Rezept.' }).fehler === 'Auf dem Foto ist kein Rezept.' && importBereinigen(null).fehler, 'ohne Portionen: 4; kein Rezept: der Grund');

/* ================================================================ im Browser */

const GKEY = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
const CLAUDE = 'sk-ant-api03-TESTTESTTESTTESTTESTTESTTEST';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4UaEBRwzEcQBTUhaBGaoOzwAAAABJRU5ErkJggg==', 'base64');
const STROM = (json) => {
  const ev = (o) => `event: ${o.event_type}\r\ndata: ${JSON.stringify(o)}\r\n\r\n`;
  let s = ev({ event_type: 'interaction.created', interaction: { id: 'ia_1', status: 'in_progress' } });
  for (let i = 0; i < json.length; i += 200) s += ev({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: json.slice(i, i + 200) } });
  return s + ev({ event_type: 'interaction.completed', interaction: { id: 'ia_1', status: 'completed', usage: { total_input_tokens: 900, total_output_tokens: 400 } } });
};
const ki = { anfragen: [], antwort: JSON.stringify(R), verzoegerung: 0 };
const kiRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  ki.anfragen.push({ kopf: req.headers(), rumpf: JSON.parse(req.postData() || '{}') });
  if (ki.verzoegerung) await new Promise((f) => { setTimeout(f, ki.verzoegerung); });
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: STROM(ki.antwort) }).catch(() => {});
};

const gh = githubAttrappe();
const browser = await starteBrowser();
const amy = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
const p = amy.page;
await amy.ctx.route('https://generativelanguage.googleapis.com/**', kiRoute);
await p.fill('#z-name', 'Amy');
await p.click('#z-los');
check(await bis(async () => (await p.locator('#sync-text').innerText()) === 'Geteilt'), 'Amy: eingerichtet');
const schluessel = (k) => p.evaluate((x) => { if (x) localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: x })); else localStorage.removeItem('boxenstopp.ki.v1'); }, k);
await schluessel(GKEY);
await p.click('.tab[data-tab="amy"]');
await p.click('#view-amy [data-act="amy-neu"]');
check(await p.locator('#view-amy details.amy-import[open]').count() === 1, 'neues Rezept: „Rezept übernehmen“ ist gleich offen');
const feld = (id) => p.inputValue(`#${id}`);
const uebernehmen = async () => { await p.click('#view-amy [data-act="amy-import-los"]'); };

// Text
await p.fill('#amy-import-text', 'Shakshuka für 2\n1 Dose Tomaten\n4 Eier\n1 Zwiebel\nZwiebel anschwitzen …');
await uebernehmen();
check(await bis(async () => (await feld('amy-name')) === 'Shakshuka'), 'Text übernommen: der Name steht im Editor');
check((await feld('amy-zutaten')) === '1 Dose Tomaten (400 g)\n4 Eier\n1 Zwiebel, gewürfelt' && (await feld('amy-schritte')).split('\n')[0] === 'Soße:' && (await feld('amy-portionen')) === '2' && (await feld('amy-zeit')) === '25' && (await feld('amy-notiz')) === 'Von Chefkoch', 'Zutaten, Schritte, Portionen, Dauer und Notiz in den Feldern');
check(JSON.stringify(await p.$$eval('#amy-tags-wahl .amy-tags-dran li', (xs) => xs.map((x) => x.textContent.trim()))) === JSON.stringify(['schnell', 'vegetarisch', 'gesund']), 'die Tags sind dran');
check((await p.locator('#toast').innerText()).includes('Übernommen ♡'), 'Meldung: „Übernommen ♡ Schau drüber, dann speichern“');
const a1 = ki.anfragen.at(-1);
check(a1.kopf['x-goog-api-key'] === GKEY && a1.rumpf.response_format?.schema && !a1.rumpf.tools && a1.rumpf.input.at(-1).text.startsWith('Das Rezept:\nShakshuka für 2'), 'die Anfrage: Amys Text, mit Schema');
check(await p.locator('#view-amy details.amy-import[open]').count() === 0, 'danach ist „Rezept übernehmen“ zu');
await p.click('#toast button');
check(await bis(async () => (await feld('amy-name')) === '' && (await feld('amy-zutaten')) === ''), 'Rückgängig: der Editor ist wieder leer');

// Link – mit Text um das JSON (ohne Schema kommt das vor)
ki.antwort = `Hier ist das Rezept:\n\`\`\`json\n${JSON.stringify({ ...R, name: 'Shakshuka nach Chefkoch' })}\n\`\`\``;
await p.fill('#amy-import-text', CK);
await uebernehmen();
check(await bis(async () => (await feld('amy-name')) === 'Shakshuka nach Chefkoch'), 'Link übernommen');
const a2 = ki.anfragen.at(-1);
check(JSON.stringify(a2.rumpf.tools) === JSON.stringify([{ type: 'url_context' }]) && !a2.rumpf.response_format && a2.rumpf.input.at(-1).text === `Das Rezept steht hier: ${CK}`, 'die Anfrage: der Link, Gemini liest die Seite (url_context)');

// Foto
ki.antwort = JSON.stringify({ ...R, name: 'Omas Shakshuka' });
await p.click('#view-amy details.amy-import summary');
await p.setInputFiles('#amy-import-foto', { name: 'seite.png', mimeType: 'image/png', buffer: PNG });
check(await bis(async () => (await p.locator('#view-amy .amy-import-foto img').count()) === 1), 'Foto: als Vorschau da');
await uebernehmen();
check(await bis(async () => (await feld('amy-name')) === 'Omas Shakshuka'), 'Foto übernommen');
const bild = ki.anfragen.at(-1).rumpf.input.find((x) => x.type === 'image');
check(bild?.mime_type === 'image/jpeg' && bild.data.length > 100 && ki.anfragen.at(-1).rumpf.input.at(-1).text === 'Das Rezept steht auf dem Foto.', 'die Anfrage: das Foto als JPEG');
check(await p.locator('#view-amy .amy-import-foto').count() === 0, 'die Vorschau ist danach weg');

// Speichern – fürs gemeinsame Rezeptbuch
await p.click('#amy-speichern');
check(await bis(() => Object.values(gh.liste()?.amy || {}).some((x) => x.name === 'Omas Shakshuka' && x.zutaten.length === 3 && x.schritte[0] === 'Soße:' && x.portionen === 2), 8000), 'gespeichert: Omas Shakshuka mit drei Zutaten in liste.json');

// Kein Rezept zu erkennen
await p.click('#view-amy [data-act="amy-liste"]');
await p.click('#view-amy [data-act="amy-neu"]');
ki.antwort = JSON.stringify({ name: '', zutaten: [], schritte: [], fehler: 'Auf dem Foto ist kein Rezept zu sehen.' });
await p.fill('#amy-import-text', 'Mein Einkaufszettel');
await uebernehmen();
check(await bis(async () => (await p.locator('#amy-import-inhalt .zugang-fehler').innerText().catch(() => '')).includes('kein Rezept zu sehen')) && (await feld('amy-name')) === '', 'kein Rezept: der Grund, der Editor bleibt leer');

// Abbrechen
ki.antwort = JSON.stringify(R);
ki.verzoegerung = 4000;
await uebernehmen();
check(await bis(async () => (await p.locator('#amy-import-inhalt .amy-import-laeuft').count()) === 1), 'während die KI liest: „Die KI liest dein Rezept …“');
await p.click('#view-amy [data-act="amy-import-stopp"]');
check(await bis(async () => (await p.locator('#view-amy [data-act="amy-import-los"]').count()) === 1) && (await p.locator('#amy-import-inhalt .zugang-fehler').count()) === 0 && (await feld('amy-name')) === '', 'Abbrechen: zurück, ohne Fehler, nichts übernommen');
ki.verzoegerung = 0;

// Ohne Schlüssel, mit Claude-Schlüssel und Link
await schluessel('');
await uebernehmen();
check(await bis(async () => (await p.locator('#amy-import-inhalt .zugang-fehler').innerText().catch(() => '')).includes('KI-Schlüssel')) && await p.locator('#amy-import-inhalt [data-act="amy-import-einrichten"]').count() === 1, 'ohne Schlüssel: Hinweis mit „Schlüssel eintragen“');
await schluessel(CLAUDE);
const vorher = ki.anfragen.length;
await p.fill('#amy-import-text', CK);
await uebernehmen();
check(await bis(async () => (await p.locator('#amy-import-inhalt .zugang-fehler').innerText().catch(() => '')).includes('nur mit dem Google-Schlüssel')) && ki.anfragen.length === vorher, 'Claude-Schlüssel und Link: Hinweis, Text reinkopieren – keine Anfrage');
await p.fill('#amy-import-text', '');
await uebernehmen();
check(await bis(async () => (await p.locator('#amy-import-inhalt .zugang-fehler').innerText().catch(() => '')).includes('Mach ein Foto')), 'nichts eingegeben: „Mach ein Foto … oder füg einen Link oder den Text ein“');
check(amy.fehler.length === 0, `keine Fehler in der Konsole${amy.fehler.length ? `: ${amy.fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
check(readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("'./js/amy-import.js'"), 'amy-import.js ist offline dabei (sw.js)');
ende();
