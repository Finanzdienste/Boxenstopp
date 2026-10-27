/*
 * „Anpassen“: ein Rezept mit dem kochen, was da ist – 200 g Brokkoli statt
 * 1 kg, dafür Erbsen dazu – und die Box trifft trotzdem die Werte.
 *
 * Das Rezept wird dafür ins KI-Format gebracht (ki-rezept.js: festAlsKi für
 * die festen Rezepte, gespeicherte KI-Rezepte sind es schon). Jede Zutat hat
 * dort Werte pro 100 g und einen Bereich, in dem die App sie verschieben
 * darf. Was man selbst anfasst, ist damit fest; „Auf Ziel rechnen“ schiebt
 * die übrigen (Fleisch, Reis, Öl, Käse …), bis die Box wieder bei 443 kcal /
 * 33 P / 39 KH / 15,4 F liegt. Speichern legt das Ergebnis als eigenes
 * Rezept für beide ab (liste.json unter ki, mit basis = das Original), die
 * Schritte bekommen die neuen Mengen, weggelassene Zutaten sind markiert.
 */
import { app, $, melde } from './kern.js';
import { esc, nf1, nfi, abweichung } from './format.js';
import { kiBereinigen, mengenAnpassen, festAlsKi, proBox, aenderungenText } from './ki-rezept.js';
import { opKiBehalten } from './liste.js';
import { oeffneRezept, offenesRezept } from './ansicht-rezepte.js';
import { kiQuelle } from './ansicht-ki.js';

let zustand = null; // { rid, basis, k, gerechnet }
const klon = (x) => JSON.parse(JSON.stringify(x));

export const anpassenOffen = () => !!zustand;

/** Das Rezept im KI-Format, aus dem der Editor startet. */
function quelle(r) {
  if (r.ki) {
    const k = kiQuelle(r.id);
    return k ? kiBereinigen(k).r : null;
  }
  return kiBereinigen(festAlsKi(r, app.katalog)).r;
}

