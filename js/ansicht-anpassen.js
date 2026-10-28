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
 *
 * Oben „Mit KI ändern“: Man schreibt, was anders sein soll („fertige
 * Teriyaki-Sauce statt selbst gemacht“), die KI bekommt das Rezept, wie es
 * gerade steht (alsVorlage, im Format ihrer Antwort), und gibt es geändert
 * zurück – nur das Verlangte, der Rest bleibt. Die App prüft es wie jedes
 * KI-Rezept (kein Fisch, kein Schwein …), schließt es ans Original an
 * (aenderungUebernehmen: neu, weggelassen) und rechnet die Mengen wieder auf
 * die Ziele. Danach steht es im Editor wie jede andere Änderung: ansehen,
 * nachbessern, speichern.
 */
import { app, $, melde, lese } from './kern.js';
import { esc, nf1, nfi, abweichung } from './format.js';
import { kiBereinigen, mengenAnpassen, festAlsKi, proBox, aenderungenText, alsVorlage, aenderungUebernehmen } from './ki-rezept.js';
import { opKiBehalten } from './liste.js';
import { oeffneRezept, offenesRezept } from './ansicht-rezepte.js';
import { kiQuelle, oeffneEinrichten } from './ansicht-ki.js';
import { rumpfFuer, kiAnfragen, anbieterVon, KI_FEHLER } from './ki.js';
import { ladeKi } from './zugang.js';

let zustand = null; // { rid, basis, k, gerechnet, ki: { wunsch, lauf, fehler, hinweis } }
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

export function oeffneAnpassen(rid, { mitKi = false } = {}) {
  const r = app.nachId[rid];
  const el = $('#d-anpassen');
  if (!r || !el) return;
  if (zustand?.rid !== rid) {
    const k = quelle(r);
    if (!k) { melde('Dieses Rezept lässt sich nicht anpassen.'); return; }
    zustand = { rid, basis: klon(k), k, gerechnet: false, ki: { wunsch: '', lauf: null, fehler: null, hinweis: '' } };
  }
  zeichnen();
  el.hidden = false;
  window.requestAnimationFrame(() => {
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (mitKi) $('#anp-ki-text')?.focus({ preventScroll: true });
  });
}

