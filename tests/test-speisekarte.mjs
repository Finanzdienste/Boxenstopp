/*
 * Speisekarte: Anfrage und Rechnung (js/speisekarte.js, direkt in Node) und
 * im Browser – PDF wählen, die KI (nachgebaut) liest, die App zeigt das
 * Gericht, das dem Ziel am nächsten kommt; gemerkt nach dem Neuladen; ein
 * anderes Ziel sortiert neu; ohne KI-Schlüssel erst einrichten.
 */
import { pruefer, handy, githubAttrappe, starteBrowser, bis, SCHLUESSEL } from './hilfe.mjs';
import { rumpfKarte, karteSystem, karteBereinigen, sortieren, bewerten, KARTE_SCHEMA } from '../js/speisekarte.js';

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

/* ----------------------------------------------------------- Anfrage */

const sys = karteSystem({ ziel: ZIEL, wer: 'Tobi' });
check(sys.includes('443 kcal, 33 g Protein, 39 g Kohlenhydrate, 15,4 g Fett') && /mehr Fett als zu Hause/.test(sys) && /fisch/.test(sys) && /schwein/.test(sys), 'System: Ziel, ehrliche Restaurant-Portionen, Fisch und Schwein markieren');
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
check(b.gerichte.find((g) => g.name.startsWith('Schweine')).enthaelt.join() === 'schwein', 'Bereinigen: nur bekannte Markierungen');
check(b.gerichte[0].mitTipp?.kcal === 540 && !b.gerichte[2].mitTipp, 'Bereinigen: Werte mit Tipp nur, wenn es einen Tipp gibt');
check(karteBereinigen({ gerichte: [] }).fehler && karteBereinigen(null).fehler, 'Keine Gerichte: ein Satz statt eines Ergebnisses');
const be = bewerten(b.gerichte[0], ZIEL);
check(be.tipp && be.werte.kcal === 540 && be.abweichung.kcal === 97, 'Bewerten: mit dem Tipp ist es näher dran');
const s = sortieren(b.gerichte, ZIEL);
check(s.oben[0].g.name === 'Brauhaussalat mit Backhendl', `Am nächsten: der Salat (${s.oben[0].g.name})`);
check(!s.oben.some((x) => x.g.art === 'dessert') && s.rest.some((x) => x.g.art === 'dessert'), 'Desserts stehen nicht oben');
check(s.ohne.map((x) => x.g.name).sort().join() === 'Hamburger Labskaus,Schweineschnitzel Wiener Art' && !s.oben.some((x) => x.g.enthaelt.length), 'Fisch und Schwein für sich, nicht oben');
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
  anfragen.push(JSON.parse(r.request().postData() || '{}'));
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: STROM(JSON.stringify(KARTE)) });
};
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

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
check((await p.locator('.sk-ergebnis').innerText()).includes('Esst ihr nicht (2)'), 'Fisch und Schwein für sich: „Esst ihr nicht (2)“');
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

await browser.close();
ende();
