/*
 * Einstellungen → „Gäste & Überblick“ (nur in der Liste von Tobi und Amy):
 *
 *   Einladen    Jemand bekommt eine eigene Liste (eigenes privates Repo,
 *               eigener Schlüssel nur dafür). Die App prüft den Schlüssel –
 *               auch, dass er NICHT an Tobis und Amys Liste kommt –, legt die
 *               Liste mit Name und Farbe an und macht den Link zum Schicken.
 *               Wen dieses Gerät eingeladen hat, merkt es sich (gaeste.js).
 *   Dashboard   Reiter „Aktivität“: wer wann was gemacht hat, in allen
 *               Listen, die dieses Gerät kennt – aus den Commits (gaeste.js
 *               zusammenfassen). Eure Liste sind seit v83 zwei Dateien:
 *               liste.json und sachen.json (Amys Sachen-App, sachen.js) – je
 *               mit eigenem Verlauf, gezählt als eine Liste. Daneben je
 *               Person ein Reiter mit dem, was in ihrer Liste steht
 *               (dashboard.js, siehe unten). Was das Gerät schon geholt hat,
 *               merkt es sich (VERLAUF, je Datei); beim Öffnen kommt nur das
 *               Neue dazu. Unter jeder Sitzung steht im Detail, was passiert
 *               ist: Dafür holt das Gerät die Datei des Commits, wie sie vor
 *               und nach ihm war (speicher.js fassungLesen), und vergleicht
 *               (einzelheiten.js) – je Commit einmal, dann ist es gemerkt
 *               (DETAILS). Oben lässt sich der Verlauf auf eine Person
 *               beschränken.
 *   Umzug       Ein neues Handy kennt die Gäste nicht – ihre Schlüssel
 *               stehen nur hier. „Aufs neue Handy“ packt sie in einen Link
 *               (…#gaeste=…, gaeste.js); auf dem neuen öffnet man ihn (die
 *               App fragt einmal nach) oder fügt ihn unter „Vom alten Handy
 *               übernehmen“ ein. Verlauf und Einzelheiten holt das neue Gerät
 *               beim ersten Öffnen des Dashboards selbst.
 *
 * Schlüssel stehen nur im localStorage dieses Geräts, im Link für den Gast
 * und – solange man ihn nicht löscht – im Link fürs neue Handy.
 */
import { app, $, melde, lese, schreibe } from './kern.js';
import { esc, tagKurz } from './format.js';
import { DATEN, API, listeAnlegen, commitsLesen, pruefeSchluessel, fassungLesen, dateiHolen } from './speicher.js';
import { bereinigen, leer } from './liste.js';
import { schluesselAus, einladungsLink, ladeKi, ortVon, HAUPTLISTE } from './zugang.js';
import { gaesteBereinigen, gaesteFuerLink, gaesteAusLink, repoVorschlag, zusammenfassen, verlaufMischen, BEREICHE } from './gaeste.js';
import { einzelheiten, zusammenlegen, kurz, EINZELHEITEN_FASSUNG } from './einzelheiten.js';
import { istEigen, wessen } from './profil.js';
import { inhaltVon } from './dashboard.js';
import { bildPfad } from './bilder.js';
import { FOTO_PFAD } from './inventar.js';
import { tagFarbe } from './amy.js';
import { sachenFotosEinsetzen } from './ansicht-inventar.js';
import { SACHEN_ORT, sachenBereinigen, umzugZusammen, leerSachen } from './sachen.js';

const GAESTE = 'boxenstopp.gaeste.v1';
const VERLAUF = 'boxenstopp.verlauf.v1'; // { <id>: [{ sha, at, nachricht }] } – id einer Liste oder eines Teils ('haupt:sachen')
const DETAILS = 'boxenstopp.einzelheiten.v1'; // { f: EINZELHEITEN_FASSUNG, d: { <sha>: [{ b, a, x }] } }
const api = () => lese('__api', null) || API;
const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';

export const ladeGaeste = () => gaesteBereinigen(lese(GAESTE, []));
const merkeGaeste = (g) => schreibe(GAESTE, gaesteBereinigen(g));

let einladen = null; // { name, farbe, repo, repoFest, ki, fehler, laeuft }
let fertig = null; // { name, link }
let umzug = null; // { link } – die Gäste fürs neue Handy
let angeboten = null; // [gast, …] – kamen mit einem Link, warten auf „Übernehmen“
let umzugFehler = '';

const linkFuer = (g) => einladungsLink(g.token, g.ki ? ladeKi() : '', { daten: g.daten, fuer: g.name, farbe: g.farbe || 'blau' });
const besitzer = DATEN.owner;
const repoLink = (repo) => `https://github.com/new?${new URLSearchParams({ name: repo, owner: besitzer, visibility: 'private', description: 'Boxenstopp: eigene Liste' })}`;
const tokenLink = (name, repo) => `https://github.com/settings/personal-access-tokens/new?${new URLSearchParams({ name: `Boxenstopp ${name || 'Gast'}`.slice(0, 40), description: `Nur für ${repo} – die Liste in Boxenstopp`, target_name: besitzer, expires_in: 'none', contents: 'write' })}`;

/* ------------------------------------------------------- Einstellungen */

function einladenHTML() {
  const e = einladen;
  const name = e.name.trim();
  const repo = e.repoFest ? e.repo : repoVorschlag(name) || 'Boxenstopp-Name';
  const ki = ladeKi();
  return `<form class="zugang-form g-form" id="g-form" novalidate>
<label for="g-name">Wie heißt sie oder er?</label>
<input id="g-name" type="text" maxlength="30" autocomplete="off" placeholder="z. B. Marielle" value="${esc(e.name)}">
<fieldset class="g-farbe"><legend>Farbe der App</legend>
<label class="e-wahl${e.farbe === 'lila' ? ' an' : ''}"><input type="radio" name="g-farbe" value="lila"${e.farbe === 'lila' ? ' checked' : ''}><span class="g-punkt g-lila" aria-hidden="true"></span><span>Lila</span></label>
<label class="e-wahl${e.farbe !== 'lila' ? ' an' : ''}"><input type="radio" name="g-farbe" value="blau"${e.farbe !== 'lila' ? ' checked' : ''}><span class="g-punkt g-blau" aria-hidden="true"></span><span>Blau</span></label>
</fieldset>
<ol class="g-schritte">
<li><b>Ein eigenes Repo bei GitHub</b><span>privat, Name <code id="g-repo-name">${esc(repo)}</code>, mit Häkchen bei „Add a README file“</span><a class="btn" id="g-repo-link" href="${esc(repoLink(repo))}" target="_blank" rel="noopener">Repo anlegen</a></li>
<li><b>Ein Schlüssel nur dafür</b><span>Bei „Repository access“ <i>Only select repositories</i> → <i id="g-repo-name2">${esc(repo)}</i>. „Contents: Read and write“ ist schon gewählt.</span><a class="btn" id="g-token-link" href="${esc(tokenLink(name, repo))}" target="_blank" rel="noopener">Schlüssel anlegen</a></li>
<li><b>Den Schlüssel hier einfügen</b><label class="sr" for="g-token">Schlüssel</label><input id="g-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></li>
</ol>
${ki ? `<label class="k-check"><input type="checkbox" id="g-ki"${e.ki ? ' checked' : ''}><span>Deinen KI-Schlüssel mitgeben – für Resteverwertung, Speisekarte und „Mit KI ändern“ (läuft dann über deinen)</span></label>` : ''}
<details class="g-mehr"${e.repoFest ? ' open' : ''}><summary>Repo heißt anders</summary><label class="sr" for="g-repo">Repo</label><input id="g-repo" type="text" autocomplete="off" spellcheck="false" value="${esc(`${besitzer}/${repo}`)}"></details>
<p class="zugang-fehler" id="g-fehler"${e.fehler ? '' : ' hidden'}>${esc(e.fehler || '')}</p>
<div class="zugang-btns"><button type="submit" class="btn btn-primary" id="g-los"${e.laeuft ? ' disabled' : ''}>${e.laeuft ? 'Prüfe …' : 'Prüfen und Link machen'}</button><button type="button" class="btn btn-quiet" data-act="g-abbrechen">Abbrechen</button></div>
<p class="fine">Die App prüft den Schlüssel, legt die Liste mit Name und Farbe an und macht den Link. Kommt der Schlüssel auch an eure Liste, nimmt sie ihn nicht.</p>
</form>`;
}

function fertigHTML() {
  const wa = `https://wa.me/?text=${encodeURIComponent(`Hallo ${fertig.name}, hier ist deine Boxenstopp-App mit deiner eigenen Liste: ${fertig.link}`)}`;
  return `<div class="g-fertig" role="status">
<p><b>${esc(wessen(fertig.name))} Liste ist bereit.</b> Schick den Link – beim Öffnen erklärt die App alles und fragt nach den Makros.</p>
<label class="sr" for="g-linkfeld">Link für ${esc(fertig.name)}</label><input class="z-linkfeld" id="g-linkfeld" type="text" readonly value="${esc(fertig.link)}">
<div class="zugang-btns"><button type="button" class="btn btn-primary" data-act="g-kopieren">Link kopieren</button><a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Per WhatsApp schicken</a><button type="button" class="btn btn-quiet" data-act="g-fertig-zu">Fertig</button></div>
<p class="fine">Im Link steckt der Schlüssel – er kommt nur an das eine Repo, nicht an eure Liste. Schick ihn nur an ${esc(fertig.name)}.</p>
</div>`;
}

