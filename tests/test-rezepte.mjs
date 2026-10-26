/*
 * Die Rezeptdaten (daten/rezepte.json) ohne Browser.
 *
 * Erzeugt werden sie mit werkzeug/rezepte.py. Hier steht, was jedes Rezept
 * erfüllen muss: 8 Boxen nahe am Ziel, jede Zutat mit Schlüssel aus dem
 * Katalog, eine Einheit pro Schlüssel (sonst lassen sich Mengen aus zwei
 * Rezepten nicht addieren) und eine Nährwertrechnung, die aufgeht.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT } from './hilfe.mjs';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const { rezepte, katalog, ziel, extras } = daten;
const ABT = ['obst', 'fleisch', 'kuehl', 'tk', 'konserven', 'trocken', 'vorrat', 'gewuerz', 'haushalt'];

check(daten.version === 1 && Array.isArray(rezepte) && rezepte.length >= 16, `${rezepte.length} Rezepte`);
check(ziel.kcal === 443 && ziel.p === 33 && ziel.kh === 39 && ziel.f === 15.4, 'Ziel pro Box: 443 kcal, 33 P, 39 KH, 15,4 F');
const ids = rezepte.map((r) => r.id);
check(new Set(ids).size === ids.length && ids.every((id) => /^[a-z0-9-]+$/.test(id)), 'jede Rezept-id einmal, klein mit Bindestrichen');
check(Object.values(katalog).every((v) => v.n && ABT.includes(v.c)), 'jeder Katalogeintrag hat Namen und eine bekannte Abteilung');

// Grenzen pro Box: so viel Spielraum, wie Packungsgrößen eben verlangen.
const GRENZE = { kcal: [430, 455], p: [32, 36], kh: [37.5, 41], f: [14.5, 17] };
const ausserhalb = rezepte.filter((r) => Object.entries(GRENZE).some(([k, [lo, hi]]) => r.m[k] < lo || r.m[k] > hi));
check(!ausserhalb.length, `alle Boxen nahe am Ziel${ausserhalb.length ? ` – daneben: ${ausserhalb.map((r) => `${r.id} ${JSON.stringify(r.m)}`).join('; ')}` : ''}`);

const rechnetNicht = rezepte.filter((r) => {
  const summe = [2, 3, 4, 5].map((i) => r.nut.reduce((s, z) => s + z[i], 0));
  return summe.some((v, i) => Math.abs(v - r.total[i]) > 1)
    || Math.abs(r.total[0] / 8 - r.m.kcal) > 0.6 || Math.abs(r.total[1] / 8 - r.m.p) > 0.06;
});
check(!rechnetNicht.length, `Nährwertrechnung geht auf (Zeilen = Gesamt, Gesamt ÷ 8 = Box)${rechnetNicht.length ? `: ${rechnetNicht.map((r) => r.id).join(', ')}` : ''}`);

const ohneSchluessel = [];
const einheiten = {};
for (const r of rezepte) {
  for (const it of r.items) {
    if (!it.k || !katalog[it.k]) ohneSchluessel.push(`${r.id}: ${it.n}`);
    if (typeof it.q === 'number') (einheiten[it.k] ||= new Set()).add(it.u);
  }
  for (const s of r.spices) if (!katalog[s.k]) ohneSchluessel.push(`${r.id}: ${s.n}`);
}
check(!ohneSchluessel.length, `jede Zutat und jedes Gewürz hat einen Katalogschlüssel${ohneSchluessel.length ? `: ${ohneSchluessel.slice(0, 5).join(', ')}` : ''}`);
const gemischt = Object.entries(einheiten).filter(([, u]) => u.size > 1).map(([k, u]) => `${k} (${[...u].join('/')})`);
check(!gemischt.length, `eine Einheit pro Schlüssel${gemischt.length ? `: ${gemischt.join(', ')}` : ''}`);

const unvollstaendig = rezepte.filter((r) => !(r.name && r.short && r.desc && r.time > 0 && r.fridge && r.freeze && r.steps.length >= 4 && r.steps.every((s) => s.t && s.d) && r.items.some((it) => typeof it.q === 'number' && !it.pantry && !it.opt)));
check(!unvollstaendig.length, `jedes Rezept hat Name, Kurzname, Beschreibung, Zeit, Lagerung, Schritte und Einkaufszutaten${unvollstaendig.length ? `: ${unvollstaendig.map((r) => r.id).join(', ')}` : ''}`);
check(rezepte.every((r) => r.short.length <= 22), 'Kurznamen passen aufs Kreppband (höchstens 22 Zeichen)');

const gewuerzeFalsch = [...new Set(rezepte.flatMap((r) => r.spices.map((x) => x.k)))].filter((k) => katalog[k].c !== 'gewuerz');
check(!gewuerzeFalsch.length, `jedes Gewürz steht im Katalog unter Gewürze${gewuerzeFalsch.length ? `: ${gewuerzeFalsch.join(', ')}` : ''}`);
const haus = rezepte.flatMap((r) => r.items.filter((it) => it.haus));
check(haus.length >= 4 && haus.every((it) => katalog[it.k].c === 'haushalt' && typeof it.q !== 'number'), `Haushalt (Backpapier, Döschen): ${haus.length} Zeilen, alle unter Extras, nur zum Antippen`);
// Jede Menge, die oben bei den Zutaten steht, taucht auch in einem Schritt auf –
// zumindest die Zahl (mit Einheit, wenn es Gramm sind).
const fehlt = [];
for (const r of rezepte) {
  const schritte = r.steps.map((x) => x.d).join(' ');
  for (const it of r.items) {
    if (typeof it.q !== 'number' || it.u !== 'g') continue;
    const g = it.q >= 1000 && it.q % 1000 === 0 ? [`${it.q / 1000} kg`, `${it.q} g`] : [`${it.q.toLocaleString('de-DE')} g`, `${(it.q / 1000).toLocaleString('de-DE')} kg`];
    if (!g.some((x) => schritte.includes(x))) fehlt.push(`${r.id}: ${it.n} ${it.q} g`);
  }
}
check(!fehlt.length, `jede Grammangabe der Einkaufszutaten steht auch in den Schritten${fehlt.length ? `: ${fehlt.slice(0, 8).join('; ')}` : ''}`);

const f = extras?.fruehstueck;
check(f && f.items.length === 5 && f.items.every((it) => katalog[it.k] && it.q > 0 && it.u === 'g'), 'Frühstück für 7 Tage: fünf Zutaten aus dem Katalog');
check(f.items.find((it) => it.k === 'skyr').q === 7 * 141, 'Frühstück: 7 × 141 g Skyr');

ende();
