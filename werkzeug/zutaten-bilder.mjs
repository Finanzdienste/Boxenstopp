#!/usr/bin/env node
/*
 * Legt die Zutaten-Bildchen an: bilder/zutaten/<name>.svg für jedes Bildchen
 * aus js/bilder.js (ALLE_BILDER), aus Microsofts Fluent Emoji im npm-Paket
 * @iconify-json/fluent-emoji (MIT-Lizenz). Nicht mehr gebrauchte fliegen raus.
 *
 *     npm install && node werkzeug/zutaten-bilder.mjs
 *
 * Nur nötig, wenn sich in js/bilder.js etwas ändert.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLE_BILDER } from '../js/bilder.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(ROOT, 'bilder', 'zutaten');
const satz = JSON.parse(readFileSync(path.join(ROOT, 'node_modules', '@iconify-json', 'fluent-emoji', 'icons.json'), 'utf8'));

const LIZENZ = `Die Bildchen in diesem Ordner sind Fluent Emoji von Microsoft
(https://github.com/microsoft/fluentui-emoji), über das npm-Paket
@iconify-json/fluent-emoji. Sie stehen unter der MIT-Lizenz:

MIT License

Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

mkdirSync(ZIEL, { recursive: true });
const fehlt = [];
let bytes = 0;
for (const name of ALLE_BILDER) {
  const icon = satz.icons[name] || satz.icons[satz.aliases?.[name]?.parent];
  if (!icon) { fehlt.push(name); continue; }
  const b = icon.width || satz.width || 32;
  const h = icon.height || satz.height || 32;
  // Auf 32 × 32 reichen zwei Nachkommastellen
  const body = icon.body.replace(/-?\d*\.\d{3,}/g, (z) => String(Number(Number(z).toFixed(2))));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.left || 0} ${icon.top || 0} ${b} ${h}" width="${b}" height="${h}">${body}</svg>\n`;
  writeFileSync(path.join(ZIEL, `${name}.svg`), svg);
  bytes += svg.length;
}
for (const datei of readdirSync(ZIEL)) {
  if (datei.endsWith('.svg') && !ALLE_BILDER.includes(datei.slice(0, -4))) unlinkSync(path.join(ZIEL, datei));
}
writeFileSync(path.join(ZIEL, 'LIZENZ.txt'), LIZENZ);
// Die Liste für den Service Worker: Er legt alle Bildchen schon beim Installieren ab
writeFileSync(path.join(ZIEL, 'alle.json'), `${JSON.stringify(ALLE_BILDER)}\n`);
if (fehlt.length) { console.error(`Fehlt im Paket: ${fehlt.join(', ')}`); process.exit(1); }
console.log(`${ALLE_BILDER.length} Bildchen, zusammen ${Math.round(bytes / 1024)} KB → ${path.relative(ROOT, ZIEL)}`);
