/*
 * Sachen in eigenen Listen (js/inventar.js, js/inventar-ki.js,
 * js/ansicht-inventar.js): in Node Bereinigen, Änderungen (auch von zwei
 * Geräten), Ordnen, Suchen, Strichcodes und die Anfrage an die KI; im Browser
 * Marielle mit ihrer eigenen Liste – eine Liste anlegen, Sachen mit Name,
 * Marke, Notiz und Tags, ein Foto ins Repo, den Strichcode lesen (das Handy
 * selbst und ohne Leser die KI), sortieren, suchen, „Hab ich das schon?“,
 * ihr zweites Gerät, Löschen mit Rückgängig (das Foto kommt danach weg),
 * eine ältere App-Fassung – und die Sachen in Amys Bereich.
 */
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, ROOT } from './hilfe.mjs';
import { leer, anwenden, bereinigen, beschreibung, opZusammen, bescheidNoetig } from '../js/liste.js';
import {
  inventarBereinigen, opInvListe, opInvListeWeg, opDing, opDingWeg, eanOk, codeBereinigen, fotoPfad, FOTO_PFAD, listenVon, dingeIn,
  sortiert, tagsVon, mitTag, suchen, mitCode, verschieben, dingLeer, dingName, naechsteReihe, MAX_DINGE, neueDingId, neueListeId, LISTE_ID, DING_ID,
} from '../js/inventar.js';
import { rumpfErkennen, erkanntBereinigen, ERKENNEN_SCHEMA } from '../js/inventar-ki.js';
import { dateiHochladen, dateiHolen, dateiLoeschen } from '../js/speicher.js';
import { INVENTAR_BILDER, ALLE_BILDER } from '../js/bilder.js';

const { check, ende } = pruefer();

/* ------------------------------------------------------------------ Node */

check(eanOk('4006381333931') && eanOk('73513537') && eanOk('036000291452') && !eanOk('4006381333932') && !eanOk('400638133393') && !eanOk('abc'), 'Prüfziffer: EAN-13, EAN-8 und UPC-A stimmen, ein Zahlendreher nicht');
check(codeBereinigen(' 4 006381-333931 ') === '4006381333931' && codeBereinigen(12345) === '12345' && codeBereinigen(null) === '' && codeBereinigen('x'.repeat(50)).length === 32, 'Code: nur Ziffern und Buchstaben, höchstens 32');
check(LISTE_ID.test(neueListeId()) && DING_ID.test(neueDingId()) && FOTO_PFAD.test(fotoPfad('sd-abc12345')) && !FOTO_PFAD.test('../liste.json') && !FOTO_PFAD.test('sachen/x.jpg'), 'ids und Fotopfade: sl-…, sd-…, sachen/sd-…-….jpg – nichts anderes');
check(INVENTAR_BILDER.length >= 12 && INVENTAR_BILDER.every((b) => ALLE_BILDER.includes(b)), 'die Bildchen der Listen gehören zu den Bildchen der App (Offline-Vorrat)');

const roh = {
  listen: { 'sl-kleider1': { name: 'Kleidung\nneu', bild: 'dress', reihe: '2' }, 'sl-kaputt!': { name: 'x' }, 'sl-schmuck1': { name: 'Schmuck', bild: 'gibtsnicht' } },
  dinge: {
    'sd-jacke001': { liste: 'sl-kleider1', name: 'Jacke', marke: 'Zara', notiz: 'M', tags: ['#schwarz', 'schwarz', 'Winter'], code: '4006381333931', foto: { pfad: 'sachen/sd-jacke001-ab12.jpg', sha: 'w1' } },
    'sd-boese001': { liste: 'sl-kleider1', name: '<b>x</b>', foto: { pfad: '../liste.json' } },
    'kein-ding': { name: 'weg' },
  },
};
const inv = inventarBereinigen(roh);
check(Object.keys(inv.listen).sort().join() === 'sl-kleider1,sl-schmuck1' && inv.listen['sl-kleider1'].name === 'Kleidung neu' && inv.listen['sl-kleider1'].reihe === 2 && inv.listen['sl-schmuck1'].bild === 'package', 'Bereinigen: falsche ids weg, Namen einzeilig, unbekanntes Bildchen → Paket');
check(Object.keys(inv.dinge).sort().join() === 'sd-boese001,sd-jacke001' && inv.dinge['sd-jacke001'].tags.join() === 'schwarz,Winter' && inv.dinge['sd-jacke001'].foto.pfad === 'sachen/sd-jacke001-ab12.jpg' && inv.dinge['sd-boese001'].foto === null, 'Sachen: Tags ohne Doppelte, ein Foto nur mit erlaubtem Pfad');

