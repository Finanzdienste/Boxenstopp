/*
 * Reiter „Einkaufsliste“: die Liste nach Bereichen (bereiche.js), Kopieren
 * als Text, eigene Einträge, das Frühstück für die Woche. Die gemeinsame
 * Liste (Einrichten, Link fürs zweite Handy, Trennen) steht in den
 * Einstellungen – das zeichnet auch dieses Modul; über der Liste steht nur
 * ein Hinweis, solange sie nicht eingerichtet ist oder der Schlüssel klemmt.
 *
 * listeZeichnen() läuft bei jeder Änderung, auch wenn sie vom anderen Handy
 * kommt. Darum fasst sie die Eingabefelder (Eintrag hinzufügen, Einrichten)
 * nicht an – sonst wäre beim Tippen plötzlich der Text weg.
 *
 * Über der Liste: in welchem Laden du gerade einkaufst. Ist einer gewählt,
 * merkt sich das Handy die Reihenfolge der Haken (weg.js) – nach dem Einkauf
 * steht die Liste beim nächsten Mal in der Reihenfolge eures Wegs durch
 * diesen Laden. Die Wahl teilt sich der Reiter mit den Angeboten.
 *
 * Eine Zeile antippen klappt sie auf: Dort kommt sie in eine andere
 * Abteilung („Nuggets“ gehört zu Fleisch) oder wird mit einer anderen Zeile
 * zusammengelegt („leckere Dino nuggies“ ist dasselbe wie „Dino nuggets“).
 * Beides merkt sich die App für beide und fürs nächste Mal (liste.js
 * `abteilungen`, `gleich`). Sieht sie zwei Zeilen, die dasselbe sein
 * könnten, fragt sie über der Liste (gleich.js).
 *
 * In derselben Zeile: „Bei Aldi nicht bekommen“ (bleibt für den nächsten
 * Einkauf offen, steht im selben Laden unten), was es gekostet hat (Bon –
 * die Kosten rechnen dann damit) und ein Preisalarm (Bescheid, wenn es im
 * Angebot höchstens so viel kostet), dazu der Preisverlauf der letzten Wochen.
 */
import { app, $, melde, lese, schreibe, zeigeReiter } from './kern.js';
import { lobKlein } from './lob.js';
import { euro, kostenListe, offenJeZutat } from './kosten.js';
import { esc, menge, ungefaehr, abteilung, uhrzeit } from './format.js';
import { teileVon, erledigt, summen, rezeptStand, rezepteAufListe, offeneAnzahl, opHaken, opLoeschen, opSetzen, opEigener, opErledigteWeg, opLeeren, opWeg, opWegVergessen, opZusammen, opAbteilung, opGleich, opGleichWeg, opUngleich, opFehlt, opFehltWeg, opBon, opBonWeg, opPreisalarm, aufloesen, ABTEILUNGEN } from './liste.js';
import { verlaufHinweis, verlaufText, wochenSchluessel } from './preisverlauf.js';
import { nachWeg, wegSchluessel, wegStellen, PAUSE_MS, ABTEILUNG_NAME } from './weg.js';
import { aehnlich, vorschlaege, richtung, merkName } from './gleich.js';
import { istIpad } from './ansicht-tablet.js';
import { pushZeichnen } from './ansicht-push.js';

const opZusammenWeg = (laden, w) => opZusammen({}, {}, { wege: { [laden]: w } });
import { rezeptAufListe, rezeptVonListe, ic } from './ansicht-rezepte.js';
import { einladungsLink, schluesselAus, kiAus, ladeKi, speichereKi } from './zugang.js';
import { nachBereichen, alsText, abteilungVon, merkSchluessel, nameSchluessel } from './bereiche.js';
import { zutatImg } from './bilder.js';
import { angeboteJeZutat, ladenWahl, rabattText, angebotMenge, grundpreis, schluesselRaten, einheitsPreis, preisJe, preisalarmTreffer, GUENSTIG_AB, LAEDEN } from './angebote.js';
const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';

let leerenFragen = false;
let trennenFragen = false;
let formular = null; // null | { token, name, fehler } – token kann aus einem Link kommen
let zugangGezeichnet = ''; // was im Einrichten-Bereich der Einstellungen steht – gleich: nicht neu zeichnen (Getipptes bleibt)
let angebotJe = new Map(); // je Zutat die Angebote aller Läden, das günstigste zuerst – neu bei jedem Zeichnen
let offenZeile = null; // die aufgeklappte Zeile: Abteilung wählen, zusammenlegen
const klon = (x) => JSON.parse(JSON.stringify(x));
const abteilungHier = (k, d) => abteilungVon(k, d, app.katalog, app.stand.abteilungen);
/** Woran Bon und Preisalarm eine Zeile erkennen: Katalog-Schlüssel, bei Eigenem geraten oder am Namen. */
const produktSchluessel = (k, d) => (app.katalog[k] ? k : (d?.custom || String(k).startsWith('c-')) ? (schluesselRaten(d?.name, app.katalog) || nameSchluessel(d?.name || k)) : k);
/** In welcher Einheit ein Wunschpreis gilt: je kg, je l oder je Stück – wie die Angebote der Zutat. */
function alarmEinheit(k) {
  const u = app.einheiten?.[k] || app.naehrwerte?.[k]?.u;
  if (u === 'ml') return 'l';
  if (u && u !== 'g') return 'Stk';
  return 'kg';
}
/** „4,99“ und „4.99 €“ → 4.99 */
const zahlAus = (t) => Number(String(t || '').replace(/\s|€/g, '').replace(',', '.'));
const nf2 = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
/** Steht die Zeile im gewählten Laden unter „nicht bekommen“? */
const fehltHier = (k) => { const l = app.ladenJetzt(); return !!l && app.stand.fehlt?.[k]?.laden === l; };

/* ---------------------------------------------- Der Weg durch den Laden */

const LAUF = 'boxenstopp.weg.lauf.v1'; // der Einkauf, der gerade läuft: { laden, h: [[schlüssel, abteilung, zeit]] }
const letzterHaken = (lauf) => Math.max(0, ...(lauf?.h || []).map((x) => x[2] || 0));

/** Ein Einkauf ist vorbei: die Reihenfolge seiner Haken als Weg durch den Laden speichern (für beide). */
export function wegAbschliessen() {
  const lauf = lese(LAUF, null);
  try { localStorage.removeItem(LAUF); } catch { /* egal */ }
  const stellen = wegStellen(lauf?.h);
  if (lauf?.laden && stellen.length) app.aendern(opWeg(lauf.laden, stellen, app.name()));
}

