/*
 * Speisekarte: Anfrage und Rechnung (js/speisekarte.js, direkt in Node) und
 * im Browser – PDF wählen, die KI (nachgebaut) liest, die App zeigt das
 * Gericht, das dem Ziel am nächsten kommt; gemerkt nach dem Neuladen; ein
 * anderes Ziel sortiert neu; ohne KI-Schlüssel erst einrichten. Dazu die
 * Veranstaltung: Claude sucht (nachgebaut, mit Such-Ergebnissen), was
 * „laut Seite“ zählt, braucht eine Adresse aus der Suche; Bilder aus
 * Wikipedia (nachgebaut, WIKI_HOSTS) und das Bild der Seite (nachgebaute
 * Funktion produkt-bild); mit Gemini ohne Suche, alles geschätzt.
 */
import { readFileSync } from 'node:fs';
import { pruefer, handy, githubAttrappe, starteBrowser, bis, SCHLUESSEL, ROOT, FUNKTIONEN, WIKI_HOSTS } from './hilfe.mjs';
import {
  rumpfKarte, karteSystem, karteBereinigen, sortieren, bewerten, KARTE_SCHEMA,
  veranstaltungSystem, rumpfVeranstaltung, veranstaltungBereinigen, VERANSTALTUNG_SCHEMA, tagText, quellenVon, wikiTitel, wikiAdresse, wikiBilderAus, symbolFuer,
} from '../js/speisekarte.js';
import { ANBIETER } from '../js/ki.js';
import { KENNUNG } from '../js/inventar-netz.js';

const { check, ende } = pruefer();
const GKEY = 'AQ.Ab8RN6TESTTESTTESTTESTTESTTESTTEST';
const ZIEL = { kcal: 443, p: 33, kh: 39, f: 15.4 };

const KARTE = {
  restaurant: 'Brauhaus am Hafen',
  gerichte: [
    { name: 'Brauhaussalat mit Backhendl', art: 'salat', preis: '24,50 €', was: 'Blattsalate, Backhendl, Remoulade, Joghurtdressing', portion: 'ca. 400 g', kcal: 690, p: 38, kh: 30, f: 46, sicher: 'mittel', enthaelt: [], tipp: 'Remoulade weglassen, Joghurtdressing', mit_tipp: { kcal: 540, p: 37, kh: 28, f: 30 } },
    { name: 'Hamburger Labskaus', art: 'hauptgang', preis: '23,00 €', was: 'Rinderbrust, Kartoffeln, Rote Bete, Hering', kcal: 700, p: 38, kh: 50, f: 36, sicher: 'grob', enthaelt: ['fisch'] },
    { name: 'Zwiebelrostbraten mit Spätzle', art: 'hauptgang', was: 'Rostbraten, Bierjus, Spätzle, Röstzwiebeln', kcal: 1100, p: 65, kh: 90, f: 55, sicher: 'mittel', enthaelt: [] },
    { name: 'Kräuter-Käsespätzle', art: 'hauptgang', was: 'Bergkäse, Röstzwiebeln', kcal: 1050, p: 35, kh: 95, f: 58, sicher: 'mittel', enthaelt: [] },
    { name: 'Schweineschnitzel Wiener Art', art: 'hauptgang', was: 'mit Pommes', kcal: 950, p: 50, kh: 60, f: 55, sicher: 'mittel', enthaelt: ['schwein', 'quatsch'] },
    { name: 'Apfelstrudel', art: 'dessert', was: 'Vanilleeis, Sahne', kcal: 480, p: 6, kh: 60, f: 20, sicher: 'mittel', enthaelt: [] },
    { name: 'Kürbiscremesuppe', art: 'suppe', was: 'Kerne, Kürbiskernöl', kcal: 320, p: 6, kh: 25, f: 22, sicher: 'mittel', enthaelt: [] },
    { name: 'Kürbiscremesuppe', art: 'suppe', kcal: 300, p: 5, kh: 20, f: 20, sicher: 'gut', enthaelt: [] },
    { name: '', art: 'hauptgang', kcal: 500, p: 20, kh: 20, f: 20, sicher: 'gut', enthaelt: [] },
    { name: 'Wasser', art: 'hauptgang', kcal: -5, p: 0, kh: 0, f: 0, sicher: 'gut', enthaelt: [] },
  ],
};

