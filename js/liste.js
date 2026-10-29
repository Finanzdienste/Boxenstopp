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
 *     gepinnt:   { <Rezept-id>: { by: 'Tobi', at } },
 *     amy:       { <amy-…>: Amys eigenes Rezept (amy.js) },
 *     amyTags:   { <amy-…>: ['gesund', 'bauchfreundlich'] },
 *     wege:      { <Laden>: { n: 3, at, k: { <Schlüssel>: { c: 'obst', p: [0.1, 0.05] } } } },
 *     abteilungen: { <Schlüssel oder n:name>: 'fleisch' },
 *     gleich:    { <Schlüssel oder n:name>: <Schlüssel> },  zusammengelegt: dasselbe Produkt
 *     ungleich:  ['<a>|<b>', …] }                           „Nein, verschieden“
 *
 * Die Bewertung gilt für beide: Es gibt pro Gericht einen Daumen, und wer
 * zuletzt gedrückt hat, steht dabei. Unter `ki` liegen die Rezepte aus der
 * Resteverwertung, die jemand behalten hat (ki-rezept.js, höchstens 12) –
 * so sieht das andere Handy sie auch. `gepinnt` sind die Rezepte, die gerade
 * laufen (Lesezeichen, höchstens vier) – sie stehen bei beiden oben. Unter
 * `amy` liegen die Rezepte, die Amy selbst schreibt (höchstens 60), so wie
 * sie sie getippt hat; ihre Zutaten kommen über dieselben Teile auf die
 * Liste wie die der festen Rezepte (Teil-Schlüssel ist die amy-id); ihre
 * Tags stehen daneben unter `amyTags` – eigener Schlüssel, damit eine ältere
 * App-Version sie nicht stillschweigend mit dem Rezept überschreibt. `wege`
 * ist der Weg durch einen Laden (weg.js): je Zutat, an welcher Stelle sie
 * bei den letzten Einkäufen abgehakt wurde (0 vorn, 1 hinten). In
 * `abteilungen` steht, was jemand auf der Liste in eine andere Abteilung
 * verschoben hat – das gilt für beide und auch beim nächsten Mal. `gleich`
 * sind zusammengelegte Zeilen („leckere Dino nuggies“ ist dasselbe wie „Dino
 * nuggets“): Jedes Teil, das danach unter dem alten Schlüssel kommt, landet
 * in der Zeile des neuen (aufloesen). `ungleich` sind Paare, die jemand als
 * verschieden markiert hat – die schlägt die App nicht noch einmal vor.
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
 * heißen `c-…`, haben keine Teile und merken sich `checked` selbst. Tippt
 * jemand einen Namen ein, der schon einmal zusammengelegt wurde, steht der
 * eigene Eintrag gleich unter dem Schlüssel dieser Zeile – kommen dann Teile
 * aus einem Rezept dazu, zählen beim Abhaken die Teile.
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
import { amyBereinigen, tagsBereinigen, AMY_ID, MAX_AMY } from './amy.js';
import { umleiten } from './format.js';

