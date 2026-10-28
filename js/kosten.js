/*
 * Kosten: Richtpreise aus daten/rezepte.json (preise: Euro je Gramm je
 * Katalog-Schlüssel, aus werkzeug/preise.py) auf Mengen anwenden – für die
 * Einkaufsliste und für eigene Rezepte aus der Resteverwertung, die noch
 * keine Kosten mitbringen. Die festen Rezepte haben `kosten` schon drin.
 *
 * Richtwerte, keine Tagespreise: In der App steht immer „≈“ davor.
 */

/** „2,30 €“, unter 10 € mit zwei Stellen, darüber gerundet. */
export function euro(x) {
  if (!Number.isFinite(x)) return '';
  const s = x < 10 ? x.toFixed(2) : String(Math.round(x));
  return `${s.replace('.', ',')} €`;
}

/** Gramm (bzw. ml) einer Menge; Stückware über die Einheit aus den Nährwerten (je). */
function gramm(k, q, u, naehrwerte) {
  if (typeof q !== 'number' || !Number.isFinite(q)) return 0;
  if (u === 'g' || u === 'ml') return q;
  const n = naehrwerte?.[k];
  return n && n.u === u && n.je ? q * n.je : 0;
}

/** Euro für eine Menge einer Katalogzutat – null, wenn kein Preis bekannt ist. */
export function kostenMenge(k, q, u, { preise, naehrwerte } = {}) {
  const p = preise?.[k];
  if (!p) return null;
  const g = gramm(k, q, u, naehrwerte);
  if (g) return g * p.je_g;
  if (p.u === u && typeof q === 'number') return q * (p.eur / p.menge);
  return null;
}

/**
 * Kosten eines Rezepts, das keine mitbringt (Resteverwertung): nur Zutaten
 * mit Katalog-Schlüssel und Menge zählen; { gesamt, box, luecken } –
 * luecken = Zutaten ohne Preis, damit die App „mindestens“ sagen kann.
 */
export function kostenRezept(r, daten) {
  if (r?.kosten && Number.isFinite(r.kosten.box)) return { ...r.kosten, luecken: 0 };
  let gesamt = 0;
  let luecken = 0;
  for (const it of r?.items || []) {
    if (it.opt || it.haus) continue;
    const e = it.k ? kostenMenge(it.k, it.q, it.u, daten) : null;
    if (e === null) { if (!it.pantry) luecken++; } else gesamt += e;
  }
  const n = r?.portionen || 8;
  return { gesamt, box: gesamt / n, luecken };
}

/**
 * Was die offenen Einträge der Liste zum Richtpreis kosten, je Zutat:
 * { k: Euro }. Daran misst die Empfehlung, welcher Laden mit seinen
 * Angeboten am meisten spart (ladenWahl in angebote.js).
 */
export function offenJeZutat(stand, daten) {
  const b = {};
  for (const [k, d] of Object.entries(stand?.items || {})) {
    if (!d || typeof d !== 'object' || d.custom) continue;
    for (const p of Object.values(d.parts || {})) {
      if (!p || typeof p !== 'object' || p.done === true) continue;
      const e = kostenMenge(k, p.q, p.u, daten);
      if (e > 0) b[k] = (b[k] || 0) + e;
    }
  }
  return b;
}

/** Summe der Einkaufsliste: alle Einträge mit Katalog-Schlüssel und Menge. */
export function kostenListe(stand, daten) {
  let gesamt = 0;
  let offen = 0;
  for (const [k, d] of Object.entries(stand?.items || {})) {
    if (!d || typeof d !== 'object' || d.custom) continue;
    const teile = Object.values(d.parts || {}).filter((p) => p && typeof p === 'object');
    for (const p of teile) {
      const e = kostenMenge(k, p.q, p.u, daten);
      if (e === null) continue;
      gesamt += e;
      if (p.done !== true) offen += e;
    }
  }
  return { gesamt, offen };
}
