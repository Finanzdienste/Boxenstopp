/*
 * Bilder in der App – ohne DOM, damit die Tests die Zuordnung direkt prüfen.
 *
 *   Zutaten   kleine Bildchen aus Microsofts Fluent Emoji (MIT-Lizenz, siehe
 *             bilder/zutaten/LIZENZ.txt): eins je Katalog-Schlüssel, für frei
 *             getippte Einträge nach Stichwort, sonst nach Abteilung. Die
 *             SVG-Dateien legt werkzeug/zutaten-bilder.mjs aus dem npm-Paket
 *             @iconify-json/fluent-emoji an – nur die, die hier vorkommen.
 *   Rezepte   ein Foto in bilder/rezepte/<id>.webp (KI, werkzeug/bilder.mjs),
 *             steht dann als `bild` in daten/rezepte.json. Ohne Foto zeigt die
 *             App ein Ersatzbild aus den Bildchen der Hauptzutaten.
 *   Angebote  die Produktfotos der Händler (Feld `bild` im Feed), sonst das
 *             Bildchen der Zutat.
 */

/** Katalog-Schlüssel → Bildchen. */
export const ZUTAT_BILD = {
  // Fleisch
  rinderhack: 'cut-of-meat', 'rinderhack-mager': 'cut-of-meat', rindergulasch: 'cut-of-meat', rinderhuefte: 'cut-of-meat',
  haehnchenbrust: 'poultry-leg', haehnchenkeule: 'poultry-leg', putenbrust: 'poultry-leg',
  // Obst und Gemüse
  zwiebeln: 'onion', 'rote-zwiebeln': 'onion', fruehlingszwiebeln: 'onion', knoblauch: 'garlic', ingwer: 'ginger-root',
  paprika: 'bell-pepper', zucchini: 'cucumber', gurke: 'cucumber', brokkoli: 'broccoli', blumenkohl: 'broccoli', moehren: 'carrot',
  champignons: 'brown-mushroom', spinat: 'leafy-green', spitzkohl: 'leafy-green', weisskohl: 'leafy-green', staudensellerie: 'leafy-green',
  lauch: 'leafy-green', kohlrabi: 'leafy-green', zuckerschoten: 'pea-pod', 'bohnen-gruen': 'pea-pod', tomaten: 'tomato', kirschtomaten: 'tomato',
  kartoffeln: 'potato', suesskartoffel: 'roasted-sweet-potato', aubergine: 'eggplant', limette: 'lime', zitrone: 'lemon', aepfel: 'red-apple',
  koriander: 'herb', basilikum: 'herb', petersilie: 'herb', dill: 'herb',
  // Kühlregal
  skyr: 'bowl-with-spoon', magerquark: 'bowl-with-spoon', joghurt: 'bowl-with-spoon', milch: 'glass-of-milk', kochsahne: 'glass-of-milk',
  schlagsahne: 'glass-of-milk', schmand: 'glass-of-milk', frischkaese: 'cheese-wedge', cheddar: 'cheese-wedge', parmesan: 'cheese-wedge',
  feta: 'cheese-wedge', mozzarella: 'cheese-wedge', 'mozzarella-light': 'cheese-wedge', butter: 'butter', eier: 'egg', tofu: 'package', gnocchi: 'dumpling',
  // Tiefkühl
  'tk-kraeuter': 'herb', erbsen: 'pea-pod', 'tk-brokkoli': 'broccoli', 'tk-blumenkohl': 'broccoli', 'tk-bohnen': 'pea-pod', 'tk-spinat': 'leafy-green',
  // Konserven
  'tomaten-dose': 'canned-food', passata: 'canned-food', tomatenmark: 'canned-food', kidney: 'beans', 'schwarze-bohnen': 'beans',
  kichererbsen: 'beans', 'linsen-dose': 'beans', mais: 'ear-of-corn', kokosmilch: 'coconut', 'kokosmilch-light': 'coconut', currypaste: 'jar',
  ajvar: 'jar', 'getr-tomaten': 'jar', pesto: 'jar', erdnussbutter: 'peanuts', 'ananas-dose': 'pineapple', gewuerzgurken: 'cucumber', oliven: 'olive',
  // Trockenes
  reis: 'cooked-rice', penne: 'spaghetti', spaghetti: 'spaghetti', hoernchen: 'spaghetti', kritharaki: 'spaghetti', lasagne: 'spaghetti',
  mie: 'spaghetti', vollkornnudeln: 'spaghetti', bandnudeln: 'spaghetti', couscous: 'sheaf-of-rice', bulgur: 'sheaf-of-rice',
  haferflocken: 'sheaf-of-rice', 'linsen-rot': 'beans', tortillas: 'flatbread', erdnuesse: 'peanuts', 'erdnuss-crunch': 'peanuts',
  mandeln: 'chestnut', cashews: 'chestnut', sesam: 'chestnut', rosinen: 'grapes', semmelbroesel: 'bread', 'whey-vanille': 'cup-with-straw',
  // Vorrat
  oel: 'olive', olivenoel: 'olive', sesamoel: 'olive', butterschmalz: 'butter', honig: 'honey-pot', mehl: 'sheaf-of-rice', zucker: 'package',
  staerke: 'package', kakao: 'package', sojasauce: 'jar', sweetchili: 'jar', 'bbq-sauce': 'jar', ketchup: 'jar', senf: 'jar', balsamico: 'jar',
  essig: 'jar', sriracha: 'hot-pepper',
  // Gewürze (die übrigen haben das Salzfässchen)
  'bruehe-rind': 'pot-of-food', 'bruehe-gemuese': 'pot-of-food', 'bruehe-huhn': 'pot-of-food', chiliflocken: 'hot-pepper', cayenne: 'hot-pepper',
  chilipulver: 'hot-pepper', lorbeer: 'herb', oregano: 'herb', thymian: 'herb', rosmarin: 'herb', majoran: 'herb', 'basilikum-getr': 'herb',
  'ital-kraeuter': 'herb', 'dill-getr': 'herb', 'kasuri-methi': 'herb', knoblauchpulver: 'garlic', zwiebelpulver: 'onion', 'ingwer-gem': 'ginger-root',
  // Haushalt
  boxen: 'bento-box', backpapier: 'roll-of-paper', doeschen: 'jar',
};