// Änderungen, auch von zwei Geräten
let s = leer();
check(JSON.stringify(s.inventar) === JSON.stringify({ listen: {}, dinge: {} }), 'eine leere Liste hat leere Sachen');
s = anwenden(s, opInvListe({ id: 'sl-kleider1', name: 'Kleidung', bild: 'womans-clothes', reihe: 1 }, 'Marielle', '2026-11-14T10:00:00.000Z'));
s = anwenden(s, opInvListe({ id: 'sl-makeup01', name: 'Make-up', bild: 'lipstick', reihe: 2 }, 'Marielle', '2026-11-14T10:00:01.000Z'));
const jacke = { id: 'sd-jacke001', liste: 'sl-kleider1', name: 'Lederjacke', marke: 'Zara', notiz: 'Größe M', tags: ['schwarz', 'Winter'], code: '4006381333931', foto: null, reihe: 1 };
s = anwenden(s, opDing(jacke, 'Marielle', '2026-11-14T10:01:00.000Z'));
s = anwenden(s, opDing({ id: 'sd-kleid0001', liste: 'sl-kleider1', name: 'Abendkleid', marke: '', notiz: '', tags: ['Ausgehen'], code: '', foto: null, reihe: 2 }, 'Marielle', '2026-11-14T10:02:00.000Z'));
s = anwenden(s, opDing({ id: 'sd-mascara1', liste: 'sl-makeup01', name: 'Mascara', marke: 'Maybelline', notiz: 'fast leer', tags: ['schwarz'], code: '036000291452', foto: null, reihe: 1 }, 'Marielle', '2026-11-14T10:03:00.000Z'));
check(Object.keys(s.inventar.dinge).length === 3 && s.inventar.dinge['sd-jacke001'].by === 'Marielle' && s.inventar.dinge['sd-jacke001'].at === '2026-11-14T10:01:00.000Z', 'Listen und Sachen anlegen');
const aelter = anwenden(s, opDing({ ...jacke, name: 'Alt' }, 'Marielli', '2026-11-14T09:00:00.000Z'));
const neuer = anwenden(s, opDing({ ...jacke, name: 'Bikerjacke' }, 'Marielle', '2026-11-14T11:00:00.000Z'));
check(aelter.inventar.dinge['sd-jacke001'].name === 'Lederjacke' && neuer.inventar.dinge['sd-jacke001'].name === 'Bikerjacke' && neuer.inventar.dinge['sd-jacke001'].at === '2026-11-14T10:01:00.000Z', 'Eine ältere Fassung kommt nicht über eine neuere; angelegt bleibt angelegt');
const weg = anwenden(s, opDingWeg('sd-kleid0001', '2026-11-14T10:01:30.000Z'));
check(weg.inventar.dinge['sd-kleid0001'], 'Löschen, bevor es woanders geändert wurde: es bleibt (die Änderung ist neuer)');
const listeWeg = anwenden(anwenden(s, opDing({ ...jacke, notiz: 'später' }, 'Marielle', '2026-11-14T12:00:00.000Z')), opInvListeWeg('sl-kleider1', '2026-11-14T11:30:00.000Z'));
check(!listeWeg.inventar.listen['sl-kleider1'] && !listeWeg.inventar.dinge['sd-kleid0001'] && listeWeg.inventar.dinge['sd-jacke001'] && dingeIn(listeWeg.inventar, null).map((d) => d.id).join() === 'sd-jacke001', 'Liste gelöscht: ihre Sachen mit – eine, die danach noch geändert wurde, steht unter „Ohne Liste“');
const zurueck = anwenden(listeWeg, opZusammen({}, {}, { inventar: s.inventar }));
check(zurueck.inventar.listen['sl-kleider1'] && zurueck.inventar.dinge['sd-kleid0001'] && zurueck.inventar.dinge['sd-jacke001'].notiz === 'später', 'Rückgängig (zusammen): was fehlt, kommt zurück, Vorhandenes bleibt');
let voll = leer();
for (let i = 0; i < MAX_DINGE; i++) voll.inventar.dinge[`sd-v${String(i).padStart(5, '0')}`] = { id: `sd-v${String(i).padStart(5, '0')}` };
voll = bereinigen(voll);
const einZuviel = anwenden(voll, opDing({ id: 'sd-zuviel01', name: 'x' }, 'M'));
check(Object.keys(einZuviel.inventar.dinge).length === MAX_DINGE && !einZuviel.inventar.dinge['sd-zuviel01'], `Höchstens ${MAX_DINGE} Sachen – mehr nimmt die Liste nicht (alte fallen nicht raus)`);

