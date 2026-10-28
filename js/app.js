/*
 * Einstieg: Rezepte laden, den richtigen Speicher für die Einkaufsliste
 * wählen, Klicks verteilen, Service Worker anmelden.
 *
 * Ohne Schlüssel liegt die Liste nur auf diesem Handy (speicher.js lokal).
 * Mit Schlüssel liegt sie im privaten Repo Boxenstopp-Daten (github), und
 * beide Handys sehen dieselbe Liste.
 *
 * Für die Tests lassen sich zwei Dinge über den localStorage verstellen:
 * __api (statt https://api.github.com) und __takt (Abgleich in ms).
 */
import { app, $, ansicht, zeigeReiter, melde, lese } from './kern.js';
import { lokal, github, lokalerStand, lokalLoeschen, githubVergessen, pruefeSchluessel, privatLesen, API } from './speicher.js';
import { opZusammen } from './liste.js';
import { ladeZugang, speichereZugang, loescheZugang, schluesselAusAdresse, kiAusAdresse, speichereKi } from './zugang.js';
import { filterZeichnen, rasterZeichnen, oeffneRezept, schliesseRezept, offenesRezept, detailAktualisieren, klickRezepte, eingabeRezepte, absendenRezepte, timerZeichnen, zuSchritt } from './ansicht-rezepte.js';
import { timerAnmelden, leisteHTML, klickTimer } from './timer.js';
import { listeZeichnen, zahlZeichnen, statusZeichnen, zugangZeichnen, formularMitSchluessel, klickListe, absendenListe } from './ansicht-liste.js';
import { kiStart, kiAbgleichen, resteZeichnen, klickKi, eingabeKi, aenderungKi, absendenKi } from './ansicht-ki.js';
import { anpassenStart, klickAnpassen, eingabeAnpassen, absendenAnpassen } from './ansicht-anpassen.js';
import { lobStart, klickLob } from './lob.js';
import { angeboteZeichnen, angeboteAutoSetzen, angebotePrivatVergessen, zahlZeichnen as angeboteZahl, klickAngebote, eingabeAngebote, aenderungAngebote, absendenAngebote } from './ansicht-angebote.js';

const apiBasis = () => lese('__api', null) || API;
/** Rewe, Edeka, Netto (kaufDA) liegen nur im privaten Daten-Repo – mit dem Schlüssel nebenbei holen. */
const privateAngebote = () => {
  if (!app.zugang?.token) return;
  privatLesen('angebote-privat.json', { token: app.zugang.token, api: apiBasis() }).then((a) => { if (a) angeboteAutoSetzen(a, { privat: true }); });
};
const takt = () => Number(lese('__takt', 0)) || 8000;

function beiAenderung(stand) {
  app.stand = stand;
  app.listeDa = true;
  kiAbgleichen();
  listeZeichnen();
  zahlZeichnen();
  angeboteZeichnen();
  angeboteZahl();
  // Ein Rezept aus der Resteverwertung kann auf dem anderen Handy gelöscht worden sein.
  if (offenesRezept() && !app.nachId[offenesRezept()]) schliesseRezept();
  if (offenesRezept()) detailAktualisieren(); else { rasterZeichnen(); resteZeichnen(); }
}
function beiStatus(s) {
  app.status = s;
  statusZeichnen();
}

function nimmSpeicher(neu) {
  if (app.speicher) app.speicher.stop();
  app.speicher = neu;
  neu.start(beiAenderung, beiStatus);
}

// Angebote oder Laden geändert (ansicht-angebote.js): die Hinweise auf der Liste mitziehen
app.listeNeu = () => listeZeichnen();

app.verbinden = async (token, name) => {
  const ergebnis = await pruefeSchluessel(token, { api: apiBasis() });
  if (ergebnis !== 'ok') return ergebnis;
  // Was bisher nur auf diesem Handy stand, kommt mit in die gemeinsame Liste.
  const bisher = app.zugang ? null : lokalerStand();
  app.zugang = { token, name };
  speichereZugang(app.zugang);
  nimmSpeicher(github({ token, name, api: apiBasis(), takt: takt() }));
  if (bisher && (Object.keys(bisher.items).length || Object.keys(bisher.ki).length)) app.aendern(opZusammen(bisher.items, bisher.ki));
  lokalLoeschen();
  statusZeichnen();
  privateAngebote();
  return 'ok';
};

app.trennen = () => {
  loescheZugang();
  githubVergessen();
  app.zugang = null;
  app.listeDa = false;
  angebotePrivatVergessen();
  nimmSpeicher(lokal());
  zugangZeichnen();
  melde('Getrennt. Die Liste bleibt in GitHub, hier ist sie jetzt leer.');
};