/** Ein Haken im Laden: merken, wann welche Zutat in den Wagen kam (oder wieder raus). */
function wegHaken(laden, k, d, an, jetzt = Date.now()) {
  let lauf = lese(LAUF, null);
  if (lauf && (lauf.laden !== laden || jetzt - letzterHaken(lauf) > PAUSE_MS)) { wegAbschliessen(); lauf = null; }
  if (!lauf) lauf = { laden, h: [] };
  const key = wegSchluessel(k, d);
  lauf.h = lauf.h.filter((x) => x[0] !== key);
  if (an) lauf.h.push([key, abteilungHier(k, d), jetzt]);
  schreibe(LAUF, lauf);
}

/** Beim Öffnen und Zurückkommen: ein Einkauf, der seit 45 Minuten ruht, ist vorbei. */
export function wegPruefen(jetzt = Date.now()) {
  const lauf = lese(LAUF, null);
  if (lauf && jetzt - letzterHaken(lauf) > PAUSE_MS) setTimeout(wegAbschliessen, 0);
}

const LADEN_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5l1.5-5h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11.5V20h13v-8.5M10 20v-5h4v5"/></svg>';

/** Über der Liste: wo du einkaufst, und ob die Liste deinen Weg dort schon kennt. */
function ladenZeichnen() {
  const el = $('#l-laden');
  if (!el) return;
  el.hidden = !app.listeDa || !Object.keys(app.stand.items).length;
  if (el.hidden) return;
  const laden = app.ladenJetzt();
  const weg = laden ? app.stand.wege?.[laden] : null;
  const lauf = lese(LAUF, null);
  const laeuft = laden && lauf?.laden === laden && lauf.h?.length;
  const n = weg?.n || 0;
  const info = !laden
    ? 'Wähl den Laden, in dem du einkaufst – dann lernt die Liste euren Weg durch den Markt.'
    : n ? `Sortiert wie euer ${esc(laden)}, gelernt aus ${n === 1 ? 'einem Einkauf' : `${n} Einkäufen`}.${laeuft ? ' Die App schaut wieder mit.' : ''} <button type="button" class="linkbtn" data-act="weg-vergessen">Reihenfolge vergessen</button>`
      : laeuft ? `Einkauf bei ${esc(laden)} läuft – die App merkt sich, in welcher Reihenfolge du abhakst.`
        : `Hak in der Reihenfolge ab, in der du durch den Laden gehst – dann steht die Liste beim nächsten Mal wie euer ${esc(laden)}.`;
  const laeden = [...new Set([...LAEDEN, ...Object.keys(app.stand.wege || {}), laden].filter(Boolean))];
  const wahl = el.querySelector('#l-laden-wahl');
  const optionen = laeden.join('|');
  // Das Auswahlfeld nur neu bauen, wenn sich die Läden ändern – sonst klappt es beim Abgleich zu
  if (!wahl || wahl.dataset.laeden !== optionen) {
    el.innerHTML = `<label class="sel l-laden-sel">${LADEN_IC}<select id="l-laden-wahl" data-laeden="${esc(optionen)}" aria-label="In welchem Laden kaufst du ein?"><option value="">Kein Laden gewählt</option>${laeden.map((l) => `<option value="${esc(l)}">Ich kaufe bei ${esc(l)}</option>`).join('')}</select></label><p class="l-laden-info" id="l-laden-info"></p>`;
  }
  const sel = el.querySelector('#l-laden-wahl');
  if (sel.value !== laden) sel.value = laden;
  sel.closest('.sel').classList.toggle('an', !!laden);
  el.querySelector('#l-laden-info').innerHTML = info;
}

/* ------------------------------------------------- Angebote auf der Liste */

// Menge und Preis nicht mitten auseinanderbrechen („1,49 €“, „500 g“)
const fest = (t) => String(t).replace(/(\d) (?=\S)/g, '$1\u00a0');
/** „600 g 5,19 € · 8,65 €/kg“ – die Packung und, wenn es in Gramm geht, der Preis je Kilo. */
const preisText = (a) => [angebotMenge(a), grundpreis(a)].filter(Boolean).map(fest).join(' · ');
/** Kurz für „auch hier“: der Preis je Kilo, sonst die Packung. */
const kurzPreis = (a) => fest(grundpreis(a, { immer: true }) || angebotMenge(a));

/**
 * Unter einem Eintrag: wo er gerade am günstigsten ist (das beste Angebot
 * aller Läden), beim gewählten Laden, wenn der ihn auch im Angebot hat, und
 * wo sonst noch. „Am günstigsten“ heißt es nur, wenn es wirklich günstiger
 * ist als der übliche Discounter-Preis – sonst „im Angebot“.
 */
function angebotZeilen(liste) {
  if (!liste?.length) return '';
  const [best, ...rest] = liste;
  const gut = best.rabatt !== null && best.rabatt >= GUENSTIG_AB;
  const kommentar = best.rabatt === null || gut ? '' : best.rabatt < 0 ? ' – teurer als sonst' : ' – etwa wie sonst';
  // Aus dem Preisverlauf: „Tiefstpreis seit 6 Wochen“ – nicht, wenn es teurer ist als das, was ihr sonst zahlt
  const ep = einheitsPreis(best.a);
  const hinweis = ep && best.a.k && !(best.rabatt !== null && best.rabatt < 0) ? verlaufHinweis(app.preisverlauf, best.a.k, ep.wert, ep.u, wochenSchluessel(new Date())) : null;
  const zusatz = hinweis ? ` <span class="l-tief">${esc(hinweis.text)}</span>` : '';
  let html = gut
    ? `<span class="l-angebot"><b>${esc(rabattText(best.rabatt))}</b> am günstigsten bei ${esc(best.a.laden)}: ${esc(preisText(best.a))}${zusatz}</span>`
    : `<span class="l-angebot l-matt">Im Angebot bei ${esc(best.a.laden)}: ${esc(preisText(best.a))}${kommentar}${zusatz}</span>`;
  const mein = app.ladenJetzt();
  const dort = mein && mein !== best.a.laden ? rest.find((x) => x.a.laden === mein) : null;
  if (dort) html += `<span class="l-dein">Bei ${esc(mein)}: ${esc(preisText(dort.a))}${dort.rabatt !== null && dort.rabatt >= GUENSTIG_AB ? ` <b>${esc(rabattText(dort.rabatt))}</b>` : ''}</span>`;
  const sonst = rest.filter((x) => x !== dort);
  if (sonst.length) html += `<span class="l-auch">Auch: ${sonst.slice(0, 3).map((x) => `${esc(x.a.laden)} ${esc(kurzPreis(x.a))}`).join(' · ')}${sonst.length > 3 ? ` · +${sonst.length - 3}` : ''}</span>`;
  return html;
}

