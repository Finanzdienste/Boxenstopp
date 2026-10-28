/*
 * Die Einkaufsliste als Daten – und jede Änderung daran als kleines Objekt.
 *
 * Der Stand (so liegt er auch als liste.json im Daten-Repo):
 *
 *   { version: 1, rev: 12,
 *     items:     { <Schlüssel>: Eintrag },
 *     cooked:    { <Rezept-id>: { at: '2026-10-26', by: 'Tobi' } },
 *     bewertung: { <Rezept-id>: { wert: 'hoch' | 'mittel' | 'runter', by: 'Amy', at } },
 *     ki:        { <ki-…>: { r: Rezept aus der Resteverwertung, by, at } },
 *     notizen:   { <Rezept-id>: [{ id, text, by, at }, …] },
 *     gepinnt:   { <Rezept-id>: { by: 'Tobi', at } } }
 *
 * Die Bewertung gilt für beide: Es gibt pro Gericht einen Daumen, und wer
 * zuletzt gedrückt hat, steht dabei. Unter `ki` liegen die Rezepte aus der
 * Resteverwertung, die jemand behalten hat (ki-rezept.js, höchstens 12) –
 * so sieht das andere Handy sie auch. `gepinnt` sind die Rezepte, die gerade
 * laufen (Lesezeichen, höchstens vier) – sie stehen bei beiden oben.
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

import { kiBereinigen, KI_ID, MAX_GESPEICHERT } from './ki-rezept.js';
import { angeboteBereinigen, MAX_ANGEBOTE } from './angebote.js';

export const leer = () => ({ version: 1, rev: 0, items: {}, cooked: {}, bewertung: {}, ki: {}, notizen: {}, gepinnt: {}, angebote: { stand: '', von: null, eintraege: [] } });
const MAX_NOTIZEN = 20;
export const MAX_GEPINNT = 4;
export const DAUMEN = ['hoch', 'mittel', 'runter'];

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
export const einkaufsZutaten = (r) => (r.items || []).filter((it) => it.k && typeof it.q === 'number' && !it.pantry && !it.opt && !it.da);

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
  if (istObj(roh.bewertung)) {
    for (const [rid, b] of Object.entries(roh.bewertung)) {
      if (SCHLUESSEL.test(rid) && istObj(b) && DAUMEN.includes(b.wert)) s.bewertung[rid] = { wert: b.wert, by: text(b.by, 40), at: text(b.at, 40) };
    }
  }
  if (istObj(roh.cooked)) {
    for (const [rid, c] of Object.entries(roh.cooked)) {
      if (SCHLUESSEL.test(rid) && istObj(c) && TAG.test(String(c.at))) s.cooked[rid] = { at: c.at, by: text(c.by, 40) };
    }
  }
  if (istObj(roh.notizen)) {
    for (const [rid, liste] of Object.entries(roh.notizen)) {
      if (!SCHLUESSEL.test(rid) || !Array.isArray(liste)) continue;
      const n = liste.filter((x) => istObj(x) && SCHLUESSEL.test(String(x.id)) && typeof x.text === 'string' && x.text.trim())
        .map((x) => ({ id: x.id, text: x.text.trim().slice(0, 300), by: text(x.by, 40), at: text(x.at, 40) || '' }))
        .slice(-MAX_NOTIZEN);
      if (n.length) s.notizen[rid] = n;
    }
  }
  if (istObj(roh.gepinnt)) {
    const p = Object.entries(roh.gepinnt)
      .filter(([rid, e]) => SCHLUESSEL.test(rid) && istObj(e))
      .map(([rid, e]) => [rid, { by: text(e.by, 40), at: text(e.at, 40) || '' }])
      .sort((a, b) => b[1].at.localeCompare(a[1].at));
    s.gepinnt = Object.fromEntries(p.slice(0, MAX_GEPINNT));
  }
  if (istObj(roh.ki)) {
    const ki = [];
    for (const [id, e] of Object.entries(roh.ki)) {
      if (!KI_ID.test(id) || !istObj(e)) continue;
      const { r } = kiBereinigen(e.r);
      if (r) ki.push([id, { r, by: text(e.by, 40), at: text(e.at, 40) || '' }]);
    }
    ki.sort((a, b) => b[1].at.localeCompare(a[1].at));
    s.ki = Object.fromEntries(ki.slice(0, MAX_GESPEICHERT));
  }
  if (istObj(roh.angebote)) {
    s.angebote = { stand: text(roh.angebote.stand, 40) || '', von: text(roh.angebote.von, 40) || null, eintraege: angeboteBereinigen(roh.angebote.eintraege) };
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
/** Einträge (und behaltene KI-Rezepte) von einem anderen Stand dazunehmen, ohne Vorhandenes zu überschreiben. */
export const opZusammen = (items, ki = {}) => ({ typ: 'zusammen', items: klon(items), ki: klon(ki || {}) });
/** Ein Rezept aus der Resteverwertung für beide behalten – oder wieder wegwerfen. */
export const opKiBehalten = (id, r, by) => ({ typ: 'kiBehalten', id, r: klon(r), by: by || null, at: jetzt() });
export const opKiWeg = (id) => ({ typ: 'kiWeg', id });
/** Eine Notiz zu einem Rezept – für beide. Dieselbe id noch einmal ersetzt den Text (Rückgängig). */
export const opNotiz = (rid, id, text, by, at) => ({ typ: 'notiz', rid, id, text: String(text).slice(0, 300), by: by || null, at: at || jetzt() });
export const opNotizWeg = (rid, id) => ({ typ: 'notizWeg', rid, id });
// Angebote der Woche: ersetzen, dazulegen, eins weg, alle weg
export const opAngebote = (eintraege, by, at) => ({ typ: 'angebote', eintraege, by: by || null, at: at || jetzt() });
export const opAngeboteDazu = (eintraege, by, at) => ({ typ: 'angeboteDazu', eintraege, by: by || null, at: at || jetzt() });
export const opAngebotWeg = (id) => ({ typ: 'angebotWeg', id });
/** Ein Rezept anpinnen („läuft gerade“) oder wieder lösen – für beide; das älteste fällt nach MAX_GEPINNT raus. */
export const opAnpinnen = (rid, an, by) => ({ typ: 'anpinnen', rid, an: !!an, by: by || null, at: jetzt() });
/** Daumen für ein Gericht setzen (wert null nimmt ihn weg) – gilt für beide. */
export const opBewerten = (rid, wert, by) => ({ typ: 'bewerten', rid, wert: wert || null, by: by || null, at: jetzt() });

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
    case 'bewerten':
      if (!SCHLUESSEL.test(String(op.rid))) return;
      if (!s.bewertung) s.bewertung = {};
      if (DAUMEN.includes(op.wert)) s.bewertung[op.rid] = { wert: op.wert, by: op.by || null, at: op.at };
      else delete s.bewertung[op.rid];
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
      if (istObj(op.ki)) {
        if (!istObj(s.ki)) s.ki = {};
        for (const [id, e] of Object.entries(op.ki)) if (KI_ID.test(id) && istObj(e) && !s.ki[id]) s.ki[id] = klon(e);
      }
      return;
    case 'kiBehalten': {
      if (!KI_ID.test(String(op.id))) return;
      const { r } = kiBereinigen(op.r);
      if (!r) return;
      if (!istObj(s.ki)) s.ki = {};
      s.ki[op.id] = { r, by: op.by || null, at: op.at };
      // Höchstens MAX_GESPEICHERT: das älteste fällt raus.
      const alle = Object.entries(s.ki).sort((a, b) => String(b[1].at).localeCompare(String(a[1].at)));
      s.ki = Object.fromEntries(alle.slice(0, MAX_GESPEICHERT));
      return;
    }
    case 'kiWeg':
      if (istObj(s.ki)) delete s.ki[op.id];
      if (istObj(s.notizen)) delete s.notizen[op.id];
      if (istObj(s.gepinnt)) delete s.gepinnt[op.id];
      return;
    case 'anpinnen': {
      if (!SCHLUESSEL.test(String(op.rid))) return;
      if (!istObj(s.gepinnt)) s.gepinnt = {};
      if (!op.an) { delete s.gepinnt[op.rid]; return; }
      s.gepinnt[op.rid] = { by: op.by || null, at: op.at || jetzt() };
      const alle = Object.entries(s.gepinnt).sort((a, b) => String(b[1].at).localeCompare(String(a[1].at)));
      s.gepinnt = Object.fromEntries(alle.slice(0, MAX_GEPINNT));
      return;
    }
    case 'notiz': {
      if (!SCHLUESSEL.test(String(op.rid)) || !SCHLUESSEL.test(String(op.id)) || typeof op.text !== 'string' || !op.text.trim()) return;
      if (!istObj(s.notizen)) s.notizen = {};
      const liste = (s.notizen[op.rid] || []).filter((n) => n.id !== op.id);
      liste.push({ id: op.id, text: op.text.trim().slice(0, 300), by: op.by || null, at: op.at || jetzt() });
      liste.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      s.notizen[op.rid] = liste.slice(-MAX_NOTIZEN);
      return;
    }
    case 'notizWeg': {
      const liste = s.notizen?.[op.rid];
      if (!Array.isArray(liste)) return;
      const rest = liste.filter((n) => n.id !== op.id);
      if (rest.length) s.notizen[op.rid] = rest; else delete s.notizen[op.rid];
      return;
    }
    case 'angebote':
      s.angebote = { stand: op.at || jetzt(), von: op.by || null, eintraege: angeboteBereinigen(op.eintraege) };
      return;
    case 'angeboteDazu': {
      const alt = s.angebote?.eintraege || [];
      s.angebote = { stand: op.at || jetzt(), von: op.by || null, eintraege: angeboteBereinigen([...alt, ...(Array.isArray(op.eintraege) ? op.eintraege : [])]).slice(-MAX_ANGEBOTE) };
      return;
    }
    case 'angebotWeg': {
      if (!istObj(s.angebote)) return;
      s.angebote.eintraege = (s.angebote.eintraege || []).filter((a) => a.id !== op.id);
      return;
    }
    default:
  }
}

/** Neuer Stand mit einer Änderung (oder einer Liste davon); der alte bleibt, wie er war. */
export function anwenden(stand, op) {
  const s = klon(stand);
  for (const o of Array.isArray(op) ? op : [op]) aendere(s, o);
  return s;
}