/* --------------------------------------------------------------- Klicks */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button');
  if (!el || el.disabled) return;
  if (el.dataset.tab) { zeigeReiter(el.dataset.tab); return; }
  if (klickLob(el)) return;
  if (klickTimer(el)) return;
  if (el.dataset.timerZu) { zuSchritt(el.dataset.timerZu, Number(el.dataset.timerSchritt)); return; }
  if (klickListe(el)) return;
  if (klickAngebote(el)) return;
  if (klickAnpassen(el)) return;
  if (klickKi(el)) return;
  klickRezepte(el);
});
// Ein Produktfoto, das nicht lädt (Händler hat es weggenommen, kein Netz): das Bildchen der Zutat zeigen
document.addEventListener('error', (ev) => {
  const img = ev.target;
  if (img?.tagName !== 'IMG' || !img.dataset.ersatz) return;
  const ersatz = img.dataset.ersatz;
  delete img.dataset.ersatz;
  img.src = ersatz;
  img.parentElement?.classList.add('a-bild-zb');
}, true);
document.addEventListener('input', (ev) => { if (!eingabeAnpassen(ev.target) && !eingabeKi(ev.target) && !eingabeAngebote(ev.target)) eingabeRezepte(ev.target); });
document.addEventListener('change', (ev) => { if (!aenderungKi(ev.target)) aenderungAngebote(ev.target); });
document.addEventListener('submit', (ev) => { if (!absendenAnpassen(ev) && !absendenKi(ev) && !absendenAngebote(ev) && !absendenRezepte(ev)) absendenListe(ev); });

/* ----------------------------------------------------------------- Start */

async function start() {
  let daten;
  try {
    const r = await fetch('daten/rezepte.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    daten = await r.json();
  } catch {
    $('#grid').innerHTML = '<p class="empty">Die Rezepte ließen sich nicht laden. Prüf die Verbindung und öffne die App noch einmal.</p>';
    return;
  }
  app.rezepte = daten.rezepte;
  app.katalog = daten.katalog;
  app.extras = daten.extras || {};
  app.naehrwerte = daten.naehrwerte || {};
  app.preise = daten.preise || {};
  app.preiseStand = daten.preise_stand || '';
  if (daten.ziel) app.ziel = daten.ziel;
  for (const r of app.rezepte) app.nachId[r.id] = r;
  // Welche Einheit ein Katalog-Schlüssel hat – damit die Resteverwertung nur
  // dann eine Zeile mit einem festen Rezept teilt, wenn sich Mengen addieren lassen.
  for (const r of app.rezepte) for (const it of r.items) if (it.k && typeof it.q === 'number') app.einheiten[it.k] = it.u;
  $('#r-eyebrow').textContent = `${app.rezepte.length} Rezepte · je 8 Boxen`;

  let hash = '';
  try { hash = decodeURIComponent((location.hash || '').slice(1)); } catch { /* kaputte Adresse */ }
  const kiLink = kiAusAdresse();
  if (kiLink) speichereKi(kiLink);
  const ausLink = schluesselAusAdresse();
  kiStart();
  anpassenStart();
  lobStart();
  timerAnmelden(() => {
    const leiste = $('#timerleiste');
    const html = leisteHTML();
    if (leiste.innerHTML !== html) leiste.innerHTML = html;
    leiste.hidden = !html;
    timerZeichnen();
  });
  filterZeichnen();
  rasterZeichnen();
  listeZeichnen();
  angeboteZeichnen();
  // Die Angebote der Woche kommen nebenbei – ohne Netz bleibt der letzte Stand aus dem Speicher.
  fetch('daten/angebote.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((a) => { if (a) angeboteAutoSetzen(a); }).catch(() => {});

  if (hash === 'einkauf' || hash === 'liste' || ausLink) ansicht.tab = 'einkauf';
  if (hash === 'angebote') ansicht.tab = 'angebote';
  zeigeReiter(ansicht.tab, true);
  const rezept = app.nachId[hash] ? hash : (app.nachId[ansicht.rezept] ? ansicht.rezept : null);
  if (hash === 'reste' || (kiLink && !ausLink)) kiStart({ oeffnen: true });
  else if (rezept) oeffneRezept(rezept, { still: true });
  if (kiLink) melde('KI-Schlüssel übernommen – die Resteverwertung ist bereit.');

  app.zugang = ladeZugang();
  if (app.zugang) nimmSpeicher(github({ ...app.zugang, api: apiBasis(), takt: takt() }));
  else nimmSpeicher(lokal());
  privateAngebote();

  if (ausLink && ausLink !== app.zugang?.token) formularMitSchluessel(ausLink);
  else zugangZeichnen();
}

start();

/*
 * Service Worker: macht die App offline benutzbar. Eine neue Fassung lädt
 * die Seite einmal neu (wie bei Freizeit und Workout), aber nur, wenn vorher
 * schon ein Worker da war – beim allerersten Besuch nicht.
 */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const eigenerWorker = new URL('./sw.js', location.href).href;
  const hatteWorker = navigator.serviceWorker.controller?.scriptURL === eigenerWorker;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteWorker) return;
    try {
      if (sessionStorage.getItem('boxenstopp.neugeladen')) return;
      sessionStorage.setItem('boxenstopp.neugeladen', '1');
    } catch { return; }
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* dann ohne Offline-Betrieb */ });
  });
}
