/*
 * Haushalt – ohne DOM, damit die Tests es direkt prüfen (und werkzeug/push.mjs
 * und werkzeug/todo.mjs dieselbe Rechnung haben).
 *
 *   Räume       mit Bildchen, Aufgaben und Material zum Anfangen (VORLAGEN, MATERIAL)
 *   Sachen      Vorschläge für Haushaltssachen, nach Bereich
 *   Wiederholung  an Wochentagen, jede oder jede 2./3./4. Woche, ab einem Tag
 *   Termin      welcher Tag gerade dran ist: heute, offen seit …, erledigt,
 *               bald – je Putztag
 *   Durchgang   der wievielte Putztag ein Tag ist – eine Aufgabe „jedes 2.
 *               Mal“ ist bei jedem zweiten dran (dranAm, aufgabenAm)
 *
 * In liste.json (liste.js `haushalt`):
 *
 *   { sachen: { <hs-…>: { name, bereich, by, at } },
 *     plaene: { <pp-…>: { name, raum, aufgaben: [{ id, t, jedes? }], material: ['Badreiniger', …],
 *                         wdh: { tage: [1, 4], wochen: 1, ab },
 *                         wer: 'Amy' | '', erinnern: 'morgens' | 'mittags' | 'abends' | '', by, at } },
 *     stand:  { <pp-…>: { datum, haken: [aufgaben-ids], fertig: { at, by } | null, verlauf: [[datum, wer]] } },
 *     todoApp: '<App-ID bei Microsoft>', todoWunsch: { <name>: { art: 'verbinden' | 'trennen', at } } }
 *
 * Wochentage nach ISO: 1 = Montag … 7 = Sonntag.
 */

export const RAEUME = [
  ['kueche', 'Küche', 'fork-and-knife-with-plate'],
  ['bad', 'Bad', 'bathtub'],
  ['wohnzimmer', 'Wohnzimmer', 'couch-and-lamp'],
  ['schlafzimmer', 'Schlafzimmer', 'bed'],
  ['flur', 'Flur', 'door'],
  ['arbeitszimmer', 'Arbeitszimmer', 'books'],
  ['waesche', 'Wäsche', 't-shirt'],
  ['balkon', 'Balkon', 'potted-plant'],
  ['wohnung', 'Ganze Wohnung', 'house'],
  ['sonstiges', 'Sonstiges', 'sparkles'],
];
export const RAUM = Object.fromEntries(RAEUME.map(([k, name, bild]) => [k, { name, bild }]));

/** Aufgaben zum Anfangen je Raum – im Editor änderbar. */
export const VORLAGEN = {
  kueche: ['Arbeitsflächen abwischen', 'Herd und Backofen sauber machen', 'Spüle und Armatur putzen', 'Fronten und Griffe abwischen', 'Mikrowelle auswischen', 'Müll, Bio und Pfand rausbringen', 'Boden saugen und wischen'],
  bad: ['Waschbecken putzen', 'Armaturen putzen', 'Spiegel putzen', 'Toilette putzen', 'Dusche bzw. Wanne putzen', 'Handtücher wechseln', 'Mülleimer leeren', 'Boden wischen'],
  wohnzimmer: ['Staub wischen', 'Tisch und Oberflächen abwischen', 'Kissen und Decken ordnen', 'Pflanzen gießen', 'Boden saugen'],
  schlafzimmer: ['Bettwäsche wechseln', 'Staub wischen', 'Nachttische abwischen', 'Lüften', 'Boden saugen'],
  flur: ['Schuhe wegräumen', 'Garderobe ordnen', 'Spiegel putzen', 'Boden saugen und wischen'],
  arbeitszimmer: ['Schreibtisch aufräumen', 'Staub wischen', 'Bildschirm abwischen', 'Boden saugen'],
  waesche: ['Wäsche sortieren', 'Waschen', 'Aufhängen', 'Zusammenlegen und wegräumen'],
  balkon: ['Pflanzen gießen', 'Boden fegen', 'Tisch und Stühle abwischen'],
  wohnung: ['Fenster putzen', 'Kühlschrank auswischen', 'Backofen gründlich reinigen', 'Staub auf den Schränken wischen', 'Heizkörper abwischen'],
  sonstiges: [],
};

