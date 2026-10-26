/*
 * Die Einkaufsliste als Daten – und jede Änderung daran als kleines Objekt.
 *
 * Der Stand (so liegt er auch als liste.json im Daten-Repo):
 *
 *   { version: 1, rev: 12,
 *     items:  { <Schlüssel>: Eintrag },
 *     cooked: { <Rezept-id>: { at: '2026-10-26', by: 'Tobi' } } }
 *
 * Ein Eintrag:
 *
 *   { name, cat, parts: { <Rezept-id>: Teil }, custom, checked, by, at, added }
 *
 *   Teil   { q: 800, u: 'g', h: '2 × 400 g', done }   Menge aus einem Rezept
 *          { t: '2 EL', done }                        Text statt Menge
 *
 * Zutaten aus dem Katalog haben ihren Katalog-Schlüssel (`haehnchenbrust`),
 * damit Butter Chicken und Teriyaki sich eine Zeile teilen. Eigene Einträge
 * heißen `c-…`, haben keine Teile und merken sich `checked` selbst.
 *
 * Änderungen sind Objekte mit `typ`, keine Funktionen: Dann lassen sie sich
 * speichern, solange das Handy offline ist, und nach einem Konflikt auf den
 * neuesten Stand aus GitHub noch einmal anwenden (speicher.js). Deshalb ist
 * jede Änderung so formuliert, dass sie auf einem anderen Stand als dem, auf
 * dem sie entstand, noch Sinn ergibt – Abhaken nennt zum Beispiel die Teile,
 * die beim Tippen da waren, damit ein Teil, das das andere Handy gerade
 * dazugelegt hat, offen bleibt.
 */

export const leer = () => ({ version: 1, rev: 0, items: {}, cooked: {} });

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const klon = (x) => JSON.parse(JSON.stringify(x));
const SCHLUESSEL = /^[A-Za-z0-9_.~:@+-]{1,120}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);

/* ------------------------------------------------------------------ lesen */

/** Die Teile eines Eintrags als [Rezept-id, Teil]. */
export function teileVon(d) {
  if (!istObj(d) || !istObj(d.parts)) return [];
  return Object.entries(d.parts).filter(([, p]) => istObj(p));
}

/** Erledigt: alle Teile gekauft – oder bei eigenen Einträgen der Haken. */
export function erledigt(d) {
  const t = teileVon(d);
  return t.length ? t.every(([, p]) => p.done === true) : d.checked === true;
}

export const hatTeil = (stand, k, rid) => istObj(stand.items[k]?.parts?.[rid]);

/** Was „Alles auf die Einkaufsliste“ einträgt: Zutaten mit Menge, ohne Vorrat und Optionales. */
export const einkaufsZutaten = (r) => (r.items || []).filter((it) => it.k && typeof it.q === 'number' && !it.pantry && !it.opt);

/** Wie viele der Einkaufszutaten eines Rezepts auf der Liste stehen. */
export function rezeptStand(stand, r) {
  const zut = einkaufsZutaten(r);
  const n = zut.filter((it) => hatTeil(stand, it.k, r.id)).length;
  return { gesamt: zut.length, n, drauf: n > 0, komplett: zut.length > 0 && n === zut.length };
}

/** Alle Rezepte, die gerade etwas auf der Liste haben – in der Reihenfolge ihres Auftauchens. */
export function rezepteAufListe(stand) {
  const s = new Set();
  for (const d of Object.values(stand.items)) for (const [rid] of teileVon(d)) s.add(rid);
  return [...s];
}

export const offeneAnzahl = (stand) => Object.values(stand.items).filter((d) => !erledigt(d)).length;

/**
 * Mengen eines Eintrags fürs Anzeigen: Solange etwas offen ist, zählen nur
 * die offenen Teile – was schon im Wagen liegt, muss man nicht mehr kaufen.
 */
export function summen(d) {
  const t = teileVon(d);
  const offen = t.filter(([, p]) => p.done !== true);
  const basis = offen.length ? offen : t;
  const s = {};
  for (const [, p] of basis) if (typeof p.q === 'number' && Number.isFinite(p.q) && typeof p.u === 'string') s[p.u] = (s[p.u] || 0) + p.q;
  return s;
}

/* -------------------------------------------------------------- bereinigen */

/**
 * Macht aus beliebigem JSON einen gültigen Stand. Was aus GitHub oder dem
 * localStorage kommt, hat womöglich eine ältere oder kaputte Form – oder das
 * andere Handy hat Unsinn geschrieben. Unbekanntes fällt weg.
 */
export function bereinigen(roh) {
  const s = leer();
  if (!istObj(roh)) return s;
  s.rev = Number.isInteger(roh.rev) && roh.rev >= 0 ? roh.rev : 0;
  if (istObj(roh.items)) {
    for (const [k, d] of Object.entries(roh.items)) {
      if (!SCHLUESSEL.test(k) || !istObj(d)) continue;
      const e = {
        name: text(d.name, 120) || k,
        cat: text(d.cat, 20) || 'sonstiges',
        parts: {},
        custom: d.custom === true,
        checked: d.checked === true,
        by: text(d.by, 40),
        at: text(d.at, 40),
        added: text(d.added, 40),
      };
      if (istObj(d.parts)) {
        for (const [rid, p] of Object.entries(d.parts)) {
          if (!istObj(p) || !SCHLUESSEL.test(rid)) continue;
          if (typeof p.q === 'number' && Number.isFinite(p.q) && typeof p.u === 'string') {
            e.parts[rid] = { q: p.q, u: p.u.slice(0, 12), h: text(p.h, 80) || '', done: p.done === true };
          } else if (typeof p.t === 'string') {
            e.parts[rid] = { t: p.t.slice(0, 80), done: p.done === true };
          }
        }
      }
      s.items[k] = e;
    }
  }
  if (istObj(roh.cooked)) {
    for (const [rid, c] of Object.entries(roh.cooked)) {
      if (SCHLUESSEL.test(rid) && istObj(c) && TAG.test(String(c.at))) s.cooked[rid] = { at: c.at, by: text(c.by, 40) };
    }
  }
  return s;
}

