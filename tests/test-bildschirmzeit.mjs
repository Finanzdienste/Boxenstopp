/*
 * Bildschirmzeit fürs Widget auf Tobis Startbildschirm: js/bildschirmzeit.js
 * (wortgleich aus Finanzdienste/Bildschirmzeit) und
 * js/ansicht-bildschirmzeit.js, gegen eine nachgebaute Supabase-API – nie
 * die echte (BILDSCHIRMZEIT in tests/hilfe.mjs), und nur mit erfundenen
 * Kennungen.
 *
 * Ohne Browser: Das Modul nimmt seinen Link, bevor die App die Adresse liest
 * (app.js ruft es als Erstes, kein anderes Modul liest die Adresse beim Laden
 * oder hört auf hashchange), und kein Teil der App sammelt den ganzen
 * Speicher ein. Im Browser: ohne Link passiert nichts (keine Anfrage, kein
 * Speicher, kein Wort davon in der App); der Link verbindet, die App startet
 * wie ohne ihn, die Adresse ist sauber, der Hinweis kommt, die Karte in den
 * Einstellungen; die Zeit zählt nur sichtbar, Wegschalten schickt mit
 * keepalive; ein Fehler steht auf der Karte; „false“ trennt von selbst;
 * „Trennen“ und ein Link, während die App offen ist (hashchange) – die
 * Einträge von Freizeit und Workout am selben Ort bleiben. Die bisherigen
 * Links (#zugang=, #ki=, #gaeste=, #einkauf) wirken wie vorher, der neue löst
 * keinen davon aus. Die Kennung landet nie in der Liste bei GitHub, im Link
 * fürs zweite Handy oder im Fehlerbericht; die lila Fassung meldet als
 * „boxenstopp“. Mit Service Worker: Er legt den Aufruf mit dem Link ab, aber
 * ohne den Teil hinter # – die Kennung steht in keinem Vorrat.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import * as espree from 'espree';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';
import { gaesteFuerLink } from '../js/gaeste.js';

const { check, ende } = pruefer();
// Erfunden, 43 Zeichen wie die echten (32 Byte, base64url)
const K = 'TestKennungFuerDasWidget_0123456789abcdefgh';
const K2 = 'ZweiteKennungAusDerWidgetApp-9876543210ZYXW';
const SB_KEY = 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI';
const GKEY = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
const M_KEY = 'github_pat_11MARIELLE000000000000_abcdefghijklmnopqrstuvwxyz';

/* ------------------------------------------------------ Ohne Browser */

