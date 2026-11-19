#!/usr/bin/env node
/*
 * Fotos für die Rezepte, die nicht fest in der App stehen: gewünschte aus dem
 * Katalog (katalog.json), behaltene KI-Rezepte (liste.json unter `ki`) und
 * Amys eigene (liste.json unter `amy`). Dasselbe Modell wie die Rezeptfotos
 * (werkzeug/bilder.mjs), nur steht das Motiv nicht in MOTIVE: Name,
 * Beschreibung und die Namen der Zutaten – nie Amys Notizen.
 *
 * Läuft als GitHub Action (.github/workflows/eigene-fotos.yml): Sie holt die
 * zwei Dateien mit dem Secret DATEN_TOKEN (nur lesen) aus dem Daten-Repo und
 * legt die Fotos öffentlich hierher (Tobi, 19.11.2026: „wir können alle unsere
 * Infos ruhig veröffentlichen“):
 *
 *   bilder/eigene/<id>.webp   800 × 600, wie die Rezeptfotos
 *   daten/fotos.json          { v: 1, fotos: { <id>: { bild, q } } } – bild mit
 *                             Prüfsumme (?v=…), q sagt, zu welchem Namen das
 *                             Foto gehört: Heißt ein Rezept anders, kommt ein neues
 *
 *     node werkzeug/eigene-fotos.mjs --daten privat              # was fehlt
 *     node werkzeug/eigene-fotos.mjs --daten privat --zaehlen    # nur sagen, ob es was zu tun gibt
 *     node werkzeug/eigene-fotos.mjs --daten privat kat-abc123   # diese neu
 *
 * Ins Protokoll (öffentlich) kommen nur ids.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VORN, HINTEN, fotoMachen } from './bilder.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ORDNER = 'bilder/eigene';
export const INDEX = 'daten/fotos.json';
/** So viele Fotos höchstens je Lauf – das Gratis-Kontingent reicht für gut 130 am Tag, die festen Rezepte brauchen auch mal welche. */
export const JE_LAUF = 25;
const ID = /^[a-z0-9-]{3,80}$/;

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const kurzHash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10);

const EINHEIT = /^(?:g|kg|ml|l|el|tl|esslöffel|teelöffel|stk\.?|stück|prisen?|dosen?|packung(?:en)?|pck\.?|becher|bund|zehen?|scheiben?|handvoll|schuss|tassen?|glas|gläser|flaschen?|beutel|große[nrs]?|kleine[nrs]?|halbe[nrs]?|groben?|grobe[nrs]?|feine[nrs]?|frische[nrs]?|etwas|ein(?:e[nrs]?)?)$/i;
/** Was man im Foto nicht sieht – kommt nicht in den Auftrag. */
const UNSICHTBAR = /^(?:salz|pfeffer|öl|olivenöl|rapsöl|wasser|zucker|backpulver|natron|hefe)$/i;

/** Aus Amys Zeile („1 Handvoll groben Parmesan“, „g+ 75g Cheddar“) nur das, was es ist. */
export function zutatOhneMenge(zeile) {
  const worte = text(zeile, 80).replace(/\(.*?\)/g, ' ').replace(/[+]/g, ' ')
    .replace(/\d+(?:[.,/]\d+)?\s*(?:g|kg|ml|l)?\b/gi, ' ').replace(/[½¼¾⅓]/g, ' ')
    .split(/\s+/).filter(Boolean);
  while (worte.length && (EINHEIT.test(worte[0]) || /^[-–.,]+$/.test(worte[0]))) worte.shift();
  const z = worte.join(' ');
  return UNSICHTBAR.test(z) ? '' : z;
}

/** Ein KI-Rezept (Katalog, liste.json `ki`) als Motiv. */
function kiMotiv(k) {
  const name = text(k?.name, 120);
  if (!name) return null;
  const zutaten = (Array.isArray(k.zutaten) ? k.zutaten : []).filter((z) => z?.quelle !== 'vorrat')
    .map((z) => text(String(z?.name || '').split(',')[0], 40)).filter((z) => z && !UNSICHTBAR.test(z)).slice(0, 8);
  const besch = text(String(k.beschreibung || '').split(' – ')[0], 200);
  return { name, auftrag: `${VORN} ${name}${besch ? ` – ${besch}` : ''}${zutaten.length ? ` (with ${zutaten.join(', ')})` : ''}, ${HINTEN}` };
}

/** Amys Rezept: nicht unbedingt eine Box – ein Teller. */
function amyMotiv(r) {
  const name = text(r?.name, 120);
  if (!name) return null;
  const zutaten = (Array.isArray(r.zutaten) ? r.zutaten : []).map(zutatOhneMenge).filter(Boolean).slice(0, 8);
  return { name, auftrag: `Realistic food photography, top-down view of ${name}${zutaten.length ? ` (made with ${zutaten.join(', ')})` : ''}, served on a plate ${HINTEN}` };
}