// liste.js: gespeichert, beschrieben, ohne Push
const gelesen = bereinigen(JSON.parse(JSON.stringify(s)));
check(Object.keys(gelesen.inventar.dinge).length === 3 && gelesen.inventar.listen['sl-makeup01'].bild === 'lipstick', 'liste.json lesen: die Sachen bleiben');
check(beschreibung(leer(), s) === 'Sachen' && !/Lederjacke|Zara|Mascara/.test(beschreibung(leer(), s)), 'Commit: nur „Sachen“ – nie, was es ist');
check(!bescheidNoetig(leer(), s), 'Sachen schicken keine Push-Nachricht');

// Ordnen, Suchen, Finden
const kleider = dingeIn(s.inventar, 'sl-kleider1');
check(sortiert(kleider, 'eigen').map((d) => d.name).join() === 'Lederjacke,Abendkleid' && sortiert(kleider, 'name').map((d) => d.name).join() === 'Abendkleid,Lederjacke' && sortiert(kleider, 'neu')[0].name === 'Abendkleid' && sortiert(kleider, 'marke')[0].name === 'Lederjacke', 'Sortieren: eigene Reihenfolge, Name, Neueste, Marke (ohne Marke ans Ende)');
check(listenVon(s.inventar).map((l) => l.name).join() === 'Kleidung,Make-up' && naechsteReihe(listenVon(s.inventar)) === 3, 'Listen in ihrer Reihenfolge, die nächste kommt ans Ende');
check(tagsVon(Object.values(s.inventar.dinge))[0].join() === 'schwarz,2' && mitTag(kleider, 'SCHWARZ').map((d) => d.name).join() === 'Lederjacke', 'Tags: häufigste zuerst, filtern groß/klein egal');
check(suchen(s.inventar, 'zara').map((d) => d.name).join() === 'Lederjacke' && suchen(s.inventar, 'Schwarz').length === 2 && suchen(s.inventar, '0360002').map((d) => d.name).join() === 'Mascara' && suchen(s.inventar, 'leer').map((d) => d.name).join() === 'Mascara' && !suchen(s.inventar, ' ').length, 'Suchen über Name, Marke, Tags, Code und Notiz');
check(mitCode(s.inventar, '4006381333931')[0].name === 'Lederjacke' && !mitCode(s.inventar, '').length && !mitCode(s.inventar, '73513537').length, '„Hab ich das schon?“ – nach dem Strichcode');
const runter = verschieben(kleider, 'sd-jacke001', 1);
check(runter.map((d) => `${d.name}:${d.reihe}`).join() === 'Abendkleid:1,Lederjacke:2' && verschieben(kleider, 'sd-jacke001', -1) === null && verschieben(kleider, 'sd-kleid0001', 1) === null, 'Verschieben: tauschen und durchnummerieren – am Rand geht es nicht weiter');
check(dingLeer({ name: ' ', marke: '', notiz: '', tags: [], code: '', foto: null }) && !dingLeer({ code: '123' }) && !dingLeer({ foto: { pfad: 'x' } }) && dingName({ name: '', marke: 'Nike' }) === 'Nike' && dingName({}) === 'Ohne Namen', 'Leer ist, wo nichts drinsteht; ohne Namen zählt die Marke');

