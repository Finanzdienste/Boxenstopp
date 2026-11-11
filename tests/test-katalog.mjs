/*
 * Der gemeinsame Katalog: neue Rezepte nach Wunsch („Kürbissuppe“) – die
 * Anfrage an die KI und die Rechnung in Node (js/ki.js, js/katalog.js:
 * bereinigen, mischen, herausnehmen, auf jedes Ziel und jede Boxenzahl), dann
 * im Browser: Tobi wünscht sich eine Kürbissuppe, sie kommt in seinen und
 * (über sein Handy) Marielles Katalog, bei ihr auf ihr Ziel und 2 Boxen
 * gerechnet; „Neuer Vorschlag“ ersetzt sie; „Mit KI ändern“ ändert sie an
 * ihrer Stelle (für alle, die Liste zieht mit, der Wunsch steht dabei);
 * Marielle nimmt sie heraus, und bei Tobi ist sie danach auch weg.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT, handy, githubAttrappe, githubMehrere, starteBrowser, bis, SCHLUESSEL } from './hilfe.mjs';
import { leer } from '../js/liste.js';
import { kiBereinigen } from '../js/ki-rezept.js';
import { systemText, nutzerText, rumpfFuer } from '../js/ki.js';
import { katalogBereinigen, katalogMischen, katalogDazu, katalogRaus, katalogRezepte, katalogUnterschied, gleicherKatalog, leererKatalog, MAX_KATALOG } from '../js/katalog.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const SUPPE = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'daten', 'ki-kuerbissuppe.json'), 'utf8'));
const STANDARD = { kcal: 443, p: 33, kh: 39, f: 15.4 };
const MARIELLE = { kcal: 380, p: 30, kh: 35, f: 12 };
const einheiten = {};
for (const r of daten.rezepte) for (const it of r.items) if (it.k && typeof it.q === 'number') einheiten[it.k] = it.u;
const opt = (ziel, boxen) => ({ ziel, boxen, katalog: daten.katalog, einheiten });
const { r: k } = kiBereinigen({ ...SUPPE, portionen: 8 });

/* ---------------------------------------------------------- die Anfrage */

const sys = systemText({ portionen: 8, ziel: STANDARD, dazukaufen: true, katalog: daten.katalog, modus: 'wunsch', wer: 'Tobi und Amy' });
check(sys.includes('nach dem Wunsch von Tobi oder Amy') && sys.includes('„Kürbissuppe“') && sys.includes('mageres Protein oder eine Sättigungsbeilage') && sys.includes('Katalog der App'), 'Auftrag: ein Rezept nach Wunsch – nur ein Gericht wird eine ganze Mahlzeit, es kommt in den Katalog');
check(sys.includes('Alles wird eingekauft') && sys.includes('ganze Supermarkt-Packungen') && sys.includes('großzügig') && sys.includes('Kein Fisch') && sys.includes('Kein Schweinefleisch') && sys.includes('Ziel pro Box: 443 kcal'), 'Regeln: alles kaufen, ganze Packungen, Spielraum für andere Ziele – und wie immer kein Fisch, kein Schwein, das Ziel');
const nut = nutzerText({ text: 'Kürbissuppe', portionen: 8, modus: 'wunsch', mag: ['Chili'], vermeiden: ['Kürbissuppe mit Hähnchen'] });
check(nut.startsWith('Der Wunsch:\nKürbissuppe') && nut.includes('Portionen: 8') && nut.includes('Das mögen sie (Daumen hoch): Chili') && nut.includes('Diesmal anders als: Kürbissuppe mit Hähnchen') && !nut.includes('Dazukaufen'), 'Nachricht: der Wunsch, 8 Portionen, Daumen, „diesmal anders“ – nichts von Kühlschrank und Dazukaufen');
const rumpf = rumpfFuer('gemini', { text: 'Etwas Cremiges mit Hähnchen und Spinat, ohne Ofen', fotos: [], portionen: 8, dazukaufen: true, ziel: STANDARD, katalog: {}, modus: 'wunsch', wer: 'Marielle' });
check(rumpf.input.length === 1 && rumpf.input[0].text.includes('ohne Ofen') && rumpf.system_instruction.includes('nach dem Wunsch von Marielle'), 'Ein ganzer Text geht genauso, ohne Fotos; für Marielle „nach dem Wunsch von Marielle“');

