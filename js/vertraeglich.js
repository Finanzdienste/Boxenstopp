/*
 * Was jemand verträgt – „Was ich vertrage“ in Amys Bereich. Ohne DOM, damit
 * die Tests es in Node prüfen.
 *
 * Je Person Zutaten mit einer Stufe:
 *   geht   ✓  bekommt gut
 *   wenig  ~  nur ein bisschen
 *   nicht  ✗  geht nicht
 *
 * In liste.json unter `vertraeglich`:
 *   { amy: { zwiebeln: { name: 'Zwiebeln', stufe: 'nicht', notiz: '', by, at },
 *            'n:laktosefreie-milch': { name: 'laktosefreie Milch', stufe: 'geht', … } } }
 * Die Person klein geschrieben, der Schlüssel ist der Katalog-Schlüssel, wenn
 * es die Zutat im Katalog gibt, sonst der Name (n:…). Das liegt nur in der
 * privaten Liste, nie im Code – was jemand verträgt, ist seine Sache und
 * kommt von ihr selbst.
 *
 * Abgleich mit einem Rezept (pruefen): Eine Zutat trifft einen Eintrag, wenn
 * der Schlüssel gleich ist oder ihr Name das Wort enthält – ab vier
 * Buchstaben auch mitten im Wort (Frühlings|zwiebeln, Knoblauch|zehen),
 * kürzere nur als ganzes Wort (Ei → Eier, nicht Eisbergsalat). Treffen
 * mehrere, gilt der genaueste (der längste Name): „laktosefreie Milch: geht“
 * schlägt „Milch: geht nicht“.
 */

export const STUFEN = ['geht', 'wenig', 'nicht'];
export const STUFE_TEXT = { geht: 'geht', wenig: 'nur wenig', nicht: 'geht nicht' };
export const STUFE_ZEICHEN = { geht: '✓', wenig: '~', nicht: '✗' };
const MAX_JE = 300;
const MAX_PERSONEN = 8;
const PERSON = /^[\p{L}\p{N} ._-]{1,40}$/u;
const SCHLUESSEL = /^[A-Za-z0-9_.~:@+-]{1,120}$/;
const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => (typeof v === 'string' ? v.replace(/[\n\r\t]+/g, ' ').trim().slice(0, max) : '');
const jetzt = () => new Date().toISOString();

/** Name zum Vergleichen: klein, ohne Umlaute und Satzzeichen. */
export const normal = (s) => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
/** Wem die Liste gehört – der Schlüssel in `vertraeglich`. */
export const personSchluessel = (wer) => String(wer || '').trim().toLowerCase();

export function eintragBereinigen(e) {
  if (!istObj(e) || !STUFEN.includes(e.stufe)) return null;
  const name = text(e.name, 60);
  if (!name) return null;
  return { name, stufe: e.stufe, notiz: text(e.notiz, 120), by: text(e.by, 40) || null, at: text(e.at, 40) };
}

export function vertraeglichBereinigen(x) {
  const out = {};
  if (!istObj(x)) return out;
  for (const [p, liste] of Object.entries(x).slice(0, MAX_PERSONEN)) {
    if (!PERSON.test(p) || p !== p.toLowerCase() || !istObj(liste)) continue;
    const b = {};
    for (const [k, e] of Object.entries(liste).slice(-MAX_JE)) {
      const r = SCHLUESSEL.test(k) ? eintragBereinigen(e) : null;
      if (r) b[k] = r;
    }
    if (Object.keys(b).length) out[p] = b;
  }
  return out;
}

/** Einträge setzen oder (null) vergessen: werte { <schlüssel>: { name, stufe, notiz } | null }. */
export const opVertraeglich = (wer, werte, by, at = jetzt()) => ({ typ: 'vertraeglich', wer: personSchluessel(wer), werte: JSON.parse(JSON.stringify(werte || {})), by: by || null, at });