/** Was man je Raum zum Putzen braucht – steht im Putztag oben, im Editor änderbar. */
export const MATERIAL = {
  kueche: ['Spülmittel', 'Allzweckreiniger', 'Backofenreiniger', 'Schwamm', 'Mikrofasertücher', 'Müllbeutel', 'Bodenreiniger', 'Wischmopp und Eimer'],
  bad: ['Badreiniger', 'WC-Reiniger', 'Glasreiniger', 'Entkalker', 'Mikrofasertücher', 'Schwamm', 'Gummihandschuhe', 'Bodenreiniger'],
  wohnzimmer: ['Staubtuch', 'Mikrofasertücher', 'Allzweckreiniger', 'Staubsauger'],
  schlafzimmer: ['Frische Bettwäsche', 'Staubtuch', 'Staubsauger'],
  flur: ['Glasreiniger', 'Bodenreiniger', 'Wischmopp und Eimer', 'Staubsauger'],
  arbeitszimmer: ['Staubtuch', 'Bildschirmreiniger', 'Staubsauger'],
  waesche: ['Waschmittel', 'Weichspüler', 'Fleckenentferner', 'Wäscheklammern'],
  balkon: ['Gießkanne', 'Besen', 'Allzweckreiniger'],
  wohnung: ['Glasreiniger', 'Fensterabzieher', 'Backofenreiniger', 'Allzweckreiniger', 'Mikrofasertücher', 'Eimer'],
  sonstiges: [],
};
/** Wie oft eine einzelne Aufgabe dran ist (je Putztag einstellbar). */
export const JEDES = [[1, 'jedes Mal'], [2, 'jedes 2. Mal'], [3, 'jedes 3. Mal'], [4, 'jedes 4. Mal']];

/** Bereiche der Haushaltssachen – mit Vorschlägen zum Antippen. */
export const SACH_BEREICHE = [
  ['kueche', 'Küche', 'fork-and-knife-with-plate', ['Spülmittel', 'Spülmaschinentabs', 'Spülschwämme', 'Küchenrolle', 'Müllbeutel', 'Backpapier', 'Alufolie', 'Frischhaltefolie', 'Gefrierbeutel']],
  ['bad', 'Bad & Pflege', 'lotion-bottle', ['Toilettenpapier', 'Handseife', 'Zahnpasta', 'Duschgel', 'Shampoo', 'Deo', 'Wattepads', 'Taschentücher']],
  ['putzen', 'Putzen', 'bucket', ['Allzweckreiniger', 'WC-Reiniger', 'Badreiniger', 'Glasreiniger', 'Entkalker', 'Mikrofasertücher', 'Bodenreiniger', 'Staubsaugerbeutel']],
  ['waesche', 'Wäsche', 't-shirt', ['Waschmittel', 'Weichspüler', 'Fleckenentferner']],
  ['sonstiges', 'Sonstiges', 'light-bulb', ['Batterien', 'Glühbirnen', 'Kerzen']],
];
export const SACH_BEREICH = Object.fromEntries(SACH_BEREICHE.map(([k, name, bild]) => [k, { name, bild }]));

/** In welchen Bereich ein getippter Name gehört (für „Kackbürste“: Putzen). */
export function bereichRaten(name) {
  const n = String(name || '').toLowerCase();
  for (const [k, , , vorschlaege] of SACH_BEREICHE) if (vorschlaege.some((v) => v.toLowerCase() === n)) return k;
  if (/spül|küche|müll|folie|backpapier|gefrier|beutel|tab/.test(n)) return 'kueche';
  if (/wasch|weichspül|flecken|bügel|wäsche/.test(n)) return 'waesche';
  if (/reinig|putz|tuch|tücher|schwamm|bürste|besen|wisch|entkalk|staub|lappen|handschuh/.test(n)) return 'putzen';
  if (/papier|seife|zahn|dusch|shampoo|deo|watte|creme|pflaster|rasier|binde|tampon|kosmetik/.test(n)) return 'bad';
  return 'sonstiges';
}