// Die KI: Anfrage und Antwort
const listen = [{ id: 'sl-kleider1', name: 'Kleidung' }, { id: 'sl-makeup01', name: 'Make-up' }];
const g = rumpfErkennen({ anbieter: 'gemini', b64: 'AAAA', listen: listen.map((l) => l.name) });
const c = rumpfErkennen({ anbieter: 'anthropic', b64: 'AAAA', listen: listen.map((l) => l.name), nurCode: true });
check(g.input[0].type === 'image' && g.input[0].data === 'AAAA' && g.response_format.schema === ERKENNEN_SCHEMA && g.store === false && /Kleidung, Make-up/.test(g.system_instruction), 'Gemini: das Foto, ihre Listen, JSON nach Schema, nichts gespeichert');
check(c.messages[0].content[0].type === 'image' && c.output_config.format.type === 'json_schema' && /vor allem um den Strichcode/.test(c.system) && !('tools' in c), 'Claude: Foto, JSON nach Schema; „nur Code“ sagt, worauf es ankommt');
const e = erkanntBereinigen({ name: '  Weiße   Sneaker ', marke: 'Nike', liste: 'kleidung', tags: ['weiß', 'Sport', 'Sommer', 'zu viel'], code: '0360 0029 1452' }, listen);
check(e.name === 'Weiße Sneaker' && e.marke === 'Nike' && e.liste === 'sl-kleider1' && e.tags.join() === 'weiß,Sport,Sommer' && e.code === '036000291452', 'Antwort: Liste nach Namen gefunden, höchstens drei Tags, Code ohne Leerzeichen');
check(erkanntBereinigen({ code: '4006381333932', liste: 'Bücher' }, listen).code === '' && erkanntBereinigen({ liste: 'Bücher' }, listen).liste === '' && erkanntBereinigen(null).name === '', 'Ein Code mit falscher Prüfziffer kommt nicht rein (lieber keiner als ein falscher); unbekannte Liste: keine');

// Dateien im Daten-Repo (speicher.js) – gegen ein nachgebautes fetch
{
  const echt = globalThis.fetch;
  const rufe = [];
  globalThis.fetch = async (url, opt = {}) => {
    rufe.push({ url, opt });
    if (opt.method === 'PUT') return new Response(JSON.stringify({ content: { sha: 'neu1', path: 'x' } }), { status: 201 });
    if (opt.method === 'DELETE') return new Response('{}', { status: 200 });
    return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200 });
  };
  try {
    const ort = { owner: 'Finanzdienste', repo: 'Boxenstopp-Marielle' };
    const hoch = await dateiHochladen('sachen/sd-abc12345-xy12.jpg', 'QUJD', { token: 'tok', ort, nachricht: 'Marielle: Foto für die Sachen' });
    const blob = await dateiHolen('sachen/sd-abc12345-xy12.jpg', { token: 'tok', ort });
    const ok = await dateiLoeschen('sachen/sd-abc12345-xy12.jpg', 'neu1', { token: 'tok', ort });
    const [p, h, d] = rufe;
    check(hoch.sha === 'neu1' && p.url === 'https://api.github.com/repos/Finanzdienste/Boxenstopp-Marielle/contents/sachen/sd-abc12345-xy12.jpg' && p.opt.method === 'PUT' && JSON.parse(p.opt.body).content === 'QUJD' && !('sha' in JSON.parse(p.opt.body)) && p.opt.headers.Authorization === 'Bearer tok', 'Foto hochladen: PUT ins Repo der Liste, base64, ohne sha (jedes Foto hat einen neuen Namen)');
    check(blob && (await blob.arrayBuffer()).byteLength === 3 && h.opt.headers.Accept === 'application/vnd.github.raw', 'Foto holen: roh, mit dem Schlüssel');
    check(ok && d.opt.method === 'DELETE' && JSON.parse(d.opt.body).sha === 'neu1' && !(await dateiLoeschen('x', '', { token: 'tok', ort })), 'Foto löschen: mit der sha – ohne sha gar nicht erst');
  } finally {
    globalThis.fetch = echt;
  }
}

