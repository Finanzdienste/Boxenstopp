/*
 * Die Speisekammer – was zu Hause da ist (Marielle, 20.11.2026: „alles einmal
 * einspeichern, und dann behält er die Sachen“). Ohne DOM, tests/test-
 * speisekammer.mjs prüft es in Node. In liste.json unter `speisekammer`:
 *
 *   { <Schlüssel>: { k, name, cat, q, u, bald, at, geaendert, by } }
 *
 * Der Schlüssel ist derselbe wie auf der Einkaufsliste: der Katalog-Schlüssel
 * (`haehnchenbrust`), für Amys Zutaten `amyz-…`, für Getipptes `n:…`. q ist
 * die Menge in der Einheit u (g, ml, Stk, Dose …) – oder null: „ist da“, wie
 * viel weiß die App nicht. bald: jemand hat „muss bald weg“ angetippt. at:
 * seit wann es da ist (für „seit 5 Tagen“ bei Frischem).
 *
 * Damit sie niemand von Hand pflegen muss, läuft das meiste von selbst:
 *   - Abhaken auf der Einkaufsliste legt hinein, was gekauft wurde – ganze
 *     Packungen (gekauftVon, wie reste.js sie rechnet); der Haken zurück
 *     nimmt es wieder heraus.
 *   - „Heute gekocht“ zieht ab, was das Rezept braucht (verbrauchtVon). Was
 *     dabei auf null geht, ist weg; was ohne Menge da ist, bleibt.
 *   - Von Hand: tippen („500 g Hackfleisch“), ein Foto (die KI liest ab,
 *     kammer-ki.js), den Strichcode scannen (Open Food Facts, kammerAusProdukt),
 *     „ist alle“ und „muss bald weg“.
 * Die Resteverwertung (ansicht-ki.js) nimmt, was da ist – angetippt zuerst.
 * Auf der Einkaufsliste steht dabei, was ihr noch habt (ansicht-liste.js).
 */
import { restVon, verdirbt } from './reste.js';

export const MAX_KAMMER = 300;
export const KAMMER_SCHLUESSEL = /^[A-Za-z0-9_.~:@+-]{1,120}$/;
/** Ab so vielen Tagen meldet sich Frisches (Fleisch, Kühlregal, Obst und Gemüse) von selbst als „muss bald weg“. */
export const FRISCH_TAGE = 4;
/** Was nicht in die Speisekammer gehört, auch wenn es auf der Einkaufsliste steht. */
const NICHT_ESSEN = new Set(['haushalt', 'amazon']);

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const istZahl = (v) => typeof v === 'number' && Number.isFinite(v);
const kurz = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const jetzt = () => new Date().toISOString();
const rund = (q) => Math.round(q * 100) / 100;

export function eintragBereinigen(e, k = e?.k) {
  if (!istObj(e) || !KAMMER_SCHLUESSEL.test(String(k || ''))) return null;
  const name = kurz(e.name, 80);
  if (!name) return null;
  const at = kurz(e.at, 40) || jetzt();
  const q = istZahl(e.q) && e.q > 0 && e.q < 1e6 ? rund(e.q) : null;
  return {
    k,
    name,
    cat: kurz(e.cat, 20) || 'sonstiges',
    q,
    u: q === null ? '' : kurz(e.u, 12),
    bald: e.bald === true,
    at,
    geaendert: kurz(e.geaendert, 40) || at,
    by: kurz(e.by, 40) || null,
  };
}

/** Höchstens MAX_KAMMER – sonst die zuletzt geänderten. */
function begrenzen(o) {
  const alle = Object.values(o);
  if (alle.length <= MAX_KAMMER) return o;
  alle.sort((a, b) => String(b.geaendert).localeCompare(String(a.geaendert)));
  return Object.fromEntries(alle.slice(0, MAX_KAMMER).map((e) => [e.k, e]));
}

export function speisekammerBereinigen(x) {
  if (!istObj(x)) return {};
  const aus = {};
  for (const [k, e] of Object.entries(x)) {
    const b = eintragBereinigen({ ...(istObj(e) ? e : {}), k }, k);
    if (b) aus[k] = b;
  }
  return begrenzen(aus);
}

/* ------------------------------------------------------------- Änderungen */

/** Einen Eintrag setzen – immer ganz: { k, name, cat, q, u, bald }. Ein älterer kommt nicht über einen neueren. */
export const opKammer = (e, by, at = jetzt()) => ({ typ: 'kammer', e: { k: e.k, name: kurz(e.name, 80), cat: kurz(e.cat, 20), q: istZahl(e.q) ? e.q : null, u: kurz(e.u, 12), bald: e.bald === true }, by: by || null, at, ersetzt: `kammer:${e.k}` });
/** „Ist alle“. */
export const opKammerWeg = (k, at = jetzt()) => ({ typ: 'kammerWeg', k, at });
/**
 * Mengen dazu (r 1: gekauft, hineingetippt) oder ab (r -1: gekocht, Haken
 * zurück). posten: [{ k, name, cat, q, u }], q null: „ist da“ ohne Menge.
 */
