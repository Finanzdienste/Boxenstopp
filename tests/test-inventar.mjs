/*
 * Sachen in eigenen Listen (js/inventar.js, js/inventar-ki.js,
 * js/ansicht-inventar.js): in Node Bereinigen, Änderungen (auch von zwei
 * Geräten), Ordnen, Suchen, Strichcodes und die Anfrage an die KI; im Browser
 * Marielle mit ihrer eigenen Liste – eine Liste anlegen, Sachen mit Name,
 * Marke, Notiz und Tags, ein Foto ins Repo, den Strichcode lesen (das Handy
 * selbst und ohne Leser die KI), sortieren, suchen, „Hab ich das schon?“,
 * ihr zweites Gerät, Löschen mit Rückgängig (das Foto kommt danach weg),
 * eine ältere App-Fassung – und die Sachen in Amys Bereich. Dazu das
 * Nachschlagen (js/inventar-netz.js): Open Beauty Facts & Co. und Claudes
 * Suche gegen ein nachgebautes Netz, im Browser „Scannen“ in einer Liste
 * (gleich angelegt, mit dem Bild als Foto), „Hab ich das schon?“ mit Namen,
 * eine Nummer aus einer anderen Datenbank und Claude, wenn keine sie kennt.
 */
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, ROOT } from './hilfe.mjs';
import { leer, anwenden, bereinigen, beschreibung, opZusammen, bescheidNoetig } from '../js/liste.js';
import {
  inventarBereinigen, opInvListe, opInvListeWeg, opDing, opDingWeg, eanOk, codeBereinigen, fotoPfad, FOTO_PFAD, listenVon, dingeIn,
  sortiert, tagsVon, mitTag, suchen, mitCode, verschieben, dingLeer, dingName, naechsteReihe, MAX_DINGE, neueDingId, neueListeId, LISTE_ID, DING_ID, quelleBereinigen,
} from '../js/inventar.js';
import { rumpfErkennen, erkanntBereinigen, ERKENNEN_SCHEMA } from '../js/inventar-ki.js';
import { nachschlagen, nachschlagenAdresse, produktSeite, bildAdresse, produktAus, andereDatenbank, rumpfNachschlagen, gesuchtBereinigen, DATENBANKEN, KENNUNG } from '../js/inventar-netz.js';
import { ANBIETER } from '../js/ki.js';
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

