/*
 * Was von den Packungen übrig bleibt – und welche Rezepte es aufbrauchen.
 * Marielle kocht Chili für 2 Boxen: 125 g Rinderhack, im Laden gibt es
 * 500 g. Die 375 g übrig passen in Bolognese und Köttbullar.
 *
 *   - restVon: je Zutat, was von den Packungen übrig bleibt
 *   - resteVon: davon, was schnell verdirbt (Fleisch, Kühlregal, offene
 *     Dosen, frisches Gemüse) und mehr als ein Rest vom Rest ist (ab einem
 *     Fünftel der Packung) – mit dem Wert in Euro
 *   - restePlan: welche Rezepte (bis zu drei) die Reste am meisten
 *     aufbrauchen. Gerechnet in Euro, die nicht im Müll landen: Ein Rezept
 *     zählt nur, wenn danach insgesamt weniger übrig bleibt – auch mit dem,
 *     was es selbst wieder übrig lässt.
 *
 * posten: [{ k, q, u, h }] – was gebraucht wird, von der Liste oder aus
 * einem Rezept. daten: { preise, naehrwerte, katalog }.
 *
 * Die Packung: aus dem Hinweis („1 × 500 g“), sonst die Richtpreis-Packung
 * (daten.preise: Skyr 500 g, Staudensellerie 8 Stangen), sonst ein Stück –
 * eine Dose, ein Bund. Gemüse, das man einzeln kauft (Paprika, Zucchini,
 * Tomaten), hat keine Packung: Da rundet boxen.js die Stück schon so, dass
 * kaum etwas bleibt.
 *
 * Ohne DOM, damit tests/test-reste.mjs alles direkt in Node prüft.
 */
import { packung } from './zielrechner.js';
import { kostenMenge } from './kosten.js';
import { einkaufsZutaten } from './liste.js';

const istZahl = (v) => typeof v === 'number' && Number.isFinite(v);
const GEWICHT = new Set(['g', 'ml']);
/** Ab welchem Anteil der Packung ein Rest zählt. */
export const AB_ANTEIL = 0.2;
/** Was ein Rezept mindestens aufbrauchen muss, damit es vorgeschlagen wird (Euro). */
const MIN_SPAREN = 0.3;

/** Was schnell verdirbt: Fleisch, Kühlregal, offene Dosen, frisches Gemüse. */
const VERDIRBT = new Set(['fleisch', 'kuehl', 'konserven', 'obst']);
/** Was offen lange hält oder ohnehin in den Vorrat geht. */
const HAELT = new Set([
  'parmesan', 'butter', 'eier', 'cheddar', 'milch',
  'tomatenmark', 'currypaste', 'ajvar', 'getr-tomaten', 'erdnussbutter', 'pesto', 'gewuerzgurken', 'oliven',
  'zwiebeln', 'rote-zwiebeln', 'knoblauch', 'ingwer', 'moehren', 'kartoffeln', 'suesskartoffel', 'limette', 'zitrone', 'aepfel', 'weisskohl',
]);
/** Gemüse, das es einzeln oder lose gibt – keine Packung, die übrig bleibt (außer dem Stückchen, Stückware). */
const LOSE = new Set(['tomaten', 'paprika', 'zucchini', 'gurke', 'aubergine', 'kohlrabi', 'blumenkohl', 'lauch']);

export const verdirbt = (k, katalog) => VERDIRBT.has(katalog?.[k]?.c) && !HAELT.has(k);

/** Die Packungsgröße in der Einheit u – oder null, wenn die App sie nicht kennt. */
export function packungFuer(k, u, hinweise = [], { preise, katalog } = {}) {
  const p = preise?.[k];
  if (GEWICHT.has(u)) {
    if (LOSE.has(k)) return null;
    // Aus dem Hinweis – stehen verschiedene da, die kleinste (die gibt es zu kaufen)
    const aus = hinweise.map((h) => packung(h)).filter((x) => x && x.X > 0);
    if (aus.length) return Math.min(...aus.map((x) => x.X));
    return p && GEWICHT.has(p.u) && p.menge > 0 ? p.menge : null;
  }
  // Stückware: Gemüse einzeln, sonst die Richtpreis-Packung (Staudensellerie: 8 Stangen), sonst eins
  if (u === 'Stk' && katalog?.[k]?.c === 'obst') return 1;
  if (p && p.u === u && p.menge > 0) return p.menge;
  return 1;
}

/** Gleiche Zutat, gleiche Einheit: zusammen. */
function zusammen(posten) {
  const m = new Map();
  for (const x of posten || []) {
    if (!x || !x.k || !istZahl(x.q) || x.q <= 0 || typeof x.u !== 'string' || !x.u) continue;
    const s = `${x.k}|${x.u}`;
    const e = m.get(s) || { k: x.k, u: x.u, q: 0, hinweise: [] };
    e.q += x.q;
    if (x.h) e.hinweise.push(x.h);
    m.set(s, e);
  }
  return [...m.values()];
}

