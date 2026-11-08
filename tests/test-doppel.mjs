/*
 * Zwei auf einmal: der Plan (js/doppel.js, direkt in Node) – was man tut und
 * worauf man wartet, ein Koch und ein Ofen, nichts zerkocht, nie länger als
 * nacheinander, die Partner, die Schalen – und im Browser: die Partner im
 * Rezept, der Plan, beide auf die Liste, der Kochmodus für beide.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT, handy, githubAttrappe, starteBrowser, bis, SCHLUESSEL } from './hilfe.mjs';
import { leer } from '../js/liste.js';
import { aufBoxen } from '../js/boxen.js';
import { zeitVon } from '../js/zeiten.js';
import {
  aufgabenVon, doppelPlan, doppelBester, doppelPaar, doppelPartner, besteDoppel, alleinMinuten, schalenPlan, schalenIm,
  schalenUmbenennen, geraeteZusammen, gemeinsamSchneiden, beideReis, ofenGeteilt, resteGeteilt, warumText, MIN_SPART, OFEN_PLATZ,
} from '../js/doppel.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const rs = daten.rezepte;
const d = { preise: daten.preise, naehrwerte: daten.naehrwerte, katalog: daten.katalog };
const nach = (id) => rs.find((r) => r.id === id);
const flach = (r) => r.ablauf.flatMap((p) => p.schritte);
const aufgabe = (id, re) => { const r = nach(id); return aufgabenVon(r)[flach(r).findIndex((s) => re.test(s.d))]; };

/* ------------------------------------------------- Arbeit und Warten */

const schmoren = aufgabe('gulasch', /Zugedeckt 90 Min/);
check(schmoren.aktiv === 3 && schmoren.warten === 87 && !schmoren.wartet, 'Gulasch: „Zugedeckt 90 Min. schmoren, alle 20 Min. umrühren“ sind 3 Min. Arbeit und 87 Min. Warten');
const zwiebeln = aufgabe('gulasch', /Zwiebeln schälen/);
check(zwiebeln.aktiv === 20 && zwiebeln.warten === 0, 'Zwiebeln schälen und schneiden ist Arbeit, die ganze Zeit');
const vorheizen = aufgabe('butter-chicken', /vorheizen/);
check(vorheizen.ofen?.key === '230 Umluft' && vorheizen.ofen.last === 0 && vorheizen.ruhe === 10, 'Butter Chicken: Ofen auf 230 °C Umluft vorheizen – der Ofen, noch ohne Blech, 10 Min. im Hintergrund');
const blech = aufgabe('butter-chicken', /Blech herausnehmen/);
check(blech.wartet && blech.neben, '„Blech herausnehmen, sobald die 10–12 Min. um sind“ wartet auf den Ofen');
const weiter = aufgabe('suesskartoffel-blech', /weiterbacken/);
check(weiter.ofen?.last === 2 && weiter.warten > 10, '„18 Min. weiterbacken“ ist auch Ofen – mit beiden Blechen von vorher');
check(!aufgabe('teriyaki', /^Abgießen/).wartet && aufgabe('pesto-nudelsalat', /Nudeln abgießen/).wartet && aufgabe('mac-cheese', /bevor der Timer klingelt/).vorher === 4, 'Abgießen gleich nach dem Blanchieren wartet auf nichts, Nudeln abgießen auf die Nudeln; „4 Min. bevor der Timer klingelt“');
check(aufgabenVon(nach('chili')).every((a) => a.aktiv >= 0 && a.warten >= 0 && a.ruhe >= 0) && aufgabenVon(nach('chili')).length === flach(nach('chili')).length, 'Jeder Schritt ist eine Aufgabe, keine Zeit ist negativ');

const abweichung = rs.map((r) => Math.abs(alleinMinuten(r) - zeitVon(r).gesamt));
check(abweichung.filter((x) => x > 6).length <= 3 && Math.max(...abweichung) <= 15, `Ein Rezept allein dauert im Plan so lange wie im Rezept (bis auf ${Math.max(...abweichung)} Min. – wer den Ofen später anheizt, ist manchmal schneller)`);

/* ------------------------------------------------- Pläne für alle Paare */

