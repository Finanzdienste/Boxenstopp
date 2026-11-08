/*
 * Zwei auf einmal: zwei Rezepte gleichzeitig kochen. Ein Koch, ein Ofen –
 * die Zeit, in der das eine köchelt, schmort oder im Ofen ist, gehört dem
 * anderen. Ohne DOM, damit tests/test-doppel.mjs alles direkt in Node prüft.
 *
 *   aufgabenVon(r)      jeder Schritt als Arbeit und Warten: „Zugedeckt 25 Min.
 *                       köcheln“ sind 2 Min. Arbeit und 23 Min., in denen man
 *                       frei ist; „3 Zwiebeln würfeln“ sind 9 Min. Arbeit. ruhe
 *                       läuft im Hintergrund (Ofen vorheizen, Reis quellen);
 *                       neben passiert, während der Schritt davor läuft – bei
 *                       einem, an dem man steht (anbraten), in dessen Zeit, bei
 *                       einem, der von selbst läuft, danach (zeiten.js).
 *   doppelPlan([a, b])  wer wann was macht. Ein Koch, also immer eins nach dem
 *                       anderen, und zuerst, was gleich raus muss: Nudeln
 *                       abgießen, das Blech aus dem Ofen, „sobald der Reis
 *                       fertig ist“ – das andere wartet so lange. Sonst die
 *                       Arbeit, die am frühesten gehen kann; Schälen fürs
 *                       Gulasch, das noch eine Stunde schmort, darf warten; das
 *                       Rezept, dessen Weg bestimmt, wann alles fertig ist,
 *                       geht vor; sonst bleibt man beim Rezept, an dem man
 *                       gerade ist (Hin und Her verwirrt nur), und am Anfang
 *                       fängt das mit dem längeren Weg an. Der Ofen hat eine
 *                       Temperatur und Platz für zwei Bleche: Wer ihn angeheizt
 *                       hat, hat ihn, bis er fertig ist – teilen geht nur bei
 *                       derselben Temperatur –, und angeheizt wird erst kurz
 *                       bevor er gebraucht wird. Vorbereiten, Kochen,
 *                       Portionieren bleiben je Rezept in ihrer Reihenfolge,
 *                       gemischt wird zwischen den Rezepten.
 *   doppelBester(a, b)  der beste Plan aus beiden Reihenfolgen und ein paar
 *                       Einstellungen – nie länger als nacheinander.
 *   doppelPartner(r, …) welche Rezepte gut mit r zusammen gehen: Zeit, die man
 *                       spart, Reste, die das andere aufbraucht (reste.js),
 *                       anderes Protein für Abwechslung; Warnungen (zwei große
 *                       Töpfe). besteDoppel: die besten Paare überhaupt.
 *   schalenPlan(plan)   die Schalen beider Rezepte: Was das erste Rezept schon
 *                       geleert hat, nimmt das zweite wieder (kurz ausspülen),
 *                       der Rest bekommt neue Nummern.
 *
 * Die Zeiten sind eine gute Schätzung aus den Schritt-Daten, kein Profi-
 * Küchenplan. Wie lange jemand für einen Schritt braucht, kann der Aufrufer
 * mitgeben (minuten: das eigene Tempo, tempo.js).
 */
import { timerPlan, dauer, zeitVon, runden5 } from './zeiten.js';
import { resteVon, postenVon, restWert } from './reste.js';

/** Woran man erkennt, dass man warten kann: Garen ohne Zutun. */
const PASSIV = /köcheln|schmoren|backen|überbacken|garen|dämpfen|ziehen lassen|quellen|marinieren|ruhen lassen|abkühlen lassen|im Ofen|in den Ofen|weich kochen|kochen lassen|einkochen|zugedeckt/i;
/** Ab wie vielen Minuten sich das lohnt. */
const MIN_PASSIV = 6;
/** Was im Hintergrund läuft, während es mit dem Rezept weitergeht. */
const HINTERGRUND = /vorheiz|aufsetzen|Reis|marinier|kalt stellen|ruhen lassen|quellen|abkühlen/i;
const OFEN = /\bOfen\b|Backofen|\bBleche?\b|Auflaufform|backen\b/i;
const OFEN_TEMP = /(\d{3})\s*°\s*C(?:\s*(Umluft|Heißluft|Ober-\/Unterhitze|Grill))?/i;
/** So viele Bleche oder Formen passen in einen Ofen. */
export const OFEN_PLATZ = 2;
/** Schritte, die warten, bis etwas im Hintergrund fertig ist – und dann gleich dran sind. */
const WARTET = [
  /sobald (?:die|der|das) [^,.;]*\bum (?:sind|ist)/i,
  /^(?:wenn|sobald) (?:der|die|das) [^:]{0,40}(?:klingelt|fertig ist|weich sind|weich ist|gar ist|durch ist)/i,
  /\b(?:Blech|Bleche|Form) herausnehmen/i,
  /aus dem Ofen (?:nehmen|holen)/i,
  /^Abgießen\b/i,
  /\b(?:Nudeln|Spaghetti|Kartoffeln|Reis)(?: und [A-ZÄÖÜ][a-zäöüß]+)? abgießen/i,
];
const VORHER = /(\d+)\s*Min\.?\s*bevor der Timer klingelt/i;
const ABGIESSEN = /abgießen/i;
const IM_WASSER = /kochend|Salzwasser|blanchier|vorkoch|\bkochen\b/i;
/** So lange darf etwas warten, das gleich raus muss … */
const TOL = 2;
/** … und so lange, was nur weiterköchelt. */
const TOL_WEICH = 5;
/** So viele Schritte schaut der Plan voraus, ob gleich etwas raus muss. */
const VORAUS = 8;
/** Was beim eigenen Rezept so viele Minuten Luft hat, darf warten, wenn das andere weiter muss. */
const LOCKER = 10;
/**
 * Ein Rezept, dessen Weg so nah an „alles fertig“ liegt, geht vor. Welcher
 * Abstand am besten ist, hängt vom Paar ab – doppelBester probiert diese.
 */
