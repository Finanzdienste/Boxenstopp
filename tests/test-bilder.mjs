/*
 * Bilder ohne Browser: jede Zutat hat ein Bildchen, jedes Bildchen gibt es
 * als Datei, jedes Rezept hat sein Foto mit der passenden Prüfsumme.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pruefer, ROOT } from './hilfe.mjs';
import { ZUTAT_BILD, KAT_BILD, ALLE_BILDER, bildName, bildPfad, zutatImg, rezeptBildchen } from '../js/bilder.js';
import { MOTIVE, auftrag } from '../werkzeug/bilder.mjs';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const { katalog, rezepte } = daten;

// --- Zutaten-Bildchen
const ohne = Object.keys(katalog).filter((k) => !ZUTAT_BILD[k] && !KAT_BILD[katalog[k].c]);
check(!ohne.length, `jede Zutat aus dem Katalog hat ein Bildchen (eigens oder nach Abteilung)${ohne.length ? `: ${ohne.join(', ')}` : ''}`);
const fremd = Object.keys(ZUTAT_BILD).filter((k) => !katalog[k]);
check(!fremd.length, `kein Bildchen für einen Schlüssel, den es nicht gibt${fremd.length ? `: ${fremd.join(', ')}` : ''}`);
const fehlen = ALLE_BILDER.filter((b) => !existsSync(path.join(ROOT, bildPfad(b))));
check(!fehlen.length, `alle ${ALLE_BILDER.length} Bildchen liegen als Datei in bilder/zutaten${fehlen.length ? ` – es fehlen ${fehlen.join(', ')} (node werkzeug/zutaten-bilder.mjs)` : ''}`);
const dateien = readdirSync(path.join(ROOT, 'bilder', 'zutaten')).filter((f) => f.endsWith('.svg'));
check(dateien.length === ALLE_BILDER.length && existsSync(path.join(ROOT, 'bilder', 'zutaten', 'LIZENZ.txt')), `keine übrigen Dateien, die MIT-Lizenz liegt dabei (${dateien.length} SVG)`);
const liste = JSON.parse(readFileSync(path.join(ROOT, 'bilder', 'zutaten', 'alle.json'), 'utf8'));
check(JSON.stringify(liste) === JSON.stringify(ALLE_BILDER), 'bilder/zutaten/alle.json (für den Service Worker) passt zu js/bilder.js');
const svg = readFileSync(path.join(ROOT, bildPfad('tomato')), 'utf8');
check(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"') && !/<script|on\w+=/i.test(dateien.map((f) => readFileSync(path.join(ROOT, 'bilder', 'zutaten', f), 'utf8')).join('')), 'die SVGs sind eigenständig und ohne Skript');

check(bildName('haehnchenbrust') === 'poultry-leg' && bildName('salz', { katalog }) === 'salt' && bildName('', { name: 'Bananen' }) === 'banana' && bildName('', { name: 'Zahnpasta' }) === 'toothbrush' && bildName('', { name: 'Erdnüsse' }) === 'peanuts' && bildName('', { name: 'Walnüsse' }) === 'chestnut', 'Schlüssel vor Stichwort; Haushalt vor Essen (Zahnpasta ist keine Pasta)');
check(bildName('', { name: 'Erdnussbutter' }) === 'peanuts' && bildName('', { name: 'Irgendwas', cat: 'kuehl' }) === 'glass-of-milk' && bildName('', { name: 'Irgendwas' }) === 'shopping-cart', 'sonst nach Abteilung, ganz ohne alles der Einkaufswagen');
check(zutatImg('eier') === '<img class="zb" src="bilder/zutaten/egg.svg" alt="" width="28" height="28" loading="lazy" decoding="async">', 'das <img>: dekorativ, feste Größe, faul geladen');

// --- Ersatzbild für Rezepte ohne Foto
const proben = rezepte.map((r) => [r.id, rezeptBildchen(r, katalog)]);
check(proben.every(([, l]) => l.length >= 2 && l.length <= 3 && new Set(l).size === l.length), `Ersatzbild: zwei bis drei verschiedene Bildchen je Rezept (${proben.filter(([, l]) => l.length < 2).map(([id]) => id).join(', ') || 'alle'})`);
const chili = Object.fromEntries(proben).chili;
check(chili[0] === 'cut-of-meat' && chili.includes('roasted-sweet-potato'), `Chili: Rind vorn, Süßkartoffel dabei (${chili.join(', ')})`);

// --- Rezeptfotos
// Ein neues Rezept bekommt sein Foto erst von der Action „Rezeptfotos“ (nach dem Push) – bis dahin
// zeigt die App Bildchen. Darum hier nur: jedes Foto gehört zu einem Rezept und steht darin.
const fotoDateien = readdirSync(path.join(ROOT, 'bilder', 'rezepte')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5));
const verwaist = fotoDateien.filter((id) => !rezepte.some((r) => r.id === id));
check(!verwaist.length, `jedes Foto gehört zu einem Rezept${verwaist.length ? ` – übrig: ${verwaist.join(', ')}` : ''}`);
const nichtDrin = rezepte.filter((r) => fotoDateien.includes(r.id) !== Boolean(r.bild)).map((r) => r.id);
check(!nichtDrin.length, `jedes Foto steht im Rezept, kein Rezept zeigt auf ein fehlendes (${rezepte.filter((r) => r.bild).length} von ${rezepte.length} mit Foto)${nichtDrin.length ? ` – falsch: ${nichtDrin.join(', ')} (python3 werkzeug/rezepte.py)` : ''}`);
const falsch = rezepte.filter((r) => r.bild).filter((r) => {
  const m = r.bild.match(/^bilder\/rezepte\/([a-z0-9-]+)\.webp\?v=([0-9a-f]{8})$/);
  if (!m || m[1] !== r.id) return true;
  const datei = path.join(ROOT, 'bilder', 'rezepte', `${r.id}.webp`);
  return !existsSync(datei) || createHash('sha1').update(readFileSync(datei)).digest('hex').slice(0, 8) !== m[2];
}).map((r) => r.id);
check(!falsch.length, `die Adresse jedes Fotos passt zur Datei (Prüfsumme)${falsch.length ? ` – falsch: ${falsch.join(', ')} (python3 werkzeug/rezepte.py)` : ''}`);
const gross = rezepte.filter((r) => r.bild && readFileSync(path.join(ROOT, 'bilder', 'rezepte', `${r.id}.webp`)).length > 120 * 1024).map((r) => r.id);
check(!gross.length, `kein Foto über 120 KB${gross.length ? `: ${gross.join(', ')}` : ''}`);
const kopf = readFileSync(path.join(ROOT, 'bilder', 'rezepte', 'chili.webp')).subarray(0, 30);
check(kopf.toString('ascii', 0, 4) === 'RIFF' && kopf.toString('ascii', 8, 12) === 'WEBP', 'die Fotos sind WebP');

// --- Aufträge an die KI
check(rezepte.every((r) => MOTIVE[r.id]), `jedes Rezept hat ein Motiv auf Englisch (${rezepte.filter((r) => !MOTIVE[r.id]).map((r) => r.id).join(', ') || 'alle'})`);
check(Object.keys(MOTIVE).every((id) => rezepte.some((r) => r.id === id)), 'kein Motiv für ein Rezept, das es nicht gibt');
const a = auftrag(rezepte.find((r) => r.id === 'chili'));
check(a.length < 2048 && /meal prep container/.test(a) && /no text/.test(a) && /chili con carne/.test(a), 'der Auftrag: Box von oben, kein Text, das Motiv; unter 2048 Zeichen');
check(!Object.values(MOTIVE).some((m) => /pork|bacon|ham\b|fish|salmon|tuna|shrimp/i.test(m)), 'kein Schwein, kein Fisch in den Motiven');

ende();
