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

/**
 * Mengen in einen Schritt einsetzen: „{reis} Reis waschen“ → „280 g Reis
 * waschen“. Die Platzhalter tragen den Schlüssel der Zutat; so passen die
 * Schritte auch dann noch, wenn ein Rezept angepasst wurde. `weg` nennt
 * Zutaten, die es nicht mehr gibt – ihr Platzhalter wird zum Namen.
 */
export function platzhalter(text, items = [], weg = {}) {
  return String(text ?? '').replace(/\{([A-Za-z0-9_.-]{1,60})\}/g, (m, k) => {
    const it = items.find((x) => x.k === k || x.id === k);
    if (it && typeof it.q === 'number' && it.u) return menge(it.q, it.u);
    if (it && typeof it.menge === 'number') return menge(it.menge, it.einheit || 'g');
    if (weg[k]) return `(ohne ${weg[k]})`;
    return m;
  });
}

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
 * sonst bei der Milch landet und „Zahnpasta“ bei den Nudeln. Was nichts
 * trifft, steht unter „Sonstiges“ (bereiche.js).
 */
const STICHWORT = [
  ['haushalt', ['zahn', 'shampoo', 'duschgel', 'klopapier', 'toilettenpapier', 'spülmittel', 'waschmittel', 'müllbeutel', 'küchenrolle', 'alufolie', 'backpapier', 'frischhaltefolie', 'gefrierbeutel', 'deo', 'seife', 'batterie', 'boxen', 'döschen', 'spieß', 'spiess', 'schaschlik', 'schwamm', 'servietten', 'kerze', 'grillkohle', 'anzünder', 'zahnstocher', 'tüten', 'bürste', 'reiniger', 'putzmittel', 'lappen', 'taschentücher', 'feuchttücher', 'weichspüler', 'spültabs', 'tabs']],
  ['tk', ['tk', 'tiefkühl', 'eis', 'pommes', 'pizza']],
  ['gewuerz', ['salz', 'pfeffer', 'gewürz', 'paprikapulver', 'zimt', 'kümmel', 'oregano', 'thymian', 'rosmarin', 'majoran', 'kurkuma', 'muskat', 'cayenne', 'lorbeer', 'brühe', 'garam', 'chiliflocken', 'chilipulver', 'currypulver', 'vanillezucker']],
  ['vorrat', ['öl', 'essig', 'zucker', 'honig', 'sauce', 'soße', 'senf', 'ketchup', 'mayo', 'kaffee', 'tee', 'kakao', 'backpulver', 'hefe', 'stärke', 'dressing', 'sirup']],
  ['fleisch', ['hähnchen', 'huhn', 'hühnchen', 'pute', 'rind', 'hack', 'schwein', 'steak', 'schnitzel', 'wurst', 'würstchen', 'schinken', 'speck', 'salami', 'chicken', 'fleisch', 'lamm', 'filet', 'nugg', 'frikadelle', 'bulette', 'cevapcici', 'gyros', 'döner', 'bacon', 'chorizo']],
  ['konserven', ['dose', 'bohnen', 'mais', 'passata', 'tomatenmark', 'kokosmilch', 'kichererbsen', 'linsen', 'pesto', 'ajvar', 'erdnussbutter', 'marmelade', 'konfitüre', 'nutella']],
  ['kuehl', ['milch', 'joghurt', 'quark', 'skyr', 'käse', 'sahne', 'butter', 'ei', 'frischkäse', 'mozzarella', 'feta', 'schmand', 'tofu', 'hummus', 'margarine']],
  ['obst', ['apfel', 'äpfel', 'banane', 'melone', 'beere', 'traube', 'birne', 'orange', 'mandarine', 'zitrone', 'limette', 'salat', 'gurke', 'tomate', 'paprika', 'zwiebel', 'knoblauch', 'kartoffel', 'möhre', 'karotte', 'brokkoli', 'zucchini', 'pilz', 'champignon', 'spinat', 'kräuter', 'avocado', 'ingwer', 'lauch', 'kohl', 'kiwi', 'mango', 'ananas', 'obst', 'gemüse', 'rucola', 'petersilie', 'basilikum', 'koriander']],
  ['trocken', ['reis', 'nudel', 'pasta', 'spaghetti', 'penne', 'gnocchi', 'mehl', 'hafer', 'müsli', 'cornflakes', 'brot', 'toast', 'wrap', 'tortilla', 'nüsse', 'mandeln', 'crunch', 'chips', 'whey', 'protein', 'crouton', 'cracker', 'zwieback', 'knäcke', 'brötchen']],
];
export function abteilung(text, katalog = {}) {
  const klein = String(text).toLowerCase().trim();
  for (const v of Object.values(katalog)) if (v.n.toLowerCase() === klein) return v.c;
  const woerter = klein.split(/[^\p{L}]+/u).filter(Boolean);
  for (const [abt, liste] of STICHWORT) {
    for (const wort of liste) {
      for (const w of woerter) {
        const treffer = wort.length <= 3
          ? (w === wort || ((wort === 'öl' || wort === 'tee') && w.endsWith(wort)) || (wort === 'ei' && w === 'eier'))
          : w.includes(wort);
        if (treffer) return abt;
      }
    }
  }
  return 'sonstiges';
}

/** Woran die App eine Zutat über ihren Namen wiedererkennt: „Chicken Nuggets“ → „n:chicken-nuggets“. */
export const nameSchluessel = (name) => `n:${String(name || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)}`;

/**
 * Wohin ein Schlüssel nach dem Zusammenlegen zeigt (liste.js `gleich`):
 * „amyz-leckere-dino-nuggies“ → „amyz-dino-nuggets“. Höchstens sechs
 * Sprünge, damit ein Kreis im Stand nie hängen bleibt.
 */
export function umleiten(gleich, k) {
  let x = String(k);
  for (let i = 0; i < 6 && gleich && typeof gleich === 'object' && typeof gleich[x] === 'string' && gleich[x] !== x; i++) x = gleich[x];
  return x;
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
