/*
 * Zahlen, Mengen und kurze Texte für die Anzeige.
 *
 * Ohne DOM und ohne Speicher, damit tests/test-liste.mjs alles hier direkt in
 * Node prüfen kann.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Für alles, was in innerHTML landet – auch eigene Einträge vom anderen Handy. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const nf1 = (x) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const nfi = (x) => Math.round(Number(x)).toLocaleString('de-DE');
const nfmax = (x, d) => Number(x).toLocaleString('de-DE', { maximumFractionDigits: d });

const EINHEIT = {
  g: (n) => (n >= 1000 ? `${nfmax(n / 1000, 3)} kg` : `${nfi(n)} g`),
  ml: (n) => (n >= 1000 ? `${nfmax(n / 1000, 3)} l` : `${nfi(n)} ml`),
  Stk: (n) => `${nfmax(n, 1)} Stk.`,
  Dose: (n) => `${nfmax(n, 1)} ${n === 1 ? 'Dose' : 'Dosen'}`,
  Glas: (n) => `${nfmax(n, 1)} ${n === 1 ? 'Glas' : 'Gläser'}`,
  Bund: (n) => `${nfmax(n, 1)} Bund`,
  Zehe: (n) => `${nfmax(n, 1)} ${n === 1 ? 'Zehe' : 'Zehen'}`,
  Stange: (n) => `${nfmax(n, 1)} ${n === 1 ? 'Stange' : 'Stangen'}`,
  Pck: (n) => `${nfmax(n, 1)} ${n === 1 ? 'Packung' : 'Packungen'}`,
};

/** 1275, 'g' → „1,275 kg“; 2, 'Dose' → „2 Dosen“. */
export const menge = (q, u) => (EINHEIT[u] ? EINHEIT[u](q) : `${nfmax(q, 1)} ${u}`);

/** Grobe Stückzahl zu Grammangaben, damit man im Laden nicht rechnen muss. */
const STUECK = {
  zwiebeln: ['g', 100, 'Stück', 'Stück'],
  'rote-zwiebeln': ['g', 100, 'Stück', 'Stück'],
  moehren: ['g', 100, 'Stück', 'Stück'],
  tomaten: ['g', 100, 'Stück', 'Stück'],
  aepfel: ['g', 150, 'Stück', 'Stück'],
  knoblauch: ['Zehe', 10, 'Knolle', 'Knollen'],
};
export function ungefaehr(k, summen) {
  const a = STUECK[k];
  if (!a || !summen[a[0]]) return '';
  const n = a[0] === 'Zehe' ? Math.ceil(summen[a[0]] / a[1]) : Math.max(1, Math.round(summen[a[0]] / a[1]));
  return `≈ ${n} ${n === 1 ? a[2] : a[3]}`;
}

/*
 * Abteilung für einen selbst eingetippten Eintrag. Erst der genaue Name aus
 * dem Katalog, dann Stichwörter – in dieser Reihenfolge, weil „Kokosmilch“
 * sonst bei der Milch landet und „Zahnpasta“ bei den Nudeln.
 */
const STICHWORT = [
  ['sonstiges', ['zahn', 'shampoo', 'duschgel', 'klopapier', 'toilettenpapier', 'spülmittel', 'waschmittel', 'müllbeutel', 'küchenrolle', 'alufolie', 'backpapier', 'frischhaltefolie', 'deo', 'seife', 'batterie', 'boxen']],
  ['tk', ['tk', 'tiefkühl', 'eis', 'pommes', 'pizza']],
  ['vorrat', ['öl', 'essig', 'salz', 'pfeffer', 'gewürz', 'zucker', 'honig', 'sauce', 'soße', 'senf', 'ketchup', 'mayo', 'brühe', 'paprikapulver', 'zimt', 'kaffee', 'tee']],
  ['fleisch', ['hähnchen', 'huhn', 'hühnchen', 'pute', 'rind', 'hack', 'schwein', 'steak', 'schnitzel', 'wurst', 'würstchen', 'schinken', 'speck', 'salami', 'chicken', 'fleisch', 'lamm', 'filet']],
  ['konserven', ['dose', 'bohnen', 'mais', 'passata', 'tomatenmark', 'kokosmilch', 'kichererbsen', 'linsen', 'pesto', 'ajvar', 'erdnussbutter', 'marmelade', 'konfitüre', 'nutella']],
  ['kuehl', ['milch', 'joghurt', 'quark', 'skyr', 'käse', 'sahne', 'butter', 'ei', 'frischkäse', 'mozzarella', 'feta', 'schmand', 'gnocchi', 'tofu', 'hummus', 'margarine']],
  ['obst', ['apfel', 'äpfel', 'banane', 'melone', 'beere', 'traube', 'birne', 'orange', 'mandarine', 'zitrone', 'limette', 'salat', 'gurke', 'tomate', 'paprika', 'zwiebel', 'knoblauch', 'kartoffel', 'möhre', 'karotte', 'brokkoli', 'zucchini', 'pilz', 'champignon', 'spinat', 'kräuter', 'avocado', 'ingwer', 'lauch', 'kohl', 'kiwi', 'mango', 'ananas', 'obst', 'gemüse', 'rucola', 'petersilie', 'basilikum', 'koriander']],
  ['trocken', ['reis', 'nudel', 'pasta', 'spaghetti', 'penne', 'mehl', 'hafer', 'müsli', 'cornflakes', 'brot', 'toast', 'wrap', 'tortilla', 'nüsse', 'mandeln', 'crunch', 'chips']],
];
export function abteilung(text, katalog = {}) {
  const klein = String(text).toLowerCase().trim();
  for (const v of Object.values(katalog)) if (v.n.toLowerCase() === klein) return v.c;
  const woerter = klein.split(/[^\p{L}]+/u).filter(Boolean);
  for (const [abt, liste] of STICHWORT) {
    for (const wort of liste) {
      for (const w of woerter) {
        const treffer = wort.length <= 3
          ? (w === wort || (wort === 'öl' && w.endsWith('öl')) || (wort === 'ei' && w === 'eier'))
          : w.includes(wort);
        if (treffer) return abt;
      }
    }
  }
  return 'sonstiges';
}

/** Heute als JJJJ-MM-TT in der Zeitzone des Handys. */
export function heute(jetzt = new Date()) {
  return `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
}

/** '2026-10-26' → „26.10.“ */
export function tagKurz(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${Number(m[3])}.${Number(m[2])}.` : '';
}

/** Uhrzeit „18:04“ für „zuletzt abgeglichen“. */
export const uhrzeit = (d) => (d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '');

/** Abweichung vom Ziel: „genau“, „+0,8“, „−9“. */
export function abweichung(wert, ziel, ganz) {
  const d = wert - ziel;
  if (Math.abs(d) < (ganz ? 0.5 : 0.05)) return 'genau';
  return (d > 0 ? '+' : '−') + (ganz ? nfi(Math.abs(d)) : nf1(Math.abs(d)));
}
