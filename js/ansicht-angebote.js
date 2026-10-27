/*
 * Reiter „Angebote“: die Angebote der Woche bei Aldi, Lidl, Rewe, Kaufland & Co.
 *
 *   1. Rein kommen sie über Fotos der Prospektseiten oder Screenshots aus den
 *      Supermarkt-Apps, die die KI ausliest (angebote.js: rumpfAngebote), oder
 *      getippt, eine Zeile je Angebot („Aldi Hähnchenbrustfilet 1 kg 7,49“) –
 *      das liest die App selbst, ohne KI.
 *   2. Sie liegen in liste.json unter `angebote`, also für beide Handys, mit
 *      dem Namen dessen, der sie eingetragen hat.
 *   3. Darunter: welche der Rezepte davon profitieren (Zutat im Angebot,
 *      Ersparnis pro Box gegen die Richtpreise) – und ein Knopf, der die KI
 *      ein neues Rezept aus den Angeboten machen lässt (Resteverwertung im
 *      Modus „angebote“, mit „Neuer Vorschlag“ für den nächsten).
 */
import { app, $, melde, zeigeReiter, lese } from './kern.js';
import { esc, tagKurz, heute } from './format.js';
import { angeboteBereinigen, zeileLesen, aktuelle, angebotMenge, angeboteText, topRezepte, rumpfAngebote, LAEDEN } from './angebote.js';
import { kiAnfragen, anbieterVon, ANBIETER, KI_FEHLER } from './ki.js';
import { ladeKi } from './zugang.js';
import { opAngeboteDazu, opAngebote, opAngebotWeg } from './liste.js';
import { oeffneRezept } from './ansicht-rezepte.js';
import { fotoVorbereiten, resteMitAngeboten, oeffneEinrichten } from './ansicht-ki.js';
import { euro } from './kosten.js';

const MAX_FOTOS = 4;
const KAMERA = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/></svg>';
const BILD = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 17"/><circle cx="15.5" cy="9.5" r="1.4"/></svg>';
const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
const ZURUECK = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

let fotos = []; // { url, b64 }
let text = '';
let lauf = null; // { controller, start, timer }
let fehler = null;
let leerenFragen = false;

const eintraege = () => (app.listeDa ? aktuelle(app.stand.angebote?.eintraege || []) : []);
export const angeboteAnzahl = () => eintraege().length;

/* ------------------------------------------------------------- Ansicht */

function fotosHTML() {
  return fotos.map((f, i) => `<div class="k-foto"><img src="${esc(f.url)}" alt="Bild ${i + 1}"><button type="button" class="k-foto-x" data-a-foto-weg="${i}" aria-label="Bild ${i + 1} entfernen">${X}</button></div>`).join('');
}

function lesenHTML() {
  const schluessel = ladeKi();
  const voll = fotos.length >= MAX_FOTOS;
  if (lauf) {
    const s = Math.round((Date.now() - lauf.start) / 1000);
    return `<div class="ki-lauf" role="status" aria-live="polite"><div class="ki-topf" aria-hidden="true"><span></span><span></span><span></span></div>
<p class="ki-lauf-t">${anbieterVon(schluessel) === 'gemini' ? 'Gemini' : 'Claude'} liest die Angebote …</p><p class="ki-lauf-d" id="a-lauf-d">${s} s</p>
<button type="button" class="btn btn-quiet" data-act="a-abbrechen">Abbrechen</button></div>`;
  }
  return `<form class="ki-form a-form" id="a-form" novalidate>
<div class="k-fotos">
<label class="btn${voll ? ' is-aus' : ''}" for="a-kamera">${KAMERA}Prospekt fotografieren</label><input class="vh" id="a-kamera" type="file" accept="image/*" capture="environment"${voll ? ' disabled' : ''}>
<label class="btn${voll ? ' is-aus' : ''}" for="a-bilder">${BILD}Screenshot wählen</label><input class="vh" id="a-bilder" type="file" accept="image/*" multiple${voll ? ' disabled' : ''}>
</div>
<div class="k-vorschau" id="a-vorschau">${fotosHTML()}</div>
<label for="a-text">Oder tippen, eine Zeile je Angebot</label>
<textarea id="a-text" rows="3" maxlength="2000" placeholder="Aldi Hähnchenbrustfilet 1 kg 7,49&#10;Lidl Paprika 500 g 1,29&#10;Rewe Skyr 500 g 0,99">${esc(text)}</textarea>
<p class="zugang-fehler" id="a-fehler"${fehler ? '' : ' hidden'}>${esc(fehler || '')}</p>
<button type="submit" class="btn btn-primary k-los" id="a-los">${fotos.length ? 'Angebote auslesen' : 'Eintragen'}</button>
<p class="fine">${fotos.length
    ? (schluessel ? `Die Bilder gehen nur an ${anbieterVon(schluessel) === 'gemini' ? 'Google (kostenlos)' : 'Anthropic'}. Dauert etwa eine halbe Minute.` : 'Fürs Auslesen der Bilder braucht die App den KI-Schlüssel aus der Resteverwertung. <button type="button" class="linkbtn" data-act="a-einrichten">Jetzt einrichten</button>')
    : 'Getippte Zeilen liest die App selbst: Laden vorn, Preis hinten, dazwischen das Produkt und die Packung.'}</p>
</form>`;
}