// Nachschlagen (inventar-netz.js): Open Beauty Facts & Co. – gegen ein nachgebautes Netz
const LIPPEN = '4000000000013';
const BUCH = '4000000000020';
check(nachschlagenAdresse(LIPPEN) === `https://world.openbeautyfacts.org/api/v3/product/${LIPPEN}?fields=code,product_name,product_name_de,generic_name,generic_name_de,brands,image_front_url,product_type,quantity,periods_after_opening,periods_after_opening_tags,labels_tags,categories_tags,ingredients_text,ingredients_text_de&lc=de` && produktSeite(BUCH, 'product') === `https://world.openproductsfacts.org/product/${BUCH}`, 'Adressen: zuerst Open Beauty Facts (API v3, die Felder, die die App nimmt), dazu die Seite zum Anschauen');
const BILD_URL = `https://images.openbeautyfacts.org/images/products/${LIPPEN}/front_de.3.400.jpg`;
check(bildAdresse(BILD_URL) === BILD_URL.replace('.400.jpg', '.full.jpg') && bildAdresse(BILD_URL, { sparen: true }) === BILD_URL && bildAdresse(BILD_URL.replace('https:', 'http:')) === '' && bildAdresse('https://boese.example/x.400.jpg') === '' && bildAdresse('https://images.openbeautyfacts.org/x.png') === '' && bildAdresse('') === '', 'Bilder: groß (full) oder klein (400) – nur https, nur von den Datenbanken, nur JPEG');
const treffer = produktAus({ status: 'success', product: { product_name: 'lippenstift testrot', brands: 'testmarke,testkonzern', image_front_url: BILD_URL, product_type: 'beauty' } }, LIPPEN);
check(treffer.name === 'Lippenstift testrot' && treffer.marke === 'Testmarke' && treffer.bild.endsWith('.full.jpg') && treffer.klein === BILD_URL && treffer.quelle.name === 'Open Beauty Facts' && treffer.quelle.url === `https://world.openbeautyfacts.org/product/${LIPPEN}` && treffer.liste === '' && !treffer.tags.length, 'Treffer: Name vorn groß, die erste Marke, das Bild groß und klein, die Quelle');
check(produktAus({ status: 'success', product: { product_name: 'labial rojo', product_name_de: 'Lippenstift Rot', brands: 'Test Marke' } }, LIPPEN).name === 'Lippenstift Rot' && produktAus({ status: 'success', product: { brands: 'l\'test-marke paris' } }, LIPPEN).marke === "L'test-Marke Paris" && produktAus({ status: 'success', product: { brands: '' } }, LIPPEN) === null && produktAus({ status: 'failure' }, LIPPEN) === null && produktAus(null, LIPPEN) === null, 'der deutsche Name zuerst, kleine Marken vorn groß; ohne Name und Marke kein Treffer');
const reich = produktAus({ status: 'success', product: { product_name_de: 'Deocreme mit Natron', brands: 'Testmarke', quantity: '50 ml', periods_after_opening_tags: ['en:12-months'], labels_tags: ['en:vegan', 'en:cruelty-free', 'en:unbekannt'], categories_tags: ['de:drogerie-produkt', 'de:deocreme'], ingredients_text_de: `Aqua, ${'Glycerin, '.repeat(120)}Parfum` } }, LIPPEN);
check(reich.tags.join() === 'Deocreme,vegan,tierversuchsfrei' && reich.notiz.startsWith('Menge: 50 ml\nNach dem Öffnen 12 Monate haltbar\nInhaltsstoffe: Aqua, Glycerin') && reich.notiz.endsWith(' …') && reich.notiz.length < 900, 'Mehr aus der Datenbank: Kategorie und Siegel als Tags, in der Notiz Menge, Haltbarkeit nach dem Öffnen und die Inhaltsstoffe (gekürzt)');
check(produktAus({ status: 'success', product: { generic_name: 'Shampoo', categories_tags: ['en:hair-care', 'en:shampoos'], periods_after_opening: '6 M' } }, LIPPEN).name === 'Shampoo' && produktAus({ status: 'success', product: { generic_name: 'Shampoo', categories_tags: ['en:hair-care', 'en:shampoos'] } }, LIPPEN).tags.join() === 'Shampoo' && produktAus({ status: 'success', product: { generic_name: 'x', periods_after_opening: '6 M' } }, LIPPEN).notiz === 'Nach dem Öffnen 6 Monate haltbar', 'ohne Namen die Art; englische Kategorien auf Deutsch; „6 M“ heißt sechs Monate');
const anders = { status: 'failure', result: { id: 'product_found_with_a_different_product_type' }, errors: [{ message: { id: 'product_found_with_a_different_product_type' }, field: { id: 'product_type', value: 'product' } }] };
check(andereDatenbank(anders) === 'product' && andereDatenbank({ errors: [{ message: { id: 'product_not_found' } }] }) === '' && andereDatenbank(null) === '', 'Steht die Nummer in einer anderen Datenbank, sagt die Antwort, in welcher');
{
  const rufe = [];
  const antworten = {
    [`beauty:${BUCH}`]: { status: 404, body: anders },
    [`product:${BUCH}`]: { status: 200, body: { status: 'success', product: { product_name: 'Notizbuch A5', brands: 'Papierwerk', product_type: 'product' } } },
    [`beauty:${LIPPEN}`]: { status: 200, body: { status: 'success', product: { product_name: 'lippenstift testrot', brands: 'testmarke', image_front_url: BILD_URL, product_type: 'beauty' } } },
    'beauty:4000000000044': { status: 500, body: 'kaputt' },
  };
  const holen = async (url, opt) => {
    rufe.push({ url, opt });
    const art = Object.entries(DATENBANKEN).find(([, d]) => url.startsWith(d.web))?.[0];
    const a = antworten[`${art}:${url.split('/product/')[1].split('?')[0]}`] || { status: 404, body: { status: 'failure', result: { id: 'product_not_found' } } };
    return new Response(JSON.stringify(a.body), { status: a.status });
  };
  const buch = await nachschlagen(BUCH, { holen });
  check(buch?.name === 'Notizbuch A5' && buch.marke === 'Papierwerk' && buch.quelle.name === 'Open Products Facts' && rufe.length === 2 && rufe[0].url.startsWith('https://world.openbeautyfacts.org/') && rufe[1].url.startsWith('https://world.openproductsfacts.org/'), 'Nachschlagen: erst Open Beauty Facts – die sagt „steht in Open Products Facts“, dort ist es');
  check(rufe.every((r) => r.opt.headers['X-User-Agent'] === KENNUNG) && KENNUNG === 'Boxenstopp (https://github.com/Finanzdienste/Boxenstopp)', 'die App nennt sich (X-User-Agent) – mit der Adresse ihres Repos, ohne Namen oder Mail');
  rufe.length = 0;
  check((await nachschlagen(LIPPEN, { holen }))?.marke === 'Testmarke' && rufe.length === 1, 'steht es gleich in Open Beauty Facts: eine Frage');
  rufe.length = 0;
  check(await nachschlagen('4000000000037', { holen }) === null && rufe.length === 1, 'kennt keine die Nummer: null, nach einer Frage');
  check(await nachschlagen('abc', { holen }) === null && await nachschlagen('1234', { holen }) === null && rufe.length === 1, 'Buchstaben oder zu kurz: gar nicht erst gefragt');
  let fehler = null;
  try { await nachschlagen('4000000000044', { holen }); } catch (err) { fehler = err; }
  check(fehler && /500/.test(fehler.message), 'Antwortet eine nicht richtig: ein Fehler (die App sagt dann „ohne Netz?“)');
}
// Kennt sie keine: Claude sucht
const rn = rumpfNachschlagen({ code: ' 4000000000051 ', listen: ['Kleidung', 'Make-up'] });
check(rn.model === ANBIETER.anthropic.modell && rn.tools.length === 2 && rn.tools[0].type === 'web_search_20250305' && rn.tools[0].max_uses === 5 && !rn.tools[0].blocked_domains && rn.tools[0].user_location.country === 'DE' && rn.tools[1].type === 'web_fetch_20250910' && rn.tools[1].max_uses === 3 && !rn.output_config, 'Claude sucht (höchstens fünfmal, aus Deutschland, überall) und liest die Produktseite (höchstens dreimal), das JSON im Text');
check(rn.messages[0].content[0].text === 'Die Nummer unter dem Strichcode: 4000000000051' && /Kleidung, Make-up/.test(rn.system) && /genau diese Nummer/.test(rn.system) && /gefunden false/.test(rn.system) && /details/.test(rn.system) && /preis/.test(rn.system), 'die Anfrage: nur die Nummer und die Namen der Listen – nichts raten, möglichst viel (Angaben, Preis, Beschreibung)');
const SEITE = 'https://www.beispiel-shop.de/p/wanderschuhe-grau-123';
const gefunden = gesuchtBereinigen({ gefunden: true, name: ' Wanderschuhe  Grau ', marke: 'Bergfest', liste: 'kleidung', tags: ['Schuhe', 'grau', 'Wandern', 'Herbst', 'zu viel'], details: ['Farbe: Grau', 'Größe: 39', 'kein Feld', 'Material: Leder'], preis: '89,95 €', beschreibung: 'Leichter Wanderschuh.', url: SEITE, seite: 'beispiel-shop.de' }, { quellen: [{ url: `${SEITE}?ref=suche` }], listen, heute: new Date('2026-11-14T12:00:00Z') });
check(gefunden?.name === 'Wanderschuhe Grau' && gefunden.marke === 'Bergfest' && gefunden.liste === 'sl-kleider1' && gefunden.tags.join() === 'Schuhe,grau,Wandern,Herbst' && gefunden.bild === '' && gefunden.quelle.name === 'beispiel-shop.de' && gefunden.quelle.url === SEITE, 'Claudes Treffer: Liste nach Namen, bis zu vier Tags, kein Bild, die Seite als Quelle');
check(gefunden.notiz === 'Farbe: Grau · Größe: 39 · Material: Leder\nPreis: 89,95 € bei beispiel-shop.de (Nov. 2026)\nLeichter Wanderschuh.', 'in der Notiz: die Angaben, der Preis mit Seite und Monat, die Beschreibung');
check(gesuchtBereinigen({ gefunden: true, name: 'Andere Seite derselben Website', url: 'https://beispiel-shop.de/p/anders' }, { quellen: [{ url: SEITE }] })?.name === 'Andere Seite derselben Website', 'Eine andere Seite derselben Website zählt (die hat Claude gelesen)');
check(gesuchtBereinigen({ gefunden: true, name: 'Ausgedacht', url: 'https://anders.example/x' }, { quellen: [{ url: SEITE }] }) === null && gesuchtBereinigen({ gefunden: false, name: 'x', url: SEITE }, { quellen: [{ url: SEITE }] }) === null && gesuchtBereinigen({ name: 'x', url: SEITE }, { quellen: [] }) === null && gesuchtBereinigen(null) === null, 'Eine Website, die in keinem Such- oder Leseergebnis stand, zählt nicht (ausgedacht); „nicht gefunden“ ist nichts');
// Die Quelle in der Sache
check(JSON.stringify(quelleBereinigen({ name: 'Open Beauty Facts', url: 'https://world.openbeautyfacts.org/product/1' })) === JSON.stringify({ name: 'Open Beauty Facts', url: 'https://world.openbeautyfacts.org/product/1' }) && quelleBereinigen({ name: 'x', url: 'javascript:alert(1)' }) === null && quelleBereinigen({ name: 'x', url: 'http://a.example' }) === null && quelleBereinigen({ url: 'https://a.example' }) === null && quelleBereinigen('x') === null, 'Quelle: Name und https-Adresse – javascript: oder http nicht');
const mitQuelle = anwenden(s, opDing({ ...jacke, quelle: { name: 'Open Beauty Facts', url: `https://world.openbeautyfacts.org/product/${LIPPEN}` } }, 'Marielle', '2026-11-14T13:00:00.000Z'));
check(mitQuelle.inventar.dinge['sd-jacke001'].quelle?.name === 'Open Beauty Facts' && bereinigen(JSON.parse(JSON.stringify(mitQuelle))).inventar.dinge['sd-jacke001'].quelle?.url.endsWith(LIPPEN) && s.inventar.dinge['sd-jacke001'].quelle === null, 'Die Sache merkt sich die Quelle – gespeichert und gelesen; ohne ist sie null');

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
const mitNummer = (c) => dinge().find((d) => d.code === c);
const AKEY = 'sk-ant-api03-TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST-TESTTEST';

