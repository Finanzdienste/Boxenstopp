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
 *     ungleich:  ['<a>|<b>', …],                            „Nein, verschieden“
 *     kochen:    { <name>: { at, schritte: { <rid>: [0, 2] }, tempo, timer: [] } },
 *     fehlt:     { <Schlüssel>: { laden: 'Aldi', at, by } },   im Laden nicht bekommen
 *     bons:      { <Schlüssel>: [{ eur: 4.99, q: 1000, u: 'g', laden, at, by }] },  was es gekostet hat
 *     preisalarm: { <Schlüssel>: { max: 6.5, u: 'kg', by, at } },   Bescheid, wenn ein Angebot so günstig ist
 *     haushalt:  { sachen, plaene, stand, todoApp, todoWunsch, todoAn, todoZiel },   Haushaltssachen und Putzplan (haushalt.js)
 *     leute:     { amy: 'Amy', tobi: 'Tobi' } }   wer die Liste teilt (für „Wer“ im Putzplan; eine eigene Liste: eine Person)
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
 * `kochen` ist der Kochstand je Person (kochstand.js): abgehakte Schritte,
 * gelerntes Tempo, laufende Timer – die neueste Fassung gewinnt. `fehlt`
 * sind Zeilen, die es im Laden nicht gab – sie bleiben für den nächsten
 * Einkauf offen; der Haken nimmt die Markierung weg. `bons` sind bezahlte
 * Preise (die letzten fünf je Zutat): Die Kosten rechnen dann damit statt mit
 * dem Richtpreis (kosten.js preiseMitBons). `preisalarm` ist ein Wunschpreis
 * je Zutat (angebote.js preisalarmTreffer, Push im Daten-Repo).
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
import { RAUM, SACH_BEREICH, aufgabenAm } from './haushalt.js';
import { zielBereinigen as makrosBereinigen } from './zielrechner.js';
import { boxenBereinigen, BOXEN_STANDARD } from './boxen.js';

export const leerHaushalt = () => ({ sachen: {}, plaene: {}, stand: {}, todoApp: '', todoWunsch: {}, todoAn: {}, todoZiel: {} });
export const leer = () => ({ version: 1, rev: 0, items: {}, cooked: {}, bewertung: {}, ki: {}, notizen: {}, gepinnt: {}, angebote: { stand: '', von: null, eintraege: [] }, amy: {}, amyTags: {}, wege: {}, abteilungen: {}, gleich: {}, ungleich: [], kochen: {}, fehlt: {}, bons: {}, preisalarm: {}, haushalt: leerHaushalt(), leute: {}, profil: {} });
const MAX_KOCHEN = 6;
const MAX_BONS_JE = 5;
const MAX_BONS = 200;
const MAX_ALARME = 60;
/** Einheiten für Bons und Wunschpreise. */
export const BON_EINHEITEN = ['g', 'ml', 'Stk', 'Pck', 'Dose', 'Glas', 'Bund'];
export const ALARM_EINHEITEN = ['kg', 'l', 'Stk'];
const MAX_GLEICH = 300;
const MAX_SACHEN = 150;
const MAX_PLAENE = 40;
const MAX_AUFGABEN = 30;
const SACHE_ID = /^hs-[a-z0-9-]{1,40}$/;
const PLAN_ID = /^pp-[a-z0-9-]{1,40}$/;
const AUFGABE_ID = /^a-[a-z0-9-]{1,40}$/;
const PERSON = /^[\p{L}\p{N} ._-]{1,40}$/u;
/** Farben einer Liste (Einstellungen, Einladung) – ohne Angabe die blaue. */
export const FARBEN = ['lila'];
const TODO_WUENSCHE = ['verbinden', 'trennen', 'abgleichen'];
/** Die App bei Microsoft (Anwendungs-ID, eine GUID) – kein Geheimnis. */
export const TODO_APP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

/**
 * Was jemand selbst dazu will – 500 g Sahne für sich, zusätzlich zu den 250 g
 * fürs Rezept: ein eigenes Teil der Zeile, je Person eins („x-amy“). Es zählt
 * zur Menge, wird mit abgehakt und bleibt, wenn das Rezept runterkommt. Bei
 * einem eigenen Eintrag (Bananen) ist es einfach die Menge.
 */
export const extraId = (name) => `x-${String(name || '').trim().toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'ich'}`;
export const istExtra = (rid) => /^x-/.test(String(rid));

/** Alle Rezepte, die gerade etwas auf der Liste haben – in der Reihenfolge ihres Auftauchens (ohne das, was jemand selbst dazu will). */
export function rezepteAufListe(stand) {
  const s = new Set();
  for (const d of Object.values(stand.items)) for (const [rid] of teileVon(d)) if (!istExtra(rid)) s.add(rid);
  return [...s];
}

export const offeneAnzahl = (stand) => Object.values(stand.items).filter((d) => !erledigt(d)).length;

/**
 * Ist eine Änderung eine Nachricht an die anderen wert (Push)? Neues auf der
 * Liste, ein neues Rezept von Amy, eine neue Notiz – oder alles eingekauft.
 * Abhaken, Kochstand, Wege und Ähnliches nicht.
 */
export function bescheidNoetig(vorher, nachher) {
  const v = vorher || leer();
  for (const [k, d] of Object.entries(nachher?.items || {})) {
    const alt = v.items?.[k];
    if (!alt) return true;
    for (const rid of Object.keys(d.parts || {})) if (!alt.parts?.[rid]) return true;
  }
  for (const id of Object.keys(nachher?.amy || {})) if (!v.amy?.[id]) return true;
  for (const [rid, ns] of Object.entries(nachher?.notizen || {})) for (const n of ns || []) if (!(v.notizen?.[rid] || []).some((x) => x.id === n.id)) return true;
  return Object.keys(nachher?.items || {}).length > 0 && offeneAnzahl(v) > 0 && offeneAnzahl(nachher) === 0;
}

/**
 * In einem Stand andere Namen (alias, klein geschrieben) durch neu ersetzen:
 * by und wer überall (nicht in den Angeboten), der Verlauf im Putzplan
 * ([Tag, wer]), der Kochstand (der neuere bleibt) und „Mehr davon“
 * (x-marielli → x-marielle; gibt es das schon, in derselben Einheit addiert).
 */
