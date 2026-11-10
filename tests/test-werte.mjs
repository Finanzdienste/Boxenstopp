/*
 * Werte schätzen: Für Zutaten, die die App nicht kennt („110 g Gouda“,
 * „1 Handvoll Parmesan“), fragt sie einmal die KI (amy-werte.js) – im
 * Hintergrund, sobald Amys Bereich zu sehen ist. Vorher stehen auf der Karte
 * keine (viel zu kleinen) Zahlen, danach Kalorien und Preis; die Schätzung
 * steht in der Liste und gilt auf dem anderen Handy ohne eigene Anfrage.
 * Nach dem Bearbeiten fragt sie nur nach der neuen Zeile, und dieselbe Frage
 * stellt ein Gerät nicht gleich noch einmal.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';
import { leer } from '../js/liste.js';
import { amyNaehrwerte, amyKosten, zeileSchluessel } from '../js/amy.js';
import { euro } from '../js/kosten.js';

const { check, ende } = pruefer();
const D = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const GKEY = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
const STROM = (json) => {
  const ev = (o) => `event: ${o.event_type}\r\ndata: ${JSON.stringify(o)}\r\n\r\n`;
  let s = ev({ event_type: 'interaction.created', interaction: { id: 'ia_1', status: 'in_progress' } });
  for (let i = 0; i < json.length; i += 200) s += ev({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: json.slice(i, i + 200) } });
  return s + ev({ event_type: 'interaction.completed', interaction: { id: 'ia_1', status: 'completed', usage: { total_input_tokens: 400, total_output_tokens: 200 } } });
};
const ki = { anfragen: [], antwort: { zutaten: [] }, verzoegerung: 0 };
const kiRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  ki.anfragen.push(JSON.parse(req.postData() || '{}'));
  if (ki.verzoegerung) await new Promise((f) => { setTimeout(f, ki.verzoegerung); });
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: STROM(JSON.stringify(ki.antwort)) }).catch(() => {});
};

const REZEPT = {
  id: 'amy-crack-and-cheese', name: 'Crack and Cheese', portionen: 4, zeit: 30,
  zutaten: ['250 g Makkaroni', '150g+ 75g shredded Cheddar', '110 g Gouda', '1 Handvoll Parmesan', 'Salz'],
  schritte: ['Nudeln 10 Min. kochen', 'Käse schmelzen'], notiz: '', by: 'Amy', at: '2026-11-10T10:00:00.000Z', geaendert: '',
};
const SCHAETZUNG = { zutaten: [
  { zeile: '110 g Gouda', gramm: 110, kcal: 356, p: 25, kh: 0, f: 28, eur: 1.5 },
  { zeile: '1 Handvoll Parmesan', gramm: 25, kcal: 390, p: 35, kh: 0, f: 28, eur: 0.6 },
] };
// So rechnet es die App: Makkaroni und Cheddar aus dem Katalog, Gouda geschätzt, Parmesan mit Katalogwerten und geschätzten Gramm
const W = Object.fromEntries(SCHAETZUNG.zutaten.map((x) => [zeileSchluessel(x.zeile), { g: x.gramm, kcal: x.kcal, p: x.p, kh: x.kh, f: x.f, eur: x.eur }]));
const daten = { katalog: D.katalog, naehrwerte: D.naehrwerte, preise: D.preise, werte: W };
const soll = amyNaehrwerte(REZEPT, daten);
const sollEuro = amyKosten(REZEPT, daten);
const sollText = `≈ ${soll.kcal.toLocaleString('de-DE')} kcal · ≈ ${euro(sollEuro.portion)} pro Portion`;
check(!soll.unbekannt.length && soll.kcal > 450 && soll.kcal < 700 && !sollEuro.luecken, `in Node: mit der Schätzung vollständig (${sollText})`);

const gh = githubAttrappe();
gh.zustand.datei = JSON.stringify({ ...leer(), rev: 1, leute: { amy: 'Amy', tobi: 'Tobi' }, amy: { [REZEPT.id]: REZEPT } });
gh.zustand.sha = 'sha1';
const browser = await starteBrowser();
const amy = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}&fuer=Amy` });
const a = amy.page;
await amy.ctx.route('https://generativelanguage.googleapis.com/**', kiRoute);
check(await bis(async () => (await a.locator('#sync-text').innerText()) === 'Geteilt'), 'Amy: verbunden, ihr Rezept ist da');
await a.evaluate((k) => localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: k })), GKEY);
const karte = a.locator(`#view-amy [data-amy-open="${REZEPT.id}"]`);
// Ohne Warten: Gibt es die Zeile (noch) nicht, ist das die Antwort
const zahlen = async () => (await karte.locator('.amy-karte-z').allInnerTexts()).join(' ');

ki.antwort = SCHAETZUNG;
ki.verzoegerung = 1500;
await a.click('.tab[data-tab="amy"]');
check(await bis(async () => ki.anfragen.length === 1), 'Amys Bereich offen: die App fragt die KI nach dem, was fehlt');
const vorher = await zahlen();
check(await karte.count() === 1 && vorher === '', `vorher: keine Zahlen auf der Karte – sie wären viel zu klein (${vorher})`);
const frage = ki.anfragen[0];
const text = frage.input?.[0]?.text || '';
check(String(frage.system_instruction).includes('Nährwerte und Preise') && frage.response_format?.schema?.properties?.zutaten && text.includes('Rezept: Crack and Cheese (für 4 Portionen)') && text.includes('- 110 g Gouda') && text.includes('- 1 Handvoll Parmesan') && !/Makkaroni|Cheddar|Salz/.test(text), `nur die offenen Zeilen, JSON nach Schema (${text.split('\n').slice(2).join(' | ')})`);
check(await bis(async () => (await zahlen()) === sollText, 8000), `danach: „${sollText}“`);
check(await bis(() => Object.keys(gh.liste()?.amyWerte?.[REZEPT.id]?.z || {}).length === 2), 'die Schätzung steht in der Liste – für alle Geräte');
await karte.click();
check(await bis(async () => (await a.locator('.amy-etikett small').innerText().catch(() => '')).includes('teils von der KI geschätzt')) && !(await a.locator('.amy-etikett small').innerText()).includes('ohne'), 'im Rezept: „teils von der KI geschätzt“, nichts fehlt');
check(Number((await a.locator('.amy-etikett b').first().innerText()).replace('.', '')) === soll.kcal, 'dieselben Kalorien im Rezept');

// Tobi: dieselben Zahlen, ohne eigene Anfrage
const tobi = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}&fuer=Tobi` });
const t = tobi.page;
await tobi.ctx.route('https://generativelanguage.googleapis.com/**', kiRoute);
check(await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt'), 'Tobi: verbunden');
await t.evaluate((k) => localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: k })), GKEY);
await t.click('.tab[data-tab="amy"]');
const tKarte = t.locator(`#view-amy [data-amy-open="${REZEPT.id}"] .amy-karte-z`);
check(await bis(async () => (await tKarte.allInnerTexts()).join(' ') === sollText), 'bei Tobi: dieselben Zahlen');
await t.waitForTimeout(800);
check(ki.anfragen.length === 1, 'Tobis Handy fragt nicht noch einmal – es ist schon geschätzt');

// Amy schreibt eine Zeile dazu: gefragt wird nur nach der neuen; bleibt die Antwort leer, fragt dasselbe Gerät nicht gleich wieder
ki.antwort = { zutaten: [] };
ki.verzoegerung = 0;
await a.click('[data-act="amy-bearbeiten"]');
await a.fill('#amy-zutaten', `${REZEPT.zutaten.join('\n')}\nFeta`);
await a.click('#amy-speichern');
check(await bis(async () => ki.anfragen.length === 2, 8000), 'nach dem Speichern: eine neue Anfrage');
const t2 = ki.anfragen[1].input?.[0]?.text || '';
check(t2.includes('- Feta') && !t2.includes('Gouda') && !t2.includes('Parmesan'), `nur die neue Zeile („Feta“ ohne Menge) – Gouda und Parmesan sind schon geschätzt (${t2.split('\n').slice(2).join(' | ')})`);
// Fertig gefragt: Im Rezept steht nicht mehr „die KI schätzt sie gerade“
check(await bis(async () => { const t = await a.locator('.amy-etikett small').innerText().catch(() => ''); return t.includes('ohne Feta') && !t.includes('schätzt sie gerade'); }), 'im Rezept: „ohne Feta“ – und nicht mehr „schätzt sie gerade“');
await a.click('[data-act="amy-liste"]');
check(await bis(async () => (await karte.count()) === 1) && (await zahlen()) === '', 'ohne Wert für Feta: wieder keine Zahlen auf der Karte');
await a.reload({ waitUntil: 'load' });
await bis(async () => (await a.locator('#sync-text').innerText()) === 'Geteilt');
await a.click('.tab[data-tab="amy"]');
await a.waitForTimeout(1200);
check(ki.anfragen.length === 2, `neu geladen: dieselbe Frage nicht gleich noch einmal (erst in sieben Tagen) – ${ki.anfragen.slice(2).map((x) => (x.input?.[0]?.text || '').split('\n').slice(2).join(' | ')).join(' / ')}`);

const fehler = [...amy.fehler, ...tobi.fehler];
check(fehler.length === 0, `keine Fehler in der Konsole${fehler.slice(0, 3).join(' | ')}`);
await browser.close();
ende();