const KRITISCH = 15;
const KRITISCH_PROBEN = [5, 15, 30];

const flach = (r) => (r?.ablauf || []).flatMap((p) => p.schritte || []);

/**
 * Die Schritte eines Rezepts als Aufgaben: { i (Nummer im Rezept, wie im
 * Kochstand), pi (Abschnitt), t, aktiv, warten, ruhe, neben, ofen: { key,
 * last } | null, wartet, vorher, d }. warten hält das Rezept auf (die Sauce
 * köchelt, bevor es weitergeht), ruhe nicht (der Ofen heizt vor).
 */
export function aufgabenVon(r, { minuten } = {}) {
  const aus = [];
  let i = 0;
  let key = '';
  let last = 1;
  (r?.ablauf || []).forEach((p, pi) => (p.schritte || []).forEach((s) => {
    const idx = i++;
    const d = String(s.d || '');
    const min = Math.max(0, Number(minuten ? minuten(r, idx, s) : s.min) || 0);
    const plan = timerPlan(s);
    const passiv = !!plan && plan.min >= MIN_PASSIV && min >= MIN_PASSIV && PASSIV.test(d);
    const aktiv = passiv ? Math.min(min, /rühr|wend/i.test(d) ? 3 : 2) : min;
    let warten = passiv ? min - aktiv : 0;
    let ruhe = Math.max(0, Number(s.ruhe) || 0);
    // „währenddessen“ hält nichts auf – was dabei von selbst läuft, läuft im Hintergrund
    if (s.neben && warten) { ruhe = Math.max(ruhe, warten); warten = 0; }
    // „Aufkochen und zugedeckt 20 Min. köcheln“ mit ruhe: Das ist das Gericht selbst – weiter geht es erst danach
    // (anders als Ofen vorheizen, Wasser aufsetzen, Reis quellen, Marinieren, wo nebenher etwas anderes dran ist)
    if (!s.neben && !warten && ruhe >= MIN_PASSIV && !/vorbereit|schnippel|mise/i.test(p.t) && PASSIV.test(d) && !HINTERGRUND.test(d) && !OFEN.test(d)) { warten = ruhe; ruhe = 0; }
    const m = OFEN_TEMP.exec(d);
    if (m) key = `${m[1]}${m[2] ? ` ${/heiß/i.test(m[2]) ? 'Umluft' : m[2]}` : ''}`;
    let ofen = null;
    if (OFEN.test(d) && (warten > 0 || ruhe > 0)) {
      // Wie viele Bleche oder Formen drin sind – „18 Min. weiterbacken“ sagt es nicht, dann wie zuletzt
      if (!/vorheizen/i.test(d)) last = /\bBleche\b|beide in den Ofen/i.test(d) ? 2 : /\bBlech\b|Form\b|Bräter/i.test(d) ? 1 : last;
      ofen = { key, last: /vorheizen/i.test(d) ? 0 : last };
    }
    const vorher = Number(VORHER.exec(d)?.[1]) || 0;
    let wartet = !!vorher || WARTET.some((re) => re.test(d));
    // „Abgießen“ gleich nach „3 Min. blanchieren“ wartet auf nichts – das war der Schritt davor
    const davor = aus[aus.length - 1];
    if (wartet && ABGIESSEN.test(d) && davor && !davor.warten && !davor.ruhe && IM_WASSER.test(davor.d)) wartet = false;
    aus.push({ i: idx, pi, t: p.t, aktiv, warten, ruhe, neben: !!s.neben, ofen, wartet, vorher, d });
  }));
  return aus;
}

/** aufgabenVon, gemerkt je Rezept und Tempo – besteDoppel rechnet sonst tausendmal dasselbe. */
const gemerkt = new WeakMap();
const OHNE_TEMPO = () => {};
function merken(r, minuten, art, rechnen) {
  let m = gemerkt.get(r);
  if (!m) { m = new Map(); gemerkt.set(r, m); }
  const k = `${art}`;
  let je = m.get(minuten || OHNE_TEMPO);
  if (!je) { je = {}; m.set(minuten || OHNE_TEMPO, je); }
  if (!(k in je)) je[k] = rechnen();
  return je[k];
}
const aufgaben = (r, minuten) => merken(r, minuten, 'roh', () => aufgabenVon(r, { minuten }));
/**
 * Die Aufgaben, wie der Plan sie braucht – gerechnet aus dem Rezept allein:
 * luft (so lange lässt das Rezept selbst etwas warten, das auf den
 * Hintergrund wartet: Bleibt das Blech dort 5 Min. länger drin, darf es das
 * im Plan auch) und das Vorheizen kurz vor dem Ofen (vorheizenSpaeter).
 */