/** Eine Veranstaltung, wie Claude sie schickt (erfunden): zwei Stände mit Seite – eine davon ausgedacht –, Gerichte von der Seite und geschätzte. */
const SEITE = 'https://www.seemannskirche.example/basar-2026';
const VA = {
  gefunden: true,
  veranstaltung: { name: 'God Jul – Weihnachtsbasar der Seemannskirche', ort: 'Hamburg, Ditmar-Koel-Straße', wann: 'So., 15.11., 11–17 Uhr', url: SEITE, seite: 'seemannskirche.example' },
  staende: [
    { name: 'Waffelstand', was: 'Waffeln, Kaffee', quelle: 'seite', url: SEITE },
    { name: 'Hotdog-Stand', was: 'Pølse im Brötchen', quelle: 'seite', url: 'https://ausgedacht.example/hotdog' },
    { name: 'Glögg', was: 'Glögg mit Mandeln und Rosinen', quelle: 'typisch' },
  ],
  gerichte: [
    { name: 'Waffel mit Marmelade und Sahne', stand: 'Waffelstand', art: 'dessert', preis: '3,50 €', was: 'Herzwaffel', kcal: 420, p: 7, kh: 50, f: 21, sicher: 'mittel', enthaelt: [], quelle: 'seite', url: SEITE, wiki: 'Waffel' },
    { name: 'Köttbullar mit Kartoffelpüree', stand: 'Kirchenküche', art: 'hauptgang', was: 'Preiselbeeren, Rahmsauce', kcal: 650, p: 30, kh: 50, f: 36, sicher: 'mittel', enthaelt: ['schwein'], quelle: 'typisch', wiki: 'Köttbullar' },
    { name: 'Hähnchen-Wrap mit Krautsalat', stand: 'Kirchenküche', art: 'hauptgang', was: 'Joghurtsauce', kcal: 480, p: 34, kh: 42, f: 17, sicher: 'mittel', enthaelt: [], quelle: 'seite', url: 'https://ausgedacht.example/wrap', wiki: 'Wrap (Speise)' },
    { name: 'Smørrebrød mit Krabben', stand: 'Smørrebrød', art: 'snack', kcal: 350, p: 16, kh: 28, f: 19, sicher: 'mittel', enthaelt: ['fisch'], quelle: 'typisch', wiki: 'Smørrebrød' },
    { name: 'Waffel mit Marmelade und Sahne', stand: 'Kirchencafé', art: 'dessert', kcal: 420, p: 7, kh: 50, f: 21, sicher: 'mittel', enthaelt: [], quelle: 'typisch', wiki: 'Waffel' },
  ],
  hinweis: '',
};
const QUELLEN = [{ url: 'https://seemannskirche.example/basar-2026', titel: 'Basar 2026' }, { url: 'https://zeitung.example/basar', titel: 'Bericht' }];

/* ----------------------------------------------------------- Anfrage */

const sys = karteSystem({ ziel: ZIEL, wer: 'Tobi' });
check(sys.includes('443 kcal, 33 g Protein, 39 g Kohlenhydrate, 15,4 g Fett') && /mehr Fett als zu Hause/.test(sys) && /fisch/.test(sys) && /Schwein und Hüttenkäse sind kein Problem/.test(sys), 'System: Ziel, ehrliche Restaurant-Portionen, Fisch markieren – Schwein nicht');
const g1 = rumpfKarte({ anbieter: 'gemini', ziel: ZIEL, wer: 'Tobi', pdf: 'UERG', fotos: [] });
check(g1.input[0].type === 'document' && g1.input[0].mime_type === 'application/pdf' && g1.input[0].data === 'UERG' && g1.response_format?.schema === KARTE_SCHEMA && g1.store === false && g1.stream === true, 'Gemini mit PDF: document mit application/pdf, Schema, nicht gespeichert, gestreamt');
const g2 = rumpfKarte({ anbieter: 'gemini', ziel: ZIEL, fotos: ['AAA', 'BBB'] });
check(g2.input.filter((x) => x.type === 'image' && x.mime_type === 'image/jpeg').length === 2 && /2 Fotos/.test(g2.input.at(-1).text), 'Gemini mit Fotos: zwei Bilder');
const g3 = rumpfKarte({ anbieter: 'gemini', ziel: ZIEL, text: 'https://brauhaus.example/karte' });
check(g3.tools?.[0]?.type === 'url_context' && !g3.response_format && /brauhaus\.example/.test(g3.input.at(-1).text), 'Gemini mit Link: url_context, ohne festes Schema');
const a1 = rumpfKarte({ anbieter: 'anthropic', ziel: ZIEL, pdf: 'UERG' });
check(a1.messages[0].content[0].type === 'document' && a1.messages[0].content[0].source.media_type === 'application/pdf' && a1.output_config.format.type === 'json_schema' && a1.output_config.format.schema.required.includes('gerichte') && !a1.tools, 'Claude mit PDF: document-Block, JSON nach dem Schema');