/* --------------------------------------------------------------- Browser */

const browser = await starteBrowser();
const M_KEY = 'github_pat_11MARIELLE000000000000_abcdefghijklmnopqrstuvwxyz';
const GKEY = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
const CODE = '4006381333931';
const BILD = path.join(ROOT, 'icon-512.png');
const mar = githubAttrappe({ schluessel: M_KEY, repo: 'Boxenstopp-Marielle' });
mar.zustand.datei = JSON.stringify({ ...leer(), rev: 1, profil: { person: 'Marielle', farbe: 'lila' }, leute: { marielle: 'Marielle' } });
mar.zustand.version = 1;
mar.zustand.sha = 'sha1';
const dinge = () => Object.values(mar.liste()?.inventar?.dinge || {});
const ding = (name) => dinge().find((d) => d.name === name);

// Die KI (Gemini): antwortet mit dem, was in ki.antwort steht
const ki = { anfragen: [], antwort: {} };
const STROM = (json) => {
  const ev = (o) => `event: ${o.event_type}\r\ndata: ${JSON.stringify(o)}\r\n\r\n`;
  return ev({ event_type: 'interaction.created', interaction: { id: 'ia_1', status: 'in_progress' } })
    + ev({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: json } })
    + ev({ event_type: 'interaction.completed', interaction: { id: 'ia_1', status: 'completed', usage: { total_input_tokens: 300, total_output_tokens: 60 } } });
};
const kiRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  ki.anfragen.push(JSON.parse(req.postData() || '{}'));
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: STROM(JSON.stringify(ki.antwort)) });
};

async function geraet({ leser = false, schluessel = '' } = {}) {
  // Chrome auf Android kann Strichcodes lesen – hier nachgebaut; ohne ist es wie Safari auf dem iPhone
  const skript = leser ? 'window.BarcodeDetector = class { static async getSupportedFormats() { return ["ean_13", "ean_8", "qr_code"]; } async detect() { return [{ rawValue: window.__code || "4006381333931", format: "ean_13" }]; } };' : null;
  const h = await handy(browser, { attrappe: mar, skript });
  await h.ctx.route('https://generativelanguage.googleapis.com/**', kiRoute);
  const p = h.page;
  await p.evaluate(([k, g]) => {
    localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle' }));
    localStorage.setItem('boxenstopp.willkommen.v1', 'true');
    if (g) localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: g, stand: new Date().toISOString() }));
  }, [M_KEY, schluessel]);
  await p.reload();
  await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
  await bis(async () => (await p.locator('#sync-text').innerText()) === 'Gespeichert');
  await p.click('.tab[data-tab="amy"]');
  await p.click('[data-amy-teil="sachen"]');
  return h;
}

const m1 = await geraet({ leser: true });
const m = m1.page;
check(await bis(() => m.locator('#inv .inv-leer').isVisible()) && (await m.locator('#amy-titel').innerText()) === 'Marielles Bereich' && (await m.locator('.amy-lead').innerText()).includes('Kleidung, Make-up'), 'Marielles Bereich → Sachen: noch leer, mit Vorschlägen zum Anfangen');
check((await m.locator('.inv-fein').innerText()).includes('deinem Daten-Repo') && (await m.locator('.inv-fein').innerText()).includes('dein Handy selbst'), 'Der Hinweis: Fotos in ihrem Repo, den Strichcode liest das Handy');
await m.click('[data-inv-vorschlag="Kleidung"]');
check(await bis(() => Object.values(mar.liste()?.inventar?.listen || {}).some((l) => l.name === 'Kleidung' && l.bild === 'womans-clothes')) && (await m.locator('#inv-titel').innerText()) === 'Kleidung', 'Antippen legt „Kleidung“ an (mit Bildchen) und öffnet sie');

