/*
 * Amys Sachen als eigene Datei – sachen.json im privaten Daten-Repo
 * (Boxenstopp-Daten, neben liste.json). Seit v83 sind die Sachen eine eigene
 * App (sachen/, https://finanzdienste.github.io/Boxenstopp/sachen/); vorher
 * standen sie in liste.json unter `inventar`. Ohne DOM – tests/test-sachen.mjs
 * und tests/test-umzug.mjs prüfen es in Node.
 *
 *   { "version": 1, "rev": 7,
 *     "inventar": { "listen": { "sl-…": … }, "dinge": { "sd-…": … } },
 *     "weg": { "sd-…": "2026-11-15T09:00:00.000Z" } }
 *
 * inventar hat dasselbe Format wie in liste.json (inventar.js), die Fotos
 * bleiben, wo sie sind (sachen/sd-…-….jpg im selben Repo). rev zählt jedes
 * Schreiben um 1 hoch, wie bei liste.json. weg merkt sich, was gelöscht ist
 * und wann (höchstens MAX_WEG, die neuesten): Eine ältere Fassung einer
 * Sache – von einem Gerät, das offline war, oder aus liste.json, wo eine
 * ältere App-Fassung sie wieder hingeschrieben hat – kommt dann nicht zurück.
 *
 * Abgeglichen wird mit derselben Maschine wie liste.json (speicher.js github()
 * mit ART_SACHEN): Änderungen als Objekte aus inventar.js, ein Commit nach
 * ~0,7 s, 409 → neu holen und noch einmal, rev. Die Commit-Nachricht sagt nur
 * „Amy: Sachen, 2 Änderungen“ – nie, was es ist, ohne „· Bescheid“ und
 * „· To Do“ (keine Push-Nachricht, kein To Do).
 *
 * Der Umzug (umzugZusammen, umzugInSachen): Was in liste.json noch unter
 * inventar steht, kommt nach sachen.json – je Liste und Sache nach id, die
 * neuere Fassung (geaendert) gewinnt, Gelöschtes (weg) bleibt gelöscht.
 * Danach nimmt Boxenstopp genau das Umgezogene aus liste.json (inventar.js
 * opUmgezogen). Beides geht beliebig oft ohne Schaden: Schreibt eine ältere
 * App-Fassung die Sachen zurück, zieht das nächste Gerät mit der neuen
 * Fassung sie wieder um. Die Sachen-App führt nur zusammen (liest liste.json,
 * schreibt sie nie); aus liste.json nimmt sie Boxenstopp (app.js).
 */
import { inventarBereinigen, inventarAnwenden, inventarZusammen, leerInventar, hatInventar, LISTE_ID, DING_ID, MAX_LISTEN, MAX_DINGE } from './inventar.js';
import { API, DATEN, privatLesen, privatSchreiben } from './speicher.js';

export const SACHEN_PFAD = 'sachen.json';
/** Wo sachen.json liegt: im Repo der gemeinsamen Liste von Tobi und Amy. */
export const SACHEN_ORT = { owner: DATEN.owner, repo: DATEN.repo, pfad: SACHEN_PFAD };
/** So viele Löschungen merkt sich die Datei (die neuesten). */
export const MAX_WEG = 1000;
/** Commits des Umzugs beginnen so – im Dashboard ein Ablauf, niemandes Arbeit (gaeste.js AUTOMATIK). */
export const UMZUG = 'Umzug';

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const klon = (x) => JSON.parse(JSON.stringify(x));
const jetzt = () => new Date().toISOString();

export const leerSachen = () => ({ version: 1, rev: 0, inventar: leerInventar(), weg: {} });

function wegBereinigen(w) {
  if (!istObj(w)) return {};
  const e = Object.entries(w).filter(([id, at]) => (LISTE_ID.test(id) || DING_ID.test(id)) && typeof at === 'string' && at.length > 0 && at.length <= 40);
  return Object.fromEntries(e.sort((a, b) => b[1].localeCompare(a[1])).slice(0, MAX_WEG));
}

/** sachen.json, wie sie kam (von Hand bearbeitet, kaputt, fehlt) → ein sauberer Stand. */
export function sachenBereinigen(roh) {
  const s = leerSachen();
  if (!istObj(roh)) return s;
  const rev = Number(roh.rev);
  s.rev = Number.isFinite(rev) && rev >= 0 ? Math.floor(rev) : 0;
  s.inventar = inventarBereinigen(roh.inventar);
  s.weg = wegBereinigen(roh.weg);
  return s;
}

const geloescht = (s, id, at) => {
  const a = String(at || '') || jetzt();
  if (!s.weg[id] || s.weg[id] < a) s.weg[id] = a;
};