/** „Marielle“, „Marielle und Kim“, „A, B und C“. */
const namenText = (gs) => {
  const n = gs.map((g) => g.name);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} und ${n.at(-1)}` : n[0] || '';
};
const umzugLink = () => `${location.origin}${location.pathname.replace(/index\.html$/, '')}#gaeste=${gaesteFuerLink(ladeGaeste())}`;

/** Altes Handy: der Link mit den Gästen – zum Teilen oder Kopieren. */
function umzugHTML() {
  const teilen = typeof navigator.share === 'function';
  return `<div class="g-fertig" role="status">
<p><b>Die Gäste aufs neue Handy.</b> Schick dir den Link, am einfachsten per Mail an dich selbst. Auf dem neuen Handy in Boxenstopp unter Einstellungen → Gäste &amp; Überblick bei „Vom alten Handy übernehmen“ einfügen.</p>
<label class="sr" for="g-umzug-link">Link fürs neue Handy</label><input class="z-linkfeld" id="g-umzug-link" type="text" readonly value="${esc(umzug.link)}">
<div class="zugang-btns">${teilen ? '<button type="button" class="btn btn-primary" data-act="g-umzug-teilen">Teilen</button>' : ''}<button type="button" class="btn${teilen ? '' : ' btn-primary'}" data-act="g-umzug-kopieren">Link kopieren</button><button type="button" class="btn btn-quiet" data-act="g-umzug-zu">Fertig</button></div>
<p class="fine">Im Link stecken die Schlüssel von ${esc(namenText(ladeGaeste()))}. Schick ihn nur an dich selbst und lösch die Nachricht, wenn das neue Handy die Gäste hat.</p>
</div>`;
}

/** Neues Handy, mit dem Link geöffnet: einmal nachfragen. */
function angebotenHTML() {
  const viele = angeboten.length > 1;
  return `<div class="g-fertig" role="group" aria-label="Gäste vom alten Handy">
<p><b>Vom alten Handy: ${esc(namenText(angeboten))}.</b> Übernehmen? Dann siehst du ${viele ? 'ihre Listen' : 'die Liste'} auch hier im Dashboard.</p>
<div class="zugang-btns"><button type="button" class="btn btn-primary" data-act="g-uebernehmen">Übernehmen</button><button type="button" class="btn btn-quiet" data-act="g-nicht">Nicht übernehmen</button></div>
</div>`;
}

/** Neues Handy ohne Gäste: der Link vom alten zum Einfügen (falls er beim Antippen im Browser statt in der App landet). */
function einfuegenHTML(offen) {
  return `<details class="g-mehr g-umzug"${offen || umzugFehler ? ' open' : ''}><summary>Vom alten Handy übernehmen</summary>
<form class="zugang-form g-form" id="g-umzug-form" novalidate>
<label class="sr" for="g-umzug-feld">Link vom alten Handy</label><input id="g-umzug-feld" type="text" autocomplete="off" spellcheck="false" placeholder="Link vom alten Handy einfügen">
<p class="zugang-fehler" id="g-umzug-fehler"${umzugFehler ? '' : ' hidden'}>${esc(umzugFehler)}</p>
<div class="zugang-btns"><button type="submit" class="btn btn-primary">Übernehmen</button></div>
<p class="fine">Auf dem alten Handy hier „Aufs neue Handy“ tippen und dir den Link schicken.</p>
</form></details>`;
}

export function gaesteZeichnen() {
  const karte = $('#e-gaeste-karte');
  const el = $('#e-gaeste');
  if (!karte || !el) return;
  karte.hidden = istEigen();
  if (karte.hidden) return;
  if (el.contains(document.activeElement) && document.activeElement.matches('input')) return;
  const gaeste = ladeGaeste();
  const liste = gaeste.length
    ? `<ul class="e-liste g-liste">${gaeste.map((g) => `<li><span class="g-punkt ${g.farbe === 'lila' ? 'g-lila' : 'g-blau'}" aria-hidden="true"></span><span>${esc(g.name)}<small>${esc(g.daten.split('/')[1])}${g.at ? ` · eingeladen ${esc(tagKurz(g.at.slice(0, 10)))}` : ''}</small></span><button type="button" class="linkbtn" data-g-link="${esc(g.daten)}">Link</button><button type="button" class="x" data-g-weg="${esc(g.daten)}" aria-label="${esc(g.name)} von diesem Gerät entfernen">${X}</button></li>`).join('')}</ul>`
    : '';
  const kopf = `<p>Will jemand Boxenstopp mit eigener Liste – eigene Einkaufsliste, eigene Makros, eigene Rezepte? Dann bekommt sie ein eigenes privates Repo; an eure Liste kommt sie damit nicht.</p>`;
  let rumpf = '';
  if (angeboten) rumpf = angebotenHTML();
  else if (fertig) rumpf = fertigHTML();
  else if (einladen) rumpf = einladenHTML();
  else if (umzug) rumpf = umzugHTML();
  const offen = einladen || fertig || umzug || angeboten;
  const knoepfe = offen ? '' : `<div class="zugang-btns"><button type="button" class="btn" data-act="g-einladen"${app.zugang ? '' : ' disabled'}>Jemanden einladen</button><button type="button" class="btn" data-act="ub-oeffnen"${app.zugang ? '' : ' disabled'}>Dashboard</button>${gaeste.length ? '<button type="button" class="btn" data-act="g-umzug">Aufs neue Handy</button>' : ''}</div>`;
  const einfuegen = offen || gaeste.length ? '' : einfuegenHTML(!!el.querySelector('details.g-umzug')?.open);
  el.innerHTML = `${kopf}${liste}${rumpf}${knoepfe}${einfuegen}${app.zugang ? '' : '<p class="fine">Erst die gemeinsame Liste einrichten.</p>'}`;
}

/**
 * Gäste vom alten Handy in der Adresse (…#gaeste=…)? Herausnehmen und in den
 * Einstellungen einmal nachfragen. true, wenn welche zum Übernehmen da sind.
 */
export function gaesteAusAdresse() {
  if (!/[#&]gaeste=/.test(location.hash)) return false;
  const gs = gaesteAusLink(location.hash, HAUPTLISTE);
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* egal */ }
  // In der eigenen Liste eines Gasts gibt es keine Gäste
  if (istEigen()) return false;
  if (!gs.length) { melde('In dem Link stecken keine Gäste – nimm den ganzen Link vom alten Handy.'); return false; }
  angeboten = gs;
  return true;
}

function uebernehmen(gs) {
  // Die mitgebrachten zuerst: Steht ein Gast schon hier, gilt der Schlüssel aus dem Link
  merkeGaeste([...gs, ...ladeGaeste()]);
  angeboten = null;
  umzugFehler = '';
  gaesteZeichnen();
  melde(`${namenText(gs)} übernommen – das Dashboard kennt ${gs.length > 1 ? 'ihre Listen' : 'die Liste'} jetzt auch hier.`);
}

function umzugEinfuegen() {
  const feld = $('#g-umzug-feld');
  const gs = gaesteAusLink(feld?.value, HAUPTLISTE);
  // Sonst zeichnet gaesteZeichnen nicht neu, solange im Feld getippt wird
  if (document.activeElement?.matches?.('input')) document.activeElement.blur();
  if (!gs.length) {
    umzugFehler = 'Da stecken keine Gäste drin. Nimm den ganzen Link vom alten Handy (…#gaeste=…).';
    gaesteZeichnen();
    return;
  }
  uebernehmen(gs);
}

async function umzugTeilen(link) {
  try {
    await navigator.share({ title: 'Boxenstopp: Gäste fürs neue Handy', text: link });
  } catch (e) {
    if (e?.name !== 'AbortError') kopieren(link, $('#g-umzug-link'));
  }
}

/** Beim Tippen des Namens: Repo-Name und die beiden Links mitziehen (ohne neu zu zeichnen). */
export function eingabeGaeste(ziel) {
  if (ziel.id === 'g-umzug-feld') {
    if (umzugFehler) { umzugFehler = ''; $('#g-umzug-fehler')?.setAttribute('hidden', ''); }
    return true;
  }
  if (!einladen) return false;
  if (ziel.id === 'g-name') {
    einladen.name = ziel.value;
    if (!einladen.repoFest) {
      const repo = repoVorschlag(ziel.value) || 'Boxenstopp-Name';
      for (const id of ['#g-repo-name', '#g-repo-name2']) { const x = $(id); if (x) x.textContent = repo; }
      $('#g-repo-link')?.setAttribute('href', repoLink(repo));
      $('#g-token-link')?.setAttribute('href', tokenLink(ziel.value.trim(), repo));
      const f = $('#g-repo');
      if (f) f.value = `${besitzer}/${repo}`;
    }
    return true;
  }
  if (ziel.id === 'g-repo') { einladen.repoFest = true; einladen.repo = String(ziel.value).split('/').pop(); return true; }
  return ziel.id === 'g-token';
}

export function aenderungGaeste(ziel) {
  if (ziel.id === 'g-umzug-feld') return true;
  if (!einladen) return false;
  if (ziel.name === 'g-farbe') {
    einladen.farbe = ziel.value === 'lila' ? 'lila' : '';
    for (const l of ziel.closest('fieldset')?.querySelectorAll('.e-wahl') || []) l.classList.toggle('an', l.contains(ziel));
    return true;
  }
  if (ziel.id === 'g-ki') { einladen.ki = ziel.checked; return true; }
  return false;
}

export function absendenGaeste(ev) {
  if (ev.target.id === 'g-umzug-form') { ev.preventDefault(); umzugEinfuegen(); return true; }
  if (ev.target.id !== 'g-form') return false;
  ev.preventDefault();
  if (!einladen || einladen.laeuft) return true;
  const name = $('#g-name').value.trim().replace(/\s+/g, ' ').slice(0, 30);
  const tokenText = $('#g-token').value;
  const token = schluesselAus(tokenText);
  const repoFeld = String($('#g-repo')?.value || '').trim();
  const daten = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repoFeld) ? repoFeld : `${besitzer}/${repoVorschlag(name)}`;
  einladen = { ...einladen, name, ki: $('#g-ki')?.checked ?? einladen.ki };
  const fehler = (t) => { einladen.fehler = t; einladen.laeuft = false; gaesteZeichnen(); $('#g-token').value = tokenText; };
  if (!/^[\p{L}\p{N} ._-]{1,30}$/u.test(name)) { fehler('Trag den Namen ein – so heißt dann auch der Reiter mit ihren Rezepten.'); return true; }
  if (!token) { fehler('Das sieht nicht nach einem Schlüssel aus. Er beginnt mit github_pat_.'); return true; }
  if (token === app.zugang?.token) { fehler('Das ist euer Schlüssel. Leg einen eigenen an, der nur für das neue Repo gilt.'); return true; }
  if (`${DATEN.owner}/${DATEN.repo}` === daten) { fehler('Das ist das Repo eurer Liste. Der Gast braucht ein eigenes.'); return true; }
  einladen.laeuft = true;
  einladen.fehler = '';
  gaesteZeichnen();
  (async () => {
    // Kommt der Schlüssel an eure Liste, wäre sie für den Gast offen – dann nicht
    const auchEure = await pruefeSchluessel(token, { api: api(), ort: DATEN });
    if (auchEure === 'ok') { fehler('Dieser Schlüssel kommt auch an eure Liste. Leg einen an, der nur für das neue Repo gilt („Only select repositories“).'); return; }
    if (auchEure === 'netz') { fehler('Keine Verbindung zu GitHub. Versuch es gleich nochmal.'); return; }
    const ergebnis = await listeAnlegen(token, ortVon({ daten }), { person: name, ...(einladen.farbe ? { farbe: einladen.farbe } : {}) }, { api: api(), wer: app.name() });
    if (ergebnis !== 'ok') {
      fehler(ergebnis === 'falsch'
        ? `GitHub lässt nicht schreiben. Gibt es das private Repo ${daten.split('/')[1]}, und gilt der Schlüssel dafür mit „Contents: Read and write“?`
        : 'Keine Verbindung zu GitHub. Versuch es gleich nochmal.');
      return;
    }
    const gast = { name, daten, token, farbe: einladen.farbe, at: new Date().toISOString(), ki: !!einladen.ki && !!ladeKi() };
    merkeGaeste([gast, ...ladeGaeste().filter((g) => g.daten !== daten)]);
    fertig = { name, link: linkFuer(gast) };
    einladen = null;
    gaesteZeichnen();
    $('#g-linkfeld')?.select();
  })();
  return true;
}