// Eine Sache: Name, Marke, Notiz, Tag – gespeichert beim Tippen
await m.click('[data-act="inv-ding-neu"]');
await m.fill('#inv-name', 'Lederjacke');
await m.fill('#inv-marke', 'Zara');
await m.fill('#inv-notiz', 'Größe M, passt zur schwarzen Hose');
await m.fill('#inv-tag-text', 'schwarz');
await m.press('#inv-tag-text', 'Enter');
check(await bis(() => ding('Lederjacke')?.marke === 'Zara' && ding('Lederjacke')?.notiz.startsWith('Größe M') && ding('Lederjacke')?.tags.join() === 'schwarz'), 'Name, Marke, Notiz und Tag – in ihrer Liste');
check(!mar.zustand.nachrichten.some((x) => /Lederjacke|Zara|Größe/.test(x)) && mar.zustand.nachrichten.some((x) => /^Marielle: .*Sachen/.test(x)), 'Im Commit steht nur „Sachen“ – nie, was es ist');

// Das Foto: als eigene Datei ins Repo, in der Sache nur der Pfad
await m.setInputFiles('#inv-foto-datei', BILD);
const pfad = () => ding('Lederjacke')?.foto?.pfad || '';
check(await bis(() => FOTO_PFAD.test(pfad()) && !!mar.zustand.roh[pfad()], 8000), 'Foto: als eigene Datei ins Repo (sachen/sd-…jpg), in der Sache Pfad und sha');
check(mar.zustand.roh[pfad()].subarray(0, 3).toString('hex') === 'ffd8ff' && ding('Lederjacke').foto.sha.startsWith('w') && mar.zustand.nachrichten.includes('Marielle: Foto für die Sachen'), 'ein JPEG, verkleinert; der Commit sagt nur „Foto für die Sachen“');
check(await bis(async () => (await m.locator('#inv-foto-teil img.inv-foto-img').getAttribute('src'))?.startsWith('blob:')), 'und gleich zu sehen');
check(!JSON.stringify(mar.liste()).includes('base64') && JSON.stringify(mar.liste()).length < 5000, 'liste.json bleibt klein – kein Bild darin');

// Der Strichcode: das Handy liest ihn selbst
await m.setInputFiles('#inv-code-foto', BILD);
check(await bis(() => ding('Lederjacke')?.code === CODE) && (await m.inputValue('#inv-code')) === CODE, 'Scannen: das Handy liest den Strichcode selbst (BarcodeDetector), die Nummer steht in der Sache');

// Zurück zur Liste: die Karte mit Foto, eine zweite Sache, sortieren, ordnen, filtern
await m.click('[data-act="inv-ding-zu"]');
check(await bis(async () => (await m.locator('.inv-ding-k').count()) === 1) && (await m.locator('.inv-ding-k').innerText()).includes('Zara'), 'In der Liste: die Karte mit Name und Marke');
check(await bis(async () => (await m.locator('.inv-ding-k img.inv-foto-img').getAttribute('src'))?.startsWith('blob:')), 'mit Foto');
await m.click('[data-act="inv-ding-neu"]');
await m.fill('#inv-name', 'Abendkleid');
await m.click('[data-act="inv-ding-zu"]');
const namen = () => m.locator('.inv-ding-k b').allInnerTexts().then((x) => x.join());
check(await bis(async () => (await namen()) === 'Lederjacke,Abendkleid') && await bis(() => ding('Abendkleid')?.reihe === 2), 'Eigene Reihenfolge: eine neue Sache kommt ans Ende');
await m.click('[data-act="inv-ding-neu"]');
await m.click('[data-act="inv-ding-zu"]');
check(await bis(async () => (await namen()) === 'Lederjacke,Abendkleid') && await bis(() => dinge().length === 2), 'Eine leere neue Sache verschwindet wieder');
await m.selectOption('#inv-sort', 'name');
check(await bis(async () => (await namen()) === 'Abendkleid,Lederjacke'), 'Sortieren: Name A–Z');
await m.selectOption('#inv-sort', 'eigen');
await m.click('[data-act="inv-ordnen"]');
await m.locator('[data-inv-runter^="ding:"]').first().click();
check(await bis(async () => (await namen()) === 'Abendkleid,Lederjacke') && await bis(() => ding('Abendkleid')?.reihe === 1 && ding('Lederjacke')?.reihe === 2), 'Reihenfolge ändern: ↓ – und sie steht in der Liste');
await m.click('[data-act="inv-ordnen"]');
await m.click('[data-inv-tag="schwarz"]');
check(await bis(async () => (await namen()) === 'Lederjacke'), 'Filtern nach Tag: nur die Lederjacke');
await m.click('[data-inv-tag=""]');