/**
 * Welche Rezepte ein Foto haben sollen: id → { name, auftrag, q }. q hängt
 * nur am Namen – wer bei Amy eine Zutat ändert, behält das Foto.
 */
export function motive({ katalog = null, liste = null } = {}) {
  const aus = {};
  const dazu = (id, m) => { if (m && ID.test(id) && !aus[id]) aus[id] = { ...m, q: kurzHash(m.name) }; };
  for (const [id, e] of Object.entries(istObj(katalog?.rezepte) ? katalog.rezepte : {})) dazu(id, kiMotiv(e?.k));
  for (const [id, e] of Object.entries(istObj(liste?.ki) ? liste.ki : {})) dazu(id, kiMotiv(e?.r));
  for (const [id, r] of Object.entries(istObj(liste?.amy) ? liste.amy : {})) dazu(id, amyMotiv(r));
  return aus;
}

/** Der Index, wie er im Repo liegt – Kaputtes fällt weg. */
export function indexBereinigen(roh) {
  const fotos = {};
  for (const [id, e] of Object.entries(istObj(roh?.fotos) ? roh.fotos : {})) {
    if (ID.test(id) && istObj(e) && typeof e.bild === 'string' && e.bild.startsWith(`${ORDNER}/${id}.webp`)) fotos[id] = { bild: e.bild, q: text(e.q, 20) };
  }
  return { v: 1, fotos };
}

/**
 * Was zu tun ist: machen (ids, höchstens JE_LAUF, neue zuerst in der
 * Reihenfolge von soll) und weg (ids, deren Rezept es nicht mehr gibt).
 * nur: diese ids neu, auch wenn sie ein Foto haben.
 */
export function plan(soll, index, { nur = [], da = () => true } = {}) {
  const ist = index.fotos;
  const machen = Object.keys(soll).filter((id) => (nur.length ? nur.includes(id) : !ist[id] || ist[id].q !== soll[id].q || !da(id)));
  const weg = Object.keys(ist).filter((id) => !soll[id]);
  return { machen: machen.slice(0, JE_LAUF), weg };
}

function lesen(datei) {
  try { return JSON.parse(readFileSync(datei, 'utf8')); } catch { return null; }
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--daten');
  const daten = i >= 0 ? args[i + 1] : '';
  const zaehlen = args.includes('--zaehlen');
  const nur = args.filter((a, j) => !a.startsWith('--') && j !== i + 1);
  if (!daten || !existsSync(daten)) { console.log('Ohne --daten <Ordner mit katalog.json und liste.json> nichts zu tun.'); return; }
  const soll = motive({ katalog: lesen(path.join(daten, 'katalog.json')), liste: lesen(path.join(daten, 'liste.json')) });
  const indexDatei = path.join(ROOT, INDEX);
  const index = indexBereinigen(lesen(indexDatei));
  const datei = (id) => path.join(ROOT, ORDNER, `${id}.webp`);
  const { machen, weg } = plan(soll, index, { nur, da: (id) => existsSync(datei(id)) });
  console.log(`${Object.keys(soll).length} Rezepte, ${machen.length} Foto${machen.length === 1 ? '' : 's'} zu machen, ${weg.length} weg`);
  if (zaehlen) {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `arbeit=${machen.length + weg.length}\n`);
    return;
  }
  for (const id of weg) {
    if (existsSync(datei(id))) unlinkSync(datei(id));
    delete index.fotos[id];
    console.log(`${id}: weg`);
  }
  if (machen.length) {
    const konto = process.env.CF_ACCOUNT_ID || '';
    const token = process.env.CF_API_TOKEN || '';
    if (!konto || !token) { console.log('Ohne CF_ACCOUNT_ID und CF_API_TOKEN keine Fotos.'); machen.length = 0; }
    const { default: sharp } = machen.length ? await import('sharp') : { default: null };
    mkdirSync(path.join(ROOT, ORDNER), { recursive: true });
    for (const id of machen) {
      const f = await fotoMachen(soll[id].auftrag, datei(id), { sharp, konto, token });
      console.log(`${id}: ${f.text}`);
      if (f.ok) index.fotos[id] = { bild: `${ORDNER}/${id}.webp?v=${createHash('sha1').update(readFileSync(datei(id))).digest('hex').slice(0, 8)}`, q: soll[id].q };
      if (f.stopp) break;
    }
  }
  const sortiert = { v: 1, fotos: Object.fromEntries(Object.entries(index.fotos).sort(([a], [b]) => a.localeCompare(b))) };
  writeFileSync(indexDatei, `${JSON.stringify(sortiert, null, 1)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
