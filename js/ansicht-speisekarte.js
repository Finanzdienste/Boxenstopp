/*
 * „Speisekarte“ (Kachel bei den Rezepten): Fotos, ein PDF, Text oder ein
 * Link einer Karte – welches Gericht kommt dem Ziel pro Box am nächsten?
 * Lesen und Schätzen macht die KI, Rechnen und Sortieren speisekarte.js;
 * hier Eingabe, Lauf und Ergebnis.
 *
 * Oder „Veranstaltung“: sagen, wohin man geht (und wann) – Claude sucht im
 * Netz, welche Stände und Gerichte es dort gibt, und schätzt den Rest
 * (speisekarte.js rumpfVeranstaltung). Dazu Bilder: oben das Bild der Seite
 * der Veranstaltung (Supabase-Funktion produkt-bild, nur im Speicher), je
 * Gericht das aus seinem Wikipedia-Artikel (gemerkt wird nur die Adresse),
 * sonst ein Bildchen der App.
 *
 * Das letzte Ergebnis merkt sich das Gerät (GEMERKT): Im Restaurant mit
 * schlechtem Netz ist es noch da, und ändert man sein Ziel, sortiert die App
 * neu, ohne die KI noch einmal zu fragen. Nichts davon geht in die Liste.
 */
import { app, $, melde, lese, schreibe } from './kern.js';
import { esc, nfi } from './format.js';
import { rumpfKarte, karteBereinigen, sortieren, ART_NAME, ENTHAELT_NAME, rumpfVeranstaltung, veranstaltungBereinigen, VERANSTALTUNG_SCHEMA, tagText, quellenVon, wikiTitel, wikiAdresse, wikiBilderAus, symbolFuer, hostVon } from './speisekarte.js';
import { kiAnfragen, anbieterVon } from './ki.js';
import { shopBild, KENNUNG } from './inventar-netz.js';
import { bildPfad } from './bilder.js';
import { jsonAus, linkAus } from './amy-import.js';
import { mitWebsuche } from './web.js';
import { ladeKi } from './zugang.js';
import { fotoVorbereiten, blobZuB64, oeffneEinrichten } from './ansicht-ki.js';
import { offenesRezept, schliesseRezept, rasterZeichnen, ic } from './ansicht-rezepte.js';
import { fuerWen, istEigen } from './profil.js';
import { zielText } from './zielrechner.js';

const GEMERKT = 'boxenstopp.speisekarte.v1';
const MODUS = 'boxenstopp.speisekarte.modus.v1'; // was zuletzt gewählt war: Speisekarte oder Veranstaltung
const MAX_FOTOS = 6;
const MAX_PDF = 15 * 1024 * 1024;
const KANTE = 2000;
const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
const KAMERA = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13" r="3.4"/></svg>';
const BILD = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/></svg>';
const PDF = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h5"/></svg>';

let fotos = []; // { url, b64 }
let pdf = null; // { name, b64 }
let text = '';
const tagIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let modus = lese(MODUS, 'karte') === 'veranstaltung' ? 'veranstaltung' : 'karte';
let wohin = ''; // was jemand getippt hat – nur, bis es gesucht ist
let wann = tagIso();
let seitenBild = null; // { seite, url } – das Bild der Seite der Veranstaltung, nur im Speicher
const wikiVersucht = new Set(); // Titel, nach denen dieses Öffnen schon gefragt hat
const bildVersucht = new Set(); // Seiten, deren Bild schon geholt wurde (oder versucht)
let bilderLaufen = false;
const zeitlimit = (ms) => (typeof globalThis.AbortSignal?.timeout === 'function' ? globalThis.AbortSignal.timeout(ms) : undefined);
let lauf = null; // { controller, start, gerichte, timer }
let fehler = '';
let ergebnis = gemerkt();

function gemerkt() {
  const g = lese(GEMERKT, null);
  if (!g || typeof g !== 'object') return null;
  const b = g.art === 'veranstaltung' ? veranstaltungBereinigen(g) : karteBereinigen(g);
  return b.gerichte ? { ...b, at: typeof g.at === 'string' ? g.at : '' } : null;
}
const istVa = () => ergebnis?.art === 'veranstaltung';