const js = readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
const quelle = Object.fromEntries(js.map((f) => [f, readFileSync(path.join(ROOT, 'js', f), 'utf8')]));
const andere = js.filter((f) => f !== 'bildschirmzeit.js');
check(!andere.some((f) => /addEventListener\(\s*['"]hashchange|onhashchange/.test(quelle[f])), 'außer dem Modul hört kein Teil der App auf hashchange');
/*
 * Wer liest die Adresse (location.hash) – und läuft das schon beim Laden?
 * Beim Laden laufen erst alle importierten Module, dann app.js von oben; nur
 * dort darf es geschehen (nach dem Modul, siehe unten). Für jedes Modul: was
 * auf oberster Ebene steht und gleich läuft („datei:“, auch Rückrufe darin –
 * sicher('…', () => …) ruft sofort), und jede Funktion oben im Modul
 * („datei:name“). Liest eine die Adresse oder nennt eine, die es tut (auch
 * über Importe, über beliebig viele Stufen), liest sie mit.
 */
const FUNKTION = /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;
const istHash = (n) => n.type === 'MemberExpression' && !n.computed && n.property.name === 'hash'
  && (n.object.type === 'Identifier' ? n.object.name === 'location'
    : n.object.type === 'MemberExpression' && !n.object.computed && n.object.property.name === 'location' && /^(?:window|document|globalThis|self)$/.test(n.object.object.name || ''));
function wasLiestDieAdresse(quellen) {
  const besitzer = new Map();
  for (const [datei, text] of Object.entries(quellen)) {
    if (datei === 'bildschirmzeit.js') continue;
    const baum = espree.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
    const oben = new Map(); // Name oben im Modul (auch importiert) → 'datei:name'
    const teile = [];
    for (const s of baum.body) {
      if (s.type === 'ImportDeclaration') {
        for (const sp of s.specifiers) if (sp.type === 'ImportSpecifier') oben.set(sp.local.name, `${path.basename(s.source.value)}:${sp.imported.name}`);
        continue;
      }
      const d = /^Export(?:Named|Default)Declaration$/.test(s.type) ? s.declaration : s;
      if (d?.type === 'FunctionDeclaration' && d.id) { oben.set(d.id.name, `${datei}:${d.id.name}`); teile.push([`${datei}:${d.id.name}`, d.body]); continue; }
      if (d?.type === 'VariableDeclaration') {
        for (const v of d.declarations) {
          if (v.id.type === 'Identifier') oben.set(v.id.name, `${datei}:${v.id.name}`);
          teile.push([v.id.type === 'Identifier' && FUNKTION.test(v.init?.type || '') ? `${datei}:${v.id.name}` : `${datei}:`, v.init]);
        }
        continue;
      }
      teile.push([`${datei}:`, s]);
    }
    for (const [wer, knoten] of teile) {
      if (!besitzer.has(wer)) besitzer.set(wer, { liest: false, nennt: new Set() });
      const b = besitzer.get(wer);
      const geh = (n, eltern, feld) => {
        if (!n || typeof n.type !== 'string') return;
        if (istHash(n)) b.liest = true;
        const nurName = (eltern?.type === 'MemberExpression' && feld === 'property' && !eltern.computed)
          || (/^(?:Property|MethodDefinition|PropertyDefinition)$/.test(eltern?.type || '') && feld === 'key' && !eltern.computed);
        if (n.type === 'Identifier' && !nurName && oben.has(n.name)) b.nennt.add(oben.get(n.name));
        for (const [k, v] of Object.entries(n)) for (const kind of Array.isArray(v) ? v : [v]) if (kind && typeof kind.type === 'string') geh(kind, n, k);
      };
      geh(knoten, null, '');
    }
  }
  const liest = new Set([...besitzer].filter(([, b]) => b.liest).map(([w]) => w));
  for (let neu = true; neu;) {
    neu = false;
    for (const [w, b] of besitzer) if (!liest.has(w) && [...b.nennt].some((x) => liest.has(x))) { liest.add(w); neu = true; }
  }
  return [...liest].sort();
}
const beimLaden = (q) => wasLiestDieAdresse(q).filter((w) => w.endsWith(':'));
const lesenHash = wasLiestDieAdresse(quelle);
check(JSON.stringify(beimLaden(quelle)) === '["app.js:"]', `beim Laden liest nur app.js die Adresse, kein importiertes Modul – die anderen nur in Funktionen, die erst start() aufruft (${lesenHash.join(', ')})`);
// Die Prüfung selbst: Sie fände, was sie finden soll
const zugang = quelle['zugang.js'];
check(JSON.stringify(beimLaden({ ...quelle, 'zugang.js': `const h = location.hash;\n${zugang}` })) === '["app.js:","zugang.js:"]'
  && beimLaden({ ...quelle, 'zugang.js': `${zugang}\nsicher('x', () => window.location.hash);` }).includes('zugang.js:')
  && beimLaden({ ...quelle, 'kern.js': `import { linkAusAdresse } from './zugang.js';\nconst hilf = () => linkAusAdresse();\n${quelle['kern.js']}\nexport const x = hilf();` }).includes('kern.js:'), 'die Prüfung fände es: oben in zugang.js gelesen, in einem Rückruf, der gleich läuft, oder über einen Import und eine Hilfsfunktion beim Laden aufgerufen');
const appJs = quelle['app.js'];
const ersteAnweisung = espree.parse(appJs, { ecmaVersion: 'latest', sourceType: 'module' }).body.find((s) => s.type !== 'ImportDeclaration');
check(ersteAnweisung?.type === 'ExpressionStatement' && ersteAnweisung.expression.callee?.name === 'sicher' && ersteAnweisung.expression.arguments[1]?.name === 'bildschirmzeitStart', 'app.js: die erste Anweisung nach den Importen ist sicher(\'Bildschirmzeit\', bildschirmzeitStart)');
const aufruf = appJs.indexOf("sicher('Bildschirmzeit', bildschirmzeitStart);");
check(aufruf > 0 && aufruf < appJs.indexOf('location.hash') && aufruf < appJs.indexOf('\nstart();') && aufruf < appJs.indexOf("addEventListener('visibilitychange'"), 'app.js: das Modul startet als Erstes nach den Importen – vor start(), das die Adresse liest');
check(/^import \{[^}]*bildschirmzeitStart[^}]*\} from '\.\/ansicht-bildschirmzeit\.js';$/m.test(appJs) && /import \{[^}]*bildschirmzeitStarten[^}]*\} from '\.\/bildschirmzeit\.js';/.test(quelle['ansicht-bildschirmzeit.js'] || ''), 'app.js holt ansicht-bildschirmzeit.js, das holt js/bildschirmzeit.js');
check(quelle['bildschirmzeit.js']?.includes('Quelle: Finanzdienste/Bildschirmzeit, web/bildschirmzeit.js'), 'js/bildschirmzeit.js ist die Kopie aus Finanzdienste/Bildschirmzeit');
const allesEinsammeln = /localStorage\.(?:key|length|clear)\b|Object\.(?:keys|entries|values)\(localStorage\)|\.\.\.localStorage|\bin localStorage\)/;
const sammler = [...js.map((f) => [f, quelle[f]]), ['index.html', readFileSync(path.join(ROOT, 'index.html'), 'utf8')], ['sw.js', readFileSync(path.join(ROOT, 'sw.js'), 'utf8')]]
  .filter(([, s]) => allesEinsammeln.test(s)).map(([f]) => f);
