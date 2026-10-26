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
import { lokal, github, lokalerStand, lokalLoeschen, githubVergessen, pruefeSchluessel, API } from './speicher.js';
import { opZusammen } from './liste.js';
import { ladeZugang, speichereZugang, loescheZugang, schluesselAusAdresse } from './zugang.js';
import { filterZeichnen, rasterZeichnen, oeffneRezept, offenesRezept, detailAktualisieren, klickRezepte, eingabeRezepte } from './ansicht-rezepte.js';
import { listeZeichnen, zahlZeichnen, statusZeichnen, zugangZeichnen, formularMitSchluessel, klickListe, absendenListe } from './ansicht-liste.js';

const apiBasis = () => lese('__api', null) || API;
const takt = () => Number(lese('__takt', 0)) || 8000;

function beiAenderung(stand) {
  app.stand = stand;
  app.listeDa = true;
  listeZeichnen();
  zahlZeichnen();
  if (offenesRezept()) detailAktualisieren(); else rasterZeichnen();
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

app.verbinden = async (token, name) => {
  const ergebnis = await pruefeSchluessel(token, { api: apiBasis() });
  if (ergebnis !== 'ok') return ergebnis;
  // Was bisher nur auf diesem Handy stand, kommt mit in die gemeinsame Liste.
  const bisher = app.zugang ? null : lokalerStand().items;
  app.zugang = { token, name };
  speichereZugang(app.zugang);
  nimmSpeicher(github({ token, name, api: apiBasis(), takt: takt() }));
  if (bisher && Object.keys(bisher).length) app.aendern(opZusammen(bisher));
  lokalLoeschen();
  statusZeichnen();
  return 'ok';
};

app.trennen = () => {
  loescheZugang();
  githubVergessen();
  app.zugang = null;
  app.listeDa = false;
  nimmSpeicher(lokal());
  zugangZeichnen();
  melde('Getrennt. Die Liste bleibt in GitHub, hier ist sie jetzt leer.');
};

/* --------------------------------------------------------------- Klicks */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button');
  if (!el || el.disabled) return;
  if (el.dataset.tab) { zeigeReiter(el.dataset.tab); return; }
  if (klickListe(el)) return;
  klickRezepte(el);
});
document.addEventListener('input', (ev) => eingabeRezepte(ev.target));
document.addEventListener('submit', (ev) => absendenListe(ev));

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
  if (daten.ziel) app.ziel = daten.ziel;
  for (const r of app.rezepte) app.nachId[r.id] = r;
  $('#r-eyebrow').textContent = `${app.rezepte.length} Rezepte · je 8 Boxen`;

  filterZeichnen();
  rasterZeichnen();
  listeZeichnen();

  const hash = decodeURIComponent((location.hash || '').slice(1));
  const ausLink = schluesselAusAdresse();
  if (hash === 'einkauf' || hash === 'liste' || ausLink) ansicht.tab = 'einkauf';
  zeigeReiter(ansicht.tab, true);
  const rezept = app.nachId[hash] ? hash : (app.nachId[ansicht.rezept] ? ansicht.rezept : null);
  if (rezept) oeffneRezept(rezept, { still: true });

  app.zugang = ladeZugang();
  if (app.zugang) nimmSpeicher(github({ ...app.zugang, api: apiBasis(), takt: takt() }));
  else nimmSpeicher(lokal());

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