// Die offenen Datenbanken (Open Beauty Facts & Co.) – nachgebaut: je Nummer, in welcher sie steht und was
const db = { anfragen: [], bilder: 0, produkte: {} };
const BILD_ROH = readFileSync(BILD);
const ARTEN = { 'world.openbeautyfacts.org': 'beauty', 'world.openfoodfacts.org': 'food', 'world.openproductsfacts.org': 'product', 'world.openpetfoodfacts.org': 'petfood' };
const dbRoute = async (r) => {
  const req = r.request();
  const u = new URL(req.url());
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'X-User-Agent', 'access-control-allow-methods': 'GET, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  if (u.hostname.startsWith('images.')) { db.bilder++; return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: BILD_ROH }); }
  const art = ARTEN[u.hostname];
  const code = u.pathname.split('/').pop();
  db.anfragen.push({ art, code, kopf: req.headers()['x-user-agent'] || '' });
  const p = db.produkte[code];
  const json = (status, body) => r.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!p) return json(404, { code, status: 'failure', result: { id: 'product_not_found' }, errors: [{ message: { id: 'product_not_found' }, field: { id: 'code', value: code } }] });
  if (p.art !== art) return json(404, { code, status: 'failure', result: { id: 'product_found_with_a_different_product_type' }, errors: [{ message: { id: 'product_found_with_a_different_product_type' }, field: { id: 'product_type', value: p.art } }] });
  return json(200, { code, status: 'success', result: { id: 'product_found' }, product: { code, product_name: p.name, brands: p.marke, product_type: p.art, ...(p.mehr || {}), ...(p.bild ? { image_front_url: `https://images.${u.hostname.replace(/^world\./, '')}/images/products/${code}/front_de.3.400.jpg` } : {}) } });
};