/** Abteilung (Katalog `c` bzw. `cat` eines Eintrags) → Bildchen, wenn es keins für den Schlüssel gibt. */
export const KAT_BILD = {
  fleisch: 'cut-of-meat', obst: 'leafy-green', kuehl: 'glass-of-milk', tk: 'ice', konserven: 'canned-food', trocken: 'cooked-rice',
  vorrat: 'jar', gewuerz: 'salt', haushalt: 'package', sonstiges: 'shopping-cart',
};

/* Für frei getippte Einträge („Bananen“, „Klopapier“): Stichwort → Bildchen. Reihenfolge zählt. */
const WORTE = [
  // Haushalt zuerst – „Zahnpasta“ ist keine Pasta
  [/klopapier|toilettenpapier|küchenrolle|taschentücher|backpapier/, 'roll-of-paper'], [/schwamm/, 'sponge'], [/müll/, 'wastebasket'],
  [/zahn/, 'toothbrush'], [/spül|seife|duschgel|shampoo|waschmittel|reiniger/, 'soap'],
  [/erdnuss|erdnüss/, 'peanuts'], [/banane/, 'banana'], [/äpfel|apfel/, 'red-apple'], [/birne/, 'pear'], [/traube/, 'grapes'], [/erdbeer/, 'strawberry'],
  [/heidelbeer|blaubeer/, 'blueberries'], [/kirsche/, 'cherries'], [/mango/, 'mango'], [/melone/, 'melon'], [/orange|mandarine|clementine/, 'tangerine'],
  [/kiwi/, 'kiwi-fruit'], [/ananas/, 'pineapple'], [/avocado/, 'avocado'], [/zitrone/, 'lemon'], [/limette/, 'lime'], [/pfirsich|nektarine/, 'peach'],
  [/tomate/, 'tomato'], [/gurke/, 'cucumber'], [/paprika/, 'bell-pepper'], [/zwiebel/, 'onion'], [/knoblauch/, 'garlic'], [/süßkartoffel/, 'roasted-sweet-potato'],
  [/kartoffel/, 'potato'], [/möhre|karotte/, 'carrot'], [/brokkoli|blumenkohl/, 'broccoli'], [/pilz|champignon/, 'brown-mushroom'],
  [/salat|spinat|kohl|lauch/, 'leafy-green'], [/mais/, 'ear-of-corn'], [/chili/, 'hot-pepper'], [/kräuter|petersilie|basilikum|schnittlauch/, 'herb'],
  [/croissant/, 'croissant'], [/brezel/, 'pretzel'], [/baguette/, 'baguette-bread'], [/brötchen|brot|toast/, 'bread'], [/\beier?\b/, 'egg'],
  [/joghurt|quark|skyr/, 'bowl-with-spoon'], [/milch|sahne/, 'glass-of-milk'], [/käse/, 'cheese-wedge'], [/butter/, 'butter'],
  [/hähnchen|huhn|pute|geflügel/, 'poultry-leg'], [/rind|steak|hack|fleisch/, 'cut-of-meat'], [/reis\b|reis /, 'cooked-rice'],
  [/nudel|pasta|spaghetti|penne/, 'spaghetti'], [/honig/, 'honey-pot'], [/nuss|nüsse|mandel/, 'chestnut'], [/kaffee/, 'hot-beverage'],
  [/\btee\b/, 'teacup-without-handle'], [/wasser|sprudel/, 'droplet'], [/saft|limo|cola|schorle/, 'beverage-box'], [/bier/, 'beer-mug'],
  [/wein|sekt/, 'wine-glass'], [/schoko/, 'chocolate-bar'], [/keks/, 'cookie'], [/eis\b|eiscreme/, 'ice-cream'], [/pizza/, 'pizza'],
  [/olivenöl|\böl\b/, 'olive'],
];