export const leer = () => ({ version: 1, rev: 0, items: {}, cooked: {}, bewertung: {}, ki: {}, notizen: {}, gepinnt: {}, angebote: { stand: '', von: null, eintraege: [] }, amy: {}, amyTags: {}, wege: {}, abteilungen: {}, gleich: {}, ungleich: [] });
const MAX_GLEICH = 300;
const MAX_UNGLEICH = 200;
/** Die Abteilungen, in die man eine Zeile verschieben kann (weg.js REIHE). */
export const ABTEILUNGEN = ['obst', 'fleisch', 'kuehl', 'trocken', 'konserven', 'vorrat', 'tk', 'gewuerz', 'haushalt', 'sonstiges'];
const MAX_ABTEILUNGEN = 400;
const MAX_LAEDEN_WEG = 12;
const MAX_WEG_ZUTATEN = 300;
const MAX_WEG_MESSUNGEN = 5;
const LADEN_NAME = /^[\p{L}\p{N} &'.-]{1,24}$/u;
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

/** Der Schlüssel, unter dem eine Zutat wirklich auf der Liste steht – nach dem Zusammenlegen der neue. */
export const aufloesen = (stand, k) => umleiten(stand?.gleich, k);

/** Steht das Teil eines Rezepts auf der Liste – unter dem Schlüssel selbst oder in der Zeile, mit der er zusammengelegt wurde? */
export const hatTeil = (stand, k, rid) => istObj(stand.items[k]?.parts?.[rid]) || istObj(stand.items[aufloesen(stand, k)]?.parts?.[rid]);

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
  if (istObj(roh.amy)) {
    const a = Object.entries(roh.amy).filter(([id]) => AMY_ID.test(id)).map(([id, r]) => amyBereinigen({ ...(istObj(r) ? r : {}), id })).filter(Boolean);
    s.amy = Object.fromEntries(neuesteAmy(a).map((r) => [r.id, r]));
  }
  if (istObj(roh.amyTags)) {
    s.amyTags = Object.fromEntries(Object.entries(roh.amyTags).filter(([id]) => AMY_ID.test(id)).map(([id, t]) => [id, tagsBereinigen(t)]).filter(([, t]) => t.length).slice(-MAX_AMY));
  }
  if (istObj(roh.wege)) {
    for (const [laden, w] of Object.entries(roh.wege).slice(0, MAX_LAEDEN_WEG)) {
      const b = wegBereinigen(laden, w);
      if (b) s.wege[laden] = b;
    }
  }
  if (istObj(roh.abteilungen)) {
    s.abteilungen = Object.fromEntries(Object.entries(roh.abteilungen).filter(([k, c]) => SCHLUESSEL.test(k) && ABTEILUNGEN.includes(c)).slice(-MAX_ABTEILUNGEN));
  }
  if (istObj(roh.gleich)) {
    s.gleich = Object.fromEntries(Object.entries(roh.gleich).filter(([k, z]) => SCHLUESSEL.test(k) && SCHLUESSEL.test(String(z)) && k !== z).slice(-MAX_GLEICH));
  }
  if (Array.isArray(roh.ungleich)) {
    s.ungleich = [...new Set(roh.ungleich.filter((x) => typeof x === 'string' && x.split('|').length === 2 && x.split('|').every((k) => SCHLUESSEL.test(k))))].slice(-MAX_UNGLEICH);
  }
  return s;
}

/** Ein Paar, egal in welcher Reihenfolge: „a|b“. */
export const paar = (a, b) => [String(a), String(b)].sort().join('|');

/** Der Weg durch einen Laden aus beliebigem JSON – oder null. */
function wegBereinigen(laden, w) {
  if (!LADEN_NAME.test(String(laden)) || !istObj(w) || !istObj(w.k)) return null;
  const k = {};
  for (const [key, e] of Object.entries(w.k).slice(-MAX_WEG_ZUTATEN)) {
    if (!SCHLUESSEL.test(key) || !istObj(e) || !Array.isArray(e.p)) continue;
    const p = e.p.filter((x) => typeof x === 'number' && x >= 0 && x <= 1).slice(-MAX_WEG_MESSUNGEN);
    if (p.length) k[key] = { c: text(e.c, 20) || 'sonstiges', p };
  }
  return { n: Number.isInteger(w.n) && w.n >= 0 ? w.n : 0, at: text(w.at, 40) || '', k };
}

/** Die neuesten MAX_AMY Rezepte (nach letzter Änderung). */
const neuesteAmy = (liste) => [...liste].sort((a, b) => String(b.geaendert || b.at).localeCompare(String(a.geaendert || a.at))).slice(0, MAX_AMY);

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
/**
 * Einträge und behaltene KI-Rezepte von einem anderen Stand dazunehmen, ohne
 * Vorhandenes zu überschreiben – dazu, was sonst noch fehlt:
 * mehr = { amy, amyTags, wege, abteilungen, gleich, ungleich }.
 */