export const speisekarteOffen = () => !!$('#speisekarte') && !$('#speisekarte').hidden;

export function oeffneSpeisekarte() {
  if (offenesRezept()) schliesseRezept();
  for (const id of ['#browse', '#detail', '#reste', '#doppel']) { const el = $(id); if (el) el.hidden = true; }
  const el = $('#speisekarte');
  el.hidden = false;
  zeichnen();
  window.scrollTo(0, 0);
}

export function schliesseSpeisekarte() {
  const el = $('#speisekarte');
  if (el) el.hidden = true;
  $('#browse').hidden = false;
  rasterZeichnen();
}

/* ------------------------------------------------------------ Zeichnen */

const wessenZiel = () => (istEigen() ? 'deinem' : app.name() ? 'deinem' : 'eurem');
/* Geschätzt ist geschätzt: ganze Zahlen, keine Kommastellen, die es nicht gibt */
const zahl = (k, x) => nfi(x);
const mitZeichen = (k, x) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${zahl(k, Math.abs(x))}`;

function werteHTML(w, abw) {
  const zeile = [['kcal', 'kcal', ''], ['p', 'P', ' g'], ['kh', 'KH', ' g'], ['f', 'F', ' g']];
  return `<div class="sk-werte" role="group" aria-label="Geschätzte Nährwerte">${zeile.map(([k, name, e]) => {
    const d = abw[k];
    const grenze = k === 'kcal' ? 60 : k === 'f' ? 4 : 6;
    const ton = Math.abs(d) <= grenze / 2 ? 'gut' : Math.abs(d) <= grenze ? 'mittel' : 'weit';
    return `<div class="c-${k}"><span class="k">${name}</span><b>${zahl(k, w[k])}<small>${e}</small></b><span class="sk-d sk-${ton}">${mitZeichen(k, d)}</span></div>`;
  }).join('')}</div>`;
}

const SICHER_TEXT = { gut: 'gut zu schätzen', mittel: 'Schätzung', grob: 'grobe Schätzung' };

/** Das Bild eines Gerichts: aus Wikipedia, sonst ein Bildchen der App. */
function bildHTML(g, art = '') {
  const src = g.bild?.src || '';
  return `<span class="sk-bild${art ? ` ${art}` : ''}${src ? '' : ' symbol'}">${src
    ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<img src="${esc(bildPfad(symbolFuer(g)))}" alt="" aria-hidden="true">`}</span>`;
}
const QUELLE_TEXT = { seite: 'laut Seite', typisch: 'vermutlich' };
const quelleHTML = (q) => `<span class="sk-q${q === 'seite' ? ' sk-q-seite' : ''}">${QUELLE_TEXT[q] || QUELLE_TEXT.typisch}</span>`;

function gerichtKarte({ g, b }, gross = false) {
  const tipp = b.tipp && g.tipp ? `<p class="sk-bestellen"><b>So bestellen:</b> ${esc(g.tipp)}</p>` : '';
  const meta = [ART_NAME[g.art], g.preis, g.portion, SICHER_TEXT[g.sicher]].filter(Boolean).map(esc).join(' · ');
  const va = istVa();
  const stand = va ? `<p class="sk-stand">${g.stand ? `Stand: <b>${esc(g.stand)}</b> · ` : ''}${quelleHTML(g.quelle)}</p>` : '';
  return `<article class="sk-gericht${gross ? ' sk-erste' : ''}${va ? ' mit-bild' : ''}">
${gross ? `<span class="sk-eyebrow">Am nächsten an ${wessenZiel()} Ziel</span>` : ''}
${va ? bildHTML(g, gross ? 'gross' : '') : ''}<div class="sk-gericht-t">
<h${gross ? 2 : 3} class="sk-name">${esc(g.name)}</h${gross ? 2 : 3}>
${stand}
${g.was ? `<p class="sk-was">${esc(g.was)}</p>` : ''}
</div>
${tipp}
${werteHTML(b.werte, b.abweichung)}
<p class="sk-meta">${meta}</p>
</article>`;
}

