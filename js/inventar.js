/*
 * Sachen in eigenen Listen – Kleidung, Make-up, Schmuck, was jemand will –,
 * ohne DOM (tests/test-inventar.mjs prüft es in Node). Zu sehen ist es nur in
 * einer eigenen Liste (Marielle), im Teil „Sachen“ ihres Bereichs
 * (ansicht-inventar.js). In liste.json unter `inventar`:
 *
 *   { listen: { 'sl-…': { id, name, bild, reihe, at, geaendert, by } },
 *     dinge:  { 'sd-…': { id, liste, name, marke, notiz, tags, code, foto, quelle, reihe, at, geaendert, by } } }
 *
 * bild ist das Bildchen der Liste (Fluent Emoji, INVENTAR_BILDER in
 * bilder.js), reihe die eigene Reihenfolge (kleinere zuerst), code die Nummer
 * unter dem Strichcode (EAN, UPC). foto ist { pfad, sha }: Das Foto liegt als
 * eigene Datei im Daten-Repo (sachen/sd-…-….jpg), damit liste.json klein
 * bleibt – ansicht-inventar.js lädt es hoch und holt es mit dem Schlüssel.
 * quelle ist { name, url } oder null: wo die App Name, Marke und Bild zum
 * Strichcode gefunden hat (inventar-netz.js) – etwa Open Beauty Facts.
 *
 * Wie die Notizblätter wird eine Liste oder eine Sache immer ganz geschrieben;
 * eine noch nicht gesendete Fassung ersetzt die vorige (ersetzt), und eine
 * ältere kommt nicht über eine neuere (geaendert). Wird eine Liste gelöscht,
 * gehen ihre Sachen mit – außer eine wurde danach woanders noch geändert: Die
 * steht dann unter „Ohne Liste“, statt verloren zu gehen.
 */
import { tagsBereinigen } from './amy.js';
import { INVENTAR_BILDER } from './bilder.js';

export const LISTE_ID = /^sl-[a-z0-9]{4,24}$/;
export const DING_ID = /^sd-[a-z0-9]{4,24}$/;
export const FOTO_PFAD = /^sachen\/sd-[a-z0-9]{4,24}-[a-z0-9]{2,12}\.jpg$/;
export const MAX_LISTEN = 30;
export const MAX_DINGE = 400;
export const MAX_NAME = 80;
export const MAX_MARKE = 60;
export const MAX_NOTIZ = 2000;
export const MAX_QUELLE = 60;
/** Zum Anfangen – antippen legt die Liste an. */
export const LISTEN_VORSCHLAEGE = [['Kleidung', 'womans-clothes'], ['Schuhe', 'high-heeled-shoe'], ['Make-up', 'lipstick'], ['Pflege', 'lotion-bottle'], ['Schmuck', 'ring'], ['Taschen', 'handbag'], ['Bücher', 'books']];
/** Wie eine Liste sortiert sein kann – die Wahl merkt sich das Gerät je Liste. */
export const SORTEN = [['eigen', 'Eigene Reihenfolge'], ['name', 'Name A–Z'], ['neu', 'Neueste zuerst'], ['marke', 'Nach Marke'], ['tags', 'Nach Tags']];

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const jetzt = () => new Date().toISOString();
const kurz = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const einzeilig = (v, max) => kurz(v, max).replace(/[\p{Cc}]+/gu, ' ');
const reiheVon = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const zufall = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0');

export const neueListeId = () => `sl-${Date.now().toString(36)}${zufall()}`;
export const neueDingId = () => `sd-${Date.now().toString(36)}${zufall()}`;
/** Wohin ein neues Foto einer Sache kommt – jedes Foto mit eigenem Namen, so bleibt das alte gültig, bis das neue da ist. */
export const fotoPfad = (id) => `sachen/${id}-${Date.now().toString(36).slice(-6)}${zufall()}.jpg`;

/* ------------------------------------------------------------- Strichcode */

/** Die Nummer unter dem Strichcode: nur Ziffern und Buchstaben, höchstens 32. */
export const codeBereinigen = (v) => ((typeof v === 'string' || typeof v === 'number') ? String(v).replace(/[^0-9A-Za-z]/g, '').slice(0, 32) : '');