const fehler = { koch: 0, reihe: 0, fehlt: 0, abschnitt: 0, ofen: 0, laenger: 0, zuSpaet: 0 };
let spaetMax = 0;
const luft = new Map();
for (const r of rs) for (const s of doppelPlan([r]).schritte) if (s.ziel !== null) luft.set(`${r.id}:${s.i}`, Math.max(0, s.start - s.ziel));
const paare = [];
for (let x = 0; x < rs.length; x++) {
  for (let y = x + 1; y < rs.length; y++) {
    const p = doppelPaar(rs[x], rs[y], { daten: d });
    paare.push(p);
    const { plan, reihe } = p;
    // Ein Koch: was Arbeit ist (nicht „währenddessen“ im Schritt davor), überlappt nie
    const arbeit = plan.schritte.filter((s) => !s.drin && s.bis > s.start).sort((a, b) => a.start - b.start);
    for (let k = 1; k < arbeit.length; k++) if (arbeit[k].start < arbeit[k - 1].bis) fehler.koch++;
    const auf = reihe.map((r) => aufgabenVon(r));
    for (const k of [0, 1]) {
      const meine = plan.schritte.filter((s) => s.k === k);
      if (meine.length !== flach(reihe[k]).length || new Set(meine.map((s) => s.i)).size !== meine.length) fehler.fehlt++;
      // Reihenfolge wie im Rezept – nur das Vorheizen darf nach hinten wandern
      const idx = meine.filter((s) => !/vorheizen/i.test(auf[k][s.i].d)).map((s) => s.i);
      if (idx.some((v, q) => q && v < idx[q - 1])) fehler.reihe++;
      // Ein Abschnitt fängt erst an, wenn der davor fertig ist (samt dem, was dort im Hintergrund lief)
      const ende = [];
      for (const s of meine) if (!/vorheizen/i.test(auf[k][s.i].d)) ende[s.pi] = Math.max(ende[s.pi] || 0, s.bis + s.warten, s.bis + s.ruhe);
      for (const s of meine) for (let q = 0; q < s.pi; q++) if (s.start < (ende[q] || 0) - 1e-9) { fehler.abschnitt++; break; }
    }
    // Ein Ofen: bei verschiedener Temperatur nie gleichzeitig, bei derselben höchstens OFEN_PLATZ Bleche
    const ofen = plan.schritte.filter((s) => auf[s.k][s.i].ofen && auf[s.k][s.i].ofen.last > 0).map((s) => ({ k: s.k, von: s.start, bis: s.bis + Math.max(s.warten, s.ruhe), ...auf[s.k][s.i].ofen }));
    for (const a of ofen) for (const b of ofen) if (a.k === 0 && b.k === 1 && a.von < b.bis && b.von < a.bis && (a.key !== b.key || !a.key || a.last + b.last > OFEN_PLATZ)) fehler.ofen++;
    if (plan.ende > alleinMinuten(rs[x]) + alleinMinuten(rs[y]) + 1e-9 || p.zusammen > p.getrennt) fehler.laenger++;
    // Was gleich raus muss, wartet nicht viel länger als im Rezept allein
    for (const s of plan.schritte) {
      if (s.ziel === null) continue;
      const spaet = s.start - s.ziel - (luft.get(`${s.rid}:${s.i}`) || 0);
      spaetMax = Math.max(spaetMax, spaet);
      if (spaet > 5) fehler.zuSpaet++;
    }
  }
}
check(paare.length === rs.length * (rs.length - 1) / 2, `Alle ${paare.length} Paare gerechnet`);
check(fehler.koch === 0, 'Ein Koch: nie zwei Arbeiten gleichzeitig');
check(fehler.fehlt === 0 && fehler.reihe === 0, 'Jeder Schritt genau einmal, je Rezept in seiner Reihenfolge (nur das Vorheizen wandert)');
check(fehler.abschnitt === 0, 'Vorbereiten, Kochen, Portionieren: je Rezept erst, wenn der Abschnitt davor fertig ist');
check(fehler.ofen === 0, 'Ein Ofen: verschiedene Temperaturen nie zugleich, höchstens zwei Bleche');
check(fehler.laenger === 0, 'Zusammen nie länger als nacheinander');
check(fehler.zuSpaet <= 40 && spaetMax <= 30, `Nudeln, Bleche, Reis: fast immer pünktlich (${fehler.zuSpaet} von ${paare.length} Paaren mal mehr als 5 Min. später als im Rezept allein, höchstens ${spaetMax} Min.)`);
const sparen = paare.map((p) => p.spart).sort((a, b) => a - b);
check(sparen[sparen.length >> 1] >= 15 && sparen[Math.floor(sparen.length * 0.9)] >= 45, `Gespart wird im Mittel ${sparen[sparen.length >> 1]} Min., bei jedem zehnten Paar mindestens ${sparen[Math.floor(sparen.length * 0.9)]} Min.`);