export function oeffneAnpassen(rid) {
  const r = app.nachId[rid];
  const el = $('#d-anpassen');
  if (!r || !el) return;
  const k = quelle(r);
  if (!k) { melde('Dieses Rezept lässt sich nicht anpassen.'); return; }
  zustand = { rid, basis: klon(k), k, gerechnet: false };
  zeichnen();
  el.hidden = false;
  window.requestAnimationFrame(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}

export function schliesseAnpassen() {
  zustand = null;
  const el = $('#d-anpassen');
  if (el) { el.hidden = true; el.innerHTML = ''; }
}

/* --------------------------------------------------------------- Anzeige */

function werteHTML(k) {
  const box = proBox(k);
  const z = app.ziel;
  const zellen = [['kcal', 'kcal', box.kcal, z.kcal, true], ['p', 'Protein', box.p, z.p, false], ['kh', 'KH', box.kh, z.kh, false], ['f', 'Fett', box.f, z.f, false]];
  return `<div class="anp-werte">${zellen.map(([c, name, v, t, ganz]) => `<div class="c-${c}"><span class="k">${name}</span><b>${ganz ? nfi(v) : nf1(v)}</b><small>${abweichung(v, t, ganz)}</small></div>`).join('')}</div>`;
}

function zeileHTML(z) {
  const fest = !z.anpassbar;
  return `<li class="anp" data-zid="${esc(z.id)}">
<span class="anp-name">${esc(z.name)}${z.stueck ? `<small>${esc(z.stueck)}</small>` : ''}${z.neu ? '<small class="anp-neu-k">neu</small>' : ''}</span>
<label class="anp-menge"><span class="sr">Menge ${esc(z.name)}</span><input type="number" inputmode="decimal" min="0" step="any" value="${Math.round(z.menge)}" data-anp-menge="${esc(z.id)}"><span>${z.einheit}</span></label>
<button type="button" class="anp-lock" data-anp-lock="${esc(z.id)}" aria-pressed="${fest}" title="${fest ? 'Fest: Die App lässt die Menge so' : 'Frei: Die App darf die Menge verschieben'}" aria-label="${fest ? 'fest' : 'frei'}">${fest ? '🔒' : '↕'}</button>
<button type="button" class="x" data-anp-weg="${esc(z.id)}" aria-label="${esc(z.name)} weglassen">×</button>
</li>`;
}

function zeichnen() {
  const el = $('#d-anpassen');
  if (!el || !zustand) return;
  const { k, basis } = zustand;
  const zutaten = k.zutaten.filter((z) => !z.pauschal);
  const katalog = Object.entries(app.naehrwerte || {}).map(([key, n]) => [key, app.katalog[key]?.n || key, n]).sort((a, b) => a[1].localeCompare(b[1], 'de'));
  const weg = Object.entries(k.weg || {});
  const aend = aenderungenText(k, basis);
  el.innerHTML = `<h2>Rezept anpassen <small>die Box bleibt auf Ziel</small></h2>
<p class="sec-lead">Mengen ändern oder Zutaten weglassen, neue dazu. Was du anfasst, bleibt so (🔒). Den Rest schiebt die App mit „Auf Ziel rechnen“, bis die Werte wieder passen.</p>
<ul class="anp-liste">${zutaten.map(zeileHTML).join('')}</ul>
${weg.length ? `<p class="anp-weg">Weggelassen: ${weg.map(([id, name]) => `<button type="button" class="linkbtn" data-anp-zurueck="${esc(id)}">${esc(name)} zurück</button>`).join(' · ')}</p>` : ''}
<form class="anp-neu" id="anp-form" autocomplete="off">
  <label class="sr" for="anp-such">Zutat dazu</label>
  <input id="anp-such" type="text" list="anp-katalog" placeholder="Zutat dazu, z. B. TK-Erbsen" maxlength="60">
  <datalist id="anp-katalog">${katalog.map(([key, name]) => `<option value="${esc(name)}"></option>`).join('')}</datalist>
  <label class="sr" for="anp-neu-menge">Menge in Gramm</label>
  <input id="anp-neu-menge" type="number" inputmode="numeric" min="1" step="any" placeholder="g">
  <button type="submit" class="btn" aria-label="Zutat dazu">+</button>
</form>
<p class="fine">Nicht dabei? Die Resteverwertung kennt alles, was du ihr aufschreibst.</p>
<span class="label-k">Pro Box, so wie es jetzt steht</span>
${werteHTML(k)}
${aend.length ? `<p class="ki-anp"><b>Geändert:</b> ${aend.map(esc).join(' · ')}</p>` : ''}
<div class="anp-btns">
  <button type="button" class="btn" data-act="anp-rechnen">Auf Ziel rechnen</button>
  <button type="button" class="btn btn-primary" data-act="anp-speichern"${app.listeDa ? '' : ' disabled'}>Speichern, für beide</button>
  <button type="button" class="btn btn-quiet" data-act="anp-zu">Abbrechen</button>
</div>`;
}

/** Nur die Werte und die Änderungszeile nachzeichnen – die Eingabefelder bleiben, wie sie sind. */
function werteZeichnen() {
  const el = $('#d-anpassen');
  if (!el || !zustand) return;
  const alt = el.querySelector('.anp-werte');
  if (alt) alt.outerHTML = werteHTML(zustand.k);
  const aend = aenderungenText(zustand.k, zustand.basis);
  const z = el.querySelector('.ki-anp');
  const html = aend.length ? `<p class="ki-anp"><b>Geändert:</b> ${aend.map(esc).join(' · ')}</p>` : '';
  if (z) z.outerHTML = html; else if (html) el.querySelector('.anp-werte').insertAdjacentHTML('afterend', html);
}

/* ---------------------------------------------------------------- Ändern */

function zutat(id) { return zustand?.k.zutaten.find((z) => z.id === id); }

function mengeSetzen(id, wert) {
  const z = zutat(id);
  if (!z) return;
  const m = Math.max(0, Number(String(wert).replace(',', '.')) || 0);
  z.menge = m;
  z.anpassbar = false; // angefasst = fest
  z.min = Math.min(z.min, m);
  z.max = Math.max(z.max, m);
  zustand.gerechnet = false;
  const b = Array.from(document.querySelectorAll('#d-anpassen [data-anp-lock]')).find((x) => x.dataset.anpLock === id);
  if (b) { b.setAttribute('aria-pressed', 'true'); b.textContent = '🔒'; b.title = 'Fest: Die App lässt die Menge so'; }
  werteZeichnen();
}

function weglassen(id) {
  const z = zutat(id);
  if (!z) return;
  zustand.k.zutaten = zustand.k.zutaten.filter((x) => x.id !== id);
  zustand.k.weg = { ...(zustand.k.weg || {}), [id]: z.name };
  zeichnen();
}

function zurueck(id) {
  const alt = zustand.basis.zutaten.find((z) => z.id === id);
  if (!alt) return;
  zustand.k.zutaten.push(klon(alt));
  delete zustand.k.weg[id];
  if (!Object.keys(zustand.k.weg).length) delete zustand.k.weg;
  zeichnen();
}

function dazu(name, gramm) {
  const n = String(name || '').trim();
  const m = Math.max(0, Number(String(gramm).replace(',', '.')) || 0);
  if (!n) { melde('Welche Zutat?'); return; }
  const eintrag = Object.entries(app.naehrwerte || {}).find(([key]) => (app.katalog[key]?.n || '').toLowerCase() === n.toLowerCase())
    || Object.entries(app.naehrwerte || {}).find(([key]) => (app.katalog[key]?.n || '').toLowerCase().startsWith(n.toLowerCase()));
  if (!eintrag) { melde(`„${n}“ kenne ich nicht – aus der Liste wählen oder über die Resteverwertung.`); return; }
  const [key, nw] = eintrag;
  if (!m) { melde('Wie viel Gramm?'); $('#anp-neu-menge')?.focus(); return; }
  const vorhanden = zutat(key);
  if (vorhanden) { mengeSetzen(key, vorhanden.menge + m); zeichnen(); return; }
  const einheit = key === 'milch' || nw.u === 'ml' ? 'ml' : 'g';
  zustand.k.zutaten.push({
    id: key, name: app.katalog[key].n, menge: m, einheit, stueck: '', min: m, max: m, anpassbar: false, pro100: nw.pro100,
    quelle: 'kaufen', katalog: key, abteilung: app.katalog[key].c, packung: '', vorschlag: m, neu: true,
  });
  // Eine eigene Schale und ein Schritt dafür, damit es beim Kochen nicht untergeht.
  let schale = '';
  if (zustand.k.schalen.length < 8) {
    zustand.k.schalen.push({ name: app.katalog[key].n.slice(0, 26), gr: 'mittel' });
    schale = ` → Schale ${zustand.k.schalen.length}`;
  }
  zustand.k.ablauf[0].schritte.push({ d: `{${key}} ${app.katalog[key].n} abwiegen${schale} – neu dazu, mit dem Gemüse mitkochen`, min: 1, neu: true });
  if (zustand.k.weg?.[key]) delete zustand.k.weg[key];
  zeichnen();
  $('#anp-such')?.focus();
}

function rechnen() {
  if (!zustand) return;
  const frei = zustand.k.zutaten.filter((z) => z.anpassbar);
  if (!frei.length) { melde('Alles ist fest. Gib mindestens eine Zutat frei (↕), dann kann die App rechnen.'); return; }
  zustand.k = mengenAnpassen(zustand.k, app.ziel);
  zustand.gerechnet = true;
  zeichnen();
  const box = proBox(zustand.k);
  melde(`Gerechnet: ${nfi(box.kcal)} kcal, ${nf1(box.p)} P, ${nf1(box.kh)} KH, ${nf1(box.f)} F pro Box`);
}

function speichern() {
  if (!zustand) return;
  const basis = app.nachId[zustand.rid];
  const k = klon(zustand.k);
  k.herkunft = basis?.ki?.herkunft || zustand.rid;
  k.geaendert = aenderungenText(zustand.k, zustand.basis);
  if (!/angepasst/i.test(k.name)) k.name = `${k.name} (angepasst)`;
  k.hinweis = '';
  const { r, fehler } = kiBereinigen(k);
  if (!r) { melde(fehler || 'Das Rezept lässt sich so nicht speichern.'); return; }
  const id = `ki-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  app.aendern(opKiBehalten(id, r, app.name()));
  schliesseAnpassen();
  oeffneRezept(id);
  melde('Gespeichert – als eigenes Rezept, für euch beide.');
}

/* ---------------------------------------------------------------- Klicks */

export function klickAnpassen(el) {
  const d = el.dataset;
  if (d.act === 'anpassen') { if (offenesRezept()) oeffneAnpassen(offenesRezept()); return true; }
  if (!zustand) return false;
  if (d.anpLock) {
    const z = zutat(d.anpLock);
    if (z) { z.anpassbar = !z.anpassbar; if (z.anpassbar) { z.min = Math.round(z.menge * 0.5); z.max = Math.round(z.menge * 1.6); } zeichnen(); }
    return true;
  }
  if (d.anpWeg) { weglassen(d.anpWeg); return true; }
  if (d.anpZurueck) { zurueck(d.anpZurueck); return true; }
  switch (d.act) {
    case 'anp-rechnen': rechnen(); return true;
    case 'anp-speichern': speichern(); return true;
    case 'anp-zu': schliesseAnpassen(); return true;
    default: return false;
  }
}

export function eingabeAnpassen(t) {
  if (!zustand || !t.dataset?.anpMenge) return false;
  mengeSetzen(t.dataset.anpMenge, t.value);
  return true;
}

export function absendenAnpassen(ev) {
  if (ev.target.id !== 'anp-form') return false;
  ev.preventDefault();
  dazu($('#anp-such').value, $('#anp-neu-menge').value);
  return true;
}

/** Beim Start: Das Rezept schließt den Editor, wenn es gewechselt oder verlassen wird. */
export function anpassenStart() {
  app.anpassenZu = schliesseAnpassen;
}