function zeileHTML({ g, b }) {
  const chips = g.enthaelt.map((x) => `<span class="sk-chip">${esc(ENTHAELT_NAME[x] || x)}</span>`).join('');
  const va = istVa();
  const unter = [va ? g.stand : '', ART_NAME[g.art], g.preis].filter(Boolean).join(' · ');
  return `<li class="sk-zeile${va ? ' mit-bild' : ''}">${va ? bildHTML(g, 'klein') : ''}<div class="sk-zeile-i"><div class="sk-zeile-t"><b>${esc(g.name)}</b>${chips}<small>${esc(unter)}${b.tipp ? ' · mit Tipp' : ''}${va ? ` · ${QUELLE_TEXT[g.quelle] || QUELLE_TEXT.typisch}` : ''}</small></div><span class="sk-zeile-w">${nfi(b.werte.kcal)} kcal · P ${nfi(b.werte.p)} · KH ${nfi(b.werte.kh)} · F ${nfi(b.werte.f)}</span></div></li>`;
}

/** Oben bei einer Veranstaltung: Bild der Seite, Name, Ort, wann – und ob es im Netz stand. */
function vaKopfHTML() {
  const v = ergebnis.veranstaltung || {};
  const bild = v.url && seitenBild?.seite === v.url ? `<img class="sk-va-bild" src="${esc(seitenBild.url)}" alt="">` : '';
  const wo = [v.ort, v.wann].filter(Boolean).join(' · ');
  return `<article class="sk-va${bild ? ' mit-bild' : ''}">${bild}<div class="sk-va-t">
<span class="sk-q${ergebnis.gefunden ? ' sk-q-seite' : ''}">${ergebnis.gefunden ? 'Im Netz gefunden' : 'Nicht gefunden – geschätzt'}</span>
<h2 class="sk-va-name">${esc(v.name || 'Die Veranstaltung')}</h2>
${wo ? `<p class="sk-va-wo">${esc(wo)}</p>` : ''}
${v.url ? `<a class="sk-va-link" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.seite || hostVon(v.url))}</a>` : ''}
</div></article>`;
}

/** Die Stände mit ihren Gerichten – je Stand das Bild des ersten. */
function staendeHTML() {
  const st = ergebnis.staende || [];
  if (!st.length) return '';
  const zeilen = st.map((x) => {
    const gs = ergebnis.gerichte.filter((g) => g.stand === x.name);
    const bild = gs[0] ? bildHTML(gs[0], 'klein') : '<span class="sk-bild klein symbol"><img src="bilder/zutaten/fork-and-knife-with-plate.svg" alt="" aria-hidden="true"></span>';
    const was = [x.was, gs.length ? gs.map((g) => g.name).join(', ') : ''].filter(Boolean);
    return `<li class="sk-stand-z">${bild}<div><b>${esc(x.name)}</b> ${quelleHTML(x.quelle)}${was.map((t) => `<small>${esc(t)}</small>`).join('')}</div></li>`;
  }).join('');
  return `<details class="sk-alle sk-staende-d" open><summary>Stände (${st.length})</summary><ul class="sk-staende">${zeilen}</ul></details>`;
}