function kopieren(link, feld) {
  const zeigen = () => { if (feld) { feld.hidden = false; feld.select(); } melde('Kopieren klappt hier nicht – der Link steht markiert im Feld.'); };
  try { navigator.clipboard.writeText(link).then(() => melde('Link kopiert.'), zeigen); } catch { zeigen(); }
}

export function klickGaeste(el) {
  const d = el.dataset;
  if (d.gLink) {
    const g = ladeGaeste().find((x) => x.daten === d.gLink);
    if (!g) return true;
    fertig = { name: g.name, link: linkFuer(g) };
    einladen = null;
    umzug = null;
    gaesteZeichnen();
    return true;
  }
  if (d.gWeg) {
    const alle = ladeGaeste();
    const g = alle.find((x) => x.daten === d.gWeg);
    if (!g) return true;
    merkeGaeste(alle.filter((x) => x.daten !== d.gWeg));
    gaesteZeichnen();
    melde(`${g.name} von diesem Gerät entfernt – ihre Liste bleibt in GitHub.`, { knopf: 'Rückgängig', beiKnopf: () => { merkeGaeste([g, ...ladeGaeste()]); gaesteZeichnen(); } });
    return true;
  }
  switch (d.act) {
    case 'g-einladen': einladen = { name: '', farbe: 'lila', repo: '', repoFest: false, ki: true, fehler: '', laeuft: false }; fertig = null; umzug = null; gaesteZeichnen(); $('#g-name')?.focus(); return true;
    case 'g-abbrechen': einladen = null; gaesteZeichnen(); return true;
    case 'g-fertig-zu': fertig = null; gaesteZeichnen(); return true;
    case 'g-kopieren': if (fertig) kopieren(fertig.link, $('#g-linkfeld')); return true;
    case 'g-umzug': umzug = { link: umzugLink() }; einladen = null; fertig = null; gaesteZeichnen(); return true;
    case 'g-umzug-teilen': if (umzug) umzugTeilen(umzug.link); return true;
    case 'g-umzug-kopieren': if (umzug) kopieren(umzug.link, $('#g-umzug-link')); return true;
    case 'g-umzug-zu': umzug = null; gaesteZeichnen(); return true;
    case 'g-uebernehmen': if (angeboten) uebernehmen(angeboten); return true;
    case 'g-nicht': angeboten = null; gaesteZeichnen(); return true;
    case 'ub-oeffnen': ueberblickOeffnen(); return true;
    case 'ub-zu': { const dlg = $('#ueberblick-dlg'); if (dlg?.open) dlg.close(); else dashboardZu(); return true; }
    case 'ub-neu': {
      versucht.clear();
      detailsFehler = '';
      // Im Reiter eines Gasts auch, was gerade in seiner Liste steht – in Amys ihre Sachen (sachen.json)
      const g = reiterListe().find((x) => x.id === reiter)?.gast;
      if (g) inhaltHolen(g);
      else if (reiter === 'amy') amySachenHolen();
      ueberblickLaden(true);
      return true;
    }
    case 'dash-hinweis-zu': { const dlg = $('#dash-hinweis-dlg'); if (dlg?.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); } return true; }
    default:
      if (d.ubReiter) { reiter = d.ubReiter; ueberblickZeichnen(); $(`#ueberblick-dlg [data-ub-reiter][aria-selected="true"]`)?.focus(); $('#ueberblick-dlg').scrollTop = 0; return true; }
      if (d.ubGanz) { ganz.add(d.ubGanz); ueberblickZeichnen(); return true; }
      if (el.hasAttribute('data-ub-verlauf')) { reiter = 'aktivitaet'; wer = d.ubVerlauf || ''; mehr = false; ueberblickZeichnen(); $('#ueberblick-dlg [data-ub-reiter="aktivitaet"]')?.focus(); return true; }
      if (d.ubTage) { tage = Number(d.ubTage) === 30 ? 30 : 7; ueberblickZeichnen(); return true; }
      if (d.act === 'ub-mehr') { mehr = true; ueberblickZeichnen(); return true; }
      if (el.hasAttribute('data-ub-wer')) { wer = d.ubWer || ''; mehr = false; ueberblickZeichnen(); return true; }
      if (d.ubAuf) { aufgeklappt.add(d.ubAuf); ueberblickZeichnen(); return true; }
      return false;
  }
}

/* ------------------------------------------------------------ Überblick */

let tage = 7;
let mehr = false;
let laedt = false;
let fehlerJe = {}; // id → Text
let geholt = null;
let wer = ''; // der Verlauf nur einer Person (Name klein) – '' alle
const aufgeklappt = new Set(); // Zeilen der Einzelheiten, die ganz zu sehen sind
let details = null; // was DETAILS gemerkt hat, im Speicher
let detailsLaeuft = false;
let detailsFehler = '';
const versucht = new Set(); // Commits, die dieses Öffnen schon geholt hat (oder versucht)
const fassungen = new Map(); // `${liste}|${ref}` → Promise<Stand | null>, solange der Überblick offen ist

/**
 * Die Listen, die dieses Gerät kennt: eure (mit eurem Schlüssel) und die der
 * Gäste. Dazu ein Teil eurer Liste: Amys Sachen in sachen.json (dasselbe
 * Repo, derselbe Schlüssel) – mit eigenem Verlauf (eigenes „bis“) und eigenen
 * Ständen für die Einzelheiten, aber für Personen, Sitzungen und Automatik
 * eure Liste (teilVon, auswerten) – sonst stünde Amy zweimal da.
 */
function listen() {
  if (!app.zugang) return [];
  const token = app.zugang.token;
  return [
    { id: 'haupt', name: 'Eure Liste', farbe: '', token, ort: DATEN },
    { id: 'haupt:sachen', teilVon: 'haupt', name: 'Amys Sachen', farbe: '', token, ort: SACHEN_ORT },
    ...ladeGaeste().map((g) => ({ id: g.daten, name: g.name, farbe: g.farbe, token: g.token, ort: ortVon({ daten: g.daten }) })),
  ];
}

const reiheVon = (verlauf, id) => (Array.isArray(verlauf[id]) ? verlauf[id] : []);