// Claude mit der Websuche (kiMitWerkzeugen, ohne Strom): antwortet mit claude.antwort
const claude = { anfragen: [], antwort: null };
const claudeRoute = async (r) => {
  const req = r.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  claude.anfragen.push({ kopf: req.headers(), rumpf: JSON.parse(req.postData() || '{}') });
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(claude.antwort) });
};
const claudeFindet = (json, url) => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: ANBIETER.anthropic.modell, stop_reason: 'end_turn',
  usage: { input_tokens: 2000, output_tokens: 90, server_tool_use: { web_search_requests: 1 } },
  content: [
    { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'Strichcode' } },
    { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url, title: 'Treffer', encrypted_content: 'e' }] },
    { type: 'text', text: JSON.stringify(json) },
  ],
});

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
  const h = await handy(browser, { attrappe: mar, skript, datenbank: { route: dbRoute } });
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
check((await m.locator('.inv-fein').innerText()).includes('Open Beauty Facts') && !(await m.locator('.inv-fein').innerText()).includes('Claude'), 'und zur Nummer schlägt die App in Open Beauty Facts & Co. nach – ohne Schlüssel von Anthropic ohne Claude');
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
check(db.anfragen.length === 0 && (await m.locator('.inv-nachschlagen').count()) === 1, 'Hat die Sache Name, Marke, Foto und Notiz, schlägt die App nicht von selbst nach – „Im Netz nachschlagen“ steht trotzdem da');

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
check(await bis(async () => (await m.locator('#toast').innerText()).includes('Zu 73513537 nichts gefunden')) && db.anfragen.length === 1 && db.anfragen[0].art === 'beauty', 'Die Datenbanken kennen die Nummer nicht: einmal gefragt, „nichts gefunden“ (ohne Schlüssel sucht niemand im Internet)');
const kleidungId = Object.values(mar.liste().inventar.listen)[0].id;
await m.fill('#inv-name', 'Gürtel');
await m.selectOption('#inv-liste', kleidungId);
check(await bis(() => ding('Gürtel')?.liste === kleidungId && ding('Gürtel')?.reihe === 3), 'Die Liste wählen: der Gürtel kommt in „Kleidung“, ans Ende');
await m.click('[data-act="inv-ding-zu"]');
check(await bis(async () => (await m.locator('#inv-titel').innerText()) === 'Kleidung' && (await namen()) === 'Abendkleid,Lederjacke,Gürtel'), 'Zurück führt in seine Liste');