/* ------------------------------------------------------------ Rechnung */

const b = karteBereinigen(KARTE);
check(b.restaurant === 'Brauhaus am Hafen' && b.gerichte.length === 7, `Bereinigen: ohne Namen, mit unsinnigen Werten und doppelt fällt weg (${b.gerichte.length})`);
check(b.gerichte.find((g) => g.name.startsWith('Schweine')).enthaelt.join() === '', 'Bereinigen: nur bekannte Markierungen – „schwein“ ist keine mehr');
check(b.gerichte[0].mitTipp?.kcal === 540 && !b.gerichte[2].mitTipp, 'Bereinigen: Werte mit Tipp nur, wenn es einen Tipp gibt');
check(karteBereinigen({ gerichte: [] }).fehler && karteBereinigen(null).fehler, 'Keine Gerichte: ein Satz statt eines Ergebnisses');
const be = bewerten(b.gerichte[0], ZIEL);
check(be.tipp && be.werte.kcal === 540 && be.abweichung.kcal === 97, 'Bewerten: mit dem Tipp ist es näher dran');
const s = sortieren(b.gerichte, ZIEL);
check(s.oben[0].g.name === 'Brauhaussalat mit Backhendl', `Am nächsten: der Salat (${s.oben[0].g.name})`);
check(!s.oben.some((x) => x.g.art === 'dessert') && s.rest.some((x) => x.g.art === 'dessert'), 'Desserts stehen nicht oben');
check(s.ohne.map((x) => x.g.name).join() === 'Hamburger Labskaus' && !s.oben.some((x) => x.g.enthaelt.length) && [...s.oben, ...s.rest].some((x) => x.g.name.startsWith('Schweine')), 'Fisch für sich, nicht oben – das Schweineschnitzel ganz normal');
const viel = sortieren(b.gerichte, { kcal: 1100, p: 65, kh: 90, f: 50 });
check(viel.oben[0].g.name === 'Zwiebelrostbraten mit Spätzle', 'Anderes Ziel, andere Reihenfolge');

/* ============================================================ Browser */

const STROM = (json) => {
  const ev = (o) => `event: ${o.event_type}\r\ndata: ${JSON.stringify(o)}\r\n\r\n`;
  let t = ev({ event_type: 'interaction.created', interaction: { id: 'ia_1', status: 'in_progress' } });
  for (let i = 0; i < json.length; i += 300) t += ev({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: json.slice(i, i + 300) } });
  return t + ev({ event_type: 'interaction.completed', interaction: { id: 'ia_1', status: 'completed', usage: { total_input_tokens: 900, total_output_tokens: 400 } } });
};
const anfragen = [];
const kiRoute = async (r) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  const rumpf = JSON.parse(r.request().postData() || '{}');
  anfragen.push(rumpf);
  const fuerVa = /zu einer Veranstaltung/.test(rumpf.system_instruction || '');
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: STROM(JSON.stringify(fuerVa ? VA : KARTE)) });
};
// Claude mit der Websuche (nachgebaut): ein Suchergebnis mit der Seite der Veranstaltung, dann das JSON
const claude = { anfragen: [] };
const claudeRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  claude.anfragen.push(JSON.parse(req.postData() || '{}'));
  const antwort = {
    id: 'msg_1', type: 'message', role: 'assistant', model: ANBIETER.anthropic.modell, stop_reason: 'end_turn',
    usage: { input_tokens: 4000, output_tokens: 900, server_tool_use: { web_search_requests: 2 } },
    content: [
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'God Jul Seemannskirche 2026' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: QUELLEN.map((q) => ({ type: 'web_search_result', url: q.url, title: q.titel, encrypted_content: 'e' })) },
      { type: 'text', text: JSON.stringify(VA) },
    ],
  };
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(antwort) });
};
// Wikipedia (nachgebaut): die Bilder zu den Titeln – und die Bilder selbst
const BILD_ROH = readFileSync(`${ROOT}/icon-192.png`);
const wiki = { anfragen: [], bilder: 0 };
const wikiRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'api-user-agent', 'access-control-allow-methods': 'GET, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  if (/upload\.wikimedia\.org/.test(req.url())) { wiki.bilder++; return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: BILD_ROH }); }
  wiki.anfragen.push({ url: req.url(), kopf: req.headers() });
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(WIKI_ANTWORT) });
};
// Die Supabase-Funktion produkt-bild (das Bild der Seite der Veranstaltung)
const shop = { anfragen: [] };
const shopRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-schluessel-hash', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  shop.anfragen.push(JSON.parse(req.postData() || '{}'));
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: BILD_ROH });
};
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

