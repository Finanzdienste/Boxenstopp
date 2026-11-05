/*
 * Die festen Rezepte auf ein eigenes Ziel pro Box rechnen (Einstellungen →
 * Ziel pro Box). Daten kommen aus daten/rezepte.json, gerechnet wird beim
 * Laden – auf jedem Gerät gleich, weil es reine Rechnung ist.
 *
 * Gerechnet, nicht geschätzt: dieselbe Rechnung wie bei „Anpassen“ und der
 * Resteverwertung (ki-rezept.js mengenAnpassen). Die Zutaten mit `anpassbar`
 * (Fleisch, Reis, Nudeln, Öl, Käse …) wandern zwischen min und max, bis eine
 * Box dem Ziel so nah kommt wie möglich. Danach zwei Rücksichten aufs
 * Einkaufen:
 *
 *   - Stückware bleibt ganz: 2 oder 3 Dosen Kichererbsen, nicht 2,4.
 *   - Volle Packungen bleiben voll, wenn es die Box kaum vom Ziel wegbringt:
 *     1 kg Hähnchen (2 × 500 g) statt 1,03 kg – die anderen Mengen gleichen
 *     es aus (TOLERANZ).
 *
 * Danach hat das Rezept die neuen Mengen überall: Zutaten (Anzeige, Menge zum
 * Kaufen, Packungshinweis), Schritte (die Platzhalter darin nehmen q und u),
 * Nährwerttabelle, Werte pro Box und Kosten. `angepasst` sagt, was sich
 * geändert hat und wie nah die Box dem Ziel kommt.
 *
 * Ohne DOM, damit tests/test-ziel.mjs alles direkt in Node prüft.
 */
import { festAlsKi, mengenAnpassen, proBox, abstand, schoen } from './ki-rezept.js';
import { menge as mengeText } from './format.js';
import { kostenMenge } from './kosten.js';

/** Das Ziel, auf das die Rezepte in daten/rezepte.json gebaut sind. */
export const STANDARD = Object.freeze({ kcal: 443, p: 33, kh: 39, f: 15.4 });
export const MAKROS = ['kcal', 'p', 'kh', 'f'];
/** Was man pro Box eintragen kann – darüber hinaus ist es kein Box-Gericht mehr. */
export const GRENZEN = Object.freeze({ kcal: [150, 1500], p: [5, 150], kh: [0, 250], f: [1, 100] });
/** Ab wann eine Box das Ziel „trifft“ (pro Box, ±). */
export const TREFFER = Object.freeze({ kcal: 30, p: 2.5, kh: 3.5, f: 2 });
/** Wie viel weiter weg (abstand) eine Box für volle Packungen sein darf – etwa 1 g Protein. */
const TOLERANZ = 1.5;

const klon = (x) => JSON.parse(JSON.stringify(x));
const rund1 = (x) => Math.round(x * 10) / 10;
const rund2 = (x) => Math.round(x * 100) / 100;
const istZahl = (v) => typeof v === 'number' && Number.isFinite(v);

/** kcal aus Protein, KH und Fett (4/4/9) – wenn man kcal nicht einträgt. */
export const kcalAus = (p, kh, f) => Math.round(4 * p + 4 * kh + 9 * f);

/** Ein Ziel aus beliebigem JSON – oder null. kcal ganz, der Rest auf eine Stelle. */
export function zielBereinigen(z) {
  if (!z || typeof z !== 'object') return null;
  const w = {};
  for (const k of MAKROS) {
    const n = Number(z[k]);
    if (!Number.isFinite(n) || n < GRENZEN[k][0] || n > GRENZEN[k][1]) return null;
    w[k] = k === 'kcal' ? Math.round(n) : rund1(n);
  }
  return w;
}

export const gleichesZiel = (a, b) => !!a && !!b && MAKROS.every((k) => Math.abs(Number(a[k]) - Number(b[k])) < 0.05);

/** „443 kcal · 33 g P · 39 g KH · 15,4 g F“ */
export const zielText = (z) => `${Math.round(z.kcal)} kcal · ${zahl(z.p)} g P · ${zahl(z.kh)} g KH · ${zahl(z.f)} g F`;
const zahl = (x) => String(rund1(x)).replace('.', ',');