/** Stimmt die Prüfziffer (EAN-8, UPC-A, EAN-13, GTIN-14)? Von rechts abwechselnd ×3 und ×1. */
export function eanOk(code) {
  const c = String(code || '');
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(c)) return false;
  const z = [...c].map(Number);
  const pruef = z.pop();
  const summe = z.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (summe % 10)) % 10 === pruef;
}

/* ------------------------------------------------------------- Bereinigen */

export function fotoBereinigen(f) {
  if (!istObj(f) || !FOTO_PFAD.test(String(f.pfad))) return null;
  return { pfad: f.pfad, sha: kurz(f.sha, 64) };
}

/** Woher Name, Marke oder Bild kamen: { name, url } – nur mit Namen und einer https-Adresse, sonst null. */
export function quelleBereinigen(q) {
  if (!istObj(q)) return null;
  const name = einzeilig(q.name, MAX_QUELLE).trim();
  let url = '';
  try {
    const u = new URL(String(q.url || ''));
    if (u.protocol === 'https:' && u.href.length <= 300) url = u.href;
  } catch { /* ohne Adresse keine Quelle */ }
  return name && url ? { name, url } : null;
}

export function listeBereinigen(l) {
  if (!istObj(l) || !LISTE_ID.test(String(l.id))) return null;
  const at = kurz(l.at, 40) || jetzt();
  return {
    id: l.id,
    name: einzeilig(l.name, MAX_NAME),
    bild: INVENTAR_BILDER.includes(l.bild) ? l.bild : 'package',
    reihe: reiheVon(l.reihe),
    at,
    geaendert: kurz(l.geaendert, 40) || at,
    by: kurz(l.by, 40) || null,
  };
}

export function dingBereinigen(d) {
  if (!istObj(d) || !DING_ID.test(String(d.id))) return null;
  const at = kurz(d.at, 40) || jetzt();
  return {
    id: d.id,
    liste: LISTE_ID.test(String(d.liste)) ? d.liste : null,
    name: einzeilig(d.name, MAX_NAME),
    marke: einzeilig(d.marke, MAX_MARKE),
    notiz: kurz(d.notiz, MAX_NOTIZ),
    tags: tagsBereinigen(d.tags),
    code: codeBereinigen(d.code),
    foto: fotoBereinigen(d.foto),
    quelle: quelleBereinigen(d.quelle),
    reihe: reiheVon(d.reihe),
    at,
    geaendert: kurz(d.geaendert, 40) || at,
    by: kurz(d.by, 40) || null,
  };
}

/** Nur aus einer von Hand bearbeiteten Datei kann es mehr geben – dann die neuesten. */
const neueste = (o, max) => Object.fromEntries(Object.values(o).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, max).map((v) => [v.id, v]));

export const leerInventar = () => ({ listen: {}, dinge: {} });

export function inventarBereinigen(x) {
  const s = leerInventar();
  if (!istObj(x)) return s;
  for (const [id, l] of Object.entries(istObj(x.listen) ? x.listen : {})) { const r = listeBereinigen({ ...l, id }); if (r) s.listen[id] = r; }
  for (const [id, d] of Object.entries(istObj(x.dinge) ? x.dinge : {})) { const r = dingBereinigen({ ...d, id }); if (r) s.dinge[id] = r; }
  return { listen: neueste(s.listen, MAX_LISTEN), dinge: neueste(s.dinge, MAX_DINGE) };
}

export const hatInventar = (x) => !!x && (Object.keys(x.listen || {}).length > 0 || Object.keys(x.dinge || {}).length > 0);

/* ------------------------------------------------------------- Änderungen */

