#!/usr/bin/env node
/*
 * Rezeptfotos mit KI: Cloudflare Workers AI, Modell FLUX.1 [schnell], im
 * Gratis-Kontingent (10 000 „Neurons“ am Tag, ein Foto braucht gut 75).
 * Läuft als GitHub Action (.github/workflows/bilder.yml) mit den Secrets
 * CF_ACCOUNT_ID und CF_API_TOKEN, zur Not auch von Hand:
 *
 *     CF_ACCOUNT_ID=… CF_API_TOKEN=… node werkzeug/bilder.mjs           # alle ohne Foto
 *     CF_ACCOUNT_ID=… CF_API_TOKEN=… node werkzeug/bilder.mjs chili dal # nur diese, auch neu
 *
 * Jedes Foto wird 800 × 600 als WebP nach bilder/rezepte/<id>.webp gelegt;
 * werkzeug/rezepte.py trägt es danach als `bild` in daten/rezepte.json ein.
 * Braucht das npm-Paket sharp (die Action installiert es nur für den Lauf).
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(ROOT, 'bilder', 'rezepte');
const KONTO = process.env.CF_ACCOUNT_ID || '';
const TOKEN = process.env.CF_API_TOKEN || '';
const MODELL = '@cf/black-forest-labs/flux-1-schnell';
const SCHRITTE = 6; // 4 ist die Vorgabe, 8 das Höchste – 6 sieht deutlich besser aus als 4 und kostet wenig mehr

// Bildaufbau für alle gleich: eine Meal-Prep-Box von oben, Tageslicht, Holztisch
const VORN = 'Realistic food photography, top-down view of one rectangular glass meal prep container filled with';
const HINTEN = 'on a light oak kitchen table, soft natural window light, appetizing, sharp focus, no text, no labels, no people, no hands.';

/** Was in der Box ist, je Rezept auf Englisch – damit das Bild zum Rezept passt. */
export const MOTIVE = {
  chili: 'chili con carne with ground beef, kidney beans, corn and roasted sweet potato cubes, topped with chopped parsley',
  'butter-chicken': 'butter chicken in creamy orange tomato sauce next to basmati rice, sprinkled with cilantro',
  gulasch: 'beef goulash with red peppers and onions in rich dark paprika gravy next to boiled potatoes',
  'tomaten-pasta': 'penne in creamy tomato sauce with chicken pieces, sun-dried tomatoes, spinach and grated parmesan',
  'mac-cheese': 'macaroni in cheddar cheese sauce with roasted chicken pieces and broccoli florets',
  teriyaki: 'glossy teriyaki chicken thigh slices on white rice with broccoli and carrots, sprinkled with sesame seeds',
  'thai-curry': 'Thai red curry with chicken, red bell pepper and green beans in coconut sauce next to jasmine rice, a lime wedge',
  'burrito-bowl': 'burrito bowl with seasoned chicken, lime rice, black beans, corn, sautéed peppers, tomato salsa, grated cheddar and a dollop of sour cream',
  gyros: 'Greek chicken gyros strips with onions on tomato orzo pasta, crumbled feta and a spoon of tzatziki',
  bolognese: 'spaghetti bolognese with rich slow-cooked meat sauce and grated parmesan',
  lasagne: 'a square slice of beef lasagne with béchamel and a golden baked parmesan crust',
  'ofen-haehnchen': 'roasted chicken pieces with rosemary potatoes, bell pepper and zucchini, a small cup of herb quark',
  'erdnuss-nudeln': 'stir-fried egg noodles with chicken, carrots, bell pepper and snow peas in peanut lime sauce, crushed peanuts',
  geschnetzeltes: 'creamy turkey strips with browned mushrooms in cream sauce next to rice, fresh thyme',
  'balkan-pfanne': 'spiced ground beef with pan-fried potatoes and red peppers in ajvar sauce, crumbled feta, a small cup of garlic yogurt',
  gnocchi: 'crispy pan-fried gnocchi with chicken, cherry tomatoes and spinach in creamy tomato sauce, parmesan',
  'gelbes-curry': 'mild yellow coconut curry with chicken, sweet potato and spinach next to basmati rice, a lime wedge',
  'shawarma-bowl': 'spiced chicken shawarma slices on bulgur with tomato cucumber salad and garlic yogurt sauce',
  jambalaya: 'Cajun jambalaya rice with chicken thigh, bell peppers, celery and red beans',
  frikassee: 'German chicken fricassee with peas, carrots and mushrooms in creamy lemon sauce next to rice',
  'kung-pao': 'kung pao chicken with bell peppers, zucchini and roasted peanuts in glossy sauce next to rice',
  'honig-senf': 'honey mustard glazed chicken with crispy roasted potato cubes and green broccoli',
  'pesto-nudelsalat': 'cold pesto pasta salad with penne, grilled chicken, cherry tomatoes, baby spinach and mozzarella pearls',
  'sweet-chili': 'crispy sweet chili chicken with bell pepper, broccoli and carrots, roasted cashews, next to rice',
  'zitronen-couscous': 'lemon herb chicken with roasted zucchini, peppers and red onions on couscous with crumbled feta',
  biryani: 'chicken biryani with basmati rice, fried onions, peas and fresh cilantro',
  enchilada: 'a slice of chicken enchilada casserole with tortillas, black beans, corn and melted cheddar in red sauce',
  schaschlik: 'chicken shashlik skillet with peppers and onions in sweet tangy red sauce next to rice',
  paprikahuhn: 'Hungarian paprika chicken in creamy red pepper sauce with tagliatelle noodles',
  'gebratener-reis': 'Chinese fried rice with chicken, scrambled egg, peas, carrots and spring onions',
  'haehnchen-eintopf': 'hearty chicken and potato stew with leeks, carrots, celery and peas',
  'pasta-limone': 'spaghetti al limone in creamy lemon parmesan sauce with chicken slices and broccoli',
  'kichererbsen-curry': 'Indian chicken and chickpea curry with spinach in tomato coconut sauce next to basmati rice',
  'suesskartoffel-blech': 'roasted sweet potato cubes with chicken, red peppers and red onion, crumbled feta and baby spinach',
  'beef-broccoli': 'beef and broccoli stir-fry with thin beef strips in glossy soy ginger sauce, sesame and cashews, next to rice',
  koettbullar: 'Swedish meatballs in brown cream gravy with mashed potatoes and green peas',
  'cottage-pie': 'a portion of cottage pie, ground beef with carrots and peas under a golden mashed potato crust',
  moussaka: 'a slice of moussaka with layers of eggplant, potato and minced beef under golden béchamel',
  'taco-reis': 'taco rice skillet with ground beef, rice, peppers, corn and kidney beans topped with melted cheddar',
  hackbaellchen: 'beef meatballs in garlic tomato sauce on spaghetti with grated parmesan',
  'kohl-hack': 'German cabbage and ground beef skillet with potatoes and carrots, a dollop of sour cream',
  frikadellen: 'German beef patties with creamy potato salad with cucumber and pickles',
  giouvetsi: 'Greek giouvetsi, orzo baked in tomato beef sauce with zucchini, topped with crumbled feta',
  'orient-bulgur': 'spiced ground beef with chickpeas, peppers and zucchini in tomato sauce with bulgur and feta',
  massaman: 'massaman beef curry with potatoes, onions and green beans in coconut sauce, topped with peanuts',
  'puten-ananas-curry': 'mild coconut curry with turkey breast, pineapple chunks, red pepper and peas next to rice',
  'puten-pilaw': 'turkey pilaf rice with carrots, chickpeas, raisins and toasted almonds, a small cup of yogurt',
  dal: 'creamy red lentil coconut dal with tomatoes, spinach and chicken next to basmati rice',
  cheeseburger: 'cheeseburger skillet with ground beef, potatoes, onions, pickles and melted cheddar',
  'pulled-chicken': 'BBQ pulled chicken with roasted potato wedges and creamy coleslaw',
};