export const opZusammen = (items, ki = {}, mehr = {}) => ({
  typ: 'zusammen', items: klon(items), ki: klon(ki || {}),
  amy: klon(mehr.amy || {}), amyTags: klon(mehr.amyTags || {}), wege: klon(mehr.wege || {}), abteilungen: klon(mehr.abteilungen || {}), gleich: klon(mehr.gleich || {}), ungleich: klon(mehr.ungleich || []),
});
/**
 * Zwei Zeilen sind dasselbe: von kommt zu nach, und alles, was künftig unter
 * von (oder den Namen) kommt, auch. ziel { name, cat } ist die Zeile nach,
 * wie sie beim Tippen aussah – falls das andere Handy sie inzwischen
 * gelöscht hat, entsteht sie so neu.
 */
export const opGleich = (von, nach, namen = [], ziel = {}) => ({ typ: 'gleich', von, nach, namen: klon(namen), ziel: { name: text(ziel.name, 120), cat: text(ziel.cat, 20) } });
/** Zusammenlegen zurücknehmen: diese Schlüssel nicht mehr umleiten. */
export const opGleichWeg = (schluessel) => ({ typ: 'gleichWeg', schluessel: klon(schluessel) });
/** „Nein, verschieden“ – das Paar nicht noch einmal vorschlagen. */
export const opUngleich = (a, b) => ({ typ: 'ungleich', paar: paar(a, b) });
/** Ein Einkauf im Laden ist vorbei: die Stellen der Zutaten auf dem Weg dazulegen (weg.js wegStellen). */
export const opWeg = (laden, stellen, by) => ({ typ: 'weg', laden, stellen: klon(stellen), by: by || null, at: jetzt() });
/** Den Weg durch einen Laden vergessen. */
export const opWegVergessen = (laden) => ({ typ: 'wegWeg', laden });
/** Zeilen in eine andere Abteilung verschieben und es sich merken: { <Schlüssel>: 'fleisch' | null } (null vergisst). */
export const opAbteilung = (werte) => ({ typ: 'abteilung', werte: klon(werte) });
/** Amys Rezept anlegen oder ändern (ganz ersetzen) – für beide; wegwerfen mit opAmyWeg. */
export const opAmy = (r, by) => ({ typ: 'amy', r: klon(r), by: by || null, at: jetzt() });
export const opAmyWeg = (id) => ({ typ: 'amyWeg', id });
/** Amys Tags für ein Rezept setzen (ganz ersetzen; leer nimmt sie weg). */
export const opAmyTags = (id, tags) => ({ typ: 'amyTags', id, tags: klon(Array.isArray(tags) ? tags : []) });
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
      // Zusammengelegt? Dann in die Zeile, zu der die Zutat jetzt gehört
      const k = aufloesen(s, op.k);
      const e = s.items[k] || { name: op.name, cat: op.cat, parts: {}, custom: false, checked: false, by: null, at: op.at, added: op.at };
      if (!istObj(e.parts)) e.parts = {};
      e.parts[op.rid] = klon(op.teil);
      e.at = op.at;
      s.items[k] = e;
      return;
    }
    case 'teilWeg': {
      // Hängt das Teil noch unter dem alten Schlüssel (von einer älteren App-Fassung), dort wegnehmen
      const k = istObj(s.items[op.k]?.parts?.[op.rid]) ? op.k : aufloesen(s, op.k);
      const x = s.items[k];
      if (!x || !istObj(x.parts)) return;
      delete x.parts[op.rid];
      if (!teileVon(x).length && !x.custom) delete s.items[k];
      return;
    }
    case 'haken': {
      if (!d) return;
      const rids = Array.isArray(op.rids) ? op.rids : [];
      for (const rid of rids) if (istObj(d.parts?.[rid])) d.parts[rid].done = op.done === true;
      if (d.custom || !rids.length) d.checked = op.done === true;
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
        if (!teileVon(e).length && (!e.custom || e.checked === true)) delete s.items[k];
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
      // Zusammengelegtes gilt auch hier: was unter dem alten Schlüssel kommt, landet in der neuen Zeile
      if (istObj(op.gleich)) {
        if (!istObj(s.gleich)) s.gleich = {};
        for (const [k, z] of Object.entries(op.gleich)) if (SCHLUESSEL.test(k) && SCHLUESSEL.test(String(z)) && k !== z && !s.gleich[k]) s.gleich[k] = z;
      }
      for (const [k0, e] of Object.entries(op.items)) {
        if (!SCHLUESSEL.test(k0) || !istObj(e)) continue;
        const k = s.items[k0] ? k0 : aufloesen(s, k0);
        const da = s.items[k];
        if (!da) { s.items[k] = klon(e); continue; }
        for (const [rid, p] of teileVon(e)) if (!istObj(da.parts?.[rid])) { da.parts = da.parts || {}; da.parts[rid] = klon(p); }
      }
      if (istObj(op.ki)) {
        if (!istObj(s.ki)) s.ki = {};
        for (const [id, e] of Object.entries(op.ki)) if (KI_ID.test(id) && istObj(e) && !s.ki[id]) s.ki[id] = klon(e);
      }
      if (istObj(op.amy)) {
        if (!istObj(s.amy)) s.amy = {};
        for (const [id, r] of Object.entries(op.amy)) {
          const b = AMY_ID.test(id) && !s.amy[id] ? amyBereinigen({ ...r, id }) : null;
          if (b) s.amy[id] = b;
        }
        s.amy = Object.fromEntries(neuesteAmy(Object.values(s.amy)).map((r) => [r.id, r]));
      }
      if (istObj(op.wege)) {
        if (!istObj(s.wege)) s.wege = {};
        for (const [laden, w] of Object.entries(op.wege)) {
          const b = !s.wege[laden] && Object.keys(s.wege).length < MAX_LAEDEN_WEG ? wegBereinigen(laden, w) : null;
          if (b) s.wege[laden] = b;
        }
      }
      if (istObj(op.abteilungen)) {
        if (!istObj(s.abteilungen)) s.abteilungen = {};
        for (const [k, c] of Object.entries(op.abteilungen)) if (SCHLUESSEL.test(k) && ABTEILUNGEN.includes(c) && !s.abteilungen[k]) s.abteilungen[k] = c;
      }
      if (istObj(op.amyTags)) {
        if (!istObj(s.amyTags)) s.amyTags = {};
        for (const [id, t] of Object.entries(op.amyTags)) {
          const b = AMY_ID.test(id) && !s.amyTags[id] ? tagsBereinigen(t) : [];
          if (b.length) s.amyTags[id] = b;
        }
      }
      if (Array.isArray(op.ungleich)) {
        s.ungleich = [...new Set([...(Array.isArray(s.ungleich) ? s.ungleich : []), ...op.ungleich.filter((x) => typeof x === 'string' && x.includes('|'))])].slice(-MAX_UNGLEICH);
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
    case 'amy': {
      const vorher = istObj(s.amy) ? s.amy[op.r?.id] : null;
      const r = amyBereinigen({ ...op.r, by: vorher?.by || op.r?.by || op.by, at: vorher?.at || op.r?.at || op.at, geaendert: op.at });
      if (!r) return;
      if (!istObj(s.amy)) s.amy = {};
      s.amy[r.id] = r;
      s.amy = Object.fromEntries(neuesteAmy(Object.values(s.amy)).map((x) => [x.id, x]));
      return;
    }
    case 'weg': {
      if (!LADEN_NAME.test(String(op.laden)) || !Array.isArray(op.stellen)) return;
      if (!istObj(s.wege)) s.wege = {};
      if (!s.wege[op.laden] && Object.keys(s.wege).length >= MAX_LAEDEN_WEG) return;
      const w = s.wege[op.laden] || { n: 0, at: '', k: {} };
      for (const x of op.stellen) {
        if (!istObj(x) || !SCHLUESSEL.test(String(x.k)) || typeof x.p !== 'number' || x.p < 0 || x.p > 1) continue;
        const e = w.k[x.k] || { c: 'sonstiges', p: [] };
        // Neu dazugekommen: ans Ende, damit beim Kürzen das am längsten Ungesehene rausfällt
        delete w.k[x.k];
        w.k[x.k] = { c: text(x.c, 20) || e.c, p: [...e.p, Math.round(x.p * 100) / 100].slice(-MAX_WEG_MESSUNGEN) };
      }
      const keys = Object.keys(w.k);
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_WEG_ZUTATEN))) delete w.k[k];
      w.n += 1;
      w.at = op.at || jetzt();
      s.wege[op.laden] = w;
      return;
    }
    case 'wegWeg':
      if (istObj(s.wege)) delete s.wege[op.laden];
      return;
    case 'gleich': {
      const von = String(op.von);
      const nach = aufloesen(s, op.nach);
      if (!SCHLUESSEL.test(von) || !SCHLUESSEL.test(nach) || von === nach) return;
      const a = s.items[von];
      const b = s.items[nach];
      if (a && b) {
        const teile = teileVon(a);
        if (teile.length) {
          // Die Teile wandern mit; kommt dasselbe Rezept zweimal vor, zählen gleiche Einheiten zusammen
          if (!istObj(b.parts)) b.parts = {};
          for (const [rid, p] of teile) {
            const da = b.parts[rid];
            if (!istObj(da)) b.parts[rid] = klon(p);
            else if (typeof da.q === 'number' && typeof p.q === 'number' && da.u === p.u) {
              da.q = Math.round((da.q + p.q) * 100) / 100;
              da.done = da.done === true && p.done === true;
            }
          }
        } else if (!teileVon(b).length) {
          // Zwei eigene Einträge: offen, solange einer offen ist
          b.checked = b.checked === true && a.checked === true;
        }
        delete s.items[von];
      } else if (a) {
        const z = istObj(op.ziel) ? op.ziel : {};
        s.items[nach] = { ...a, name: text(z.name, 120) || a.name, cat: text(z.cat, 20) || a.cat };
        delete s.items[von];
      }
      if (!istObj(s.gleich)) s.gleich = {};
      for (const k of [von, ...(Array.isArray(op.namen) ? op.namen : [])]) {
        if (SCHLUESSEL.test(String(k)) && k !== nach && !String(k).startsWith('c-')) s.gleich[k] = nach;
      }
      delete s.gleich[nach];
      const alle = Object.keys(s.gleich);
      for (const k of alle.slice(0, Math.max(0, alle.length - MAX_GLEICH))) delete s.gleich[k];
      return;
    }
    case 'gleichWeg':
      if (istObj(s.gleich) && Array.isArray(op.schluessel)) for (const k of op.schluessel) delete s.gleich[k];
      return;
    case 'ungleich':
      if (typeof op.paar !== 'string' || !op.paar.includes('|')) return;
      s.ungleich = [...new Set([...(Array.isArray(s.ungleich) ? s.ungleich : []), op.paar])].slice(-MAX_UNGLEICH);
      return;
    case 'abteilung': {
      if (!istObj(op.werte)) return;
      if (!istObj(s.abteilungen)) s.abteilungen = {};
      for (const [k, c] of Object.entries(op.werte)) {
        if (!SCHLUESSEL.test(k)) continue;
        delete s.abteilungen[k];
        if (ABTEILUNGEN.includes(c)) s.abteilungen[k] = c;
      }
      const alle = Object.keys(s.abteilungen);
      for (const k of alle.slice(0, Math.max(0, alle.length - MAX_ABTEILUNGEN))) delete s.abteilungen[k];
      return;
    }
    case 'amyTags': {
      if (!AMY_ID.test(String(op.id))) return;
      if (!istObj(s.amyTags)) s.amyTags = {};
      const t = tagsBereinigen(op.tags);
      if (t.length) s.amyTags[op.id] = t; else delete s.amyTags[op.id];
      return;
    }
    case 'amyWeg':
      if (istObj(s.amy)) delete s.amy[op.id];
      if (istObj(s.amyTags)) delete s.amyTags[op.id];
      if (istObj(s.notizen)) delete s.notizen[op.id];
      if (istObj(s.gepinnt)) delete s.gepinnt[op.id];
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