export const opKammerMenge = (posten, r, by, at = jetzt()) => ({
  typ: 'kammerMenge',
  posten: (Array.isArray(posten) ? posten : []).filter((p) => p && KAMMER_SCHLUESSEL.test(String(p.k || ''))).map((p) => ({ k: p.k, name: kurz(p.name, 80), cat: kurz(p.cat, 20), q: istZahl(p.q) && p.q > 0 ? rund(p.q) : null, u: kurz(p.u, 12) })),
  r: r < 0 ? -1 : 1,
  by: by || null,
  at,
});

export function kammerAnwenden(s, op) {
  if (!istObj(s.speisekammer)) s.speisekammer = {};
  const kammer = s.speisekammer;
  if (op.typ === 'kammer') {
    const k = op.e?.k;
    if (!KAMMER_SCHLUESSEL.test(String(k || ''))) return;
    const alt = kammer[k];
    if (alt && String(alt.geaendert) > String(op.at)) return;
    const e = eintragBereinigen({ ...op.e, at: alt?.at || op.at, geaendert: op.at, by: op.by }, k);
    if (e) { kammer[k] = e; s.speisekammer = begrenzen(kammer); }
    return;
  }
  if (op.typ === 'kammerWeg') {
    const alt = kammer[op.k];
    if (alt && String(alt.geaendert) <= String(op.at || '')) delete kammer[op.k];
    return;
  }
  if (op.typ !== 'kammerMenge' || !Array.isArray(op.posten)) return;
  for (const p of op.posten) {
    const alt = kammer[p.k];
    if (op.r > 0) {
      if (!alt) {
        const e = eintragBereinigen({ ...p, bald: false, at: op.at, geaendert: op.at, by: op.by }, p.k);
        if (e) kammer[p.k] = e;
        continue;
      }
      // Gleiche Einheit: dazuzählen; sonst (oder ohne Menge) bleibt, was dasteht – es ist ja da
      if (alt.q !== null && istZahl(p.q) && p.u === alt.u) alt.q = rund(alt.q + p.q);
      alt.geaendert = op.at;
      alt.by = op.by;
      continue;
    }
    // Ein Haken zurück auf etwas ohne Menge: doch nicht gekauft
    if (alt && alt.q === null && p.q === null) { delete kammer[p.k]; continue; }
    if (!alt || alt.q === null || !istZahl(p.q) || p.u !== alt.u) continue;
    const rest = rund(alt.q - p.q);
    // Was nur noch ein Krümel ist (unter 2 % dessen, was abgezogen wurde), ist auch weg
    if (rest <= Math.max(0.001, p.q * 0.02)) delete kammer[p.k];
    else { alt.q = rest; alt.geaendert = op.at; alt.by = op.by; }
  }
  s.speisekammer = begrenzen(kammer);
}

/** Von einem anderen Stand: was hier fehlt, kommt dazu. */
export function kammerZusammen(s, x) {
  const neu = speisekammerBereinigen(x);
  if (!Object.keys(neu).length) return;
  if (!istObj(s.speisekammer)) s.speisekammer = {};
  for (const [k, e] of Object.entries(neu)) if (!s.speisekammer[k]) s.speisekammer[k] = e;
  s.speisekammer = begrenzen(s.speisekammer);
}

/* ------------------------------------------------------- Einkauf, Kochen */

/** Der Name ohne Packungsangabe: „Kokosmilch, Dose à 400 ml“ → „Kokosmilch“. */
export const nameVon = (k, name, katalog = {}) => String(katalog[k]?.n || kurz(name, 80) || k).split(',')[0].trim() || k;

/**
 * Was ein Haken auf der Einkaufsliste in die Speisekammer legt: die Teile
 * (rids) der Zeile k, auf ganze Packungen gerundet (reste.js restVon – 125 g
 * Hack gebraucht, 500 g gekauft). Text-Teile („2 EL“) und eigene Einträge
 * ohne Menge: „ist da“. Haushaltssachen nicht.
 * daten: { preise, katalog } wie bei reste.js.
 */