/** Der Auftrag fürs Bild; ein Rezept ohne Motiv bekommt Name und Beschreibung. */
export const auftrag = (r) => `${VORN} ${MOTIVE[r.id] || `${r.name}: ${r.desc}`}, ${HINTEN}`;

async function main() {
  if (!KONTO || !TOKEN) { console.log('Ohne CF_ACCOUNT_ID und CF_API_TOKEN keine Fotos.'); return; }
  const { default: sharp } = await import('sharp');
  const rezepte = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8')).rezepte;
  const nur = process.argv.slice(2);
  const ziele = nur.length ? rezepte.filter((r) => nur.includes(r.id)) : rezepte.filter((r) => !existsSync(path.join(ZIEL, `${r.id}.webp`)));
  mkdirSync(ZIEL, { recursive: true });
  console.log(`${ziele.length} Foto${ziele.length === 1 ? '' : 's'} zu machen`);
  let gemacht = 0;
  for (const r of ziele) {
    let res;
    let j = null;
    try {
      res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${KONTO}/ai/run/${MODELL}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
        // Einen festen Zufall (seed) nimmt die Schnittstelle nicht an – jedes Neumachen gibt ein anderes Bild
        body: JSON.stringify({ prompt: auftrag(r), steps: SCHRITTE }),
      });
      j = await res.json().catch(() => null);
    } catch (e) {
      console.log(`${r.id}: keine Verbindung (${e?.message || e})`);
      continue;
    }
    if (!res.ok || !j?.success || !j?.result?.image) {
      const grund = (j?.errors || []).map((e) => `${e.code || ''} ${e.message || ''}`.trim()).join('; ') || `HTTP ${res.status}`;
      console.log(`${r.id}: abgelehnt – ${grund}`);
      // Tageskontingent aufgebraucht oder Schlüssel falsch: weitere Versuche sind sinnlos
      if (res.status === 429 || res.status === 401 || res.status === 403 || /limit|quota|neuron/i.test(grund)) break;
      continue;
    }
    const roh = Buffer.from(j.result.image, 'base64');
    const info = await sharp(roh).metadata();
    const datei = path.join(ZIEL, `${r.id}.webp`);
    await sharp(roh).resize(800, 600, { fit: 'cover', position: 'centre' }).webp({ quality: 72 }).toFile(datei);
    gemacht++;
    console.log(`${r.id}: ok (${info.width}×${info.height} → 800×600, ${Math.round(readFileSync(datei).length / 1024)} KB)`);
  }
  console.log(`${gemacht} von ${ziele.length} Fotos gemacht`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