function listeHTML() {
  const liste = eintraege();
  if (!liste.length) return '<div class="empty-state"><p class="es-t">Noch keine Angebote drin.</p><p>Fotografier die Prospektseiten, nimm Screenshots aus der Aldi-, Lidl-, Rewe- oder Kaufland-App – oder tipp die Angebote ein. Beide Handys sehen sie dann.</p></div>';
  const nachLaden = new Map();
  const reihenfolge = [...LAEDEN, ...new Set(liste.map((a) => a.laden))];
  for (const a of liste) { if (!nachLaden.has(a.laden)) nachLaden.set(a.laden, []); nachLaden.get(a.laden).push(a); }
  const bisText = (a) => (a.bis && !Number.isNaN(Date.parse(a.bis)) ? `bis ${tagKurz(a.bis)}` : '');
  let html = '';
  for (const laden of reihenfolge) {
    const g = nachLaden.get(laden);
    if (!g) continue;
    nachLaden.delete(laden);
    const bis = [...new Set(g.map(bisText).filter(Boolean))];
    html += `<section class="grp a-grp" data-laden="${esc(laden)}"><h3><span class="grp-name">${esc(laden)}${bis.length === 1 ? ` <small>${esc(bis[0])}</small>` : ''}</span><span class="num">${g.length}</span></h3><ul class="items">${g.map((a) => `<li class="item a-item" data-a-id="${esc(a.id)}">
<div class="item-main"><span class="item-name">${esc(a.name)}</span><span class="item-sub">${a.k && app.katalog[a.k] ? `<span>→ ${esc(app.katalog[a.k].n)}</span>` : '<span class="a-ohne">keine Rezeptzutat</span>'}${bis.length > 1 && bisText(a) ? `<span>${esc(bisText(a))}</span>` : ''}</span></div>
<span class="item-qty">${esc(angebotMenge(a))}</span>
<button type="button" class="x" data-a-weg="${esc(a.id)}" aria-label="${esc(a.name)} entfernen">${X}</button></li>`).join('')}</ul></section>`;
  }
  const st = app.stand.angebote || {};
  const wer = st.von ? `von ${st.von === app.name() ? 'dir' : esc(st.von)}` : '';
  const wann = st.stand && !Number.isNaN(Date.parse(st.stand)) ? esc(tagKurz(heute(new Date(st.stand)))) : '';
  html += `<div class="a-foot"><span class="fine">${liste.length} Angebot${liste.length === 1 ? '' : 'e'}${wer || wann ? `, zuletzt ${[wer, wann].filter(Boolean).join(' ')}` : ''}</span>${leerenFragen
    ? '<span class="confirm">Alle Angebote löschen? <button type="button" class="btn btn-quiet" data-act="a-leeren-ja">Ja</button><button type="button" class="btn btn-quiet" data-act="a-leeren-nein">Nein</button></span>'
    : '<button type="button" class="linkbtn" data-act="a-leeren">Alle löschen</button>'}</div>`;
  return html;
}

function passtHTML() {
  const liste = eintraege();
  if (!liste.length) return '';
  const top = topRezepte(app.rezepte, liste, app);
  const karten = top.map(({ r, treffer, ersparnisBox }) => {
    const was = treffer.map((t) => esc(t.it.n.split(' (')[0])).join(', ');
    const spart = ersparnisBox >= 0.05 ? ` · spart ≈ ${esc(euro(ersparnisBox))}/Box` : '';
    return `<li><button type="button" class="ki-liste-b a-passt-b" data-a-open="${esc(r.id)}"><b>${esc(r.name)}</b><small>${treffer.length === 1 ? 'Im Angebot' : `${treffer.length} im Angebot`}: ${was}${spart}</small></button></li>`;
  }).join('');
  const mitKatalog = liste.filter((a) => a.k).length;
  return `<section class="a-passt"><h3 class="sub-h">Passt zu euren Rezepten</h3>
${top.length ? `<ul class="ki-liste" id="a-passt-liste">${karten}</ul>` : `<p class="fine">${mitKatalog ? 'Kein Rezept nutzt diese Angebote.' : 'Keins der Angebote ist eine Rezeptzutat – die KI kann trotzdem etwas daraus machen.'}</p>`}
<div class="a-ki"><button type="button" class="btn btn-primary" data-act="a-vorschlag">Neues Rezept aus den Angeboten</button><p class="fine">Die KI baut ein Rezept um die Angebote herum, die App rechnet es auf eure Ziele. Mit „Neuer Vorschlag“ gibt es dann das nächste.</p></div>
</section>`;
}

