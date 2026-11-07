/*
 * Boxen pro Rezept einstellen – gerechnet wird in boxen.js, angewendet in
 * ansicht-ziel.js (zielAnwenden). Die Zahl gilt für die ganze Liste
 * (liste.json profil.boxen), wie das Ziel: Wer eine Liste teilt, kocht
 * dieselben Boxen.
 *
 *   - Einstellungen → „Boxen pro Rezept“ (#e-boxen)
 *   - in einer eigenen Liste oben bei den Rezepten, bis sie es einmal
 *     gesagt hat (#r-boxen): Marielle kocht meist für 1 oder 2
 *   - im Willkommen auf der Seite mit den Makros (ansicht-willkommen.js)
 *
 * Ein Tipp auf eine Zahl speichert sie gleich (auch 8 – ausdrücklich, damit
 * speicher.js merkt, wenn eine ältere Fassung sie weglässt) und zieht die
 * Rezepte auf der Liste nach.
 */
import { app, $, $$, melde, lese, schreibe } from './kern.js';
import { BOXEN_WAHL, boxenBereinigen, boxenDerListe, boxenText } from './boxen.js';
import { opProfil } from './liste.js';
import { istEigen } from './profil.js';
import { listeNachziehen } from './ansicht-ziel.js';

const TIPP_ZU = 'boxenstopp.boxentipp.v1';

/** Die Zahlen 1–8 zum Antippen; an: die gerade gilt (oder keine). */
export const boxenChips = (an) => BOXEN_WAHL.map((n) => `<button type="button" class="chip" data-boxen="${n}" aria-pressed="${n === an}">${n}</button>`).join('');

/** Speichern und die Liste nachziehen. */
export function boxenSpeichern(n, { still = false } = {}) {
  const b = boxenBereinigen(n);
  if (!b) return false;
  if (b === app.stand.profil?.boxen) return true;
  app.aendern(opProfil({ boxen: b }, app.name()));
  const nachgezogen = listeNachziehen();
  for (const el of $$('[data-boxen]')) el.setAttribute('aria-pressed', String(Number(el.dataset.boxen) === b));
  boxenZeichnen();
  if (!still) melde(`${b === 8 ? 'Wieder für 8 Boxen' : `Jetzt für ${boxenText(b)}`} – Zutaten, Gewürze, Schritte und Kosten sind umgerechnet${nachgezogen ? ', die Liste ist nachgezogen' : ''}.`);
  return true;
}

function einstellungenHTML() {
  const n = boxenDerListe(app.stand);
  return `<p class="e-boxen-stand">${n === 8 ? 'Die Rezepte sind für <b>8 Boxen</b> gebaut.' : `Gerade für <b>${boxenText(n)}</b> – gebaut sind die Rezepte für 8.`}</p>
<div class="e-boxen-wahl" role="group" aria-label="Boxen pro Rezept">${boxenChips(n)}</div>
<p class="fine">Kochst du für weniger (oder mehr), rechnen sich Zutaten, Gewürze, die Mengen in den Schritten, Kosten und die Einkaufsliste um – die Werte pro Box bleiben. Gemüse und Dosen gibt es dann auch als ¼ (gekauft wird eine ganze), Knoblauch und Eier bleiben ganz. ${istEigen() ? 'Gilt auf allen deinen Geräten.' : 'Gilt für alle, die diese Liste teilen.'}</p>`;
}

/** Ob oben bei den Rezepten gefragt wird: eigene Liste, noch keine Zahl gesagt, nicht weggeklickt. */
const tippZeigen = () => app.listeDa && !!app.zugang && istEigen() && !boxenBereinigen(app.stand.profil?.boxen) && !lese(TIPP_ZU, false);

/** Einstellungen und der Hinweis bei den Rezepten. */
export function boxenZeichnen() {
  const e = $('#e-boxen');
  if (e) e.innerHTML = einstellungenHTML();
  const t = $('#r-boxen');
  if (!t) return;
  const zeigen = tippZeigen();
  t.hidden = !zeigen;
  if (zeigen && !t.childElementCount) {
    t.innerHTML = `<p><b>Für wie viele Boxen kochst du meistens?</b> Die Rezepte sind für 8 gebaut – die App rechnet sie auf deine Zahl um.</p>
<div class="r-boxen-wahl" role="group" aria-label="Boxen pro Rezept">${boxenChips(null)}</div>
<button type="button" class="linkbtn" data-act="boxen-tipp-zu">Später, in den Einstellungen</button>`;
  }
  if (!zeigen) t.innerHTML = '';
}

export function klickBoxen(el) {
  if (el.dataset.boxen) { boxenSpeichern(Number(el.dataset.boxen)); return true; }
  if (el.dataset.act === 'boxen-tipp-zu') { schreibe(TIPP_ZU, true); boxenZeichnen(); return true; }
  return false;
}