check(!sammler.length, `kein Teil der App sammelt den ganzen Speicher ein – bildschirmzeit.* bleibt so bei keinem Abgleich, Link oder Bericht dabei${sammler.length ? ` (${sammler.join(', ')})` : ''}`);

/* ------------------------------------------------------------ Browser */

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
/** Supabase für die Bildschirmzeit: merkt sich jede Anfrage, antwortet mit `antwort` (true/false) oder `status`. */
function supabaseAttrappe() {
  const zustand = { anfragen: [], antwort: true, status: 200 };
  return {
    zustand,
    route: (r) => {
      const q = r.request();
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      let body = null;
      try { body = JSON.parse(q.postData() || 'null'); } catch { body = null; }
      zustand.anfragen.push({ name: q.url().split('/rpc/')[1], methode: q.method(), apikey: q.headers().apikey || '', auth: q.headers().authorization || '', roh: q.postData() || '', body });
      return r.fulfill({ status: zustand.status, headers: { ...CORS, 'content-type': 'application/json' }, body: zustand.status === 200 ? JSON.stringify(zustand.antwort) : '{"message":"kaputt"}' });
    },
  };
}
// Schreibt mit, wie die App fetch aufruft – keepalive sieht man an der Anfrage selbst nicht
const MITSCHNITT = () => {
  const echt = window.fetch;
  window.__bz = [];
  window.fetch = (eingabe, opt) => {
    const url = String(eingabe?.url || eingabe);
    if (url.includes('/rpc/bildschirmzeit_')) window.__bz.push({ url, keepalive: !!opt?.keepalive });
    return echt.call(window, eingabe, opt);
  };
};
const warte = (ms) => new Promise((f) => { setTimeout(f, ms); });
const tab = (p) => p.evaluate(() => document.querySelector('#app').dataset.tab);
const heute = (p) => p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
const eintraege = (p) => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('bildschirmzeit')).map((k) => [k, localStorage.getItem(k)])));
const gespeichert = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('bildschirmzeit.boxenstopp') || 'null'));
const toast = (p) => p.evaluate(() => document.querySelector('#toast').textContent);
const karte = (p) => p.locator('#e-bz-karte');
const karteText = async (p) => ((await karte(p).count()) ? (await karte(p).innerText()).replace(/\s+/g, ' ') : '');
/** Wegschalten oder zurückkommen – so, wie der Browser es der Seite sagt. */
const sichtbar = (p, ja) => p.evaluate((j) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (j ? 'visible' : 'hidden') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !j });
  document.dispatchEvent(new window.Event('visibilitychange'));
}, ja);
const melden = (sb) => sb.zustand.anfragen.filter((a) => a.name === 'bildschirmzeit_melden');