export function gekauftVon(k, d, rids, daten = {}) {
  if (!istObj(d)) return [];
  const katalog = daten.katalog || {};
  const cat = katalog[k]?.c || d.cat || 'sonstiges';
  if (NICHT_ESSEN.has(cat)) return [];
  const name = nameVon(k, d.name, katalog);
  const teile = Object.entries(istObj(d.parts) ? d.parts : {}).filter(([rid, p]) => istObj(p) && (rids === null || rids.includes(rid))).map(([, p]) => p);
  const mitMenge = teile.filter((p) => istZahl(p.q) && p.q > 0 && typeof p.u === 'string' && p.u);
  if (!mitMenge.length) return (teile.length || d.custom) ? [{ k, name, cat, q: null, u: '' }] : [];
  const posten = mitMenge.map((p) => ({ k, q: p.q, u: p.u, h: p.h || '' }));
  const nachEinheit = new Map();
  for (const p of posten) nachEinheit.set(p.u, (nachEinheit.get(p.u) || 0) + p.q);
  const packungen = new Map(restVon(posten, daten).map((x) => [x.u, x.packs * x.pack]));
  return [...nachEinheit].map(([u, q]) => ({ k, name, cat, q: rund(packungen.get(u) || q), u }));
}

/** Was „Heute gekocht“ abzieht: die Zutaten des Rezepts (gerechnet, wie es gerade steht). */
export function verbrauchtVon(r, katalog = {}) {
  // Auch, was nicht auf die Einkaufsliste kommt (Öl, Gewürze aus dem Vorrat) – nur nicht das Optionale
  return (Array.isArray(r?.items) ? r.items : []).filter((z) => z && z.k && !z.opt && istZahl(z.q) && z.q > 0 && z.u)
    .map((z) => ({ k: z.k, name: nameVon(z.k, z.n, katalog), cat: katalog[z.k]?.c || z.kat?.c || 'sonstiges', q: z.q, u: z.u }));
}

/* ----------------------------------------------------------------- Lesen */

export const alterTage = (e, heute = new Date()) => {
  const t = Date.parse(e?.at || '');
  return Number.isFinite(t) ? Math.max(0, Math.floor((heute.getTime() - t) / 864e5)) : 0;
};

/** Muss bald weg: angetippt – oder Frisches, das schon FRISCH_TAGE da ist. */
export const mussBaldWeg = (e, katalog = {}, heute = new Date()) => !!e && (e.bald === true || ((verdirbt(e.k, katalog) || (!katalog[e.k] && ['fleisch', 'kuehl', 'obst'].includes(e.cat))) && alterTage(e, heute) >= FRISCH_TAGE));

/** Die Reihenfolge in der Ansicht: was weg muss zuerst, dann nach Abteilung, dann nach Name. */
const REIHE = ['fleisch', 'kuehl', 'obst', 'tk', 'trocken', 'konserven', 'vorrat', 'gewuerz', 'sonstiges'];
export function kammerListe(kammer, katalog = {}, heute = new Date()) {
  return Object.values(istObj(kammer) ? kammer : {}).map((e) => ({ ...e, weg: mussBaldWeg(e, katalog, heute) }))
    .sort((a, b) => (b.weg - a.weg) || ((REIHE.indexOf(a.cat) + 1 || 99) - (REIHE.indexOf(b.cat) + 1 || 99)) || a.name.localeCompare(b.name, 'de'));
}

/** „375 g“, „2 Dosen“ – oder '' ohne Menge. */
export function mengeKurz(e) {
  if (!e || e.q === null) return '';
  const q = e.q >= 100 ? Math.round(e.q) : Math.round(e.q * 10) / 10;
  const z = String(q).replace('.', ',');
  if (e.u === 'g' && e.q >= 1000) return `${String(Math.round(e.q / 100) / 10).replace('.', ',')} kg`;
  if (e.u === 'ml' && e.q >= 1000) return `${String(Math.round(e.q / 100) / 10).replace('.', ',')} l`;
  return `${z} ${e.u}`;
}

/**
 * Für die KI (Resteverwertung): was da ist, als Text. markiert: diese
 * Schlüssel sollen auf jeden Fall hinein; dazu, was bald weg muss.
 */
export function kammerText(kammer, markiert = [], katalog = {}, heute = new Date()) {
  const liste = kammerListe(kammer, katalog, heute);
  const zeile = (e) => [mengeKurz(e), e.name].filter(Boolean).join(' ');
  const muss = liste.filter((e) => markiert.includes(e.k));
  const bald = liste.filter((e) => !markiert.includes(e.k) && e.weg);
  const rest = liste.filter((e) => !markiert.includes(e.k) && !e.weg);
  return [
    muss.length ? `Unbedingt verwenden: ${muss.map(zeile).join(', ')}` : '',
    bald.length ? `${muss.length ? 'Wenn es passt, auch' : 'Am besten verwenden (muss bald weg)'}: ${bald.map(zeile).join(', ')}` : '',
    rest.length ? `Außerdem in der Speisekammer: ${rest.map(zeile).join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

/** Was auf der Einkaufsliste schon zu Hause ist: Schlüssel → Eintrag (nur, was noch nicht abgehakt ist, entscheidet die Ansicht). */
export const zuHause = (kammer, k) => (istObj(kammer) && istObj(kammer[k]) ? kammer[k] : null);