/** Oben über der Liste: in welchem Laden die offenen Einträge mit den Angeboten am günstigsten sind. */
function tippZeichnen() {
  const el = $('#l-tipp');
  if (!el) return;
  const wahl = app.listeDa ? ladenWahl(offenJeZutat(app.stand, app), app.angeboteJetzt(), app) : [];
  el.hidden = !wahl.length;
  if (!wahl.length) { el.innerHTML = ''; return; }
  const [best, ...rest] = wahl;
  const danach = rest.slice(0, 2).map((w) => `${esc(w.laden)} ≈ ${esc(euro(w.ersparnis))}`).join(' · ');
  const n = best.treffer.length;
  el.innerHTML = `<p><span class="l-tipp-k">Am günstigsten einkaufen</span><b>${esc(best.laden)}</b> – ${n === 1 ? '1 Sache' : `${n} Sachen`} im Angebot, ≈ ${esc(euro(best.ersparnis))} günstiger als sonst${danach ? `<small>Danach: ${danach}</small>` : ''}</p><button type="button" class="linkbtn" data-act="angebote">Angebote</button>`;
}

const kurzName = (rid) => app.nachId[rid]?.short || app.extras[rid]?.short || (app.amyNach?.[rid] ? `♡ ${app.amyNach[rid].short}` : rid.startsWith('amy-') ? '♡ Amys Rezept' : rid);

/** iPhone oder iPad: Dort hat die App vom Home-Bildschirm einen eigenen Speicher, getrennt von Safari. */
const istIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const vomHomeBildschirm = () => navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;

/* ---------------------------------------- Abteilung und Zusammenlegen */

/** Die Menge, mit der „Was hat's gekostet?“ vorbelegt ist: was auf der Liste steht, ab 1000 in kg bzw. l. */
function bonVorschlag(d) {
  const s = summen(d);
  if (s.g) return s.g >= 1000 ? { q: s.g / 1000, u: 'kg' } : { q: s.g, u: 'g' };
  if (s.ml) return s.ml >= 1000 ? { q: s.ml / 1000, u: 'l' } : { q: s.ml, u: 'ml' };
  const [u, q] = Object.entries(s)[0] || [];
  return u === 'Stk' || u === 'Pck' ? { q, u } : { q: 1, u: 'Stk' };
}

/** „Nicht bekommen“, Bon und Preisalarm einer Zeile: { fehlt, bon, alarm } als HTML. */
function einkaufHTML(k, d) {
  const fertig = erledigt(d);
  const f = app.stand.fehlt?.[k];
  const laden = app.ladenJetzt();
  const fehlt = fertig ? '' : f
    ? `<p class="l-fehlt-info">${f.laden ? `Bei ${esc(f.laden)} nicht bekommen` : 'Nicht bekommen'}${f.by ? ` (${f.by === app.name() ? 'du' : esc(f.by)})` : ''} – bleibt für den nächsten Einkauf drauf. <button type="button" class="linkbtn" data-fehlt-weg="${esc(k)}">Markierung weg</button></p>`
    : `<button type="button" class="btn l-fehlt-btn" data-fehlt="${esc(k)}">${laden ? `Bei ${esc(laden)} nicht bekommen` : 'Nicht bekommen'}</button>`;
  const pk = produktSchluessel(k, d);
  const bons = app.stand.bons?.[pk] || [];
  const letzter = bons[bons.length - 1];
  const vor = bonVorschlag(d);
  const einheiten = ['g', 'kg', 'ml', 'l', 'Stk', 'Pck'];
  const bon = `<form class="l-bon" data-bon="${esc(k)}" novalidate><p class="l-mehr-k">Was hat's gekostet?</p>
<div class="l-felder"><label class="l-eur"><input name="eur" type="text" inputmode="decimal" autocomplete="off" placeholder="4,99" aria-label="Bezahlt in Euro"><span>€</span></label><span>für</span><input class="l-menge" name="q" type="text" inputmode="decimal" autocomplete="off" value="${esc(nf2(vor.q))}" aria-label="Menge"><label class="sel l-einheit"><select name="u" aria-label="Einheit">${einheiten.map((u) => `<option value="${u}"${u === vor.u ? ' selected' : ''}>${u === 'Pck' ? 'Packung' : u}</option>`).join('')}</select></label><button type="submit" class="btn">Merken</button></div>
<p class="l-mehr-fein">${letzter ? `Zuletzt ${esc(euro(letzter.eur))} für ${esc(menge(letzter.q, letzter.u))}${letzter.laden ? ` bei ${esc(letzter.laden)}` : ''}${bons.length > 1 ? ` · aus ${bons.length} Bons` : ''} – die Kosten rechnen damit. <button type="button" class="linkbtn" data-bon-weg="${esc(pk)}" data-at="${esc(letzter.at)}">Letzten löschen</button>` : 'Dann rechnen die Kosten mit eurem Preis statt mit dem Richtpreis.'}</p></form>`;
  const au = alarmEinheit(pk);
  const alarm = app.stand.preisalarm?.[pk];
  const richt = app.richtpreise?.[pk]?.je_g;
  const vorschlag = richt && au !== 'Stk' ? nf2(richt * 1000 * 0.85) : '';
  const treffer = alarm ? preisalarmTreffer({ [pk]: alarm }, app.angeboteJetzt(), app.katalog)[0] : null;
  const verlauf = verlaufText(app.preisverlauf, pk);
  const alarmHTML = `<form class="l-alarm" data-alarm="${esc(k)}" novalidate><p class="l-mehr-k">Preisalarm</p>
<div class="l-felder"><span>Bescheid, wenn im Angebot für höchstens</span><label class="l-eur"><input name="max" type="text" inputmode="decimal" autocomplete="off" value="${alarm ? esc(nf2(alarm.max)) : ''}" placeholder="${esc(vorschlag || '0,00')}" aria-label="Wunschpreis in Euro je ${au}"><span>€/${au}</span></label><button type="submit" class="btn">${alarm ? 'Ändern' : 'Setzen'}</button>${alarm ? `<button type="button" class="linkbtn" data-alarm-weg="${esc(pk)}">Aus</button>` : ''}</div>
${treffer ? `<p class="l-alarm-treffer">Gerade: ${esc(preisJe(treffer.preis, au))} bei ${esc(treffer.a.laden)} – ${esc(treffer.a.name)}</p>` : ''}
${verlauf ? `<p class="l-mehr-fein">Angebote zuletzt: ${esc(verlauf)}</p>` : ''}</form>`;
  return { fehlt, bon, alarm: alarmHTML };
}