/* ------------------------------------------------------ Veranstaltung */

const TAG = tagText('2026-11-15');
check(TAG === 'Sonntag, 15. November 2026' && tagText('kaputt') === '', 'Der Tag für die KI: „Sonntag, 15. November 2026“');
const vsys = veranstaltungSystem({ ziel: ZIEL, wer: 'Tobi', tag: TAG });
check(vsys.includes('am Sonntag, 15. November 2026') && vsys.includes('443 kcal, 33 g Protein') && /Websuche/.test(vsys) && /„typisch“/.test(vsys) && /Wikipedia/.test(vsys) && /Schwein und Hüttenkäse sind kein Problem/.test(vsys) && /Nichts als „seite“ ausgeben, was nicht auf einer Seite stand/.test(vsys), 'System Veranstaltung: Tag, Ziel, suchen, sonst „typisch“, Wikipedia-Titel, Schwein markieren, nichts erfinden');
check(/nicht im Netz nachsehen/.test(veranstaltungSystem({ ziel: ZIEL, suchen: false })), 'Ohne Suche (Gemini): schätzen, was es dort meistens gibt');
const va1 = rumpfVeranstaltung({ anbieter: 'anthropic', ziel: ZIEL, wer: 'Tobi', was: '  God Jul Seemannskirche  ', tag: TAG });
check(va1.model === ANBIETER.anthropic.modell && va1.tools.map((t) => t.type).join() === 'web_search_20250305,web_fetch_20250910' && va1.tools[0].max_uses === 6 && va1.tools[0].user_location?.country === 'DE' && va1.messages[0].content[0].text === 'Die Veranstaltung: God Jul Seemannskirche\nWann: Sonntag, 15. November 2026', 'Claude: Websuche (6) und Seiten lesen, in der Frage nur die Veranstaltung und der Tag');
const va2 = rumpfVeranstaltung({ anbieter: 'gemini', ziel: ZIEL, was: 'God Jul', tag: TAG });
check(!va2.tools && va2.response_format?.schema === VERANSTALTUNG_SCHEMA && va2.store === false && /nicht im Netz nachsehen/.test(va2.system_instruction), 'Gemini: ohne Werkzeuge (keine Google-Suche), festes Schema, nicht gespeichert');
const vb = veranstaltungBereinigen(JSON.parse(JSON.stringify(VA)), { quellen: QUELLEN });
const st = Object.fromEntries(vb.staende.map((x) => [x.name, x]));
check(vb.art === 'veranstaltung' && vb.gefunden && vb.veranstaltung.url === SEITE && vb.veranstaltung.seite === 'seemannskirche.example', 'Bereinigt: die Seite der Veranstaltung kam in der Suche vor – gefunden');
check(st.Waffelstand?.quelle === 'seite' && st['Hotdog-Stand']?.quelle === 'typisch' && !st['Hotdog-Stand'].url && st.Glögg?.quelle === 'typisch', 'Ein Stand mit ausgedachter Adresse zählt nicht als „laut Seite“');
check(vb.staende.map((x) => x.name).join() === 'Waffelstand,Hotdog-Stand,Glögg,Kirchenküche,Smørrebrød,Kirchencafé', `Stände, die nur an Gerichten stehen, kommen dazu (${vb.staende.map((x) => x.name).join()})`);
const wrap = vb.gerichte.find((g) => g.name.startsWith('Hähnchen'));
check(wrap.quelle === 'typisch' && !wrap.url && vb.gerichte[0].quelle === 'seite' && vb.gerichte[0].url === SEITE && vb.gerichte[0].wiki === 'Waffel' && vb.gerichte[0].stand === 'Waffelstand', 'Gerichte: Adresse aus der Suche „laut Seite“, ausgedacht „vermutlich“; Stand und Wikipedia-Titel bleiben');
check(vb.gerichte.filter((g) => g.name === 'Waffel mit Marmelade und Sahne').length === 2, 'Dasselbe Gericht an zwei Ständen bleibt zweimal');
check(sortieren(vb.gerichte, ZIEL).oben[0].g.name === 'Hähnchen-Wrap mit Krautsalat' && sortieren(vb.gerichte, ZIEL).ohne.map((x) => x.g.name).join() === 'Smørrebrød mit Krabben', 'Sortiert wie bei der Karte: der Wrap vorn, Smørrebrød (Krabben) für sich, Köttbullar normal');
check(JSON.stringify(quellenVon(vb)) === JSON.stringify([{ host: 'seemannskirche.example', url: SEITE }]), 'Gefunden auf: nur die Websites, die belegt sind, je einmal');
const vg = veranstaltungBereinigen(JSON.parse(JSON.stringify(VA)), { quellen: [] });
check(!vg.gefunden && !vg.veranstaltung.url && vg.staende.every((x) => x.quelle === 'typisch') && vg.gerichte.every((g) => g.quelle === 'typisch' && !g.url), 'Ohne Suche (Gemini): nichts belegt – alles „vermutlich“, keine Adresse');
const zurueck = veranstaltungBereinigen(JSON.parse(JSON.stringify(vb)));
check(JSON.stringify(zurueck.gerichte) === JSON.stringify(vb.gerichte) && zurueck.gefunden && zurueck.veranstaltung.url === SEITE, 'Was das Gerät gemerkt hat, kommt so zurück');
check(veranstaltungBereinigen({ veranstaltung: { name: 'X' }, gerichte: [] }).fehler === 'Zu der Veranstaltung kam kein Gericht heraus.', 'Ohne Gerichte: ein Fehler');
// Bilder aus Wikipedia
const titel = wikiTitel(vb.gerichte);
check(titel.join() === 'Waffel,Köttbullar,Wrap (Speise),Smørrebrød', 'Wikipedia: je Titel einmal');
const wu = new URL(wikiAdresse(titel));
check(wu.origin === 'https://de.wikipedia.org' && wu.searchParams.get('origin') === '*' && wu.searchParams.get('prop') === 'pageimages|info' && wu.searchParams.get('titles') === 'Waffel|Köttbullar|Wrap (Speise)|Smørrebrød' && !wu.searchParams.get('pilicense'), 'Wikipedia: eine Anfrage, von überall (origin=*), nur frei lizenzierte Bilder (der Standard)');
const WIKI_ANTWORT = { query: {
  normalized: [{ from: 'Wrap (Speise)', to: 'Wrap (Speise)' }],
  redirects: [{ from: 'Köttbullar', to: 'Köttbullar (Gericht)' }],
  pages: [
    { title: 'Waffel', fullurl: 'https://de.wikipedia.org/wiki/Waffel', thumbnail: { source: 'https://upload.wikimedia.org/test/waffel.jpg' } },
    { title: 'Köttbullar (Gericht)', fullurl: 'https://de.wikipedia.org/wiki/K%C3%B6ttbullar', thumbnail: { source: 'https://upload.wikimedia.org/test/koettbullar.jpg' } },
    { title: 'Wrap (Speise)', fullurl: 'https://de.wikipedia.org/wiki/Wrap', thumbnail: { source: 'https://boese.example/wrap.jpg' } },
    { title: 'Smørrebrød', missing: true },
  ],
} };
const wb = wikiBilderAus(WIKI_ANTWORT, titel);
check(wb.get('Waffel')?.src === 'https://upload.wikimedia.org/test/waffel.jpg' && wb.get('Köttbullar')?.src.endsWith('koettbullar.jpg') && !wb.has('Wrap (Speise)') && !wb.has('Smørrebrød'), 'Wikipedia: Weiterleitungen gefolgt, nur Bilder von upload.wikimedia.org, fehlende ohne');
check(symbolFuer({ name: 'Waffel mit Sahne', art: 'dessert' }) === 'pancakes' && symbolFuer({ name: 'Glühwein-Punsch', art: 'suppe' }) === 'steaming-bowl' && symbolFuer({ name: 'Bratwurst im Brötchen', art: 'snack' }) === 'sandwich', 'Ohne Bild: ein Bildchen nach dem Namen, sonst nach der Art');

