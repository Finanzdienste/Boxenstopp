/*
 * Rezept-Import für Amy: erst amy-import.js in Node (Link erkennen, die
 * Anfrage für Gemini und Claude, JSON aus der Antwort, Bereinigen; die Suche
 * im Internet und Claude mit Werkzeugen samt pause_turn und Ausweichen), dann
 * im Browser mit nachgebauten APIs – Text, Link, Foto, Rückgängig, Abbrechen,
 * Fehler, ohne Schlüssel, Claude liest einen Link, „Im Internet suchen“ (ohne
 * Unverträgliches, Treffer nehmen, Rückgängig, Speichern mit Quelle) – und
 * mit Googles Schlüssel der Hinweis.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';
import { linkAus, rumpfImport, importSystem, jsonAus, importBereinigen, IMPORT_SCHEMA, rumpfSuche, sucheBereinigen, sucheText, notizMitQuelle, rumpfLinkClaude, sichereUrl, WEBSUCHE, SEITE_LESEN, MAX_TREFFER } from '../js/amy-import.js';
import { ANBIETER, kiMitWerkzeugen } from '../js/ki.js';
import { leer as leereListe } from '../js/liste.js';

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
check(claude.model === ANBIETER.anthropic.modell && claude.output_config.format.type === 'json_schema' && claude.output_config.format.schema.required.join() === IMPORT_SCHEMA.required.join() && claude.output_config.format.schema.additionalProperties === false && !claude.tools && claude.messages[0].content[0].source.data === 'AAAA' && claude.messages[0].content[1].text === 'Das Rezept:\nShakshuka' && claude.system.includes('Antworte nur mit dem JSON'), 'Claude: JSON nach dem Schema (Structured Outputs), Foto und Text');
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

// --- Im Internet suchen (nur Claude)
const su = rumpfSuche({ wunsch: 'Kürbissuppe', ohne: ['Zwiebel'], wenig: ['Knoblauch'], tags: ['Omas Küche'] });
check(su.model === ANBIETER.anthropic.modell && su.model === 'claude-opus-5-5' && !su.output_config && !su.stream && su.tools[0].type === 'web_search_20250305' && su.tools[0].user_location.country === 'DE' && su.tools[1].type === 'web_fetch_20250910' && su.tools[1].max_content_tokens > 0, 'Suche: Fable mit Websuche (Deutschland) und Seiten lesen, ohne festes Schema');
check(su.messages[0].content[0].text === 'Amys Wunsch: Kürbissuppe\nBitte ohne: Zwiebel (verträgt sie nicht).\nDavon nur wenig: Knoblauch.' && su.system.includes('erfinde nichts dazu') && su.system.includes('Nährwerte brauchst du nicht') && su.system.includes('Omas Küche') && su.system.includes('"rezepte"'), 'Wunsch, ohne und wenig – nur die Namen; nichts erfinden, keine Nährwerte, JSON am Schluss');
check(sucheText({ wunsch: '  Pasta  ' }) === 'Amys Wunsch: Pasta', 'ohne Unverträgliches: nur der Wunsch');
const lc = rumpfLinkClaude({ link: CK });
check(lc.tools.length === 1 && lc.tools[0].type === 'web_fetch_20250910' && lc.model === ANBIETER.anthropic.modell && lc.messages[0].content[0].text === `Das Rezept steht hier: ${CK}` && lc.system.includes('Lies dazu die Webseite'), 'Claude mit Link: liest die Seite selbst (web_fetch)');
const QUELLEN = [{ url: 'https://www.chefkoch.de/rezepte/1/kuerbissuppe.html' }, { url: 'https://www.lecker.de/kuerbissuppe-123.html?ref=x' }];
const T = (o = {}) => ({ name: 'Kürbissuppe', quelle: 'chefkoch.de', url: 'https://www.chefkoch.de/rezepte/1/kuerbissuppe.html', kurz: 'Cremig.', portionen: 4, zeit: 40, zutaten: ['1 Hokkaido', '1 Zwiebel'], schritte: ['Würfeln', '20 Min. köcheln'], notiz: 'Mit Kernen.', tags: ['schnell'], ...o });
const sb = sucheBereinigen({ rezepte: [T(), T({ name: 'Lecker-Suppe', quelle: '', url: 'https://lecker.de/kuerbissuppe-123.html/' }), T({ name: 'Ausgedacht', url: 'https://example.com/a' }), T({ name: 'Ohne Adresse', url: '' }), T({ name: 'Leer', zutaten: [], schritte: [] })] }, QUELLEN);
check(sb.rezepte.map((x) => x.name).join() === 'Kürbissuppe,Lecker-Suppe' && sb.rezepte[1].quelle === 'lecker.de' && sb.rezepte[0].zutaten === '1 Hokkaido\n1 Zwiebel' && sb.rezepte[0].kurz === 'Cremig.' && !sb.fehler, `Treffer nur mit einer Adresse aus der Suche (www., / und ?… egal), sonst ausgedacht; ohne Quelle die Seite (${sb.rezepte.map((x) => x.name).join()})`);
check(sucheBereinigen({ rezepte: [], fehler: 'Nichts gefunden.' }).fehler === 'Nichts gefunden.' && sucheBereinigen(null).rezepte.length === 0 && sucheBereinigen({ rezepte: Array.from({ length: 5 }, () => T()) }, QUELLEN).rezepte.length === MAX_TREFFER, 'nichts: der Grund; höchstens drei Treffer');
check(sichereUrl('javascript:alert(1)') === '' && sichereUrl('https://a.de/x') === 'https://a.de/x', 'nur http- und https-Adressen');
check(notizMitQuelle(sb.rezepte[0]) === 'Mit Kernen.\nVon chefkoch.de: https://www.chefkoch.de/rezepte/1/kuerbissuppe.html' && notizMitQuelle({ ...sb.rezepte[0], notiz: '' }).startsWith('Von chefkoch.de'), 'die Notiz: der Tipp und woher es ist');

// --- Claude mit Werkzeugen: ohne Strom, pause_turn, Ausweichen
{
  const echt = globalThis.fetch;
  const rufe = [];
  let antworten = [];
  globalThis.fetch = async (url, o) => {
    rufe.push({ url, kopf: o.headers, rumpf: JSON.parse(o.body) });
    const a = antworten.shift();
    return { ok: a.status === 200, status: a.status, json: async () => a.body };
  };
  const ERGEBNIS = { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://www.chefkoch.de/a', title: 'A', encrypted_content: 'geheim' }] };
  antworten = [
    { status: 200, body: { stop_reason: 'pause_turn', usage: { input_tokens: 100, output_tokens: 10, server_tool_use: { web_search_requests: 1 } }, content: [{ type: 'text', text: 'Ich suche.' }, { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'kürbissuppe' } }, ERGEBNIS] } },
    { status: 200, body: { stop_reason: 'end_turn', usage: { input_tokens: 200, output_tokens: 50, server_tool_use: { web_search_requests: 1 } }, content: [{ type: 'text', text: '{"rezepte": [' }, { type: 'text', text: '{"name":"A"}', citations: [{ type: 'web_search_result_location', url: 'https://www.chefkoch.de/a', cited_text: 'A' }] }, { type: 'text', text: ']}' }] } },
  ];
  const w = await kiMitWerkzeugen({ model: ANBIETER.anthropic.modell, max_tokens: 100, messages: [{ role: 'user', content: 'x' }], tools: [WEBSUCHE] }, { schluessel: 'sk-ant-test' });
  check(w.text === '{"rezepte": [{"name":"A"}]}' && w.quellen[0].url === 'https://www.chefkoch.de/a' && w.usage.suchen === 2 && w.usage.ein === 300, `mit Werkzeugen: der Text nach dem letzten Werkzeug, über die Blöcke zusammen; Quellen und Verbrauch (${w.text})`);
  check(rufe.length === 2 && rufe[1].rumpf.messages.length === 2 && rufe[1].rumpf.messages[1].role === 'assistant' && JSON.stringify(rufe[1].rumpf.messages[1].content[2]) === JSON.stringify(ERGEBNIS) && rufe[0].kopf['anthropic-dangerous-direct-browser-access'] === 'true' && rufe[0].kopf['x-api-key'] === 'sk-ant-test' && !rufe[0].rumpf.stream, 'pause_turn: die bisherige Antwort geht unverändert zurück (mit encrypted_content), ohne Strom');
  rufe.length = 0;
  antworten = [{ status: 400, body: { error: { type: 'invalid_request_error', message: 'tools.1: web_fetch_20250910 is not available' } } }, { status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] } }];
  await kiMitWerkzeugen({ model: ANBIETER.anthropic.modell, messages: [], tools: [WEBSUCHE, SEITE_LESEN(3)] }, { schluessel: 'k' });
  check(rufe.length === 2 && rufe[1].rumpf.tools.map((t) => t.name).join() === 'web_search,advisor', 'hakt nur das Lesen von Seiten: einmal nur mit der Suche (und dem Berater)');
  check(rufe[0].kopf['anthropic-beta'] === 'advisor-tool-2026-03-01' && rufe[0].rumpf.tools.at(-1).model === 'claude-fable-5-2' && rufe[0].rumpf.output_config.effort === 'medium', 'mit Werkzeugen: auch hier der Berater, Aufwand mittel');
  const fehlerVon = async (a, tools = [WEBSUCHE]) => { antworten = [a]; try { await kiMitWerkzeugen({ model: ANBIETER.anthropic.modell, messages: [], tools }, { schluessel: 'k' }); return ''; } catch (e) { return e.art; } };
  check(await fehlerVon({ status: 400, body: { error: { type: 'invalid_request_error', message: 'Web search is not enabled for this organization.' } } }) === 'websuche', 'Websuche in der Console aus: ein eigener Hinweis');
  check(await fehlerVon({ status: 400, body: { error: { type: 'invalid_request_error', message: 'web fetch is not enabled' } } }, [SEITE_LESEN(2)]) === 'websuche', 'nur Seiten lesen und das ist aus: kein Ausweichen ohne Werkzeug');
  check(await fehlerVon({ status: 200, body: { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] } }) === 'zulang' && await fehlerVon({ status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'server_tool_use', id: 'x' }] } }) === 'antwort', 'zu lang oder ohne Text: Fehler');
  globalThis.fetch = echt;
}

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
// Im Hintergrund fragt die App nach Werten für Unbekanntes (amy-werte.js, test-werte.mjs) – das zählt hier nicht mit
const werteFrage = (rumpf) => /Nährwerte und Preise von Zutaten/.test(String(rumpf.system_instruction || rumpf.system || ''));
const CLAUDE_STROM = (json) => {
  const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
  return ev({ type: 'message_start', message: { usage: { input_tokens: 300, output_tokens: 1 } } }) + ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
    + ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: json } }) + ev({ type: 'content_block_stop', index: 0 })
    + ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 20 } }) + ev({ type: 'message_stop' });
};
const kiRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  if (werteFrage(JSON.parse(req.postData() || '{}'))) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: STROM('{"zutaten":[]}') }).catch(() => {});
  ki.anfragen.push({ kopf: req.headers(), rumpf: JSON.parse(req.postData() || '{}') });
  if (ki.verzoegerung) await new Promise((f) => { setTimeout(f, ki.verzoegerung); });
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: STROM(ki.antwort) }).catch(() => {});
};

const gh = githubAttrappe();
// Amy verträgt keine Zwiebeln und nur wenig Knoblauch – für „Ohne, was ich nicht vertrage“
gh.zustand.datei = JSON.stringify({ ...leereListe(), rev: 1, vertraeglich: { amy: { 'n:zwiebel': { name: 'Zwiebel', stufe: 'nicht', notiz: '' }, 'n:knoblauch': { name: 'Knoblauch', stufe: 'wenig', notiz: '' } } } });
gh.zustand.sha = 'sha1';
// Claude ohne Strom (kiMitWerkzeugen): eine Antwort nach der anderen
const claudeKi = { anfragen: [], antworten: [] };
const claudeRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  if (werteFrage(JSON.parse(req.postData() || '{}'))) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: CLAUDE_STROM('{"zutaten":[]}') }).catch(() => {});
  claudeKi.anfragen.push({ kopf: req.headers(), rumpf: JSON.parse(req.postData() || '{}') });
  const a = claudeKi.antworten.shift() || { status: 500, body: { error: { type: 'api_error', message: 'keine Antwort vorbereitet' } } };
  if (a.warten) await new Promise((f) => { setTimeout(f, a.warten); });
  return r.fulfill({ status: a.status || 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(a.body) }).catch(() => {});
};
const browser = await starteBrowser();
const amy = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
const p = amy.page;
await amy.ctx.route('https://generativelanguage.googleapis.com/**', kiRoute);
await amy.ctx.route('https://api.anthropic.com/**', claudeRoute);
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
// Claude-Schlüssel und Link: Claude liest die Seite selbst (web_fetch), ohne Strom
claudeKi.antworten.push({ body: { stop_reason: 'end_turn', content: [
  { type: 'server_tool_use', id: 'f1', name: 'web_fetch', input: { url: CK } },
  { type: 'web_fetch_tool_result', tool_use_id: 'f1', content: { type: 'web_fetch_result', url: CK, content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'Shakshuka …' } } } },
  { type: 'text', text: JSON.stringify({ ...R, name: 'Shakshuka von Claude' }) },
] } });
await p.fill('#amy-import-text', CK);
await uebernehmen();
check(await bis(async () => (await feld('amy-name')) === 'Shakshuka von Claude'), 'Claude-Schlüssel und Link: Claude liest die Seite, der Editor ist gefüllt');
const c1 = claudeKi.anfragen.at(-1);
check(c1?.kopf['x-api-key'] === CLAUDE && c1.rumpf.tools?.[0]?.type === 'web_fetch_20250910' && c1.rumpf.tools.at(-1).type === 'advisor_20260301' && !c1.rumpf.stream && !c1.rumpf.output_config?.format && c1.rumpf.output_config?.effort === 'medium' && c1.rumpf.messages[0].content[0].text === `Das Rezept steht hier: ${CK}`, 'die Anfrage: der Link, web_fetch (und der Berater), ohne Strom und ohne Schema');
await p.click('#view-amy details.amy-import summary');
await p.fill('#amy-import-text', '');
await uebernehmen();
check(await bis(async () => (await p.locator('#amy-import-inhalt .zugang-fehler').innerText().catch(() => '')).includes('Mach ein Foto')), 'nichts eingegeben: „Mach ein Foto … oder füg einen Link oder den Text ein“');

// --- Im Internet suchen
const TREFFER = [
  { name: 'Cremige Kürbissuppe', quelle: 'chefkoch.de', url: 'https://www.chefkoch.de/rezepte/1/kuerbissuppe.html', kurz: 'Mit Kokosmilch, in 40 Minuten.', portionen: 4, zeit: 40, zutaten: ['1 Hokkaido (1 kg)', '1 Zwiebel', '400 ml Kokosmilch'], schritte: ['Kürbis würfeln', '20 Min. köcheln', 'Pürieren'], notiz: 'Mit gerösteten Kernen.', tags: ['schnell'] },
  { name: 'Kürbissuppe mit Ingwer', quelle: 'lecker.de', url: 'https://www.lecker.de/kuerbissuppe-123.html', kurz: 'Leicht scharf.', portionen: 2, zeit: 30, zutaten: ['500 g Kürbis', '1 Stück Ingwer', '500 ml Gemüsebrühe'], schritte: ['Kürbis würfeln', '15 Min. köcheln'], notiz: '', tags: ['vegetarisch'] },
  { name: 'Ausgedacht', quelle: 'beispiel.de', url: 'https://beispiel.de/x', kurz: '', portionen: 4, zeit: 0, zutaten: ['1 Kürbis'], schritte: ['Kochen'], notiz: '', tags: [] },
];
const SUCH_ERGEBNIS = { type: 'web_search_tool_result', tool_use_id: 's1', content: TREFFER.slice(0, 2).map((t) => ({ type: 'web_search_result', url: t.url, title: t.name, encrypted_content: 'geheim', page_age: null })) };
const fertigeSuche = (rezepte = TREFFER) => {
  const json = JSON.stringify({ rezepte, fehler: '' });
  return { body: { stop_reason: 'end_turn', usage: { input_tokens: 5000, output_tokens: 900, server_tool_use: { web_search_requests: 1 } }, content: [
    { type: 'text', text: 'Ich suche passende Rezepte.' },
    { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'Kürbissuppe Kokosmilch Rezept' } },
    SUCH_ERGEBNIS,
    { type: 'text', text: json.slice(0, 60) },
    { type: 'text', text: json.slice(60), citations: [{ type: 'web_search_result_location', url: TREFFER[0].url, title: 'Kürbissuppe', cited_text: '1 Hokkaido' }] },
  ] } };
};
await p.locator('#view-amy [data-act="amy-abbrechen"]').first().click();
await p.click('#view-amy [data-act="amy-neu"]');
check(await p.locator('#view-amy details.amy-suche').count() === 1 && await p.locator('#view-amy details.amy-suche[open]').count() === 0 && await p.locator('#view-amy details.amy-import[open]').count() === 1, 'neues Rezept: oben „Im Internet suchen“ (zu), darunter „Rezept übernehmen“ (offen)');
await p.click('#view-amy details.amy-suche summary');
check(await p.locator('#amy-suche-ohne').isChecked() && (await p.locator('.amy-suche-ohne').innerText()).includes('Ohne, was ich nicht vertrage') && (await p.locator('.amy-suche-ohne').innerText()).includes('Zwiebel, Knoblauch'), '„Ohne, was ich nicht vertrage“ – mit ihren Einträgen, gleich an');
claudeKi.antworten.push({ ...fertigeSuche(), warten: 600 });
await p.fill('#amy-suche-text', 'Kürbissuppe mit Kokosmilch');
await p.press('#amy-suche-text', 'Enter');
check(await bis(async () => (await p.locator('#amy-suche-inhalt .amy-import-laeuft').count()) === 1), 'Enter sucht: „Die KI sucht im Internet …“');
check(await bis(async () => (await p.locator('#amy-suche-inhalt .amy-treffer-k').count()) === 2), 'zwei Treffer – der ausgedachte ohne Adresse aus der Suche bleibt weg');
check((await p.locator('#amy-fehler').isHidden()) && !Object.values(gh.liste()?.amy || {}).some((x) => x.name === ''), 'Enter im Suchfeld speichert nicht das Rezept');
const s1 = claudeKi.anfragen.at(-1).rumpf;
check(s1.model === 'claude-opus-5-5' && s1.tools.map((t) => t.type).join() === 'web_search_20250305,web_fetch_20250910,advisor_20260301' && s1.messages[0].content[0].text === 'Amys Wunsch: Kürbissuppe mit Kokosmilch\nBitte ohne: Zwiebel (verträgt sie nicht).\nDavon nur wenig: Knoblauch.', 'die Anfrage: ihr Wunsch, ohne Zwiebel, wenig Knoblauch – Websuche, Seiten lesen und Berater');
const karten = p.locator('#amy-suche-inhalt .amy-treffer-k');
check((await karten.nth(0).innerText()).includes('Cremige Kürbissuppe') && (await karten.nth(0).innerText()).includes('chefkoch.de · 40 Min. · 4 Portionen') && (await karten.nth(0).locator('.amy-treffer-vt.vt-nicht').innerText()).includes('Geht nicht für dich: Zwiebel'), 'der erste: Name, Seite, Zeit, Portionen – und „✗ Geht nicht für dich: Zwiebel“');
check(await karten.nth(1).locator('.amy-treffer-vt').count() === 0 && await karten.nth(1).locator('a.linkbtn').getAttribute('href') === TREFFER[1].url && await karten.nth(1).locator('a.linkbtn').getAttribute('target') === '_blank' && (await karten.nth(1).locator('a.linkbtn').getAttribute('rel')).includes('noopener'), 'der zweite passt; „Seite ansehen“ öffnet das Original');
await karten.nth(1).locator('[data-amy-treffer]').click();
check(await bis(async () => (await feld('amy-name')) === 'Kürbissuppe mit Ingwer'), '„Nehmen“: der Treffer steht im Editor');
check((await feld('amy-zutaten')) === '500 g Kürbis\n1 Stück Ingwer\n500 ml Gemüsebrühe' && (await feld('amy-schritte')) === 'Kürbis würfeln\n15 Min. köcheln' && (await feld('amy-portionen')) === '2' && (await feld('amy-zeit')) === '30' && (await feld('amy-notiz')) === `Von lecker.de: ${TREFFER[1].url}`, 'Zutaten, Schritte, Portionen, Zeit – und die Quelle in der Notiz');
check(await p.locator('#view-amy details.amy-suche[open]').count() === 1 && (await p.locator('#amy-suche-inhalt .amy-treffer-k').nth(1).innerText()).includes('Steht im Editor') && (await p.inputValue('#amy-suche-text')) === 'Kürbissuppe mit Kokosmilch', 'die Suche bleibt offen, der genommene ist markiert, der Wunsch steht noch da');
await p.click('#toast button');
check(await bis(async () => (await feld('amy-name')) === '' && (await p.locator('#amy-suche-inhalt .amy-treffer-k').nth(1).innerText()).includes('Nehmen')), 'Rückgängig: der Editor ist wieder leer');
// Ohne den Haken: nichts über Unverträgliches in der Anfrage – und gemerkt; die Suche unterbricht der Server einmal (pause_turn)
await p.uncheck('#amy-suche-ohne');
check(await p.evaluate(() => localStorage.getItem('boxenstopp.suche-ohne.v1')) === 'false', 'den Haken merkt sich das Gerät');
claudeKi.antworten.push({ body: { stop_reason: 'pause_turn', usage: { input_tokens: 3000, output_tokens: 100 }, content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'Kürbissuppe' } }, SUCH_ERGEBNIS] } });
const weiter = fertigeSuche([TREFFER[0]]);
weiter.body.content = weiter.body.content.slice(3);
claudeKi.antworten.push(weiter);
const vorSuche = claudeKi.anfragen.length;
await p.click('#amy-suche-inhalt [data-act="amy-suche-los"]');
check(await bis(async () => (await p.locator('#amy-suche-inhalt .amy-treffer-k').count()) === 1), 'unterbrochen und weiter: ein Treffer');
const [s2, s3] = claudeKi.anfragen.slice(vorSuche).map((x) => x.rumpf);
check(s2.messages[0].content[0].text === 'Amys Wunsch: Kürbissuppe mit Kokosmilch' && s3.messages.length === 2 && s3.messages[1].role === 'assistant' && s3.messages[1].content[1].content[0].encrypted_content === 'geheim', 'ohne Haken nur der Wunsch; nach pause_turn geht die Antwort unverändert zurück');
// Speichern: mit der Quelle in der Notiz
await p.locator('#amy-suche-inhalt [data-amy-treffer="0"]').click();
check(await bis(async () => (await feld('amy-name')) === 'Cremige Kürbissuppe'), 'genommen');
await p.click('#amy-speichern');
check(await bis(() => Object.values(gh.liste()?.amy || {}).some((x) => x.name === 'Cremige Kürbissuppe' && x.zutaten.length === 3 && x.notiz === `Mit gerösteten Kernen.\nVon chefkoch.de: ${TREFFER[0].url}`), 8000), 'gespeichert – die Quelle steht in der Notiz');
// Fehler und Abbrechen
await p.click('#view-amy [data-act="amy-liste"]');
await p.click('#view-amy [data-act="amy-neu"]');
check(await p.locator('#view-amy details.amy-suche[open]').count() === 0 && await p.locator('#amy-suche-inhalt .amy-treffer-k').count() === 0, 'das nächste neue Rezept: die Suche von vorher ist weg');
await p.click('#view-amy details.amy-suche summary');
await p.click('#amy-suche-inhalt [data-act="amy-suche-los"]');
check(await bis(async () => (await p.locator('#amy-suche-inhalt .zugang-fehler').innerText().catch(() => '')).includes('worauf du Lust hast')), 'ohne Wunsch: „Schreib kurz, worauf du Lust hast“');
claudeKi.antworten.push({ status: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'Web search is not enabled for this organization.' } } });
await p.fill('#amy-suche-text', 'Pasta');
await p.click('#amy-suche-inhalt [data-act="amy-suche-los"]');
check(await bis(async () => (await p.locator('#amy-suche-inhalt .zugang-fehler').innerText().catch(() => '')).includes('Websuche')), 'Websuche bei Anthropic aus: sagt, wo man sie einschaltet');
claudeKi.antworten.push({ ...fertigeSuche(), warten: 4000 });
await p.click('#amy-suche-inhalt [data-act="amy-suche-los"]');
check(await bis(async () => (await p.locator('#amy-suche-inhalt [data-act="amy-suche-stopp"]').count()) === 1), 'während der Suche: Abbrechen');
await p.click('#amy-suche-inhalt [data-act="amy-suche-stopp"]');
check(await bis(async () => (await p.locator('#amy-suche-inhalt [data-act="amy-suche-los"]').count()) === 1) && await p.locator('#amy-suche-inhalt .zugang-fehler').count() === 0 && await p.locator('#amy-suche-inhalt .amy-treffer-k').count() === 0, 'abgebrochen: ohne Fehler, ohne Treffer');
// Mit Googles Schlüssel: der Hinweis statt der Suche
await schluessel(GKEY);
await p.locator('#view-amy [data-act="amy-abbrechen"]').first().click();
await p.click('#view-amy [data-act="amy-neu"]');
await p.click('#view-amy details.amy-suche summary');
check((await p.locator('#amy-suche-inhalt').innerText()).includes('mit dem Claude-Schlüssel') && await p.locator('#amy-suche-text').count() === 0, 'Google-Schlüssel: „Im Internet sucht die App mit dem Claude-Schlüssel“');

check(amy.fehler.length === 0, `keine Fehler in der Konsole${amy.fehler.length ? `: ${amy.fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
check(readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("'./js/amy-import.js'"), 'amy-import.js ist offline dabei (sw.js)');
ende();