const gemerkterVerlauf = () => { const v = lese(VERLAUF, {}); return v && typeof v === 'object' ? v : {}; };

/* --------------------------------------------- Einzelheiten je Commit */

/** Die gemerkten Einzelheiten { <sha>: [{ b, a, x }] } – nur aus dieser Fassung von einzelheiten.js. */
function detailsCache() {
  if (!details) {
    const x = lese(DETAILS, null);
    details = x && x.f === EINZELHEITEN_FASSUNG && x.d && typeof x.d === 'object' && !Array.isArray(x.d) ? x.d : {};
  }
  return details;
}
const merkeDetails = () => schreibe(DETAILS, { f: EINZELHEITEN_FASSUNG, d: detailsCache() });

/** Was die App über Rezepte und Zutaten weiß – für Namen und Schritte (einzelheiten.js). */
const hilfe = () => ({
  rezeptName: (rid) => app.nachId[rid]?.short || app.amyNach?.[rid]?.short || app.extras?.[rid]?.short || '',
  rezept: (rid) => app.nachId[rid] || app.amyNach?.[rid] || null,
  zutatName: (k) => app.katalog?.[k]?.n || '',
});

/**
 * Die Datei einer Liste (l.ort: liste.json oder sachen.json) bei einem Commit
 * (ref: sha oder „sha~1“), bereinigt – jede Fassung nur einmal geholt.
 * bereinigen (liste.js) macht aus sachen.json einen Stand nur mit rev und
 * inventar; verglichen werden dann nur die Sachen.
 */
function fassung(l, ref) {
  const k = `${l.id}|${ref}`;
  if (!fassungen.has(k)) {
    fassungen.set(k, fassungLesen(l.token, l.ort, ref, { api: api() })
      .then((roh) => (roh === null ? null : bereinigen(roh)))
      .catch((e) => { fassungen.delete(k); throw e; }));
  }
  return fassungen.get(k);
}

/** f für alle xs, höchstens n zugleich. */
async function nebeneinander(xs, n, f) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => { while (i < xs.length) await f(xs[i++]); }));
}

/**
 * Die Einzelheiten zu diesen Commits holen ([{ liste, sha }], die oben
 * zuerst): die Datei des Commits nach ihm und davor. In eurer Liste ist das
 * liste.json oder sachen.json – je nachdem, in wessen Verlauf die sha steht.
 * Davor ist meist der nächstältere Commit im Verlauf derselben Datei – genau
 * dann, wenn sein rev eins kleiner ist (jeder Commit zählt rev hoch); sonst
 * (Lücke im Verlauf, von Hand bearbeitet) der Stand direkt vor dem Commit
 * („sha~1“; der erste Commit an sachen.json: davor gab es sie nicht).
 */
async function detailsHolen(noetig) {
  detailsLaeuft = true;
  detailsFehler = '';
  const alle = listen();
  const verlauf = gemerkterVerlauf();
  // Die Liste selbst oder einer ihrer Teile (sachen.json) – wessen Verlauf die sha hat
  const dateiVon = (liste, sha) => alle.find((l) => (l.id === liste || l.teilVon === liste) && reiheVon(verlauf, l.id).some((e) => e.sha === sha)) || alle.find((l) => l.id === liste);
  const d = detailsCache();
  const h = hilfe();
  let geschafft = 0;
  await nebeneinander(noetig, 4, async ({ liste, sha }) => {
    versucht.add(sha);
    const l = dateiVon(liste, sha);
    if (!l || detailsFehler || d[sha]) return;
    const reihe = reiheVon(verlauf, l.id);
    const i = reihe.findIndex((e) => e.sha === sha);
    const davor = i >= 0 ? reihe[i + 1]?.sha || '' : '';
    try {
      const nach = await fassung(l, sha);
      if (!nach) { d[sha] = []; return; }
      let vor = davor ? await fassung(l, davor) : null;
      if (!vor || vor.rev + 1 !== nach.rev) vor = await fassung(l, `${sha}~1`);
      d[sha] = einzelheiten(vor || leer(), nach, h);
    } catch (e) {
      if (e?.message === 'falsch' || e?.message === 'netz') {
        detailsFehler = e.message === 'falsch' ? 'Mit dem Schlüssel kommen die Einzelheiten nicht.' : 'Die Einzelheiten kommen gerade nicht von GitHub.';
        return;
      }
      // Kein JSON (von Hand kaputt) oder ein Stand, mit dem der Vergleich nichts anfangen kann: dann eben ohne
      d[sha] = [];
      return;
    }
    // Zwischendurch zeigen, was schon da ist
    if (++geschafft % 6 === 0) { merkeDetails(); ueberblickZeichnen(); }
  });
  merkeDetails();
  detailsLaeuft = false;
  ueberblickZeichnen();
}

/** Für die gezeigten Sitzungen fehlende Einzelheiten holen – je Öffnen jeden Commit höchstens einmal. */
function detailsAnstossen(sitzungen) {
  if (laedt || detailsLaeuft || detailsFehler || !$('#ueberblick-dlg')?.open) return;
  const d = detailsCache();
  const noetig = [];
  for (const s of sitzungen) for (const sha of [...(s.shas || [])].reverse()) if (!d[sha] && !versucht.has(sha)) noetig.push({ liste: s.liste, sha });
  if (noetig.length) detailsHolen(noetig);
}

/** Eine Zeile der Einzelheiten: „Abgehakt: Spinat, Penne“ – lange Sachen (Schritte, Notizen) untereinander. */
function detailZeile(e, schluessel) {
  if (!e.x.length) return `<p class="ub-det-z"><b>${esc(e.a)}</b></p>`;
  const max = 12;
  const ganz = aufgeklappt.has(schluessel);
  const xs = ganz ? e.x : e.x.slice(0, max);
  const rest = e.x.length - xs.length;
  const knopf = rest > 0 ? ` <button type="button" class="linkbtn ub-det-mehr" data-ub-auf="${esc(schluessel)}">+ ${rest} weitere</button>` : '';
  if (e.x.length > 1 && xs.some((x) => x.length > 34)) return `<div class="ub-det-z"><b>${esc(e.a)}:</b><ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${knopf}</div>`;
  return `<p class="ub-det-z"><b>${esc(e.a)}:</b> ${esc(xs.join(', '))}${knopf}</p>`;
}

/** Unter einer Sitzung: was genau passiert ist – oder dass es noch kommt. */
function detailsHTML(s) {
  const d = detailsCache();
  const da = (s.shas || []).map((sha) => d[sha]).filter(Boolean);
  const fehlt = (s.shas || []).some((sha) => !d[sha]);
  const zeilen = zusammenlegen(da);
  if (zeilen.length) return `<div class="ub-det">${zeilen.map((e) => detailZeile(e, `${s.shas[0]}|${e.b}|${e.a}`)).join('')}${fehlt && detailsLaeuft ? '<p class="ub-det-z ub-det-laedt">Mehr kommt …</p>' : ''}</div>`;
  if (fehlt && !detailsFehler) return '<div class="ub-det"><p class="ub-det-z ub-det-laedt">Einzelheiten kommen …</p></div>';
  // Alles geholt, aber nichts, was man sieht (etwa nur gelerntes Kochtempo)
  if (!fehlt && da.length) return '<div class="ub-det"><p class="ub-det-z ub-det-laedt">Nichts zu sehen – nur im Hintergrund gespeichert.</p></div>';
  return '';
}

export async function ueberblickLaden(neu = false) {
  if (laedt) return;
  laedt = true;
  fehlerJe = {};
  ueberblickZeichnen();
  const verlauf = gemerkterVerlauf();
  const seit = new Date(Date.now() - 31 * 86400000).toISOString();
  await Promise.all(listen().map(async (l) => {
    const alt = Array.isArray(verlauf[l.id]) ? verlauf[l.id] : [];
    try {
      const frisch = await commitsLesen(l.token, l.ort, { api: api(), bis: neu ? '' : alt[0]?.sha || '', seit: alt.length && !neu ? '' : seit, seiten: alt.length && !neu ? 3 : 8 });
      verlauf[l.id] = verlaufMischen(alt, frisch);
    } catch (e) {
      fehlerJe[l.id] = e.message === 'falsch' ? 'Der Schlüssel geht nicht mehr (abgelaufen oder gelöscht).' : 'Gerade keine Verbindung zu GitHub.';
    }
  }));
  // Was es nicht mehr gibt (entfernte Gäste), vergessen
  const ids = new Set(listen().map((l) => l.id));
  for (const k of Object.keys(verlauf)) if (!ids.has(k)) delete verlauf[k];
  schreibe(VERLAUF, verlauf);
  // Einzelheiten nur zu Commits, die noch im Verlauf stehen
  const shas = new Set(Object.values(verlauf).flatMap((l) => (Array.isArray(l) ? l.map((e) => e.sha) : [])));
  const d = detailsCache();
  const vorher = Object.keys(d).length;
  for (const sha of Object.keys(d)) if (!shas.has(sha)) delete d[sha];
  if (Object.keys(d).length !== vorher) merkeDetails();
  geholt = new Date();
  laedt = false;
  ueberblickZeichnen();
}