/* ------------------------------------------------------------ der Katalog */

const at = (t) => new Date(Date.UTC(2026, 10, 7, 10, t)).toISOString();
const k1 = katalogDazu(leererKatalog(), 'kat-suppe0001', { k, wunsch: 'Kürbissuppe', by: 'Tobi', ziel: STANDARD, at: at(0) });
check(Object.keys(k1.rezepte).length === 1 && k1.rezepte['kat-suppe0001'].wunsch === 'Kürbissuppe' && k1.rezepte['kat-suppe0001'].k.zutaten.length === 9, 'Ein Eintrag: das Rezept im KI-Format, der Wunsch, wer, wann, das Ziel');
const kaputt = katalogBereinigen({ rezepte: { 'falsche id': k1.rezepte['kat-suppe0001'], 'kat-ohnedatum': { ...k1.rezepte['kat-suppe0001'], at: 'gestern' }, 'kat-schwein01': { ...k1.rezepte['kat-suppe0001'], k: { ...k, name: 'Kürbissuppe mit Speck' } }, 'kat-gut00001': k1.rezepte['kat-suppe0001'] }, weg: { 'kat-kaputt1': 'irgendwann' } });
check(JSON.stringify(Object.keys(kaputt.rezepte)) === '["kat-gut00001"]' && !Object.keys(kaputt.weg).length, 'Bereinigen: falsche id, ohne Datum, mit Speck – fällt weg');
const viele = { rezepte: {} };
for (let i = 0; i < MAX_KATALOG + 5; i++) viele.rezepte[`kat-v${String(i).padStart(4, '0')}`] = { ...k1.rezepte['kat-suppe0001'], at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() };
const gekappt = katalogBereinigen(viele);
check(Object.keys(gekappt.rezepte).length === MAX_KATALOG && !gekappt.rezepte['kat-v0000'] && gekappt.rezepte['kat-v0104'], `Höchstens ${MAX_KATALOG} – die neuesten bleiben`);

// Mischen: was neuer ist, gilt; Herausgenommenes kommt nicht zurück
const k2 = katalogDazu(leererKatalog(), 'kat-dal00001', { k: { ...k, name: 'Linsen-Dal', kurz: 'Dal' }, wunsch: 'Dal', by: 'Marielle', ziel: MARIELLE, at: at(5) });
const beide = katalogMischen(k1, k2);
check(Object.keys(beide.rezepte).length === 2 && gleicherKatalog(beide, katalogMischen(k2, k1)) && gleicherKatalog(beide, katalogMischen(beide, k1, k2)), 'Mischen: beide Rezepte, egal in welcher Reihenfolge, und nochmal mischen ändert nichts');
const raus = katalogRaus(beide, 'kat-suppe0001', { at: at(10) });
check(!raus.rezepte['kat-suppe0001'] && raus.weg['kat-suppe0001'].kurz === 'Kürbissuppe' && !katalogMischen(raus, k1).rezepte['kat-suppe0001'], 'Herausnehmen: weg mit Datum und Namen – mit einem alten Stand gemischt kommt es nicht zurück');
const wieder = katalogDazu(raus, 'kat-suppe0001', { ...k1.rezepte['kat-suppe0001'], at: at(11) });
check(!!katalogMischen(wieder, raus, k1).rezepte['kat-suppe0001'], 'Rückgängig: neuer als das Herausnehmen – dann ist es wieder da');
const neuer = katalogDazu(k1, 'kat-suppe0001', { ...k1.rezepte['kat-suppe0001'], wunsch: 'Kürbissuppe, schärfer', at: at(20) });
check(katalogMischen(k1, neuer).rezepte['kat-suppe0001'].wunsch === 'Kürbissuppe, schärfer', 'Dasselbe Rezept zweimal: das neuere gilt');
const ersetzt = katalogDazu(k1, 'kat-suppe0002', { k, wunsch: 'Kürbissuppe', by: 'Tobi', ziel: STANDARD, at: at(30), ersetzt: 'kat-suppe0001' });
check(Object.keys(ersetzt.rezepte).join() === 'kat-suppe0002' && ersetzt.weg['kat-suppe0001'], 'Neuer Vorschlag: das neue rein, das alte unter weg');
const u = katalogUnterschied(k1, ersetzt);
check(u.neu.join() === 'Kürbissuppe' && u.raus.join() === 'Kürbissuppe', 'Unterschied für die Commit-Nachricht: neu und raus');