function aendere(s, op) {
  if (!istObj(op)) return;
  const at = String(op.at || '');
  switch (op.typ) {
    case 'invListe':
    case 'ding': {
      const id = op.typ === 'ding' ? op.d?.id : op.l?.id;
      // Nach dieser Fassung gelöscht (sie kommt von einem Gerät, das offline war): bleibt gelöscht
      if (s.weg[id] && at <= s.weg[id]) return;
      inventarAnwenden(s, op);
      if ((op.typ === 'ding' ? s.inventar.dinge : s.inventar.listen)[id]) delete s.weg[id];
      return;
    }
    case 'dingWeg':
      inventarAnwenden(s, op);
      if (!s.inventar.dinge[op.id] && DING_ID.test(String(op.id))) geloescht(s, op.id, at);
      return;
    case 'invListeWeg': {
      const vorher = Object.keys(s.inventar.dinge);
      inventarAnwenden(s, op);
      if (!s.inventar.listen[op.id] && LISTE_ID.test(String(op.id))) geloescht(s, op.id, at);
      // Ihre Sachen gingen mit – auch die sind gelöscht
      for (const id of vorher) if (!s.inventar.dinge[id]) geloescht(s, id, at);
      return;
    }
    case 'zusammen': {
      // Rückgängig (ansicht-inventar.js schickt opZusammen mit inventar und at = die Zeit der Löschung, die es
      // zurücknimmt): was fehlt, kommt wieder – und ist nicht mehr gelöscht. Hat danach jemand anderes es noch
      // einmal gelöscht (ein Gerät war offline, Grabstein neuer als at), bleibt es weg.
      if (!istObj(op.inventar)) return;
      const spaeter = (id) => !!(at && s.weg[id] && s.weg[id] > at);
      const nur = (xs) => Object.fromEntries(Object.entries(istObj(xs) ? xs : {}).filter(([id]) => !spaeter(id)));
      const inv = { listen: nur(op.inventar.listen), dinge: nur(op.inventar.dinge) };
      inventarZusammen(s, inv);
      for (const id of [...Object.keys(inv.listen), ...Object.keys(inv.dinge)]) {
        if (s.inventar.listen[id] || s.inventar.dinge[id]) delete s.weg[id];
      }
      return;
    }
    default:
  }
}

/** Neuer Stand mit einer Änderung (oder einer Liste davon); der alte bleibt, wie er war. */
export function sachenAnwenden(stand, op) {
  const s = klon(istObj(stand) ? stand : leerSachen());
  if (!istObj(s.inventar) || !istObj(s.inventar.listen) || !istObj(s.inventar.dinge)) s.inventar = inventarBereinigen(s.inventar);
  if (!istObj(s.weg)) s.weg = {};
  for (const o of Array.isArray(op) ? op : [op]) aendere(s, o);
  s.weg = wegBereinigen(s.weg);
  return s;
}

/** „Amy: Sachen, 2 Änderungen“ – was es ist, steht nie darin (wie bei den Notizen). */
export function sachenNachricht(paket, vorher, nachher, { name = '' } = {}) {
  const n = Array.isArray(paket) ? paket.length : 1;
  const wer = name ? `${String(name).replace(/[:\n\r]/g, ' ').trim()}: ` : '';
  return `${wer}Sachen, ${n} ${n === 1 ? 'Änderung' : 'Änderungen'}`;
}

/** sachen.json für speicher.js github() – eigene Schlüssel im Speicher des Geräts, getrennt von liste.json. */
export const ART_SACHEN = {
  pfad: SACHEN_PFAD,
  leer: leerSachen,
  bereinigen: sachenBereinigen,
  anwenden: sachenAnwenden,
  nachricht: sachenNachricht,
  nachtrag: () => [],
  speicher: { github: 'boxenstopp.sachen.github.v1', offen: 'boxenstopp.sachen.offen.v1' },
};

/* ------------------------------------------------------------------ Umzug */

/**
 * Was in liste.json unter inventar steht, in einen Stand von sachen.json:
 * je Liste und Sache nach id – fehlt sie, kommt sie dazu; ist die aus der
 * Liste neuer (geaendert), ersetzt sie die alte; ist sie nach dieser Fassung
 * gelöscht worden (weg), bleibt sie weg. Ist sachen.json voll (MAX_LISTEN,
 * MAX_DINGE), bleibt der Rest in liste.json, bis Platz ist.
 * → { stand, umgezogen: { listen: { id: geaendert }, dinge: { … } }, neu: { listen, dinge } }
 *   umgezogen: was aus liste.json weg darf (inventar.js opUmgezogen), neu: was dazukam oder ersetzt wurde.
 */