const geplant = (r, minuten) => merken(r, minuten, 'plan', () => {
  const roh = aufgaben(r, minuten);
  const allein = planen([{ r, t: roh }], {});
  const luft = new Map(allein.schritte.filter((x) => x.ziel !== null).map((x) => [x.i, Math.max(0, x.start - x.ziel)]));
  const t = roh.map((a) => (luft.has(a.i) ? { ...a, luft: luft.get(a.i) } : a));
  if (!t.some((a) => a.ofen && a.ofen.last === 0 && a.ruhe > 0)) return t;
  return vorheizenSpaeter(t, new Map(allein.schritte.map((x) => [x.i, x.start])));
});

/** Worauf ein wartender Schritt wartet: auf den Reis, aufs Blech – sonst auf das, was zuletzt im Wasser angefangen hat. */
function zielVon(bg, d) {
  const rueck = [...bg].reverse();
  if (/Reis/i.test(d)) return rueck.find((b) => /Reis/i.test(b.d)) || null;
  if (/Blech|Bleche|Form|Ofen/i.test(d)) return rueck.find((b) => b.ofen) || null;
  // Der Reis quillt nebenher und der Ofen hat seine eigenen Schritte – „Abgießen“ meint die Nudeln
  return rueck.find((b) => !b.ofen && !/Reis/i.test(b.d)) || null;
}

/** Ab wann der Ofen für einen Schritt frei ist: nicht belegt von einem anderen Rezept, außer bei derselben Temperatur mit Platz. */
function ofenAb(belegt, k, a, start) {
  const lang = a.aktiv + Math.max(a.warten, a.ruhe);
  let s = start;
  for (let n = 0; n < 100 && s < Infinity; n++) {
    const stoerer = belegt.find((o) => o.k !== k && o.von < s + lang && s < o.bis
      && !(a.ofen.key && a.ofen.key === o.key && a.ofen.last + o.last <= OFEN_PLATZ));
    if (!stoerer) return s;
    s = stoerer.bis;
  }
  return s;
}

/**
 * Was bei x gleich dran sein muss, und wie lange es bei x bis dahin noch
 * dauert: [{ D (spätestens dann), W, g (wie schlimm Zuspätkommen ist) }]. Ein Schritt, der auf den Hintergrund wartet (Nudeln abgießen,
 * Blech raus – so spät, wie das Rezept allein es auch täte, luft), oder –
 * halb so schlimm – der nächste Hauptschritt nach etwas, das köchelt. W:
 * die Arbeit dazwischen, bei einem Hauptschritt auch das Warten der Kette.
 */
function fristVon(x) {
  const aus = [];
  let arbeit = 0;
  let kette = 0;
  const neu = [];
  let hauptGesehen = false;
  for (let j = x.next; j < Math.min(x.t.length, x.next + VORAUS); j++) {
    const a = x.t[j];
    if (a.pi !== x.t[x.next].pi) break;
    if (!a.neben && !hauptGesehen) {
      hauptGesehen = true;
      if (x.passiv) aus.push({ D: x.kette + TOL_WEICH, W: kette, g: 0.5 });
    }
    if (a.wartet) {
      const z = zielVon([...x.bg, ...neu], a.d);
      // Wartet auf etwas, das erst noch anfängt – dann weiß man es noch nicht
      if (z?.unbekannt) break;
      if (z) { aus.push({ D: z.bis - a.vorher + TOL + (a.luft || 0), W: a.neben ? arbeit : kette, g: 1 }); break; }
    }
    if (a.ruhe > 0 || a.warten > 0) neu.push({ unbekannt: true, d: a.d, ofen: !!a.ofen });
    arbeit += a.aktiv;
    kette += a.aktiv + (a.neben ? 0 : a.warten);
  }
  return aus;
}

/**
 * Der Plan für zwei (oder mehr) Rezepte: { ende, schritte: [{ start, bis,
 * warten, ruhe, k, rid, i, pi, t, neben, drin, ziel }] } – k ist das
 * wievielte Rezept, i die Nummer des Schritts im Rezept, drin: läuft in der
 * Zeit des Schritts davor mit, ziel: wann das fertig war, worauf der Schritt
 * gewartet hat (sonst null). Zeiten in Minuten ab Start. nacheinander: erst
 * das eine ganz, dann das andere (zum Vergleich).
 */
export function doppelPlan(rezepte, { minuten, nacheinander = false, kritischAb = KRITISCH } = {}) {
  return planen(rezepte.map((r) => ({ r, t: geplant(r, minuten) })), { nacheinander, kritischAb });
}