export function vertraeglichAnwenden(s, op) {
  const p = personSchluessel(op.wer);
  if (!PERSON.test(p) || !istObj(op.werte)) return;
  if (!istObj(s.vertraeglich)) s.vertraeglich = {};
  if (!s.vertraeglich[p] && Object.keys(s.vertraeglich).length >= MAX_PERSONEN) return;
  const liste = istObj(s.vertraeglich[p]) ? s.vertraeglich[p] : {};
  for (const [k, e] of Object.entries(op.werte)) {
    if (!SCHLUESSEL.test(k)) continue;
    if (e === null) { delete liste[k]; continue; }
    const b = eintragBereinigen({ ...e, by: op.by, at: op.at });
    if (b) liste[k] = b;
  }
  const alle = Object.keys(liste);
  for (const k of alle.slice(0, Math.max(0, alle.length - MAX_JE))) delete liste[k];
  if (Object.keys(liste).length) s.vertraeglich[p] = liste;
  else delete s.vertraeglich[p];
}

/** Was ein anderer Stand kennt und dieser nicht (zusammen in liste.js). */
export function vertraeglichZusammen(s, x) {
  const neu = vertraeglichBereinigen(x);
  if (!Object.keys(neu).length) return;
  if (!istObj(s.vertraeglich)) s.vertraeglich = {};
  for (const [p, liste] of Object.entries(neu)) {
    if (!s.vertraeglich[p] && Object.keys(s.vertraeglich).length >= MAX_PERSONEN) continue;
    const da = s.vertraeglich[p] || {};
    for (const [k, e] of Object.entries(liste)) if (!da[k]) da[k] = e;
    s.vertraeglich[p] = da;
  }
}

/** Die Liste einer Person als [[schlüssel, eintrag]] – nach Stufe (geht nicht zuerst), dann Name. */
export function eintraegeVon(stand, wer) {
  const liste = stand?.vertraeglich?.[personSchluessel(wer)];
  if (!istObj(liste)) return [];
  const rang = { nicht: 0, wenig: 1, geht: 2 };
  return Object.entries(liste).sort(([, a], [, b]) => rang[a.stufe] - rang[b.stufe] || a.name.localeCompare(b.name, 'de'));
}

/** Trifft der Eintrag (Schlüssel k, Name) die Zutat? Wie genau: 0 = nein, sonst die Länge des Namens (+1000 bei gleichem Schlüssel). */
export function treffer(k, e, zutat) {
  if (zutat.k && k === zutat.k) return 1000 + normal(e.name).length;
  const wort = normal(e.name);
  const name = normal(zutat.name);
  if (!wort || !name) return 0;
  if (name === wort) return 500 + wort.length;
  const teile = name.split(' ');
  if (wort.includes(' ')) return name.includes(wort) ? wort.length : 0;
  if (wort.length >= 4) return name.replace(/ /g, '').includes(wort) || teile.some((t) => t.includes(wort)) ? wort.length : 0;
  // Kurze Wörter nur ganz – mit den üblichen Endungen (Ei → Eier)
  return teile.some((t) => t === wort || [`${wort}er`, `${wort}e`, `${wort}n`, `${wort}s`, `${wort}en`].includes(t)) ? wort.length : 0;
}

/**
 * Ein Rezept gegen die Liste einer Person: zutaten [{ k, name }] →
 * { nicht: [{ zutat, eintrag, k }], wenig: […], geht: […] } – je Zutat der genaueste Eintrag.
 */
export function pruefen(zutaten, eintraege) {
  const out = { nicht: [], wenig: [], geht: [] };
  if (!eintraege?.length) return out;
  const gesehen = new Set();
  for (const z of zutaten || []) {
    if (!z?.name) continue;
    const id = z.k || normal(z.name);
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    let best = null;
    let wert = 0;
    for (const [k, e] of eintraege) {
      const w = treffer(k, e, z);
      if (w > wert) { wert = w; best = [k, e]; }
    }
    if (best) out[best[1].stufe].push({ zutat: z, eintrag: best[1], k: best[0] });
  }
  return out;
}

/** Kurz fürs Anzeigen: „Zwiebeln, Knoblauch“ – höchstens n Namen, dann „…“. */
export function namenKurz(treffer, n = 3) {
  const namen = [...new Set(treffer.map((t) => t.zutat.name))];
  return namen.slice(0, n).join(', ') + (namen.length > n ? ' …' : '');
}

/** Die Zutaten eines festen Rezepts (mit Gewürzen) zum Prüfen. */
export const zutatenFest = (r, katalog = {}) => [...(r?.items || []), ...(r?.spices || [])].map((it) => ({ k: it.k || '', name: it.n || katalog[it.k]?.n || it.k || '' })).filter((z) => z.name);
