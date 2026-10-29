/*
 * Unter der Einkaufsliste, bei „Gemeinsame Liste“: Push-Nachrichten an
 * diesem Gerät ein- und ausschalten, was ankommt (Einkaufsliste, Amys
 * Rezepte, Preisalarm), eine Probe schicken – und das einmalige Einrichten
 * mit dem Schlüsselpaar (push.js).
 */
import { app, $, melde } from './kern.js';
import { esc } from './format.js';
import { ARTEN, pushStand, pushEinschalten, pushAusschalten, pushWas, pushTest, schluesselErzeugen, schluesselAblegen } from './push.js';

const SECRETS = 'https://github.com/Finanzdienste/Boxenstopp-Daten/settings/secrets/actions/new';
let stand = null; // zuletzt gesehen: { art, abo, push }
let geholt = 0;
let arbeitet = false;
let einrichten = null; // { oeffentlich, privat } – nur, solange das Einrichten offen ist
let meldung = '';

const GLOCKE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>';

function einrichtenHTML() {
  if (!einrichten) {
    return `<p class="fine">Push ist noch nicht eingerichtet. Das macht einer von euch einmal: ein Schlüsselpaar erzeugen und als zwei Secrets im Daten-Repo ablegen.</p>
<div class="zugang-btns"><button type="button" class="btn" data-act="push-paar">Einrichten</button></div>`;
  }
  return `<ol class="push-schritte">
<li>Öffne auf GitHub <a href="${SECRETS}" target="_blank" rel="noopener">Boxenstopp-Daten → Settings → Secrets → New repository secret</a>.</li>
<li>Name <code>VAPID_PUBLIC_KEY</code>, als Wert den öffentlichen Schlüssel: <button type="button" class="btn btn-klein" data-act="push-kopieren" data-was="oeffentlich">Öffentlichen kopieren</button></li>
<li>Noch ein Secret: Name <code>VAPID_PRIVATE_KEY</code>, als Wert den privaten: <button type="button" class="btn btn-klein" data-act="push-kopieren" data-was="privat">Privaten kopieren</button><small>Nur dort einfügen – nirgends sonst, auch nicht in einen Chat. Die App vergisst ihn, sobald du hier fertig bist.</small></li>
<li>Gespeichert? Dann <button type="button" class="btn btn-primary btn-klein" data-act="push-ablegen">Fertig – Push einschalten</button></li>
</ol>
<input class="z-linkfeld" id="push-feld" type="text" readonly aria-label="Schlüssel zum Kopieren" hidden>
<button type="button" class="linkbtn" data-act="push-abbrechen">Abbrechen</button>`;
}

function inhalt() {
  if (!stand) return '<p class="fine">Push-Nachrichten: wird geprüft …</p>';
  const { art, abo } = stand;
  let html = '';
  if (art === 'geht-nicht') html = '<p class="fine">Push-Nachrichten gehen auf diesem Gerät nicht.</p>';
  else if (art === 'home') html = '<p class="fine">Auf iPhone und iPad gehen Push-Nachrichten nur in der App vom Home-Bildschirm – dort hier einschalten.</p>';
  else if (art === 'verboten') html = '<p class="fine">Mitteilungen sind für Boxenstopp ausgeschaltet. In den Einstellungen des Geräts erlauben, dann hier einschalten.</p>';
  else if (art === 'kein-schluessel') html = einrichtenHTML();
  else if (art === 'aus') html = `<p class="fine">Bekomm Bescheid, wenn der andere etwas auf die Liste setzt, ein neues Rezept da ist, alles eingekauft ist oder ein Preisalarm zuschlägt.</p><div class="zugang-btns"><button type="button" class="btn" data-act="push-an"${arbeitet ? ' disabled' : ''}>${GLOCKE}Push-Nachrichten einschalten</button></div>`;
  else if (art === 'an') {
    const was = new Set(abo?.was || []);
    html = `<p class="push-an">${GLOCKE}Push ist an auf diesem ${esc(abo?.geraet || 'Gerät')}.</p>
<div class="push-was" role="group" aria-label="Was ankommt">${ARTEN.map(([k, name]) => `<label class="push-k"><input type="checkbox" data-push-was="${k}"${was.has(k) ? ' checked' : ''}${arbeitet ? ' disabled' : ''}> ${esc(name)}</label>`).join('')}</div>
<div class="zugang-btns"><button type="button" class="btn btn-quiet" data-act="push-test"${arbeitet ? ' disabled' : ''}>Probe schicken</button><button type="button" class="btn btn-quiet" data-act="push-aus"${arbeitet ? ' disabled' : ''}>Ausschalten</button></div>`;
  }
  return `<p class="push-k-titel"><b>Push-Nachrichten</b></p>${html}${meldung ? `<p class="fine push-meldung" role="status">${esc(meldung)}</p>` : ''}`;
}