function ueberblickOeffnen() {
  const dlg = $('#ueberblick-dlg');
  if (!dlg) return;
  mehr = false;
  // Erst die Aktivität – die Personen daneben als Reiter
  if (!dlg.open) reiter = 'aktivitaet';
  // Was beim letzten Öffnen nicht kam (kein Netz), darf es jetzt noch einmal versuchen
  versucht.clear();
  detailsFehler = '';
  if (!dlg.open) {
    runde++;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    // Auch mit Esc oder Zurück zu: die geholten Stände und Fotos nicht im Speicher behalten
    dlg.addEventListener('close', dashboardZu, { once: true });
  }
  ueberblickZeichnen();
  ueberblickLaden();
}

// umzug: Amys Sachen aus liste.json nach sachen.json (sachen.js) – ein Commit an jeder der beiden Dateien
const AUTO_TEXT = { push: 'Push-Nachrichten', haushalt: 'Putzplan erinnert', 'angebote (privat)': 'Angebote geholt', angebote: 'Angebote geholt', 'to do': 'To Do abgeglichen', umzug: 'Sachen umgezogen' };
const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const uhr = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
function tagName(tag) {
  const d = new Date(`${tag}T12:00:00`);
  const heute = new Date();
  heute.setHours(12, 0, 0, 0);
  const diff = Math.round((heute - d) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  return `${WOCHENTAG[d.getDay()]} ${tagKurz(tag)}`;
}
function zuletztText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const t = tagName(tag);
  return `${t === 'Heute' || t === 'Gestern' ? t.toLowerCase() : t} ${uhr(iso)}`;
}
const listenName = (l) => (!l || l.id === 'haupt' ? 'eure Liste' : `${wessen(l.name)} Liste`);
const farbeVon = (l, name) => (l?.farbe === 'lila' ? 'lila' : /^amy$/i.test(name) ? 'rosa' : 'blau');

/**
 * Was der Verlauf hergibt: Personen, Sitzungen (die neueste zuerst), Automatik.
 * ls: nur die Listen selbst – die Commits eines Teils (sachen.json) gehören
 * gemischt zu seiner Liste; nachId kennt auch die Teile (für Fehlertexte).
 */
function auswerten() {
  const alle = listen();
  const ls = alle.filter((l) => !l.teilVon);
  const nachId = Object.fromEntries(alle.map((l) => [l.id, l]));
  const verlauf = gemerkterVerlauf();
  const eintraege = (l) => alle.filter((x) => x.id === l.id || x.teilVon === l.id).flatMap((x) => reiheVon(verlauf, x.id));
  // In der Liste eines Gasts ist jeder dort der Gast (gaeste.js) – auch auf einem Gerät, auf dem er sich anders nennt
  const z = zusammenfassen(ls.map((l) => ({ id: l.id, name: l.name, farbe: l.farbe, gast: l.id === 'haupt' ? '' : l.name, eintraege: eintraege(l) })), { tage });
  const sitzungen = [];
  for (const t of z.verlauf) for (const s of t.sitzungen) sitzungen.push({ tag: t.tag, ...s });
  return { ls, nachId, z, sitzungen };
}

/** Die Karte einer Person: zuletzt, Änderungen je Tag, Bereiche. */
function personKarte(p, l, tageListe) {
  const max = Math.max(1, ...p.jeTag);
  const balken = p.jeTag.map((n, i) => {
    const tag = tageListe[i];
    const d = new Date(`${tag}T12:00:00`);
    return `<span class="ub-tag" title="${esc(`${WOCHENTAG[d.getDay()]} ${tagKurz(tag)}: ${n}`)}"><i style="height:${Math.round((n / max) * 100)}%"></i>${tage === 7 ? `<small>${WOCHENTAG[d.getDay()]}</small>` : ''}</span>`;
  }).join('');
  const bereiche = BEREICHE.filter((b) => p.bereiche[b]).map((b) => `${b} ${p.bereiche[b]}`).join(' · ');
  return `<article class="ub-person ub-${farbeVon(l, p.name)}">
<div class="ub-kopf"><span class="ub-kreis" aria-hidden="true">${esc(p.name.slice(0, 1).toUpperCase())}</span><div class="ub-wer"><b>${esc(p.name)}</b><small>${esc(listenName(l))} · zuletzt ${esc(zuletztText(p.zuletzt))}</small></div><span class="ub-zahl"><b>${p.anzahl}</b><small>${p.anzahl === 1 ? 'Änderung' : 'Änderungen'}</small></span></div>
<div class="ub-balken${tage === 30 ? ' dicht' : ''}" role="img" aria-label="${esc(`Änderungen je Tag: ${p.jeTag.join(', ')}`)}">${balken}</div>
${bereiche ? `<p class="ub-bereiche">${esc(bereiche)}</p>` : ''}
</article>`;
}

/** Wer in einer Liste in der Zeit nichts gemacht hat. */
const stillKarte = (name, l, farbe) => `<article class="ub-person ub-${farbe} ub-still"><div class="ub-kopf"><span class="ub-kreis" aria-hidden="true">${esc(name.slice(0, 1).toUpperCase())}</span><div class="ub-wer"><b>${esc(name)}</b><small>${esc(listenName(l))} · in ${tage} Tagen nichts geändert</small></div></div></article>`;

/** Sitzungen nach Tagen, mit den Einzelheiten darunter. */
function sitzungenHTML(zeigen, nachId) {
  let tagJetzt = '';
  return zeigen.map((s) => {
    const kopf = s.tag !== tagJetzt ? `${tagJetzt ? '</ul>' : ''}<h4 class="ub-tag-k">${esc(tagName(s.tag))}</h4><ul class="ub-liste">` : '';
    tagJetzt = s.tag;
    const l = nachId[s.liste];
    const zeit = uhr(s.von) === uhr(s.bis) ? uhr(s.von) : `${uhr(s.von)}–${uhr(s.bis)}`;
    const was = s.was.length ? s.was.join(', ') : `${s.anzahl} ${s.anzahl === 1 ? 'Änderung' : 'Änderungen'}`;
    return `${kopf}<li class="ub-${farbeVon(l, s.wer)}"><time>${esc(zeit)}</time><span class="ub-name">${esc(s.wer)}</span><span class="ub-was">${esc(was)}${s.was.length && s.anzahl > 1 ? ` <small>(${s.anzahl})</small>` : ''}</span>${detailsHTML(s)}</li>`;
  }).join('') + (zeigen.length ? '</ul>' : '');
}

const zeitraumHTML = () => `<div class="e-design ub-zeitraum" role="group" aria-label="Zeitraum"><button type="button" class="e-wahl${tage === 7 ? ' an' : ''}" data-ub-tage="7" aria-pressed="${tage === 7}">7 Tage</button><button type="button" class="e-wahl${tage === 30 ? ' an' : ''}" data-ub-tage="30" aria-pressed="${tage === 30}">30 Tage</button></div>`;

/** Der Reiter „Aktivität“: wer wann was gemacht hat, in allen Listen. */
function aktivitaetHTML() {
  const { ls, nachId, z, sitzungen } = auswerten();
  const keiner = !z.personen.length;
  const personen = z.personen.map((p) => personKarte(p, nachId[p.liste], z.tage)).join('');
  const still = ls.filter((l) => l.id !== 'haupt' && !z.personen.some((p) => p.liste === l.id)).map((l) => stillKarte(l.name, l, farbeVon(l, l.name))).join('');
  // Nur eine Person: oben wählbar, sobald mehr als eine etwas gemacht hat
  const namen = [...new Map([...z.personen.map((p) => p.name), ...sitzungen.map((s) => s.wer)].map((x) => [x.toLowerCase(), x])).entries()];
  if (wer && !namen.some(([k]) => k === wer)) wer = '';
  const filter = namen.length > 1
    ? `<div class="ub-filter" role="group" aria-label="Wessen Verlauf">${[['', 'Alle'], ...namen].map(([k, t]) => `<button type="button" class="chip" data-ub-wer="${esc(k)}" aria-pressed="${wer === k}">${esc(t)}</button>`).join('')}</div>`
    : '';
  const gefiltert = wer ? sitzungen.filter((s) => s.wer.toLowerCase() === wer) : sitzungen;
  const zeigen = mehr ? gefiltert : gefiltert.slice(0, 25);
  const zeilen = sitzungenHTML(zeigen, nachId);
  const auto = Object.entries(z.automatik).map(([id, a]) => {
    const teile = Object.entries(a).map(([w, n]) => `${n}× ${AUTO_TEXT[w.toLowerCase()] || w}`);
    return teile.length ? `<p class="fine">${esc(nachId[id]?.name || id)}, automatisch: ${esc(teile.join(', '))}.</p>` : '';
  }).join('');
  const fehler = Object.entries(fehlerJe).map(([id, t]) => `<p class="zugang-fehler">${esc(nachId[id]?.name || id)}: ${esc(t)}</p>`).join('');
  const html = `<p class="ub-lead">Wer wann was gemacht hat – aus dem, was in den Listen gespeichert wurde. Unter jedem Eintrag steht, was genau passiert ist.</p>
${zeitraumHTML()}
${fehler}
${laedt && keiner ? '<p class="loading">Holt die Änderungen …</p>' : ''}
${!laedt && keiner && !still ? `<p class="sk-leer">In den letzten ${tage} Tagen hat niemand etwas geändert.</p>` : ''}
<section class="ub-personen" aria-label="Personen">${personen}${still}</section>
${zeilen ? `<section class="ub-verlauf" aria-labelledby="ub-verlauf-t"><h3 id="ub-verlauf-t" class="sub-h">Verlauf</h3>${filter}${detailsFehler ? `<p class="zugang-fehler">${esc(detailsFehler)}</p>` : ''}${zeilen}${!mehr && gefiltert.length > zeigen.length ? `<button type="button" class="linkbtn" data-act="ub-mehr">Alle ${gefiltert.length} zeigen</button>` : ''}</section>` : ''}
${auto}
<p class="fine">Gezählt wird, was gespeichert wird – nicht, wer die App nur anschaut. Die Einzelheiten kommen aus dem Vergleich der Liste vor und nach jeder Änderung, auch bei älteren Einträgen.${geholt ? ` Stand ${esc(uhr(geholt.toISOString()))}.` : ''} <button type="button" class="linkbtn" data-act="ub-neu"${laedt ? ' disabled' : ''}>${laedt ? 'Holt …' : 'Neu holen'}</button></p>`;
  return { html, zeigen };
}

