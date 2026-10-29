/*
 * Push-Nachrichten verschicken. Läuft im privaten Daten-Repo (GitHub Actions:
 * benachrichtigen.yml nach Änderungen an liste.json, angebote.yml nach neuen
 * Angeboten) mit den Secrets VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY. Wer was
 * bekommt, steht in push.json (js/push.js).
 *
 *   node app/werkzeug/push.mjs --daten daten --liste    # was sich auf der Liste getan hat
 *   node app/werkzeug/push.mjs --daten daten --preise   # Preisalarme in den Angeboten
 *   node app/werkzeug/push.mjs --daten daten --test     # die bestellte Probe
 *   … --trocken   nur zeigen, was rausginge (ohne Schlüssel, ohne Senden)
 *   … --angebote datei.json   andere öffentliche Angebote (für die Tests)
 *   … --delta datei.json      was dieser Lauf an push.json ändert, dorthin
 *   node app/werkzeug/push.mjs --daten daten --nachtragen datei.json
 *                 das auf eine frischere push.json legen (die App schreibt
 *                 nebenbei hinein – so geht beim Einchecken nichts verloren)
 *
 * Auf der Liste zählt, was die App mit „· Bescheid“ in der Commit-Nachricht
 * markiert hat (speicher.js): Neues auf der Liste, ein neues Rezept von Amy,
 * eine Notiz, alles eingekauft – je an die anderen, nie an den, der es war.
 * Wer bis wohin benachrichtigt ist, merkt sich push.json (zuletzt.sha), welche
 * Preisalarme schon gemeldet sind, auch (gemeldet).
 *
 * Gibt nie Schlüssel oder die Adressen der Abos aus.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { bereinigen, offeneAnzahl, leer } from '../js/liste.js';
import { preisalarmTreffer, preisJe } from '../js/angebote.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const hat = (name) => process.argv.includes(name);
const DATEN = path.resolve(arg('--daten') || '.');
const trocken = hat('--trocken');
const ABSENDER = 'https://finanzdienste.github.io/Boxenstopp/';

const git = (...a) => execFileSync('git', a, { cwd: DATEN, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const lies = (datei, sonst) => { try { return JSON.parse(readFileSync(datei, 'utf8')); } catch { return sonst; } };

const pushDatei = path.join(DATEN, 'push.json');
const push = lies(pushDatei, null);
if (!push || typeof push !== 'object') { console.log('Push: keine push.json – niemand angemeldet.'); process.exit(0); }
const vorher = JSON.stringify(push);
push.abos = push.abos && typeof push.abos === 'object' ? push.abos : {};
const zaehler = { gesendet: 0, abgelaufen: 0, fehler: 0 };
const abgelaufen = new Set();

/** Was dieser Lauf an push.json ändert – am Ende darauf gelegt, mit --delta auch in eine Datei. */
const delta = { zuletzt: null, gemeldet: [], testAt: '', weg: [] };
function nachtragen(d) {
  if (d?.zuletzt?.sha) push.zuletzt = d.zuletzt;
  if (Array.isArray(d?.gemeldet) && d.gemeldet.length) push.gemeldet = [...new Set([...(Array.isArray(push.gemeldet) ? push.gemeldet : []), ...d.gemeldet])].slice(-300);
  // Die Probe ist raus – außer, inzwischen ist eine neue bestellt
  if (d?.testAt && push.test && (push.test.at || '-') === d.testAt) delete push.test;
  const weg = new Set(Array.isArray(d?.weg) ? d.weg : []);
  for (const [name, liste] of Object.entries(push.abos)) {
    push.abos[name] = (Array.isArray(liste) ? liste : []).filter((a) => a?.endpoint && !weg.has(a.endpoint));
    if (!push.abos[name].length) delete push.abos[name];
  }
}
const speichern = () => { if (JSON.stringify(push) !== vorher) writeFileSync(pushDatei, `${JSON.stringify(push, null, 1)}\n`); };

if (arg('--nachtragen')) {
  nachtragen(lies(arg('--nachtragen'), {}));
  speichern();
  console.log('Push: Stand nachgetragen.');
  process.exit(0);
}

/* ------------------------------------------------------------- Senden */