// Scannen in einer Liste: nachschlagen und gleich anlegen – mit dem Bild der Datenbank als Foto
db.produkte[LIPPEN] = { art: 'beauty', name: 'lippenstift testrot', marke: 'testmarke,testkonzern', bild: true, mehr: { quantity: '4 g', labels_tags: ['en:vegan'], categories_tags: ['en:make-up', 'en:lipsticks'], periods_after_opening_tags: ['en:24-months'], ingredients_text: 'Ricinus Communis Seed Oil, Cera Alba' } };
await m.click('[data-act="inv-zu"]');
await m.click('[data-inv-vorschlag="Make-up"]');
check(await bis(async () => (await m.locator('#inv-titel').innerText()) === 'Make-up') && await bis(() => Object.values(mar.liste().inventar.listen).some((l) => l.name === 'Make-up')), 'eine zweite Liste: Make-up');
const makeupId = Object.values(mar.liste().inventar.listen).find((l) => l.name === 'Make-up').id;
check((await m.locator('.inv-leer').innerText()).includes('„Scannen“ liest den Strichcode'), 'die leere Liste sagt, was „Scannen“ tut');
await m.evaluate((c) => { window.__code = c; }, LIPPEN);
const vorLippen = db.anfragen.length;
await m.setInputFiles('#inv-neu-code', BILD);
check(await bis(() => mitNummer(LIPPEN)?.name === 'Lippenstift testrot' && mitNummer(LIPPEN)?.marke === 'Testmarke' && mitNummer(LIPPEN)?.liste === makeupId), 'Scannen in „Make-up“: nachgeschlagen und gleich angelegt – Name (vorn groß), die erste Marke, in dieser Liste');
check(await bis(async () => (await m.locator('#toast').innerText()).includes('Gefunden: Lippenstift testrot (Testmarke)')) && (await m.inputValue('#inv-name')) === 'Lippenstift testrot' && (await m.inputValue('#inv-code')) === LIPPEN, '„Gefunden: …“ – und die Sache ist gleich offen, mit Name und Nummer');
check(await bis(() => FOTO_PFAD.test(mitNummer(LIPPEN)?.foto?.pfad || '') && mar.zustand.roh[mitNummer(LIPPEN).foto.pfad]?.subarray(0, 3).toString('hex') === 'ffd8ff', 8000) && db.bilder === 1, 'das Bild der Datenbank ist ihr Foto – verkleinert als JPEG ins Repo, wie ein eigenes');
const fragen = db.anfragen.slice(vorLippen);
check(fragen.length === 1 && fragen[0].art === 'beauty' && fragen[0].code === LIPPEN && fragen[0].kopf === KENNUNG, 'gefragt: einmal Open Beauty Facts – die App nennt sich (X-User-Agent)');
check(mitNummer(LIPPEN).quelle?.name === 'Open Beauty Facts' && await bis(async () => (await m.locator('.inv-quelle a').getAttribute('href')) === `https://world.openbeautyfacts.org/product/${LIPPEN}`) && (await m.locator('.inv-quelle').innerText()) === 'Gefunden bei Open Beauty Facts', 'Die Sache zeigt, wo es herkommt – mit Link');
check(mitNummer(LIPPEN).tags.join() === 'Lippenstift,vegan' && mitNummer(LIPPEN).notiz === 'Menge: 4 g\nNach dem Öffnen 24 Monate haltbar\nInhaltsstoffe: Ricinus Communis Seed Oil, Cera Alba' && await bis(async () => (await m.inputValue('#inv-notiz')) === mitNummer(LIPPEN).notiz), 'Alles, was die Datenbank weiß: Kategorie und Siegel als Tags, Menge, Haltbarkeit und Inhaltsstoffe in der Notiz – auch im offenen Formular');
await m.click('[data-act="inv-ding-zu"]');
await m.setInputFiles('#inv-neu-code', BILD);
check(await bis(async () => (await m.locator('#toast').innerText()).includes('Hast du schon: Lippenstift testrot (Make-up)')) && (await m.inputValue('#inv-name')) === 'Lippenstift testrot' && dinge().filter((d) => d.code === LIPPEN).length === 1 && db.anfragen.length === vorLippen + 1, 'Noch einmal gescannt: „Hast du schon“, sie ist offen – keine zweite, nicht noch einmal nachgeschlagen');