// Alle Listen: Suche und „Hab ich das schon?“
await m.click('[data-act="inv-zu"]');
check(await bis(async () => (await m.locator('.inv-liste-k').first().innerText()).includes('2 Sachen')), 'Alle Listen: Kleidung, 2 Sachen');
await m.fill('#inv-suche', 'zara');
check(await bis(async () => (await m.locator('#inv-inhalt .inv-ding-k b').allInnerTexts()).join() === 'Lederjacke') && (await m.locator('#inv-inhalt .inv-ding-k').innerText()).includes('Kleidung'), 'Suche „zara“ findet die Lederjacke – mit ihrer Liste');
await m.fill('#inv-suche', '');
await m.setInputFiles('#inv-finden', BILD);
check(await bis(async () => (await m.locator('#inv-name').count()) === 1 && (await m.inputValue('#inv-name')) === 'Lederjacke') && (await m.locator('#toast').innerText()).includes('Hast du schon'), 'Hab ich das schon? – scannen öffnet die Lederjacke: „Hast du schon“');
await m.click('[data-act="inv-ding-zu"]');
await m.click('[data-act="inv-zu"]');
await m.evaluate(() => { window.__code = '73513537'; });
await m.setInputFiles('#inv-finden', BILD);
check(await bis(async () => (await m.locator('#toast').innerText()).includes('noch nicht in deinen Listen')), 'Ein unbekannter Code: „noch nicht in deinen Listen“ – mit „Eintragen“');
await m.click('#toast button');
check(await bis(() => dinge().some((d) => d.code === '73513537' && !d.liste)) && (await m.inputValue('#inv-code')) === '73513537', 'Eintragen: eine neue Sache mit dem Code, noch ohne Liste');
const kleidungId = Object.values(mar.liste().inventar.listen)[0].id;
await m.fill('#inv-name', 'Gürtel');
await m.selectOption('#inv-liste', kleidungId);
check(await bis(() => ding('Gürtel')?.liste === kleidungId && ding('Gürtel')?.reihe === 3), 'Die Liste wählen: der Gürtel kommt in „Kleidung“, ans Ende');
await m.click('[data-act="inv-ding-zu"]');
check(await bis(async () => (await m.locator('#inv-titel').innerText()) === 'Kleidung' && (await namen()) === 'Abendkleid,Lederjacke,Gürtel'), 'Zurück führt in seine Liste');