/* ------------------------------------------- für jeden auf sein Ziel */

const [tobiR] = katalogRezepte(k1, opt(STANDARD, 8));
const [marR] = katalogRezepte(k1, opt(MARIELLE, 2));
const [grossR] = katalogRezepte(k1, opt({ kcal: 600, p: 45, kh: 60, f: 18 }, 8));
const nah = (m, z) => Math.abs(m.kcal - z.kcal) <= 15 && Math.abs(m.p - z.p) <= 2 && Math.abs(m.kh - z.kh) <= 3 && Math.abs(m.f - z.f) <= 2;
check(nah(tobiR.m, STANDARD) && tobiR.portionen === 8, `Tobi und Amy, 8 Boxen: ${tobiR.m.kcal} kcal, ${tobiR.m.p} P, ${tobiR.m.kh} KH, ${tobiR.m.f} F pro Box`);
check(nah(marR.m, MARIELLE) && marR.portionen === 2 && marR.m.kcal < tobiR.m.kcal - 40, `Marielle, 2 Boxen: ${marR.m.kcal} kcal, ${marR.m.p} P, ${marR.m.kh} KH, ${marR.m.f} F pro Box – ihr Ziel`);
check(nah(grossR.m, { kcal: 600, p: 45, kh: 60, f: 18 }), `Ein großes Ziel (600 kcal) geht auch – der Spielraum wächst mit (${grossR.m.kcal} kcal)`);
const hTobi = tobiR.items.find((it) => it.k === 'haehnchenbrust');
const hMar = marR.items.find((it) => it.k === 'haehnchenbrust');
check(hMar.q < hTobi.q / 3 && marR.ablauf.flatMap((p) => p.schritte).some((s) => /^\d+ g Hähnchen in mundgerechte/.test(s.d)) && marR.ablauf.flatMap((p) => p.schritte).some((s) => s.d.includes('300 ml Wasser')), `Bei Marielle: ${hMar.q} g Hähnchen statt ${hTobi.q} g, die Mengen in den Schritten auch (300 ml Wasser)`);
check(marR.katalog.wunsch === 'Kürbissuppe' && marR.katalog.by === 'Tobi' && marR.protein === 'Hähnchen' && marR.base === 'Brot' && marR.tips[0].startsWith('Beim Aufwärmen 2–3 EL Wasser'), 'Woher es kommt (Wunsch, von wem), Protein und Beilage für die Filter, die Tipps (was pro Box gilt, bleibt)');

/* ------------------------------------------------------------ Browser */