const browser = await starteBrowser();

// --- (a) Ohne Link: völlig still
const sbA = supabaseAttrappe();
const a = await handy(browser, { bildschirmzeit: sbA, skript: MITSCHNITT });
const ap = a.page;
const startOhne = await tab(ap);
await warte(1200);
await sichtbar(ap, false);
await sichtbar(ap, true);
await warte(300);
check(sbA.zustand.anfragen.length === 0 && (await ap.evaluate(() => window.__bz.length)) === 0, 'ohne Link: keine Anfrage an bildschirmzeit_*, auch nicht beim Wegschalten');
check(!Object.keys(await eintraege(ap)).length, 'ohne Link: nichts im Speicher');
await ap.click('.tabbar .tab[data-tab="einstellungen"]');
check(!(await karte(ap).count()) && await ap.evaluate(() => !/bildschirmzeit|widget/i.test(document.body.innerHTML)), 'ohne Link: keine Karte in den Einstellungen, in der ganzen App kein Wort davon – auch nicht versteckt');
check(a.fehler.length === 0, `ohne Link: keine Fehler im Browser (${a.fehler.join(' | ')})`);
await a.ctx.close();

// --- (b) Der Link aus der Widget-App
const sb = supabaseAttrappe();
const vorDemLink = Date.now();
const b = await handy(browser, { bildschirmzeit: sb, skript: MITSCHNITT, adresse: `${APP_URL}#bildschirmzeit=${K}` });
const p = b.page;
const tagHeute = await heute(p);
check(await tab(p) === startOhne && await p.locator('#browse').isVisible(), `der Link öffnet die App wie sonst – Startansicht „${startOhne}“`);
check(await p.evaluate(() => location.hash === '' && !location.href.includes('bildschirmzeit') && location.pathname.endsWith('/index.html')), 'danach steht der Link nicht mehr in der Adresse');
check(await bis(() => melden(sb).length >= 1), 'gleich danach: POST an bildschirmzeit_melden');
const erste = melden(sb)[0] || {};
check(erste.methode === 'POST' && erste.body?.p_app === 'boxenstopp' && erste.body?.p_kennung === K, 'mit p_app „boxenstopp“ und der Kennung aus dem Link');
check(erste.apikey === SB_KEY && !erste.auth, 'Kopf apikey mit dem öffentlichen Schlüssel, kein Authorization');
check(JSON.stringify(erste.body?.p_tage) === JSON.stringify({ [tagHeute]: 0 }), `gleich nach dem Verbinden: heute mit 0 – damit die Widget-App „verbunden“ sieht (${JSON.stringify(erste.body?.p_tage)})`);
check(await bis(async () => (await toast(p)).includes('Bildschirmzeit verbunden')), `Hinweis unten: „Bildschirmzeit verbunden …“ (${await toast(p)})`);
check(JSON.stringify(Object.keys(await eintraege(p))) === JSON.stringify(['bildschirmzeit.boxenstopp']) && (await gespeichert(p))?.kennung === K, 'gemerkt nur unter bildschirmzeit.boxenstopp, mit der Kennung');
check(!(await karte(p).count()) || !(await karte(p).isVisible()), 'bei den Rezepten keine Karte');
await p.click('.tabbar .tab[data-tab="einstellungen"]');
check(await karte(p).isVisible() && await p.evaluate(() => document.querySelector('#e-bz-karte').previousElementSibling?.id === 'e-waage-karte'), 'Einstellungen: die Karte „Bildschirmzeit“, gleich nach der Waage');
check(/Verbunden mit deinem Widget\. Heute unter 1 Min\. offen, zuletzt gemeldet um \d\d:\d\d\./.test(await karteText(p)) && await karte(p).locator('[data-act="bz-trennen"]').isVisible(), `„Verbunden mit deinem Widget. Heute unter 1 Min. offen, zuletzt gemeldet um …“ und „Trennen“ (${await karteText(p)})`);
check(!(await karteText(p)).includes('nicht durchgekommen'), 'kein Fehler auf der Karte');