/* ----------------------------------------------- Dashboard: je Person */

/**
 * Neben „Aktivität“ ein Reiter je Person: Amy (in eurer Liste, auf einem
 * Gerät, das nicht ihres ist – ihr Bereich, wie in der App, und ihre Sachen
 * aus der Sachen-App) und jeder Gast, den dieses Gerät kennt – mit dem, was
 * gerade in seiner Liste steht (liste.json jetzt, dashboard.js inhaltVon).
 * Nur zum Ansehen; was jemand verträgt und was jemand der KI geschrieben
 * hat, steht nicht darin. Stände und Fotos der Gäste und Amys Sachen bleiben
 * nur, solange das Dashboard offen ist.
 */
const istAmy = (n) => /^amy\b/i.test(String(n || '').trim());
function amyName() {
  if (istAmy(app.name())) return '';
  return Object.values(app.stand?.leute || {}).map(String).find(istAmy) || 'Amy';
}
function reiterListe() {
  const rs = [{ id: 'aktivitaet', name: 'Aktivität' }];
  const amy = amyName();
  if (amy) rs.push({ id: 'amy', name: amy, farbe: 'rosa', liste: 'haupt' });
  for (const g of ladeGaeste()) rs.push({ id: `gast:${g.daten}`, name: g.name, farbe: g.farbe === 'lila' ? 'lila' : 'blau', liste: g.daten, gast: g });
  return rs;
}

let reiter = 'aktivitaet';
let runde = 0; // zählt jedes Öffnen und Schließen – was danach ankommt, gehört nicht mehr hierher
const inhalte = new Map(); // Repo des Gasts → { stand, at, laedt, fehler }
const gastFotos = new Map(); // `${repo}|${pfad}` → Objekt-URL ('' – kam nicht)
const fotoReihe = []; // [{ g, pfad, k }] – höchstens drei zugleich
const fotoLaeuft = new Set();
const ganz = new Set(); // was ganz zu sehen ist: `${reiter}|${teil}`
const FEHLER_TEXT = { falsch: 'Der Schlüssel geht nicht mehr (abgelaufen oder gelöscht).', kaputt: 'Die Liste lässt sich gerade nicht lesen.' };

/** liste.json des Gasts, wie sie jetzt ist. */
async function inhaltHolen(g) {
  const alt = inhalte.get(g.daten);
  if (alt?.laedt) return;
  const r = runde;
  inhalte.set(g.daten, { ...alt, laedt: true, fehler: '' });
  let neu;
  try {
    const roh = await fassungLesen(g.token, ortVon({ daten: g.daten }), '', { api: api() });
    neu = { stand: bereinigen(roh), at: new Date(), laedt: false, fehler: '' };
  } catch (e) {
    neu = { ...alt, laedt: false, fehler: FEHLER_TEXT[e?.message] || 'Gerade keine Verbindung zu GitHub.' };
  }
  if (r !== runde) return; // inzwischen zu
  inhalte.set(g.daten, neu);
  ueberblickZeichnen();
}

/*
 * Amys Sachen stehen seit v83 in sachen.json (sachen.js): Ihr Reiter holt die
 * Datei, wie sie jetzt ist (beim ersten Zeichnen und mit „Neu holen“). Gibt
 * es sie noch nicht, ist nur noch nichts umgezogen. Was in liste.json noch
 * nicht umgezogen ist (app.stand.inventar), gehört dazu – je Liste und Sache
 * die neuere Fassung, Gelöschtes (weg) bleibt weg (umzugZusammen).
 * amyListe merkt sich, was seit dem Holen in liste.json stand: Zieht es
 * gerade um – erst nach sachen.json, dann aus liste.json heraus, von diesem
 * oder einem anderen Gerät –, bleibt es im Reiter, bis sachen.json neu da ist.
 */
let amySachen = null; // { stand, at, laedt, fehler } – sachen.json
let amyListe = null; // Stand wie sachen.json: was seit dem letzten Holen in liste.json stand
let amySeit = null; // dasselbe seit dem Start des Holens, das gerade läuft – danach gilt es
const SACHEN_FEHLER = { ...FEHLER_TEXT, kaputt: 'Die Sachen lassen sich gerade nicht lesen.' };

function amyListeMerken() {
  if (!app.stand) return;
  amyListe = umzugZusammen(amyListe || leerSachen(), app.stand.inventar).stand;
  if (amySeit) amySeit = umzugZusammen(amySeit, app.stand.inventar).stand;
}

async function amySachenHolen() {
  if (amySachen?.laedt || !app.zugang) return;
  const r = runde;
  amySachen = { ...amySachen, laedt: true, fehler: '' };
  amySeit = umzugZusammen(leerSachen(), app.stand?.inventar).stand;
  let neu;
  try {
    const roh = await fassungLesen(app.zugang.token, SACHEN_ORT, '', { api: api() });
    neu = { stand: roh === null ? leerSachen() : sachenBereinigen(roh), at: new Date(), laedt: false, fehler: '' };
  } catch (e) {
    neu = { ...amySachen, laedt: false, fehler: SACHEN_FEHLER[e?.message] || 'Gerade keine Verbindung zu GitHub.' };
  }
  if (r !== runde) return; // inzwischen zu
  // Eine veraltete Kopie von GitHub (kleineres rev, direkt nach dem Schreiben auch ein 404) ersetzt den bekannten Stand
  // nicht – und was in liste.json stand, bleibt dann dazu gemerkt (sonst verschwände gerade Umgezogenes kurz)
  const vorher = amySachen?.stand;
  const nichtNeuer = !neu.fehler && vorher && neu.stand.rev <= vorher.rev;
  if (nichtNeuer && neu.stand.rev < vorher.rev) neu.stand = vorher;
  // Geholt: Was vor dem Holen aus liste.json wegging, steht in sachen.json (oder ist gelöscht)
  if (!neu.fehler) amyListe = nichtNeuer ? umzugZusammen(amyListe || leerSachen(), amySeit.inventar).stand : amySeit;
  amySeit = null;
  amySachen = neu;
  ueberblickZeichnen();
}

/** Was in Amys Reiter steht: ihr Bereich aus eurer Liste, die Sachen aus sachen.json und dem, was noch umzieht. */
function amyInhalt() {
  amyListeMerken();
  const s = amySachen;
  const inventar = umzugZusammen(s?.stand || leerSachen(), amyListe?.inventar).stand.inventar;
  const c = inhaltVon({ ...app.stand, inventar }, { hilfe: hilfe() });
  // Noch nicht da (oder nicht zu holen): keine Zahl, die nicht stimmt
  c.sachen.offen = !s?.stand;
  c.sachen.fehler = s?.fehler || '';
  return c;
}

function fotoPumpe() {
  while (fotoLaeuft.size < 3 && fotoReihe.length) {
    const { g, pfad, k } = fotoReihe.shift();
    if (gastFotos.has(k) || fotoLaeuft.has(k)) continue;
    fotoLaeuft.add(k);
    const r = runde;
    dateiHolen(pfad, { token: g.token, api: api(), ort: ortVon({ daten: g.daten }) })
      .then((roh) => {
        if (r !== runde) return;
        gastFotos.set(k, roh ? URL.createObjectURL(new window.Blob([roh], { type: 'image/jpeg' })) : '');
        gastFotosEinsetzen();
      })
      .finally(() => { fotoLaeuft.delete(k); fotoPumpe(); });
  }
}

/** Die Fotos der Sachen eines Gasts: was da ist, einsetzen – das andere mit seinem Schlüssel holen. */
function gastFotosEinsetzen() {
  const dlg = $('#ueberblick-dlg');
  const g = reiterListe().find((x) => x.id === reiter)?.gast;
  if (!dlg?.open || !g) return;
  for (const img of dlg.querySelectorAll('img[data-ub-foto]')) {
    const pfad = img.dataset.ubFoto;
    const k = `${g.daten}|${pfad}`;
    if (!gastFotos.has(k)) {
      if (FOTO_PFAD.test(pfad) && !fotoLaeuft.has(k) && !fotoReihe.some((x) => x.k === k)) fotoReihe.push({ g, pfad, k });
      continue;
    }
    const u = gastFotos.get(k);
    if (u && img.getAttribute('src') !== u) { img.src = u; img.closest('.inv-bild')?.classList.add('hat-foto'); }
  }
  fotoPumpe();
}