const M_KEY = 'github_pat_11MARIELLE000000000000_abcdefghijklmnopqrstuvwxyz';
const GKEY = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
const GEMINI_STROM = (json) => {
  const ev = (o) => `event: ${o.event_type}\r\ndata: ${JSON.stringify(o)}\r\n\r\n`;
  let s = ev({ event_type: 'interaction.created', interaction: { id: 'ia_1', status: 'in_progress' } });
  for (let i = 0; i < json.length; i += 400) s += ev({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: json.slice(i, i + 400) } });
  s += ev({ event_type: 'interaction.completed', interaction: { id: 'ia_1', status: 'completed', usage: { total_input_tokens: 2500, total_output_tokens: 3800, total_tokens: 6300 } } });
  return s;
};
const anfragen = [];
let antwort = SUPPE;
async function gemini(r) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  const rumpf = JSON.parse(r.request().postData() || '{}');
  anfragen.push(rumpf);
  const json = typeof antwort === 'function' ? antwort(rumpf) : antwort;
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: GEMINI_STROM(JSON.stringify(json)) });
}
// „Mit KI ändern“: das Rezept, wie die App es schickt (mit ihren ids), ohne Kokosmilch zurück – wie es die KI macht
const OHNE_KOKOS_NAME = 'Kürbissuppe mit Hähnchen & roten Linsen, ohne Kokos';
const ohneKokos = (rumpf) => {
  const v = JSON.parse(String(rumpf.input?.at(-1)?.text || '').split('\n')[1]);
  const weg = v.zutaten.find((z) => /kokosmilch/i.test(z.name));
  const ohne = (xs) => (Array.isArray(xs) ? xs.map((s) => (s?.text?.includes(`{${weg.id}}`) ? { ...s, text: 'Die Suppe fein pürieren, mit Salz und Pfeffer abschmecken' } : s)) : xs);
  return { ...v, name: OHNE_KOKOS_NAME, zutaten: v.zutaten.filter((z) => z !== weg), vorbereiten: ohne(v.vorbereiten), kochen: ohne(v.kochen), portionieren: ohne(v.portionieren), hinweis: 'Ohne Kokosmilch – die Suppe wird nur püriert.' };
};
const kat = (a) => JSON.parse(a.zustand.dateien['katalog.json'] || '{"rezepte":{},"weg":{}}');
const gh = (a) => JSON.parse(a.zustand.datei || '{}');

const browser = await starteBrowser();
const haupt = githubAttrappe();
haupt.zustand.datei = JSON.stringify({ ...leer(), rev: 1 });
haupt.zustand.version = 1;
haupt.zustand.sha = 'sha1';
const mar = githubAttrappe({ schluessel: M_KEY, repo: 'Boxenstopp-Marielle' });
mar.zustand.datei = JSON.stringify({ ...leer(), rev: 1, profil: { person: 'Marielle', farbe: 'lila', boxen: 2, ziel: { ...MARIELLE, by: 'Marielle', at: at(0) } }, leute: { marielle: 'Marielle' } });
mar.zustand.version = 1;
mar.zustand.sha = 'sha1';
const alle = githubMehrere(haupt, mar);