/** Je Zutat: gebraucht (q), Packung, wie viele Packungen, was übrig bleibt. */
export function restVon(posten, daten = {}) {
  const aus = [];
  for (const e of zusammen(posten)) {
    const pack = packungFuer(e.k, e.u, e.hinweise, daten);
    if (!pack) continue;
    const packs = Math.max(1, Math.ceil(e.q / pack - 1e-6));
    const rest = Math.max(0, packs * pack - e.q);
    aus.push({ k: e.k, u: e.u, q: e.q, pack, packs, rest: rest < 1e-6 ? 0 : rest, anteil: rest / pack });
  }
  return aus;
}

/** Was übrig bleibt und schnell verdirbt – mit Namen und Wert, das Teuerste zuerst. */
export function resteVon(posten, daten = {}) {
  return restVon(posten, daten)
    .filter((x) => x.rest > 0 && x.anteil >= AB_ANTEIL - 1e-9 && verdirbt(x.k, daten.katalog))
    .map((x) => {
      const w = kostenMenge(x.k, x.rest, x.u, daten);
      return { ...x, n: daten.katalog?.[x.k]?.n || x.k, art: daten.katalog?.[x.k]?.c || '', wert: istZahl(w) ? w : 0 };
    })
    .sort((a, b) => b.wert - a.wert || b.anteil - a.anteil);
}

/** Der Wert der Reste in Euro. */
export const restWert = (posten, daten) => resteVon(posten, daten).reduce((s, x) => s + x.wert, 0);

/** Was ein Rezept einkauft, als Posten. */
export const postenVon = (r) => einkaufsZutaten(r || {}).map((it) => ({ k: it.k, q: it.q, u: it.u, h: it.h || '' }));

/** Alles, was auf der Liste steht – auch Abgehaktes und was jemand dazu will. ohne: diese Rezepte nicht. */
export function postenDerListe(stand, ohne = []) {
  const aus = [];
  for (const [k, d] of Object.entries(stand?.items || {})) {
    if (!d || typeof d !== 'object' || d.custom || !d.parts || typeof d.parts !== 'object') continue;
    for (const [rid, p] of Object.entries(d.parts)) {
      if (!p || typeof p !== 'object' || ohne.includes(rid)) continue;
      if (istZahl(p.q) && typeof p.u === 'string') aus.push({ k, q: p.q, u: p.u, h: p.h || '' });
    }
  }
  return aus;
}

/**
 * Welche Rezepte die Reste aufbrauchen: bis zu max, eins nach dem anderen
 * (jedes mit dem, was die davor schon gebraucht haben). rezepte: die Rezepte
 * der App (schon auf Ziel und Boxen gerechnet); ohne: was schon geplant ist.
 * { reste, wert, plan: [{ id, name, short, nutzt: [{ k, n, q, u }], spart }], danach }
 */
export function restePlan(posten, rezepte = [], daten = {}, { ohne = [], max = 3 } = {}) {
  const reste = resteVon(posten, daten);
  const wert = reste.reduce((s, x) => s + x.wert, 0);
  const basis = [...(posten || [])];
  const plan = [];
  let jetzt = wert;
  let offen = reste;
  const frei = (rezepte || []).filter((r) => r && r.id && !ohne.includes(r.id) && Array.isArray(r.items));
  while (plan.length < max && offen.length && jetzt > MIN_SPAREN) {
    let best = null;
    for (const r of frei) {
      if (plan.some((p) => p.id === r.id)) continue;
      const zut = postenVon(r);
      const nutzt = offen.map((x) => {
        const q = zut.filter((z) => z.k === x.k && z.u === x.u).reduce((s, z) => s + z.q, 0);
        return q > 0 ? { k: x.k, n: x.n, u: x.u, q: Math.min(q, x.rest) } : null;
      }).filter(Boolean);
      if (!nutzt.length) continue;
      const danach = restWert([...basis, ...zut], daten);
      const spart = jetzt - danach;
      if (spart >= MIN_SPAREN && (!best || spart > best.spart + 1e-9)) best = { r, zut, nutzt, spart, danach };
    }
    if (!best) break;
    plan.push({ id: best.r.id, name: best.r.name, short: best.r.short || best.r.name, nutzt: best.nutzt, spart: best.spart });
    basis.push(...best.zut);
    jetzt = best.danach;
    offen = resteVon(basis, daten);
  }
  return { reste, wert, plan, danach: jetzt, restDanach: offen };
}