/* ------------------------------------------------- bekannte Paare */

const gm = doppelPaar(nach('gulasch'), nach('moussaka'), { daten: d });
check(gm.spart >= 90 && gm.reihe[0].id === 'gulasch' && gm.zusammen < 300, `Gulasch und Moussaka: ${gm.zusammen} statt ${gm.getrennt} Min. – das Gulasch fängt an`);
check(/Rindergulasch schmort 1 Std\. \d+ Min\. – in der Zeit .*Moussaka/.test(gm.warum) && gm.warum === warumText(gm.plan, gm.reihe), `Warum: „${gm.warum}“`);
const gmFl = gm.reihe.map(flach);
const gs = (k, re) => gm.plan.schritte.find((s) => s.k === k && re.test(gmFl[k][s.i].d));
const heiz = gs(1, /vorheizen/);
const rein = gs(1, /beide in den Ofen/);
check(heiz.start > 60 && rein.start - heiz.bis >= 10 && rein.start - heiz.bis <= 25, `Der Ofen für die Moussaka geht erst an, wenn er bald gebraucht wird (${heiz.start} Min., Bleche rein nach ${rein.start} Min.)`);
check(gs(1, /Kartoffeln schälen/).start > gs(0, /Zugedeckt 90 Min/).start, 'Die Moussaka-Kartoffeln schält man, während das Gulasch schmort');
const wenig = paare.filter((p) => p.spart < MIN_SPART);
check(wenig.length > 10 && wenig.length < paare.length / 5, `Wo beide kaum Wartezeit haben, spart es kaum (${wenig.length} Paare unter ${MIN_SPART} Min.)`);
const bm = doppelPaar(nach('butter-chicken'), nach('moussaka'), {});
const bmOfen = bm.plan.schritte.filter((s) => aufgabenVon(bm.reihe[s.k])[s.i].ofen);
const ofenVon = (k) => bmOfen.filter((s) => s.k === k);
const ende0 = Math.max(...ofenVon(0).map((s) => s.bis + Math.max(s.warten, s.ruhe)));
const ende1 = Math.max(...ofenVon(1).map((s) => s.bis + Math.max(s.warten, s.ruhe)));
check(Math.min(...ofenVon(1).map((s) => s.start)) >= ende0 - 1e-9 || Math.min(...ofenVon(0).map((s) => s.start)) >= ende1 - 1e-9, 'Butter Chicken (230 °C) und Moussaka (220 °C): erst das eine im Ofen, dann das andere');
check(ofenGeteilt(nach('honig-senf'), nach('cheeseburger')) === '200 °C Umluft' && ofenGeteilt(nach('butter-chicken'), nach('moussaka')) === '', 'Honig-Senf und Cheeseburger: beide bei 200 °C Umluft – einmal vorheizen');
check(doppelBester(nach('chili'), nach('gulasch')).plan.ende <= doppelPlan([nach('chili'), nach('gulasch')]).ende, 'Der beste Plan ist nie schlechter als der in einer Reihenfolge');

/* ------------------------------------------------- Partner */

