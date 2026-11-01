/*
 * Eine Attrappe von Microsoft für werkzeug/todo.mjs: die Anmeldung mit
 * Gerätecode (devicecode, token) und To Do in Graph (Listen, Aufgaben,
 * Schritte) – je Konto für sich, wie bei echten persönlichen Konten.
 *
 * Wie Microsoft: Jeder Erneuerungs-Token gilt genau einmal (der neue ersetzt
 * ihn), ein Zugang nur mit „Bearer“, Graph-Kennungen sind lang. Dazu Schalter
 * für die Tests: naechste (wer sich mit dem nächsten Code anmeldet, wie oft
 * „noch nicht“, abgelehnt), gesperrt (Anmeldung gilt nicht mehr), bremse
 * (die nächsten n Aufrufe: 429).
 */
import http from 'node:http';

export async function microsoftAttrappe({ app = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } = {}) {
  const z = {
    app,
    konten: {}, // name → { listen: { id → { id, displayName, wellknownListName, aufgaben: { id → aufgabe } } } }
    geraete: {}, // device_code → { konto, warten, art }
    erneuern: {}, // refresh_token → konto (gilt einmal)
    zugaenge: {}, // access_token → konto
    naechste: [], // [{ konto, warten, art: 'ok' | 'abgelehnt' }]
    gesperrt: new Set(),
    bremse: 0,
    oeffentlich: true, // „Öffentliche Clientflows zulassen“ in der App-Registrierung
    aufrufe: [], // { methode, pfad, konto }
    anmeldungen: [], // { endpunkt, grant, scope, client }
    ausgegeben: [], // alle Tokens und Codes, die rausgingen – damit der Test sie im Protokoll suchen kann
    zaehler: 0,
  };
  const neueId = (vor) => `${vor}${++z.zaehler}-${'Q'.repeat(60)}`;
  const konto = (n) => {
    if (!z.konten[n]) z.konten[n] = { listen: { tasks: { id: 'tasks', displayName: 'Aufgaben', wellknownListName: 'defaultList', aufgaben: {} } } };
    return z.konten[n];
  };

  function tokens(k) {
    const access = neueId('acc');
    const refresh = neueId('ref');
    z.zugaenge[access] = k;
    z.erneuern[refresh] = k;
    z.ausgegeben.push(access, refresh);
    return { token_type: 'Bearer', scope: 'Tasks.ReadWrite', expires_in: 3600, access_token: access, refresh_token: refresh };
  }

  const lesenBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => ok(b)); });

  async function anmeldung(req, res, endpunkt) {
    const form = Object.fromEntries(new URLSearchParams(await lesenBody(req)));
    const antwort = (status, j) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    z.anmeldungen.push({ endpunkt, grant: form.grant_type || '', scope: form.scope || '', client: form.client_id || '' });
    if (form.client_id !== z.app) return antwort(400, { error: 'unauthorized_client', error_description: 'unbekannte App' });
    if (endpunkt === 'devicecode') {
      if (!/Tasks\.ReadWrite/.test(form.scope) || !/offline_access/.test(form.scope)) return antwort(400, { error: 'invalid_scope' });
      const n = z.naechste.shift() || { konto: 'amy', warten: 1, art: 'ok' };
      const geraet = neueId('dev');
      const code = `C${String(z.zaehler).padStart(3, '0')}-XYZ`;
      z.geraete[geraet] = { konto: n.konto, warten: n.warten ?? 1, art: n.art || 'ok' };
      z.ausgegeben.push(geraet, code);
      return antwort(200, { user_code: code, device_code: geraet, verification_uri: 'https://www.microsoft.com/link', expires_in: 900, interval: 1, message: `Code ${code}` });
    }
    if (form.grant_type === 'urn:ietf:params:oauth:grant-type:device_code') {
      const g = z.geraete[form.device_code];
      if (!g) return antwort(400, { error: 'expired_token' });
      if (!z.oeffentlich) return antwort(401, { error: 'invalid_client', error_description: "AADSTS7000218: The request body must contain the following parameter: 'client_assertion' or 'client_secret'." });
      if (g.warten > 0) { g.warten--; return antwort(400, { error: 'authorization_pending' }); }
      delete z.geraete[form.device_code];
      if (g.art === 'abgelehnt') return antwort(400, { error: 'authorization_declined' });
      return antwort(200, tokens(g.konto));
    }
    if (form.grant_type === 'refresh_token') {
      if (!/Tasks\.ReadWrite/.test(form.scope)) return antwort(400, { error: 'invalid_scope' });
      const k = z.erneuern[form.refresh_token];
      delete z.erneuern[form.refresh_token];
      if (!k || z.gesperrt.has(k)) return antwort(400, { error: 'invalid_grant', error_description: 'AADSTS70000: abgelaufen' });
      return antwort(200, tokens(k));
    }
    return antwort(400, { error: 'unsupported_grant_type' });
  }

  async function graph(req, res, pfad) {
    const antwort = (status, j = null) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(j === null ? '' : JSON.stringify(j)); };
    const auth = req.headers.authorization || '';
    const k = auth.startsWith('Bearer ') ? z.zugaenge[auth.slice(7)] : null;
    const body = await lesenBody(req);
    z.aufrufe.push({ methode: req.method, pfad, konto: k || null });
    if (!k) return antwort(401, { error: { code: 'InvalidAuthenticationToken' } });
    if (z.bremse > 0) { z.bremse--; return antwort(429, { error: { code: 'TooManyRequests' } }); }
    const j = body ? JSON.parse(body) : {};
    const kt = konto(k);
    const teile = pfad.replace(/^me\/todo\//, '').split('/').map(decodeURIComponent);
    // lists
    if (teile[0] !== 'lists') return antwort(404, { error: { code: 'NotFound' } });
    if (teile.length === 1) {
      if (req.method === 'GET') return antwort(200, { value: Object.values(kt.listen).map(({ id, displayName, wellknownListName, besitzer, geteilt }) => ({ id, displayName, wellknownListName, isOwner: !besitzer || besitzer === k, isShared: !!geteilt })) });
      if (req.method === 'POST') { const id = neueId('liste'); kt.listen[id] = { id, displayName: j.displayName, wellknownListName: 'none', aufgaben: {} }; return antwort(201, { id, displayName: j.displayName, wellknownListName: 'none' }); }
    }
    const liste = kt.listen[teile[1]];
    if (!liste) return antwort(404, { error: { code: 'NotFound' } });
    if (teile.length === 2 && req.method === 'GET') return antwort(200, { id: liste.id, displayName: liste.displayName, wellknownListName: liste.wellknownListName });
    if (teile[2] !== 'tasks') return antwort(404, { error: { code: 'NotFound' } });
    if (teile.length === 3) {
      if (req.method === 'GET') return antwort(200, { value: Object.values(liste.aufgaben).map(({ schritte, ...a }) => a) });
      if (req.method === 'POST') {
        const id = neueId('aufgabe');
        liste.aufgaben[id] = { id, title: j.title, status: j.status || 'notStarted', dueDateTime: j.dueDateTime || null, body: j.body || null, schritte: {} };
        const { schritte, ...a } = liste.aufgaben[id];
        return antwort(201, a);
      }
    }
    const a = liste.aufgaben[teile[3]];
    if (!a) return antwort(404, { error: { code: 'NotFound' } });
    if (teile.length === 4) {
      if (req.method === 'GET') { const { schritte, ...x } = a; return antwort(200, x); }
      if (req.method === 'PATCH') { for (const f of ['title', 'status', 'dueDateTime', 'body']) if (f in j) a[f] = j[f]; const { schritte, ...x } = a; return antwort(200, x); }
      if (req.method === 'DELETE') { delete liste.aufgaben[a.id]; return antwort(204); }
    }
    if (teile[4] !== 'checklistItems') return antwort(404, { error: { code: 'NotFound' } });
    if (teile.length === 5) {
      if (req.method === 'GET') return antwort(200, { value: Object.values(a.schritte) });
      if (req.method === 'POST') { const id = neueId('schritt'); a.schritte[id] = { id, displayName: j.displayName, isChecked: j.isChecked === true }; return antwort(201, a.schritte[id]); }
    }
    const sch = a.schritte[teile[5]];
    if (!sch) return antwort(404, { error: { code: 'NotFound' } });
    if (req.method === 'PATCH') { if ('isChecked' in j) sch.isChecked = j.isChecked === true; if ('displayName' in j) sch.displayName = j.displayName; return antwort(200, sch); }
    if (req.method === 'DELETE') { delete a.schritte[sch.id]; return antwort(204); }
    return antwort(405, { error: { code: 'MethodNotAllowed' } });
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (p.startsWith('/consumers/oauth2/v2.0/')) { anmeldung(req, res, p.slice('/consumers/oauth2/v2.0/'.length)); return; }
    if (p.startsWith('/v1.0/')) { graph(req, res, p.slice('/v1.0/'.length)); return; }
    res.writeHead(404);
    res.end();
  });
  await new Promise((ok) => { server.listen(0, '127.0.0.1', ok); });
  const port = server.address().port;

  /** Eine gemeinsame Liste: dieselbe in beiden Konten (wie in To Do geteilt), besitzer legt sie an. */
  function teilen(name, besitzer, mitglied) {
    const id = neueId('geteilt');
    const l = { id, displayName: name, wellknownListName: 'none', besitzer, geteilt: true, aufgaben: {} };
    konto(besitzer).listen[id] = l;
    konto(mitglied).listen[id] = l;
    return l;
  }
  const aufgabenIn = (l) => Object.values(l?.aufgaben || {}).map((a) => ({ ...a, schritte: Object.values(a.schritte) }));

  /** Die Liste „Haushalt“ eines Kontos – ihre Aufgaben mit Schritten (oder null). */
  const haushalt = (n) => Object.values(konto(n).listen).find((l) => l.displayName === 'Haushalt') || null;
  const aufgaben = (n) => Object.values(haushalt(n)?.aufgaben || {}).map((a) => ({ ...a, schritte: Object.values(a.schritte) }));

  return {
    z,
    anmeldung: `http://127.0.0.1:${port}/consumers/oauth2/v2.0/`,
    graph: `http://127.0.0.1:${port}/v1.0/`,
    konto,
    haushalt,
    aufgaben,
    teilen,
    aufgabenIn,
    stop: () => new Promise((ok) => { server.close(ok); }),
  };
}
