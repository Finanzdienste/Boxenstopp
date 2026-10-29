/*
 * Reiter „Amys Rezepte“: Rezepte, die Amy selbst schreibt – rosa, mit
 * Herzchen und Glitzer (das Thema hängt an html[data-tab="amy"], siehe CSS).
 *
 * Drei Ansichten: die Liste ihrer Rezepte, ein Rezept (Zutaten mit + auf die
 * gemeinsame Einkaufsliste, Schritte zum Abhaken mit Timern, die Zeit in
 * ihrem Tempo) und der Editor: Name, Bildchen, Portionen, eine Zutat je
 * Zeile, ein Schritt je Zeile. Was die App aus den Zeilen liest (amy.js),
 * zeigt der Editor schon beim Tippen – erkannte Zutaten mit Häkchen.
 *
 * Gespeichert wird in liste.json unter `amy` (für beide Handys); was gerade
 * im Editor steht, merkt sich das Handy als Entwurf, falls die App zugeht.
 * Die Haken beim Kochen bleiben auf diesem Handy, wie bei den festen
 * Rezepten.
 */
import { app, $, $$, melde, zeigeReiter, lese, schreibe, istSchmal, ansicht } from './kern.js';
import { esc, nf1, nfi } from './format.js';
import { dauer } from './zeiten.js';
import { euro } from './kosten.js';
import { zutatenVon, zutatLesen, amyNaehrwerte, amyKosten, amyEinkauf, teilFuer, alsRezept, amySchaetzung, neueAmyId, AMY_ID } from './amy.js';
import { AMY_BILDER, bildPfad, zutatImg } from './bilder.js';
import { opAmy, opAmyWeg, opTeil, opTeilWeg, hatTeil } from './liste.js';
import { timerKnopf, timerUmschalten, mengenHervor } from './ansicht-rezepte.js';
import { tempoHaken, tempoZurueck, tempoZeit } from './tempo.js';
import { lobPruefen, tierVorladen } from './lob.js';

const ANSICHT = 'boxenstopp.amy.ansicht.v1';
const SCHRITTE = 'boxenstopp.amy.schritte.v1';
const ENTWURF = 'boxenstopp.amy.entwurf.v1';
const ARTEN = ['liste', 'detail', 'editor'];

let zustand = (() => {
  const z = lese(ANSICHT, null);
  return z && ARTEN.includes(z.art) ? { art: z.art, id: typeof z.id === 'string' ? z.id : null } : { art: 'liste', id: null };
})();
let entwurf = lese(ENTWURF, null);
let loeschenFragen = false;
const schritte = lese(SCHRITTE, {}) || {};

const merken = () => schreibe(ANSICHT, zustand);
const daten = () => ({ katalog: app.katalog, naehrwerte: app.naehrwerte, preise: app.preise, einheiten: app.einheiten });
const rezepte = () => Object.values(app.stand.amy || {}).sort((a, b) => String(b.geaendert || b.at).localeCompare(String(a.geaendert || a.at)));
const rezept = (id) => (id && app.stand.amy?.[id]) || null;

const HERZ = '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
const PLUS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const HAKEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
const ZURUECK = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const deko = (name, k = '') => `<img class="amy-deko ${k}" src="${bildPfad(name)}" alt="" width="22" height="22" decoding="async">`;

/** Für die Einkaufsliste und die Timer: Amys Rezepte so, wie die anderen Teile sie verstehen. */
function nachIdNeu() {
  app.amyNach = Object.fromEntries(rezepte().map((r) => [r.id, alsRezept(r, daten())]));
}
const alsR = (id) => app.amyNach?.[id] || null;

/** Wie lange es dauert: gemessen oder im Tempo (tempo.js), sonst ihre Angabe, sonst geschätzt. */
function zeitVon(r) {
  const x = alsR(r.id) || alsRezept(r, daten());
  const z = tempoZeit(x);
  if (z.quelle === 'gemessen') return { min: z.gesamt, art: 'gemessen', z };
  if (r.zeit) return { min: r.zeit, art: 'angabe', z };
  return { min: z.gesamt || amySchaetzung(r), art: z.quelle === 'tempo' ? 'tempo' : 'geschaetzt', z };
}
const zeitText = (t) => (t.art === 'gemessen' ? `${dauer(t.min)} – wie beim letzten Mal` : t.art === 'angabe' ? `ca. ${dauer(t.min)}` : `ca. ${dauer(t.min)}${t.art === 'tempo' ? ' in deinem Tempo' : ''}`);

