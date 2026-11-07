/*
 * Ziel pro Box: die eigenen Makros eintragen, und alle Rezepte rechnen sich
 * darauf um (zielrechner.js) – Einstellungen → „Ziel pro Box“, beim ersten
 * Start eines Gasts auch im Willkommen.
 *
 * Das Ziel gilt für die ganze Liste (liste.json profil.ziel): Wer eine Liste
 * teilt, kocht dieselben acht Boxen. Ohne eigenes Ziel gilt das aus
 * daten/rezepte.json, auf das die Rezepte gebaut sind – dann bleibt alles,
 * wie es dort steht.
 *
 * Gerechnet wird beim Laden; die Mengen merkt sich das Gerät je Ziel
 * (MENGEN), so ist der nächste Start sofort da. Ändert man das Ziel,
 * ziehen auch die Zutaten mit, die schon auf der Liste stehen und noch nicht
 * gekauft sind.
 *
 * Danach die Boxen pro Rezept (boxen.js, ansicht-boxen.js): erst aufs Ziel
 * für 8 Boxen, dann auf die Zahl der Liste – so bleibt pro Box das Ziel.
 */
import { app, $, melde, lese, schreibe, zeigeReiter } from './kern.js';
import { esc, nf1, nfi, tagKurz } from './format.js';
import { alleAufZiel, zielBereinigen, gleichesZiel, kcalAus, zielText, trefferZaehlen, GRENZEN, MAKROS, TREFFER } from './zielrechner.js';
import { opProfil, opTeil, rezepteAufListe, einkaufsZutaten, aufloesen } from './liste.js';
import { istEigen } from './profil.js';
import { aufBoxen, boxenDerListe } from './boxen.js';

const MENGEN = 'boxenstopp.zielmengen.v1'; // { schluessel, mengen: { <rezept>: { <zutat>: Menge } } }
const zielSchluessel = (z) => MAKROS.map((k) => z[k]).join('|');

let angewendet = '';

/** Das Ziel der Liste – das eigene, sonst das aus daten/rezepte.json. */
export const eigenesZiel = () => zielBereinigen(app.stand.profil?.ziel);
const zielJetzt = () => eigenesZiel() || app.zielStandard;
/** Gilt gerade ein eigenes Ziel (nicht das Standard-Ziel)? */
export const hatEigenesZiel = () => !!eigenesZiel() && !gleichesZiel(eigenesZiel(), app.zielStandard);

/**
 * Das Ziel anwenden: app.ziel setzen und die festen Rezepte darauf rechnen
 * (app.rezepte, app.nachId). true, wenn sich etwas geändert hat – dann muss
 * neu gezeichnet werden.
 */
export function zielAnwenden() {
  if (!app.rezepteBasis.length) return false;
  const z = zielJetzt();
  const boxen = boxenDerListe(app.stand);
  const schluessel = `${app.datenVersion || ''}|${zielSchluessel(z)}`;
  if (`${schluessel}|${boxen}` === angewendet) return false;
  angewendet = `${schluessel}|${boxen}`;
  app.ziel = { ...z };
  app.boxen = boxen;
  let rezepte = app.rezepteBasis;
  if (!gleichesZiel(z, app.zielStandard)) {
    const gemerkt = lese(MENGEN, null);
    const daten = { preise: app.richtpreise, naehrwerte: app.naehrwerte };
    const ergebnis = alleAufZiel(app.rezepteBasis, z, daten, gemerkt?.schluessel === schluessel ? gemerkt.mengen : {});
    rezepte = ergebnis.rezepte;
    if (gemerkt?.schluessel !== schluessel) schreibe(MENGEN, { schluessel, mengen: ergebnis.mengen });
  }
  if (boxen !== 8) rezepte = rezepte.map((r) => aufBoxen(r, boxen, { katalog: app.katalog }));
  app.rezepte = rezepte;
  for (const r of rezepte) app.nachId[r.id] = r;
  zielKopfZeichnen();
  return true;
}