function namenErsetzen(s, alias, neu) {
  const tief = (x, ebene = 0) => {
    if (!x || typeof x !== 'object' || ebene > 8) return;
    if (Array.isArray(x)) { for (const y of x) tief(y, ebene + 1); return; }
    for (const [k, y] of Object.entries(x)) {
      if ((k === 'by' || k === 'wer') && typeof y === 'string' && alias.has(y.toLowerCase())) x[k] = neu;
      else if (y && typeof y === 'object') tief(y, ebene + 1);
    }
  };
  for (const [k, y] of Object.entries(s)) if (k !== 'angebote' && k !== 'leute') tief(y);
  for (const st of Object.values(s.haushalt?.stand || {})) {
    for (const e of Array.isArray(st?.verlauf) ? st.verlauf : []) if (Array.isArray(e) && typeof e[1] === 'string' && alias.has(e[1].toLowerCase())) e[1] = neu;
  }
  if (istObj(s.kochen)) {
    const ziel = kochenName(neu);
    for (const k of Object.keys(s.kochen)) {
      if (k === ziel || !alias.has(k)) continue;
      if (!s.kochen[ziel] || String(s.kochen[k]?.at || '') > String(s.kochen[ziel]?.at || '')) s.kochen[ziel] = s.kochen[k];
      delete s.kochen[k];
    }
  }
  const zielId = extraId(neu);
  const aliasIds = new Set([...alias].map(extraId));
  for (const d of Object.values(s.items || {})) {
    if (!istObj(d?.parts)) continue;
    for (const rid of Object.keys(d.parts)) {
      if (rid === zielId || !aliasIds.has(rid)) continue;
      const a = d.parts[rid];
      const b = d.parts[zielId];
      if (!b) d.parts[zielId] = a;
      else if (b.u === a.u && typeof a.q === 'number' && typeof b.q === 'number') b.q = Math.round((b.q + a.q) * 100) / 100;
      else continue;
      delete d.parts[rid];
    }
  }
}

/**
 * Eine eigene Liste auf eine Person gebracht (opEinePerson): das Vorher
 * genauso umbenennen – sonst sähe jedes „by“ wie eine Änderung aus. Für
 * beschreibung() und die Einzelheiten im Überblick (einzelheiten.js).
 * → { v: das angeglichene Vorher, umbenannt: [alte Namen] }
 */
export function vorherAngleichen(vorher, nachher) {
  let v = vorher || leer();
  const n = nachher || leer();
  const umbenannt = n.profil?.person ? Object.entries(v.leute || {}).filter(([k]) => !n.leute?.[k]).map(([, x]) => String(x)) : [];
  if (umbenannt.length) {
    v = klon(v);
    namenErsetzen(v, new Set(umbenannt.map((x) => x.toLowerCase())), n.profil.person);
  }
  return { v, umbenannt };
}

/**
 * Was ein Paket von Änderungen getan hat, in ein paar Worten – für die
 * Commit-Nachricht (speicher.js) und damit für den Überblick des Gastgebers
 * (gaeste.js): „Chili, Milch auf die Liste; 3 abgehakt“. name(rid) gibt den
 * kurzen Namen eines Rezepts (sonst steht die id da). Leer, wenn es nichts
 * Nennenswertes ist. Was genau, Zeile für Zeile, rechnet einzelheiten.js.
 */
export function beschreibung(vorher, nachher, name = () => '') {
  const n = nachher || leer();
  const { v, umbenannt } = vorherAngleichen(vorher, n);
  const rn = (rid) => name(rid) || rid;
  const teile = [];
  const aufzaehlen = (xs, max = 3) => `${xs.slice(0, max).join(', ')}${xs.length > max ? ' …' : ''}`;
  // Einkaufsliste
  const rezepte = new Set();
  const eigene = [];
  let fertig = 0;
  for (const [k, d] of Object.entries(n.items || {})) {
    const alt = v.items?.[k];
    let mehr = false;
    for (const [rid] of teileVon(d)) if (!alt?.parts?.[rid]) { if (istExtra(rid)) mehr = true; else rezepte.add(rid); }
    if ((!alt && !teileVon(d).length) || (mehr && !eigene.includes(d.name))) eigene.push(d.name);
    if (alt && !erledigt(alt) && erledigt(d)) fertig++;
  }
  const dazu = [...[...rezepte].map(rn), ...eigene];
  if (dazu.length) teile.push(`${aufzaehlen(dazu)} auf die Liste`);
  const vorherOffen = offeneAnzahl(v);
  if (fertig) teile.push(vorherOffen > 0 && offeneAnzahl(n) === 0 && Object.keys(n.items || {}).length ? 'alles eingekauft' : `${fertig} abgehakt`);
  const weg = Object.keys(v.items || {}).filter((k) => !n.items?.[k]).length;
  if (weg) teile.push(Object.keys(n.items || {}).length ? `${weg} von der Liste` : 'Liste geleert');
  // Rezepte
  const gekocht = Object.keys(n.cooked || {}).filter((rid) => n.cooked[rid]?.at !== v.cooked?.[rid]?.at);
  if (gekocht.length) teile.push(`${aufzaehlen(gekocht.map(rn), 2)} gekocht`);
  const bewertet = Object.keys({ ...(v.bewertung || {}), ...(n.bewertung || {}) }).filter((rid) => n.bewertung?.[rid]?.wert !== v.bewertung?.[rid]?.wert);
  if (bewertet.length) teile.push(`${aufzaehlen(bewertet.map(rn), 2)} bewertet`);
  const notiz = Object.keys(n.notizen || {}).filter((rid) => (n.notizen[rid] || []).some((x) => !(v.notizen?.[rid] || []).some((y) => y.id === x.id && y.text === x.text)));
  if (notiz.length) teile.push(`Notiz zu ${aufzaehlen(notiz.map(rn), 2)}`);
  const eigenNeu = Object.values(n.amy || {}).filter((r) => JSON.stringify(r) !== JSON.stringify(v.amy?.[r.id])).map((r) => r.name);
  if (eigenNeu.length) teile.push(`Rezept ${aufzaehlen(eigenNeu.map((x) => `„${x}“`), 2)}`);
  const kiNeu = Object.keys(n.ki || {}).filter((id) => !v.ki?.[id]).map((id) => n.ki[id]?.r?.name || id);
  if (kiNeu.length) teile.push(`${aufzaehlen(kiNeu.map((x) => `„${x}“`), 2)} behalten`);
  const kocht = new Set();
  for (const [w, k] of Object.entries(n.kochen || {})) {
    const alt = v.kochen?.[w];
    if (alt?.at === k.at) continue;
    for (const [rid, xs] of Object.entries(k.schritte || {})) if (JSON.stringify(xs) !== JSON.stringify(alt?.schritte?.[rid])) kocht.add(rid);
  }
  if (kocht.size) teile.push(`kocht ${aufzaehlen([...kocht].map(rn), 2)}`);
  // Haushalt, Profil, der Rest
  const hv = v.haushalt || leerHaushalt();
  const hn = n.haushalt || leerHaushalt();
  if (JSON.stringify(hv.stand || {}) !== JSON.stringify(hn.stand || {})) teile.push('Putzplan abgehakt');
  if (JSON.stringify(hv.plaene || {}) !== JSON.stringify(hn.plaene || {})) teile.push('Putzplan geändert');
  if (JSON.stringify(hv.sachen || {}) !== JSON.stringify(hn.sachen || {})) teile.push('Haushaltssachen');
  if (JSON.stringify(v.profil?.ziel || null) !== JSON.stringify(n.profil?.ziel || null)) teile.push('Ziel pro Box geändert');
  const boxen = n.profil?.boxen || BOXEN_STANDARD;
  if (boxen !== (v.profil?.boxen || BOXEN_STANDARD)) teile.push(boxen === 1 ? '1 Box pro Rezept' : `${boxen} Boxen pro Rezept`);
  if (Object.keys(n.leute || {}).some((k) => !v.leute?.[k])) teile.push('zum ersten Mal dabei');
  if (umbenannt.length) teile.push(`${aufzaehlen(umbenannt)} heißt jetzt ${n.profil.person}`);
  if (!teile.length) {
    if (JSON.stringify(v.bons || {}) !== JSON.stringify(n.bons || {})) teile.push('Preis vom Bon');
    else if (JSON.stringify(v.preisalarm || {}) !== JSON.stringify(n.preisalarm || {})) teile.push('Preisalarm');
    else if (JSON.stringify(v.wege || {}) !== JSON.stringify(n.wege || {})) teile.push('Weg durch den Laden');
  }
  return teile.join('; ').replace(/[\n\r]+/g, ' ').slice(0, 140);
}