/** Unter einer aufgeklappten Zeile: in welche Abteilung sie gehört, ob sie dasselbe ist wie eine andere – und der Einkauf. */
function mehrHTML(k, d) {
  const jetzt = abteilungHier(k, d);
  const andere = Object.entries(app.stand.items)
    .filter(([x]) => x !== k)
    .map(([x, e]) => [x, e, aehnlich(d.name, e.name)])
    .sort((a, b) => b[2] - a[2] || String(a[1].name).localeCompare(String(b[1].name), 'de'));
  const einkauf = einkaufHTML(k, d);
  return `<div class="l-mehr" id="l-mehr">
${einkauf.fehlt}
<p class="l-mehr-k">Gehört zu</p>
<div class="l-abts" role="group" aria-label="Abteilung für ${esc(d.name)}">${ABTEILUNGEN.map((c) => `<button type="button" class="chip" data-abt="${c}" aria-pressed="${c === jetzt}">${esc(ABTEILUNG_NAME[c])}</button>`).join('')}</div>
${andere.length ? `<p class="l-mehr-k">Ist dasselbe wie</p><label class="sel l-gleich-wahl"><select data-gleich-mit="${esc(k)}" aria-label="${esc(d.name)} ist dasselbe wie …"><option value="">Andere Zeile wählen …</option>${andere.map(([x, e]) => `<option value="${esc(x)}">${esc(e.name)}${erledigt(e) ? ' (im Wagen)' : ''}</option>`).join('')}</select></label>` : ''}
<p class="l-mehr-fein">Das merkt sich die App – für euch beide und beim nächsten Mal.</p>
${einkauf.bon}${einkauf.alarm}
</div>`;
}

/** Im Laden nicht bekommen: bleibt drauf – und war es das Letzte, ist der Einkauf vorbei. */
function nichtBekommen(k) {
  const d = app.stand.items[k];
  if (!d) return;
  const laden = app.ladenJetzt();
  offenZeile = null;
  app.aendern(opFehlt(k, laden, app.name()));
  melde(`„${d.name}“ bleibt für den nächsten Einkauf auf der Liste`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opFehltWeg(k)) });
  if (laden && Object.entries(app.stand.items).every(([x, e]) => x === k || erledigt(e) || fehltHier(x))) wegAbschliessen();
}

/** Ein Bon aus dem Formular in der Zeile. */
function bonMerken(form) {
  const k = form.dataset.bon;
  const d = app.stand.items[k];
  if (!d) return;
  const eur = zahlAus(form.elements.eur.value);
  let q = zahlAus(form.elements.q.value);
  let u = form.elements.u.value;
  if (!(eur > 0 && eur <= 500) || !(q > 0)) { melde('Preis und Menge bitte als Zahl, z. B. 4,99 € für 1 kg'); (eur > 0 ? form.elements.q : form.elements.eur).focus(); return; }
  if (u === 'kg') { q *= 1000; u = 'g'; }
  if (u === 'l') { q *= 1000; u = 'ml'; }
  const pk = produktSchluessel(k, d);
  const at = new Date().toISOString();
  app.aendern(opBon(pk, { eur, q, u, laden: app.ladenJetzt() || '', at }, app.name()));
  melde(`Gemerkt: ${euro(eur)} für ${menge(q, u)} – die Kosten rechnen jetzt damit`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opBonWeg(pk, at)) });
}

/** Ein Wunschpreis aus dem Formular in der Zeile. */
function alarmMerken(form) {
  const k = form.dataset.alarm;
  const d = app.stand.items[k];
  if (!d) return;
  const max = zahlAus(form.elements.max.value);
  if (!(max > 0 && max <= 500)) { melde('Den Wunschpreis bitte als Zahl, z. B. 6,50'); form.elements.max.focus(); return; }
  const pk = produktSchluessel(k, d);
  const u = alarmEinheit(pk);
  const vorher = app.stand.preisalarm?.[pk] || null;
  app.aendern(opPreisalarm(pk, { max, u, name: app.katalog[pk]?.n || d.name }, app.name()));
  melde(`Preisalarm: ${d.name} ab ${preisJe(max, u)} – die App sagt Bescheid`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opPreisalarm(pk, vorher, vorher?.by)) });
}

/** Eine Zeile in eine andere Abteilung – gemerkt für ihren Schlüssel und ihren Namen. */
function verschieben(k, c) {
  const d = app.stand.items[k];
  if (!d || !ABTEILUNGEN.includes(c) || abteilungHier(k, d) === c) return;
  const keys = merkSchluessel(k, d);
  const vorher = Object.fromEntries(keys.map((x) => [x, app.stand.abteilungen?.[x] || null]));
  offenZeile = null;
  app.aendern(opAbteilung(Object.fromEntries(keys.map((x) => [x, c]))));
  melde(`„${d.name}“ steht jetzt bei ${ABTEILUNG_NAME[c]} – auch beim nächsten Mal`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opAbteilung(vorher)) });
}

/** Zwei Zeilen zu einer – in die, die mehr weiß (gleich.js richtung); bei Gleichstand in die gewählte. */
function zusammenlegen(k1, k2, wunsch = null) {
  const a = app.stand.items[k1];
  const b = app.stand.items[k2];
  if (!a || !b || k1 === k2) return;
  const [von, nach] = richtung([k1, a], [k2, b], app.katalog, wunsch);
  const alt = { von: klon(app.stand.items[von]), nach: klon(app.stand.items[nach]) };
  const namen = [nameSchluessel(alt.von.name)];
  const keys = [...new Set([von, ...namen])].filter((x) => x !== nach && !x.startsWith('c-'));
  const frueher = Object.fromEntries(keys.filter((x) => app.stand.gleich?.[x]).map((x) => [x, app.stand.gleich[x]]));
  offenZeile = null;
  app.aendern(opGleich(von, nach, namen, { name: alt.nach.name, cat: alt.nach.cat }));
  melde(`Zusammengelegt: „${alt.nach.name}“ – merkt sich die App`, {
    knopf: 'Rückgängig',
    beiKnopf: () => app.aendern([opGleichWeg(keys), ...(Object.keys(frueher).length ? [opZusammen({}, {}, { gleich: frueher })] : []), opSetzen(von, alt.von), opSetzen(nach, alt.nach)]),
  });
}

/** „Nein, verschieden“: das Paar nicht noch einmal vorschlagen. */
function verschieden(k1, k2) {
  const a = app.stand.items[k1];
  const b = app.stand.items[k2];
  if (!a || !b) return;
  app.aendern(opUngleich(merkName(k1, a), merkName(k2, b)));
  melde(`Okay – „${a.name}“ und „${b.name}“ bleiben getrennt`);
}

/** Über der Liste: zwei Zeilen, die dasselbe sein könnten. */
function gleichZeichnen() {
  const el = $('#l-gleich');
  if (!el) return;
  const v = app.listeDa ? vorschlaege(app.stand, app.katalog) : [];
  el.hidden = !v.length;
  if (!v.length) { el.innerHTML = ''; return; }
  const { von, nach } = v[0];
  const a = app.stand.items[von];
  const b = app.stand.items[nach];
  const woher = (d) => (d.custom ? 'eigener Eintrag' : teileVon(d).map(([rid]) => kurzName(rid)).slice(0, 2).join(', '));
  el.innerHTML = `<p><span class="l-gleich-k">Dasselbe?</span>„${esc(a.name)}“ <small>${esc(woher(a))}</small> und „${esc(b.name)}“ <small>${esc(woher(b))}</small>${v.length > 1 ? `<span class="l-gleich-mehr">noch ${v.length - 1} ${v.length === 2 ? 'Vorschlag' : 'Vorschläge'}</span>` : ''}</p>
<div class="l-gleich-btns"><button type="button" class="btn btn-primary" data-gleich-ja="${esc(von)}" data-nach="${esc(nach)}">Zusammenlegen</button><button type="button" class="btn btn-quiet" data-gleich-nein="${esc(von)}" data-nach="${esc(nach)}">Nein, verschieden</button></div>`;
}