/** Wie weit eine Box vom Ziel weg ist, je Wert – und ob sie es trifft. */
export function vergleich(m, ziel) {
  const abweichung = { kcal: Math.round(m.kcal - ziel.kcal), p: rund1(m.p - ziel.p), kh: rund1(m.kh - ziel.kh), f: rund1(m.f - ziel.f) };
  const trifft = MAKROS.every((k) => Math.abs(abweichung[k]) <= TREFFER[k]);
  return { abweichung, trifft };
}

/* ---------------------------------------------------- Packungen, Texte */

const EINHEIT_G = { g: 1, kg: 1000, ml: 1, l: 1000 };
const groesse = (zahlText, einheit) => parseFloat(String(zahlText).replace(',', '.')) * (EINHEIT_G[einheit] || 1);

/**
 * Die Packungsgröße aus dem Hinweis der Zutat: „2 × 500 g“, „Theke oder
 * 2 × 400 g“, „2 Becher à 150 g“, „Beutel 1,5 kg“, „aus 500-g-Packung“.
 * art: 'mal' | 'stk' (volle Packungen, Zahl vorn) | 'aus' (man nimmt einen Teil).
 */
export function packung(h) {
  const t = String(h || '').trim();
  if (!t || /\+/.test(t)) return null; // „1 × 500 g + 1 × 400 g“: gemischt
  let m = /(\d+)\s*×\s*(\d+(?:,\d+)?)\s*(kg|g|ml|l)\b/.exec(t);
  if (m) return { art: 'mal', n: Number(m[1]), X: groesse(m[2], m[3]) };
  m = /^(\d+)\s+(Becher|Packungen?|Kugeln?|Tüten?|Beutel|Gläser|Glas|Dosen?|Flaschen?)\s+à\s+(\d+(?:,\d+)?)\s*(kg|g|ml|l)\b/.exec(t);
  if (m) return { art: 'stk', n: Number(m[1]), wort: m[2], X: groesse(m[3], m[4]) };
  m = /^aus (\d+(?:,\d+)?)-(kg|g|ml|l)-[\wäöüß]+$/.exec(t);
  if (m) return { art: 'aus', X: groesse(m[1], m[2]) };
  m = /^(?:Beutel|Packung|Becher|Netz|Glas|Flasche)\s+(\d+(?:,\d+)?)\s*(kg|g|ml|l)$/.exec(t);
  if (m) return { art: 'aus', X: groesse(m[1], m[2]), voll: true };
  return null;
}

const PLURAL = {
  Becher: ['Becher', 'Becher'], Packung: ['Packung', 'Packungen'], Packungen: ['Packung', 'Packungen'],
  Kugel: ['Kugel', 'Kugeln'], Kugeln: ['Kugel', 'Kugeln'], Tüte: ['Tüte', 'Tüten'], Tüten: ['Tüte', 'Tüten'],
  Beutel: ['Beutel', 'Beutel'], Glas: ['Glas', 'Gläser'], Gläser: ['Glas', 'Gläser'], Dose: ['Dose', 'Dosen'],
  Dosen: ['Dose', 'Dosen'], Flasche: ['Flasche', 'Flaschen'], Flaschen: ['Flasche', 'Flaschen'], Stück: ['Stück', 'Stück'],
};
const wortFuer = (w, n) => (PLURAL[w] ? PLURAL[w][n === 1 ? 0 : 1] : w);

/** Der Packungshinweis für eine neue Menge zum Kaufen (q in g bzw. ml). */
export function hinweisNeu(h, q0, q1) {
  const p = packung(h);
  if (!p) return Math.abs(q1 - q0) <= 0.15 * q0 ? h : '';
  const n = Math.max(1, Math.ceil(q1 / p.X - 0.02));
  if (p.art === 'mal') return String(h).replace(/(\d+)(\s*×\s*)/, `${n}$2`);
  if (p.art === 'stk') return String(h).replace(/^(\d+)\s+(\S+)/, (m, alt, w) => `${n} ${wortFuer(w, n)}`);
  // Ein Teil aus einer großen Packung: reicht sie nicht mehr, eben mehrere
  return q1 <= p.X * 1.02 ? h : `${n} × ${mengeText(p.X, 'g')}`;
}

