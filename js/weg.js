/*
 * Der Weg durch den Laden – ohne DOM, damit die Tests es direkt prüfen.
 *
 * Wer einkauft, hakt in der Reihenfolge ab, in der er durch den Markt läuft.
 * Ist auf der Liste ein Laden gewählt („Ich kaufe bei Aldi“), merkt sich das
 * Handy die Haken eines Einkaufs; ist er vorbei (alles im Wagen, ein anderer
 * Laden oder 45 Minuten nichts mehr), wird daraus für jede Zutat ihre Stelle
 * auf dem Weg: 0 ganz am Anfang, 1 ganz am Ende. Die Stellen liegen in
 * liste.json unter `wege` – je Laden, für beide Handys, „unser Aldi“.
 *
 * Beim nächsten Einkauf dort sortiert die Liste nach Abteilungen in der
 * Reihenfolge des Wegs und darin nach den Zutaten. Was noch nie gekauft
 * wurde, steht da, wo seine Abteilung steht; eine Abteilung ohne Messung
 * dort, wo sie in der üblichen Reihenfolge stünde (bereiche.js). Jede
 * Messung zählt, die übliche Reihenfolge wie eine – nach zwei, drei
 * Einkäufen passt es.
 */
import { erledigt } from './liste.js';
import { abteilungVon, nameSchluessel } from './bereiche.js';

/** Die übliche Reihenfolge der Abteilungen (wie bereiche.js), für Läden ohne Messung. */
export const REIHE = ['obst', 'fleisch', 'kuehl', 'trocken', 'konserven', 'vorrat', 'tk', 'gewuerz', 'haushalt', 'sonstiges'];
export const ABTEILUNG_NAME = {
  obst: 'Obst & Gemüse', fleisch: 'Fleisch', kuehl: 'Kühlregal', trocken: 'Nudeln, Reis & Co.', konserven: 'Konserven',
  vorrat: 'Öl, Saucen & Vorrat', tk: 'Tiefkühl', gewuerz: 'Gewürze', haushalt: 'Haushalt', sonstiges: 'Sonstiges',
};
/** Ein Einkauf zählt ab so vielen Haken, und so lange darf zwischen zwei Haken Pause sein. */
export const MIN_HAKEN = 3;
export const PAUSE_MS = 45 * 60 * 1000;
export const MAX_MESSUNGEN = 5;

/** Woran sich eine Zeile wiedererkennt: Katalog-Schlüssel, bei eigenen Einträgen der Name. */
export const wegSchluessel = (k, d) => (d?.custom || String(k).startsWith('c-') ? nameSchluessel(d?.name || k) : String(k));

/**
 * Aus den Haken eines Einkaufs [[schlüssel, abteilung, zeit], …] die Stellen
 * auf dem Weg: [{ k, c, p }] – leer, wenn es zu wenige sind.
 */
export function wegStellen(haken) {
  const h = [...(haken || [])].filter((x) => Array.isArray(x) && x[0]).sort((a, b) => a[2] - b[2]);
  const gesehen = new Set();
  const eins = h.filter((x) => (gesehen.has(x[0]) ? false : gesehen.add(x[0])));
  if (eins.length < MIN_HAKEN) return [];
  return eins.map((x, i) => ({ k: x[0], c: x[1] || 'sonstiges', p: Math.round((i / (eins.length - 1)) * 100) / 100 }));
}

const mittel = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Wie weit hinten auf dem Weg eine Abteilung und eine Zutat liegen (0–1):
 * { abteilung(c), zutat(k, c) } für einen Laden aus `wege[laden]`.
 */
export function wegWerte(weg) {
  const je = weg?.k || {};
  const proAbteilung = {};
  for (const e of Object.values(je)) {
    if (!e || !Array.isArray(e.p) || !e.p.length) continue;
    (proAbteilung[e.c] = proAbteilung[e.c] || []).push(...e.p);
  }
  const ueblich = (c) => { const i = REIHE.indexOf(c); return (i < 0 ? REIHE.length - 1 : i) / (REIHE.length - 1); };
  const abteilung = (c) => { const ps = proAbteilung[c] || []; return (ps.reduce((a, b) => a + b, 0) + ueblich(c)) / (ps.length + 1); };
  const zutat = (k, c) => { const ps = je[k]?.p || []; return ps.length ? (ps.reduce((a, b) => a + b, 0) + abteilung(c)) / (ps.length + 1) : abteilung(c); };
  return { abteilung, zutat, gemessen: Object.keys(je).length, einkaeufe: weg?.n || 0, mittel: Object.keys(proAbteilung).length ? mittel(Object.values(proAbteilung).flat()) : null };
}

/**
 * Die offenen Einträge nach dem Weg durch einen Laden: wie nachBereichen in
 * bereiche.js, nur mit Abteilungen in der Reihenfolge des Wegs.
 * [{ bereich: { id, name, hinweis }, eintraege: [[k, d], …] }]
 */
export function nachWeg(stand, katalog = {}, weg = null) {
  const w = wegWerte(weg);
  const gruppen = new Map();
  for (const [k, d] of Object.entries(stand.items)) {
    if (erledigt(d)) continue;
    const c = abteilungVon(k, d, katalog, stand.abteilungen);
    const id = ABTEILUNG_NAME[c] ? c : 'sonstiges';
    if (!gruppen.has(id)) gruppen.set(id, []);
    gruppen.get(id).push([k, d]);
  }
  return [...gruppen.entries()]
    .map(([id, eintraege]) => ({
      bereich: { id, name: ABTEILUNG_NAME[id], hinweis: '' },
      wert: w.abteilung(id),
      eintraege: eintraege
        .map(([k, d]) => [k, d, w.zutat(wegSchluessel(k, d), id)])
        .sort((a, b) => a[2] - b[2] || String(a[1].name).localeCompare(String(b[1].name), 'de'))
        .map(([k, d]) => [k, d]),
    }))
    .sort((a, b) => a.wert - b.wert || REIHE.indexOf(a.bereich.id) - REIHE.indexOf(b.bereich.id))
    .map(({ bereich, eintraege }) => ({ bereich, eintraege }));
}