const browser = await starteBrowser();
const gh = githubAttrappe();
const h = await handy(browser, { attrappe: gh });
const p = h.page;
await h.ctx.route('https://generativelanguage.googleapis.com/**', kiRoute);
await p.evaluate((k) => localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Tobi' })), SCHLUESSEL);
await p.reload();
await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);

// Ohne KI-Schlüssel: erst einrichten
await p.click('#browse .abk-karte');
check(await p.locator('#speisekarte').isVisible() && await p.locator('#browse').isHidden(), 'Kachel „Speisekarte“ öffnet die Ansicht');
check((await p.locator('#speisekarte').innerText()).includes('Erst einen KI-Schlüssel'), 'Ohne KI-Schlüssel: erst einrichten');
await p.evaluate((g) => localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: g })), GKEY);
await p.click('[data-act="sk-zu"]');
await p.click('#browse .abk-karte');
check(await p.locator('#sk-form').isVisible(), 'Mit Schlüssel: Fotos, PDF, Text');
await p.click('#sk-los');
check((await p.locator('#sk-fehler').innerText()).includes('Erst die Karte'), 'Ohne Karte: ein Hinweis');
await p.setInputFiles('#sk-pdf', { name: 'karte.pdf', mimeType: 'application/pdf', buffer: PDF });
check(await bis(async () => (await p.locator('#sk-vorschau').innerText()).includes('karte.pdf')), 'PDF gewählt: steht da');
await p.click('#sk-los');
check(await bis(() => p.locator('.sk-erste').count(), 8000), 'Gelesen: das Ergebnis ist da');
const an = anfragen[0];
check(an.input[0].type === 'document' && an.input[0].mime_type === 'application/pdf' && Buffer.from(an.input[0].data, 'base64').toString('utf8').startsWith('%PDF') && /443 kcal/.test(an.system_instruction), 'Die Anfrage: das PDF als document, das Ziel im Auftrag');
const erste = await p.locator('.sk-erste').innerText();
check(erste.includes('Brauhaussalat mit Backhendl') && erste.includes('So bestellen') && erste.includes('Remoulade weglassen') && erste.includes('540'), 'Oben: der Salat – mit Tipp, mit den Werten dann');
check((await p.locator('.sk-ergebnis').innerText()).includes('Esst ihr nicht (1)'), 'Fisch für sich: „Esst ihr nicht (1)“');
// gemerkt
await p.reload();
await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await p.click('#browse .abk-karte');
check((await p.locator('.sk-erste').innerText()).includes('Brauhaussalat'), 'Neu geladen: das letzte Ergebnis ist noch da (nur auf diesem Gerät)');
check(!JSON.stringify(gh.liste() || {}).includes('Brauhaus'), 'Nichts davon in der gemeinsamen Liste');
// ein anderes Ziel sortiert neu, ohne die KI
const vorher = anfragen.length;
await p.click('.tabbar .tab[data-tab="einstellungen"]');
await p.fill('#e-ziel-form input[name="kcal"]', '1100');
await p.fill('#e-ziel-form input[name="p"]', '65');
await p.fill('#e-ziel-form input[name="kh"]', '90');
await p.fill('#e-ziel-form input[name="f"]', '50');
await p.click('#e-ziel-form button[type="submit"]');
check(await bis(() => gh.liste()?.profil?.ziel?.kcal === 1100), 'Ein großes Ziel gespeichert');
await p.click('.tabbar .tab[data-tab="rezepte"]');
check(await p.locator('#speisekarte').isVisible(), 'Zurück bei den Rezepten: die Speisekarte ist noch offen');
check((await p.locator('.sk-erste').innerText()).includes('Zwiebelrostbraten') && anfragen.length === vorher, 'Mit dem großen Ziel ist der Rostbraten vorn – ohne neue Anfrage');
// Andere Karte
await p.click('[data-act="sk-neu"]');
check(await p.locator('#sk-form').isVisible() && await p.locator('[data-act="sk-letzte"]').isVisible(), '„Andere Karte“: das Formular, das Letzte bleibt erreichbar');
check(h.fehler.length === 0, `keine Fehler im Browser (${h.fehler.join(' | ')})`);

