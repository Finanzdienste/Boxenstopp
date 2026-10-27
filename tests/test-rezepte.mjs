/*
 * Die Rezeptdaten (daten/rezepte.json) ohne Browser.
 *
 * Erzeugt werden sie mit werkzeug/rezepte.py. Hier steht, was jedes Rezept
 * erfüllen muss: 8 Boxen nahe am Ziel, jede Zutat mit Schlüssel aus dem
 * Katalog, eine Einheit pro Schlüssel (sonst lassen sich Mengen aus zwei
 * Rezepten nicht addieren), eine Nährwertrechnung, die aufgeht – und eine
 * Zubereitung als Mise en place: erst alles in nummerierte Schalen, dann
 * kochen; ein Schritt pro Zeile, jede Schale gefüllt, bevor sie gebraucht
 * wird, Zeiten, die zusammenpassen.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT } from './hilfe.mjs';
import { zeitVon, nebenZuLang } from '../js/zeiten.js';
import { platzhalter } from '../js/format.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const { rezepte, katalog, ziel, extras } = daten;
const ABT = ['obst', 'fleisch', 'kuehl', 'tk', 'konserven', 'trocken', 'vorrat', 'gewuerz', 'haushalt'];

check(daten.version === 1 && Array.isArray(rezepte) && rezepte.length === 50, `${rezepte.length} Rezepte`);
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

const PHASEN = ['Vorbereiten', 'Kochen', 'Portionieren'];
const unvollstaendig = rezepte.filter((r) => !(r.name && r.short && r.desc && r.fridge && r.freeze && r.method
  && Array.isArray(r.ablauf) && r.ablauf.map((p) => p.t).join() === PHASEN.join() && r.ablauf.every((p) => p.schritte.length >= 2)
  && r.items.some((it) => typeof it.q === 'number' && !it.pantry && !it.opt)));
check(!unvollstaendig.length, `jedes Rezept hat Name, Kurzname, Beschreibung, Lagerung, Einkaufszutaten und Vorbereiten → Kochen → Portionieren${unvollstaendig.length ? `: ${unvollstaendig.map((r) => r.id).join(', ')}` : ''}`);
check(rezepte.every((r) => !('steps' in r) && !('timeNote' in r)), 'keine alten Schritte mehr (steps, timeNote)');
check(rezepte.every((r) => r.short.length <= 22), 'Kurznamen passen aufs Kreppband (höchstens 22 Zeichen)');
// --- Kosten: Richtpreise für alles, was man kauft; pro Box zwischen 1 und 4 €
const ohnePreis = Object.keys(katalog).filter((k) => !['gewuerz', 'haushalt'].includes(katalog[k].c) && !daten.preise?.[k] && !/^(koriander|basilikum|petersilie|dill|tk-kraeuter)$/.test(k));
check(!ohnePreis.length && daten.preise_stand, `jede Einkaufszutat hat einen Richtpreis (Stand ${daten.preise_stand})${ohnePreis.length ? ` – fehlt: ${ohnePreis.join(', ')}` : ''}`);
const kostenFalsch = rezepte.filter((r) => !(r.kosten && r.kosten.box >= 1 && r.kosten.box <= 4 && Math.abs(r.kosten.gesamt / 8 - r.kosten.box) < 0.01));
check(!kostenFalsch.length, `jedes Rezept kostet pro Box zwischen 1 und 4 € (${Math.min(...rezepte.map((r) => r.kosten.box)).toFixed(2)}–${Math.max(...rezepte.map((r) => r.kosten.box)).toFixed(2)} €)${kostenFalsch.length ? `: ${kostenFalsch.map((r) => r.id).join(', ')}` : ''}`);
const zutatenKosten = rezepte.flatMap((r) => r.items.filter((it) => it.k && !it.opt && !it.haus && !it.pantry && typeof it.eur !== 'number').map((it) => `${r.id}: ${it.n}`));
check(!zutatenKosten.length, `jede Einkaufszutat hat ihre Kosten dabei${zutatenKosten.length ? `: ${zutatenKosten.slice(0, 5).join('; ')}` : ''}`);
const chili = rezepte.find((r) => r.id === 'chili');
check(Math.abs(chili.items.reduce((a, it) => a + (it.eur || 0), 0) + 35 * 0.012 - chili.kosten.gesamt) < 0.05, 'Chili: Zutaten plus Gewürzpauschale ergeben die Gesamtkosten');

const gewuerzeFalsch = [...new Set(rezepte.flatMap((r) => r.spices.map((x) => x.k)))].filter((k) => katalog[k].c !== 'gewuerz');
check(!gewuerzeFalsch.length, `jedes Gewürz steht im Katalog unter Gewürze${gewuerzeFalsch.length ? `: ${gewuerzeFalsch.join(', ')}` : ''}`);
const haus = rezepte.flatMap((r) => r.items.filter((it) => it.haus));
check(haus.length >= 4 && haus.every((it) => katalog[it.k].c === 'haushalt' && typeof it.q !== 'number'), `Haushalt (Backpapier, Döschen): ${haus.length} Zeilen, alle unter Extras, nur zum Antippen`);
// --- Zubereitung
const alleSchritte = (r) => r.ablauf.flatMap((p) => p.schritte);
const textVon = (s) => [s.d, ...(s.liste || [])].join(' · ');

const zuLang = rezepte.flatMap((r) => alleSchritte(r).filter((s) => s.d.length > 140 || (s.liste || []).some((x) => x.length > 60)).map((s) => `${r.id}: ${s.d.slice(0, 40)}…`));
check(!zuLang.length, `ein Schritt ist eine Zeile: höchstens 140 Zeichen, Listenpunkte höchstens 60${zuLang.length ? ` – zu lang: ${zuLang.slice(0, 3).join('; ')}` : ''}`);
const ohneZeit = rezepte.flatMap((r) => alleSchritte(r).filter((s) => !Number.isInteger(s.min) || s.min < 1 || s.min > 120 || (s.ruhe !== undefined && !(Number.isInteger(s.ruhe) && s.ruhe > 0 && s.ruhe <= 60))).map((s) => `${r.id}: ${s.d.slice(0, 40)}`));
check(!ohneZeit.length, `jeder Schritt hat ganze Minuten (1–120), Wartezeiten bis 60 Min.${ohneZeit.length ? `: ${ohneZeit.slice(0, 3).join('; ')}` : ''}`);
const zeitFalsch = rezepte.filter((r) => JSON.stringify(zeitVon(r)) !== JSON.stringify(r.zeit) || r.time !== r.zeit.gesamt);
check(!zeitFalsch.length, `die Zeiten aus werkzeug/rezepte.py stimmen mit js/zeiten.js überein${zeitFalsch.length ? `: ${zeitFalsch.map((r) => `${r.id} ${JSON.stringify(r.zeit)} ≠ ${JSON.stringify(zeitVon(r))}`).join('; ')}` : ''}`);
const nebenFalsch = rezepte.flatMap((r) => nebenZuLang(r).map((f) => `${r.id} (${r.ablauf[f.phase].t}, Schritt ${f.schritt + 1}: ${f.braucht} > ${f.hat} Min.)`));
check(!nebenFalsch.length, `was „währenddessen“ passiert, passt in die Zeit daneben${nebenFalsch.length ? `: ${nebenFalsch.join('; ')}` : ''}`);
const zeiten = rezepte.map((r) => r.zeit.gesamt);
check(Math.min(...zeiten) >= 60 && Math.max(...zeiten) <= 240, `ehrliche Gesamtzeiten zwischen 1 und 4 Std. (${Math.min(...zeiten)}–${Math.max(...zeiten)} Min.)`);
// Vorbereiten heißt: schneiden, abwiegen, abmessen – Zwiebeln brauchen ihre Zeit.
const zwiebelnZuSchnell = rezepte.flatMap((r) => r.ablauf[0].schritte.filter((s) => /^(\d+) (?:große |gelbe |rote )?Zwiebeln? \((\d+) g\) schälen und fein würfeln/.test(s.d) && s.min < 2.5 * Number(s.d.match(/\((\d+) g\)/)[1]) / 100).map((s) => `${r.id}: ${s.d.slice(0, 40)} (${s.min} Min.)`));
check(!zwiebelnZuSchnell.length, `fein gewürfelte Zwiebeln: mindestens 2,5 Min. pro 100 g${zwiebelnZuSchnell.length ? `: ${zwiebelnZuSchnell.join('; ')}` : ''}`);

// Schalen: nummeriert, jede gefüllt, bevor sie gebraucht wird, und jede gebraucht.
const schalenFehler = [];
for (const r of rezepte) {
  const n = r.schalen?.length || 0;
  if (!n || n > 6 || r.schalen.some((s, i) => s.n !== i + 1 || !s.name || s.name.length > 26 || !['klein', 'mittel', 'groß'].includes(s.gr))) {
    schalenFehler.push(`${r.id}: 1 bis 6 Schalen, nummeriert, mit Namen und Größe`);
    continue;
  }
  const gefuellt = new Set();
  const gebraucht = new Set();
  for (const s of alleSchritte(r)) {
    const t = textVon(s);
    for (const m of t.matchAll(/(?:→|in|In) Schale (\d+)/g)) gefuellt.add(Number(m[1]));
    for (const m of t.matchAll(/Schale (\d+)/g)) {
      const nr = Number(m[1]);
      if (nr < 1 || nr > n) schalenFehler.push(`${r.id}: Schale ${nr} gibt es nicht`);
      if (/(?:→ |in |In )$/.test(t.slice(Math.max(0, m.index - 3), m.index))) continue;
      if (!gefuellt.has(nr)) schalenFehler.push(`${r.id}: Schale ${nr} wird gebraucht, bevor etwas drin ist`);
      gebraucht.add(nr);
    }
  }
  const nie = r.schalen.filter((s) => !gebraucht.has(s.n)).map((s) => s.n);
  if (nie.length) schalenFehler.push(`${r.id}: Schale ${nie.join(', ')} wird nie gebraucht`);
  if (!alleSchritte(r).some((s) => /leer wiegen|Tara/.test(s.d))) schalenFehler.push(`${r.id}: nichts wird leer gewogen – ohne das geht das Portionieren nicht genau`);
}
check(!schalenFehler.length, `Schalen: jede wird gefüllt, bevor sie gebraucht wird, und jede wird gebraucht${schalenFehler.length ? ` – ${schalenFehler.slice(0, 4).join('; ')}` : ''}`);
// Die Nummern folgen der Reihenfolge, in der die Schalen beim Kochen gebraucht werden.
const reihenfolge = rezepte.flatMap((r) => {
  const reihe = [];
  for (const s of r.ablauf.slice(1).flatMap((p) => p.schritte)) {
    const t = textVon(s);
    for (const m of t.matchAll(/Schale (\d+)/g)) {
      if (/(?:→ |in |In )$/.test(t.slice(Math.max(0, m.index - 3), m.index))) continue;
      if (!reihe.includes(Number(m[1]))) reihe.push(Number(m[1]));
    }
  }
  return reihe.some((n, i) => i && n < reihe[i - 1]) ? [`${r.id}: ${reihe.join(' → ')}`] : [];
});
check(!reihenfolge.length, `Schale 1 kommt beim Kochen zuerst dran, dann 2, dann 3 …${reihenfolge.length ? ` – nicht bei ${reihenfolge.join('; ')}` : ''}`);

// Mise en place: Beim Kochen wird nichts mehr abgewogen oder abgemessen. Mengen
// stehen dort nur, wenn eine Zutat als Ganzes (ganze Packung) in den Topf geht;
// ausgenommen sind „währenddessen“-Schritte in langen Wartezeiten und
// Koch- oder Nudelwasser, das man aus dem Topf schöpft.
const MESS = /(?<![\w.,])(\d+(?:[.,]\d+)?|½|¼|¾)\s?(kg|g|ml|l|EL|TL)(?![\wäöüß])/g;
const imKochen = [];
for (const r of rezepte) {
  const ganz = new Set(r.items.filter((it) => typeof it.q === 'number' && ['g', 'ml'].includes(it.u)).flatMap((it) => [`${it.q} ${it.u}`, `${it.q.toLocaleString('de-DE')} ${it.u}`, it.q % 1000 === 0 ? `${it.q / 1000} ${it.u === 'g' ? 'kg' : 'l'}` : '']));
  for (const s of r.ablauf[1].schritte) {
    if (s.neben) continue;
    for (const m of textVon(s).matchAll(MESS)) {
      const nach = textVon(s).slice(m.index + m[0].length, m.index + m[0].length + 24);
      const vor = textVon(s).slice(Math.max(0, m.index - 24), m.index);
      if (ganz.has(`${m[1]} ${m[2]}`)) continue;
      if (/Kochwasser|Nudelwasser/.test(nach + vor)) continue;
      imKochen.push(`${r.id}: „${m[0]}“ in „${s.d.slice(0, 50)}…“`);
    }
    if (/Saft von|auspressen|abwiegen|abmessen/.test(s.d)) imKochen.push(`${r.id}: „${s.d.slice(0, 50)}…“`);
  }
}
check(!imKochen.length, `beim Kochen wird nichts mehr abgewogen, abgemessen oder ausgepresst – das passiert alles vorher${imKochen.length ? `: ${imKochen.slice(0, 5).join('; ')}` : ''}`);

// Jedes Gewürz und jede Zutat aus dem Vorrat kommt in den Schritten auch vor.
const stamm = (n) => n.replace(/\(.*?\)/g, '').split(/,| oder /)[0].trim().toLowerCase();
const ungenutzt = rezepte.flatMap((r) => {
  const text = alleSchritte(r).map(textVon).join(' ').toLowerCase().replace(/lorbeerblatt|lorbeerblätter/g, 'lorbeer');
  const namen = [...r.spices.map((x) => x.n), ...r.items.filter((it) => it.pantry).map((it) => it.n)];
  return namen.filter((n) => {
    const st = stamm(n).replace(/lorbeerblatt|lorbeerblätter/g, 'lorbeer').replace(/^(?:basmati|jasmin)reis$/, 'reis');
    const kurz = { 'rinderbrühe': 'brüh', 'gemüsebrühe': 'brüh', 'hühner-': 'brüh', 'backkakao': 'kakao', 'weizenmehl': 'mehl', 'öl, neutral': 'öl', 'reis-': 'essig' }[st] || st;
    return !text.includes(kurz.replace(/^öl$/, ' öl'));
  }).map((n) => `${r.id}: ${n}`);
});
check(!ungenutzt.length, `jedes Gewürz und jede Vorratszutat kommt in den Schritten vor${ungenutzt.length ? `: ${ungenutzt.slice(0, 8).join('; ')}` : ''}`);
check(rezepte.every((r) => Array.isArray(r.geraete) && r.geraete.length >= 2), 'jedes Rezept sagt, welche Töpfe und Geräte bereitstehen sollen');

// Mise en place: was oben in Gramm steht, wird im Vorbereiten abgewogen –
// außer es kommt als ganze Packung direkt in den Topf (Hack, Gnocchi, Spinat).
// Die Mengen stehen als Platzhalter {schlüssel} in den Schritten; die App setzt sie ein.
const fehlt = [];
for (const r of rezepte) {
  const schritte = alleSchritte(r).map((x) => platzhalter(textVon(x), r.items)).join(' ');
  for (const it of r.items) {
    if (typeof it.q !== 'number' || it.u !== 'g' || it.pantry) continue;
    const g = it.q >= 1000 && it.q % 1000 === 0 ? [`${it.q / 1000} kg`, `${it.q} g`] : [`${it.q.toLocaleString('de-DE')} g`, `${(it.q / 1000).toLocaleString('de-DE')} kg`];
    if (!g.some((x) => schritte.includes(x))) fehlt.push(`${r.id}: ${it.n} ${it.q} g`);
  }
}
check(!fehlt.length, `jede Grammangabe der Einkaufszutaten steht auch in den Schritten${fehlt.length ? `: ${fehlt.slice(0, 8).join('; ')}` : ''}`);

// Platzhalter: jeder zeigt auf eine Zutat des Rezepts, und die Hauptmengen stehen als Platzhalter da.
const kaputtePlatzhalter = rezepte.flatMap((r) => alleSchritte(r).flatMap((x) => [...textVon(x).matchAll(/\{([^}]+)\}/g)].map((m) => m[1]).filter((k) => !r.items.some((it) => it.k === k)).map((k) => `${r.id}: {${k}}`)));
check(!kaputtePlatzhalter.length, `jeder Platzhalter gehört zu einer Zutat des Rezepts${kaputtePlatzhalter.length ? `: ${kaputtePlatzhalter.slice(0, 5).join(', ')}` : ''}`);
const ohnePlatzhalter = rezepte.flatMap((r) => r.items.filter((it) => it.k && !it.pantry && typeof it.q === 'number' && ['g', 'ml'].includes(it.u) && !/^(gnocchi)$/.test(it.k) && !alleSchritte(r).some((x) => textVon(x).includes(`{${it.k}}`))).map((it) => `${r.id}: ${it.n}`));
check(!ohnePlatzhalter.length, `jede Einkaufszutat in Gramm steht als Platzhalter in den Schritten${ohnePlatzhalter.length ? ` – nicht: ${ohnePlatzhalter.join(', ')}` : ''}`);
const anzahl = rezepte.reduce((n, r) => n + alleSchritte(r).filter((x) => /\{[a-z0-9-]+\}/.test(textVon(x))).length, 0);
check(anzahl >= 100, `${anzahl} Schritte mit Platzhaltern`);

// Fürs Anpassen: jede Zutat mit Gramm hat Werte pro 100 g, Proteine und Beilagen sind verschiebbar.
const ohneWerte = rezepte.flatMap((r) => r.items.filter((it) => it.k && !it.opt && !it.haus && it.g > 0 && !it.pro100).map((it) => `${r.id}: ${it.n}`));
check(!ohneWerte.length, `jede Zutat mit Gramm hat Werte pro 100 g${ohneWerte.length ? ` – nicht: ${ohneWerte.join(', ')}` : ''}`);
check(rezepte.every((r) => r.items.some((it) => it.anpassbar) && r.items.every((it) => !it.anpassbar || (it.min < it.g && it.max > it.g))), 'jedes Rezept hat verschiebbare Zutaten mit einem Bereich um die Menge');
check(rezepte.every((r) => Array.isArray(r.pauschal) && r.pauschal.every((pz) => pz.pro100 && pz.g > 0)), 'Pauschalen (Gewürze …) haben Gramm und Werte');
const nw = daten.naehrwerte || {};
check(Object.keys(nw).length >= 90 && nw.erbsen?.pro100.p === 5.5 && nw.paprika?.u === 'Stk' && nw.paprika.je === 160 && nw.kidney?.u === 'Dose' && nw.haehnchenbrust?.anpassbar === true && !nw.paprika.anpassbar, `Nährwerttabelle fürs Anpassen: ${Object.keys(nw).length} Zutaten mit Einheit und Gramm je Einheit`);
check(Object.keys(nw).every((k) => katalog[k] && !['gewuerz', 'haushalt'].includes(katalog[k].c)), 'die Tabelle kennt nur echte Zutaten aus dem Katalog');
const ohneTabelle = Object.entries(katalog).filter(([k, v]) => !['gewuerz', 'haushalt'].includes(v.c) && !nw[k] && !/koriander|basilikum|petersilie|dill|tk-kraeuter/.test(k)).map(([k]) => k);
check(!ohneTabelle.length, `jede Zutat im Katalog hat Werte${ohneTabelle.length ? ` – nicht: ${ohneTabelle.join(', ')}` : ''}`);

// Kein Fisch, kein Schwein, kein Putenhack – und kein körniger Hüttenkäse mehr.
const alles = JSON.stringify(daten);
check(!/putenhack|huettenkaese|hüttenkäse/i.test(alles), 'kein Putenhack und kein Hüttenkäse, weder in Rezepten noch im Katalog');
const verboten = /schwein|speck|schinken|bacon|salami|chorizo|pancetta|guanciale|fisch|lachs|thunfisch|garnele|shrimp|sardelle|anchovi/i;
const tabu = rezepte.flatMap((r) => [...r.items.map((it) => it.n), ...r.spices.map((x) => x.n), r.name, r.desc].filter((t) => verboten.test(t)).map((t) => `${r.id}: ${t}`));
check(!tabu.length, `kein Schwein und kein Fisch${tabu.length ? `: ${tabu.join('; ')}` : ''}`);

const f = extras?.fruehstueck;
check(f && f.items.length === 5 && f.items.every((it) => katalog[it.k] && it.q > 0 && it.u === 'g'), 'Frühstück für 7 Tage: fünf Zutaten aus dem Katalog');
check(f.items.find((it) => it.k === 'skyr').q === 7 * 141, 'Frühstück: 7 × 141 g Skyr');

ende();