/* -------------------------------------------------------------- Einträge */

function zeile([k, d]) {
  const fertig = erledigt(d);
  const teile = teileVon(d);
  const s = summen(d);
  const mengeText = Object.entries(s).map(([u, q]) => menge(q, u)).join(' + ');
  const etwa = d.custom ? '' : ungefaehr(k, s);
  const herkunft = teile.map(([rid, p]) => {
    let t = esc(kurzName(rid));
    if (typeof p.q === 'number') t += ` ${esc(menge(p.q, p.u))}`;
    else if (p.t) t += `: ${esc(p.t)}`;
    if (p.h) t += ` <span class="hint">(${esc(p.h)})</span>`;
    if (p.done === true && !fertig) t += ' <span class="got">✓</span>';
    return `<span>${t}</span>`;
  }).join('');
  const von = fertig && d.by ? `<span class="item-by">abgehakt von ${d.by === app.name() ? 'dir' : esc(d.by)}</span>` : '';
  // In der Gruppe „Bei Aldi nicht bekommen“ sagt es schon die Überschrift
  const fehlt = !fertig && app.stand.fehlt?.[k] && !fehltHier(k) ? `<span class="item-fehlt">${app.stand.fehlt[k].laden ? `bei ${esc(app.stand.fehlt[k].laden)} nicht bekommen` : 'nicht bekommen'}</span>` : '';
  // Gerade im Angebot, und wo am günstigsten? Eigene Einträge über den Namen („Hähnchenbrust“)
  const angebot = fertig ? '' : angebotZeilen(angebotJe.get(d.custom ? schluesselRaten(d.name, app.katalog) : k));
  const auf = offenZeile === k;
  return `<li class="item${fertig ? ' is-done' : ''}${auf ? ' is-auf' : ''}">
<button type="button" class="cb" role="checkbox" aria-checked="${fertig}" data-check="${esc(k)}" aria-label="${esc(d.name)}">${ic('check')}</button>
${zutatImg(d.custom ? '' : k, { name: d.name, cat: abteilungHier(k, d) })}
<button type="button" class="item-main" data-mehr="${esc(k)}" aria-expanded="${auf}"${auf ? ' aria-controls="l-mehr"' : ''}><span class="item-name">${esc(d.name)}</span>${herkunft ? `<span class="item-sub">${herkunft}</span>` : ''}${fehlt}${von}</button>
<span class="item-qty">${esc(mengeText)}${etwa ? `<small>${esc(etwa)}</small>` : ''}</span>
<button type="button" class="x" data-del="${esc(k)}" aria-label="${esc(d.name)} löschen">${X}</button>
${angebot ? `<div class="l-angebote">${angebot}</div>` : ''}
${auf ? mehrHTML(k, d) : ''}
</li>`;
}

export function listeZeichnen() {
  const body = $('#list-body');
  fuerZeichnen();
  fruehstueckZeichnen();
  if (!app.listeDa) {
    tippZeichnen();
    body.innerHTML = '<p class="loading">Liste wird geladen…</p>';
    $('#l-count').textContent = '';
    $('#l-foot').innerHTML = '';
    return;
  }
  const eintraege = Object.entries(app.stand.items);
  if (offenZeile && !app.stand.items[offenZeile]) offenZeile = null;
  angebotJe = angeboteJeZutat(app.angeboteJetzt(), app);
  tippZeichnen();
  ladenZeichnen();
  gleichZeichnen();
  // Was es in diesem Laden nicht gab, steht unten – beim nächsten Laden wieder an seinem Platz
  const nichtHier = eintraege.filter(([k, d]) => !erledigt(d) && fehltHier(k));
  const ohne = nichtHier.length ? { ...app.stand, items: Object.fromEntries(eintraege.filter(([k]) => !nichtHier.some(([x]) => x === k))) } : app.stand;
  // Im gewählten Laden mit gelerntem Weg: Abteilungen in dessen Reihenfolge
  const weg = app.ladenJetzt() ? app.stand.wege?.[app.ladenJetzt()] : null;
  const gruppen = weg?.n ? nachWeg(ohne, app.katalog, weg) : nachBereichen(ohne, app.katalog);
  const offen = gruppen.reduce((n, g) => n + g.eintraege.length, 0);
  const fertig = eintraege.filter(([, d]) => erledigt(d));
  const nachName = (a, b) => String(a[1].name).localeCompare(String(b[1].name), 'de');
  let html = '';
  if (!eintraege.length) {
    html = '<div class="empty-state"><p class="es-t">Noch nichts auf der Liste.</p><p>Öffne ein Rezept und tippe auf „Alles auf die Einkaufsliste“. Alles andere schreibt ihr oben ins Feld.</p></div>';
  } else {
    if (!offen) html += '<div class="alldone"><b>Alles im Wagen.</b> Erledigtes könnt ihr unten entfernen.</div>';
    for (const { bereich, eintraege: g } of gruppen) {
      // Was die App nicht zuordnen konnte: Hier merkt man am ehesten, dass man einsortieren kann
      const hinweis = bereich.id === 'sonstiges' ? 'antippen zum Einsortieren' : bereich.hinweis;
      html += `<section class="grp" data-bereich="${bereich.id}"><h3><span class="grp-name">${esc(bereich.name)}${hinweis ? ` <small>${esc(hinweis)}</small>` : ''}</span><span class="num">${g.length}</span></h3><ul class="items">${g.map(zeile).join('')}</ul></section>`;
    }
    if (nichtHier.length) {
      html += `<section class="grp grp-fehlt" data-bereich="fehlt"><h3><span class="grp-name">Bei ${esc(app.ladenJetzt())} nicht bekommen <small>bleibt für den nächsten Einkauf</small></span><span class="num">${nichtHier.length}</span></h3><ul class="items">${nichtHier.sort(nachName).map(zeile).join('')}</ul></section>`;
    }
    if (fertig.length) {
      html += `<section class="grp grp-done"><h3><span>Im Wagen</span><span class="num">${fertig.length}</span></h3><ul class="items">${fertig.sort(nachName).map(zeile).join('')}</ul></section>`;
    }
  }
  body.innerHTML = html;
  const ko = kostenListe(app.stand, app);
  $('#l-count').textContent = eintraege.length ? `${offen} offen${fertig.length ? ` · ${fertig.length} erledigt` : ''}${ko.gesamt > 0 ? ` · ≈ ${euro(ko.gesamt)}` : ''}` : '';
  $('#kopieren').hidden = !offen;
  if (!offen) $('#kopie-feld').hidden = true;
  fussZeichnen(fertig.length);
}