// --- Veranstaltung: sagen, wohin man geht – Claude sucht, die App zeigt Stände und Gerichte, mit Bild
const AKEY = 'sk-ant-api03-TESTTESTTESTTESTTESTTESTTESTTEST_abc';
const v = await handy(browser, { attrappe: gh });
const vp = v.page;
await v.ctx.route('https://api.anthropic.com/**', claudeRoute);
await v.ctx.route('https://generativelanguage.googleapis.com/**', kiRoute);
await v.ctx.route(WIKI_HOSTS, wikiRoute);
await v.ctx.route(FUNKTIONEN, shopRoute);
await vp.evaluate(([k, a]) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Tobi' })); localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: a })); }, [SCHLUESSEL, AKEY]);
await vp.reload();
await vp.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await vp.click('#browse .abk-karte');
await vp.click('[data-sk-modus="veranstaltung"]');
const heute = await vp.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
check(await vp.locator('#sk-va-form').isVisible() && await vp.inputValue('#sk-wann') === heute && (await vp.locator('#sk-va-form').innerText()).includes('Claude sucht die Veranstaltung im Netz'), 'Umschalter „Veranstaltung“: wohin und wann (heute), Claude sucht');
await vp.click('#sk-va-los');
check((await vp.locator('#sk-fehler').innerText()).includes('Erst sagen, wohin du gehst'), 'Ohne Ziel: ein Hinweis');
await vp.fill('#sk-wohin', 'God Jul – Weihnachtsbasar der Seemannskirche');
await vp.click('#sk-va-los');
check(await bis(() => vp.locator('.sk-va').count(), 8000), 'Nachgesehen: die Veranstaltung ist da');
const vr = claude.anfragen[0];
check(vr && vr.tools?.some((t) => t.type === 'web_search_20250305') && vr.tools?.some((t) => t.type === 'web_fetch_20250910') && vr.messages[0].content[0].text.startsWith('Die Veranstaltung: God Jul – Weihnachtsbasar der Seemannskirche\nWann: ') && JSON.stringify(vr.system).includes(`Ziel für diese Mahlzeit: ${gh.liste()?.profil?.ziel?.kcal} kcal`), 'Die Anfrage an Claude: Websuche und Seiten lesen, die Veranstaltung, der Tag, das Ziel der Liste');
const kopfText = (await vp.locator('.sk-va').innerText()).replace(/\s+/g, ' ');
check(kopfText.includes('God Jul – Weihnachtsbasar der Seemannskirche') && kopfText.includes('Hamburg') && kopfText.includes('11–17 Uhr') && kopfText.includes('Im Netz gefunden') && await vp.locator('.sk-va-link').getAttribute('href') === SEITE, 'Oben: Name, Ort, wann, „Im Netz gefunden“, die Seite');
const ersteVa = (await vp.locator('.sk-erste').innerText()).replace(/\s+/g, ' ');
// Welches vorn steht, hängt am Ziel der Liste (weiter oben auf 1100 kcal gesetzt) – die App rechnet es so wie sortieren
const vorn = sortieren(veranstaltungBereinigen(JSON.parse(JSON.stringify(VA)), { quellen: QUELLEN }).gerichte, gh.liste()?.profil?.ziel || ZIEL).oben[0].g;
check(ersteVa.includes(vorn.name) && ersteVa.includes(`Stand: ${vorn.stand}`) && ersteVa.includes(vorn.quelle === 'seite' ? 'laut Seite' : 'vermutlich'), `Am nächsten am Ziel: ${vorn.name}, mit Stand und woher (${ersteVa.slice(0, 120)})`);
const wrapText = (await vp.locator('.sk-gericht, .sk-zeile', { hasText: 'Hähnchen-Wrap' }).first().innerText()).replace(/\s+/g, ' ');
check(wrapText.includes('vermutlich') && !wrapText.includes('laut Seite'), `Der Wrap: „vermutlich“ – seine Adresse war ausgedacht (${wrapText.slice(0, 100)})`);
const staendeText = (await vp.locator('.sk-staende').innerText()).replace(/\s+/g, ' ');
check(/Waffelstand laut Seite/.test(staendeText) && /Hotdog-Stand vermutlich/.test(staendeText) && staendeText.includes('Kirchenküche') && (await vp.locator('.sk-ohne').textContent()).includes('Smørrebrød') && !(await vp.locator('.sk-ohne').textContent()).includes('Köttbullar'), 'Die Stände: „laut Seite“ und „vermutlich“; Smørrebrød unter „Esst ihr nicht“, Köttbullar nicht');
check(await bis(() => vp.evaluate(() => [...document.querySelectorAll('.sk-ergebnis .sk-bild img')].some((i) => i.src === 'https://upload.wikimedia.org/test/waffel.jpg'))) && wiki.anfragen.length === 1 && wiki.anfragen[0].kopf['api-user-agent'] === KENNUNG, 'Bilder aus Wikipedia – eine Anfrage, mit der Kennung der App');
check(await vp.evaluate(() => !!document.querySelector('.sk-ergebnis .sk-bild.symbol img[src*="bilder/zutaten/"]')), 'Ohne Wikipedia-Bild (Smørrebrød, der Wrap): ein Bildchen der App');
check(await bis(() => vp.evaluate(() => document.querySelector('.sk-va-bild')?.src.startsWith('blob:'))) && shop.anfragen.length === 1 && shop.anfragen[0].seite === SEITE, 'Oben das Bild der Seite – über die Funktion, mit der Seite');
check((await vp.locator('.sk-quellen').innerText()).includes('seemannskirche.example') && !(await vp.locator('.sk-ergebnis').innerText()).includes('ausgedacht.example'), 'Gefunden auf: die Seite – nicht die ausgedachte');
check(!JSON.stringify(gh.liste() || {}).includes('Seemannskirche') && !(await vp.evaluate(() => localStorage.getItem('boxenstopp.speisekarte.v1'))).includes('Weihnachtsbasar der Seemannskirche\nWann'), 'Nichts davon in der gemeinsamen Liste; gemerkt nur das Ergebnis, nicht die Frage');
// Neu geladen: das Ergebnis mit den Bildern aus Wikipedia ist noch da – ohne neue Anfragen an Claude oder Wikipedia
const claudeVorher = claude.anfragen.length;
await vp.reload();
await vp.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await vp.click('#browse .abk-karte');
check(await bis(() => vp.locator('.sk-va').count()) && await vp.evaluate(() => [...document.querySelectorAll('.sk-ergebnis .sk-bild img')].some((i) => i.src.endsWith('waffel.jpg'))) && claude.anfragen.length === claudeVorher && wiki.anfragen.length === 1, 'Neu geladen: alles noch da, die Bilder auch – ohne neue Anfrage');
// Neu nachsehen: das Formular für die Veranstaltung (das Gerät merkt sich die Wahl)
await vp.click('[data-act="sk-neu"]');
check(await vp.locator('#sk-va-form').isVisible() && await vp.inputValue('#sk-wohin') === '', '„Neu nachsehen“: wieder das Formular für die Veranstaltung, die Frage ist weg');
// Mit Gemini: keine Suche, alles geschätzt
await vp.evaluate((g) => localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: g })), GKEY);
await vp.reload();
await vp.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await vp.click('#browse .abk-karte');
await vp.click('[data-act="sk-neu"]');
check((await vp.locator('#sk-va-form').innerText()).includes('Mit Gemini sucht die App nicht im Netz'), 'Mit Gemini: der Hinweis, dass nicht gesucht wird');
const geminiVorher = anfragen.length;
const shopVorher = shop.anfragen.length;
await vp.fill('#sk-wohin', 'God Jul');
await vp.click('#sk-va-los');
check(await bis(async () => (await vp.locator('.sk-va').innerText().catch(() => '')).includes('Nicht gefunden – geschätzt'), 8000) && anfragen.length === geminiVorher + 1 && !anfragen.at(-1).tools && anfragen.at(-1).response_format?.schema && !(await vp.locator('.sk-staende').innerText()).includes('laut Seite'), 'Gemini: ohne Werkzeuge – „Nicht gefunden – geschätzt“, alles „vermutlich“');
check(shop.anfragen.length === shopVorher, 'Mit Gemini kein Bild der Seite (die Funktion prüft den Schlüssel von Anthropic)');
check(v.fehler.length === 0, `Veranstaltung: keine Fehler im Browser (${v.fehler.join(' | ')})`);

await browser.close();
ende();