function ergebnisHTML() {
  const { oben, rest, ohne } = sortieren(ergebnis.gerichte, app.ziel);
  const wann = ergebnis.at && !Number.isNaN(Date.parse(ergebnis.at)) ? new Date(ergebnis.at).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const va = istVa();
  const zahlText = `${ergebnis.gerichte.length} ${ergebnis.gerichte.length === 1 ? 'Gericht' : 'Gerichte'}`;
  const kopf = va
    ? `${vaKopfHTML()}<p class="sk-k">${(ergebnis.staende || []).length} ${(ergebnis.staende || []).length === 1 ? 'Stand' : 'Stände'} · ${zahlText}${wann ? ` · nachgesehen ${esc(wann)}` : ''}</p>`
    : `<p class="sk-k">${esc(ergebnis.restaurant || 'Die Karte')} · ${zahlText}${wann ? ` · gelesen ${esc(wann)}` : ''}</p>`;
  const hinweis = ergebnis.hinweis ? `<p class="fine">${esc(ergebnis.hinweis)}</p>` : '';
  const erste = oben[0] ? gerichtKarte(oben[0], true) : `<p class="sk-leer">${va ? 'Dort gibt es wohl nichts, was als Mahlzeit passt.' : 'Auf der Karte ist nichts, was als Mahlzeit passt.'}</p>`;
  const auch = oben.length > 1 ? `<h3 class="sub-h">Danach am nächsten</h3><div class="sk-auch">${oben.slice(1).map((x) => gerichtKarte(x)).join('')}</div>` : '';
  const alle = rest.length ? `<details class="sk-alle"><summary>Alle weiteren Gerichte (${rest.length}), nächstes zuerst</summary><ul class="sk-liste">${rest.map(zeileHTML).join('')}</ul></details>` : '';
  const nicht = ohne.length ? `<details class="sk-alle sk-ohne"><summary>${istEigen() ? 'Mit Fisch & Co.' : 'Esst ihr nicht'} (${ohne.length})</summary><ul class="sk-liste">${ohne.map(zeileHTML).join('')}</ul></details>` : '';
  const quellen = va ? quellenVon(ergebnis) : [];
  const fuss = va
    ? `${quellen.length ? `<p class="fine sk-quellen">Gefunden auf: ${quellen.map((q) => `<a href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">${esc(q.host)}</a>`).join(', ')}</p>` : ''}
<p class="fine">„Laut Seite“ stand so im Netz, „vermutlich“ ist geschätzt – das gibt es auf so einer Veranstaltung meistens. Die Nährwerte schätzt die KI, rechne mit ±25 %; was am nächsten an ${esc(zielText(app.ziel))} liegt, rechnet die App aus. Die Bilder zeigen das Gericht allgemein (Wikipedia, freie Lizenzen), nicht den Stand.</p>
<div class="zugang-btns"><button type="button" class="btn btn-primary" data-act="sk-neu">Neu nachsehen</button></div>`
    : `<p class="fine">Die Nährwerte schätzt die KI aus der Karte – Restaurantportionen schwanken, rechne mit ±20 %. Was am nächsten an ${esc(zielText(app.ziel))} liegt, rechnet die App aus; Fett zählt dabei 1,5-fach.</p>
<div class="zugang-btns"><button type="button" class="btn btn-primary" data-act="sk-neu">Andere Karte</button></div>`;
  return `<section class="sk-ergebnis" aria-label="Ergebnis">${kopf}${erste}${auch}${va ? staendeHTML() : ''}${alle}${nicht}${hinweis}${fuss}</section>`;
}

function vorschauHTML() {
  const bilder = fotos.map((f, i) => `<div class="k-foto"><img src="${esc(f.url)}" alt="Foto ${i + 1}"><button type="button" class="k-foto-x" data-sk-foto-weg="${i}" aria-label="Foto ${i + 1} entfernen">${X}</button></div>`).join('');
  const datei = pdf ? `<div class="sk-pdf">${PDF}<span>${esc(pdf.name)}</span><button type="button" class="k-foto-x" data-act="sk-pdf-weg" aria-label="PDF entfernen">${X}</button></div>` : '';
  return datei + bilder;
}

const modusHTML = () => `<div class="e-design sk-modus" role="group" aria-label="Was hast du?"><button type="button" class="e-wahl${modus === 'karte' ? ' an' : ''}" data-sk-modus="karte" aria-pressed="${modus === 'karte'}">Speisekarte</button><button type="button" class="e-wahl${modus === 'veranstaltung' ? ' an' : ''}" data-sk-modus="veranstaltung" aria-pressed="${modus === 'veranstaltung'}">Veranstaltung</button></div>`;

function vaFormularHTML() {
  const claude = anbieterVon(ladeKi()) !== 'gemini';
  return `${modusHTML()}<form class="ki-form" id="sk-va-form" novalidate>
<label for="sk-wohin">Wohin gehst du?</label>
<input id="sk-wohin" type="text" maxlength="300" autocomplete="off" enterkeyhint="search" placeholder="z. B. Weihnachtsbasar der Seemannskirche, Hamburg" value="${esc(wohin)}">
<label for="sk-wann">Wann</label>
<input id="sk-wann" type="date" value="${esc(wann)}">
<p class="zugang-fehler" id="sk-fehler"${fehler ? '' : ' hidden'}>${esc(fehler)}</p>
<button type="submit" class="btn btn-primary k-los" id="sk-va-los">Nachsehen, was es gibt</button>
<p class="fine">${claude
    ? 'Claude sucht die Veranstaltung im Netz – Stände, Essen, Preise – und schätzt, was nicht dasteht. Dauert etwa eine Minute.'
    : 'Mit Gemini sucht die App über Tavily (nicht mit der Google-Suche – deren Ergebnisse dürfen nicht gespeichert werden), und Gemini schreibt aus den Treffern. Geht die Suche nicht, schätzt Gemini, was es dort meistens gibt.'} Gemerkt wird das Ergebnis nur auf diesem Gerät.</p>
${ergebnis ? '<div class="zugang-btns"><button type="button" class="btn btn-quiet" data-act="sk-letzte">Letztes Ergebnis zeigen</button></div>' : ''}
</form>`;
}