export function schliesseAnpassen() {
  zustand?.ki.lauf?.controller.abort();
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

/** „Mit KI ändern“: Wunsch eintippen – oder, während die KI schreibt, der Fortschritt. */
function kiHTML() {
  const { ki } = zustand;
  const schluessel = ladeKi();
  const wer = anbieterVon(schluessel) === 'gemini' ? 'Gemini' : 'Claude';
  if (ki.lauf) {
    return `<div class="ki-lauf anp-ki-lauf" role="status" aria-live="polite"><div class="ki-topf" aria-hidden="true"><span></span><span></span><span></span></div>
<p class="ki-lauf-t">${wer} ändert das Rezept …</p><p class="ki-lauf-d" id="anp-ki-d">${kiLaufText()}</p>
<button type="button" class="btn btn-quiet" data-act="anp-ki-abbrechen">Abbrechen</button></div>`;
  }
  return `<form class="anp-ki" id="anp-ki-form" novalidate>
<label for="anp-ki-text"><b>Mit KI ändern</b><small>Die KI baut das Rezept um, die App rechnet die Mengen danach wieder auf eure Ziele.</small></label>
<textarea id="anp-ki-text" rows="2" maxlength="300" placeholder="z. B. fertige Teriyaki-Sauce statt selbst gemacht">${esc(ki.wunsch)}</textarea>
<p class="zugang-fehler" id="anp-ki-fehler"${ki.fehler ? '' : ' hidden'}>${esc(ki.fehler || '')}</p>
${schluessel
    ? `<div class="anp-ki-f"><button type="submit" class="btn btn-primary" id="anp-ki-los">Ändern lassen</button><span class="fine">${anbieterVon(schluessel) === 'gemini' ? 'Kostenlos, geht nur an Google' : 'Ein paar Cent, geht nur an Anthropic'}. Dauert etwa eine Minute.</span></div>`
    : '<p class="fine">Dafür braucht die App den KI-Schlüssel aus der Resteverwertung. <button type="button" class="linkbtn" data-act="anp-ki-einrichten">Jetzt einrichten</button></p>'}
</form>${ki.hinweis ? `<p class="ki-hinweis anp-ki-hinweis"><b>Die KI:</b> ${esc(ki.hinweis)}</p>` : ''}`;
}

function kiLaufText() {
  const l = zustand?.ki.lauf;
  if (!l) return '';
  const s = Math.round((Date.now() - l.start) / 1000);
  return l.zeichen ? `Schreibt das geänderte Rezept · ${s} s` : `Liest das Rezept · ${s} s`;
}

async function kiAendern() {
  if (!zustand || zustand.ki.lauf) return;
  const schluessel = ladeKi();
  if (!schluessel) { zeichnen(); return; }
  const wunsch = String(zustand.ki.wunsch || '').trim();
  if (!wunsch) { zustand.ki.fehler = 'Schreib, was anders sein soll.'; zeichnen(); $('#anp-ki-text')?.focus(); return; }
  const mein = zustand;
  const lauf = { controller: new AbortController(), start: Date.now(), zeichen: 0, timer: null };
  mein.ki = { ...mein.ki, lauf, fehler: null };
  lauf.timer = setInterval(() => { const el = $('#anp-ki-d'); if (el && zustand === mein) el.textContent = kiLaufText(); }, 1000);
  zeichnen();
  const anbieter = anbieterVon(schluessel) || 'anthropic';
  try {
    const rumpf = rumpfFuer(anbieter, { modus: 'aendern', rezept: alsVorlage(mein.k), wunsch, portionen: mein.k.portionen, ziel: app.ziel, katalog: app.katalog });
    const { eingabe: roh } = await kiAnfragen(rumpf, {
      schluessel,
      api: lese('__kiapi', null) || '',
      signal: lauf.controller.signal,
      beiFortschritt: (f) => { lauf.zeichen = f.zeichen; },
    });
    const { r, fehler, art } = kiBereinigen({ ...roh, portionen: mein.k.portionen });
    if (!r) throw Object.assign(new Error(fehler), { art });
    if (zustand !== mein) return;
    // Ans Original anschließen (neu, weggelassen), dann wieder aufs Ziel
    mein.k = mengenAnpassen(aenderungUebernehmen(r, mein.basis), app.ziel);
    mein.gerechnet = true;
    mein.ki = { wunsch: '', lauf: null, fehler: null, hinweis: r.hinweis || '' };
    const box = proBox(mein.k);
    melde(`Geändert und auf Ziel gerechnet: ${nfi(box.kcal)} kcal, ${nf1(box.p)} P, ${nf1(box.kh)} KH, ${nf1(box.f)} F pro Box`);
  } catch (e) {
    if (zustand === mein) mein.ki = { ...mein.ki, lauf: null, fehler: e?.art === 'abbruch' ? null : (e?.message || KI_FEHLER.antwort) };
  } finally {
    clearInterval(lauf.timer);
    if (zustand === mein) { if (mein.ki.lauf === lauf) mein.ki.lauf = null; zeichnen(); }
  }
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
${kiHTML()}
<p class="sec-lead">Oder selbst: Mengen ändern oder Zutaten weglassen, neue dazu. Was du anfasst, bleibt so (🔒). Den Rest schiebt die App mit „Auf Ziel rechnen“, bis die Werte wieder passen.</p>
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
  if (d.act === 'anpassen-ki') { if (offenesRezept()) oeffneAnpassen(offenesRezept(), { mitKi: true }); return true; }
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
    case 'anp-ki-abbrechen': zustand.ki.lauf?.controller.abort(); return true;
    case 'anp-ki-einrichten': oeffneEinrichten(); return true;
    default: return false;
  }
}

export function eingabeAnpassen(t) {
  if (zustand && t.id === 'anp-ki-text') {
    zustand.ki.wunsch = t.value.slice(0, 300);
    if (zustand.ki.fehler) { zustand.ki.fehler = null; const f = $('#anp-ki-fehler'); if (f) f.hidden = true; }
    return true;
  }
  if (!zustand || !t.dataset?.anpMenge) return false;
  mengeSetzen(t.dataset.anpMenge, t.value);
  return true;
}

export function absendenAnpassen(ev) {
  if (ev.target.id === 'anp-ki-form') { ev.preventDefault(); kiAendern(); return true; }
  if (ev.target.id !== 'anp-form') return false;
  ev.preventDefault();
  dazu($('#anp-such').value, $('#anp-neu-menge').value);
  return true;
}

/** Beim Start: Das Rezept schließt den Editor, wenn es gewechselt oder verlassen wird. */
export function anpassenStart() {
  app.anpassenZu = schliesseAnpassen;
}