/** Zu: die Stände und Fotos der Gäste und Amys Sachen nicht im Speicher behalten. */
function dashboardZu() {
  runde++;
  reiter = 'aktivitaet';
  fassungen.clear();
  inhalte.clear();
  amySachen = null;
  amyListe = null;
  amySeit = null;
  for (const u of gastFotos.values()) if (u) URL.revokeObjectURL(u);
  gastFotos.clear();
  fotoReihe.length = 0;
  ganz.clear();
}

const tagPille = (t) => `<span class="amy-tag klein tf${tagFarbe(t)}">${esc(t)}</span>`;
const zahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
const kachel = (n, text) => `<div class="ub-kachel"><b>${n}</b><small>${esc(text)}</small></div>`;
let teilNr = 0;
const teil = (titel, neben, inhalt) => { const id = `ub-teil-${++teilNr}`; return `<section class="ub-teil" aria-labelledby="${id}"><h3 class="sub-h" id="${id}">${esc(titel)}${neben ? ` <small>${esc(neben)}</small>` : ''}</h3>${inhalt}</section>`; };
const mehrKnopf = (schl, rest) => (rest > 0 ? `<button type="button" class="linkbtn ub-ganz" data-ub-ganz="${esc(schl)}">+ ${rest} weitere</button>` : '');

/** Die ersten n – oder alle, wenn schon aufgeklappt. */
function ersteVon(r, k, xs, n) {
  const schl = `${r.id}|${k}`;
  const zeigen = ganz.has(schl) ? xs : xs.slice(0, n);
  return { zeigen, mehr: mehrKnopf(schl, xs.length - zeigen.length) };
}