const BRUCH = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
const loeffelZahl = (t) => {
  const m = /^(\d+)?([½¼¾])?$/.exec(String(t).trim());
  if (!m || (!m[1] && !m[2])) return null;
  return Number(m[1] || 0) + (m[2] ? BRUCH[m[2]] : 0);
};
const loeffelText = (x) => {
  const h = Math.max(0.5, Math.round(x * 2) / 2);
  const ganz = Math.floor(h);
  return `${ganz || ''}${h - ganz ? '½' : ''}`;
};

/**
 * Der Mengentext einer Zutat in g oder ml für eine neue Menge: „1,275 kg
 * geschält“ bleibt geschält, „50 g (2½ EL)“ rechnet die Löffel mit, „1 TL
 * (5 g)“ auch; anderes in Klammern („1 große oder 2 mittlere“) passt nicht
 * mehr und fällt weg.
 */
export function mengenTextNeu(a, g0, g1, u) {
  const t = String(a || '').trim();
  const vorn = /^(\d+[½¼¾]?|[½¼¾]) (EL|TL) \((\d+(?:,\d+)?) (g|ml)\)$/.exec(t);
  if (vorn) {
    const l = loeffelZahl(vorn[1]);
    if (l) return `${loeffelText((l * g1) / g0)} ${vorn[2]} (${mengeText(g1, vorn[4])})`;
  }
  const m = /^[\d.,]+\s*(?:kg|g|ml|l)\b(.*)$/.exec(t);
  let rest = m ? m[1].trim() : '';
  const loeffel = /^\((\d+[½¼¾]?|[½¼¾]) (EL|TL)\)$/.exec(rest);
  if (loeffel) {
    const l = loeffelZahl(loeffel[1]);
    rest = l ? `(${loeffelText((l * g1) / g0)} ${loeffel[2]})` : '';
  } else if (/^\(/.test(rest)) rest = '';
  return `${mengeText(g1, u === 'ml' ? 'ml' : 'g')}${rest ? ` ${rest}` : ''}`;
}

/** „2 Dosen à 400 g (480 g abgetropft)“ für drei Dosen: Zahl vorn, Wort und Klammer mit. */
export function stueckTextNeu(a, q0, q1) {
  let t = String(a || '').trim();
  if (!/^\d+/.test(t)) return mengeText(q1, 'Stk');
  t = t.replace(/^\d+(\s+)(\S+)/, (m, l, w) => `${q1}${l}${wortFuer(w, q1)}`);
  return t.replace(/\(([^)]*)\)/, (m, innen) => `(${innen.replace(/\d+(?:,\d+)?/g, (z) => String(Math.round((parseFloat(z.replace(',', '.')) * q1) / q0)).replace('.', ','))})`);
}

/* ------------------------------------------------------------ rechnen */

/** Welche Zutaten fürs Einkaufen ganz bleiben müssen (Stück) oder sollen (volle Packungen). */
function arten(r, frei) {
  const nachK = new Map(r.items.map((it) => [it.k, it]));
  const art = {};
  for (const z of frei) {
    const it = nachK.get(z.id);
    if (!it || !(it.g > 0) || !istZahl(it.q) || !(it.q > 0)) continue;
    if (it.u && !['g', 'ml'].includes(it.u)) { art[z.id] = { stueck: it.g / it.q }; continue; }
    const p = packung(it.h);
    if (!p || (p.art === 'aus' && !p.voll)) continue;
    const n = Math.round(it.q / p.X);
    if (n >= 1 && Math.abs(n * p.X - it.q) <= 0.03 * it.q) art[z.id] = { pack: p.X, faktor: it.g / it.q };
  }
  return art;
}