const partner = doppelPartner(nach('chili'), rs, { daten: d });
check(partner.length === 3 && partner.every((p) => p.spart >= MIN_SPART && p.a.id === 'chili' && p.b.id !== 'chili') && partner.every((p, i) => !i || partner[i - 1].wert >= p.wert), `Chili: drei Partner, der beste zuerst (${partner.map((p) => `${p.b.id} −${p.spart}`).join(', ')})`);
check(!doppelPartner(wenig[0].a, rs, { max: 100 }).some((p) => p.b.id === wenig[0].b.id), `Was kaum Zeit spart, ist kein Partner (${wenig[0].a.id} und ${wenig[0].b.id})`);
check(doppelPartner(nach('chili'), rs, { ohne: [partner[0].b.id] }).every((p) => p.b.id !== partner[0].b.id), 'ohne: abgelehnte Rezepte (Daumen runter) kommen nicht vor');
const beste = besteDoppel(rs, { daten: d });
const zaehl = {};
for (const p of beste) for (const id of [p.a.id, p.b.id]) zaehl[id] = (zaehl[id] || 0) + 1;
check(beste.length === 8 && beste.every((p) => p.spart >= 30) && Object.values(zaehl).every((n) => n <= 2), `Die besten Paare: acht, jedes Rezept höchstens zweimal (${beste.slice(0, 3).map((p) => `${p.a.id}+${p.b.id}`).join(', ')} …)`);
const zwei = (id) => aufBoxen(nach(id), 2, { katalog: daten.katalog });
const reste = resteGeteilt(zwei('chili'), zwei('bolognese'), d);
check(reste.euro > 0 && reste.nutzt.some((x) => /rinderhack/.test(x.k)), `Für 2 Boxen: was vom Hack beim Chili übrig bliebe, braucht die Bolognese (≈ ${reste.euro.toFixed(2)} €)`);
check(resteGeteilt(nach('chili'), nach('gulasch'), null).euro === 0, 'Ohne Daten keine Reste');
const halb = doppelPaar(aufBoxen(nach('gulasch'), 4, { katalog: daten.katalog }), aufBoxen(nach('moussaka'), 4, { katalog: daten.katalog }), {});
check(halb.zusammen < gm.zusammen && halb.getrennt < gm.getrennt, `Je 4 Boxen geht schneller: ${halb.zusammen} statt ${gm.zusammen} Min.`);

/* ------------------------------------------------- Schalen und Geräte */

check(JSON.stringify(schalenIm('Schalen 1–3 und Schale 5')) === '[1,2,3,5]' && JSON.stringify(schalenIm('In Schale 4 abmessen:')) === '[4]' && JSON.stringify(schalenIm('Schalen 2 und 4')) === '[2,4]', 'Schalen im Text: Bereiche, Aufzählungen, einzeln');
check(schalenUmbenennen('Schale 1 und Schale 3 in den Topf, dann Schalen 2 bis 4', { 1: 7, 2: 3, 3: 8, 4: 9 }) === 'Schale 7 und Schale 8 in den Topf, dann Schalen 3, 8 und 9' && schalenUmbenennen('Schale 2', {}) === 'Schale 2', 'Umbenennen: jede Nummer nach der Zuordnung, ein Bereich wird zur Aufzählung');
const sp = schalenPlan(gm.plan, gm.reihe);
const nrB = Object.values(sp.nr[1]);
check(sp.zahl < sp.getrennt && sp.getrennt === 12 && new Set(nrB).size === nrB.length && Object.entries(sp.nr[0]).every(([a, b]) => Number(a) === b), `Gulasch und Moussaka: ${sp.zahl} Schalen statt ${sp.getrennt} – das Gulasch behält seine Nummern, jede Moussaka-Schale hat ihre eigene`);
const nutzung = (k, n) => {
  const xs = gm.plan.schritte.filter((s) => s.k === k && schalenIm([gmFl[k][s.i].d, ...(gmFl[k][s.i].liste || [])].join(' ')).includes(n));
  return { von: Math.min(...xs.map((s) => s.start)), bis: Math.max(...xs.map((s) => s.bis)) };
};
check([...sp.wieder].every((w) => { const [, alt] = w.split(':').map(Number); const neu = sp.nr[1][alt]; return nutzung(1, alt).von >= nutzung(0, neu).bis; }), 'Wiederverwendet wird eine Schale erst, wenn das Gulasch sie geleert hat');
check(sp.schalen[1].every((s) => s.k === 1 && s.n === sp.nr[1][gm.reihe[1].schalen.find((x) => x.name === s.name).n]), 'Die Schalen der Moussaka tragen ihre neuen Nummern');
const ger = geraeteZusammen([nach('honig-senf'), nach('cheeseburger')]);
check(ger.includes('4 Backbleche') && ger.includes('Sieb') && ger.filter((g) => g === 'Sieb').length === 1, `Geräte zusammen: Bleche zählen, Kleines gibt es einmal (${ger.join(', ')})`);
check(geraeteZusammen([nach('gulasch'), nach('pulled-chicken')]).includes('2 Gabeln zum Zupfen'), '„2 Gabeln zum Zupfen“ bleibt, wie es ist');
check(JSON.stringify(gemeinsamSchneiden(nach('gulasch'), nach('moussaka'), daten.katalog)) === '["Zwiebeln","Knoblauch","Kartoffeln"]' && beideReis(nach('teriyaki'), nach('chili')) === rs.find((r) => r.id === 'chili').items.some((it) => it.k === 'reis'), 'Was beide schneiden: Zwiebeln, Knoblauch, Kartoffeln; Reis nur, wenn beide welchen haben');