// „Hab ich das schon?“ mit einer Nummer aus einer anderen Datenbank: die App sagt gleich, was es ist
db.produkte[BUCH] = { art: 'product', name: 'Notizbuch A5', marke: 'Papierwerk', bild: false };
await m.click('[data-act="inv-ding-zu"]');
await m.click('[data-act="inv-zu"]');
await m.evaluate((c) => { window.__code = c; }, BUCH);
const vorBuch = db.anfragen.length;
await m.setInputFiles('#inv-finden', BILD);
check(await bis(async () => (await m.locator('#toast').innerText()).includes('Notizbuch A5 (Papierwerk): noch nicht in deinen Listen')), 'Hab ich das schon? – nein, und die App sagt gleich, was es ist');
check(db.anfragen.slice(vorBuch).map((x) => x.art).join() === 'beauty,product', 'erst Open Beauty Facts, die verweist auf Open Products Facts');
await m.click('#toast button');
check(await bis(() => mitNummer(BUCH)?.name === 'Notizbuch A5' && mitNummer(BUCH)?.marke === 'Papierwerk' && !mitNummer(BUCH)?.liste && mitNummer(BUCH)?.quelle?.name === 'Open Products Facts') && !mitNummer(BUCH).foto && db.anfragen.length === vorBuch + 2, 'Eintragen: mit Name, Marke und Quelle, noch ohne Liste – ohne Bild kein Foto, nicht noch einmal gefragt');
check(await bis(async () => (await m.locator('.inv-nachschlagen').count()) === 1), 'unter dem Strichcode: „Im Netz nachschlagen“');
await m.click('[data-act="inv-ding-zu"]');
await m.click('[data-act="inv-zu"]');
await m.click(`[data-inv-liste="${kleidungId}"]`);
check(await bis(async () => (await m.locator('#inv-titel').innerText()) === 'Kleidung'), 'zurück in „Kleidung“');

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
// Mit Gemini sucht niemand im Internet (die Internetsuche läuft nur über Claude)
await m2.click('[data-act="inv-ding-zu"]');
await m2.click('[data-act="inv-zu"]');
ki.antwort = { name: '', marke: '', liste: '', tags: [], code: '4000000000037' };
const kiVorher = ki.anfragen.length;
await m2.setInputFiles('#inv-finden', BILD);
check(await bis(async () => (await m2.locator('#toast').innerText()).includes('4000000000037: noch nicht in deinen Listen')), 'Gemini liest eine unbekannte Nummer: „noch nicht in deinen Listen“');
await m2.click('#toast button');
check(await bis(async () => (await m2.locator('#toast').innerText()).includes('nichts gefunden')) && ki.anfragen.length === kiVorher + 1 && await bis(() => !!mitNummer('4000000000037')), 'Eintragen: die Datenbanken kennen sie nicht – mit Gemini sucht niemand im Internet, die Sache hat nur die Nummer');