/** Wie viel von einem Rezept auf der Liste steht. */
function aufListe(r) {
  const e = amyEinkauf(r, daten());
  const n = e.filter((x) => hatTeil(app.stand, x.k, r.id)).length;
  return { gesamt: e.length, n, drauf: n > 0, komplett: e.length > 0 && n === e.length, einkauf: e };
}

/* ---------------------------------------------------------------- Liste */

function karte(r) {
  const nw = amyNaehrwerte(r, daten());
  const ko = amyKosten(r, daten());
  const st = aufListe(r);
  const zahlen = [nw.bekannt ? `≈ ${nfi(nw.kcal)} kcal` : '', ko.gesamt > 0 ? `≈ ${euro(ko.portion)}` : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="amy-karte" data-amy-open="${esc(r.id)}">
<span class="amy-karte-bild"><img src="${bildPfad(r.bild)}" alt="" width="56" height="56" decoding="async"></span>
<span class="amy-karte-t"><b>${esc(r.name)}</b><small>${r.portionen} ${r.portionen === 1 ? 'Portion' : 'Portionen'} · ${esc(zeitText(zeitVon(r)))}</small>${zahlen ? `<small class="amy-karte-z">${esc(zahlen)} pro Portion</small>` : ''}</span>
${st.drauf ? `<span class="amy-pill">${HERZ}auf der Liste</span>` : ''}
</button>`;
}

function listeHTML() {
  const alle = rezepte();
  const kopf = `<button type="button" class="back nur-breit" data-act="amy-zu">${ZURUECK}Alle Rezepte</button>
<header class="amy-kopf">
<p class="amy-eyebrow">${deko('sparkles')} nur für dich ${deko('sparkles')}</p>
<h1 class="amy-titel" id="amy-titel">Amys Rezepte</h1>
<p class="amy-lead">Deine eigenen Lieblingsrezepte. Mit einem Tipp landen die Zutaten auf eurer gemeinsamen Einkaufsliste – und beim Kochen lernt das Handy, wie lange du brauchst.</p>
<button type="button" class="amy-btn amy-neu" data-act="amy-neu"${app.listeDa ? '' : ' disabled'}>${PLUS}Neues Rezept</button>
</header>`;
  if (!app.listeDa) return `${kopf}<p class="loading">Wird geladen…</p>`;
  if (!alle.length) {
    return `${kopf}<div class="amy-leer">${deko('ribbon', 'gross')}<p><b>Noch keine Rezepte hier.</b></p><p>Schreib dein erstes – Zutaten und Schritte einfach Zeile für Zeile, die App macht den Rest.</p></div>`;
  }
  return `${kopf}<div class="amy-raster">${alle.map(karte).join('')}</div>`;
}

/* --------------------------------------------------------------- Rezept */

function zutatZeile(z, i, rid) {
  const drauf = hatTeil(app.stand, z.k, rid);
  const knopf = z.kaufen ? `<button type="button" class="tog" data-amy-tog="${i}" aria-pressed="${drauf}" aria-label="${esc(z.name)} ${drauf ? 'von der Einkaufsliste nehmen' : 'auf die Einkaufsliste setzen'}"${app.listeDa ? '' : ' disabled'}>${PLUS.replace('class="ic"', 'class="ic i-plus"')}${HAKEN.replace('class="ic"', 'class="ic i-check"')}</button>` : '<span></span>';
  return `<li class="ing">${zutatImg(z.k.startsWith('amyz-') ? '' : z.k, { name: z.name, cat: z.kat.c, katalog: app.katalog, groesse: 24 })}<div><span class="ing-name">${esc(z.name)}</span>${z.h ? `<span class="ing-hint">${esc(z.h)}</span>` : ''}</div><span class="ing-amt">${esc(z.a)}</span>${knopf}</li>`;
}

function schrittZeile(x, s, i) {
  const timer = timerKnopf(x.id, s, i);
  const z = x.zeit?.schritte?.[i];
  const min = z?.min ?? s.min;
  return `<li class="step-li${timer ? ' mit-timer' : ''}" data-li="${i}"><button type="button" class="step" data-amy-step="${i}" aria-pressed="false">
<span class="step-n"><span class="sn">${i + 1}</span>${HAKEN}</span>
<span class="step-b"><span class="step-d">${mengenHervor(esc(s.d))}${!timer && z?.art ? ` <span class="step-z is-${z.art}" title="${z.art === 'gemessen' ? 'so lange hast du hier gebraucht' : 'in deinem Tempo'}">${min} Min.</span>` : ''}</span></span>
</button>${timer}</li>`;
}

function detailHTML(r) {
  const x = alsR(r.id) || alsRezept(r, daten());
  const t = zeitVon(r);
  x.zeit = t.z;
  const zut = zutatenVon(r, app.katalog);
  const nw = amyNaehrwerte(r, daten());
  const ko = amyKosten(r, daten());
  const st = aufListe(r);
  const gesperrt = app.listeDa ? '' : ' disabled';
  let aktion = '';
  if (!st.gesamt) aktion = '<span class="onlist">Nichts einzukaufen</span>';
  else if (!st.drauf) aktion = `<button type="button" class="amy-btn" data-act="amy-alle-dazu"${gesperrt}>${HERZ}Alles auf die Einkaufsliste<span class="btn-n">${st.gesamt}</span></button>`;
  else if (!st.komplett) aktion = `<button type="button" class="amy-btn" data-act="amy-alle-dazu"${gesperrt}>Fehlende ergänzen<span class="btn-n">${st.gesamt - st.n}</span></button><button type="button" class="btn" data-act="amy-alle-weg"${gesperrt}>Von der Liste nehmen</button>`;
  else aktion = `<span class="onlist">${HAKEN}Alles steht auf der Liste</span><button type="button" class="btn" data-act="amy-alle-weg"${gesperrt}>Von der Liste nehmen</button>`;
  const loeschen = loeschenFragen
    ? '<span class="confirm">Wirklich löschen? Das gilt auch auf dem anderen Handy. <button type="button" class="btn btn-danger" data-act="amy-loeschen-ja">Ja, löschen</button><button type="button" class="btn btn-quiet" data-act="amy-loeschen-nein">Nein</button></span>'
    : '<button type="button" class="btn btn-quiet" data-act="amy-loeschen">Löschen</button>';
  const fakten = [`${r.portionen} ${r.portionen === 1 ? 'Portion' : 'Portionen'}`, zeitText(t), ko.gesamt > 0 ? `≈ ${euro(ko.portion)} pro Portion${ko.luecken ? ' (mind.)' : ''}` : ''].filter(Boolean);
  const einkaufen = zut.map((z, i) => [z, i]).filter(([z]) => z.kaufen && !z.gewuerz);
  const sonst = zut.map((z, i) => [z, i]).filter(([z]) => !z.kaufen || z.gewuerz);
  let n = 0;
  const phasen = x.ablauf.map((p) => `${x.ablauf.length > 1 ? `<h3 class="phase"><span class="phase-name">${esc(p.t)}</span></h3>` : ''}<ol class="steps">${p.schritte.map((s) => schrittZeile(x, s, n++)).join('')}</ol>`).join('');
  const von = r.by ? `von ${r.by === app.name() ? 'dir' : esc(r.by)}` : '';
  return `<button type="button" class="back" data-act="amy-liste">${ZURUECK}${HERZ}Amys Rezepte</button>
<header class="amy-d-kopf"><span class="amy-d-bild"><img src="${bildPfad(r.bild)}" alt="" width="72" height="72" decoding="async"></span>
<div><h1 class="amy-d-titel" id="amy-d-titel">${esc(r.name)}</h1><p class="amy-d-fakten">${fakten.map(esc).join(' · ')}</p>${von ? `<p class="amy-d-von">${von}</p>` : ''}</div></header>
${nw.bekannt ? `<div class="amy-etikett" role="group" aria-label="Nährwerte pro Portion"><span><b>${nfi(nw.kcal)}</b> kcal</span><span class="m-p">P ${nf1(nw.p)}</span><span class="m-kh">KH ${nf1(nw.kh)}</span><span class="m-f">F ${nf1(nw.f)}</span><small>pro Portion, ungefähr${nw.unbekannt.length ? ` – ohne ${esc(nw.unbekannt.slice(0, 3).join(', '))}${nw.unbekannt.length > 3 ? ' …' : ''}` : ''}</small></div>` : ''}
<div class="actions amy-actions">${aktion}<button type="button" class="btn" data-act="amy-bearbeiten"${gesperrt}>Bearbeiten</button>${loeschen}</div>
<section class="sec amy-sec"><h2>Zutaten <small>für ${r.portionen} ${r.portionen === 1 ? 'Portion' : 'Portionen'}</small></h2>
${einkaufen.length ? `<ul class="ings">${einkaufen.map(([z, i]) => zutatZeile(z, i, r.id)).join('')}</ul>` : '<p class="fine">Noch keine Zutaten.</p>'}
${sonst.length ? `<h3 class="sub-h">Gewürze &amp; was da ist</h3><ul class="ings">${sonst.map(([z, i]) => zutatZeile(z, i, r.id)).join('')}</ul>` : ''}
</section>
<section class="sec amy-sec" id="amy-zubereitung"><h2>So geht's <small>${esc(zeitText(t))}</small></h2>
${x.ablauf.length ? `<p class="sec-lead">${t.art === 'gemessen' ? 'Die Zeit ist gemessen – so lange hat es beim letzten Mal gedauert.' : 'Hak die Schritte beim Kochen ab, dann lernt das Handy, wie lange du wirklich brauchst.'}</p>${phasen}<div class="steps-tools"><button type="button" class="linkbtn" id="amy-reset" data-act="amy-schritte-zurueck" hidden>Haken zurücksetzen</button></div>` : '<p class="fine">Noch keine Schritte.</p>'}
</section>
${r.notiz ? `<section class="sec amy-sec"><h2>Notiz</h2><p class="amy-notiz">${esc(r.notiz)}</p></section>` : ''}`;
}

function haekchenZeichnen(id) {
  const s = new Set(schritte[id] || []);
  let jetzt = true;
  for (const b of $$('#view-amy .step')) {
    const fertig = s.has(Number(b.dataset.amyStep));
    b.setAttribute('aria-pressed', String(fertig));
    b.classList.toggle('jetzt', !fertig && jetzt && s.size > 0);
    if (!fertig) jetzt = false;
  }
  const rb = $('#amy-reset');
  if (rb) rb.hidden = !s.size;
}

/* --------------------------------------------------------------- Editor */

const leererEntwurf = () => ({ id: null, name: '', bild: AMY_BILDER[0], portionen: 4, zeit: '', zutaten: '', schritte: '', notiz: '' });
const ausRezept = (r) => ({ id: r.id, name: r.name, bild: r.bild, portionen: r.portionen, zeit: r.zeit || '', zutaten: r.zutaten.join('\n'), schritte: r.schritte.join('\n'), notiz: r.notiz || '' });

/** Was die App aus den Zutaten-Zeilen liest – als kleine Chips unter dem Feld. */
function erkanntHTML(text) {
  const z = String(text || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 40).map((x) => zutatLesen(x, app.katalog));
  if (!z.length) return '';
  return `<p class="amy-erkannt-k">So liest die App deine Zutaten</p><ul>${z.map((x) => {
    const art = !x.kaufen ? 'nie' : x.gewuerz ? 'gewuerz' : x.k.startsWith('amyz-') ? 'eigen' : 'katalog';
    const was = art === 'katalog' ? esc(x.kat.n) : art === 'eigen' ? `${esc(x.name)} <small>neu</small>` : art === 'gewuerz' ? `${esc(x.name)} <small>Gewürz</small>` : `${esc(x.name)} <small>nicht einkaufen</small>`;
    return `<li class="ak-${art}">${art === 'katalog' ? HAKEN : HERZ}<span>${x.a ? `<b>${esc(x.a)}</b> ` : ''}${was}</span></li>`;
  }).join('')}</ul>`;
}

function editorHTML() {
  const e = entwurf || leererEntwurf();
  const neu = !e.id;
  return `<button type="button" class="back" data-act="amy-abbrechen">${ZURUECK}${HERZ}Amys Rezepte</button>
<form class="amy-form" id="amy-form" autocomplete="off" novalidate>
<h1 class="amy-titel amy-titel-klein">${neu ? 'Neues Rezept' : 'Rezept bearbeiten'} ${deko('sparkles')}</h1>
<label class="amy-feld"><span>Wie heißt es?</span><input id="amy-name" type="text" maxlength="80" required placeholder="z. B. Omas Pfannkuchen" value="${esc(e.name)}" enterkeyhint="next"></label>
<fieldset class="amy-bilder"><legend>Ein Bildchen dazu</legend>${AMY_BILDER.map((b) => `<label class="amy-bild"><input type="radio" name="amy-bild" value="${b}"${b === e.bild ? ' checked' : ''}><img src="${bildPfad(b)}" alt="${esc(b)}" width="36" height="36" decoding="async"></label>`).join('')}</fieldset>
<div class="amy-zwei">
<label class="amy-feld"><span>Portionen</span><input id="amy-portionen" type="number" inputmode="numeric" min="1" max="30" step="1" value="${esc(e.portionen)}"></label>
<label class="amy-feld"><span>Dauer <small>Min., optional</small></span><input id="amy-zeit" type="number" inputmode="numeric" min="0" max="1440" step="5" placeholder="z. B. 45" value="${esc(e.zeit)}"></label>
</div>
<label class="amy-feld"><span>Zutaten <small>eine pro Zeile, Menge vorne</small></span><textarea id="amy-zutaten" rows="7" maxlength="4000" placeholder="500 g Hähnchenbrust&#10;2 Zwiebeln&#10;1 Dose Kokosmilch&#10;1 EL Currypaste&#10;Salz, Pfeffer">${esc(e.zutaten)}</textarea></label>
<div class="amy-erkannt" id="amy-erkannt" aria-live="polite">${erkanntHTML(e.zutaten)}</div>
<label class="amy-feld"><span>So geht's <small>ein Schritt pro Zeile – „20 Min. backen“ bekommt einen Timer</small></span><textarea id="amy-schritte" rows="7" maxlength="8000" placeholder="Zwiebeln würfeln&#10;Hähnchen in Würfel schneiden und 5 Min. anbraten&#10;Kokosmilch und Currypaste dazu, 15 Min. köcheln">${esc(e.schritte)}</textarea></label>
<label class="amy-feld"><span>Notiz <small>wenn du magst</small></span><textarea id="amy-notiz" rows="2" maxlength="600" placeholder="z. B. schmeckt auch kalt super">${esc(e.notiz)}</textarea></label>
<p class="zugang-fehler" id="amy-fehler" hidden></p>
<div class="amy-knoepfe"><button type="submit" class="amy-btn" id="amy-speichern">${HERZ}Speichern</button><button type="button" class="btn btn-quiet" data-act="amy-abbrechen">Abbrechen</button></div>
</form>`;
}

function entwurfAusFormular() {
  const v = (id) => $(`#${id}`)?.value ?? '';
  entwurf = {
    id: entwurf?.id || null,
    name: v('amy-name'),
    bild: $('#amy-form input[name="amy-bild"]:checked')?.value || AMY_BILDER[0],
    portionen: v('amy-portionen'),
    zeit: v('amy-zeit'),
    zutaten: v('amy-zutaten'),
    schritte: v('amy-schritte'),
    notiz: v('amy-notiz'),
  };
  schreibe(ENTWURF, entwurf);
}

/* ------------------------------------------------------------ Zeichnen */

export function amyZeichnen() {
  const el = $('#view-amy');
  if (!el) return;
  nachIdNeu();
  if (zustand.art === 'detail' && !rezept(zustand.id) && app.listeDa) zustand = { art: 'liste', id: null };
  if (zustand.art === 'editor' && !entwurf) zustand = { art: 'liste', id: null };
  if (zustand.art === 'detail' && rezept(zustand.id)) {
    // Neu zeichnen ohne Sprung: die Stelle, an der man gerade kocht, bleibt im Bild
    el.innerHTML = detailHTML(rezept(zustand.id));
    haekchenZeichnen(zustand.id);
  } else if (zustand.art === 'editor') {
    // Der Editor wird nicht bei jeder Änderung der Liste neu gebaut – sonst wäre das Getippte weg
    if (!el.querySelector('#amy-form')) el.innerHTML = editorHTML();
  } else {
    el.innerHTML = listeHTML();
  }
}

/** Ein Rezept öffnen – auch von der Einkaufsliste oder vom Timer aus. */
export function amyOeffnen(id, { still = false } = {}) {
  if (!AMY_ID.test(String(id || ''))) return;
  loeschenFragen = false;
  zustand = { art: 'detail', id };
  merken();
  if (!still) zeigeReiter('amy');
  amyZeichnen();
  if (!still) window.scrollTo(0, 0);
  tierVorladen();
}

/** Vom Timer in der Leiste oben: zum Schritt springen. */
export function amyZuSchritt(id, i) {
  if (!rezept(id)) return;
  if (zustand.art !== 'detail' || zustand.id !== id) amyOeffnen(id);
  else zeigeReiter('amy', true);
  const li = $(`#view-amy .step-li[data-li="${i}"]`);
  if (li) window.requestAnimationFrame(() => li.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

/** Die Timer-Knöpfe im offenen Rezept nachzeichnen (jede Sekunde, von timer.js). */
export function amyTimerZeichnen() {
  if (zustand.art !== 'detail') return;
  const x = alsR(zustand.id);
  if (!x) return;
  const alle = x.ablauf.flatMap((p) => p.schritte);
  for (const b of $$('#view-amy .step-timer')) {
    const i = Number(b.dataset.timer);
    const neu = timerKnopf(x.id, alle[i], i);
    if (neu && b.outerHTML !== neu) b.outerHTML = neu;
  }
}

function zeige(art, id = null) {
  zustand = { art, id };
  loeschenFragen = false;
  merken();
  amyZeichnen();
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------- Einkaufsliste */

function alleDazu(r) {
  const fehlen = amyEinkauf(r, daten()).filter((x) => !hatTeil(app.stand, x.k, r.id));
  if (!fehlen.length) return;
  app.aendern(fehlen.map((x) => opTeil(x.k, r.id, x.teil, x.kat)));
  melde(`${r.name}: ${fehlen.length} ${fehlen.length === 1 ? 'Zutat' : 'Zutaten'} auf der Liste ♡`,
    istSchmal() && ansicht.tab !== 'einkauf' ? { knopf: 'Zur Liste', art: 'zur-liste', beiKnopf: () => zeigeReiter('einkauf') } : {});
}

function alleWeg(r) {
  const vorher = [];
  for (const [k, d] of Object.entries(app.stand.items)) if (d.parts?.[r.id]) vorher.push([k, d.parts[r.id], { n: d.name, c: d.cat }]);
  if (!vorher.length) return;
  app.aendern(vorher.map(([k]) => opTeilWeg(k, r.id)));
  melde(`${r.name} von der Liste genommen`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(vorher.map(([k, p, kat]) => opTeil(k, r.id, p, kat))) });
}

/* --------------------------------------------------------------- Klicks */

/** true, wenn der Klick hierher gehörte. */
export function klickAmy(el) {
  const d = el.dataset;
  if (d.amyOpen) { amyOeffnen(d.amyOpen); return true; }
  if (!el.closest('#view-amy') && !d.act?.startsWith('amy-')) return false;
  const r = rezept(zustand.id);
  if ('amyTog' in d) {
    if (!r) return true;
    const z = zutatenVon(r, app.katalog)[Number(d.amyTog)];
    if (!z) return true;
    if (hatTeil(app.stand, z.k, r.id)) app.aendern(opTeilWeg(z.k, r.id));
    else app.aendern(opTeil(z.k, r.id, teilFuer(z, daten()), z.kat));
    return true;
  }
  if ('amyStep' in d) {
    if (!r) return true;
    const i = Number(d.amyStep);
    const vorher = new Set(schritte[r.id] || []);
    const s = new Set(vorher);
    if (s.has(i)) s.delete(i); else s.add(i);
    schritte[r.id] = [...s];
    schreibe(SCHRITTE, schritte);
    haekchenZeichnen(r.id);
    const x = alsR(r.id);
    tempoHaken(x, i, s.has(i));
    lobPruefen(x, s, vorher, { name: app.name() });
    return true;
  }
  if ('timer' in d) {
    const x = alsR(zustand.id);
    const s = x?.ablauf.flatMap((p) => p.schritte)[Number(d.timer)];
    if (s) { timerUmschalten(x, s, Number(d.timer)); amyTimerZeichnen(); }
    return true;
  }
  switch (d.act) {
    case 'amy-zu': zeigeReiter('rezepte'); return true;
    case 'amy-liste': zeige('liste'); return true;
    case 'amy-neu':
      entwurf = leererEntwurf();
      schreibe(ENTWURF, entwurf);
      $('#view-amy').innerHTML = '';
      zeige('editor');
      $('#amy-name')?.focus();
      return true;
    case 'amy-bearbeiten':
      if (!r) return true;
      entwurf = ausRezept(r);
      schreibe(ENTWURF, entwurf);
      $('#view-amy').innerHTML = '';
      zeige('editor', r.id);
      return true;
    case 'amy-abbrechen': {
      const id = entwurf?.id;
      entwurf = null;
      try { localStorage.removeItem(ENTWURF); } catch { /* egal */ }
      if (id && rezept(id)) zeige('detail', id); else zeige('liste');
      return true;
    }
    case 'amy-alle-dazu': if (r) alleDazu(r); return true;
    case 'amy-alle-weg': if (r) alleWeg(r); return true;
    case 'amy-loeschen': loeschenFragen = true; amyZeichnen(); return true;
    case 'amy-loeschen-nein': loeschenFragen = false; amyZeichnen(); return true;
    case 'amy-loeschen-ja': {
      if (!r) return true;
      const teile = [];
      for (const [k, x] of Object.entries(app.stand.items)) if (x.parts?.[r.id]) teile.push(opTeilWeg(k, r.id));
      app.aendern([...teile, opAmyWeg(r.id)]);
      zeige('liste');
      melde(`„${r.name}“ gelöscht`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opAmy(r, r.by)) });
      return true;
    }
    case 'amy-schritte-zurueck':
      if (!r) return true;
      schritte[r.id] = [];
      schreibe(SCHRITTE, schritte);
      haekchenZeichnen(r.id);
      tempoZurueck(r.id);
      return true;
    default: return false;
  }
}

/** Eingaben im Editor: Entwurf merken, erkannte Zutaten zeigen. true, wenn es hierher gehörte. */
export function eingabeAmy(ziel) {
  if (!ziel.closest?.('#amy-form')) return false;
  entwurfAusFormular();
  if (ziel.id === 'amy-zutaten') { const e = $('#amy-erkannt'); if (e) e.innerHTML = erkanntHTML(ziel.value); }
  if (ziel.id === 'amy-name') { const f = $('#amy-fehler'); if (f) f.hidden = true; }
  return true;
}

/** Speichern. true, wenn das Formular hierher gehörte. */
export function absendenAmy(ev) {
  if (ev.target.id !== 'amy-form') return false;
  ev.preventDefault();
  entwurfAusFormular();
  const e = entwurf;
  const name = String(e.name || '').trim();
  if (!name) {
    const f = $('#amy-fehler');
    if (f) { f.textContent = 'Gib dem Rezept noch einen Namen ♡'; f.hidden = false; }
    $('#amy-name')?.focus();
    return true;
  }
  const alt = e.id ? rezept(e.id) : null;
  const id = alt ? alt.id : neueAmyId(name);
  app.aendern(opAmy({
    id,
    name,
    bild: e.bild,
    portionen: Number(e.portionen) || 4,
    zeit: Number(e.zeit) || 0,
    zutaten: String(e.zutaten || '').split('\n'),
    schritte: String(e.schritte || '').split('\n'),
    notiz: e.notiz,
    by: alt?.by || app.name() || null,
    at: alt?.at,
  }, app.name()));
  entwurf = null;
  try { localStorage.removeItem(ENTWURF); } catch { /* egal */ }
  zeige('detail', id);
  melde(alt ? 'Gespeichert ♡' : `„${name}“ ist gespeichert – für euch beide ♡`);
  return true;
}

/** Beim Start: die gemerkte Ansicht wiederherstellen. */
export function amyStart() {
  amyZeichnen();
}
