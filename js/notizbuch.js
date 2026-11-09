/*
 * Amys Notizen – Blätter wie bei OneNote, ohne DOM (die Tests prüfen es in
 * Node). In liste.json unter `notizbuch` (nicht `notizen`: das sind die
 * Notizen zu den Rezepten):
 *
 *   { 'nb-…': { id, titel, text, farbe, tags, at, geaendert, by } }
 *
 * at ist, wann das Blatt angelegt wurde (danach stehen sie, das neueste
 * oben – ein Blatt springt beim Tippen nicht nach oben), geaendert die
 * letzte Änderung. Ein Blatt wird immer ganz geschrieben; eine noch nicht
 * gesendete Fassung ersetzt die vorige (ersetzt), und eine ältere kommt
 * nicht über eine neuere (geaendert). Tags wie bei Amys Rezepten (amy.js
 * tagsBereinigen) – darüber filtert die Liste der Blätter.
 */
import { tagsBereinigen } from './amy.js';

export const BLATT_ID = /^nb-[a-z0-9]{4,24}$/;
export const BLATT_FARBEN = ['rosa', 'lila', 'blau', 'gruen', 'gelb', 'orange'];
export const FARBE_NAME = { rosa: 'Rosa', lila: 'Lila', blau: 'Blau', gruen: 'Grün', gelb: 'Gelb', orange: 'Orange' };
export const MAX_BLAETTER = 100;
export const MAX_TEXT = 20000;
export const MAX_TITEL = 80;
const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const jetzt = () => new Date().toISOString();
const kurz = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

export const neueBlattId = () => `nb-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function blattBereinigen(b) {
  if (!istObj(b) || !BLATT_ID.test(String(b.id))) return null;
  const at = kurz(b.at, 40) || jetzt();
  return {
    id: b.id,
    titel: kurz(b.titel, MAX_TITEL).replace(/[\n\r]+/g, ' '),
    text: kurz(b.text, MAX_TEXT),
    farbe: BLATT_FARBEN.includes(b.farbe) ? b.farbe : 'rosa',
    tags: tagsBereinigen(b.tags),
    at,
    geaendert: kurz(b.geaendert, 40) || at,
    by: kurz(b.by, 40) || null,
  };
}

/** Die neuesten MAX_BLAETTER (nach Anlegen). */
function begrenzen(nb) {
  const alle = Object.values(nb).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return Object.fromEntries(alle.slice(0, MAX_BLAETTER).map((b) => [b.id, b]));
}

export function notizbuchBereinigen(x) {
  if (!istObj(x)) return {};
  const nb = {};
  for (const [id, b] of Object.entries(x)) {
    const r = blattBereinigen({ ...b, id });
    if (r) nb[id] = r;
  }
  return begrenzen(nb);
}

/** Ein Blatt anlegen oder ändern – immer ganz: { id, titel, text, farbe, tags }. */
export const opBlatt = (b, by, at = jetzt()) => ({ typ: 'blatt', b: { id: b.id, titel: kurz(b.titel, MAX_TITEL), text: kurz(b.text, MAX_TEXT), farbe: b.farbe, tags: tagsBereinigen(b.tags) }, by: by || null, at, ersetzt: `blatt:${b.id}` });
export const opBlattWeg = (id, at = jetzt()) => ({ typ: 'blattWeg', id, at });

export function notizbuchAnwenden(s, op) {
  if (!istObj(s.notizbuch)) s.notizbuch = {};
  if (op.typ === 'blatt') {
    const id = op.b?.id;
    if (!BLATT_ID.test(String(id))) return;
    const alt = s.notizbuch[id];
    // Eine ältere Fassung (etwa von einem Handy, das offline war) kommt nicht über eine neuere
    if (alt && String(alt.geaendert) > String(op.at)) return;
    const b = blattBereinigen({ ...op.b, at: alt?.at || op.at, geaendert: op.at, by: op.by });
    if (!b) return;
    s.notizbuch[id] = b;
    s.notizbuch = begrenzen(s.notizbuch);
    return;
  }
  if (op.typ === 'blattWeg') {
    const alt = s.notizbuch[op.id];
    // Wurde es danach woanders noch geändert, bleibt es
    if (alt && String(alt.geaendert) <= String(op.at || '')) delete s.notizbuch[op.id];
  }
}

export function notizbuchZusammen(s, x) {
  const neu = notizbuchBereinigen(x);
  if (!Object.keys(neu).length) return;
  if (!istObj(s.notizbuch)) s.notizbuch = {};
  for (const [id, b] of Object.entries(neu)) if (!s.notizbuch[id]) s.notizbuch[id] = b;
  s.notizbuch = begrenzen(s.notizbuch);
}

/** Die Blätter, das zuletzt angelegte zuerst. */
export const blaetter = (nb) => Object.values(nb || {}).sort((a, b) => String(b.at).localeCompare(String(a.at)));

/** Titel fürs Anzeigen – ohne Titel die erste Zeile. */
export function blattTitel(b) {
  const t = String(b?.titel || '').trim();
  if (t) return t;
  const z = String(b?.text || '').split('\n').map((x) => x.trim()).find(Boolean);
  return z ? z.slice(0, 60) : 'Ohne Titel';
}

/** Zwei Zeilen Vorschau – ohne die Zeile, die schon als Titel dient. */
export function blattVorschau(b, max = 140) {
  const zeilen = String(b?.text || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (!String(b?.titel || '').trim()) zeilen.shift();
  return zeilen.join(' · ').slice(0, max);
}

export const blattLeer = (b) => !String(b?.titel || '').trim() && !String(b?.text || '').trim() && !(b?.tags || []).length;

/** Alle Tags der Blätter: [[Tag, Anzahl]], häufigste zuerst (wie amy.js alleTags). */
export function blattTags(nb) {
  const je = new Map();
  for (const b of Object.values(nb || {})) {
    for (const t of b.tags || []) {
      const e = je.get(t.toLowerCase()) || [t, 0];
      e[1] += 1;
      je.set(t.toLowerCase(), e);
    }
  }
  return [...je.values()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'));
}

/**
 * Ideen aus den Blättern – fürs Planen (Essensplan „Inspiration“): kurze
 * Zeilen, ohne Aufzählungszeichen, ohne Doppelte, aus den zuletzt
 * geänderten Blättern zuerst. → [{ text, blatt }]
 */
export function ideenAus(nb, max = 12) {
  const out = [];
  const gesehen = new Set();
  const nachAenderung = Object.values(nb || {}).sort((a, b) => String(b.geaendert).localeCompare(String(a.geaendert)));
  for (const b of nachAenderung) {
    for (const z of String(b.text || '').split('\n')) {
      const t = z.replace(/^\s*(?:[-*•·–]|\d+[.)])\s*/, '').trim();
      if (t.length < 3 || t.length > 60 || gesehen.has(t.toLowerCase())) continue;
      gesehen.add(t.toLowerCase());
      out.push({ text: t, blatt: b.id });
      if (out.length >= max) return out;
    }
  }
  return out;
}
