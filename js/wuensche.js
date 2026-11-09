/*
 * Vorschläge für Tobi – Amys Bereich → Vorschläge, ohne DOM (Tests in Node).
 * In liste.json unter `wuensche`:
 *
 *   { 'w-…': { id, text, by, at, erledigt: '' | ISO-Zeit, erledigtVon, antwort, antwortVon, antwortAt } }
 *
 * Amy schreibt, was besser werden soll; Tobi sieht es in seiner App, hakt
 * ab, was erledigt ist, und kann kurz antworten. Höchstens 200, die
 * ältesten erledigten fallen zuerst raus.
 */

export const WUNSCH_ID = /^w-[a-z0-9]{4,24}$/;
export const MAX_WUENSCHE = 200;
export const MAX_WUNSCH_TEXT = 1000;
const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const kurz = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const jetzt = () => new Date().toISOString();

export const neueWunschId = () => `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function wunschBereinigen(w) {
  if (!istObj(w) || !WUNSCH_ID.test(String(w.id))) return null;
  const text = kurz(w.text, MAX_WUNSCH_TEXT);
  if (!text) return null;
  const out = { id: w.id, text, by: kurz(w.by, 40) || null, at: kurz(w.at, 40), erledigt: kurz(w.erledigt, 40) };
  if (out.erledigt) out.erledigtVon = kurz(w.erledigtVon, 40) || null;
  const antwort = kurz(w.antwort, 500);
  if (antwort) Object.assign(out, { antwort, antwortVon: kurz(w.antwortVon, 40) || null, antwortAt: kurz(w.antwortAt, 40) });
  return out;
}

function begrenzen(ws) {
  const alle = Object.values(ws);
  if (alle.length <= MAX_WUENSCHE) return ws;
  // Zuerst die ältesten erledigten, dann die ältesten offenen
  alle.sort((a, b) => (a.erledigt ? 0 : 1) - (b.erledigt ? 0 : 1) || String(a.at).localeCompare(String(b.at)));
  return Object.fromEntries(alle.slice(alle.length - MAX_WUENSCHE).map((w) => [w.id, w]));
}

export function wuenscheBereinigen(x) {
  if (!istObj(x)) return {};
  const out = {};
  for (const [id, w] of Object.entries(x)) {
    const b = wunschBereinigen({ ...w, id });
    if (b) out[id] = b;
  }
  return begrenzen(out);
}

/** Neuer Vorschlag oder ein anderer Text. */
export const opWunsch = (id, text, by, at = jetzt()) => ({ typ: 'wunsch', id, text: kurz(text, MAX_WUNSCH_TEXT), by: by || null, at });
/** Erledigt abhaken (an: false macht ihn wieder offen). */
export const opWunschErledigt = (id, an, by, at = jetzt()) => ({ typ: 'wunschErledigt', id, an: !!an, by: by || null, at });
/** Eine kurze Antwort (leer nimmt sie weg). */
export const opWunschAntwort = (id, antwort, by, at = jetzt()) => ({ typ: 'wunschAntwort', id, antwort: kurz(antwort, 500), by: by || null, at });
export const opWunschWeg = (id) => ({ typ: 'wunschWeg', id });

export function wuenscheAnwenden(s, op) {
  if (!istObj(s.wuensche)) s.wuensche = {};
  const id = String(op.id || '');
  if (!WUNSCH_ID.test(id)) return;
  const alt = s.wuensche[id];
  if (op.typ === 'wunsch') {
    const b = wunschBereinigen({ ...(alt || {}), id, text: op.text, by: alt?.by || op.by, at: alt?.at || op.at });
    if (b) { s.wuensche[id] = b; s.wuensche = begrenzen(s.wuensche); }
    return;
  }
  if (!alt) return;
  if (op.typ === 'wunschErledigt') {
    if (op.an) { alt.erledigt = op.at || jetzt(); alt.erledigtVon = op.by || null; } else { alt.erledigt = ''; delete alt.erledigtVon; }
    return;
  }
  if (op.typ === 'wunschAntwort') {
    if (op.antwort) Object.assign(alt, { antwort: op.antwort, antwortVon: op.by || null, antwortAt: op.at || jetzt() });
    else { delete alt.antwort; delete alt.antwortVon; delete alt.antwortAt; }
    return;
  }
  if (op.typ === 'wunschWeg') delete s.wuensche[id];
}

export function wuenscheZusammen(s, x) {
  const neu = wuenscheBereinigen(x);
  if (!Object.keys(neu).length) return;
  if (!istObj(s.wuensche)) s.wuensche = {};
  for (const [id, w] of Object.entries(neu)) if (!s.wuensche[id]) s.wuensche[id] = w;
  s.wuensche = begrenzen(s.wuensche);
}

/** Offene zuerst (die neuesten oben), dann die erledigten (zuletzt erledigt oben). */
export function wuenscheSortiert(ws) {
  const alle = Object.values(ws || {});
  const offen = alle.filter((w) => !w.erledigt).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const fertig = alle.filter((w) => w.erledigt).sort((a, b) => String(b.erledigt).localeCompare(String(a.erledigt)));
  return { offen, fertig };
}

/** Die offenen als Text zum Weitergeben: „- Text (Amy, 9.11.)“ je Zeile. */
export function wuenscheText(ws) {
  const { offen } = wuenscheSortiert(ws);
  const datum = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getDate()}.${d.getMonth() + 1}.`; };
  return offen.map((w) => `- ${w.text.replace(/\s*\n\s*/g, ' ')}${w.by || w.at ? ` (${[w.by, datum(w.at)].filter(Boolean).join(', ')})` : ''}`).join('\n');
}
