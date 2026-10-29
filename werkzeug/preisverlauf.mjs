/*
 * Preisverlauf aus der Git-Historie: Jede Fassung von daten/angebote.json,
 * die der Angebots-Lauf eingecheckt hat, und die gerade geholte kommen in
 * daten/preisverlauf.json – je Katalog-Schlüssel und Kalenderwoche der
 * günstigste Preis je kg, l oder Stück (js/preisverlauf.js), die letzten
 * 26 Wochen. Nur die öffentlichen Angebote (Aldi, Kaufland, Penny, Lidl);
 * was über kaufDA kommt, bleibt im privaten Daten-Repo.
 *
 *   node werkzeug/preisverlauf.mjs                       # schreibt daten/preisverlauf.json
 *   node werkzeug/preisverlauf.mjs --ziel /tmp/pv.json   # anderswohin (Probelauf)
 *   node werkzeug/preisverlauf.mjs --wurzel <repo>       # die Historie eines anderen Repos
 *
 * Braucht die ganze Historie (actions/checkout mit fetch-depth: 0).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verlaufDazu, verlaufKuerzen, wochenSchluessel } from '../js/preisverlauf.js';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
// --wurzel: ein anderes Repo (für die Tests)
const WURZEL = path.resolve(arg('--wurzel') || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const DATEI = 'daten/angebote.json';
const ziel = arg('--ziel') || path.join(WURZEL, 'daten', 'preisverlauf.json');
const git = (...a) => execFileSync('git', a, { cwd: WURZEL, maxBuffer: 64 * 1024 * 1024 }).toString();

const je = {};
let fassungen = 0;
const lesen = (text, abruf) => {
  try {
    const d = JSON.parse(text);
    verlaufDazu(je, Array.isArray(d?.angebote) ? d.angebote : [], abruf);
    fassungen++;
  } catch { /* eine kaputte Fassung überspringen */ }
};

let log = '';
// Nur das letzte halbe Jahr – älter fällt beim Kürzen ohnehin weg
try { log = git('log', '--since=200 days ago', '--format=%H %cI', '--', DATEI).trim(); } catch { log = ''; }
for (const zeile of log ? log.split('\n') : []) {
  const [sha, wann] = zeile.split(' ');
  try { lesen(git('show', `${sha}:${DATEI}`), new Date(wann)); } catch { /* Datei fehlte in dieser Fassung */ }
}
// Was gerade frisch geholt und noch nicht eingecheckt ist
if (existsSync(path.join(WURZEL, DATEI))) lesen(readFileSync(path.join(WURZEL, DATEI), 'utf8'), new Date());

const bis = wochenSchluessel(new Date());
const aus = { stand: new Date().toISOString(), je: verlaufKuerzen(je, bis) };
writeFileSync(ziel, `${JSON.stringify(aus)}\n`);
console.log(`Preisverlauf: ${Object.keys(aus.je).length} Zutaten aus ${fassungen} Fassungen → ${path.relative(WURZEL, ziel) || ziel}`);