// --- (c) Die Zeit zählt, solange die App zu sehen ist; Wegschalten schickt mit keepalive
await warte(2600);
const vorher = melden(sb).length;
await sichtbar(p, false);
check(await bis(() => melden(sb).length > vorher), 'Wegschalten: noch eine Meldung');
const weg = melden(sb).at(-1) || {};
const bisJetzt = (Date.now() - vorDemLink) / 1000;
check(weg.body?.p_tage?.[tagHeute] >= 2 && weg.body.p_tage[tagHeute] <= bisJetzt + 1, `mit der Zeit, die sie offen war (${weg.body?.p_tage?.[tagHeute]} s, höchstens ${Math.round(bisJetzt)} s)`);
check((await p.evaluate(() => window.__bz.at(-1)))?.keepalive === true && weg.roh?.length < 300, `mit keepalive, klein (${weg.roh?.length} Byte)`);
const heuteGespeichert = async () => (await gespeichert(p))?.tage?.[tagHeute] ?? NaN;
const versteckt = await heuteGespeichert();
await warte(2500);
await sichtbar(p, true);
check((await heuteGespeichert()) - versteckt < 1, `weggeschaltet zählt nicht (${versteckt} → ${await heuteGespeichert()})`);
check(await bis(async () => /Verbunden mit deinem Widget\. Heute unter 1 Min\. offen, zuletzt gemeldet um \d\d:\d\d\./.test(await karteText(p))), 'die Karte bleibt beim Stand');

// Kommt die Meldung nicht durch: steht auf der Karte; die nächste, die durchgeht, nimmt es wieder weg
sb.zustand.status = 503;
await warte(1600);
await sichtbar(p, false);
await sichtbar(p, true);
check(await bis(async () => (await karteText(p)).includes('Zuletzt nicht durchgekommen: Fehler 503.')), `ein Fehler: „Zuletzt nicht durchgekommen: Fehler 503.“ (${await karteText(p)})`);
sb.zustand.status = 200;
await warte(1600);
await sichtbar(p, false);
await sichtbar(p, true);
check(await bis(async () => !(await karteText(p)).includes('nicht durchgekommen') && (await karteText(p)).includes('Verbunden mit deinem Widget')), 'danach durchgekommen: der Fehler ist weg');
const tage = melden(sb).map((x) => x.body?.p_tage?.[tagHeute]);
check(tage.every((t, i) => i === 0 || t >= tage[i - 1]), `geschickt wird der Tagesstand, er wächst nur (${tage.join(', ')})`);

// --- (d) Kennt die Widget-App die Kennung nicht mehr (false): von selbst getrennt
sb.zustand.antwort = false;
await warte(1600);
await sichtbar(p, false);
await sichtbar(p, true);
check(await bis(async () => !(await karte(p).count())), 'Antwort false: die Karte ist weg');
check(!Object.keys(await eintraege(p)).length && (await toast(p)).includes('Bildschirmzeit getrennt'), `nichts mehr im Speicher, Hinweis „Bildschirmzeit getrennt …“ (${await toast(p)})`);
const nachFalse = sb.zustand.anfragen.length;
await warte(1600);
await sichtbar(p, false);
await sichtbar(p, true);
await warte(500);
check(sb.zustand.anfragen.length === nachFalse, 'danach schickt die App nichts mehr');