/* ------------------------------------------------------------ Browser */

const browser = await starteBrowser();
const att = githubAttrappe();
att.zustand.datei = JSON.stringify({ ...leer(), rev: 1 });
att.zustand.version = 1;
att.zustand.sha = 'sha1';
const tobi = await handy(browser, { attrappe: att });
const t = tobi.page;
await t.evaluate((s) => localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: s, name: 'Tobi' })), SCHLUESSEL);
await t.reload();
await t.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt'), 'Tobi: an eurer Liste');
const lesen = async (el) => (await el.innerText()).replace(/\u00a0/g, ' ');

// Im Rezept: die Partner
await t.click('#grid [data-open="gulasch"]');
const karte = t.locator('#d-doppel');
check(await bis(() => karte.locator('.doppel-z').count().then((n) => n === 3), 8000), 'Gulasch: drei Rezepte, die gut dazu passen');
const kartenText = await lesen(karte);
check(/\+ \S/.test(kartenText) && kartenText.includes(' statt ') && kartenText.includes('Rindergulasch schmort'), 'Je mit „statt“ und warum: „Rindergulasch schmort …“');
const erstes = await karte.locator('.doppel-z').first().getAttribute('data-doppel');
const [, zweitesId] = erstes.split(' ');
await karte.locator('.doppel-z').first().click();
const ansicht = t.locator('#doppel');
check(await bis(() => ansicht.isVisible()) && await t.locator('#detail').isHidden() && await t.locator('#browse').isHidden(), 'Der Plan öffnet sich, das Rezept ist zu');
const titel = await lesen(t.locator('#dp-titel'));
check(titel.startsWith('Rindergulasch + ') && (await lesen(ansicht.locator('.facts'))).includes('zusammen ca.') && (await lesen(ansicht.locator('.facts'))).includes('spart'), `Titel „${titel}“, zusammen statt nacheinander, was es spart`);
check(await ansicht.locator('.ablauf .ab-blk').count() >= 4 && (await lesen(ansicht.locator('.ablauf'))).includes('Beides fertig') && (await ansicht.locator('.ablauf .ab-t').first().innerText()) === '0:00', 'Der Ablauf: Blöcke ab 0:00 bis „Beides fertig“');
check((await ansicht.locator('.mise').textContent()).includes('Stell dir bereit') && (await lesen(ansicht.locator('.mise'))).includes('Außerdem:'), 'Schalen und Geräte für beide');
check((await lesen(ansicht.locator('.doppel-tips'))).includes('in einem Rutsch'), 'Gut zu wissen: was beide schneiden');
// Je halbe Boxen
const zusammen = async () => (await lesen(ansicht.locator('.facts .pill').first()));
const voll = await zusammen();
await ansicht.locator('[data-doppel-halb="1"]').click();
check(await bis(async () => (await ansicht.locator('[data-doppel-halb="1"]').getAttribute('aria-pressed')) === 'true' && (await zusammen()) !== voll), `Je 4 Boxen: schneller (${voll} → ${await zusammen()})`);
// Beide auf die Liste – mit den halben Mengen
const liste = () => att.liste()?.items || {};
await ansicht.locator('[data-act="doppel-liste"]').click();
check(await bis(() => liste().rindergulasch?.parts?.gulasch?.q === 500 && Object.values(liste()).some((x) => x.parts?.[zweitesId])), 'Beide stehen auf der Liste, das Gulasch mit 500 g Fleisch (je 4 Boxen)');
check(/^Rindergulasch und .+: \d+ Zutaten auf der Liste/.test(await t.locator('#toast').innerText()), 'Eine Meldung für beide');
check(await bis(async () => (await lesen(ansicht.locator('.actions'))).includes('Alles von beiden steht auf der Liste')), 'Danach: alles von beiden steht auf der Liste');
await ansicht.locator('[data-doppel-halb="0"]').click();