/** Der Plan selbst: je Rezept r und seine Aufgaben t in der Reihenfolge, in der sie drankommen. */
function planen(liste, { nacheinander = false, kritischAb = KRITISCH }) {
  const st = liste.map(({ r, t }, k) => ({ k, r, t, next: 0, kette: 0, nebenAb: 0, huelle: 0, passiv: false, bg: [], ende: [], fertig: Infinity, halt: null, heiss: 0 }));
  // Der Weg, der noch vor einem Rezept liegt (Arbeit und Warten), und die Arbeit allein – ab jedem Schritt
  for (const x of st) {
    x.ofenRest = x.t.filter((a) => a.ofen).length;
    x.wegAb = new Array(x.t.length + 1).fill(0);
    x.arbeitAb = new Array(x.t.length + 1).fill(0);
    for (let j = x.t.length - 1; j >= 0; j--) {
      const a = x.t[j];
      x.wegAb[j] = x.wegAb[j + 1] + (a.neben ? 0 : a.aktiv + a.warten);
      x.arbeitAb[j] = x.arbeitAb[j + 1] + a.aktiv;
    }
  }
  const weg = (x) => x.wegAb[x.next];
  const arbeit = (x) => x.arbeitAb[x.next];
  const belegt = [];
  const schritte = [];
  let koch = 0;
  let letzter = -1;
  for (;;) {
    const offen = st.filter((x) => x.next < x.t.length);
    if (!offen.length) break;
    // So früh wäre alles fertig, wenn nie jemand wartet – und so früh jedes Rezept, wenn es den Koch für sich hätte
    const voll = koch + offen.reduce((n, x) => n + arbeit(x), 0);
    let kand = offen.map((x) => {
      const a = x.t[x.next];
      let frueh = a.neben ? x.nebenAb : x.kette;
      for (let p = 0; p < a.pi; p++) frueh = Math.max(frueh, x.ende[p] || 0);
      let ziel = null;
      if (a.wartet) { const z = zielVon(x.bg, a.d); if (z) { ziel = z.bis - a.vorher; frueh = Math.max(frueh, ziel); } }
      if (a.ofen && a.ofen.last > 0) frueh = Math.max(frueh, x.heiss);
      if (nacheinander) for (const y of st) if (y.k < x.k) frueh = Math.max(frueh, y.fertig);
      const drin = a.neben && frueh < x.huelle;
      let start = drin ? frueh : Math.max(frueh, koch);
      if (a.ofen) start = ofenAb(belegt, x.k, a, start);
      // Arbeit fürs Rezept, das gerade von selbst gart, die noch lange Zeit hat (Kartoffeln schälen, während das Gulasch schmort)
      const locker = a.neben && x.passiv && x.kette - (Math.max(koch, start) + nebenBis(x)) > LOCKER;
      // Wessen Weg bestimmt, wann alles fertig ist?
      const kritisch = Math.max(koch, x.kette) + weg(x) >= voll - kritischAb;
      return { x, a, frueh, start, ziel, drin, locker, kritisch, weg: weg(x) };
    });
    // Um wie viel später käme beim anderen, was gleich raus muss, wenn jetzt das hier drankommt? Was dort
    // ohnehin zu spät ist (weil es selbst noch nicht so weit ist), zählt nicht – nur, was dieser Schritt dazutut.
    const fristen = new Map(kand.map((c) => [c.x, fristVon(c.x)]));
    for (const c of kand) {
      const bis = (c.start < Infinity ? c.start : koch) + c.a.aktiv;
      let spaet = 0;
      for (const y of kand) {
        if (y === c) continue;
        const ab = Math.max(koch, y.frueh < Infinity ? y.frueh : koch);
        for (const f of fristen.get(y.x)) spaet += f.g * (Math.max(0, Math.max(bis, ab) + f.W - f.D) - Math.max(0, ab + f.W - f.D));
      }
      c.spaet = spaet;
    }
    // Was gar nicht geht (Ofen besetzt, bis der andere fertig ist), kommt nur dran, wenn sonst nichts geht
    const geht = kand.filter((c) => c.start < Infinity);
    if (geht.length) kand = geht;
    else kand = kand.map((c) => ({ ...c, start: Math.max(c.frueh < Infinity ? c.frueh : koch, koch) }));
    // Bei Gleichstand: beim Rezept bleiben, an dem man gerade ist – Hin und Her verwirrt nur
    kand.sort((p, q) => p.spaet - q.spaet || p.start - q.start || p.locker - q.locker || q.kritisch - p.kritisch
      || (q.x.k === letzter) - (p.x.k === letzter) || (q.a.wartet - p.a.wartet) || p.frueh - q.frueh || q.weg - p.weg || p.x.k - q.x.k);
    const { x, a, start, drin, ziel } = kand[0];
    if (!drin) letzter = x.k;
    const bis = start + a.aktiv;
    koch = Math.max(koch, bis);
    if (a.neben) x.nebenAb = bis;
    else {
      x.kette = bis + a.warten;
      x.nebenAb = a.warten ? bis : start;
      x.huelle = a.warten ? 0 : bis;
      x.passiv = a.warten > 0;
    }
    if (a.ruhe > 0 || a.warten > 0) x.bg.push({ bis: bis + Math.max(a.ruhe, a.warten), d: a.d, ofen: !!a.ofen });
    x.ende[a.pi] = Math.max(x.ende[a.pi] || 0, bis + a.warten, a.frei ? bis : bis + a.ruhe);
    if (a.ofen) {
      if (a.ofen.last === 0) x.heiss = Math.max(x.heiss, bis + a.ruhe);
      // Bis zum nächsten Ofenschritt dieses Rezepts bleibt er auf seiner Temperatur
      if (x.halt) x.halt.bis = start;
      const aus = bis + Math.max(a.warten, a.ruhe);
      belegt.push({ k: x.k, von: start, bis: aus, key: a.ofen.key, last: a.ofen.last });
      x.ofenRest -= 1;
      x.halt = x.ofenRest > 0 ? { k: x.k, von: aus, bis: Infinity, key: a.ofen.key, last: 0 } : null;
      if (x.halt) belegt.push(x.halt);
    }
    schritte.push({ start, bis, warten: a.warten, ruhe: a.ruhe, k: x.k, rid: x.r.id, i: a.i, pi: a.pi, t: a.t, neben: a.neben, drin, ziel });
    x.next += 1;
    if (x.next >= x.t.length) x.fertig = Math.max(koch, ...x.ende);
  }
  const ende = Math.max(koch, ...st.map((x) => Math.max(0, ...x.ende)));
  return { ende, schritte };
}