// --- (e) Ein Link, während die App offen ist (hashchange), dann „Trennen“ – Freizeit und Workout am selben Ort bleiben
sb.zustand.antwort = true;
const fremd = { 'bildschirmzeit.freizeit': JSON.stringify({ v: 1, kennung: K, tage: { [tagHeute]: 600 }, gemeldet: {} }), 'bildschirmzeit.workout': JSON.stringify({ v: 1, kennung: K, tage: { [tagHeute]: 1200 }, gemeldet: {} }) };
await p.evaluate((f) => { for (const [k, v] of Object.entries(f)) localStorage.setItem(k, v); }, fremd);
const vorLink = sb.zustand.anfragen.length;
await p.evaluate((k) => { location.hash = `bildschirmzeit=${k}`; }, K2);
check(await bis(async () => (await karte(p).count()) && (await karteText(p)).includes('Verbunden mit deinem Widget')), 'Link bei offener App: gleich verbunden, die Karte ist da');
check(await p.evaluate(() => location.hash === '') && await tab(p) === 'einstellungen' && (await gespeichert(p))?.kennung === K2, 'die Adresse wieder sauber, die App bleibt, wo sie war, die neue Kennung gemerkt');
check(await bis(() => sb.zustand.anfragen.slice(vorLink).some((x) => x.body?.p_kennung === K2 && x.body?.p_app === 'boxenstopp')), 'und gemeldet – mit der neuen Kennung');
if (await karte(p).count()) await karte(p).locator('[data-act="bz-trennen"]').click();
check(await bis(async () => !(await karte(p).count())) && (await toast(p)).includes('Bildschirmzeit getrennt'), `„Trennen“: die Karte ist weg, Hinweis (${await toast(p)})`);
const danach = await eintraege(p);
check(!('bildschirmzeit.boxenstopp' in danach) && danach['bildschirmzeit.freizeit'] === fremd['bildschirmzeit.freizeit'] && danach['bildschirmzeit.workout'] === fremd['bildschirmzeit.workout'], 'weg ist nur bildschirmzeit.boxenstopp – die Einträge von Freizeit und Workout bleiben unberührt');
const nachTrennen = sb.zustand.anfragen.length;
await warte(1600);
await sichtbar(p, false);
await sichtbar(p, true);
await warte(500);
check(sb.zustand.anfragen.length === nachTrennen, 'getrennt: nichts mehr geschickt');
check(sb.zustand.anfragen.every((x) => x.body?.p_app === 'boxenstopp'), 'Boxenstopp meldet immer nur als „boxenstopp“ – nie für Freizeit oder Workout');
check(b.fehler.length === 0, `keine Fehler im Browser (${b.fehler.join(' | ')})`);
await b.ctx.close();

// --- (f) Die bisherigen Links wirken wie vorher – und #bildschirmzeit= löst keinen davon aus
const sbF = supabaseAttrappe();
const z = await handy(browser, { bildschirmzeit: sbF, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
check(await tab(z.page) === 'einstellungen' && (await z.page.inputValue('#z-token')) === SCHLUESSEL && !(await z.page.evaluate(() => location.hash)), '#zugang=: die Einstellungen, der Schlüssel steht im Formular, die Adresse ist sauber');
check(!sbF.zustand.anfragen.length && !Object.keys(await eintraege(z.page)).length, '#zugang=: keine Bildschirmzeit');
await z.ctx.close();
const k = await handy(browser, { bildschirmzeit: sbF, adresse: `${APP_URL}#ki=${encodeURIComponent(GKEY)}` });
check(await k.page.evaluate((g) => JSON.parse(localStorage.getItem('boxenstopp.ki.v1') || '{}').schluessel === g, GKEY) && await bis(async () => (await toast(k.page)).includes('KI-Schlüssel übernommen')), '#ki=: der KI-Schlüssel ist übernommen');
check(!sbF.zustand.anfragen.length && !Object.keys(await eintraege(k.page)).length, '#ki=: keine Bildschirmzeit');
await k.ctx.close();
const e = await handy(browser, { bildschirmzeit: sbF, adresse: `${APP_URL}#einkauf` });
check(await tab(e.page) === 'einkauf', '#einkauf: die Einkaufsliste');
await e.ctx.close();

// Tobis Handy mit eurer Liste: der Umzugs-Link (#gaeste=) wie bisher, dann der Bildschirmzeit-Link
const gh = githubAttrappe();
const umzug = gaesteFuerLink([{ name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle', token: M_KEY, farbe: 'lila', at: '', ki: false }]);
const t = await handy(browser, { attrappe: gh, bildschirmzeit: sbF });
const tp = t.page;
await tp.evaluate((s) => localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: s, name: 'Tobi' })), SCHLUESSEL);
const grund = `${APP_URL.replace(/index\.html$/, '')}icon.svg`;
await tp.goto(grund);
await tp.goto(`${APP_URL}#gaeste=${umzug}`);
await tp.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await tp.locator('#e-gaeste .g-fertig').innerText().catch(() => '')).includes('Vom alten Handy: Marielle')) && await tab(tp) === 'einstellungen' && !(await tp.evaluate(() => location.hash)), '#gaeste=: die Einstellungen fragen nach Marielle, die Adresse ist sauber');
check(!sbF.zustand.anfragen.length && !Object.keys(await eintraege(tp)).length, '#gaeste=: keine Bildschirmzeit');
await tp.click('.tabbar .tab[data-tab="rezepte"]');
await tp.goto(grund);
await tp.goto(`${APP_URL}#bildschirmzeit=${K}`);
await tp.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await tp.locator('#sync-text').innerText()) === 'Geteilt') && await tab(tp) === 'rezepte', '#bildschirmzeit= auf Tobis Handy: die Liste bleibt verbunden, die App da, wo sie war');
check(await bis(() => sbF.zustand.anfragen.some((x) => x.body?.p_kennung === K)) && (await gespeichert(tp))?.kennung === K, 'und die Bildschirmzeit ist verbunden');
await tp.click('.tabbar .tab[data-tab="einstellungen"]');
check(!(await tp.locator('#e-zugang #z-form').count()) && !(await tp.locator('#e-gaeste .g-fertig').count()) && !(await tp.evaluate(() => localStorage.getItem('boxenstopp.ki.v1'))) && !(await toast(tp)).includes('Gäste'), '#bildschirmzeit= löst keinen anderen Weg aus: kein Formular, keine Gäste, kein KI-Schlüssel');
check(await karte(tp).isVisible(), 'die Karte steht in den Einstellungen');
check(t.fehler.length === 0, `Tobis Handy: keine Fehler im Browser (${t.fehler.join(' | ')})`);
await t.ctx.close();

