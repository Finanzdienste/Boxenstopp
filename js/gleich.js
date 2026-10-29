/*
 * Dasselbe Produkt unter zwei Namen: „leckere Dino nuggies“ aus Amys Rezept
 * und „Dino nuggets“ aus Tobis. Ohne DOM, damit die Tests es direkt prüfen.
 *
 * Die App vergleicht die Namen der Zeilen auf der Liste Wort für Wort – ohne
 * Füllwörter („lecker“, „groß“, „Bio“ …), Einzahl wie Mehrzahl („Tomate“ und
 * „Tomaten“), mit Koseformen und kleinen Tippfehlern („Nuggies“ und
 * „Nuggets“, „Mozarella“ und „Mozzarella“). Was genug übereinstimmt, schlägt
 * sie über der Liste zum Zusammenlegen vor. Zwei Zutaten aus dem Katalog nie:
 * Die sind mit Absicht verschieden (Paprika und Paprikapulver). Was jemand mit
 * „Nein, verschieden“ beantwortet hat, steht in stand.ungleich und kommt
 * nicht wieder.
 *
 * Zusammengelegt wird in die Zeile, die mehr weiß: Katalog vor
 * Resteverwertung vor Amys eigenen Zutaten vor eigenen Einträgen – dann
 * bleiben Preis, Nährwerte, Bild und Abteilung aus dem Katalog. Danach landet
 * alles, was unter dem alten Schlüssel oder Namen kommt, in dieser Zeile
 * (liste.js `gleich`).
 */
import { erledigt, teileVon, paar } from './liste.js';
import { nameSchluessel, umleiten } from './format.js';

/** Ab wie viel Übereinstimmung (0–1) die App fragt, ob es dasselbe ist. */
export const VORSCHLAG_AB = 0.7;

const FUELL = new Set([
  'bio', 'gut', 'gute', 'guter', 'gutes', 'guten', 'lieblings', 'super', 'extra', 'mini', 'xxl', 'xl', 'pack', 'packung',
  'etwas', 'paar', 'bisschen', 'wenig', 'viel', 'viele', 'einige', 'ca', 'circa', 'etwa',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'und', 'oder', 'mit', 'ohne', 'von', 'vom', 'zum', 'zur', 'fuer', 'aus', 'im', 'in', 'am', 'an', 'auf', 'zu',
  'mein', 'meine', 'meinen', 'unser', 'unsere', 'amys', 'omas', 'mamas', 'papas',
]);
const FUELL_FORM = /^(?:lecker|gross|klein|mittelgross|selbstgemacht|hausgemacht)(?:e[nrsm]?)?$/;

const norm = (s) => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/** Die Wörter eines Namens, die zählen: „Leckere Dino Nuggies (TK)“ → ['dino', 'nuggies', 'tk']. „1,5 %“ bleibt eine Zahl. */
export const woerter = (name) => norm(name).replace(/(\d)[.,](\d)/g, '$1_$2').split(/[^a-z0-9_]+/)
  .filter((w) => w && (w.length > 1 || /\d/.test(w)) && !FUELL.has(w) && !FUELL_FORM.test(w));

/** Einzahl, Mehrzahl, Verkleinerung: „tomaten“ → „tomat“, „eier“ → „ei“, „nuggies“ → „nugg“. */
const stamm = (w) => (w.length <= 3 ? w : w.replace(/(?:chen|lein)$/, '').replace(/(?:ies|ys)$/, '').replace(/(?:en|er|es|e|n|s|i)$/, ''));

/** Wie viele Buchstaben man ändern muss, Vertauschen zählt einmal („Ceasar“ – „Caesar“) – über max hinaus egal. */
function abstand(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let vorvor = null;
  let vor = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const jetzt = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      let x = Math.min(vor[j] + 1, jetzt[j - 1] + 1, vor[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (vorvor && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) x = Math.min(x, vorvor[j - 2] + 1);
      jetzt[j] = x;
      min = Math.min(min, x);
    }
    if (min > max) return max + 1;
    vorvor = vor;
    vor = jetzt;
  }
  return vor[b.length];
}

/** Zwei Wörter: 1 gleich, 0,85–0,9 fast gleich (Endung, Tippfehler), sonst 0. */
export function wortWert(a, b) {
  if (a === b) return 1;
  if (/\d/.test(a) || /\d/.test(b)) return 0;
  const sa = stamm(a);
  if (sa.length >= 2 && sa === stamm(b)) return 1;
  const kurz = Math.min(a.length, b.length);
  const lang = Math.max(a.length, b.length);
  let p = 0;
  while (p < kurz && a[p] === b[p]) p++;
  // Gleicher Anfang, nur die Endung anders: „nuggies“ – „nuggets“ (aber nicht „milch“ – „milchreis“)
  if (p >= 4 && kurz - p <= 3 && lang - p <= 3) return 0.85;
  if (kurz >= 5) {
    const d = abstand(a, b, 2);
    if (d === 1) return 0.9;
    if (d === 2 && kurz >= 8) return 0.8;
  }
  return 0;
}