/** Wie viel „währenddessen“ bei x noch kommt, bevor es mit dem nächsten Hauptschritt weitergeht. */
function nebenBis(x) {
  let n = 0;
  for (let j = x.next; j < x.t.length && x.t[j].neben; j++) n += x.t[j].aktiv;
  return n;
}

/**
 * Den Ofen erst anheizen, wenn er bald gebraucht wird: Im Rezept steht
 * „Ofen vorheizen“ ganz vorn, weil das Vorbereiten länger dauert – kocht man
 * zwei Rezepte, zieht sich das Vorbereiten, und der Ofen liefe eine Stunde
 * leer. Also wandert das Vorheizen vor den letzten Hauptschritt, nach dem
 * es – im Rezept allein gerechnet (start: Schritt → Minute) – noch rechtzeitig
 * heiß ist; der erste Schritt im Ofen wartet, bis er heiß ist. Es gehört dann
 * zum Abschnitt, in dem es jetzt steht, und hält ihn nicht auf (frei).
 */
function vorheizenSpaeter(t, start) {
  let aus = [...t];
  for (const a of t) {
    if (!a.ofen || a.ofen.last !== 0 || !a.ruhe) continue;
    const p = aus.indexOf(a);
    const u = aus.findIndex((b, j) => j > p && b.ofen && b.ofen.last > 0);
    if (u < 0) continue;
    const bis = start.get(aus[u].i);
    let q = -1;
    for (let j = u; j > p + 1; j--) {
      if (aus[j].neben) continue;
      if (bis - start.get(aus[j].i) >= a.ruhe + a.aktiv) { q = j; break; }
    }
    if (q < 0) continue;
    const neu = { ...a, pi: aus[q].pi, t: aus[q].t, frei: true };
    aus = [...aus.slice(0, p), ...aus.slice(p + 1, q), neu, ...aus.slice(q)];
  }
  return aus;
}

/** Wie lange ein Rezept allein nach derselben Rechnung dauert – damit „statt“ fair ist. */
export const alleinMinuten = (r, opt) => doppelPlan([r], opt).ende;

/**
 * Der beste Plan für a und b: { plan, reihe: [erstes, zweites] }. Beide
 * Reihenfolgen und ein paar Abstände für „kritisch“ probiert – und nie
 * schlechter als nacheinander.
 */
export function doppelBester(a, b, { minuten } = {}) {
  let best = { reihe: [a, b], plan: doppelPlan([a, b], { minuten, nacheinander: true }) };
  for (const kritischAb of KRITISCH_PROBEN) {
    for (const reihe of [[a, b], [b, a]]) {
      const plan = doppelPlan(reihe, { minuten, kritischAb });
      if (plan.ende < best.plan.ende) best = { reihe, plan };
    }
  }
  return best;
}

/* ----------------------------------------------------------- Schalen */

const SCHALEN = /\b(Schalen?)\s+(\d+(?:\s*(?:,|und|bis|–|-)\s*\d+)*)/g;

/** Die Schalen in einem Text: „Schale 2“, „Schalen 1 und 3“, „Schalen 1–3“ → [2], [1, 3], [1, 2, 3]. */
export function schalenIm(text) {
  const aus = [];
  for (const m of String(text || '').matchAll(SCHALEN)) {
    const teile = m[2].split(/\s*(,|und|bis|–|-)\s*/);
    for (let j = 0; j < teile.length; j += 2) {
      const n = Number(teile[j]);
      const bis = teile[j + 1] === 'bis' || teile[j + 1] === '–' || teile[j + 1] === '-';
      if (bis && j + 2 < teile.length) { for (let x = n; x <= Number(teile[j + 2]); x++) aus.push(x); j += 2; } else aus.push(n);
    }
  }
  return [...new Set(aus.filter((n) => Number.isInteger(n) && n > 0))];
}

/** „Schale 2“ → „Schale 7“ nach der Zuordnung nr (alte Nummer → neue); Bereiche werden zur Aufzählung. */
export function schalenUmbenennen(text, nr) {
  if (!nr || !Object.keys(nr).length) return String(text || '');
  return String(text || '').replace(SCHALEN, (m, wort, zahlen) => {
    const neu = schalenIm(`${wort} ${zahlen}`).map((n) => nr[n] || n);
    if (neu.length === 1) return `${wort} ${neu[0]}`;
    return `${wort} ${neu.slice(0, -1).join(', ')} und ${neu[neu.length - 1]}`;
  });
}

const GROESSE = { klein: 1, mittel: 2, groß: 3 };

/**
 * Die Schalen beider Rezepte im Plan: { nr: [{alt → neu} je Rezept], schalen:
 * [{ n, name, gr, k }] je Rezept mit den neuen Nummern, zahl (so viele braucht
 * man), getrennt (so viele wären es ohne Wiederverwenden), wieder: Set
 * `${k}:${alt}` der Schalen, die schon einmal benutzt waren (kurz ausspülen) }.
 * Das erste Rezept behält seine Nummern.
 */