/** Zeichnen – den Stand höchstens alle fünf Minuten neu holen, außer frisch. */
export async function pushZeichnen(frisch = false) {
  const el = $('#push-bereich');
  if (!el) return;
  el.innerHTML = inhalt();
  if (!app.zugang || arbeitet) return;
  // Mitteilungen inzwischen in den Einstellungen erlaubt (oder verboten): gleich neu, nicht erst in fünf Minuten
  const erlaubnisAnders = stand && typeof Notification !== 'undefined' && (stand.art === 'verboten') !== (Notification.permission === 'denied');
  if (!frisch && !erlaubnisAnders && stand && Date.now() - geholt < 5 * 60 * 1000) return;
  try { stand = await pushStand(); } catch { stand = stand || { art: 'geht-nicht' }; }
  geholt = Date.now();
  const jetzt = $('#push-bereich');
  if (jetzt) jetzt.innerHTML = inhalt();
}

async function mit(fn, gut = '') {
  arbeitet = true;
  meldung = '';
  pushZeichnen();
  let schief = false;
  try {
    const neu = await fn();
    if (neu && typeof neu === 'object' && neu.art) stand = neu;
    meldung = gut;
  } catch (e) {
    meldung = e?.message || 'Das hat nicht geklappt.';
    schief = true;
  } finally {
    arbeitet = false;
    geholt = Date.now();
    // Ging etwas schief, kann der Stand ein anderer sein (Schlüssel abgelegt, Abo nicht) – neu holen
    pushZeichnen(schief);
  }
}

const gewaehlt = () => ARTEN.map(([k]) => k).filter((k) => $(`#push-bereich [data-push-was="${k}"]`)?.checked ?? true);

/** Klicks. true, wenn es hierher gehörte. */
export function klickPush(el) {
  switch (el.dataset.act) {
    case 'push-an': mit(() => pushEinschalten(), 'Eingeschaltet. Mit „Probe schicken“ siehst du, ob es ankommt.'); return true;
    case 'push-aus': mit(() => pushAusschalten(), 'Ausgeschaltet.'); return true;
    case 'push-test': mit(async () => { await pushTest(); return stand; }, 'Probe ist unterwegs – sie kommt in etwa einer Minute.'); return true;
    case 'push-paar':
      schluesselErzeugen().then((p) => { einrichten = p; pushZeichnen(); }, () => { meldung = 'Dieses Gerät kann keine Schlüssel erzeugen.'; pushZeichnen(); });
      return true;
    case 'push-abbrechen': einrichten = null; pushZeichnen(); return true;
    case 'push-kopieren': {
      const wert = einrichten?.[el.dataset.was];
      if (!wert) return true;
      const feld = $('#push-feld');
      const zeigen = () => { if (feld) { feld.value = wert; feld.hidden = false; feld.select(); } melde('Kopieren klappt hier nicht – der Schlüssel steht im Feld darunter.'); };
      try { navigator.clipboard.writeText(wert).then(() => melde(el.dataset.was === 'privat' ? 'Privater Schlüssel kopiert – jetzt als VAPID_PRIVATE_KEY einfügen' : 'Öffentlicher Schlüssel kopiert – jetzt als VAPID_PUBLIC_KEY einfügen'), zeigen); } catch { zeigen(); }
      return true;
    }
    case 'push-ablegen': {
      const p = einrichten;
      if (!p) return true;
      // Erst um Erlaubnis fragen (das muss direkt aus dem Tipp kommen), dann ablegen und anmelden
      const erlaubnis = typeof Notification !== 'undefined' ? Notification.requestPermission() : Promise.resolve('denied');
      mit(async () => {
        await erlaubnis.catch(() => {});
        await schluesselAblegen(p.oeffentlich);
        einrichten = null;
        return pushEinschalten(undefined, { schluessel: p.oeffentlich });
      }, 'Eingerichtet und eingeschaltet. Mit „Probe schicken“ siehst du, ob es ankommt.');
      return true;
    }
    default: return false;
  }
}

/** Häkchen „was ankommt“ (change). true, wenn es hierher gehörte. */
export function aenderungPush(ziel) {
  if (!ziel.dataset?.pushWas) return false;
  // Erst lesen, dann neu zeichnen (mit() zeichnet sofort – sonst stünde das alte Häkchen wieder da)
  const was = gewaehlt();
  if (stand?.abo) stand = { ...stand, abo: { ...stand.abo, was } };
  mit(() => pushWas(was), 'Gemerkt.');
  return true;
}