/** Oben bei den Rezepten: das Ziel pro Box. */
export function zielKopfZeichnen() {
  const el = $('#r-ziel');
  if (!el) return;
  const z = app.ziel;
  const eigen = hatEigenesZiel();
  el.innerHTML = `<span>${eigen ? (istEigen() ? 'Dein Ziel pro Box' : 'Euer Ziel pro Box') : 'Ziel pro Box'}</span><b>${nfi(z.kcal)} kcal</b><b class="m-p">${zahl(z.p)} g P</b><b class="m-kh">${zahl(z.kh)} g KH</b><b class="m-f">${zahl(z.f)} g F</b>${eigen ? '<button type="button" class="target-k" data-act="ziel-aendern">ändern</button>' : ''}`;
  el.classList.toggle('eigen', eigen);
}
const zahl = (x) => (Number.isInteger(x) ? String(x) : nf1(x));

/**
 * Nach einem neuen Ziel (oder neuen Boxen): was von den Rezepten auf der
 * Liste noch offen ist, auf die neuen Mengen (nur auf dem Gerät, das es
 * geändert hat).
 */
export function listeNachziehen() {
  const ops = [];
  for (const rid of rezepteAufListe(app.stand)) {
    const r = app.nachId[rid];
    if (!r?.items) continue;
    for (const it of einkaufsZutaten(r)) {
      const p = app.stand.items[aufloesen(app.stand, it.k)]?.parts?.[rid];
      if (!p || p.done === true || typeof p.q !== 'number') continue;
      if (p.q === it.q && p.u === it.u && (p.h || '') === (it.h || '')) continue;
      ops.push(opTeil(it.k, rid, { q: it.q, u: it.u, h: it.h || '' }, it.kat || app.katalog[it.k]));
    }
  }
  if (ops.length) app.aendern(ops);
  return ops.length;
}

/** Ein neues Ziel für die Liste speichern (null: zurück zum Standard). */
export function zielSpeichern(z, { still = false } = {}) {
  const neu = z && !gleichesZiel(z, app.zielStandard) ? zielBereinigen(z) : null;
  if (z && !neu && !gleichesZiel(z, app.zielStandard)) return false;
  if (neu ? gleichesZiel(neu, eigenesZiel()) : !eigenesZiel()) return true;
  app.aendern(opProfil({ ziel: neu }, app.name()));
  const nachgezogen = listeNachziehen();
  if (!still) {
    const t = trefferZaehlen(app.rezepte);
    melde(neu
      ? `Neues Ziel: ${zielText(neu)}. ${t.treffen} von ${t.gesamt} Rezepten treffen es genau${nachgezogen ? ', die Liste ist nachgezogen' : ''}.`
      : `Zurück auf das Standard-Ziel${nachgezogen ? ' – die Liste ist nachgezogen' : ''}.`);
  }
  return true;
}

/* ------------------------------------------------------- Einstellungen */

let form = null; // { werte: { kcal, p, kh, f } als Text, tag: bool, mahlzeiten, fehler }