// Kochmodus für beide
await ansicht.locator('[data-act="doppel-kochmodus"]').click();
const km = t.locator('#kochmodus');
check(await bis(() => km.locator('.km-text').isVisible()), 'Der Kochmodus für beide öffnet');
check((await lesen(km.locator('.km-titel'))).startsWith('Rindergulasch + ') && (await lesen(km.locator('.km-marke'))).startsWith('Rindergulasch'), 'Oben beide Namen, beim Schritt das Rezept');
const punkte = await km.locator('.km-punkte button').count();
check(punkte === flach(nach('gulasch')).length + flach(nach(zweitesId)).length && await km.locator('.km-punkte button.dp-k1').count() === flach(nach(zweitesId)).length, `Alle ${punkte} Schritte beider Rezepte, die Punkte in der Farbe des Rezepts`);
await km.locator('[data-km="erledigt"]').click();
const haken = (rid) => t.evaluate((r) => (JSON.parse(localStorage.getItem('boxenstopp.schritte.v2') || '{}')[r] || []), rid);
check(await bis(async () => (await haken('gulasch')).includes(0)), 'Erledigt: der Haken landet im Gulasch (Schritt 1)');
// Ein Schritt des anderen Rezepts
await km.locator('.km-punkte button.dp-k1').first().click();
check((await lesen(km.locator('.km-von.dp-k1'))) === nach(zweitesId).short, `Ein Punkt des anderen Rezepts: dessen Schritt („${nach(zweitesId).short}“)`);
await km.locator('[data-km="erledigt"]').click();
check(await bis(async () => (await haken(zweitesId)).length === 1), `Der Haken landet bei ${zweitesId}`);
const tempo = await t.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.tempo.v1') || '{"offen":{}}'));
check(!tempo.offen?.gulasch && !tempo.offen?.[zweitesId], 'Das Tempo lernt das Handy dabei nicht (zwischen zwei Haken lag das andere Rezept)');
// Ein Timer
const mitTimer = await t.evaluate(() => [...document.querySelectorAll('#kochmodus .km-punkte button')].length);
let timerGesehen = false;
for (let j = 0; j < mitTimer && !timerGesehen; j++) {
  await km.locator(`.km-punkte button[data-km-zu="${j}"]`).click();
  if (await km.locator('[data-km-timer]').count()) {
    await km.locator('[data-km-timer]').click();
    timerGesehen = await bis(() => km.locator(`.km-tm-zu[data-km-zu="${j}"]`).count().then((n) => n === 1));
  }
}
check(timerGesehen, 'Ein Timer läuft und gehört zu seinem Schritt im Kochmodus');
await km.locator('[data-km="zu"]').click();
check(await bis(() => km.evaluate((x) => !x.open)) && await ansicht.isVisible(), 'Zu: zurück im Plan');

// Ein Rezept fast fertig: der letzte Haken sagt, wie es weitergeht
const n2 = flach(nach(zweitesId)).length;
await t.evaluate(async ([r, n]) => { const m = await import('./js/kochstand.js'); m.schritteSetzen(r, new Set(Array.from({ length: n - 1 }, (_, i) => i))); }, [zweitesId, n2]);
await ansicht.locator('[data-act="doppel-kochmodus"]').click();
await bis(() => km.locator('.km-text').isVisible());
await km.locator('.km-punkte button.dp-k1:not(.f)').first().click();
await km.locator('[data-km="erledigt"]').click();
check(await bis(async () => / ist fertig – weiter mit Rindergulasch\.$/.test(await t.locator('#toast').innerText())), `Das eine fertig: „${await t.locator('#toast').innerText()}“`);
await km.locator('[data-km="zu"]').click();

// Zurück: zum Rezept, von dem es kam
await ansicht.locator('[data-act="doppel-zu"]').click();
check(await bis(() => t.locator('#detail').isVisible()) && (await t.locator('#d-title').innerText()) === nach('gulasch').name, 'Zurück: ins Gulasch');
await t.click('#detail [data-act="zurueck"]');

// Die Kachel: die besten Paare
await t.click('#browse [data-act="doppel"]');
check(await bis(() => ansicht.locator('.doppel-z').count().then((n) => n >= 4), 8000), 'Kachel „Zwei auf einmal“: die besten Paare');
check((await lesen(t.locator('#dp-titel'))) === 'Zwei Rezepte, ein Nachmittag' && (await ansicht.locator('.doppel-z').first().getAttribute('data-doppel')).split(' ').length === 2, 'Mit Überschrift, jedes Paar zum Antippen');
await ansicht.locator('[data-act="doppel-zu"]').click();
check(await bis(() => t.locator('#browse').isVisible()) && await ansicht.isHidden(), 'Zurück zu allen Rezepten');
check(tobi.fehler.length === 0, `Keine Fehler im Browser (${tobi.fehler.join(' | ')})`);
await tobi.ctx.close();
await browser.close();

ende();