/** Eine Liste anlegen oder ändern – immer ganz: { id, name, bild, reihe }. */
export const opInvListe = (l, by, at = jetzt()) => ({ typ: 'invListe', l: { id: l.id, name: einzeilig(l.name, MAX_NAME), bild: l.bild, reihe: reiheVon(l.reihe) }, by: by || null, at, ersetzt: `invListe:${l.id}` });
export const opInvListeWeg = (id, at = jetzt()) => ({ typ: 'invListeWeg', id, at });
/** Eine Sache anlegen oder ändern – immer ganz: { id, liste, name, marke, notiz, tags, code, foto, quelle, reihe }. */
export const opDing = (d, by, at = jetzt()) => ({
  typ: 'ding',
  d: { id: d.id, liste: d.liste || null, name: einzeilig(d.name, MAX_NAME), marke: einzeilig(d.marke, MAX_MARKE), notiz: kurz(d.notiz, MAX_NOTIZ), tags: tagsBereinigen(d.tags), code: codeBereinigen(d.code), foto: fotoBereinigen(d.foto), quelle: quelleBereinigen(d.quelle), reihe: reiheVon(d.reihe) },
  by: by || null,
  at,
  ersetzt: `ding:${d.id}`,
});
export const opDingWeg = (id, at = jetzt()) => ({ typ: 'dingWeg', id, at });

export function inventarAnwenden(s, op) {
  if (!istObj(s.inventar) || !istObj(s.inventar.listen) || !istObj(s.inventar.dinge)) s.inventar = inventarBereinigen(s.inventar);
  const { listen, dinge } = s.inventar;
  if (op.typ === 'invListe') {
    const id = op.l?.id;
    if (!LISTE_ID.test(String(id))) return;
    const alt = listen[id];
    // Eine ältere Fassung (etwa von einem Handy, das offline war) kommt nicht über eine neuere
    if (alt && String(alt.geaendert) > String(op.at)) return;
    if (!alt && Object.keys(listen).length >= MAX_LISTEN) return;
    const l = listeBereinigen({ ...op.l, at: alt?.at || op.at, geaendert: op.at, by: op.by });
    if (l) listen[id] = l;
    return;
  }
  if (op.typ === 'invListeWeg') {
    const alt = listen[op.id];
    if (alt && String(alt.geaendert) <= String(op.at || '')) delete listen[op.id];
    // Ihre Sachen gehen mit – außer eine wurde danach noch geändert (die steht dann unter „Ohne Liste“)
    for (const d of Object.values(dinge)) if (d.liste === op.id && String(d.geaendert) <= String(op.at || '')) delete dinge[d.id];
    return;
  }
  if (op.typ === 'ding') {
    const id = op.d?.id;
    if (!DING_ID.test(String(id))) return;
    const alt = dinge[id];
    if (alt && String(alt.geaendert) > String(op.at)) return;
    if (!alt && Object.keys(dinge).length >= MAX_DINGE) return;
    const d = dingBereinigen({ ...op.d, at: alt?.at || op.at, geaendert: op.at, by: op.by });
    if (d) dinge[id] = d;
    return;
  }
  if (op.typ === 'dingWeg') {
    const alt = dinge[op.id];
    // Wurde sie danach woanders noch geändert, bleibt sie
    if (alt && String(alt.geaendert) <= String(op.at || '')) delete dinge[op.id];
  }
}

/** Was fehlt, kommt dazu (Rückgängig, und was eine ältere App-Fassung weggelassen hat); Vorhandenes bleibt. */
export function inventarZusammen(s, x) {
  const neu = inventarBereinigen(x);
  if (!hatInventar(neu)) return;
  if (!istObj(s.inventar) || !istObj(s.inventar.listen) || !istObj(s.inventar.dinge)) s.inventar = inventarBereinigen(s.inventar);
  for (const [id, l] of Object.entries(neu.listen)) if (!s.inventar.listen[id] && Object.keys(s.inventar.listen).length < MAX_LISTEN) s.inventar.listen[id] = l;
  for (const [id, d] of Object.entries(neu.dinge)) if (!s.inventar.dinge[id] && Object.keys(s.inventar.dinge).length < MAX_DINGE) s.inventar.dinge[id] = d;
}

/* ------------------------------------------------- Ordnen, Suchen, Finden */