/**
 * Wie ähnlich zwei Namen sind (0–1): Jedes Wort des kürzeren sucht sein
 * bestes Gegenstück im längeren; was der längere mehr hat, zieht etwas ab
 * („Nuggets“ – „Dino Nuggets“ ≈ 0,71). Zusammengeschrieben zählt auch
 * („Dinonuggets“ – „Dino Nuggets“).
 */
export function aehnlich(a, b) {
  const A = woerter(a);
  const B = woerter(b);
  if (!A.length || !B.length) return 0;
  const [klein, gross] = A.length <= B.length ? [A, B] : [B, A];
  const frei = [...gross];
  let summe = 0;
  for (const w of klein) {
    let best = 0;
    let bi = -1;
    frei.forEach((v, i) => { const x = wortWert(w, v); if (x > best) { best = x; bi = i; } });
    if (bi >= 0) frei.splice(bi, 1);
    summe += best;
  }
  const wortweise = (summe / klein.length) * Math.sqrt(klein.length / gross.length);
  const zusammen = A.length + B.length > 2 ? wortWert(A.join(''), B.join('')) : 0;
  return Math.round(Math.max(wortweise, zusammen) * 100) / 100;
}

/** Woran sich eine Zeile auch morgen wiedererkennt: eigene Einträge am Namen, alles andere am Schlüssel. */
export const merkName = (k, d) => (String(k).startsWith('c-') ? nameSchluessel(d?.name || k) : String(k));

/** Wie gut eine Zeile als Ziel taugt: Katalog 3, Resteverwertung 2, Amys Zutaten 1, eigene Einträge 0. */
export const rang = (k, katalog = {}) => (katalog[k] ? 3 : String(k).startsWith('ki-') ? 2 : String(k).startsWith('c-') ? 0 : 1);

/**
 * Welche Zeile in welche: [von, nach]. Erst der Rang, dann die mit mehr
 * Rezepten, dann der kürzere Name – oder, bei gleichem Rang, die Zeile, die
 * jemand ausdrücklich gewählt hat (wunsch).
 */
export function richtung([ka, a], [kb, b], katalog = {}, wunsch = null) {
  const ra = rang(ka, katalog);
  const rb = rang(kb, katalog);
  if (ra !== rb) return ra > rb ? [kb, ka] : [ka, kb];
  if (wunsch === ka || wunsch === kb) return wunsch === ka ? [kb, ka] : [ka, kb];
  const ta = teileVon(a).length;
  const tb = teileVon(b).length;
  if (ta !== tb) return ta > tb ? [kb, ka] : [ka, kb];
  return String(a?.name || '').length <= String(b?.name || '').length ? [kb, ka] : [ka, kb];
}

/**
 * Was die App zum Zusammenlegen vorschlägt: [{ von, nach, wert }], das
 * Ähnlichste zuerst. Nicht: zwei Zeilen aus dem Katalog, zwei Zeilen im
 * Wagen, Paare mit „Nein, verschieden“ – und Paare, die schon einmal
 * zusammengelegt wurden (dann ist die zweite Zeile mit Absicht da).
 */
export function vorschlaege(stand, katalog = {}, ab = VORSCHLAG_AB) {
  const zeilen = Object.entries(stand?.items || {});
  const nein = new Set(Array.isArray(stand?.ungleich) ? stand.ungleich : []);
  const aus = [];
  for (let i = 0; i < zeilen.length; i++) {
    for (let j = i + 1; j < zeilen.length; j++) {
      const [ka, a] = zeilen[i];
      const [kb, b] = zeilen[j];
      if ((katalog[ka] && katalog[kb]) || (erledigt(a) && erledigt(b))) continue;
      const ma = merkName(ka, a);
      const mb = merkName(kb, b);
      if (nein.has(paar(ma, mb)) || umleiten(stand.gleich, ma) === kb || umleiten(stand.gleich, mb) === ka) continue;
      const wert = aehnlich(a.name, b.name);
      if (wert < ab) continue;
      const [von, nach] = richtung([ka, a], [kb, b], katalog);
      aus.push({ von, nach, wert });
    }
  }
  return aus.sort((x, y) => y.wert - x.wert);
}