function fussZeichnen(fertigAnzahl) {
  const fuss = $('#l-foot');
  const anzahl = Object.keys(app.stand.items).length;
  if (!anzahl) { fuss.innerHTML = ''; leerenFragen = false; return; }
  if (leerenFragen) {
    fuss.innerHTML = `<div class="confirm" role="group" aria-label="Liste leeren"><span>Alle ${anzahl} Einträge löschen? Das gilt auch auf dem anderen Handy.</span><div class="confirm-btns"><button type="button" class="btn btn-danger" data-act="leeren-ja">Ja, Liste leeren</button><button type="button" class="btn btn-quiet" data-act="leeren-nein">Abbrechen</button></div></div>`;
    return;
  }
  fuss.innerHTML = `${fertigAnzahl ? `<button type="button" class="btn" data-act="erledigte-weg">Erledigte entfernen<span class="btn-n">${fertigAnzahl}</span></button>` : ''}<button type="button" class="btn btn-quiet" data-act="leeren">Liste leeren</button>`;
}

function fuerZeichnen() {
  const el = $('#forrow');
  const rids = rezepteAufListe(app.stand);
  if (!rids.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '<span class="for-k">Für</span>' + rids.map((rid) => {
    const nm = esc(kurzName(rid));
    const offen = app.nachId[rid] ? ` data-open="${esc(rid)}"` : app.amyNach?.[rid] ? ` data-amy-open="${esc(rid)}"` : ' disabled';
    return `<span class="forchip"><button type="button" class="for-open"${offen}>${nm}</button><button type="button" class="for-x" data-rmrec="${esc(rid)}" aria-label="${nm} von der Liste nehmen">${X}</button></span>`;
  }).join('');
}

function fruehstueckZeichnen() {
  const b = $('#quick-breakfast');
  const f = app.extras.fruehstueck;
  if (!f) { b.parentElement.hidden = true; return; }
  const drauf = rezeptStand(app.stand, f).drauf;
  b.setAttribute('aria-pressed', String(drauf));
  b.innerHTML = drauf ? `${ic('check')}Frühstück steht drauf` : `${ic('plus')}Frühstück für ${f.tage || 7} Tage`;
  b.disabled = !app.listeDa;
}

export function zahlZeichnen() {
  const n = offeneAnzahl(app.stand);
  const b = $('#badge');
  b.textContent = String(n);
  b.hidden = !n;
}

/* -------------------------------------------------- gemeinsame Liste */

const STATUS_TEXT = { lokal: 'Nur lokal', ok: 'Geteilt', sendet: 'Speichert…', offline: 'Offline', zugang: 'Schlüssel prüfen' };

export function statusZeichnen() {
  const { zustand, offen, zuletzt } = app.status;
  const chip = $('#sync');
  chip.dataset.state = zustand;
  $('#sync-text').textContent = STATUS_TEXT[zustand] || '';
  const note = $('#l-note');
  let t = '';
  if (zustand === 'offline') t = `Gerade keine Verbindung zu GitHub.${offen ? ` ${offen} ${offen === 1 ? 'Änderung wird' : 'Änderungen werden'} gespeichert, sobald das Handy wieder online ist.` : ''}`;
  note.textContent = t;
  note.hidden = !t;
  note.dataset.tone = zustand === 'offline' ? 'warn' : '';
  teilenZeichnen(zuletzt);
  zugangZeichnen();
  pushZeichnen();
}

/** In den Einstellungen: die verbundene Liste – wer, wann, Link, Tablet, Trennen. */
function teilenZeichnen(zuletzt) {
  const el = $('#teilen');
  if (!el) return;
  if (!app.zugang || app.status.zustand === 'zugang' || formular) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const wer = app.name() ? `Du bist <b>${esc(app.name())}</b>` : 'Verbunden';
  const wann = zuletzt ? ` · abgeglichen ${uhrzeit(zuletzt)}` : '';
  if (trennenFragen) {
    const offen = app.status.offen;
    el.innerHTML = `<div class="confirm" role="group" aria-label="Trennen"><span>Dieses Handy von der gemeinsamen Liste trennen? Die Liste bleibt in GitHub.${offen ? ` ${offen} ${offen === 1 ? 'Änderung ist' : 'Änderungen sind'} noch nicht gespeichert und gehen verloren.` : ''}</span><div class="confirm-btns"><button type="button" class="btn btn-danger" data-act="z-trennen-ja">Ja, trennen</button><button type="button" class="btn btn-quiet" data-act="z-trennen-nein">Abbrechen</button></div></div>`;
    return;
  }
  const ki = ladeKi();
  const link = einladungsLink(app.zugang.token, ki);
  const wa = `https://wa.me/?text=${encodeURIComponent(`Unsere Einkaufsliste in Boxenstopp: ${link}`)}`;
  el.innerHTML = `<p class="e-status">${wer} · ${esc(STATUS_TEXT[app.status.zustand] || '')}${wann}</p>
<div class="zugang-btns"><button type="button" class="btn" data-act="z-link">Link fürs zweite Handy kopieren</button><a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Per WhatsApp schicken</a>${istIpad() ? '' : '<button type="button" class="btn" data-act="tablet-zeigen">Aufs iPad oder Tablet</button>'}<button type="button" class="btn btn-quiet" data-act="z-trennen">Trennen</button></div>
<input class="z-linkfeld" id="z-linkfeld" type="text" readonly value="${esc(link)}" aria-label="Link fürs zweite Handy" hidden>
<p class="fine">Wer den Link hat, kann eure Liste ändern${ki ? ' und mit eurem KI-Schlüssel Rezepte machen lassen' : ''}. Schick ihn nur an die Person, mit der du die Liste teilst.</p>${istIos() && !vomHomeBildschirm() ? '<p class="fine z-ios">Auf dem iPhone hat die App vom Home-Bildschirm ihren eigenen Speicher: Dort einmal unter Einstellungen den Link ins Feld „Schlüssel“ einfügen.</p>' : ''}`;
}

/**
 * Über der Liste der Hinweis (nicht eingerichtet, Schlüssel klemmt) – und in
 * den Einstellungen das Formular zum Einrichten. Das Formular wird nur neu
 * gezeichnet, wenn sich etwas geändert hat; sonst wäre Getipptes weg.
 */
export function zugangZeichnen() {
  const el = $('#zugang');
  const kaputt = app.zugang && app.status.zustand === 'zugang';
  if (kaputt) {
    el.innerHTML = `<div class="zugang-banner warn"><p><b>Der Schlüssel funktioniert nicht.</b> Er ist abgelaufen, gelöscht oder hat keine Rechte mehr für Boxenstopp-Daten. Änderungen bleiben vorgemerkt.</p><button type="button" class="btn" data-act="z-oeffnen">Neuen Schlüssel eintragen</button></div>`;
  } else if (!app.zugang) {
    // Auf dem iPhone kommt, was in Safari eingerichtet ist, in der App vom Home-Bildschirm nicht an – und Links öffnen immer Safari
    const text = istIos() && vomHomeBildschirm()
      ? 'Auf dem iPhone hat die App vom Home-Bildschirm ihren eigenen Speicher – was in Safari eingerichtet ist, kommt hier nicht an. Kopier den Link vom ersten Handy (etwa aus WhatsApp) und füg ihn unter „Einrichten“ ins Feld „Schlüssel“ ein.'
      : 'Richte die gemeinsame Liste ein, dann seht ihr beide dasselbe.';
    el.innerHTML = `<div class="zugang-banner"><p><b>Nur auf diesem Handy.</b> ${text}</p><button type="button" class="btn" data-act="z-oeffnen">Einrichten</button></div>`;
  } else el.innerHTML = '';
  formularZeichnen(kaputt);
}

function formularZeichnen(kaputt) {
  const el = $('#e-zugang');
  if (!el) return;
  if (app.zugang && !kaputt && !formular) { zugangGezeichnet = ''; el.innerHTML = ''; return; }
  const f = formular || { token: '', name: null, fehler: '' };
  const art = JSON.stringify([kaputt, !!app.zugang, f]);
  if (art === zugangGezeichnet && $('#z-form')) return;
  zugangGezeichnet = art;
  const ausLink = !!f.token;
  let text;
  if (ausLink) text = 'Der Schlüssel aus dem Link ist schon eingetragen. Es fehlt nur noch dein Name.';
  else if (kaputt) text = '<b>Der Schlüssel funktioniert nicht.</b> Er ist abgelaufen, gelöscht oder hat keine Rechte mehr für Boxenstopp-Daten. Trag einen neuen ein – was noch nicht gespeichert ist, bleibt vorgemerkt.';
  else text = 'Gerade steht die Liste nur auf diesem Gerät. <b>Zweites Gerät?</b> Dann brauchst du keinen eigenen Schlüssel: Lass dir vom ersten den Link schicken (dort unter Einstellungen „Link fürs zweite Handy kopieren“) und füg den ganzen Link hier ins Schlüsselfeld ein. <b>Erstes Gerät?</b> Den Schlüssel legst du einmal bei GitHub an, die Anleitung steht im README.';
  // Abbrechen nur, wenn es schon eine funktionierende Liste gibt (ein Link mit einem anderen Schlüssel)
  const abbrechen = app.zugang && !kaputt ? '<button type="button" class="btn btn-quiet" data-act="z-abbrechen">Abbrechen</button>' : '';
  el.innerHTML = `<form class="zugang-form" id="z-form" novalidate>
<p class="z-text">${text}</p>
<label for="z-name">Dein Name</label>
<input id="z-name" type="text" maxlength="30" autocomplete="given-name" placeholder="z. B. Tobi" value="${esc(f.name ?? app.zugang?.name ?? '')}">
<label for="z-token">Schlüssel</label>
<input id="z-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_… oder der Link" value="${esc(f.token)}">
<p class="zugang-fehler" id="z-fehler"${f.fehler ? '' : ' hidden'}>${esc(f.fehler)}</p>
<div class="zugang-btns"><button type="submit" class="btn btn-primary" id="z-los">Verbinden</button>${abbrechen}</div>
</form>`;
}

/** Vom Start aus: Ein Link mit Schlüssel wurde geöffnet – das Formular steht in den Einstellungen. */
export function formularMitSchluessel(token) {
  formular = { token, name: null, fehler: '' };
  zugangZeichnen();
  teilenZeichnen(app.status.zuletzt);
}

async function formularAbschicken() {
  const name = $('#z-name').value.trim().replace(/\s+/g, ' ').slice(0, 30);
  const token = schluesselAus($('#z-token').value);
  const fehler = (t) => { formular = { token: $('#z-token').value, name: $('#z-name').value, fehler: t }; zugangZeichnen(); };
  if (!name) { fehler('Trag deinen Namen ein, dann sieht der andere, wer was abgehakt hat.'); return; }
  if (!token) { fehler('Das sieht nicht nach einem Schlüssel aus. Er beginnt mit github_pat_.'); return; }
  const los = $('#z-los');
  los.disabled = true;
  los.textContent = 'Prüfe…';
  const ki = kiAus($('#z-token').value);
  const ergebnis = await app.verbinden(token, name);
  if (ergebnis === 'ok') {
    if (ki) speichereKi(ki);
    formular = null;
    zugangZeichnen();
    teilenZeichnen(app.status.zuletzt);
    // Geschafft – jetzt die gemeinsame Liste zeigen
    zeigeReiter('einkauf');
    melde(`Verbunden. Ihr teilt jetzt eine Liste, ${name}.`);
    return;
  }
  fehler(ergebnis === 'falsch'
    ? 'GitHub lehnt den Schlüssel ab. Er muss für Boxenstopp-Daten gelten und „Contents: Read and write“ haben.'
    : 'Keine Verbindung zu GitHub. Versuch es gleich nochmal.');
}

/* --------------------------------------------------------------- Klicks */

export function klickListe(el) {
  const d = el.dataset;
  if (d.check) {
    const e = app.stand.items[d.check];
    if (!e) return true;
    const wirdFertig = !erledigt(e);
    const laden = app.ladenJetzt();
    if (laden) wegHaken(laden, d.check, e, wirdFertig);
    app.aendern(opHaken(app.stand, d.check, wirdFertig, app.name()));
    // Das letzte Häkchen auf der Liste (was es hier nicht gab, zählt nicht): ein Satz dafür – und der Weg durch den Laden ist gelernt.
    if (wirdFertig && Object.entries(app.stand.items).every(([k, x]) => k === d.check || erledigt(x) || fehltHier(k))) {
      lobKlein('einkauf');
      if (laden) wegAbschliessen();
    }
    return true;
  }
  if (d.del) {
    const e = app.stand.items[d.del];
    if (!e) return true;
    const k = d.del;
    const vorher = JSON.parse(JSON.stringify(e));
    app.aendern(opLoeschen(k));
    melde(`„${vorher.name}“ gelöscht`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opSetzen(k, vorher)) });
    return true;
  }
  if (d.rmrec) { rezeptVonListe(d.rmrec); return true; }
  if (d.mehr !== undefined) {
    const k = d.mehr;
    offenZeile = offenZeile === k ? null : k;
    listeZeichnen();
    // Neu gezeichnet: den Fokus dorthin zurück, wo er war
    document.querySelector(`#list-body [data-mehr="${window.CSS.escape(k)}"]`)?.focus({ preventScroll: true });
    return true;
  }
  if (d.abt) { if (offenZeile) verschieben(offenZeile, d.abt); return true; }
  if (d.fehlt) { nichtBekommen(d.fehlt); return true; }
  if (d.fehltWeg) { app.aendern(opFehltWeg(d.fehltWeg)); return true; }
  if (d.bonWeg) {
    const b = (app.stand.bons?.[d.bonWeg] || []).find((x) => x.at === d.at);
    app.aendern(opBonWeg(d.bonWeg, d.at));
    if (b) melde('Bon gelöscht', { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opBon(d.bonWeg, b, b.by)) });
    return true;
  }
  if (d.alarmWeg) {
    const a = app.stand.preisalarm?.[d.alarmWeg];
    app.aendern(opPreisalarm(d.alarmWeg, null));
    if (a) melde('Preisalarm aus', { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opPreisalarm(d.alarmWeg, a, a.by)) });
    return true;
  }
  if (d.gleichJa) { zusammenlegen(d.gleichJa, d.nach); return true; }
  if (d.gleichNein) { verschieden(d.gleichNein, d.nach); return true; }
  switch (d.act) {
    case 'fruehstueck':
      if (rezeptStand(app.stand, app.extras.fruehstueck).drauf) rezeptVonListe('fruehstueck');
      else rezeptAufListe('fruehstueck');
      return true;
    case 'kopieren': {
      const text = alsText(app.stand, app.katalog);
      const feld = $('#kopie-feld');
      const zeigen = () => {
        feld.value = text;
        feld.hidden = false;
        feld.focus();
        feld.select();
        melde('Kopieren klappt hier nicht. Der Text steht markiert im Feld, lange drücken zum Kopieren.');
      };
      if (!text) { melde('Gerade ist nichts offen.'); return true; }
      try {
        navigator.clipboard.writeText(text).then(() => { feld.hidden = true; melde('Liste kopiert. Jetzt in deine Einkaufsliste einfügen.'); }, zeigen);
      } catch { zeigen(); }
      return true;
    }
    case 'erledigte-weg': app.aendern(opErledigteWeg()); melde('Erledigtes entfernt'); return true;
    case 'weg-vergessen': {
      // Über der Liste der gewählte Laden, in den Einstellungen der am Knopf
      const laden = d.laden || app.ladenJetzt();
      const alt = app.stand.wege?.[laden];
      if (!laden || !alt) return true;
      app.aendern(opWegVergessen(laden));
      melde(`Reihenfolge bei ${laden} vergessen`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opZusammenWeg(laden, alt)) });
      return true;
    }
    case 'leeren': leerenFragen = true; listeZeichnen(); return true;
    case 'leeren-nein': leerenFragen = false; listeZeichnen(); return true;
    case 'leeren-ja': leerenFragen = false; app.aendern(opLeeren()); melde('Liste geleert'); return true;
    case 'z-oeffnen':
      // Das Formular steht in den Einstellungen
      if (!formular) formular = { token: '', name: null, fehler: '' };
      zeigeReiter('einstellungen');
      zugangZeichnen();
      teilenZeichnen(app.status.zuletzt);
      $('#z-name')?.focus({ preventScroll: true });
      $('#e-liste')?.scrollIntoView({ block: 'start' });
      return true;
    case 'z-abbrechen': formular = null; zugangZeichnen(); teilenZeichnen(app.status.zuletzt); return true;
    case 'z-link': {
      const link = einladungsLink(app.zugang.token, ladeKi());
      const feld = $('#z-linkfeld');
      const zeigen = () => { if (feld) { feld.hidden = false; feld.select(); } melde('Kopieren klappt hier nicht. Der Link steht jetzt im Feld darunter.'); };
      try {
        navigator.clipboard.writeText(link).then(() => melde('Link kopiert. Schick ihn an das zweite Handy.'), zeigen);
      } catch { zeigen(); }
      return true;
    }
    case 'z-trennen': trennenFragen = true; teilenZeichnen(app.status.zuletzt); return true;
    case 'z-trennen-nein': trennenFragen = false; teilenZeichnen(app.status.zuletzt); return true;
    case 'z-trennen-ja': trennenFragen = false; app.trennen(); return true;
    default: return false;
  }
}