function senderBauen() {
  if (trocken) return async (an, abo, nutzlast) => { console.log(`→ ${an}${abo.geraet ? ` (${abo.geraet})` : ''}: ${nutzlast.titel} – ${nutzlast.text}`); return { ok: true }; };
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) { console.log('Push: keine Schlüssel (Secrets VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY) – nichts gesendet.'); return null; }
  if (push.schluessel && push.schluessel !== pub) console.log('Push: Achtung – der öffentliche Schlüssel in push.json passt nicht zum Secret. Die Geräte müssen Push neu einschalten.');
  const require = createRequire(import.meta.url);
  const webpush = require(process.env.WEBPUSH || 'web-push');
  webpush.setVapidDetails(ABSENDER, pub, priv);
  return async (an, abo, nutzlast, topic) => {
    try {
      await webpush.sendNotification({ endpoint: abo.endpoint, keys: abo.keys }, JSON.stringify(nutzlast), { TTL: 6 * 3600, urgency: 'normal', topic });
      return { ok: true };
    } catch (e) {
      return { ok: false, weg: e?.statusCode === 404 || e?.statusCode === 410, status: e?.statusCode || 0 };
    }
  };
}
const senden = senderBauen();

/** An alle Geräte einer Person, die diese Art haben wollen. */
async function an(name, art, nutzlast) {
  if (!senden) return;
  for (const abo of push.abos[name] || []) {
    if (!abo?.endpoint || abgelaufen.has(abo.endpoint)) continue;
    if (art !== 'test' && !(Array.isArray(abo.was) ? abo.was : ['liste', 'rezepte', 'preise']).includes(art)) continue;
    const r = await senden(name, abo, nutzlast, art);
    if (r.ok) zaehler.gesendet++;
    else if (r.weg) { abgelaufen.add(abo.endpoint); zaehler.abgelaufen++; } else { zaehler.fehler++; console.log(`Push: an ${name} ging nicht (HTTP ${r.status}).`); }
  }
}

/* -------------------------------------------------------------- Liste */

const rezepteNamen = (() => {
  const d = lies(path.join(APP, 'daten', 'rezepte.json'), {});
  return Object.fromEntries((d.rezepte || []).map((r) => [r.id, r.short || r.name]));
})();
const katalog = lies(path.join(APP, 'daten', 'rezepte.json'), {}).katalog || {};

function inhalt(sha) {
  try { return bereinigen(JSON.parse(git('show', `${sha}:liste.json`))); } catch { return leer(); }
}

/** Was eine Änderung (Commit) gebracht hat. */
function ereignisseVon(vor, nach) {
  const e = { sachen: [], rezepte: [], notizen: [], fertig: false };
  for (const [k, d] of Object.entries(nach.items)) {
    const alt = vor.items[k];
    if (!alt || Object.keys(d.parts || {}).some((rid) => !alt.parts?.[rid])) e.sachen.push(d.name);
  }
  for (const [id, r] of Object.entries(nach.amy || {})) if (!vor.amy?.[id]) e.rezepte.push(r.name);
  for (const [rid, ns] of Object.entries(nach.notizen || {})) {
    for (const n of ns) if (!(vor.notizen?.[rid] || []).some((x) => x.id === n.id)) e.notizen.push({ rid, text: n.text, name: rezepteNamen[rid] || nach.amy?.[rid]?.name || nach.ki?.[rid]?.r?.name || 'einem Rezept' });
  }
  e.fertig = Object.keys(nach.items).length > 0 && offeneAnzahl(vor) > 0 && offeneAnzahl(nach) === 0;
  return e;
}