/**
 * Muss der Abgleich mit Microsoft To Do laufen (Commit mit „· To Do“)? Wenn
 * jemand verbinden oder trennen will – oder To Do eingerichtet ist und sich am
 * Putzplan oder an den Haken etwas geändert hat.
 */
export function todoNoetig(vorher, nachher) {
  const v = vorher?.haushalt || leerHaushalt();
  const n = nachher?.haushalt || leerHaushalt();
  if (JSON.stringify(v.todoWunsch || {}) !== JSON.stringify(n.todoWunsch || {})) return true;
  if (JSON.stringify(v.todoZiel || {}) !== JSON.stringify(n.todoZiel || {})) return true;
  if (!n.todoApp || !Object.keys(n.todoAn || {}).length) return false;
  return JSON.stringify(v.plaene || {}) !== JSON.stringify(n.plaene || {}) || JSON.stringify(v.stand || {}) !== JSON.stringify(n.stand || {});
}

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
  if (istObj(roh.kochen)) {
    for (const [w, k] of Object.entries(roh.kochen).slice(0, MAX_KOCHEN)) {
      const b = kochenName(w) ? kochenBereinigen(k) : null;
      if (b) s.kochen[kochenName(w)] = b;
    }
  }
  if (istObj(roh.fehlt)) {
    for (const [k, f] of Object.entries(roh.fehlt)) {
      if (SCHLUESSEL.test(k) && istObj(f) && s.items[k]) s.fehlt[k] = { laden: LADEN_NAME.test(String(f.laden || '')) ? f.laden : '', at: text(f.at, 40) || '', by: text(f.by, 40) };
    }
  }
  if (istObj(roh.bons)) {
    for (const [k, liste] of Object.entries(roh.bons).slice(-MAX_BONS)) {
      const b = SCHLUESSEL.test(k) && Array.isArray(liste) ? liste.map(bonBereinigen).filter(Boolean).slice(-MAX_BONS_JE) : [];
      if (b.length) s.bons[k] = b;
    }
  }
  if (istObj(roh.preisalarm)) {
    for (const [k, a] of Object.entries(roh.preisalarm).slice(-MAX_ALARME)) {
      const b = SCHLUESSEL.test(k) ? alarmBereinigen(a) : null;
      if (b) s.preisalarm[k] = b;
    }
  }
  if (istObj(roh.haushalt)) s.haushalt = haushaltBereinigen(roh.haushalt);
  if (istObj(roh.leute)) {
    for (const [k, n] of Object.entries(roh.leute).slice(0, 8)) if (PERSON.test(String(n)) && k === String(n).toLowerCase()) s.leute[k] = n;
  }
  if (istObj(roh.profil)) s.profil = profilBereinigen(roh.profil);
  return s;
}

/**
 * Was eine Liste für sich festlegt (liste.json unter profil, für alle, die sie
 * teilen): person – wessen eigene Rezepte der rosa Reiter zeigt (bei einer
 * eigenen Liste wie Marielles; bei Tobi und Amy fehlt es: Amy), farbe – die
 * Farbe der App ('lila'; fehlt: blau), ziel – Makros pro Box mit by/at,
 * boxen – für wie viele Boxen gekocht wird (1–8; fehlt: 8, boxen.js).
 */
export function profilBereinigen(x) {
  const p = {};
  if (!istObj(x)) return p;
  if (PERSON.test(String(x.person || ''))) p.person = String(x.person).trim();
  if (FARBEN.includes(x.farbe)) p.farbe = x.farbe;
  const z = makrosBereinigen(x.ziel);
  if (z) p.ziel = { ...z, by: text(x.ziel.by, 40), at: text(x.ziel.at, 40) || '' };
  const b = boxenBereinigen(x.boxen);
  if (b) p.boxen = b;
  return p;
}