function formularHTML() {
  if (modus === 'veranstaltung') return vaFormularHTML();
  const voll = fotos.length >= MAX_FOTOS;
  const gemini = anbieterVon(ladeKi()) === 'gemini';
  return `${modusHTML()}<form class="ki-form" id="sk-form" novalidate>
<div class="k-fotos">
<label class="btn${voll ? ' is-aus' : ''}" for="sk-kamera">${KAMERA}Foto machen</label><input class="vh" id="sk-kamera" type="file" accept="image/*" capture="environment"${voll ? ' disabled' : ''}>
<label class="btn${voll ? ' is-aus' : ''}" for="sk-bilder">${BILD}Bilder wählen</label><input class="vh" id="sk-bilder" type="file" accept="image/*" multiple${voll ? ' disabled' : ''}>
<label class="btn" for="sk-pdf">${PDF}PDF wählen</label><input class="vh" id="sk-pdf" type="file" accept="application/pdf,.pdf">
</div>
<div class="k-vorschau" id="sk-vorschau">${vorschauHTML()}</div>
<label for="sk-text">Oder Text oder Link <small>optional</small></label>
<textarea id="sk-text" rows="3" maxlength="30000" placeholder="Die Karte als Text einfügen${gemini ? ' – oder den Link zur Karte auf der Webseite' : ''}">${esc(text)}</textarea>
<p class="zugang-fehler" id="sk-fehler"${fehler ? '' : ' hidden'}>${esc(fehler)}</p>
<button type="submit" class="btn btn-primary k-los" id="sk-los">Passendes Gericht finden</button>
<p class="fine">Dauert etwa eine halbe Minute; gemerkt wird das Ergebnis nur auf diesem Gerät.</p>
${ergebnis ? '<div class="zugang-btns"><button type="button" class="btn btn-quiet" data-act="sk-letzte">Letztes Ergebnis zeigen</button></div>' : ''}
</form>`;
}

const laufText = (l) => `${l.gerichte ? `${l.gerichte} Gerichte geschätzt` : l.va ? 'Sucht' : 'Liest'} · ${Math.round((Date.now() - l.start) / 1000)} s`;

function laufHTML() {
  return `<div class="ki-lauf" role="status" aria-live="polite">
<div class="ki-topf" aria-hidden="true"><span></span><span></span><span></span></div>
<p class="ki-lauf-t">${lauf.va ? (anbieterVon(ladeKi()) === 'gemini' ? 'Gemini schätzt, was es dort gibt …' : 'Claude sucht die Veranstaltung …') : `${anbieterVon(ladeKi()) === 'gemini' ? 'Gemini' : 'Claude'} liest die Karte …`}</p>
<p class="ki-lauf-d" id="sk-lauf-d">${laufText(lauf)}</p>
<button type="button" class="btn btn-quiet" data-act="sk-abbrechen">Abbrechen</button>
</div>`;
}

