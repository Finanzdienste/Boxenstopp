/*
 * Die Bereiche der Einkaufsliste, von oben nach unten so, wie eingekauft wird:
 *
 *   Frisches     Obst, Gemüse, frische Kräuter
 *   Tierisches   erst Fleisch, dann Milchprodukte und Eier
 *   Trockenes    Nudeln, Reis, Konserven, Öle und Saucen – und Tiefkühl
 *                (TK-Fleisch und TK-Gemüse zählen hier auch dazu)
 *   Gewürze
 *   Extras       Haushalt: Backpapier, Döschen, Spieße … nur wenn nötig
 *   Sonstiges    nur, wenn die App einen eigenen Eintrag nicht zuordnen kann
 *
 * Die Abteilung einer Zutat steht im Katalog (daten/rezepte.json); bei
 * eigenen Einträgen hat die App sie beim Eintippen geraten. Einträge mit den
 * älteren, feineren Abteilungen („konserven“, „tk“ …) landen weiter richtig.
 *
 * Ohne DOM, damit tests/test-liste.mjs Reihenfolge und Text direkt prüft.
 */
import { erledigt, summen } from './liste.js';
import { menge, ungefaehr } from './format.js';

export const BEREICHE = [
  { id: 'frisch', name: 'Frisches', hinweis: 'Obst & Gemüse', teile: ['obst'] },
  { id: 'tierisch', name: 'Tierisches', hinweis: 'erst Fleisch, dann Milchprodukte', teile: ['fleisch', 'kuehl'] },
  { id: 'trocken', name: 'Trockenes', hinweis: 'auch Konserven und TK', teile: ['trocken', 'konserven', 'vorrat', 'tk'] },
  { id: 'gewuerze', name: 'Gewürze', hinweis: '', teile: ['gewuerz'] },
  { id: 'extras', name: 'Extras', hinweis: 'Haushalt', teile: ['haushalt'] },
  { id: 'sonstiges', name: 'Sonstiges', hinweis: '', teile: ['sonstiges'] },
];

const PLATZ = {};
BEREICHE.forEach((b, i) => b.teile.forEach((t, j) => { PLATZ[t] = [i, j]; }));

/** Abteilung eines Eintrags: Katalog vor dem, was beim Anlegen gespeichert wurde. */
export const abteilungVon = (k, d, katalog = {}) => katalog[k]?.c || d.cat || 'sonstiges';
const platz = (k, d, katalog) => PLATZ[abteilungVon(k, d, katalog)] || PLATZ.sonstiges;

/**
 * Die offenen Einträge nach Bereichen, in Einkaufsreihenfolge:
 * [{ bereich, eintraege: [[k, d], …] }, …] – leere Bereiche fehlen.
 */
export function nachBereichen(stand, katalog = {}) {
  const gruppen = BEREICHE.map((bereich) => ({ bereich, eintraege: [] }));
  for (const [k, d] of Object.entries(stand.items)) {
    if (erledigt(d)) continue;
    gruppen[platz(k, d, katalog)[0]].eintraege.push([k, d]);
  }
  for (const g of gruppen) {
    g.eintraege.sort(([ka, a], [kb, b]) => (platz(ka, a, katalog)[1] - platz(kb, b, katalog)[1])
      || String(a.name).localeCompare(String(b.name), 'de'));
  }
  return gruppen.filter((g) => g.eintraege.length);
}

/** Eine Zeile zum Kopieren: „300 g Zwiebeln (≈ 3 Stück)“, Gewürze nur mit Namen. */
export function zeileAlsText(k, d) {
  const s = summen(d);
  const mengen = Object.entries(s).map(([u, q]) => menge(q, u)).join(' + ');
  const etwa = d.custom ? '' : ungefaehr(k, s);
  return `${mengen ? `${mengen} ` : ''}${d.name}${etwa ? ` (${etwa})` : ''}`;
}

/**
 * Alles Offene als Text, Bereich für Bereich – zum Einfügen in eine andere
 * Einkaufsliste:
 *
 *   Frisches:
 *   300 g Zwiebeln (≈ 3 Stück)
 *
 *   Tierisches:
 *   500 g Rinderhackfleisch
 */
export function alsText(stand, katalog = {}) {
  return nachBereichen(stand, katalog)
    .map(({ bereich, eintraege }) => `${bereich.name}:\n${eintraege.map(([k, d]) => zeileAlsText(k, d)).join('\n')}`)
    .join('\n\n');
}