// --- (g) Die Kennung geht nirgends mit: nicht in die Liste bei GitHub, nicht in den Link, nicht in den Fehlerbericht
const gh2 = githubAttrappe();
const sbG = supabaseAttrappe();
const n = await handy(browser, { attrappe: gh2, bildschirmzeit: sbG, adresse: `${APP_URL}#bildschirmzeit=${K}` });
const np = n.page;
check(await bis(() => melden(sbG).length >= 1), 'neues Gerät: Bildschirmzeit verbunden');
// Was nur auf diesem Gerät stand, kommt beim Einrichten mit in die gemeinsame Liste – die Bildschirmzeit nicht
await np.click('.tabbar .tab[data-tab="einkauf"]');
await np.fill('#add-input', 'Kaffee');
await np.press('#add-input', 'Enter');
await np.goto(grund);
await np.goto(`${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}`);
await np.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await np.fill('#z-name', 'Tobi');
await np.click('#z-los');
check(await bis(() => JSON.stringify(gh2.liste() || {}).includes('Kaffee'), 8000), 'eingerichtet: die lokale Liste ist in GitHub');
await warte(1000);
check(!JSON.stringify(gh2.zustand).includes(K) && !JSON.stringify(gh2.zustand).includes('bildschirmzeit'), 'in GitHub (Liste, Dateien, Commits) steht nichts von der Bildschirmzeit');
await np.click('.tabbar .tab[data-tab="einstellungen"]');
const zweites = await np.evaluate(() => document.querySelector('#z-linkfeld')?.value || '');
check(zweites.includes('#zugang=') && !zweites.includes(K) && !zweites.includes('bildschirmzeit'), 'der Link fürs zweite Handy nimmt die Kennung nicht mit');
check((await gespeichert(np))?.kennung === K && await karte(np).isVisible(), 'die Bildschirmzeit bleibt verbunden');
await np.evaluate(async (kennung) => {
  const f = await import('./js/fehler.js');
  f.fehlerMerken('Test', new Error(`kaputt bei ${location.origin}${location.pathname}#bildschirmzeit=${kennung}`));
}, K);
await np.click('.tabbar .tab[data-tab="rezepte"]');
await np.click('.tabbar .tab[data-tab="einstellungen"]');
await np.evaluate(() => { window.__kopiert = ''; navigator.clipboard.writeText = async (x) => { window.__kopiert = x; }; });
await np.click('#e-ueber [data-act="e-fehler-kopieren"]');
const bericht = await bis(() => np.evaluate(() => window.__kopiert));
check(bericht.includes('bildschirmzeit=…') && !bericht.includes(K) && !(await np.evaluate(() => localStorage.getItem('boxenstopp.fehler.v1'))).includes(K), `Fehlerbericht: die Kennung unkenntlich, auch im gemerkten Fehler (${bericht.split('\n').at(-1)})`);
check(n.fehler.length === 0, `neues Gerät: keine Fehler im Browser (${n.fehler.join(' | ')})`);
await n.ctx.close();