export function schalenPlan(plan, rezepte) {
  const nutzung = rezepte.map(() => new Map());
  for (const s of plan.schritte) {
    const x = flach(rezepte[s.k])[s.i];
    for (const n of schalenIm([x?.d, ...(x?.liste || [])].join(' '))) {
      const u = nutzung[s.k].get(n) || { von: s.start, bis: s.bis };
      u.von = Math.min(u.von, s.start);
      u.bis = Math.max(u.bis, s.bis);
      nutzung[s.k].set(n, u);
    }
  }
  const infoVon = (r, n) => (r.schalen || []).find((x) => Number(x.n) === n) || { n, name: '', gr: 'mittel' };
  const nr = rezepte.map(() => ({}));
  const physisch = [];
  const wieder = new Set();
  // Das erste Rezept wie im Rezept
  const erste = [...new Set([...(rezepte[0].schalen || []).map((s) => Number(s.n)), ...nutzung[0].keys()])];
  for (const n of erste) { nr[0][n] = n; physisch.push({ n, k: 0, gr: infoVon(rezepte[0], n).gr || 'mittel', frei: nutzung[0].get(n)?.bis ?? Infinity }); }
  // Die anderen: in der Reihenfolge, in der sie gebraucht werden
  for (let k = 1; k < rezepte.length; k++) {
    const r = rezepte[k];
    const alle = [...new Set([...(r.schalen || []).map((s) => Number(s.n)), ...nutzung[k].keys()])];
    alle.sort((p, q) => (nutzung[k].get(p)?.von ?? Infinity) - (nutzung[k].get(q)?.von ?? Infinity) || p - q);
    const neue = [];
    for (const n of alle) {
      const u = nutzung[k].get(n);
      const gr = GROESSE[infoVon(r, n).gr] || 2;
      // Nur Schalen des anderen Rezepts – im selben Rezept bleibt jede Nummer eine Schale
      const frei = u ? physisch.filter((p) => p.k !== k && p.frei <= u.von && (GROESSE[p.gr] || 2) >= gr)
        .sort((p, q) => (GROESSE[p.gr] || 2) - (GROESSE[q.gr] || 2) || p.frei - q.frei || p.n - q.n) : [];
      if (frei.length) {
        nr[k][n] = frei[0].n;
        frei[0].frei = u.bis;
        frei[0].k = k;
        wieder.add(`${k}:${n}`);
      } else neue.push(n);
    }
    // Die neuen Schalen der Reihe nach, wie im Rezept
    let hoechste = Math.max(0, ...physisch.map((p) => p.n));
    for (const n of neue.sort((p, q) => p - q)) {
      hoechste += 1;
      nr[k][n] = hoechste;
      physisch.push({ n: hoechste, k, gr: infoVon(r, n).gr || 'mittel', frei: nutzung[k].get(n)?.bis ?? Infinity });
    }
  }
  const schalen = rezepte.map((r, k) => (r.schalen || []).map((s) => ({ ...s, n: nr[k][s.n] || s.n, k })));
  const getrennt = rezepte.reduce((n, r, k) => n + new Set([...(r.schalen || []).map((s) => Number(s.n)), ...nutzung[k].keys()]).size, 0);
  return { nr, schalen, zahl: physisch.length, getrennt, wieder };
}

/* ----------------------------------------------------------- Geräte */