/**
 * Eine ältere App-Fassung kennt profil.boxen nicht und lässt es beim
 * Schreiben weg (profilBereinigen behält nur, was sie kennt). Gesetzt wird
 * es immer ausdrücklich, auch 8 – fehlt es, wo dieses Handy es kannte, kommt
 * es wieder dazu (speicher.js).
 */
export function profilNachtrag(roh, stand, bekannt) {
  const b = boxenBereinigen(bekannt?.profil?.boxen);
  if (!b || !istObj(roh) || !istObj(roh.profil) || 'boxen' in roh.profil || stand?.profil?.boxen) return [];
  return [opProfil({ boxen: b })];
}

/* ------------------------------------------------------------- Haushalt */

const sauber = (v, max) => (typeof v === 'string' ? v.replace(/[\p{Cc}<>]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
function sacheBereinigen(x) {
  if (!istObj(x)) return null;
  const name = sauber(x.name, 60);
  if (!name) return null;
  return { name, bereich: SACH_BEREICH[x.bereich] ? x.bereich : 'sonstiges', by: text(x.by, 40), at: text(x.at, 40) || '' };
}
/** Ein Putztag aus beliebigem JSON – oder null. */
export function planBereinigen(p) {
  if (!istObj(p)) return null;
  const name = sauber(p.name, 40);
  if (!name) return null;
  const ids = new Set();
  const aufgaben = [];
  for (const a of Array.isArray(p.aufgaben) ? p.aufgaben : []) {
    const t = istObj(a) ? sauber(a.t, 120) : '';
    if (!t || !AUFGABE_ID.test(String(a.id)) || ids.has(a.id)) continue;
    ids.add(a.id);
    // „jedes 2./3./4. Mal“ – jedes Mal steht nicht extra drin
    const jedes = [2, 3, 4].includes(Number(a.jedes)) ? Number(a.jedes) : 0;
    aufgaben.push(jedes ? { id: a.id, t, jedes } : { id: a.id, t });
    if (aufgaben.length >= MAX_AUFGABEN) break;
  }
  const material = [];
  for (const m of Array.isArray(p.material) ? p.material : []) {
    const t = sauber(m, 60);
    if (t && !material.some((x) => x.toLowerCase() === t.toLowerCase())) material.push(t);
    if (material.length >= 20) break;
  }
  const w = istObj(p.wdh) ? p.wdh : {};
  const tage = [...new Set((Array.isArray(w.tage) ? w.tage : []).filter((t) => Number.isInteger(t) && t >= 1 && t <= 7))].sort((a, b) => a - b);
  const wer = sauber(p.wer, 40);
  return {
    name,
    raum: RAUM[p.raum] ? p.raum : 'sonstiges',
    aufgaben,
    material,
    wdh: { tage, wochen: [1, 2, 3, 4].includes(w.wochen) ? w.wochen : 1, ab: TAG.test(String(w.ab)) ? w.ab : '' },
    wer: PERSON.test(wer) ? wer : '',
    erinnern: ['morgens', 'mittags', 'abends', ''].includes(p.erinnern) ? p.erinnern : 'morgens',
    by: text(p.by, 40),
    at: text(p.at, 40) || '',
  };
}
function putzStandBereinigen(x, plan) {
  if (!istObj(x) || !TAG.test(String(x.datum))) return null;
  const da = new Set((plan?.aufgaben || []).map((a) => a.id));
  const haken = [...new Set((Array.isArray(x.haken) ? x.haken : []).filter((id) => typeof id === 'string' && da.has(id)))];
  const fertig = istObj(x.fertig) && text(x.fertig.at, 40) ? { at: x.fertig.at, by: text(x.fertig.by, 40) } : null;
  const verlauf = (Array.isArray(x.verlauf) ? x.verlauf : []).filter((v) => Array.isArray(v) && TAG.test(String(v[0]))).map((v) => [v[0], text(v[1], 40) || '']).slice(-6);
  return { datum: x.datum, haken, fertig, verlauf };
}
function haushaltBereinigen(roh) {
  const h = leerHaushalt();
  if (istObj(roh.sachen)) {
    for (const [id, x] of Object.entries(roh.sachen).slice(-MAX_SACHEN)) {
      const b = SACHE_ID.test(id) ? sacheBereinigen(x) : null;
      if (b) h.sachen[id] = b;
    }
  }
  if (istObj(roh.plaene)) {
    for (const [id, p] of Object.entries(roh.plaene).slice(-MAX_PLAENE)) {
      const b = PLAN_ID.test(id) ? planBereinigen(p) : null;
      if (b) h.plaene[id] = b;
    }
  }
  if (istObj(roh.stand)) {
    for (const [id, x] of Object.entries(roh.stand)) {
      const b = h.plaene[id] ? putzStandBereinigen(x, h.plaene[id]) : null;
      if (b) h.stand[id] = b;
    }
  }
  h.todoApp = TODO_APP_ID.test(String(roh.todoApp || '')) ? roh.todoApp : '';
  if (istObj(roh.todoWunsch)) {
    for (const [n, w] of Object.entries(roh.todoWunsch).slice(0, 6)) {
      if (PERSON.test(n) && n === n.toLowerCase() && istObj(w) && TODO_WUENSCHE.includes(w.art) && text(w.at, 40)) h.todoWunsch[n] = { art: w.art, at: w.at, name: PERSON.test(String(w.name || '')) ? w.name : n };
    }
  }
  if (istObj(roh.todoZiel)) {
    for (const [n, z] of Object.entries(roh.todoZiel).slice(0, 6)) {
      const b = PERSON.test(n) && n === n.toLowerCase() ? zielBereinigen(z) : null;
      if (b) h.todoZiel[n] = b;
    }
  }
  if (istObj(roh.todoAn)) {
    for (const [n, at] of Object.entries(roh.todoAn).slice(0, 6)) if (PERSON.test(n) && n === n.toLowerCase() && text(at, 40)) h.todoAn[n] = at;
  }
  return h;
}
/** Ein Ziel in To Do: { id, name, geteilt, at } – id 'neu' oder die Kennung einer Liste bei Microsoft. */
function zielBereinigen(z) {
  if (!istObj(z) || typeof z.id !== 'string' || !/^[\w=+/-]{1,600}$/.test(z.id) || !text(z.at, 40)) return null;
  return { id: z.id, name: sauber(z.name, 120) || (z.id === 'neu' ? 'Haushalt' : 'Liste'), geteilt: z.geteilt === true, at: z.at };
}
const hausVon = (s) => {
  if (!istObj(s.haushalt)) s.haushalt = leerHaushalt();
  const h = s.haushalt;
  for (const k of ['sachen', 'plaene', 'stand', 'todoWunsch', 'todoAn', 'todoZiel']) if (!istObj(h[k])) h[k] = {};
  if (typeof h.todoApp !== 'string') h.todoApp = '';
  return h;
};
const kappen = (o, max) => { const ks = Object.keys(o); for (const k of ks.slice(0, Math.max(0, ks.length - max))) delete o[k]; };
/** Der Stand eines Putztags für den Tag datum – ein neuer Tag fängt frisch an (der Verlauf bleibt); ein älterer zählt nicht mehr. */
function putzTag(h, planId, datum) {
  const st = h.stand[planId];
  if (st && st.datum === datum) return st;
  if (st && st.datum > datum) return null;
  return { datum, haken: [], fertig: null, verlauf: st?.verlauf || [] };
}
function putzSetzen(h, planId, st, plan, at, by) {
  // Erledigt, wenn alles abgehakt ist, was an diesem Tag dran ist („jedes 2. Mal“ zählt nur, wenn es dran ist)
  const dran = aufgabenAm(plan, st.datum);
  const alle = dran.length > 0 && dran.every((a) => st.haken.includes(a.id));
  if (alle && !st.fertig) {
    st.fertig = { at, by };
    st.verlauf = [...st.verlauf.filter((v) => v[0] !== st.datum), [st.datum, by || '']].slice(-6);
  }
  if (!alle && st.fertig && dran.length) {
    st.fertig = null;
    st.verlauf = st.verlauf.filter((v) => v[0] !== st.datum);
  }
  h.stand[planId] = st;
}

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Der Kochstand einer Person aus beliebigem JSON – oder null. */
export function kochenBereinigen(k) {
  if (!istObj(k) || !text(k.at, 40)) return null;
  const schritte = {};
  if (istObj(k.schritte)) {
    for (const [rid, xs] of Object.entries(k.schritte).slice(-60)) {
      if (!SCHLUESSEL.test(rid) || !Array.isArray(xs)) continue;
      const ix = [...new Set(xs.filter((i) => Number.isInteger(i) && i >= 0 && i < 300))];
      if (ix.length) schritte[rid] = ix;
    }
  }
  const t = istObj(k.tempo) ? k.tempo : {};
  const offen = {};
  if (istObj(t.offen)) {
    for (const [rid, l] of Object.entries(t.offen).slice(-10)) {
      if (SCHLUESSEL.test(rid) && istObj(l) && Array.isArray(l.h)) offen[rid] = { start: zahl(l.start), n: zahl(l.n), std: zahl(l.std), h: l.h.filter((h) => Array.isArray(h) && h.length >= 4 && h.length <= 8).slice(-200).map(klon) };
    }
  }
  const proben = Array.isArray(t.proben) ? t.proben.filter((p) => Array.isArray(p) && p.length >= 4 && p.length <= 6 && typeof p[0] === 'string').slice(-300).map(klon) : [];
  const gesamt = {};
  if (istObj(t.gesamt)) {
    for (const [rid, l] of Object.entries(t.gesamt).slice(-100)) {
      if (SCHLUESSEL.test(rid) && Array.isArray(l)) gesamt[rid] = l.filter((x) => Array.isArray(x) && typeof x[0] === 'number').slice(-5).map((x) => [x[0], text(x[1], 10) || '']);
    }
  }
  const timer = Array.isArray(k.timer) ? k.timer.filter((x) => istObj(x) && typeof x.id === 'string' && typeof x.ende === 'number').slice(-10).map((x) => ({
    id: x.id.slice(0, 30), rid: text(x.rid, 120) || '', schritt: Number.isInteger(x.schritt) ? x.schritt : 0, label: text(x.label, 60) || '',
    minuten: zahl(x.minuten), start: zahl(x.start), ende: x.ende, fertig: x.fertig === true, dann: text(x.dann, 80) || '',
    folge: Array.isArray(x.folge) ? x.folge.filter(istObj).slice(0, 3).map((f) => ({ minuten: zahl(f.minuten), dann: text(f.dann, 80) || '' })) : [],
    stufe: zahl(x.stufe) || 1, stufen: zahl(x.stufen) || 1,
  })) : [];
  return { at: k.at, schritte, tempo: { offen, proben, gesamt }, timer };
}
const kochenName = (w) => String(w || '').trim().toLowerCase().slice(0, 40);
const preisOk = (x, max) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= max;

/** Ein bezahlter Preis aus beliebigem JSON – oder null. */
function bonBereinigen(b) {
  if (!istObj(b) || !preisOk(b.eur, 500) || !preisOk(b.q, 100000) || !BON_EINHEITEN.includes(b.u)) return null;
  return { eur: Math.round(b.eur * 100) / 100, q: Math.round(b.q * 100) / 100, u: b.u, laden: LADEN_NAME.test(String(b.laden || '')) ? b.laden : '', at: text(b.at, 40) || '', by: text(b.by, 40) };
}
function alarmBereinigen(a) {
  if (!istObj(a) || !preisOk(a.max, 500) || !ALARM_EINHEITEN.includes(a.u)) return null;
  return { max: Math.round(a.max * 100) / 100, u: a.u, name: text(a.name, 80) || '', by: text(a.by, 40), at: text(a.at, 40) || '' };
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
 * mehr = { amy, amyTags, wege, abteilungen, gleich, ungleich, kochen, fehlt, bons, preisalarm }.
 */
export const opZusammen = (items, ki = {}, mehr = {}) => ({
  typ: 'zusammen', items: klon(items), ki: klon(ki || {}),
  amy: klon(mehr.amy || {}), amyTags: klon(mehr.amyTags || {}), wege: klon(mehr.wege || {}), abteilungen: klon(mehr.abteilungen || {}), gleich: klon(mehr.gleich || {}), ungleich: klon(mehr.ungleich || []), kochen: klon(mehr.kochen || {}),
  fehlt: klon(mehr.fehlt || {}), bons: klon(mehr.bons || {}), preisalarm: klon(mehr.preisalarm || {}), haushalt: klon(mehr.haushalt || {}), leute: klon(mehr.leute || {}), profil: klon(mehr.profil || {}),
});
/**
 * Eine ältere App-Fassung kennt Material und „jedes 2. Mal“ der Putztage
 * nicht und lässt beides beim Schreiben weg (sie schreibt dann gar kein
 * „material“). Was dieses Handy davon kannte, kommt wieder dazu – als opPlan
 * je Putztag. roh: die Datei, wie sie kam; stand: bereinigt; bekannt: der
 * Stand, den dieses Handy zuletzt kannte.
 */
export function planNachtrag(roh, stand, bekannt) {
  const rohPlaene = istObj(roh) && istObj(roh.haushalt) && istObj(roh.haushalt.plaene) ? roh.haushalt.plaene : null;
  if (!rohPlaene) return [];
  const ops = [];
  for (const [id, p] of Object.entries(stand?.haushalt?.plaene || {})) {
    const r = rohPlaene[id];
    const k = bekannt?.haushalt?.plaene?.[id];
    if (!k || !istObj(r) || 'material' in r) continue;
    const jedes = new Map((k.aufgaben || []).filter((a) => a.jedes > 1).map((a) => [a.id, a.jedes]));
    if (!(k.material || []).length && !jedes.size) continue;
    ops.push(opPlan(id, { ...p, material: k.material || [], aufgaben: p.aufgaben.map((a) => (jedes.has(a.id) ? { ...a, jedes: jedes.get(a.id) } : a)) }, p.by));
  }
  return ops;
}
/** Hat ein Stand etwas im Haushalt (sonst muss beim Zusammenlegen nichts mit)? */
export const hatHaushalt = (h) => !!h && (Object.keys(h.sachen || {}).length > 0 || Object.keys(h.plaene || {}).length > 0 || !!h.todoApp || Object.keys(h.todoAn || {}).length > 0);
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
/** Der Kochstand einer Person (kochstand.js) – ersetzt einen älteren; eine noch nicht gesendete Fassung ersetzt die vorige (ersetzt). */
export const opKochen = (wer, stand, at) => ({ typ: 'kochen', wer: kochenName(wer), stand: klon(stand), at, ersetzt: `kochen:${kochenName(wer)}` });
/** Im Laden nicht bekommen: bleibt für den nächsten Einkauf offen (mit dem Laden, in dem es fehlte). */
export const opFehlt = (k, laden, by) => ({ typ: 'fehlt', k, laden: laden || '', by: by || null, at: jetzt() });
export const opFehltWeg = (k) => ({ typ: 'fehltWeg', k });
/** Was es gekostet hat: { eur, q, u, laden } – die letzten fünf je Zutat zählen. */
export const opBon = (k, bon, by) => ({ typ: 'bon', k, bon: { ...klon(bon), by: by || null, at: bon?.at || jetzt() } });
export const opBonWeg = (k, at) => ({ typ: 'bonWeg', k, at });
/** Eine Haushaltssache merken, ändern – oder mit null vergessen. */
export const opSache = (id, sache, by) => ({ typ: 'sache', id, sache: sache ? { ...klon(sache), by: by || null, at: jetzt() } : null });
/** Einen Putztag anlegen oder ändern (ganz ersetzen) – oder mit null löschen (sein Stand geht mit). */
export const opPlan = (id, plan, by) => ({ typ: 'plan', id, plan: plan ? { ...klon(plan), by: by || null, at: jetzt() } : null });
/** Eine Aufgabe eines Putztags am Tag datum abhaken (an) oder wieder auf; alle: erledigt. */
export const opPutzHaken = (planId, datum, aufgabe, an, by) => ({ typ: 'putzHaken', planId, datum, aufgabe, an: !!an, by: by || null, at: jetzt() });
/** Den ganzen Tag als erledigt (alle Aufgaben) – oder wieder offen. */
export const opPutzFertig = (planId, datum, an, by) => ({ typ: 'putzFertig', planId, datum, an: !!an, by: by || null, at: jetzt() });
/** Die App-ID bei Microsoft für To Do (leer: keine). */
export const opTodoApp = (app) => ({ typ: 'todoApp', app: String(app || '').trim() });
/** Mit To Do verbinden, trennen oder gleich abgleichen wollen (der Lauf im Daten-Repo macht es); art null: Wunsch vergessen. */
export const opTodoWunsch = (name, art) => ({ typ: 'todoWunsch', name: String(name || '').trim().toLowerCase(), wie: String(name || '').trim(), art, at: jetzt() });
/**
 * In welche Liste in To Do die Putztage einer Person kommen: id 'neu' (eine
 * eigene Liste „Haushalt“) oder eine vorhandene – geteilt: eine gemeinsame
 * Liste, dann stehen dort alle Putztage (werkzeug/todo.mjs).
 */
export const opTodoZiel = (name, id, liste, geteilt) => ({ typ: 'todoZiel', name: String(name || '').trim().toLowerCase(), ziel: { id: String(id || ''), name: String(liste || ''), geteilt: !!geteilt }, at: jetzt() });
/** Wer die Liste teilt – jedes Gerät trägt seinen Namen einmal ein (app.js). */
export const opPerson = (name) => ({ typ: 'person', name: String(name || '').trim() });
/**
 * Eine eigene Liste auf eine Person bringen (den Namen aus dem Profil): Hat
 * sich ein Gerät anders genannt („Marielli“ statt „Marielle“), steht, was es
 * gemacht hat, danach bei ihr – by und wer, Putzplan-Verlauf, Kochstand,
 * „Mehr davon“ – und der andere Name ist aus leute raus.
 */
export const opEinePerson = (name) => ({ typ: 'einePerson', name: String(name || '').trim() });
/**
 * Am Profil der Liste etwas setzen: { ziel } (null: zurück zum Standard),
 * { farbe } ('' : blau), { person } – was nicht drinsteht, bleibt.
 */
export const opProfil = (teil, by) => ({ typ: 'profil', teil: klon(teil || {}), by: by || null, at: jetzt() });
/** Wer mit To Do verbunden ist – das schreibt nur der Lauf im Daten-Repo (werkzeug/todo.mjs). */
export const opTodoAn = (name, an) => ({ typ: 'todoAn', name: String(name || '').trim().toLowerCase(), an: !!an, at: jetzt() });
/** Wunschpreis je Zutat (max in Euro je u: kg, l oder Stk); null löscht ihn. */
export const opPreisalarm = (k, alarm, by) => ({ typ: 'preisalarm', k, alarm: alarm ? { ...klon(alarm), by: by || null, at: jetzt() } : null });
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
      // Doch bekommen: die Markierung „nicht bekommen“ ist erledigt
      if (op.done && istObj(s.fehlt)) delete s.fehlt[op.k];
      return;
    }
    case 'loeschen':
      delete s.items[op.k];
      if (istObj(s.fehlt)) delete s.fehlt[op.k];
      return;
    case 'fehlt':
      if (!d || !SCHLUESSEL.test(String(op.k))) return;
      if (!istObj(s.fehlt)) s.fehlt = {};
      s.fehlt[op.k] = { laden: LADEN_NAME.test(String(op.laden || '')) ? op.laden : '', at: op.at, by: op.by || null };
      return;
    case 'fehltWeg':
      if (istObj(s.fehlt)) delete s.fehlt[op.k];
      return;
    case 'bon': {
      const b = SCHLUESSEL.test(String(op.k)) ? bonBereinigen(op.bon) : null;
      if (!b) return;
      if (!istObj(s.bons)) s.bons = {};
      const liste = (s.bons[op.k] || []).filter((x) => x.at !== b.at);
      delete s.bons[op.k];
      s.bons[op.k] = [...liste, b].slice(-MAX_BONS_JE);
      const alle = Object.keys(s.bons);
      for (const k of alle.slice(0, Math.max(0, alle.length - MAX_BONS))) delete s.bons[k];
      return;
    }
    case 'bonWeg': {
      if (!istObj(s.bons) || !Array.isArray(s.bons[op.k])) return;
      const rest = s.bons[op.k].filter((x) => x.at !== op.at);
      if (rest.length) s.bons[op.k] = rest; else delete s.bons[op.k];
      return;
    }
    case 'preisalarm': {
      if (!SCHLUESSEL.test(String(op.k))) return;
      if (!istObj(s.preisalarm)) s.preisalarm = {};
      const a = op.alarm ? alarmBereinigen(op.alarm) : null;
      delete s.preisalarm[op.k];
      if (a) s.preisalarm[op.k] = a;
      const alle = Object.keys(s.preisalarm);
      for (const k of alle.slice(0, Math.max(0, alle.length - MAX_ALARME))) delete s.preisalarm[k];
      return;
    }
    case 'sache': {
      if (!SACHE_ID.test(String(op.id))) return;
      const h = hausVon(s);
      const x = op.sache ? sacheBereinigen(op.sache) : null;
      delete h.sachen[op.id];
      if (x) h.sachen[op.id] = x;
      kappen(h.sachen, MAX_SACHEN);
      return;
    }
    case 'plan': {
      if (!PLAN_ID.test(String(op.id))) return;
      const h = hausVon(s);
      const p = op.plan ? planBereinigen(op.plan) : null;
      if (!p) { delete h.plaene[op.id]; delete h.stand[op.id]; return; }
      h.plaene[op.id] = p;
      // Aufgaben, die es nicht mehr gibt, fallen aus den Haken
      const st = h.stand[op.id];
      if (st) putzSetzen(h, op.id, { ...st, haken: st.haken.filter((id) => p.aufgaben.some((a) => a.id === id)) }, p, op.plan.at || jetzt(), op.plan.by || null);
      kappen(h.plaene, MAX_PLAENE);
      return;
    }
    case 'putzHaken': {
      const h = hausVon(s);
      const p = h.plaene[op.planId];
      if (!p || !TAG.test(String(op.datum)) || !p.aufgaben.some((a) => a.id === op.aufgabe)) return;
      const st = putzTag(h, op.planId, op.datum);
      if (!st) return;
      const haken = new Set(st.haken);
      if (op.an) haken.add(op.aufgabe); else haken.delete(op.aufgabe);
      putzSetzen(h, op.planId, { ...st, haken: p.aufgaben.map((a) => a.id).filter((id) => haken.has(id)) }, p, op.at, op.by);
      return;
    }
    case 'putzFertig': {
      const h = hausVon(s);
      const p = h.plaene[op.planId];
      if (!p || !TAG.test(String(op.datum))) return;
      const st = putzTag(h, op.planId, op.datum);
      if (!st) return;
      if (op.an) {
        const dran = new Set([...st.haken, ...aufgabenAm(p, op.datum).map((a) => a.id)]);
        h.stand[op.planId] = { ...st, haken: p.aufgaben.map((a) => a.id).filter((id) => dran.has(id)), fertig: st.fertig || { at: op.at, by: op.by }, verlauf: [...st.verlauf.filter((v) => v[0] !== op.datum), [op.datum, op.by || '']].slice(-6) };
      } else {
        h.stand[op.planId] = { ...st, haken: [], fertig: null, verlauf: st.verlauf.filter((v) => v[0] !== op.datum) };
      }
      return;
    }
    case 'todoApp': {
      const h = hausVon(s);
      h.todoApp = TODO_APP_ID.test(String(op.app)) ? op.app : '';
      return;
    }
    case 'todoWunsch': {
      const h = hausVon(s);
      if (!PERSON.test(String(op.name))) return;
      if (TODO_WUENSCHE.includes(op.art)) h.todoWunsch[op.name] = { art: op.art, at: op.at, name: PERSON.test(String(op.wie || '')) ? op.wie : op.name };
      else delete h.todoWunsch[op.name];
      return;
    }
    case 'einePerson': {
      const p = s.profil?.person;
      if (!p || op.name !== p || !PERSON.test(p)) return;
      const andere = Object.values(istObj(s.leute) ? s.leute : {}).map(String).filter((x) => x.toLowerCase() !== p.toLowerCase());
      if (!andere.length) return;
      namenErsetzen(s, new Set(andere.map((x) => x.toLowerCase())), p);
      s.leute = { [p.toLowerCase()]: p };
      return;
    }
    case 'person': {
      if (!PERSON.test(String(op.name))) return;
      if (!istObj(s.leute)) s.leute = {};
      const k = op.name.toLowerCase();
      // Eine eigene Liste (mit Person im Profil, Marielle) hat eine Person: Ein weiteres Gerät, auf dem sie
      // sich anders nennt („Marielli“), kommt nicht als Zweite dazu
      if (s.profil?.person && Object.keys(s.leute).length) return;
      if (!s.leute[k] && Object.keys(s.leute).length < 8) s.leute[k] = op.name;
      return;
    }
    case 'profil': {
      if (!istObj(op.teil)) return;
      if (!istObj(s.profil)) s.profil = {};
      const t = op.teil;
      if ('person' in t) { if (PERSON.test(String(t.person || ''))) s.profil.person = String(t.person).trim(); else delete s.profil.person; }
      if ('farbe' in t) { if (FARBEN.includes(t.farbe)) s.profil.farbe = t.farbe; else delete s.profil.farbe; }
      if ('ziel' in t) {
        const z = makrosBereinigen(t.ziel);
        if (z) s.profil.ziel = { ...z, by: op.by || null, at: op.at }; else delete s.profil.ziel;
      }
      if ('boxen' in t) {
        const b = boxenBereinigen(t.boxen);
        if (b) s.profil.boxen = b; else delete s.profil.boxen;
      }
      return;
    }
    case 'todoZiel': {
      const h = hausVon(s);
      if (!PERSON.test(String(op.name))) return;
      const z = zielBereinigen({ ...op.ziel, at: op.at });
      if (z) h.todoZiel[op.name] = z; else delete h.todoZiel[op.name];
      return;
    }
    case 'todoAn': {
      const h = hausVon(s);
      if (!PERSON.test(String(op.name))) return;
      if (op.an) h.todoAn[op.name] = op.at; else delete h.todoAn[op.name];
      return;
    }
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
      if (istObj(s.fehlt)) for (const k of Object.keys(s.fehlt)) if (!s.items[k]) delete s.fehlt[k];
      return;
    case 'leeren':
      s.items = {};
      s.fehlt = {};
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
      if (istObj(op.kochen)) {
        if (!istObj(s.kochen)) s.kochen = {};
        for (const [w, k] of Object.entries(op.kochen)) {
          const b = kochenName(w) && !s.kochen[kochenName(w)] && Object.keys(s.kochen).length < MAX_KOCHEN ? kochenBereinigen(k) : null;
          if (b) s.kochen[kochenName(w)] = b;
        }
      }
      if (istObj(op.fehlt)) {
        if (!istObj(s.fehlt)) s.fehlt = {};
        for (const [k, f] of Object.entries(op.fehlt)) if (SCHLUESSEL.test(k) && istObj(f) && s.items[k] && !s.fehlt[k]) s.fehlt[k] = { laden: LADEN_NAME.test(String(f.laden || '')) ? f.laden : '', at: text(f.at, 40) || '', by: text(f.by, 40) };
      }
      if (istObj(op.bons)) {
        if (!istObj(s.bons)) s.bons = {};
        for (const [k, liste] of Object.entries(op.bons)) {
          const b = SCHLUESSEL.test(k) && !s.bons[k] && Array.isArray(liste) ? liste.map(bonBereinigen).filter(Boolean).slice(-MAX_BONS_JE) : [];
          if (b.length) s.bons[k] = b;
        }
      }
      if (istObj(op.preisalarm)) {
        if (!istObj(s.preisalarm)) s.preisalarm = {};
        for (const [k, a] of Object.entries(op.preisalarm)) { const b = SCHLUESSEL.test(k) && !s.preisalarm[k] ? alarmBereinigen(a) : null; if (b) s.preisalarm[k] = b; }
      }
      if (istObj(op.profil)) {
        // Was die Liste schon festlegt, bleibt; was fehlt (eine ältere Fassung hat es weggeräumt), kommt dazu
        if (!istObj(s.profil)) s.profil = {};
        for (const [k, v] of Object.entries(profilBereinigen(op.profil))) if (!(k in s.profil)) s.profil[k] = v;
      }
      if (istObj(op.leute)) {
        if (!istObj(s.leute)) s.leute = {};
        for (const [k, n] of Object.entries(op.leute)) if (PERSON.test(String(n)) && k === String(n).toLowerCase() && !s.leute[k] && Object.keys(s.leute).length < 8) s.leute[k] = n;
      }
      if (istObj(op.haushalt) && hatHaushalt(op.haushalt)) {
        // Was es hier schon gibt, bleibt; Neues aus dem eigenen Stand kommt dazu
        const h = hausVon(s);
        const neu = haushaltBereinigen(op.haushalt);
        for (const [id, x] of Object.entries(neu.sachen)) if (!h.sachen[id] && Object.keys(h.sachen).length < MAX_SACHEN) h.sachen[id] = x;
        for (const [id, p] of Object.entries(neu.plaene)) {
          if (h.plaene[id] || Object.keys(h.plaene).length >= MAX_PLAENE) continue;
          h.plaene[id] = p;
          if (neu.stand[id]) h.stand[id] = neu.stand[id];
        }
        if (!h.todoApp && neu.todoApp) h.todoApp = neu.todoApp;
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
      if (istObj(s.fehlt) && s.fehlt[von]) {
        if (!s.fehlt[nach] && s.items[nach]) s.fehlt[nach] = s.fehlt[von];
        delete s.fehlt[von];
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
    case 'kochen': {
      const w = kochenName(op.wer);
      if (!w || !istObj(op.stand) || !text(op.at, 40)) return;
      if (!istObj(s.kochen)) s.kochen = {};
      const alt = s.kochen[w];
      // Wer zuletzt etwas geändert hat, gewinnt – eine ältere Fassung kommt nicht mehr drüber
      if (alt && String(alt.at) > String(op.at)) return;
      if (!alt && Object.keys(s.kochen).length >= MAX_KOCHEN) return;
      const b = kochenBereinigen({ ...op.stand, at: op.at });
      if (b) s.kochen[w] = b;
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