// Marielles lila Fassung (ihre eigene Liste): derselbe Code, dieselbe App-Kennung
const mar = githubAttrappe({ schluessel: M_KEY, repo: 'Boxenstopp-Marielle' });
mar.zustand.datei = JSON.stringify({ version: 1, rev: 1, items: {}, profil: { person: 'Marielle', farbe: 'lila' }, leute: { marielle: 'Marielle' } });
mar.zustand.version = 1;
mar.zustand.sha = 'sha1';
const sbL = supabaseAttrappe();
const l = await handy(browser, { attrappe: mar, bildschirmzeit: sbL });
await l.page.evaluate((s) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: s, name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle' })); localStorage.setItem('boxenstopp.willkommen.v1', 'true'); }, M_KEY);
await l.page.goto(grund);
await l.page.goto(`${APP_URL}#bildschirmzeit=${K2}`);
await l.page.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await l.page.locator('#sync-text').innerText()) === 'Gespeichert') && await bis(() => l.page.evaluate(() => document.documentElement.dataset.farbe === 'lila' && document.querySelector('link[rel="manifest"]').getAttribute('href') === 'manifest-lila.webmanifest')), 'lila: Marielles Liste, die App lila mit dem lila Manifest');
check(await bis(() => melden(sbL).length >= 1) && melden(sbL).every((x) => x.body?.p_app === 'boxenstopp' && x.body?.p_kennung === K2) && JSON.stringify(Object.keys(await eintraege(l.page))) === JSON.stringify(['bildschirmzeit.boxenstopp']), 'lila: meldet als „boxenstopp“, gemerkt unter bildschirmzeit.boxenstopp');
check(l.fehler.length === 0, `lila: keine Fehler im Browser (${l.fehler.join(' | ')})`);
await l.ctx.close();

// --- (h) Mit Service Worker: Er legt den Seitenaufruf ab, aber ohne den Teil hinter # – die Kennung bleibt nur im localStorage
const VORRAT = `boxenstopp-${readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1]}`;
const sbW = supabaseAttrappe();
const w = await handy(browser, { bildschirmzeit: sbW, ohneWorker: false });
const wp = w.page;
check(await bis(() => wp.evaluate(async (v) => !!navigator.serviceWorker.controller && await caches.has(v), VORRAT), 20000), `mit Service Worker: er steuert die App, der Vorrat ${VORRAT} ist da`);
// Die abgelegte Seite weg – dann zeigt ihr Wiederkommen, dass der Aufruf mit dem Link abgelegt wurde
await wp.evaluate((v) => caches.open(v).then((c) => c.delete('index.html')), VORRAT);
await wp.goto(grund);
await wp.goto(`${APP_URL}#bildschirmzeit=${K}`);
await wp.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
const abgelegt = await bis(() => wp.evaluate(async (v) => (await (await caches.open(v)).keys()).some((r) => new URL(r.url).pathname.endsWith('/index.html')), VORRAT), 10000);
const mitAnker = await wp.evaluate(async (k) => {
  const treffer = [];
  for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) if (r.url.includes('#') || r.url.includes(k)) treffer.push(`${n}: ${r.url.replace(k, '<Kennung>')}`);
  return treffer;
}, K);
check(abgelegt && !mitAnker.length, `mit Service Worker: der Aufruf mit dem Link liegt im Vorrat – ohne den Teil hinter #, die Kennung steht in keinem Vorrat (${mitAnker.join(', ') || 'keiner'})`);
check(await bis(() => melden(sbW).length >= 1) && (await gespeichert(wp))?.kennung === K && await wp.evaluate(() => location.hash === ''), 'mit Service Worker: der Link verbindet wie ohne, die Adresse ist sauber');
check(w.fehler.length === 0, `mit Service Worker: keine Fehler im Browser (${w.fehler.join(' | ')})`);
await w.ctx.close();

await browser.close();
ende();