export const ERINNERN = [['morgens', 'Morgens'], ['mittags', 'Mittags'], ['abends', 'Abends'], ['', 'Keine']];
/** Wann die Erinnerung ungefähr kommt (der Lauf im Daten-Repo, Berliner Zeit). */
export const ERINNERN_UHR = { morgens: 'gegen 7:30', mittags: 'gegen 12', abends: 'gegen 17:30' };
export const WOCHENTAGE = [[1, 'Mo', 'Montag'], [2, 'Di', 'Dienstag'], [3, 'Mi', 'Mittwoch'], [4, 'Do', 'Donnerstag'], [5, 'Fr', 'Freitag'], [6, 'Sa', 'Samstag'], [7, 'So', 'Sonntag']];

/* --------------------------------------------------------------- Tage */

const zwei = (n) => String(n).padStart(2, '0');
/** 'JJJJ-MM-TT' für ein Datum (Ortszeit). */
export const tagVon = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
const alsDatum = (tag) => { const [j, m, t] = String(tag).split('-').map(Number); return new Date(j, m - 1, t, 12); };
/** Ein Tag plus n Tage. */
export const plusTage = (tag, n) => { const d = alsDatum(tag); d.setDate(d.getDate() + n); return tagVon(d); };
/** ISO-Wochentag (1 = Mo … 7 = So). */
export const wochentag = (tag) => ((alsDatum(tag).getDay() + 6) % 7) + 1;
const montag = (tag) => plusTage(tag, 1 - wochentag(tag));
const tageZwischen = (a, b) => Math.round((alsDatum(b) - alsDatum(a)) / 86400000);

/** Ist ein Putztag an diesem Tag dran? */
export function faellig(plan, tag) {
  const w = plan?.wdh;
  if (!w || !Array.isArray(w.tage) || !w.tage.length) return false;
  if (w.ab && tag < w.ab) return false;
  if (!w.tage.includes(wochentag(tag))) return false;
  const wochen = Math.max(1, Math.min(4, Number(w.wochen) || 1));
  if (wochen === 1) return true;
  const abstand = Math.round(tageZwischen(montag(w.ab || tag), montag(tag)) / 7);
  return abstand % wochen === 0;
}

/** Der letzte Tag bis heute, an dem er dran war – oder null. */
export function letzterTermin(plan, heute) {
  const spanne = 7 * Math.max(1, Math.min(4, Number(plan?.wdh?.wochen) || 1));
  for (let i = 0; i <= spanne; i++) {
    const t = plusTage(heute, -i);
    if (plan?.wdh?.ab && t < plan.wdh.ab) return null;
    if (faellig(plan, t)) return t;
  }
  return null;
}
/** Der nächste Tag nach heute, an dem er dran ist – oder null. */
export function naechsterTermin(plan, heute) {
  const spanne = 7 * Math.max(1, Math.min(4, Number(plan?.wdh?.wochen) || 1)) + 7;
  const start = plan?.wdh?.ab && plan.wdh.ab > heute ? plusTage(plan.wdh.ab, -1) : heute;
  for (let i = 1; i <= spanne + Math.max(0, tageZwischen(heute, start)); i++) {
    const t = plusTage(start, i);
    if (faellig(plan, t)) return t;
  }
  return null;
}

/**
 * Wie es um einen Putztag steht:
 *   { art: 'heute' | 'offen' | 'erledigt' | 'bald' | 'frei', datum, naechster, haken, fertig }
 * datum ist der Tag, um den es geht (heute, seit wann offen, wann erledigt,
 * wann als nächstes); haken die abgehakten Aufgaben dieses Tages. 'frei': ohne
 * festen Tag (datum: seit wann die Runde läuft).
 */
export function termin(plan, st, heute) {
  const da = (ids) => (ids || []).filter((id) => (plan?.aufgaben || []).some((a) => a.id === id));
  // Ohne festen Tag: eine Liste für zwischendurch – bis alles erledigt ist, dann
  // bleibt sie erledigt, bis jemand neu anfängt
  if (!plan?.wdh?.tage?.length) {
    if (st?.fertig) return { art: 'erledigt', datum: st.datum, naechster: null, haken: da(st.haken), fertig: st.fertig, frei: true };
    return { art: 'frei', datum: st?.datum || heute, naechster: null, haken: da(st?.haken), fertig: null, frei: true };
  }
  const letzter = letzterTermin(plan, heute);
  const naechster = naechsterTermin(plan, heute);
  if (!letzter) return { art: 'bald', datum: naechster, naechster, haken: [], fertig: null };
  const meiner = st && st.datum === letzter;
  const haken = meiner ? da(st.haken) : [];
  // Schon weiter (ein neuerer Tag hat angefangen)? Dann steht der hier im Verlauf
  const alt = !meiner && (st?.verlauf || []).find((v) => v[0] === letzter);
  const fertig = meiner && st.fertig ? st.fertig : alt ? { at: '', by: alt[1] || '' } : null;
  if (fertig) return { art: 'erledigt', datum: letzter, naechster, haken: meiner ? haken : (plan.aufgaben || []).map((a) => a.id), fertig };
  return { art: letzter === heute ? 'heute' : 'offen', datum: letzter, naechster, haken, fertig: null };
}