// Tobi: die gemeinsame Liste, ein KI-Schlüssel, Marielle als Gast auf seinem Handy
const tobi = await handy(browser, { attrappe: alle });
await tobi.ctx.route('https://generativelanguage.googleapis.com/**', gemini);
const t = tobi.page;
await t.evaluate(([s, g, m]) => {
  localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: s, name: 'Tobi' }));
  localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: g }));
  localStorage.setItem('boxenstopp.gaeste.v1', JSON.stringify([{ name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle', token: m, farbe: 'lila', at: '2026-11-04T10:00:00.000Z' }]));
}, [SCHLUESSEL, GKEY, M_KEY]);
await t.reload();
await t.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt'), 'Tobi: an eurer Liste');
check((await t.locator('#r-eyebrow').textContent()) === '50 Rezepte · je 8 Boxen' && await t.locator('#chips [data-filter="neu"]').isHidden(), 'Noch: 50 Rezepte, kein „Neu dazu“');
// Neues Rezept
await t.click('#browse [data-act="wunsch"]');
check(await t.locator('#reste').isVisible() && (await t.locator('#k-titel').innerText()) === 'Was möchtest du kochen?' && (await t.locator('#reste .d-desc').innerText()).includes('gemeinsamen Katalog'), '„Neues Rezept“: Was möchtest du kochen? – es kommt in den gemeinsamen Katalog');
check(await t.locator('#k-kaufen').count() === 0 && await t.locator('#k-kamera').count() === 0 && await t.locator('[data-portionen]').count() === 0, 'Nur der Wunsch: keine Fotos, kein Dazukaufen, keine Portionen (der Katalog hat 8, jede Liste rechnet um)');
await t.fill('#k-text', 'Kürbissuppe');
await t.click('#k-los');
check(await bis(async () => (await t.locator('#d-title').count()) === 1 && (await t.locator('#d-title').innerText()) === SUPPE.name, 10000), 'Die Kürbissuppe öffnet');
const anfrage = anfragen.at(-1);
check(anfragen.length === 1 && anfrage.input[0].text.startsWith('Der Wunsch:\nKürbissuppe') && anfrage.input[0].text.includes('Portionen: 8') && anfrage.system_instruction.includes('nach dem Wunsch von'), 'An Gemini: der Wunsch, 8 Portionen, der Auftrag fürs neue Rezept');
check(await bis(() => Object.keys(kat(haupt).rezepte).length === 1), 'In eurer katalog.json steht sie');
const [id1] = Object.keys(kat(haupt).rezepte);
const e1 = kat(haupt).rezepte[id1];
check(/^kat-/.test(id1) && e1.wunsch === 'Kürbissuppe' && e1.by === 'Tobi' && e1.ziel.kcal === 443 && e1.k.portionen === 8 && haupt.zustand.nachrichten.includes('Tobi: Katalog – „Kürbissuppe“ dazu'), 'Mit Wunsch, von wem, Ziel, 8 Portionen – Commit „Tobi: Katalog – „Kürbissuppe“ dazu“');
check(await bis(() => !!kat(mar).rezepte[id1], 8000) && mar.zustand.nachrichten.some((x) => x.startsWith('Tobi: Katalog abgeglichen – Kürbissuppe dazu')), 'Tobis Handy gleicht ab: Sie steht auch in Marielles katalog.json');
let leiste = await t.locator('#d-ki').innerText();
check(leiste.includes('Aus dem Katalog') && leiste.includes('gewünscht von dir') && leiste.includes('Für alle, die die App nutzen') && leiste.includes('Neuer Vorschlag') && leiste.includes('Aus dem Katalog nehmen'), 'Im Rezept: „Aus dem Katalog · gewünscht von dir“, Neuer Vorschlag, Aus dem Katalog nehmen');
check((await t.locator('#detail').innerText()).includes('Hähnchen und Baguette sind dazugekommen'), 'Was die KI fürs Ziel dazugenommen hat, steht dabei');
// Im Raster: vorn, „Neu · von dir“, „Neu dazu“
await t.click('#detail [data-act="zurueck"]');
check(await bis(async () => (await t.locator('#r-eyebrow').textContent()) === '51 Rezepte · je 8 Boxen'), 'Jetzt 51 Rezepte');
const erste = t.locator('#grid .box').first();
check((await erste.getAttribute('data-open')) === id1 && (await erste.innerText()).includes('Neu · von dir'), 'Ganz vorn im Raster, „Neu · von dir“');
check(await t.locator('#chips [data-filter="neu"]').isVisible() && (await t.locator('#chips [data-filter="neu"] .n').innerText()) === '1', 'Chip „Neu dazu“ mit 1');
const tobiKcal = Number((await erste.locator('.box-macros b').innerText()).replace(/\D/g, ''));
// Aus der Suche
await t.fill('#suche', 'Ofenkürbis mit Feta');
check(await bis(() => t.locator('#r-wunsch [data-act="wunsch-suche"]').isVisible()) && (await t.locator('#r-wunsch').innerText()).includes('„Ofenkürbis mit Feta“ als neues Rezept machen'), 'Suche ohne Treffer: „„Ofenkürbis mit Feta“ als neues Rezept machen“');
await t.fill('#suche', 'kürbis');
check(await bis(async () => (await t.locator('#grid .box').count()) >= 1 && (await t.locator('#r-wunsch').innerText()).includes('Nicht das Richtige dabei?')), 'Mit Treffer (die Kürbissuppe): „Nicht das Richtige dabei?“');
await t.fill('#suche', '');
check(await bis(() => t.locator('#r-wunsch').isHidden()), 'Ohne Suche nichts davon');
// Neuer Vorschlag: ersetzt die Suppe
await t.click(`[data-open="${id1}"]`);
await t.click('#d-ki [data-act="kat-neu"]');
check(await bis(() => anfragen.length === 2, 10000) && anfragen[1].input[0].text.includes(`Diesmal anders als: ${SUPPE.name}`), 'Neuer Vorschlag: derselbe Wunsch, „diesmal anders als“ die alte');
check(await bis(() => { const x = kat(haupt); return Object.keys(x.rezepte).length === 1 && !x.rezepte[id1] && !!x.weg[id1]; }, 10000), 'Die neue ersetzt die alte: eine Suppe im Katalog, die alte unter weg');
const [id2] = Object.keys(kat(haupt).rezepte);
check(await bis(async () => (await t.locator('#d-title').count()) === 1 && await t.evaluate((i) => document.querySelector('#d-ki [data-act="kat-weg"]') !== null && !document.querySelector(`[data-open="${i}"]`), id1)), 'Die neue ist offen, die alte nirgends mehr');
check(await bis(() => !!kat(mar).rezepte[id2] && !kat(mar).rezepte[id1], 8000), 'Auch bei Marielle: die neue statt der alten');
// Mit KI ändern: Das Rezept selbst ändert sich – an seiner Stelle, für alle, kein zweites daneben; die Liste zieht mit
await t.click('#detail [data-act="alle-dazu"]');
check(await bis(() => !!gh(haupt).items?.['ki-kokosmilch']?.parts?.[id2] && !!gh(haupt).items?.zwiebeln?.parts?.[id2], 8000), 'die Suppe steht auf der Liste, mit Kokosmilch');
const vorAt = kat(haupt).rezepte[id2].at;
antwort = ohneKokos;
await t.click('[data-act="anpassen-ki"]');
await t.fill('#anp-ki-text', 'ohne Kokosmilch');
await t.click('#anp-ki-los');
check(await bis(async () => (await t.locator('.anp-ki-wunsch').innerText().catch(() => '')) === 'Dein Wunsch: „ohne Kokosmilch“', 10000), 'die KI hat geändert – der Wunsch bleibt sichtbar');
check((await t.locator('#d-anpassen .anp-btns [data-act="anp-speichern"]').innerText()) === 'Speichern, für alle' && (await t.locator('#d-anpassen .anp-btns + .fine').innerText()).includes('ändert das Rezept selbst'), 'beim Katalogrezept: „Speichern, für alle“ – es ändert das Rezept selbst');
await t.click('[data-act="anp-speichern"]');
check(await bis(() => { const e = kat(haupt).rezepte[id2]; return Object.keys(kat(haupt).rezepte).length === 1 && e?.k.name === OHNE_KOKOS_NAME && e.at > vorAt && e.wunsch === 'Kürbissuppe' && e.by === 'Tobi' && e.k.geaendert?.[0] === '„ohne Kokosmilch“' && e.k.geaendert.includes('Kokosmilch light weggelassen') && !e.k.zutaten.some((z) => /kokosmilch/i.test(z.name)); }, 10000), 'in katalog.json: dieselbe id, neu, ohne Kokosmilch – Wunsch und wer bleiben, „ohne Kokosmilch“ unter geändert');
check(!Object.keys(gh(haupt).ki || {}).length && haupt.zustand.nachrichten.includes('Tobi: Katalog – „Kürbissuppe“ geändert'), 'kein zweites Rezept daneben; Commit „… geändert“');
check(await bis(async () => (await t.locator('#d-title').innerText().catch(() => '')) === OHNE_KOKOS_NAME && (await t.locator('#d-ki').innerText()).includes('Geändert: „ohne Kokosmilch“') && (await t.locator('#d-ki').innerText()).includes('Ohne Kokosmilch – die Suppe wird nur püriert.')), 'offen: die geänderte Suppe, „Geändert: „ohne Kokosmilch““ und der Hinweis der KI');
check(await bis(() => !gh(haupt).items?.['ki-kokosmilch']?.parts?.[id2] && !!gh(haupt).items?.zwiebeln?.parts?.[id2], 8000), 'auf der Liste: die Kokosmilch ist runter, der Rest bleibt');
await t.click('#detail [data-act="zurueck"]');
check(await bis(async () => (await t.locator('#grid .box').first().getAttribute('data-open')) === id2 && (await t.locator('#r-eyebrow').textContent()) === '51 Rezepte · je 8 Boxen'), 'im Raster an derselben Stelle, weiter 51 Rezepte');
check(await bis(() => kat(mar).rezepte[id2]?.k.name === OHNE_KOKOS_NAME, 8000), 'Marielles Katalog bekommt die geänderte');
antwort = SUPPE;
await t.click(`[data-open="${id2}"]`);
check(tobi.fehler.length === 0, `Tobi: keine Fehler im Browser (${tobi.fehler.join(' | ')})`);

// Marielle: ihre Liste, ihr Ziel, 2 Boxen – die Suppe ist da, auf sie gerechnet
const marielle = await handy(browser, { attrappe: alle });
const m = marielle.page;
await m.evaluate((key) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: key, name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle' })); localStorage.setItem('boxenstopp.willkommen.v1', 'true'); }, M_KEY);
await m.reload();
await m.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(() => m.locator(`#grid [data-open="${id2}"]`).count()), 'Marielle: die Kürbissuppe ist in ihrem Raster');
const ihre = m.locator(`#grid [data-open="${id2}"]`);
const marKcal = Number((await ihre.locator('.box-macros b').innerText()).replace(/\D/g, ''));
check((await ihre.innerText()).includes('Neu · von Tobi') && Math.abs(marKcal - MARIELLE.kcal) <= 15 && tobiKcal - marKcal > 40, `„Neu · von Tobi“ – bei ihr ${marKcal} kcal pro Box (ihr Ziel ${MARIELLE.kcal}), bei Tobi ${tobiKcal}`);
await ihre.click();
const d = await m.locator('#detail').innerText();
check(d.includes('für 2 Boxen') && d.includes('gewünscht von Tobi'), 'Im Rezept: für 2 Boxen, gewünscht von Tobi');
// Sie nimmt sie heraus
await m.click('#d-ki [data-act="kat-weg"]');
check(await bis(async () => (await m.locator('#toast').innerText()).includes('„Kürbissuppe“ ist aus dem Katalog')), 'Meldung: „Kürbissuppe“ ist aus dem Katalog – mit Rückgängig');
check(await bis(() => !kat(mar).rezepte[id2] && !!kat(mar).weg[id2]) && await m.locator('#detail').isHidden() && !(await m.locator(`#grid [data-open="${id2}"]`).count()), 'Bei ihr: weg aus katalog.json und aus dem Raster');
check(marielle.fehler.length === 0, `Marielle: keine Fehler im Browser (${marielle.fehler.join(' | ')})`);
await marielle.ctx.close();
// Tobis Handy kommt wieder nach vorn: abgleichen – weg auch bei euch
await t.reload();
await t.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(() => !kat(haupt).rezepte[id2] && !!kat(haupt).weg[id2], 10000), 'Tobis Handy gleicht ab: aus eurer katalog.json auch heraus');
check(await bis(async () => (await t.locator('#r-eyebrow').textContent()) === '50 Rezepte · je 8 Boxen' && !(await t.locator(`#grid [data-open="${id2}"]`).count())), 'Und aus Tobis Raster: wieder 50');
check(tobi.fehler.length === 0, `Tobi: auch danach keine Fehler (${tobi.fehler.join(' | ')})`);
await tobi.ctx.close();

// Ohne gemeinsame Liste: ein Vorschlag wie bei der Resteverwertung
const allein = await handy(browser);
await allein.ctx.route('https://generativelanguage.googleapis.com/**', gemini);
const a = allein.page;
await a.evaluate((g) => localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: g })), GKEY);
await a.reload();
await a.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await a.click('#browse [data-act="wunsch"]');
check((await a.locator('#reste .d-desc').innerText()).includes('mit einer gemeinsamen Liste käme es gleich in den Katalog'), 'Ohne gemeinsame Liste: der Hinweis, dass es dann nur ein Vorschlag ist');
await a.fill('#k-text', 'Kürbissuppe');
await a.click('#k-los');
check(await bis(async () => (await a.locator('#d-title').count()) === 1, 10000) && (await a.locator('#d-ki').innerText()).includes('Neues Rezept') && (await a.locator('#d-ki').innerText()).includes('Behalten'), 'Es öffnet als Vorschlag („Neues Rezept“, Behalten)');
check(allein.fehler.length === 0, `Ohne Liste: keine Fehler im Browser (${allein.fehler.join(' | ')})`);
await allein.ctx.close();
await browser.close();

ende();