// Mit einem Schlüssel von Anthropic: kennt keine Datenbank die Nummer, sucht Claude im Internet
const m3h = await geraet({ leser: true, schluessel: AKEY });
await m3h.ctx.route('https://api.anthropic.com/**', claudeRoute);
const m3 = m3h.page;
check((await m3.locator('.inv-fein').innerText()).includes('sucht Claude im Internet'), 'Der Hinweis sagt es: kennen die Datenbanken die Nummer nicht, sucht Claude');
await m3.click(`[data-inv-liste="${kleidungId}"]`);
const SCHUHE = '4000000000044';
claude.antwort = claudeFindet({ gefunden: true, name: 'Wanderschuhe Grau', marke: 'Bergfest', liste: 'Kleidung', tags: ['grau', 'Wandern'], details: ['Farbe: Grau', 'Größe: 39'], preis: '89,95 €', beschreibung: 'Leichter Wanderschuh.', url: SEITE, seite: 'beispiel-shop.de' }, SEITE);
await m3.evaluate((c) => { window.__code = c; }, SCHUHE);
const vorSchuhe = db.anfragen.length;
await m3.setInputFiles('#inv-neu-code', BILD);
check(await bis(() => mitNummer(SCHUHE)?.name === 'Wanderschuhe Grau' && mitNummer(SCHUHE)?.marke === 'Bergfest' && mitNummer(SCHUHE)?.liste === kleidungId && mitNummer(SCHUHE)?.tags.join() === 'grau,Wandern' && mitNummer(SCHUHE)?.quelle?.url === SEITE, 8000) && !mitNummer(SCHUHE).foto, 'Claude findet sie im Internet: Name, Marke, Tags, die Seite als Quelle – ohne Bild');
check(/^Farbe: Grau · Größe: 39\nPreis: 89,95 € bei beispiel-shop\.de \(\S+ \d{4}\)\nLeichter Wanderschuh\.$/.test(mitNummer(SCHUHE).notiz), 'und in der Notiz Farbe, Größe, Preis (mit Seite und Monat) und eine Beschreibung');
const cf = claude.anfragen.at(-1);
check(db.anfragen.length === vorSchuhe + 1 && cf?.kopf['x-api-key'] === AKEY && cf.rumpf.tools.map((t) => t.name).join() === 'web_search,web_fetch' && cf.rumpf.messages[0].content[0].text.endsWith(SCHUHE) && !!cf.rumpf.cache_control, 'erst die Datenbank, dann Claude: Websuche und Seite lesen (ohne Berater), nur die Nummer');
check(await bis(async () => (await m3.locator('.inv-quelle a').innerText()) === 'beispiel-shop.de'), 'die Quelle steht dabei');
claude.antwort = claudeFindet({ gefunden: true, name: 'Ausgedacht', marke: 'X', url: 'https://anders.example/p/1' }, SEITE);
await m3.click('[data-act="inv-ding-zu"]');
await m3.evaluate(() => { window.__code = '4000000000051'; });
await m3.setInputFiles('#inv-neu-code', BILD);
check(await bis(async () => (await m3.locator('#toast').innerText()).includes('Zu 4000000000051 nichts gefunden')) && await bis(() => mitNummer('4000000000051')?.liste === kleidungId) && !mitNummer('4000000000051').name && !ding('Ausgedacht'), 'Nennt Claude eine Seite, die in keiner Suche stand: nichts eingetragen – die Sache hat nur die Nummer');
// „Im Netz nachschlagen“ fragt beide – auch wenn die Datenbank die Nummer kennt
await m3.click('[data-act="inv-ding-zu"]');
await m3.click('[data-act="inv-zu"]');
await m3.click(`[data-inv-liste="${makeupId}"]`);
await m3.click('[data-inv-ding]:has-text("Lippenstift testrot")');
const SHOP = 'https://www.beispiel-drogerie.de/p/lippenstift-testrot';
claude.antwort = claudeFindet({ gefunden: true, name: 'Lippenstift Testrot 102', marke: 'Testmarke', tags: ['rot'], details: ['Nuance: 102 Testrot'], preis: '4,95 €', url: SHOP, seite: 'beispiel-drogerie.de' }, SHOP);
const vorMehr = db.anfragen.length;
const claudeVorher = claude.anfragen.length;
await m3.click('[data-act="inv-nachschlagen"]');
check(await bis(() => /Preis: 4,95 € bei beispiel-drogerie\.de/.test(mitNummer(LIPPEN)?.notiz || ''), 8000) && mitNummer(LIPPEN).notiz.startsWith('Menge: 4 g') && mitNummer(LIPPEN).notiz.includes('Nuance: 102 Testrot') && mitNummer(LIPPEN).name === 'Lippenstift testrot' && mitNummer(LIPPEN).tags.join() === 'Lippenstift,vegan,rot' && mitNummer(LIPPEN).quelle.name === 'Open Beauty Facts', 'Im Netz nachschlagen: Datenbank und Claude – Preis und Nuance kommen in die Notiz dazu, ein Tag dazu, Name und Quelle bleiben');
check(db.anfragen.length === vorMehr + 1 && claude.anfragen.length === claudeVorher + 1 && dinge().filter((d) => d.code === LIPPEN).length === 1, 'dabei je einmal gefragt – keine zweite Sache');
await m3.click('[data-act="inv-nachschlagen"]');
check(await bis(() => claude.anfragen.length === claudeVorher + 2) && await bis(async () => (await m3.locator('#toast').innerText()).includes('Gefunden')) && (mitNummer(LIPPEN).notiz.match(/Preis:/g) || []).length === 1, 'Noch einmal: nichts doppelt in der Notiz');

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
const zahl = Object.keys(alt.inventar.dinge).length;
delete alt.inventar;
alt.rev += 1;
mar.zustand.datei = JSON.stringify(alt);
mar.zustand.version++;
mar.zustand.sha = `sha${mar.zustand.version}`;
check(zahl > 3 && await bis(() => Object.keys(mar.liste()?.inventar?.dinge || {}).length === zahl, 10000), 'Lässt eine ältere Fassung die Sachen weg, schreibt Marielles Handy sie wieder dazu');
check(m1.fehler.length === 0 && m2h.fehler.length === 0 && m3h.fehler.length === 0, `Keine Fehler im Browser (${[...m1.fehler, ...m2h.fehler, ...m3h.fehler].join(' | ')})`);
await m1.ctx.close();
await m2h.ctx.close();
await m3h.ctx.close();

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