function planTag(tag) {
  const d = new Date(`${tag}T12:00:00`);
  const heute = new Date();
  heute.setHours(12, 0, 0, 0);
  const diff = Math.round((d - heute) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return `${WOCHENTAG[d.getDay()]} ${tagKurz(tag)}`;
}

function sacheHTML(r, d, l) {
  let foto = '';
  let da = false;
  if (d.foto && r.gast) {
    const u = gastFotos.get(`${r.gast.daten}|${d.foto}`) || '';
    da = !!u;
    foto = `<img class="inv-foto-img" data-ub-foto="${esc(d.foto)}"${u ? ` src="${esc(u)}"` : ''} alt="">`;
  } else if (d.foto) foto = `<img class="inv-foto-img" data-inv-foto="${esc(d.foto)}" alt="">`;
  const tags = d.tags.length ? `<span class="inv-ding-tags">${d.tags.slice(0, 3).map(tagPille).join('')}</span>` : '';
  return `<li class="ub-sache"><span class="inv-bild${da ? ' hat-foto' : ''}"><img class="inv-ersatz" src="${esc(bildPfad(l.bild || 'package'))}" alt="" aria-hidden="true">${foto}</span><span class="ub-sache-t"><b>${esc(d.name)}</b>${d.marke || d.wertung ? `<small>${[d.wertung ? `<span class="inv-sterne-k">★ ${Number(d.wertung)}/10</span>` : '', esc(d.marke || '')].filter(Boolean).join(' · ')}</small>` : ''}${tags}${d.notiz ? `<span class="ub-sache-n">${esc(kurz(d.notiz, 140))}</span>` : ''}</span></li>`;
}

/** sachen.offen/fehler: nur bei Amy – ihre Sachen kommen erst noch aus sachen.json (amyInhalt). */
function sachenHTML(r, sachen) {
  const fehler = sachen.fehler ? `<p class="zugang-fehler">${esc(sachen.fehler)}</p>` : '';
  if (sachen.offen) return teil('Sachen', '', fehler || `<p class="loading">Holt ${esc(wessen(r.name))} Sachen …</p>`);
  if (!sachen.anzahl) return teil('Sachen', '', `${fehler}<p class="fine">Noch keine Sachen.</p>`);
  const inhalt = sachen.listen.filter((l) => l.dinge.length).map((l) => {
    const { zeigen, mehr: weiter } = ersteVon(r, `sachen:${l.id}`, l.dinge, 12);
    return `<h4 class="ub-sl-k"><img src="${esc(bildPfad(l.bild || 'package'))}" alt="" aria-hidden="true" width="22" height="22">${esc(l.name)} <small>${l.dinge.length}</small></h4><ul class="ub-sachen">${zeigen.map((d) => sacheHTML(r, d, l)).join('')}</ul>${weiter}`;
  }).join('');
  return teil('Sachen', String(sachen.anzahl), `${fehler}${inhalt}`);
}

function einkaufHTML(r, e) {
  const abgehakt = e.erledigt ? `<p class="fine">${zahl(e.erledigt, 'Sache', 'Sachen')} abgehakt.</p>` : '';
  if (!e.offen.length) return teil('Einkaufsliste', '', `<p class="fine">Nichts offen.</p>${abgehakt}`);
  const { zeigen, mehr: weiter } = ersteVon(r, 'einkauf', e.offen, 30);
  return teil('Einkaufsliste', `${e.offen.length} offen`, `<ul class="ub-chips">${zeigen.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${weiter}${abgehakt}`);
}

function planHTML(plan) {
  if (!plan.length) return teil('Essensplan', 'nächste 7 Tage', '<p class="fine">Für die nächsten sieben Tage ist nichts geplant.</p>');
  const zeilen = plan.map((t) => {
    const was = [t.mittag.length ? `Mittag: ${t.mittag.join(', ')}` : '', t.abend.length ? `Abend: ${t.abend.join(', ')}` : ''].filter(Boolean).join(' · ');
    return `<li><b>${esc(planTag(t.tag))}</b><span>${esc(was)}</span></li>`;
  }).join('');
  return teil('Essensplan', 'nächste 7 Tage', `<ul class="ub-namen ub-plan">${zeilen}</ul>`);
}

function rezepteHTML(r, rezepte) {
  if (!rezepte.length) return teil('Rezepte', '', '<p class="fine">Noch keine eigenen Rezepte.</p>');
  const { zeigen, mehr: weiter } = ersteVon(r, 'rezepte', rezepte, 20);
  return teil('Rezepte', String(rezepte.length), `<ul class="ub-namen">${zeigen.map((x) => `<li><b>${esc(x.name)}</b>${x.tags.slice(0, 4).map(tagPille).join('')}</li>`).join('')}</ul>${weiter}`);
}

function notizenHTML(r, notizen) {
  if (!notizen.length) return teil('Notizen', '', '<p class="fine">Noch keine Notizen.</p>');
  const { zeigen, mehr: weiter } = ersteVon(r, 'notizen', notizen, 20);
  const wann = (iso) => (Number.isNaN(Date.parse(iso)) ? '' : `<small>${esc(zuletztText(iso))}</small>`);
  return teil('Notizen', String(notizen.length), `<ul class="ub-namen">${zeigen.map((x) => `<li><b>${esc(x.titel)}</b>${x.tags.slice(0, 4).map(tagPille).join('')}${wann(x.geaendert)}</li>`).join('')}</ul>${weiter}<p class="fine">Nur die Titel – was in den Notizen steht, zeigt das Dashboard nicht.</p>`);
}

function wuenscheHTML(r, w) {
  const text = w.offen || w.erledigt ? `${zahl(w.offen, 'Vorschlag', 'Vorschläge')} offen, ${w.erledigt} erledigt – was drinsteht, steht in ${wessen(r.name)} Bereich unter „Vorschläge“.` : 'Noch keine Vorschläge.';
  return teil('Vorschläge', '', `<p class="fine">${esc(text)}</p>`);
}

const TEILE = {
  sachen: [(c) => (c.sachen.offen ? kachel('…', 'Sachen') : kachel(c.sachen.anzahl, c.sachen.anzahl === 1 ? 'Sache' : 'Sachen')), (r, c) => sachenHTML(r, c.sachen)],
  einkauf: [(c) => kachel(c.einkauf.offen.length, 'auf der Einkaufsliste'), (r, c) => einkaufHTML(r, c.einkauf)],
  plan: [(c) => kachel(c.plan.length, c.plan.length === 1 ? 'Tag geplant' : 'Tage geplant'), (r, c) => planHTML(c.plan)],
  rezepte: [(c) => kachel(c.rezepte.length, c.rezepte.length === 1 ? 'Rezept' : 'Rezepte'), (r, c) => rezepteHTML(r, c.rezepte)],
  notizen: [(c) => kachel(c.notizen.length, c.notizen.length === 1 ? 'Notiz' : 'Notizen'), (r, c) => notizenHTML(r, c.notizen)],
  wuensche: [(c) => kachel(c.wuensche.offen, c.wuensche.offen === 1 ? 'Vorschlag offen' : 'Vorschläge offen'), (r, c) => wuenscheHTML(r, c.wuensche)],
};
const teileHTML = (r, c, teile) => `<div class="ub-kacheln">${teile.map((t) => TEILE[t][0](c)).join('')}</div>${teile.map((t) => TEILE[t][1](r, c)).join('')}`;

/** Der Reiter einer Person: Karte, was in der Liste steht, die letzten Sitzungen. */
function personHTML(r) {
  const { nachId, z, sitzungen } = auswerten();
  const l = nachId[r.liste];
  const p = z.personen.find((x) => x.liste === r.liste && (r.gast || istAmy(x.name)));
  const karte = p ? personKarte(p, l, z.tage) : stillKarte(r.name, l, r.farbe);
  let inhalt;
  let fuss;
  if (r.gast) {
    const x = inhalte.get(r.gast.daten);
    if (!x?.stand) inhalt = x?.fehler ? `<p class="zugang-fehler">${esc(x.fehler)}</p>` : '<p class="loading">Holt, was in der Liste steht …</p>';
    else inhalt = `${x.fehler ? `<p class="zugang-fehler">${esc(x.fehler)}</p>` : ''}${teileHTML(r, inhaltVon(x.stand, { hilfe: hilfe() }), ['sachen', 'einkauf', 'plan', 'rezepte', 'notizen'])}`;
    fuss = `<p class="fine">So steht es gerade in ${esc(wessen(r.name))} Liste – nur zum Ansehen. Nicht dabei: was jemand verträgt und was jemand der KI geschrieben hat.${x?.at ? ` Stand ${esc(uhr(x.at.toISOString()))}.` : ''} <button type="button" class="linkbtn" data-act="ub-neu"${x?.laedt || laedt ? ' disabled' : ''}>${x?.laedt || laedt ? 'Holt …' : 'Neu holen'}</button></p>`;
  } else {
    // Notizen, Rezepte, Vorschläge aus eurer Liste (wie in der App), die Sachen aus sachen.json
    const s = amySachen;
    inhalt = teileHTML(r, amyInhalt(), ['sachen', 'notizen', 'rezepte', 'wuensche']);
    fuss = `<p class="fine">${esc(wessen(r.name))} Bereich in eurer Liste, die Sachen aus ihrer Sachen-App – nur zum Ansehen. Nicht dabei: was jemand verträgt und was jemand der KI geschrieben hat.${s?.at ? ` Stand ${esc(uhr(s.at.toISOString()))}.` : ''} <button type="button" class="linkbtn" data-act="ub-neu"${s?.laedt || laedt ? ' disabled' : ''}>${s?.laedt || laedt ? 'Holt …' : 'Neu holen'}</button></p>`;
  }
  // Die letzten Sitzungen – der ganze Verlauf unter „Aktivität“
  const ihre = sitzungen.filter((s) => s.liste === r.liste && (r.gast ? s.wer.toLowerCase() === r.name.toLowerCase() : istAmy(s.wer)));
  const zeigen = ihre.slice(0, 5);
  const zuletzt = zeigen.length
    ? teil('Zuletzt', `${tage} Tage`, `${sitzungenHTML(zeigen, nachId)}${ihre.length > zeigen.length ? `<button type="button" class="linkbtn" data-ub-verlauf="${esc(ihre[0].wer.toLowerCase())}">Ganzer Verlauf (${ihre.length})</button>` : ''}`)
    : '';
  return { html: `${karte}${inhalt}${zuletzt}${fuss}`, zeigen };
}

/** Wo im Dashboard der Fokus steht – als Selektor, der nach dem Neuzeichnen dasselbe Element findet. */
function fokusVon(dlg) {
  const el = document.activeElement;
  if (!el || el === dlg || !dlg.contains(el)) return '';
  const a = ['data-ub-reiter', 'data-ub-tage', 'data-ub-wer', 'data-act'].find((x) => el.hasAttribute(x));
  return a ? `[${a}="${window.CSS.escape(el.getAttribute(a))}"]` : '';
}

export function ueberblickZeichnen() {
  const dlg = $('#ueberblick-dlg');
  // Zu: nichts zeichnen und nichts mehr holen (kommt etwas noch an, gehört es nicht mehr hierher)
  if (!dlg?.open) return;
  // Kommt etwas nach (Verlauf, Einzelheiten, eine Liste, Amys Sachen) und zeichnet neu: Der Fokus bleibt, wo er war
  const fokus = fokusVon(dlg);
  const rs = reiterListe();
  const r = rs.find((x) => x.id === reiter) || rs[0];
  reiter = r.id;
  teilNr = 0;
  const knopf = (x) => `<button type="button" role="tab" class="ub-r ub-${x.farbe || 'blau'}${x.liste ? '' : ' ohne-kreis'}" id="ub-r-${esc(x.id.replace(/[^a-z0-9]/gi, '-'))}" data-ub-reiter="${esc(x.id)}" aria-selected="${x.id === reiter}">${x.liste ? `<span class="ub-kreis" aria-hidden="true">${esc(x.name.slice(0, 1).toUpperCase())}</span>` : ''}<span class="ub-r-name">${esc(x.name)}</span></button>`;
  const nav = rs.length > 1 ? `<div class="ub-reiter" role="tablist" aria-label="Dashboard">${rs.map(knopf).join('')}</div>` : '';
  const { html, zeigen } = r.id === 'aktivitaet' ? aktivitaetHTML() : personHTML(r);
  dlg.innerHTML = `<button type="button" class="tablet-zu" data-act="ub-zu" aria-label="Schließen">${X}</button>
<h2 class="ub-titel" id="ub-titel">Dashboard</h2>
${nav}
<div class="ub-panel${r.liste ? ` ub-p ub-${r.farbe}` : ''}" role="${nav ? 'tabpanel' : 'region'}" aria-labelledby="${nav ? `ub-r-${esc(r.id.replace(/[^a-z0-9]/gi, '-'))}` : 'ub-titel'}">${html}</div>`;
  if (fokus) dlg.querySelector(fokus)?.focus({ preventScroll: true });
  detailsAnstossen(zeigen);
  if (r.gast) {
    if (!inhalte.has(r.gast.daten)) inhaltHolen(r.gast);
    gastFotosEinsetzen();
  } else if (r.id === 'amy') {
    if (!amySachen) amySachenHolen();
    // Die Fotos liegen unter sachen/ im Daten-Repo – mit eurem Schlüssel (ansicht-inventar.js)
    sachenFotosEinsetzen(dlg);
  }
}

/**
 * Nach einem neuen Stand eurer Liste (app.js): merken, was in liste.json noch
 * an Sachen steht (zieht es gleich um, bleibt es in Amys Reiter), und Amys
 * Reiter zeigt ihn gleich – nur, wenn er offen ist.
 */
export function dashboardMitziehen() {
  if (!$('#ueberblick-dlg')?.open) return;
  amyListeMerken();
  if (reiter === 'amy') ueberblickZeichnen();
}

/* ------------------------------------ Hinweis: Tobi sieht ein Dashboard */

/**
 * Wem das Dashboard etwas zeigt, der erfährt es einmal je Gerät: ein Gast in
 * seiner eigenen Liste (Tobi sieht, was drinsteht und wann er was ändert)
 * und Amy in eurer (ihr Bereich zusammengefasst – das sieht Tobi in der App
 * ohnehin). Ein neuer Gast liest es schon im Willkommen (ansicht-willkommen.js).
 */
export const DASH_HINWEIS = 'boxenstopp.dashboard.hinweis.v1';
const AUGE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
let hinweisGeprueft = false;
const gezeigt = () => (istEigen() ? 'gast' : istAmy(app.name()) ? 'amy' : '');

function dashHinweisHTML(wem) {
  const text = wem === 'gast'
    ? '<p class="tablet-lead">Tobi hat jetzt ein Dashboard. Darin sieht er, was in deiner Liste steht – deine Sachen mit Fotos, die Einkaufsliste, den Essensplan, deine Rezepte und die Titel deiner Notizen – und wann du was änderst. Nur zum Ansehen.</p><p class="tablet-fein">Was du der KI schreibst und was du verträgst, zeigt es ihm nicht.</p>'
    : '<p class="tablet-lead">Tobi hat jetzt ein Dashboard: wann ihr was in eurer Liste ändert, und dein Bereich auf einen Blick – Sachen, Notizen, Rezepte, Vorschläge. Das sieht er in der App ohnehin.</p><p class="tablet-fein">Was du der KI schreibst und was du verträgst, steht dort nicht. Die Aktivität siehst du auch selbst: Einstellungen → Gäste &amp; Überblick → Dashboard.</p>';
  return `<button type="button" class="tablet-zu" data-act="dash-hinweis-zu" aria-label="Schließen">${X}</button>
<p class="push-dlg-ic" aria-hidden="true">${AUGE}</p>
<h2 class="push-dlg-titel" id="dash-hinweis-titel">Gut zu wissen</h2>
${text}
<div class="tablet-knoepfe"><button type="button" class="btn btn-primary" data-act="dash-hinweis-zu">Alles klar</button></div>`;
}

function dashHinweisZeigen(n = 0) {
  const dlg = $('#dash-hinweis-dlg');
  const wem = gezeigt();
  if (!dlg || dlg.open || !wem || lese(DASH_HINWEIS, false)) return;
  // Erst, wenn kein anderes Fenster offen ist (Willkommen, Push, Kochmodus) – sonst etwas später noch einmal
  if (document.querySelector('dialog[open]')) { if (n < 30) setTimeout(() => dashHinweisZeigen(n + 1), 4000); return; }
  dlg.classList.toggle('amy-thema', wem === 'amy');
  dlg.innerHTML = dashHinweisHTML(wem);
  schreibe(DASH_HINWEIS, true);
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  dlg.querySelector('.btn-primary')?.focus();
}

/** Einmal je App-Start (app.js, sobald die Liste abgeglichen ist). */
export function dashboardHinweisPruefen() {
  if (hinweisGeprueft || !app.zugang || !app.listeDa) return;
  hinweisGeprueft = true;
  if (!gezeigt() || lese(DASH_HINWEIS, false)) return;
  setTimeout(dashHinweisZeigen, Number(lese('__hinweis', 5000)) || 5000);
}
