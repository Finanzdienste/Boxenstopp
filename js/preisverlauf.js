/*
 * Preisverlauf: Wie günstig war eine Zutat in den letzten Wochen im Angebot?
 * daten/preisverlauf.json baut der Angebots-Lauf aus der Git-Historie von
 * daten/angebote.json (werkzeug/preisverlauf.mjs) – je Katalog-Schlüssel und
 * Kalenderwoche der günstigste Preis je kg, l oder Stück:
 *
 *   { stand, je: { haehnchenbrust: { u: 'kg', w: { '2026-W44': [6.99, 'Aldi'] } } } }
 *
 * Daraus sagt die App bei einem Angebot „so günstig wie seit 6 Wochen nicht“
 * oder „Tiefstpreis seit 8 Wochen“. Ohne DOM, damit die Tests es prüfen.
 */
import { kalenderwoche, einheitsPreis } from './angebote.js';

const zwei = (n) => String(n).padStart(2, '0');
/** „2026-W45“ für ein Datum (Kalenderwoche nach ISO, Jahr der Woche). */
export function wochenSchluessel(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 3 - ((x.getUTCDay() + 6) % 7));
  return `${x.getUTCFullYear()}-W${zwei(kalenderwoche(d))}`;
}
/** Wochen zwischen zwei Schlüsseln („2026-W44“ bis „2026-W46“ → 2). */
export function wochenAbstand(a, b) {
  const montag = (k) => {
    const [j, w] = String(k).split('-W').map(Number);
    const vier = new Date(Date.UTC(j, 0, 4));
    return vier.getTime() + ((w - 1) * 7 - ((vier.getUTCDay() + 6) % 7)) * 86400000;
  };
  return Math.round((montag(b) - montag(a)) / (7 * 86400000));
}

/** In welche Woche ein Angebot gehört: Beginn, sonst Ende, sonst der Tag des Abrufs. */
export function wocheVon(a, abruf = new Date()) {
  const tag = a?.von || a?.bis;
  const d = tag ? new Date(`${tag}T12:00:00`) : abruf;
  return wochenSchluessel(Number.isNaN(d.getTime()) ? abruf : d);
}

/**
 * Angebote einer Fassung von angebote.json in den Verlauf legen (verändert je).
 * Je Schlüssel zählt die Einheit, in der er zuerst vorkam.
 */
export function verlaufDazu(je, angebote, abruf = new Date()) {
  for (const a of angebote || []) {
    if (!a?.k) continue;
    const ep = einheitsPreis(a);
    if (!ep) continue;
    const e = je[a.k] || (je[a.k] = { u: ep.u, w: {} });
    if (e.u !== ep.u) continue;
    const w = wocheVon(a, abruf);
    const wert = Math.round(ep.wert * 100) / 100;
    if (!e.w[w] || wert < e.w[w][0]) e.w[w] = [wert, String(a.laden || '').slice(0, 24)];
  }
  return je;
}

/** Nur die letzten n Wochen (vor `bis`), je Schlüssel sortiert. */
export function verlaufKuerzen(je, bis, n = 26) {
  const aus = {};
  for (const [k, e] of Object.entries(je)) {
    const w = Object.fromEntries(Object.entries(e.w).filter(([x]) => wochenAbstand(x, bis) < n && wochenAbstand(x, bis) >= -2).sort(([a], [b]) => a.localeCompare(b)));
    if (Object.keys(w).length) aus[k] = { u: e.u, w };
  }
  return aus;
}

/**
 * Was ein Angebot im Verlauf ist: { text, tief, seit } – oder null, wenn es
 * nicht auffällt (oder zu wenig da ist). „seit“: so viele Wochen war es nicht
 * so günstig. Die eigene Woche zählt nicht mit.
 */
export function verlaufHinweis(verlauf, k, wert, u, woche) {
  const e = verlauf?.je?.[k];
  if (!e || e.u !== u || !(wert > 0)) return null;
  const frueher = Object.entries(e.w).filter(([w]) => w < woche).sort(([a], [b]) => b.localeCompare(a));
  if (frueher.length < 2) return null;
  const guenstiger = frueher.find(([, [p]]) => p <= wert + 1e-9);
  if (!guenstiger) {
    const seit = wochenAbstand(frueher[frueher.length - 1][0], woche);
    return seit >= 3 ? { text: `Tiefstpreis seit ${seit} Wochen`, tief: true, seit } : null;
  }
  const seit = wochenAbstand(guenstiger[0], woche) - 1;
  return seit >= 3 ? { text: `so günstig wie seit ${seit} Wochen nicht`, tief: false, seit } : null;
}

/** „KW 42 6,99 · KW 43 7,49 · KW 44 5,99 €/kg“ – die letzten paar Wochen. */
export function verlaufText(verlauf, k, n = 5) {
  const e = verlauf?.je?.[k];
  if (!e) return '';
  const w = Object.entries(e.w).sort(([a], [b]) => a.localeCompare(b)).slice(-n);
  if (!w.length) return '';
  return `${w.map(([x, [p]]) => `KW ${Number(x.split('-W')[1])} ${p.toFixed(2).replace('.', ',')}`).join(' · ')} €/${e.u}`;
}