export function angeboteZeichnen() {
  const el = $('#view-angebote');
  if (!el) return;
  const n = angeboteAnzahl();
  el.innerHTML = `<button type="button" class="back nur-breit" data-act="angebote-zu">${ZURUECK}Alle Rezepte</button>
<div class="l-head"><h2 id="a-title">Angebote der Woche</h2><span class="l-count" id="a-count">${n ? `${n} drin` : ''}</span></div>
<p class="a-lead">Was ist diese Woche bei Aldi, Lidl, Rewe oder Kaufland günstig? Fotografier die Prospektseite oder mach Screenshots aus der App – die KI liest die Angebote aus. Darunter steht, welche Rezepte davon profitieren.</p>
<div class="a-lesen">${lesenHTML()}</div>
<div id="a-liste">${app.listeDa ? listeHTML() : '<p class="loading">Angebote werden geladen…</p>'}</div>
${passtHTML()}`;
  zahlZeichnen();
}

/** Die Zahl am Reiter unten und der Text auf der Karte bei den Rezepten. */
export function zahlZeichnen() {
  const n = angeboteAnzahl();
  const b = $('#a-badge');
  if (b) { b.textContent = String(n); b.hidden = !n; }
  const k = $('#angebote-karte-text');
  if (k) k.textContent = n ? `${n} Angebot${n === 1 ? '' : 'e'} drin – welche Rezepte davon profitieren, und ein neues aus den Angeboten.` : 'Prospekt fotografieren oder Angebote eintippen – welche Rezepte davon profitieren, und ein neues aus den Angeboten.';
}

/* ------------------------------------------------------------- Fotos */