async function liste() {
  const kopf = git('rev-parse', 'HEAD').trim();
  // Ohne Stand (der erste Lauf): nur, was frisch ist – nichts von vorgestern
  let bereich = ['-n', '5', '--since', '2 hours ago', 'HEAD'];
  const von = push.zuletzt?.sha;
  if (von) {
    try { git('merge-base', '--is-ancestor', von, 'HEAD'); bereich = [`${von}..HEAD`]; } catch { /* unbekannt (zu alt für die Kopie) – dann die letzten */ }
  }
  const commits = git('log', '--reverse', '--format=%H%x09%s', ...bereich, '--', 'liste.json').trim().split('\n').filter(Boolean)
    .map((z) => { const [sha, ...rest] = z.split('\t'); return { sha, betreff: rest.join('\t') }; })
    .filter((c) => c.betreff.includes('· Bescheid'));
  const je = new Map();
  for (const c of commits) {
    const wer = (c.betreff.match(/^([^:]{1,40}):/) || [])[1]?.trim();
    if (!wer) continue;
    let vor;
    try { vor = inhalt(`${c.sha}^`); } catch { vor = leer(); }
    const e = ereignisseVon(vor, inhalt(c.sha));
    const x = je.get(wer.toLowerCase()) || { wer, sachen: new Set(), rezepte: new Set(), notizen: [], fertig: false };
    e.sachen.forEach((s) => x.sachen.add(s));
    e.rezepte.forEach((s) => x.rezepte.add(s));
    x.notizen.push(...e.notizen);
    x.fertig = x.fertig || e.fertig;
    je.set(wer.toLowerCase(), x);
  }
  for (const [autor, x] of je) {
    for (const name of Object.keys(push.abos).filter((n) => n !== autor)) {
      if (x.sachen.size) {
        const s = [...x.sachen];
        const text = s.length === 1 ? `${x.wer} hat „${s[0]}“ auf die Liste gesetzt` : `${x.wer} hat ${s.length} Sachen auf die Liste gesetzt: ${s.slice(0, 5).join(', ')}${s.length > 5 ? ' …' : ''}`;
        await an(name, 'liste', { titel: 'Einkaufsliste', text, tag: 'liste', ziel: 'einkauf' });
      }
      if (x.fertig) await an(name, 'liste', { titel: 'Einkauf erledigt', text: `${x.wer} hat alles eingekauft ✓`, tag: 'fertig', ziel: 'einkauf' });
      if (x.rezepte.size) await an(name, 'rezepte', { titel: 'Amys Rezepte', text: `Neues Rezept von ${x.wer}: ${[...x.rezepte].join(', ')} ♡`, tag: 'rezept', ziel: 'amy' });
      for (const n of x.notizen.slice(-3)) await an(name, 'rezepte', { titel: 'Notiz', text: `${x.wer} zu ${n.name}: ${n.text}`.slice(0, 200), tag: `notiz-${n.rid}`.slice(0, 40), ziel: n.rid });
    }
  }
  delta.zuletzt = { sha: kopf, at: new Date().toISOString() };
}

/* ------------------------------------------------------------- Preise */

async function preise() {
  const stand = bereinigen(lies(path.join(DATEN, 'liste.json'), {}));
  const alarme = stand.preisalarm || {};
  if (!Object.keys(alarme).length) return;
  const heute = new Date().toISOString().slice(0, 10);
  const oeffentlich = lies(arg('--angebote') || path.join(APP, 'daten', 'angebote.json'), {}).angebote || [];
  const privat = lies(path.join(DATEN, 'angebote-privat.json'), {}).angebote || [];
  const alle = [...oeffentlich, ...privat, ...(stand.angebote?.eintraege || [])].filter((a) => !a.bis || a.bis >= heute);
  const gemeldet = new Set(Array.isArray(push.gemeldet) ? push.gemeldet : []);
  const neu = preisalarmTreffer(alarme, alle, katalog).filter((t) => !gemeldet.has(`${t.a.id}|${t.k}`));
  if (!neu.length) return;
  const zeile = (t) => `${katalog[t.k]?.n || t.alarm.name || t.a.name} ${preisJe(t.preis, t.alarm.u)} bei ${t.a.laden}${t.a.von && t.a.von > heute ? ` (ab ${t.a.von.slice(8, 10)}.${t.a.von.slice(5, 7)}.)` : ''}`;
  const nutzlast = { titel: neu.length === 1 ? 'Preisalarm' : `Preisalarm: ${neu.length} Angebote`, text: neu.slice(0, 3).map(zeile).join(' · '), tag: 'preise', ziel: 'angebote' };
  for (const name of Object.keys(push.abos)) await an(name, 'preise', nutzlast);
  delta.gemeldet = neu.map((t) => `${t.a.id}|${t.k}`);
}

/* --------------------------------------------------------------- Test */

async function test() {
  const t = push.test;
  if (!t?.an) return;
  await an(String(t.an).toLowerCase(), 'test', { titel: 'Boxenstopp', text: 'Probe angekommen – Push klappt ✓', tag: 'test', ziel: 'einkauf' });
  delta.testAt = t.at || '-';
}

if (hat('--test')) await test();
if (hat('--liste')) await liste();
if (hat('--preise')) await preise();

// Abgelaufene Abos (Gerät gewechselt, Push ausgeschaltet) fallen weg
delta.weg = [...abgelaufen];
nachtragen(delta);
speichern();
if (arg('--delta')) writeFileSync(arg('--delta'), JSON.stringify(delta));
console.log(`Push: ${zaehler.gesendet} gesendet${zaehler.abgelaufen ? `, ${zaehler.abgelaufen} abgelaufen` : ''}${zaehler.fehler ? `, ${zaehler.fehler} nicht zugestellt` : ''}.`);