export function umzugZusammen(sachen, inventar) {
  const s = sachenAnwenden(sachen, []);
  const inv = inventarBereinigen(inventar);
  const umgezogen = { listen: {}, dinge: {} };
  const neu = { listen: 0, dinge: 0 };
  const nimm = (art, id, x, max) => {
    const ziel = s.inventar[art];
    const g = String(x.geaendert);
    if (s.weg[id] && g <= s.weg[id]) { umgezogen[art][id] = g; return; }
    // Ihre Liste ist nach dieser Fassung gelöscht (und ist es noch): Sie ging mit der Liste (inventar.js invListeWeg)
    if (art === 'dinge' && x.liste && !s.inventar.listen[x.liste] && s.weg[x.liste] && g <= s.weg[x.liste]) { umgezogen[art][id] = g; return; }
    const da = ziel[id];
    if (da && String(da.geaendert) >= g) { umgezogen[art][id] = g; return; }
    if (!da && Object.keys(ziel).length >= max) return;
    ziel[id] = x;
    delete s.weg[id];
    umgezogen[art][id] = g;
    neu[art] += 1;
  };
  for (const [id, l] of Object.entries(inv.listen)) nimm('listen', id, l, MAX_LISTEN);
  for (const [id, d] of Object.entries(inv.dinge)) nimm('dinge', id, d, MAX_DINGE);
  return { stand: s, umgezogen, neu };
}

const zahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;

/**
 * Den Umzug nach sachen.json schreiben (holen, zusammenführen, mit sha und
 * rev + 1 zurück; war jemand schneller, noch einmal – speicher.js
 * privatSchreiben). Ist nichts Neues dabei, schreibt er nichts. Die Nachricht
 * nennt nur Zahlen: „Umzug: Sachen aus der Liste – 2 Listen, 5 Sachen“.
 * → { umgezogen, neu } wie umzugZusammen; wirft mit einem Satz, wenn GitHub nicht will.
 */
export async function umzugInSachen(inventar, { token, api = API } = {}) {
  let ergebnis = { umgezogen: { listen: {}, dinge: {} }, neu: { listen: 0, dinge: 0 } };
  if (!token || !hatInventar(inventarBereinigen(inventar))) return ergebnis;
  await privatSchreiben(SACHEN_PFAD, (alt) => {
    const vorher = sachenBereinigen(alt);
    const r = umzugZusammen(vorher, inventar);
    ergebnis = { umgezogen: r.umgezogen, neu: r.neu };
    if (!r.neu.listen && !r.neu.dinge) return undefined;
    return { ...r.stand, rev: vorher.rev + 1 };
  }, {
    token,
    api,
    ort: SACHEN_ORT,
    nachricht: () => `${UMZUG}: Sachen aus der Liste – ${zahl(ergebnis.neu.listen, 'Liste', 'Listen')}, ${zahl(ergebnis.neu.dinge, 'Sache', 'Sachen')}`,
  });
  return ergebnis;
}

/**
 * Löschungen, die ein Gerät noch mit einer älteren Fassung (bis v82) gemacht
 * und nicht abgeschickt hatte (dingWeg, invListeWeg in boxenstopp.offen.v1):
 * Ist die Sache inzwischen umgezogen, liefen sie in liste.json ins Leere – hier
 * kommen sie auf sachen.json (mit Grabstein). Schreibt nur, wenn sich etwas
 * ändert. Wirft mit einem Satz, wenn GitHub nicht will.
 */
export async function wegInSachen(ops, { token, api = API } = {}) {
  const nur = (Array.isArray(ops) ? ops : []).filter((o) => istObj(o) && (o.typ === 'dingWeg' || o.typ === 'invListeWeg'));
  if (!token || !nur.length) return;
  await privatSchreiben(SACHEN_PFAD, (alt) => {
    const vorher = sachenBereinigen(alt);
    const nachher = sachenAnwenden(vorher, nur);
    if (JSON.stringify(nachher) === JSON.stringify(vorher)) return undefined;
    return { ...nachher, rev: vorher.rev + 1 };
  }, { token, api, ort: SACHEN_ORT, nachricht: `${UMZUG}: Sachen – ${zahl(nur.length, 'Löschung', 'Löschungen')} von vorher` });
}

/**
 * Für die Sachen-App: liste.json lesen (nur lesen) und, was dort noch unter
 * inventar steht, nach sachen.json zusammenführen. null, wenn liste.json
 * nicht zu lesen war; sonst wie umzugInSachen.
 */
export async function umzugAusListe({ token, api = API } = {}) {
  const liste = await privatLesen(DATEN.pfad, { token, api, ort: DATEN });
  if (!istObj(liste)) return null;
  return umzugInSachen(liste.inventar, { token, api });
}

/** Steht in diesem Stand von liste.json noch etwas, das umziehen muss? */
export const umzugNoetig = (stand) => hatInventar(stand?.inventar);