async function fotosDazu(dateien) {
  const neu = [...dateien].filter((d) => /^image\//.test(d.type) || !d.type).slice(0, MAX_FOTOS - fotos.length);
  if (!neu.length) return;
  let kaputt = 0;
  for (const d of neu) {
    try { fotos.push(await fotoVorbereiten(d)); } catch { kaputt++; }
  }
  if (kaputt) melde(kaputt === 1 ? 'Ein Bild ließ sich nicht lesen.' : `${kaputt} Bilder ließen sich nicht lesen.`);
  fehler = null;
  if (!lauf) angeboteZeichnen();
}

function fotoWeg(i) {
  const f = fotos[i];
  if (!f) return;
  URL.revokeObjectURL(f.url);
  fotos.splice(i, 1);
  angeboteZeichnen();
}

function fotosLeeren() {
  for (const f of fotos) URL.revokeObjectURL(f.url);
  fotos = [];
}

/* ------------------------------------------------------------- Lesen */

function uebernehmen(neu, { quelle }) {
  if (!neu.length) { fehler = quelle === 'ki' ? 'Die KI hat keine Angebote erkannt. Näher ran, gerade halten, gutes Licht.' : 'Keine Zeile verstanden. So geht es: „Aldi Hähnchenbrustfilet 1 kg 7,49“.'; angeboteZeichnen(); return; }
  const vorher = app.stand.angebote;
  app.aendern(opAngeboteDazu(neu, app.name()));
  const ohne = neu.filter((a) => !a.k).length;
  melde(`${neu.length} Angebot${neu.length === 1 ? '' : 'e'} eingetragen${ohne ? `, ${ohne} ohne Rezeptzutat` : ''} – das andere Handy sieht sie auch.`, {
    knopf: 'Rückgängig',
    beiKnopf: () => app.aendern(opAngebote(vorher?.eintraege || [], vorher?.von, vorher?.stand || undefined)),
  });
  text = '';
  fotosLeeren();
  fehler = null;
  angeboteZeichnen();
}

async function lesen() {
  if (lauf) return;
  const t = text.trim();
  if (!fotos.length) {
    // Getippte Zeilen liest die App selbst – ohne KI, ohne Netz
    const zeilen = t.split(/\n|;/).map((z) => z.trim()).filter(Boolean);
    if (!zeilen.length) { fehler = 'Mach ein Foto oder tipp ein Angebot ein.'; angeboteZeichnen(); $('#a-text')?.focus(); return; }
    const neu = [];
    const kaputt = [];
    let laden = '';
    for (const z of zeilen) {
      // „Aldi:“ allein in einer Zeile gilt für die folgenden Zeilen
      const nurLaden = z.match(new RegExp(`^(${LAEDEN.join('|')})\\s*:?$`, 'i'));
      if (nurLaden) { laden = nurLaden[1]; continue; }
      const a = zeileLesen(laden && !new RegExp(`^(${LAEDEN.join('|')})\\b`, 'i').test(z) ? `${laden} ${z}` : z, app.katalog);
      if (a) neu.push(a); else kaputt.push(z);
    }
    if (kaputt.length && neu.length) melde(`Nicht verstanden: ${kaputt.slice(0, 2).join(' · ')}${kaputt.length > 2 ? ' …' : ''}`);
    uebernehmen(neu, { quelle: 'zeilen' });
    return;
  }
  const schluessel = ladeKi();
  if (!schluessel) { fehler = 'Fürs Auslesen der Bilder fehlt der KI-Schlüssel – unter Resteverwertung einrichten.'; angeboteZeichnen(); return; }
  fehler = null;
  lauf = { controller: new AbortController(), start: Date.now(), timer: null };
  lauf.timer = setInterval(() => { const el = $('#a-lauf-d'); if (el && lauf) el.textContent = `${Math.round((Date.now() - lauf.start) / 1000)} s`; }, 1000);
  angeboteZeichnen();
  const meinLauf = lauf;
  const anbieter = anbieterVon(schluessel) || 'anthropic';
  const fertig = () => { clearInterval(meinLauf.timer); lauf = null; };
  try {
    const rumpf = rumpfAngebote(anbieter, { fotos: fotos.map((f) => f.b64), text: t, katalog: app.katalog, modell: { gemini: ANBIETER.gemini.modell, anthropic: ANBIETER.anthropic.modell } });
    const { eingabe } = await kiAnfragen(rumpf, { schluessel, api: lese('__kiapi', null) || '', signal: meinLauf.controller.signal });
    const neu = angeboteBereinigen(eingabe?.angebote, app.katalog).map((a) => ({ ...a, laden: a.laden === 'Sonstige' && t ? ladenAusText(t) || a.laden : a.laden }));
    fertig();
    uebernehmen(neu, { quelle: 'ki' });
  } catch (e) {
    fertig();
    if (e?.art !== 'abbruch') fehler = e?.message || KI_FEHLER.antwort;
    angeboteZeichnen();
  }
}

const ladenAusText = (t) => { const m = t.match(new RegExp(`\\b(${LAEDEN.join('|')})\\b`, 'i')); return m ? LAEDEN.find((l) => l.toLowerCase() === m[1].toLowerCase()) : ''; };

/* ------------------------------------------------------------- Klicks */

export function klickAngebote(el) {
  const d = el.dataset;
  if (d.aFotoWeg !== undefined) { fotoWeg(Number(d.aFotoWeg)); return true; }
  if (d.aWeg) {
    const a = (app.stand.angebote?.eintraege || []).find((x) => x.id === d.aWeg);
    app.aendern(opAngebotWeg(d.aWeg));
    if (a) melde(`„${a.name}“ entfernt`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opAngeboteDazu([a], app.name())) });
    return true;
  }
  if (d.aOpen) { zeigeReiter('rezepte'); oeffneRezept(d.aOpen); return true; }
  switch (d.act) {
    case 'angebote': zeigeReiter('angebote'); window.scrollTo(0, 0); return true;
    case 'angebote-zu': zeigeReiter('rezepte'); return true;
    case 'a-abbrechen': lauf?.controller.abort(); return true;
    case 'a-einrichten': zeigeReiter('rezepte'); oeffneEinrichten(); return true;
    case 'a-leeren': leerenFragen = true; angeboteZeichnen(); return true;
    case 'a-leeren-nein': leerenFragen = false; angeboteZeichnen(); return true;
    case 'a-leeren-ja': {
      const vorher = app.stand.angebote;
      leerenFragen = false;
      app.aendern(opAngebote([], app.name()));
      melde('Alle Angebote gelöscht', { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opAngebote(vorher?.eintraege || [], vorher?.von, vorher?.stand || undefined)) });
      return true;
    }
    case 'a-vorschlag': {
      const liste = eintraege();
      if (!liste.length) return true;
      zeigeReiter('rezepte');
      resteMitAngeboten(angeboteText(liste));
      return true;
    }
    default: return false;
  }
}

export function eingabeAngebote(t) {
  if (t.id === 'a-text') { text = t.value.slice(0, 2000); if (fehler) { fehler = null; const f = $('#a-fehler'); if (f) f.hidden = true; } return true; }
  return false;
}

export function aenderungAngebote(t) {
  if (t.id === 'a-kamera' || t.id === 'a-bilder') {
    const dateien = [...(t.files || [])];
    t.value = '';
    fotosDazu(dateien);
    return true;
  }
  return false;
}

export function absendenAngebote(ev) {
  if (ev.target.id !== 'a-form') return false;
  ev.preventDefault();
  lesen();
  return true;
}