/** Der Laden über der Liste (change). true, wenn es hierher gehörte. */
export function aenderungListe(ziel) {
  if (ziel.dataset?.gleichMit) {
    // Ausdrücklich gewählt: bei Gleichstand wird die gewählte Zeile das Ziel
    if (ziel.value) zusammenlegen(ziel.dataset.gleichMit, ziel.value, ziel.value);
    return true;
  }
  if (ziel.id !== 'l-laden-wahl') return false;
  // Ein anderer Laden: der Einkauf im alten ist vorbei
  const lauf = lese(LAUF, null);
  if (lauf && lauf.laden !== ziel.value) wegAbschliessen();
  app.ladenSetzen(ziel.value);
  return true;
}

export function absendenListe(ev) {
  if (ev.target.matches?.('form[data-bon]')) { ev.preventDefault(); bonMerken(ev.target); return true; }
  if (ev.target.matches?.('form[data-alarm]')) { ev.preventDefault(); alarmMerken(ev.target); return true; }
  if (ev.target.id === 'addform') {
    ev.preventDefault();
    const feld = $('#add-input');
    const name = feld.value.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name) return true;
    feld.value = '';
    feld.focus();
    const nk = nameSchluessel(name);
    const cat = app.stand.abteilungen?.[nk] || abteilung(name, app.katalog);
    // Schon einmal zusammengelegt („Nuggets“ ist „Dino Nuggets“)? Dann gehört der Eintrag in diese Zeile
    const ziel = app.stand.gleich?.[nk] ? aufloesen(app.stand, nk) : null;
    const da = ziel ? app.stand.items[ziel] : null;
    if (da && !erledigt(da)) { melde(`Steht schon drauf: „${da.name}“`); return true; }
    if (ziel && !da) {
      const t = new Date().toISOString();
      const kat = app.katalog[ziel];
      app.aendern(opSetzen(ziel, { name: kat?.n || name, cat: app.stand.abteilungen?.[ziel] || kat?.c || cat, parts: {}, custom: true, checked: false, by: null, at: t, added: t }));
      if (kat && kat.n !== name) melde(`„${name}“ steht als „${kat.n}“ drauf – wie beim letzten Mal`);
      return true;
    }
    const id = `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    app.aendern(opEigener(id, name, cat));
    return true;
  }
  if (ev.target.id === 'z-form') {
    ev.preventDefault();
    formularAbschicken();
    return true;
  }
  return false;
}