const GROSS = /topf|pfanne|bräter|wok|auflaufform|blech/i;
const ohneKlammer = (g) => String(g || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
/** Woran man dasselbe Gerät erkennt: klein geschrieben, Bleche wie Blech. */
const geraetKey = (name) => name.toLowerCase().replace(/bleche\b/, 'blech');

/**
 * Geräte beider Rezepte zusammen: Töpfe, Pfannen, Bleche und Formen zählen
 * (beide brauchen einen großen Topf → „2 × großer Topf“, zweimal zwei Bleche
 * → „4 Backbleche“), Kleines (Sieb, Reibe) gibt es einmal – das spült man
 * zwischendurch. Geschrieben wie im ersten Rezept, das es nennt.
 */
export function geraeteZusammen(rezepte) {
  const zahl = new Map();
  for (const r of rezepte) {
    const hier = new Map();
    for (const g of r.geraete || []) {
      const ganz = ohneKlammer(g);
      if (!ganz) continue;
      const m = /^(\d+)\s+(.+)$/.exec(ganz);
      const name = m ? m[2] : ganz;
      const k = geraetKey(name);
      const x = hier.get(k) || { n: 0, name, mehrzahl: !!m };
      x.n += m ? Number(m[1]) : 1;
      hier.set(k, x);
    }
    for (const [k, x] of hier) {
      const da = zahl.get(k);
      if (!da) zahl.set(k, { ...x });
      else da.n = GROSS.test(k) ? da.n + x.n : Math.max(da.n, x.n);
    }
  }
  return [...zahl].map(([k, x]) => {
    if (x.n <= 1) return x.name.replace(/bleche\b/i, (w) => w.slice(0, -1));
    if (/blech$/.test(k)) return `${x.n} ${x.name.replace(/blech$/i, 'bleche')}`;
    // „2 Gabeln zum Zupfen“ steht schon in der Mehrzahl da, „großer Topf“ nicht
    return x.mehrzahl ? `${x.n} ${x.name}` : `${x.n} × ${x.name}`;
  });
}

/** Beide brauchen einen großen Topf (oder Bräter)? Dann braucht man zwei. */
export function zweiGrosseToepfe(a, b) {
  const gross = (r) => (r.geraete || []).some((g) => /großer (?:Nudel)?topf|bräter/i.test(g));
  return gross(a) && gross(b);
}
export const brauchtOfen = (r) => aufgaben(r).some((x) => x.ofen && x.ofen.last > 0);

/** Beide im Ofen bei derselben Temperatur? Dann reicht einmal vorheizen: '200 °C Umluft' oder ''. */
export function ofenGeteilt(a, b) {
  const keys = (r) => new Set(aufgaben(r).filter((x) => x.ofen && x.ofen.key).map((x) => x.ofen.key));
  const kb = keys(b);
  const k = [...keys(a)].find((x) => kb.has(x));
  return k ? k.replace(/^(\d{3})/, '$1 °C') : '';
}

/* ------------------------------------------------------ zusammen schneiden */

const SCHNEIDEN = ['zwiebeln', 'rote-zwiebeln', 'knoblauch', 'ingwer', 'paprika', 'zucchini', 'brokkoli', 'moehren', 'champignons', 'fruehlingszwiebeln', 'spitzkohl', 'staudensellerie', 'lauch', 'kartoffeln', 'suesskartoffel', 'aubergine', 'blumenkohl', 'weisskohl', 'koriander', 'petersilie'];

/** Was beide schneiden: die Namen, in der Reihenfolge von SCHNEIDEN – „Zwiebeln“, „Knoblauch“. */
export function gemeinsamSchneiden(a, b, katalog = {}) {
  const ks = (r) => new Set((r.items || []).filter((it) => !it.opt).map((it) => it.k));
  const ka = ks(a);
  const kb = ks(b);
  return SCHNEIDEN.filter((k) => ka.has(k) && kb.has(k)).map((k) => {
    const n = katalog[k]?.n || (a.items.find((it) => it.k === k)?.n) || k;
    return String(n).split(',')[0].trim();
  });
}
export const beideReis = (a, b) => [a, b].every((r) => (r.items || []).some((it) => it.k === 'reis'));

/* ------------------------------------------------------------ Warum */

const VERB = [
  [/schmoren|schmort/i, (n, d) => `${n} schmort ${d}`],
  [/backen|überbacken|im Ofen|in den Ofen/i, (n, d) => `${n} ist ${d} im Ofen`],
  [/köcheln|kochen/i, (n, d) => `${n} köchelt ${d}`],
  [/marinieren|kalt stellen/i, (n, d) => `${n} mariniert ${d}`],
  [/quellen/i, (n, d) => `${n} quillt ${d}`],
  [/ziehen/i, (n, d) => `${n} zieht ${d}`],
  [/dämpfen/i, (n, d) => `${n} dämpft ${d}`],
];
const kurz = (r) => r.short || r.name;

/**
 * Wo im Plan das Zusammenkochen am meisten bringt: die Wartezeit des einen
 * Rezepts, in der man am meisten am anderen arbeitet – „Rindergulasch
 * schmort 1 Std. 30 Min. – in der Zeit kochst du Moussaka.“ Oder ''.
 */
export function warumText(plan, rezepte) {
  let best = null;
  for (const s of plan.schritte) {
    const lang = Math.max(s.warten, s.ruhe);
    if (lang < 15) continue;
    const von = s.bis;
    const bis = s.bis + lang;
    const drin = plan.schritte.filter((o) => o.k !== s.k && !o.drin && o.start < bis && o.bis > von)
      .reduce((n, o) => n + Math.min(o.bis, bis) - Math.max(o.start, von), 0);
    if (drin >= 5 && (!best || drin > best.drin)) best = { s, lang, drin };
  }
  if (!best) return '';
  const r = rezepte[best.s.k];
  const k2 = rezepte.findIndex((_, k) => k !== best.s.k);
  const b = rezepte[k2];
  const text = flach(r)[best.s.i]?.d || '';
  const satz = VERB.find(([re]) => re.test(text))?.[1] || ((n, d) => `${n} gart ${d}`);
  const arbeitB = plan.schritte.filter((o) => o.k === k2 && !o.drin).reduce((n, o) => n + o.bis - o.start, 0) || 1;
  const vorbereiten = plan.schritte.filter((o) => o.k === k2 && !o.drin && o.pi === 0 && o.start < best.s.bis + best.lang && o.bis > best.s.bis)
    .reduce((n, o) => n + o.bis - o.start, 0);
  const rest = best.drin / arbeitB >= 0.75 ? `kochst du ${kurz(b)}` : vorbereiten >= best.drin * 0.6 ? `bereitest du ${kurz(b)} vor` : `kommst du mit ${kurz(b)} gut voran`;
  return `${satz(kurz(r), dauer(runden5(best.lang)))} – in der Zeit ${rest}.`;
}

/* --------------------------------------------------------- Partner */

/** Was das andere Rezept von den Resten des einen aufbraucht: { nutzt: [{ k, n, u, q }], euro } – Euro, die nicht im Müll landen. */
export function resteGeteilt(a, b, daten) {
  if (!daten?.katalog) return { nutzt: [], euro: 0 };
  const pa = postenVon(a);
  const pb = postenVon(b);
  const euro = restWert(pa, daten) + restWert(pb, daten) - restWert([...pa, ...pb], daten);
  const nutzt = [];
  for (const [von, zu] of [[pa, pb], [pb, pa]]) {
    for (const x of resteVon(von, daten)) {
      const q = zu.filter((z) => z.k === x.k && z.u === x.u).reduce((s, z) => s + z.q, 0);
      if (q > 0 && !nutzt.some((y) => y.k === x.k)) nutzt.push({ k: x.k, n: x.n, u: x.u, q: Math.min(q, x.rest) });
    }
  }
  return { nutzt, euro: Math.max(0, Math.round(euro * 100) / 100) };
}

/** Die Zeit eines Rezepts, wie das Rezept sie zeigt (mit Tempo, wenn der Aufrufer es weiß). */
const anzeigeStandard = (r) => zeitVon(r).gesamt;

/**
 * Ein Paar ganz: { a, b, reihe, plan, ende, zusammen, getrennt, spart, warum,
 * reste, ofen, toepfe, wert }. zusammen und getrennt so, wie die App sie
 * zeigt (auf 5 Minuten, getrennt = was die beiden Rezepte sagen).
 */
export function doppelPaar(a, b, { minuten, anzeige = anzeigeStandard, daten = null } = {}) {
  const { plan, reihe } = doppelBester(a, b, { minuten });
  const getrennt = anzeige(a) + anzeige(b);
  const zusammen = Math.min(runden5(plan.ende), getrennt);
  const spart = getrennt - zusammen;
  const reste = resteGeteilt(a, b, daten);
  const toepfe = zweiGrosseToepfe(a, b);
  const ofen = brauchtOfen(a) && brauchtOfen(b);
  // Reste zählen mit (1 € ≈ 8 Min.), aber höchstens so viel wie 40 Min. – es geht ums Zusammenkochen
  const wert = spart + Math.min(40, 8 * reste.euro) + (a.protein && b.protein && a.protein !== b.protein ? 5 : 0) - (toepfe ? 5 : 0);
  return { a, b, reihe, plan, ende: plan.ende, zusammen, getrennt, spart, warum: warumText(plan, reihe), reste, ofen, toepfe, wert };
}

/** Darunter lohnt sich Zusammenkochen nicht – dann lieber nacheinander. */
export const MIN_SPART = 10;

/** Wie viel ein Rezept höchstens freie Zeit hat – mehr kann ein Partner nicht sparen. */
function freiZeit(r, minuten) {
  return aufgaben(r, minuten).reduce((n, a) => n + Math.max(a.warten, a.ruhe) + (a.neben ? a.aktiv : 0), 0);
}

/**
 * Die besten Partner für r: [doppelPaar …], am meisten gesparte Zeit
 * zuerst (dazu Reste, 1 € ≈ 8 Min., höchstens 40, und ein bisschen
 * Abwechslung) – nur, wo es mindestens MIN_SPART Minuten bringt.
 */
export function doppelPartner(r, rezepte = [], { minuten, anzeige = anzeigeStandard, daten = null, max = 3, ohne = [] } = {}) {
  if (!r?.ablauf?.length) return [];
  const aus = [];
  for (const c of rezepte) {
    if (!c?.ablauf?.length || c.id === r.id || ohne.includes(c.id)) continue;
    const p = doppelPaar(r, c, { minuten, anzeige, daten });
    if (p.spart >= MIN_SPART) aus.push(p);
  }
  return aus.sort((p, q) => q.wert - p.wert || q.spart - p.spart || p.b.id.localeCompare(q.b.id)).slice(0, max);
}

/**
 * Die besten Paare überhaupt: [doppelPaar …]. Jedes Rezept höchstens
 * zweimal, damit nicht alles mit dem Gulasch ist. Erst grob (ein Plan je
 * Reihenfolge), und was nach oben hin nicht mehr reichen kann (weniger freie
 * Zeit als der Schlechteste in der Liste), gar nicht erst; die Besten dann
 * genau wie im Rezept.
 */
export function besteDoppel(rezepte = [], { minuten, anzeige = anzeigeStandard, daten = null, max = 8, jeRezept = 2 } = {}) {
  const rs = rezepte.filter((r) => r?.ablauf?.length);
  const frei = new Map(rs.map((r) => [r.id, freiZeit(r, minuten)]));
  const allein = new Map(rs.map((r) => [r.id, anzeige(r)]));
  const paare = [];
  for (let x = 0; x < rs.length; x++) {
    for (let y = x + 1; y < rs.length; y++) {
      const a = rs[x];
      const b = rs[y];
      // Mehr sparen geht nicht: höchstens die freie Zeit beider, höchstens das kürzere Rezept
      const grenze = Math.min(frei.get(a.id) + frei.get(b.id), allein.get(a.id), allein.get(b.id)) + 15;
      paare.push({ a, b, grenze });
    }
  }
  paare.sort((p, q) => q.grenze - p.grenze);
  // Jedes Rezept höchstens jeRezept-mal, die Besten zuerst
  const auswahl = (liste, n) => {
    const zaehl = new Map();
    const aus = [];
    for (const p of liste) {
      if ((zaehl.get(p.a.id) || 0) >= jeRezept || (zaehl.get(p.b.id) || 0) >= jeRezept) continue;
      aus.push(p);
      zaehl.set(p.a.id, (zaehl.get(p.a.id) || 0) + 1);
      zaehl.set(p.b.id, (zaehl.get(p.b.id) || 0) + 1);
      if (aus.length >= n) break;
    }
    return aus;
  };
  const genug = max * 2;
  const grob = [];
  let schwelle = -Infinity;
  for (const p of paare) {
    if (p.grenze < schwelle) break;
    const ende = Math.min(doppelPlan([p.a, p.b], { minuten }).ende, doppelPlan([p.b, p.a], { minuten }).ende);
    p.schaetzung = allein.get(p.a.id) + allein.get(p.b.id) - runden5(ende);
    if (p.schaetzung < MIN_SPART) continue;
    grob.push(p);
    grob.sort((u, v) => v.schaetzung - u.schaetzung);
    const jetzt = auswahl(grob, genug);
    if (jetzt.length >= genug) schwelle = jetzt[jetzt.length - 1].schaetzung;
  }
  const genau = auswahl(grob, genug).map((p) => doppelPaar(p.a, p.b, { minuten, anzeige, daten }))
    .filter((p) => p.spart >= MIN_SPART)
    .sort((u, v) => v.wert - u.wert || v.spart - u.spart);
  return auswahl(genau, max);
}