const werteVon = (z) => Object.fromEntries(MAKROS.map((k) => [k, String(z[k]).replace('.', ',')]));
const zahlAus = (t) => {
  const s = String(t ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Aus dem, was eingetippt ist, ein Ziel pro Box – oder { fehler }. Ohne kcal
 * zählen 4/4/9; „pro Tag“ teilt durch die Mahlzeiten.
 */
export function zielAusFeldern(werte, { tag = false, mahlzeiten = 3 } = {}) {
  const n = Object.fromEntries(MAKROS.map((k) => [k, zahlAus(werte[k])]));
  if ([n.p, n.kh, n.f].some((x) => x === null)) return { fehler: 'Trag Protein, Kohlenhydrate und Fett ein – kcal rechnet die App sonst selbst.' };
  if (MAKROS.some((k) => Number.isNaN(n[k]))) return { fehler: 'Bitte nur Zahlen, z. B. 32 oder 15,5.' };
  const teiler = tag ? Math.min(6, Math.max(1, Number(mahlzeiten) || 3)) : 1;
  const z = { p: n.p / teiler, kh: n.kh / teiler, f: n.f / teiler };
  z.kcal = n.kcal === null ? kcalAus(z.p, z.kh, z.f) : n.kcal / teiler;
  const aus = MAKROS.find((k) => z[k] < GRENZEN[k][0] || z[k] > GRENZEN[k][1]);
  if (aus) {
    const name = { kcal: 'kcal', p: 'Protein', kh: 'Kohlenhydrate', f: 'Fett' }[aus];
    return { fehler: `${name} pro Box zwischen ${GRENZEN[aus][0]} und ${GRENZEN[aus][1]}${aus === 'kcal' ? '' : ' g'}${tag ? ' – geteilt durch die Mahlzeiten' : ''}.` };
  }
  const b = zielBereinigen(z);
  if (!b) return { fehler: 'Das sieht nicht nach einem Ziel pro Box aus.' };
  // Passen kcal und Makros gar nicht zusammen? Dann sagen, nicht still rechnen
  const aus4 = kcalAus(b.p, b.kh, b.f);
  const hinweis = Math.abs(b.kcal - aus4) > Math.max(40, 0.12 * aus4) ? `Aus Protein, KH und Fett ergeben sich ${aus4} kcal – die Rezepte richten sich vor allem nach den Makros.` : '';
  return { ziel: b, hinweis };
}

export function zielEinstellungenHTML() {
  const eigen = eigenesZiel();
  const jetzt = app.ziel;
  const f = form || { werte: werteVon(jetzt), tag: false, mahlzeiten: 3, fehler: '' };
  const feld = (k, name, einheit, klasse = '') => `<label class="e-ziel-f ${klasse}"><span>${name}</span><span class="e-ziel-inp"><input name="${k}" type="text" inputmode="decimal" autocomplete="off" value="${esc(f.werte[k] ?? '')}" aria-label="${name}${f.tag ? ' pro Tag' : ' pro Box'}"${k === 'kcal' ? ' placeholder="auto"' : ''}><small>${einheit}</small></span></label>`;
  const vorschau = f.tag ? zielAusFeldern(f.werte, f) : null;
  const t = trefferZaehlen(app.rezepte);
  // Wer es gesetzt hat und wann, steht im Profil (zielBereinigen behält nur die Werte)
  const roh = app.stand.profil?.ziel;
  const wer = eigen && roh?.by ? ` von ${roh.by === app.name() ? 'dir' : esc(roh.by)}` : '';
  const seit = eigen && roh?.at ? `, seit ${esc(tagKurz(String(roh.at).slice(0, 10)))}` : '';
  const stand = eigen && !gleichesZiel(eigen, app.zielStandard)
    ? `<p class="e-ziel-stand"><b>${esc(zielText(eigen))}</b>${wer}${seit}. ${t.treffen} von ${t.gesamt} Rezepten treffen es genau${t.gesamt - t.treffen ? `, ${t.gesamt - t.treffen} nur ungefähr – im Rezept steht, wo es hakt` : ''}.</p>`
    : `<p class="e-ziel-stand">Gerade das Standard-Ziel <b>${esc(zielText(app.zielStandard))}</b> – darauf sind alle Rezepte gebaut.</p>`;
  return `${stand}
<form class="e-ziel-form" id="e-ziel-form" novalidate>
<div class="e-design e-ziel-wahl" role="radiogroup" aria-label="Werte pro Box oder pro Tag"><label class="e-wahl${f.tag ? '' : ' an'}"><input type="radio" name="e-ziel-art" value="box"${f.tag ? '' : ' checked'}><span>pro Box</span></label><label class="e-wahl${f.tag ? ' an' : ''}"><input type="radio" name="e-ziel-art" value="tag"${f.tag ? ' checked' : ''}><span>pro Tag</span></label></div>
<div class="e-ziel-felder">${feld('kcal', 'kcal', '')}${feld('p', 'Protein', 'g', 'm-p')}${feld('kh', 'KH', 'g', 'm-kh')}${feld('f', 'Fett', 'g', 'm-f')}</div>
${f.tag ? `<label class="e-ziel-tag">Mahlzeiten am Tag <select name="mahlzeiten">${[2, 3, 4, 5].map((n) => `<option value="${n}"${Number(f.mahlzeiten) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
<p class="fine e-ziel-vorschau" id="e-ziel-vorschau">${vorschau?.ziel ? `Pro Box: <b>${esc(zielText(vorschau.ziel))}</b>` : esc(vorschau?.fehler || '')}</p>` : ''}
${f.fehler ? `<p class="zugang-fehler" role="alert">${esc(f.fehler)}</p>` : ''}
<div class="zugang-btns"><button type="submit" class="btn btn-primary">Rezepte darauf rechnen</button>${eigen ? '<button type="button" class="btn btn-quiet" data-act="e-ziel-standard">Zurück zum Standard</button>' : ''}</div>
</form>
<p class="fine">Die App rechnet die Mengen aus – Fleisch, Reis, Nudeln, Öl, Käse wandern, bis jede Box dein Ziel trifft; Dosen und Eier bleiben ganz, volle Packungen, wo es geht. Schritte, Nährwerte, Kosten und die Einkaufsliste ziehen mit. ${istEigen() ? 'Gilt auf allen deinen Geräten.' : 'Gilt für alle, die diese Liste teilen – ihr kocht ja dieselben Boxen.'}</p>`;
}

export function zielEinstellungenZeichnen() {
  const el = $('#e-ziel');
  if (!el || (el.contains(document.activeElement) && document.activeElement.matches('input, select'))) return;
  el.innerHTML = zielEinstellungenHTML();
}

/** Was im Formular steht, ohne neu zu zeichnen (Tippen bleibt, wo es ist). */
function formLesen() {
  const el = $('#e-ziel-form');
  if (!el) return form;
  const werte = Object.fromEntries(MAKROS.map((k) => [k, el.elements[k]?.value ?? '']));
  const tag = el.querySelector('input[name="e-ziel-art"]:checked')?.value === 'tag';
  return { werte, tag, mahlzeiten: Number(el.elements.mahlzeiten?.value || form?.mahlzeiten || 3), fehler: '' };
}

/** Tippen in den Feldern (input): „pro Tag“ zeigt gleich, was pro Box herauskommt. */
export function eingabeZiel(ziel) {
  if (!ziel.closest?.('#e-ziel-form')) return false;
  // pro Box / pro Tag und die Mahlzeiten melden sich auch mit input – das Umrechnen macht change
  if (ziel.type === 'radio' || ziel.tagName === 'SELECT') return true;
  form = formLesen();
  const v = $('#e-ziel-vorschau');
  if (v && form.tag) {
    const e = zielAusFeldern(form.werte, form);
    v.innerHTML = e.ziel ? `Pro Box: <b>${esc(zielText(e.ziel))}</b>` : esc(e.fehler || '');
  }
  return true;
}

/** pro Box / pro Tag, Mahlzeiten (change). */
export function aenderungZiel(ziel) {
  if (!ziel.closest?.('#e-ziel-form')) return false;
  const vorher = form || { tag: false };
  form = formLesen();
  // Ein Zahlenfeld verlassen (change beim Weitertippen im nächsten): nicht neu zeichnen, sonst wäre das nächste Feld weg
  if (ziel.name !== 'e-ziel-art' && ziel.name !== 'mahlzeiten') return true;
  // Umschalten rechnet die Werte um, damit man nicht neu tippen muss
  if (ziel.name === 'e-ziel-art' && vorher.tag !== form.tag) {
    const n = Number(form.mahlzeiten) || 3;
    for (const k of MAKROS) {
      const x = zahlAus(form.werte[k]);
      if (x === null || Number.isNaN(x)) continue;
      const y = form.tag ? x * n : x / n;
      form.werte[k] = String(k === 'kcal' ? Math.round(y) : Math.round(y * 10) / 10).replace('.', ',');
    }
  }
  $('#e-ziel').innerHTML = zielEinstellungenHTML();
  $(`#e-ziel ${ziel.name === 'e-ziel-art' ? `input[value="${form.tag ? 'tag' : 'box'}"]` : 'select'}`)?.focus({ preventScroll: true });
  return true;
}

export function absendenZiel(ev) {
  if (ev.target.id !== 'e-ziel-form') return false;
  ev.preventDefault();
  form = formLesen();
  const e = zielAusFeldern(form.werte, form);
  if (!e.ziel) { form.fehler = e.fehler; $('#e-ziel').innerHTML = zielEinstellungenHTML(); return true; }
  if (!app.listeDa) { form.fehler = 'Einen Moment – die Liste lädt noch.'; $('#e-ziel').innerHTML = zielEinstellungenHTML(); return true; }
  form = null;
  zielSpeichern(e.ziel);
  if (e.hinweis) setTimeout(() => melde(e.hinweis), 3400);
  $('#e-ziel').innerHTML = zielEinstellungenHTML();
  return true;
}

export function klickZiel(el) {
  switch (el.dataset.act) {
    case 'e-ziel-standard':
      form = null;
      zielSpeichern(null);
      $('#e-ziel').innerHTML = zielEinstellungenHTML();
      return true;
    case 'ziel-aendern':
      zeigeReiter('einstellungen');
      window.requestAnimationFrame(() => $('#e-ziel-karte')?.scrollIntoView({ block: 'start' }));
      return true;
    default:
      return false;
  }
}

/* ---------------------------------------------------------- im Rezept */

const NAMEN = { kcal: 'kcal', p: 'Protein', kh: 'KH', f: 'Fett' };
/** Was in Karte und Rezept rot sein darf: die Werte, die das Ziel verfehlen. */
export const daneben = (r) => (r?.angepasst && !r.angepasst.trifft ? MAKROS.filter((k) => Math.abs(r.angepasst.abweichung[k]) > TREFFER[k]) : []);

/** Im Rezept unter dem Etikett: worauf es gerechnet ist, was sich geändert hat, wo es hakt. */
export function angepasstHTML(r) {
  const a = r?.angepasst;
  if (!a) return '';
  const fehlt = daneben(r);
  const wessen = istEigen() ? 'dein' : 'euer';
  const liste = a.aenderungen.length
    ? `<details class="d-ziel-mehr"><summary>${a.aenderungen.length} ${a.aenderungen.length === 1 ? 'Menge' : 'Mengen'} geändert</summary><ul>${a.aenderungen.map((x) => `<li><span>${esc(x.n)}</span><span>${esc(x.vorher)} → <b>${esc(x.nachher)}</b></span></li>`).join('')}</ul></details>`
    : '';
  const warn = fehlt.length
    ? `<p class="d-ziel-warn">Mit den Mengen allein kommt dieses Rezept nicht ganz hin: ${fehlt.map((k) => `${NAMEN[k]} ${a.abweichung[k] > 0 ? '+' : '−'}${k === 'kcal' ? nfi(Math.abs(a.abweichung[k])) : nf1(Math.abs(a.abweichung[k]))}${k === 'kcal' ? '' : ' g'}`).join(', ')}. <button type="button" class="linkbtn" data-act="anpassen-ki">Mit KI ändern</button> tauscht eine Zutat (etwa Kokosmilch light statt normal) – die Mengen rechnet danach wieder die App.</p>`
    : '';
  return `<div class="d-ziel${fehlt.length ? ' daneben' : ''}"><p><b>Auf ${wessen} Ziel gerechnet</b> (${esc(zielText(a.ziel))})${a.aenderungen.length ? '' : ' – passt schon, wie es ist'}.</p>${liste}${warn}</div>`;
}