/* -------------------------------------------------------------- Änderungen */

const jetzt = () => new Date().toISOString();

/** Ein Teil aus einem Rezept dazulegen; die Zeile entsteht, falls es sie noch nicht gibt. */
export const opTeil = (k, rid, teil, katalogEintrag) => ({
  typ: 'teil', k, rid, teil: { ...teil, done: false },
  name: katalogEintrag?.n || k, cat: katalogEintrag?.c || 'sonstiges', at: jetzt(),
});
/** Das Teil eines Rezepts wegnehmen; ohne Teile verschwindet die Zeile. */
export const opTeilWeg = (k, rid) => ({ typ: 'teilWeg', k, rid });
/** Abhaken oder wieder öffnen – für die Teile, die gerade da sind. */
export function opHaken(stand, k, done, by) {
  const d = stand.items[k];
  return { typ: 'haken', k, rids: d ? teileVon(d).map(([rid]) => rid) : [], done: !!done, by: by || null, at: jetzt() };
}
export const opLoeschen = (k) => ({ typ: 'loeschen', k });
export const opSetzen = (k, item) => ({ typ: 'setzen', k, item: klon(item) });
export function opEigener(id, name, cat) {
  const t = jetzt();
  return opSetzen(id, { name, cat, parts: {}, custom: true, checked: false, by: null, at: t, added: t });
}
export const opErledigteWeg = () => ({ typ: 'erledigteWeg' });
export const opLeeren = () => ({ typ: 'leeren' });
export const opGekocht = (rid, at, by) => ({ typ: 'gekocht', rid, at, by: by || null });
/** Einträge von einem anderen Stand dazunehmen, ohne Vorhandenes zu überschreiben. */
export const opZusammen = (items) => ({ typ: 'zusammen', items: klon(items) });

function aendere(s, op) {
  if (!istObj(op)) return;
  const d = typeof op.k === 'string' ? s.items[op.k] : undefined;
  switch (op.typ) {
    case 'teil': {
      if (!SCHLUESSEL.test(String(op.k)) || !SCHLUESSEL.test(String(op.rid)) || !istObj(op.teil)) return;
      const e = d || { name: op.name, cat: op.cat, parts: {}, custom: false, checked: false, by: null, at: op.at, added: op.at };
      if (!istObj(e.parts)) e.parts = {};
      e.parts[op.rid] = klon(op.teil);
      e.at = op.at;
      s.items[op.k] = e;
      return;
    }
    case 'teilWeg': {
      if (!d || !istObj(d.parts)) return;
      delete d.parts[op.rid];
      if (!teileVon(d).length && !d.custom) delete s.items[op.k];
      return;
    }
    case 'haken': {
      if (!d) return;
      const rids = Array.isArray(op.rids) ? op.rids : [];
      if (d.custom || !rids.length) d.checked = op.done === true;
      else for (const rid of rids) if (istObj(d.parts?.[rid])) d.parts[rid].done = op.done === true;
      d.by = op.done ? op.by : null;
      d.at = op.at;
      return;
    }
    case 'loeschen':
      delete s.items[op.k];
      return;
    case 'setzen':
      if (SCHLUESSEL.test(String(op.k)) && istObj(op.item)) s.items[op.k] = klon(op.item);
      return;
    case 'erledigteWeg':
      for (const [k, e] of Object.entries(s.items)) {
        const t = teileVon(e);
        if (!t.length) { if (e.checked === true) delete s.items[k]; continue; }
        for (const [rid, p] of t) if (p.done === true) delete e.parts[rid];
        if (!teileVon(e).length && !e.custom) delete s.items[k];
      }
      return;
    case 'leeren':
      s.items = {};
      return;
    case 'gekocht':
      if (SCHLUESSEL.test(String(op.rid)) && TAG.test(String(op.at))) s.cooked[op.rid] = { at: op.at, by: op.by || null };
      return;
    case 'zusammen':
      if (!istObj(op.items)) return;
      for (const [k, e] of Object.entries(op.items)) {
        if (!SCHLUESSEL.test(k) || !istObj(e)) continue;
        const da = s.items[k];
        if (!da) { s.items[k] = klon(e); continue; }
        for (const [rid, p] of teileVon(e)) if (!istObj(da.parts?.[rid])) { da.parts = da.parts || {}; da.parts[rid] = klon(p); }
      }
      return;
    default:
  }
}

/** Neuer Stand mit einer Änderung (oder einer Liste davon); der alte bleibt, wie er war. */
export function anwenden(stand, op) {
  const s = klon(stand);
  for (const o of Array.isArray(op) ? op : [op]) aendere(s, o);
  return s;
}