/** Die Mengen im KI-Format (ki-rezept.js) auf das Ziel – mit ganzen Stück und, wo es geht, vollen Packungen. */
export function mengenFuerZiel(r, ziel) {
  const k = festAlsKi(r);
  // Ein viel größeres (kleineres) Ziel braucht größere (kleinere) Boxen: Der
  // Spielraum der anpassbaren Zutaten wächst mit dem Ziel mit – 650 kcal mit
  // 70 g KH lassen sich sonst mit höchstens dem 1,6-Fachen Reis nicht schaffen.
  const faktor = MAKROS.map((m) => ziel[m] / STANDARD[m]);
  const hoch = Math.max(1, ...faktor);
  const tief = Math.max(0.25, Math.min(1, ...faktor));
  for (const z of k.zutaten) if (z.anpassbar) { z.max *= hoch; z.min *= tief; }
  const frei = k.zutaten.filter((z) => z.anpassbar && z.max > z.min);
  if (!frei.length) return k;
  const art = arten(r, frei);
  const loesen = (fest) => {
    const kk = klon(k);
    for (const z of kk.zutaten) if (fest.has(z.id)) { z.menge = fest.get(z.id); z.anpassbar = false; }
    return mengenAnpassen(kk, ziel);
  };
  let fest = new Map();
  let best = loesen(fest);
  // Stückware: ganze Dosen, Eier, Packungen
  let stueck = false;
  for (const z of best.zutaten) {
    const je = art[z.id]?.stueck;
    if (!je) continue;
    const lo = Math.max(1, Math.ceil(z.min / je - 1e-9));
    const hi = Math.max(lo, Math.floor(z.max / je + 1e-9));
    fest.set(z.id, Math.min(hi, Math.max(lo, Math.round(z.menge / je))) * je);
    stueck = true;
  }
  if (stueck) best = loesen(fest);
  // Volle Packungen, die nächstliegende zuerst – solange die Box kaum weiter weg ist
  const grund = abstand(proBox(best), ziel);
  const versucht = new Set();
  for (;;) {
    const kandidaten = best.zutaten
      .filter((z) => art[z.id]?.pack && !fest.has(z.id) && !versucht.has(z.id))
      .map((z) => {
        const a = art[z.id];
        const n = Math.max(1, Math.round(z.menge / a.faktor / a.pack));
        const g = n * a.pack * a.faktor;
        return { id: z.id, g, abw: Math.abs(g - z.menge) / z.menge, passt: g >= z.min - 1e-9 && g <= z.max + 1e-9 };
      })
      .filter((c) => c.passt && c.abw <= 0.15)
      .sort((a, b) => a.abw - b.abw);
    if (!kandidaten.length) break;
    const c = kandidaten[0];
    versucht.add(c.id);
    const mit = new Map(fest).set(c.id, c.g);
    const v = loesen(mit);
    if (abstand(proBox(v), ziel) <= grund + TOLERANZ) { fest = mit; best = v; }
  }
  return best;
}

/** Was eine Menge kostet – Richtpreis, sonst anteilig wie im Rezept. */
function kostenFuer(it, q, daten) {
  const e = it.k ? kostenMenge(it.k, q, it.u, daten) : null;
  if (e !== null && Number.isFinite(e)) return e;
  return istZahl(it.eur) && it.q > 0 ? (it.eur * q) / it.q : 0;
}

/** Die Mengen aus dem KI-Format als { Zutat: Menge } – so merkt sich die App das Ergebnis (ansicht-ziel.js). */
export const mengenVon = (k) => Object.fromEntries(k.zutaten.map((z) => [z.id, z.menge]));