const nachReihe = (a, b) => (reiheVon(a.reihe) - reiheVon(b.reihe)) || String(a.at).localeCompare(String(b.at));
const klein = (v) => String(v || '').toLocaleLowerCase('de');
const nachName = (a, b) => klein(a.name).localeCompare(klein(b.name), 'de') || nachReihe(a, b);

/** Die Listen in ihrer Reihenfolge. */
export const listenVon = (inv) => Object.values(inv?.listen || {}).sort(nachReihe);

/** Die Sachen einer Liste – mit null die ohne Liste (deren Liste es nicht mehr gibt). */
export function dingeIn(inv, listeId) {
  const listen = inv?.listen || {};
  return Object.values(inv?.dinge || {}).filter((d) => (listeId ? d.liste === listeId : !d.liste || !listen[d.liste]));
}

/** Die nächste Zahl für die eigene Reihenfolge – neue kommen ans Ende. */
export const naechsteReihe = (xs) => (xs || []).reduce((m, x) => Math.max(m, reiheVon(x.reihe)), 0) + 1;

/** Sortiert nach SORTEN (bei „Nach Tags“ nach Namen – die Abschnitte macht die Ansicht). */
export function sortiert(xs, sort = 'eigen') {
  const a = [...(xs || [])];
  if (sort === 'name' || sort === 'tags') return a.sort(nachName);
  if (sort === 'neu') return a.sort((x, y) => String(y.at).localeCompare(String(x.at)) || nachName(x, y));
  // Ohne Marke ans Ende
  if (sort === 'marke') return a.sort((x, y) => (!x.marke - !y.marke) || klein(x.marke).localeCompare(klein(y.marke), 'de') || nachName(x, y));
  return a.sort(nachReihe);
}

/** Alle Tags dieser Sachen: [[Tag, Anzahl]], häufigste zuerst. */
export function tagsVon(xs) {
  const je = new Map();
  for (const d of xs || []) {
    for (const t of d.tags || []) {
      const e = je.get(klein(t)) || [t, 0];
      e[1] += 1;
      je.set(klein(t), e);
    }
  }
  return [...je.values()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'));
}

export const mitTag = (xs, tag) => (tag ? (xs || []).filter((d) => (d.tags || []).some((t) => klein(t) === klein(tag))) : [...(xs || [])]);

/** Suchen über alle Listen: Name, Marke, Notiz, Tags und Code – nach Namen sortiert. */
export function suchen(inv, text) {
  const q = klein(text).trim();
  if (!q) return [];
  return Object.values(inv?.dinge || {}).filter((d) => [d.name, d.marke, d.notiz, d.code, ...(d.tags || [])].some((f) => klein(f).includes(q))).sort(nachName);
}

/** Welche Sachen diese Nummer tragen („Hab ich das schon?“). */
export function mitCode(inv, code) {
  const c = codeBereinigen(code);
  return c ? Object.values(inv?.dinge || {}).filter((d) => d.code === c).sort(nachName) : [];
}

/** Nichts eingetragen – eine neue, leere Sache verschwindet wieder, wenn man sie verlässt. */
export const dingLeer = (d) => !d || (!String(d.name || '').trim() && !String(d.marke || '').trim() && !String(d.notiz || '').trim() && !(d.tags || []).length && !d.code && !d.foto);

/** Name fürs Anzeigen – ohne Namen die Marke. */
export const dingName = (d) => String(d?.name || '').trim() || String(d?.marke || '').trim() || 'Ohne Namen';

/**
 * Eins nach oben (-1) oder unten (+1) in der eigenen Reihenfolge: die
 * Einträge mit neuer reihe (durchnummeriert ab 1) – nur die, deren Zahl sich
 * ändert. null, wenn es nicht weiter geht.
 */
export function verschieben(xs, id, richtung) {
  const reihe = [...(xs || [])].sort(nachReihe);
  const i = reihe.findIndex((x) => x.id === id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= reihe.length) return null;
  [reihe[i], reihe[j]] = [reihe[j], reihe[i]];
  return reihe.map((x, k) => ({ ...x, reihe: k + 1 })).filter((x) => reiheVon((xs.find((y) => y.id === x.id) || {}).reihe) !== x.reihe);
}