/** Das Bildchen für einen Eintrag: Katalog-Schlüssel, sonst Stichwort im Namen, sonst Abteilung. */
export function bildName(k, { name = '', cat = '', katalog = null } = {}) {
  if (k && ZUTAT_BILD[k]) return ZUTAT_BILD[k];
  const n = String(name || '').toLowerCase();
  if (n) for (const [re, b] of WORTE) if (re.test(n)) return b;
  const c = (katalog && k && katalog[k]?.c) || cat;
  return KAT_BILD[c] || KAT_BILD.sonstiges;
}

export const bildPfad = (b) => `bilder/zutaten/${b}.svg`;

/** <img> fürs Bildchen; dekorativ (alt=""), der Name steht daneben. */
export function zutatImg(k, { name = '', cat = '', katalog = null, klasse = 'zb', groesse = 28 } = {}) {
  return `<img class="${klasse}" src="${bildPfad(bildName(k, { name, cat, katalog }))}" alt="" width="${groesse}" height="${groesse}" loading="lazy" decoding="async">`;
}

/** Alle Bildchen, die die App braucht – für werkzeug/zutaten-bilder.mjs und die Tests. */
export const ALLE_BILDER = [...new Set([...Object.values(ZUTAT_BILD), ...Object.values(KAT_BILD), ...WORTE.map(([, b]) => b)])].sort();

/*
 * Bis zu drei Bildchen, die ein Rezept ausmachen – fürs Ersatzbild ohne Foto:
 * Eiweiß, Sättigungsbeilage, Gemüse (in dieser Reihenfolge, jedes nur einmal).
 */
export function rezeptBildchen(r, katalog = {}) {
  const items = (r?.items || []).filter((it) => it.k && !it.haus && !it.opt);
  const nach = (cs) => items.filter((it) => cs.includes(katalog[it.k]?.c)).map((it) => bildName(it.k, { katalog }));
  const eiweiss = nach(['fleisch']).concat(items.filter((it) => ['tofu', 'eier', 'kichererbsen', 'linsen-rot', 'kidney', 'skyr', 'magerquark'].includes(it.k)).map((it) => bildName(it.k)));
  const beilage = nach(['trocken']).concat(items.filter((it) => ['kartoffeln', 'suesskartoffel', 'gnocchi'].includes(it.k)).map((it) => bildName(it.k)));
  const gemuese = nach(['obst', 'tk']).filter((b) => !['onion', 'garlic', 'herb', 'lime', 'lemon', 'ginger-root', 'potato', 'roasted-sweet-potato'].includes(b));
  const aus = [];
  for (const liste of [eiweiss, beilage, gemuese]) {
    const b = liste.find((x) => !aus.includes(x));
    if (b) aus.push(b);
  }
  for (const b of nach(['obst', 'konserven', 'kuehl', 'tk'])) { if (aus.length >= 3) break; if (!aus.includes(b)) aus.push(b); }
  return aus.slice(0, 3);
}