let neuEingeben = false;
export function zeichnen() {
  const el = $('#speisekarte');
  if (!el || el.hidden) return;
  const kopf = `<button type="button" class="back" data-act="sk-zu">${ic('back')}Alle Rezepte</button>
<div class="d-head"><span class="tape">Speisekarte</span><h1 id="sk-titel">Was soll ich hier essen?</h1>
<p class="d-desc">Fotografier die Karte, nimm das PDF – oder sag, zu welcher Veranstaltung du gehst. Die App sagt dir, welches Gericht ${wessenZiel()} Ziel pro Box (${esc(zielText(app.ziel))}) am nächsten kommt, und wie du bestellst, damit es noch besser passt.</p></div>`;
  let rumpf;
  if (!ladeKi()) {
    rumpf = `<div class="ki-box"><h2>Erst einen KI-Schlüssel</h2><p>Die Karte liest die KI – dafür braucht die App einmal einen KI-Schlüssel.</p><div class="zugang-btns"><button type="button" class="btn btn-primary" data-act="sk-einrichten">Einrichten</button></div></div>`;
  } else if (lauf) rumpf = laufHTML();
  else if (ergebnis && !neuEingeben) rumpf = ergebnisHTML();
  else rumpf = formularHTML();
  el.innerHTML = kopf + rumpf;
  if (istVa() && !lauf && !neuEingeben) setTimeout(bilderHolen, 0);
}

/**
 * Die Bilder zu einer Veranstaltung: je Gericht aus Wikipedia (eine Anfrage
 * für alle, mit der Kennung der App; die Adressen merkt sich das Gerät mit
 * dem Ergebnis) und oben das Bild der Seite (nur mit Claude – die Funktion
 * produkt-bild prüft den Schlüssel von Anthropic; nur im Speicher).
 */
async function bilderHolen() {
  const e = ergebnis;
  if (!e || e.art !== 'veranstaltung' || bilderLaufen) return;
  bilderLaufen = true;
  let neu = false;
  try {
    const titel = wikiTitel(e.gerichte).filter((t) => !wikiVersucht.has(t));
    if (titel.length) {
      for (const t of titel) wikiVersucht.add(t);
      try {
        const res = await fetch(wikiAdresse(titel), { headers: { 'Api-User-Agent': KENNUNG }, signal: zeitlimit(15000) });
        if (res.ok) {
          const bilder = wikiBilderAus(await res.json(), titel);
          // Hat Wikipedia zu einem Titel kein (freies) Bild, bleibt das Bildchen der App – und es wird nicht noch einmal gefragt
          for (const g of e.gerichte) {
            if (g.bild || !titel.includes(g.wiki)) continue;
            const b = bilder.get(g.wiki);
            if (b) { g.bild = b; neu = true; } else delete g.wiki;
          }
          if (ergebnis === e) schreibe(GEMERKT, e);
        }
      } catch { /* ohne Bilder aus Wikipedia – die Bildchen der App */ }
    }
    const seite = e.veranstaltung?.url;
    const schluessel = ladeKi();
    if (seite && !bildVersucht.has(seite) && anbieterVon(schluessel) === 'anthropic') {
      bildVersucht.add(seite);
      const blob = await shopBild(seite, { schluessel });
      if (blob && ergebnis === e) {
        if (seitenBild?.url) URL.revokeObjectURL(seitenBild.url);
        seitenBild = { seite, url: URL.createObjectURL(blob) };
        neu = true;
      }
    }
  } finally {
    bilderLaufen = false;
  }
  if (neu && ergebnis === e && !lauf && !neuEingeben && speisekarteOffen()) zeichnen();
}

/* --------------------------------------------------------- Eingaben */