/** Die neuen Mengen ins Rezept: Zutaten, Nährwerttabelle, Werte pro Box, Kosten. */
function einsetzen(r, mengen, ziel, daten) {
  const P = r.portionen || 8;
  const neu = klon(r);
  const menge = new Map(Object.entries(mengen || {}).filter(([, v]) => istZahl(v) && v >= 0));
  const aenderungen = [];
  let mehrKosten = 0;
  let zeile = -1;
  for (const it of neu.items) {
    const inTabelle = it.k && !it.haus && !it.opt && it.pro100 && it.g;
    if (inTabelle) zeile++;
    const g1 = menge.get(it.k);
    if (!inTabelle || !it.anpassbar || g1 === undefined || Math.abs(g1 - it.g) < 0.5) continue;
    const vorher = it.a;
    const q0 = it.q;
    const eur0 = kostenFuer(it, q0, daten);
    if (it.u && !['g', 'ml'].includes(it.u)) {
      const q1 = Math.max(1, Math.round(g1 / (it.g / it.q)));
      it.a = stueckTextNeu(it.a, it.q, q1);
      it.q = q1;
    } else {
      const q1 = Math.abs(it.q - it.g) < 0.5 ? g1 : schoen((it.q * g1) / it.g);
      it.a = mengenTextNeu(it.a, it.g, g1, it.gu || it.u);
      it.h = hinweisNeu(it.h, q0, q1);
      it.q = q1;
    }
    it.g = g1;
    const eur1 = kostenFuer({ ...it, q: q0, eur: r.items.find((x) => x.k === it.k)?.eur }, it.q, daten);
    if (istZahl(it.eur)) it.eur = rund2(eur1);
    mehrKosten += eur1 - eur0;
    if (Array.isArray(neu.nut) && neu.nut[zeile]) {
      neu.nut[zeile] = [neu.nut[zeile][0], mengeText(g1, it.gu === 'ml' ? 'ml' : 'g'), ...MAKROS.map((x) => rund1((it.pro100[x] * g1) / 100))];
    }
    aenderungen.push({ k: it.k, n: it.n, vorher, nachher: it.a });
  }
  if (Array.isArray(neu.nut) && neu.nut.length) {
    neu.total = [2, 3, 4, 5].map((i) => rund1(neu.nut.reduce((s, z) => s + (Number(z[i]) || 0), 0)));
    neu.m = { kcal: Math.round(neu.total[0] / P), p: rund1(neu.total[1] / P), kh: rund1(neu.total[2] / P), f: rund1(neu.total[3] / P) };
  }
  if (neu.kosten && istZahl(neu.kosten.gesamt)) {
    const gesamt = Math.max(0, neu.kosten.gesamt + mehrKosten);
    neu.kosten = { ...neu.kosten, gesamt: rund2(gesamt), box: rund2(gesamt / P) };
  }
  neu.angepasst = { ziel: { ...ziel }, aenderungen, ...vergleich(neu.m, ziel) };
  return neu;
}

/**
 * Ein festes Rezept auf ein Ziel pro Box. Beim Standard-Ziel bleibt es, wie
 * es ist – darauf ist es gebaut. daten: { preise, naehrwerte } für die
 * Kosten; mengen: schon gerechnete Mengen (dann geht es ohne Rechnen).
 */
export function aufZiel(r, ziel, daten = {}, mengen = null) {
  if (!r || !Array.isArray(r.items) || !ziel || gleichesZiel(ziel, STANDARD)) return r;
  return einsetzen(r, mengen || mengenVon(mengenFuerZiel(r, ziel)), ziel, daten);
}

/**
 * Alle festen Rezepte auf ein Ziel: { rezepte, mengen } – mengen je Rezept
 * zum Merken; gemerkt: was beim letzten Mal herauskam (spart das Rechnen).
 */
export function alleAufZiel(rezepte, ziel, daten = {}, gemerkt = {}) {
  const mengen = {};
  const neu = rezepte.map((r) => {
    if (!ziel || gleichesZiel(ziel, STANDARD)) return r;
    const m = gemerkt?.[r.id] && typeof gemerkt[r.id] === 'object' ? gemerkt[r.id] : mengenVon(mengenFuerZiel(r, ziel));
    mengen[r.id] = m;
    return aufZiel(r, ziel, daten, m);
  });
  return { rezepte: neu, mengen };
}

/** Wie viele Rezepte das Ziel treffen – für den Satz in den Einstellungen. */
export function trefferZaehlen(rezepte) {
  const mit = rezepte.filter((r) => r.angepasst);
  return { gesamt: mit.length, treffen: mit.filter((r) => r.angepasst.trifft).length };
}