// Ihr zweites Gerät, ohne Strichcode-Leser (wie Safari), mit KI-Schlüssel
const m2h = await geraet({ schluessel: GKEY });
const m2 = m2h.page;
check((await m2.locator('.inv-fein').innerText()).includes('die KI vom Foto'), '2. Gerät: ohne Leser im Browser liest die KI den Strichcode');
await m2.click('.inv-liste-k >> nth=0');
check(await bis(async () => (await m2.locator('.inv-ding-k').count()) === 3), '2. Gerät: die Liste mit ihren drei Sachen');
check(await bis(async () => (await m2.locator('.inv-ding-k img.inv-foto-img[src^="blob:"]').count()) === 1) && mar.zustand.lesen[pfad()] >= 1, 'das Foto holt es mit dem Schlüssel aus dem Repo');
ki.antwort = { name: 'Weiße Sneaker', marke: 'Nike', liste: 'Kleidung', tags: ['weiß', 'Sport'], code: '036000291452' };
await m2.setInputFiles('#inv-neu-foto', BILD);
check(await bis(() => ding('Weiße Sneaker')?.marke === 'Nike' && ding('Weiße Sneaker')?.code === '036000291452' && ding('Weiße Sneaker')?.tags.join() === 'weiß,Sport' && !!ding('Weiße Sneaker')?.foto, 8000), 'Mit Foto: hochgeladen, die KI trägt Name, Marke, Tags und Code ein');
const anfrage = ki.anfragen.at(-1);
check(anfrage?.input?.[0]?.type === 'image' && /Kleidung/.test(anfrage?.system_instruction || '') && anfrage?.store === false, 'die Anfrage: nur das Foto und die Namen ihrer Listen');
check(await bis(async () => (await m2.inputValue('#inv-name')) === 'Weiße Sneaker'), 'und im offenen Formular steht es');
// Strichcode ohne Leser: die KI liest ihn – eine falsche Prüfziffer nimmt die App nicht
await m2.click('[data-act="inv-ding-zu"]');
await m2.click('[data-act="inv-zu"]');
ki.antwort = { name: '', marke: '', liste: '', tags: [], code: '4006381333932' };
await m2.setInputFiles('#inv-finden', BILD);
check(await bis(async () => (await m2.locator('#toast').innerText()).includes('Kein Strichcode erkannt')) && /Strichcode/.test(ki.anfragen.at(-1)?.system_instruction || ''), 'Liest die KI eine falsche Prüfziffer: „Kein Strichcode erkannt“');
ki.antwort = { name: '', marke: '', liste: '', tags: [], code: CODE };
await m2.setInputFiles('#inv-finden', BILD);
check(await bis(async () => (await m2.locator('#inv-name').count()) === 1 && (await m2.inputValue('#inv-name')) === 'Lederjacke'), 'Richtig gelesen: „Hast du schon“ – die Lederjacke ist offen');

// Löschen mit Rückgängig – das Foto kommt erst danach weg
await m.click('[data-inv-ding]:has-text("Lederjacke")');
await m.click('[data-act="inv-ding-weg"]');
check(await bis(() => !ding('Lederjacke')) && (await m.locator('#toast').innerText()).includes('„Lederjacke“ gelöscht'), 'Löschen: weg, mit Rückgängig');
await m.click('#toast button');
check(await bis(() => ding('Lederjacke')?.foto?.pfad === pfad()) && await bis(async () => (await m.locator('#inv-name').count()) === 1 && (await m.inputValue('#inv-name')) === 'Lederjacke'), 'Rückgängig: wieder da, mit Foto – und gleich wieder offen');
const altesFoto = pfad();
await m.click('[data-act="inv-ding-weg"]');
check(await bis(() => mar.zustand.geloescht.includes(altesFoto), 16000) && !mar.zustand.roh[altesFoto], 'Nach der Zeit für „Rückgängig“: das Foto ist aus dem Repo gelöscht');

// Eine ältere App-Fassung schreibt die Liste ohne „inventar“: es kommt wieder dazu
const alt = mar.liste();
delete alt.inventar;
alt.rev += 1;
mar.zustand.datei = JSON.stringify(alt);
mar.zustand.version++;
mar.zustand.sha = `sha${mar.zustand.version}`;
check(await bis(() => Object.keys(mar.liste()?.inventar?.dinge || {}).length === 3, 10000), 'Lässt eine ältere Fassung die Sachen weg, schreibt Marielles Handy sie wieder dazu');
check(m1.fehler.length === 0 && m2h.fehler.length === 0, `Keine Fehler im Browser (${[...m1.fehler, ...m2h.fehler].join(' | ')})`);
await m1.ctx.close();
await m2h.ctx.close();

// Amy will es auch: in Amys Bereich, in der gemeinsamen Liste
const tobi = await handy(browser);
const t = tobi.page;
await t.click('.tab[data-tab="amy"]');
await t.click('[data-amy-teil="sachen"]');
check(await bis(() => t.locator('#inv .inv-leer').isVisible()) && (await t.locator('#amy-titel').innerText()) === 'Amys Bereich' && (await t.locator('.inv-fein').innerText()).includes('Tobi sieht sie auch'), 'Amys Bereich hat die Sachen auch – mit dem Hinweis, dass Tobi sie sieht');
check(tobi.fehler.length === 0, `Keine Fehler bei Tobi (${tobi.fehler.join(' | ')})`);
await tobi.ctx.close();

await browser.close();
ende();