async function bilderDazu(dateien) {
  const neu = [...dateien].filter((d) => /^image\//.test(d.type) || !d.type).slice(0, MAX_FOTOS - fotos.length);
  let kaputt = 0;
  for (const d of neu) {
    try { fotos.push(await fotoVorbereiten(d, KANTE)); } catch { kaputt++; }
  }
  if (kaputt) melde(kaputt === 1 ? 'Ein Bild ließ sich nicht lesen.' : `${kaputt} Bilder ließen sich nicht lesen.`);
  if (!lauf) zeichnen();
}

async function pdfDazu(datei) {
  if (!datei) return;
  if (!/pdf$/i.test(datei.type) && !/\.pdf$/i.test(datei.name || '')) { melde('Das ist kein PDF.'); return; }
  if (datei.size > MAX_PDF) { melde('Das PDF ist zu groß (höchstens 15 MB). Fotografier lieber die Seiten mit den Gerichten.'); return; }
  try { pdf = { name: String(datei.name || 'Speisekarte.pdf').slice(0, 60), b64: await blobZuB64(datei) }; } catch { melde('Das PDF ließ sich nicht lesen.'); return; }
  if (!lauf) zeichnen();
}

/** Dateien gewählt (change). true, wenn es hierher gehörte. */
export function aenderungSpeisekarte(ziel) {
  if (!['sk-kamera', 'sk-bilder', 'sk-pdf'].includes(ziel.id)) return false;
  text = $('#sk-text')?.value ?? text;
  const dateien = [...(ziel.files || [])];
  ziel.value = '';
  if (ziel.id === 'sk-pdf') pdfDazu(dateien[0]); else bilderDazu(dateien);
  return true;
}

export function eingabeSpeisekarte(ziel) {
  if (ziel.id === 'sk-text') { text = ziel.value; return true; }
  if (ziel.id === 'sk-wohin') { wohin = ziel.value; return true; }
  if (ziel.id === 'sk-wann') { wann = ziel.value || tagIso(); return true; }
  return false;
}

/** Zu einer Veranstaltung nachsehen: Claude sucht im Netz, Gemini schätzt. */
async function nachsehen() {
  const schluessel = ladeKi();
  const anbieter = anbieterVon(schluessel);
  wohin = $('#sk-wohin')?.value ?? wohin;
  wann = $('#sk-wann')?.value || wann || tagIso();
  if (!wohin.trim()) {
    fehler = 'Erst sagen, wohin du gehst.';
    zeichnen();
    return;
  }
  fehler = '';
  const meinLauf = { controller: new AbortController(), start: Date.now(), gerichte: 0, va: true };
  lauf = meinLauf;
  meinLauf.timer = setInterval(() => { const el = $('#sk-lauf-d'); if (el && lauf === meinLauf) el.textContent = laufText(lauf); }, 1000);
  zeichnen();
  try {
    const rumpf = rumpfVeranstaltung({ anbieter, ziel: app.ziel, wer: istEigen() ? fuerWen() : (app.name() || 'Tobi'), was: wohin, tag: tagText(wann) });
    let roh;
    let quellen = [];
    // Mit Claude sucht Claude selbst; sonst Tavily (rezept-web) und Gemini schreibt aus den Treffern (web.js).
    // Geht die Suche nicht (nicht eingerichtet, Kontingent leer), schätzt Gemini wie bisher – ohne Belege.
    const suche = { q: `${wohin.trim()} ${tagText(wann)} Essen Stände Food`, max: 6, seiten: true };
    const fest = { schluessel, signal: meinLauf.controller.signal, suche, schema: VERANSTALTUNG_SCHEMA };
    try {
      const antwort = anbieter === 'gemini'
        ? await mitWebsuche(rumpfVeranstaltung({ anbieter: 'anthropic', ziel: app.ziel, wer: istEigen() ? fuerWen() : (app.name() || 'Tobi'), was: wohin, tag: tagText(wann) }), fest)
        : await mitWebsuche(rumpf, fest);
      roh = jsonAus(antwort.text);
      quellen = antwort.quellen || [];
    } catch (e) {
      if (anbieter !== 'gemini' || e?.art === 'abbruch') throw e;
      const antwort = await kiAnfragen(rumpf, { schluessel, signal: meinLauf.controller.signal, beiFortschritt: ({ gerichte }) => { meinLauf.gerichte = gerichte; } });
      roh = antwort.eingabe;
    }
    // Gemini hat nicht gesucht: nichts ist belegt, alles ist geschätzt
    const b = veranstaltungBereinigen(roh, { quellen });
    if (!b.gerichte) throw Object.assign(new Error(b.fehler), { art: 'leer' });
    ergebnis = { ...b, at: new Date().toISOString() };
    schreibe(GEMERKT, ergebnis);
    wohin = '';
    neuEingeben = false;
  } catch (e) {
    fehler = e?.art === 'abbruch' ? '' : e?.message || 'Das hat nicht geklappt. Nochmal versuchen.';
  } finally {
    clearInterval(meinLauf.timer);
    if (lauf === meinLauf) lauf = null;
    zeichnen();
    if (!fehler && ergebnis) window.scrollTo(0, 0);
  }
}

async function lesen() {
  const schluessel = ladeKi();
  const anbieter = anbieterVon(schluessel);
  text = $('#sk-text')?.value ?? text;
  if (!fotos.length && !pdf && !text.trim()) {
    fehler = 'Erst die Karte: ein Foto, ein PDF oder den Text.';
    zeichnen();
    return;
  }
  if (anbieter !== 'gemini' && linkAus(text) && !fotos.length && !pdf) {
    fehler = 'Links liest nur Gemini. Kopier den Text der Karte oder mach ein Foto.';
    zeichnen();
    return;
  }
  fehler = '';
  const meinLauf = { controller: new AbortController(), start: Date.now(), gerichte: 0 };
  lauf = meinLauf;
  meinLauf.timer = setInterval(() => { const el = $('#sk-lauf-d'); if (el && lauf === meinLauf) el.textContent = laufText(lauf); }, 1000);
  zeichnen();
  try {
    const link = anbieter === 'gemini' && !fotos.length && !pdf && !!linkAus(text);
    const rumpf = rumpfKarte({ anbieter, ziel: app.ziel, wer: istEigen() ? fuerWen() : (app.name() || 'Tobi'), text, fotos: fotos.map((f) => f.b64), pdf: pdf?.b64 || '' });
    const antwort = await kiAnfragen(rumpf, {
      schluessel,
      signal: meinLauf.controller.signal,
      roh: link,
      beiFortschritt: ({ gerichte }) => { meinLauf.gerichte = gerichte; },
    });
    const roh = link ? jsonAus(antwort.text) : antwort.eingabe;
    const b = karteBereinigen(roh);
    if (!b.gerichte) throw Object.assign(new Error(b.fehler), { art: 'leer' });
    ergebnis = { ...b, at: new Date().toISOString() };
    schreibe(GEMERKT, ergebnis);
    for (const f of fotos) URL.revokeObjectURL(f.url);
    fotos = [];
    pdf = null;
    text = '';
    neuEingeben = false;
  } catch (e) {
    fehler = e?.art === 'abbruch' ? '' : e?.message || 'Das hat nicht geklappt. Nochmal versuchen.';
  } finally {
    clearInterval(meinLauf.timer);
    if (lauf === meinLauf) lauf = null;
    zeichnen();
    if (!fehler && ergebnis) window.scrollTo(0, 0);
  }
}

export function absendenSpeisekarte(ev) {
  if (ev.target.id === 'sk-va-form') { ev.preventDefault(); if (!lauf) nachsehen(); return true; }
  if (ev.target.id !== 'sk-form') return false;
  ev.preventDefault();
  if (!lauf) lesen();
  return true;
}

export function klickSpeisekarte(el) {
  if (el.dataset.skFotoWeg !== undefined) {
    const f = fotos.splice(Number(el.dataset.skFotoWeg), 1)[0];
    if (f) URL.revokeObjectURL(f.url);
    text = $('#sk-text')?.value ?? text;
    zeichnen();
    return true;
  }
  if (el.dataset.skModus) {
    text = $('#sk-text')?.value ?? text;
    wohin = $('#sk-wohin')?.value ?? wohin;
    modus = el.dataset.skModus === 'veranstaltung' ? 'veranstaltung' : 'karte';
    schreibe(MODUS, modus);
    fehler = '';
    zeichnen();
    $(modus === 'veranstaltung' ? '#sk-wohin' : '#sk-text')?.focus();
    return true;
  }
  switch (el.dataset.act) {
    case 'speisekarte': oeffneSpeisekarte(); return true;
    case 'sk-zu': schliesseSpeisekarte(); return true;
    case 'sk-neu': neuEingeben = true; fehler = ''; modus = istVa() ? 'veranstaltung' : 'karte'; zeichnen(); $('#sk-form, #sk-va-form')?.scrollIntoView({ block: 'start' }); return true;
    case 'sk-letzte': neuEingeben = false; text = $('#sk-text')?.value ?? text; zeichnen(); return true;
    case 'sk-pdf-weg': pdf = null; text = $('#sk-text')?.value ?? text; zeichnen(); return true;
    case 'sk-abbrechen': lauf?.controller.abort(); return true;
    case 'sk-einrichten': schliesseSpeisekarte(); oeffneEinrichten(); return true;
    default: return false;
  }
}

/** Ein neues Ziel: das gemerkte Ergebnis neu sortieren (app.js). */
export function speisekarteNeu() { if (speisekarteOffen() && !lauf) zeichnen(); }