/**
 * Der wievielte Putztag ein Tag ist: 0 = das erste Mal ab „ab“ (zählt die
 * Tage, an denen er vorher dran war – nach dem Kalender, auch verpasste).
 */
export function durchgang(plan, tag) {
  const w = plan?.wdh;
  if (!w?.tage?.length || !w.ab || !tag || tag <= w.ab) return 0;
  const wochen = Math.max(1, Math.min(4, Number(w.wochen) || 1));
  let n = 0;
  const ende = montag(tag);
  let m = montag(w.ab);
  for (let i = 0; m <= ende && i < 5300; i++, m = plusTage(m, 7)) {
    if (i % wochen !== 0) continue;
    for (const t of w.tage) {
      const d = plusTage(m, t - 1);
      if (d >= w.ab && d < tag) n++;
    }
  }
  return n;
}

/** Ist eine Aufgabe an diesem Tag dran? „jedes 2. Mal“: beim ersten, dritten … Putztag. Ohne festen Tag immer. */
export const dranAm = (a, plan, tag) => !(Number(a?.jedes) > 1) || !plan?.wdh?.tage?.length || !tag || durchgang(plan, tag) % Number(a.jedes) === 0;
/** Die Aufgaben, die an diesem Tag dran sind. */
export const aufgabenAm = (plan, tag) => (plan?.aufgaben || []).filter((a) => dranAm(a, plan, tag));
/** Wann eine Aufgabe, die an diesem Tag nicht dran ist, wieder dran ist – oder null. */
export function wiederAm(a, plan, tag) {
  let t = tag;
  for (let i = 0; i < 8 && t; i++) {
    t = naechsterTermin(plan, t);
    if (t && dranAm(a, plan, t)) return t;
  }
  return null;
}

/** „jeden Montag“, „jeden Mo und Do“, „alle 2 Wochen samstags“, „täglich“. */
export function wdhText(w) {
  const tage = [...new Set((w?.tage || []).filter((t) => t >= 1 && t <= 7))].sort((a, b) => a - b);
  if (!tage.length) return 'ohne festen Tag';
  const wochen = Math.max(1, Math.min(4, Number(w.wochen) || 1));
  if (tage.length === 7 && wochen === 1) return 'täglich';
  const lang = (t) => WOCHENTAGE[t - 1][2];
  const kurz = (t) => WOCHENTAGE[t - 1][1];
  if (wochen === 1) return tage.length === 1 ? `jeden ${lang(tage[0])}` : `jeden ${tage.slice(0, -1).map(kurz).join(', ')} und ${kurz(tage[tage.length - 1])}`;
  const adverb = (t) => `${lang(t).toLowerCase()}s`;
  return `alle ${wochen} Wochen ${tage.length === 1 ? adverb(tage[0]) : `${tage.slice(0, -1).map(kurz).join(', ')} und ${kurz(tage[tage.length - 1])}`}`;
}

/** „heute“, „morgen“, „Do“, „Do 13.11.“ – kurz, für die Übersicht. */
export function tagText(tag, heute) {
  if (!tag) return '';
  const n = tageZwischen(heute, tag);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'gestern';
  const [, m, t] = tag.split('-').map(Number);
  const kurz = WOCHENTAGE[wochentag(tag) - 1][1];
  return n > 1 && n < 7 ? kurz : `${kurz} ${t}.${m}.`;
}

/** Ist eine Person für einen Putztag zuständig? (wer leer: alle) */
export const zustaendig = (plan, name) => !plan?.wer || String(plan.wer).toLowerCase() === String(name || '').toLowerCase();
