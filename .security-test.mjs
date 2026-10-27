import { readFileSync } from 'node:fs';

// Live security test suite. Run with the four TEST_* environment variables set.
// Every check talks to the deployed APIs and database directly.

const env = Object.fromEntries(
  readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const URL_BASE = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASS = process.env.TEST_ADMIN_PASS;
const HOST_EMAIL = process.env.TEST_HOST_EMAIL;
const HOST_PASS = process.env.TEST_HOST_PASS;
const HOST_RESTAURANT = process.env.TEST_HOST_RESTAURANT;

const results = [];
function record(name, expected, actual, pass) {
  results.push({ name, expected, actual, pass: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n      expected: ${expected}\n      actual:   ${actual}`);
}

async function rest(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = { apikey: ANON, Authorization: `Bearer ${token ?? ANON}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

async function rpc(name, args, token) {
  return rest(`rpc/${name}`, { method: 'POST', token, body: args });
}

async function fn(slug, payload, token) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ANON}` };
  const res = await fetch(`${URL_BASE}/functions/v1/${slug}`, {
    method: 'POST', headers, body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

async function signIn(email, password) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function section(title) {
  console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`);
}

async function main() {
  // ---------------------------------------------------------------- SECTION 1
  section('SECTION 1 — ANONYMOUS VISITOR');

  for (const table of ['restaurants', 'dishes', 'app_config', 'usage_events', 'model_settings', 'admin_users']) {
    const r = await rest(`${table}?select=*`);
    const blocked = r.status === 401 || r.status === 403 || (Array.isArray(r.body) && r.body.length === 0);
    record(`anon SELECT ${table}`, '401/403 or 0 rows', `HTTP ${r.status}, ${Array.isArray(r.body) ? r.body.length + ' rows' : JSON.stringify(r.body).slice(0, 80)}`, blocked);
  }

  for (const table of ['admin_credentials', 'admin_sessions', 'retired_admin_credentials', 'retired_admin_sessions']) {
    const r = await rest(`${table}?select=*`);
    const gone = r.status === 401 || r.status === 403 || r.status === 404;
    record(`anon SELECT ${table}`, '401/403/404 (unreachable)', `HTTP ${r.status}`, gone);
  }

  const insertProbe = await rest('restaurants', {
    method: 'POST',
    body: { owner_email: 'anon-probe@example.invalid', name: '__ANON_PROBE__', city: 'x' },
    prefer: 'return=representation',
  });
  record('anon INSERT restaurants', 'rejected (401/403)', `HTTP ${insertProbe.status}`, insertProbe.status === 401 || insertProbe.status === 403);

  const updateProbe = await rest(`restaurants?id=eq.${HOST_RESTAURANT}`, {
    method: 'PATCH', body: { name: '__ANON_HACK__' }, prefer: 'return=representation',
  });
  const updateBlocked = updateProbe.status === 401 || updateProbe.status === 403 || (Array.isArray(updateProbe.body) && updateProbe.body.length === 0);
  record('anon UPDATE a real restaurant', 'rejected or 0 rows', `HTTP ${updateProbe.status}, ${Array.isArray(updateProbe.body) ? updateProbe.body.length + ' rows changed' : ''}`, updateBlocked);

  const deleteProbe = await rest(`dishes?restaurant_id=eq.${HOST_RESTAURANT}`, { method: 'DELETE', prefer: 'return=representation' });
  const deleteBlocked = deleteProbe.status === 401 || deleteProbe.status === 403 || (Array.isArray(deleteProbe.body) && deleteProbe.body.length === 0);
  record('anon DELETE dishes', 'rejected or 0 rows', `HTTP ${deleteProbe.status}, ${Array.isArray(deleteProbe.body) ? deleteProbe.body.length + ' rows deleted' : ''}`, deleteBlocked);

  const cfg = await rest('app_config', { method: 'POST', body: { key: 'botText', value: { text: '__ANON__' } }, prefer: 'return=representation' });
  record('anon write app_config (admin bot text)', 'rejected', `HTTP ${cfg.status}`, cfg.status === 401 || cfg.status === 403);

  for (const slug of ['dish-image', 'menu-extract']) {
    const r = await fn(slug, { restaurantId: HOST_RESTAURANT, dishId: 'x', objectPath: 'x/y.pdf' });
    record(`anon call ${slug}`, '401', `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 60)}`, r.status === 401);
  }
  const adminAnon = await fn('admin-api', { action: 'read' });
  record('anon call admin-api read', '401', `HTTP ${adminAnon.status}`, adminAnon.status === 401);
  const adminAnonWho = await fn('admin-api', { action: 'whoami' });
  record('anon call admin-api whoami', '401', `HTTP ${adminAnonWho.status}`, adminAnonWho.status === 401);
  const adminBadToken = await fn('admin-api', { action: 'read' }, 'not-a-real-token');
  record('admin-api with forged token', '401', `HTTP ${adminBadToken.status}`, adminBadToken.status === 401);

  const publicPortal = await rpc('get_public_portal', { p_portal_id: HOST_RESTAURANT });
  const pp = Array.isArray(publicPortal.body) ? publicPortal.body[0] : null;
  record('anon get_public_portal (active)', 'id/name/city/welcome only', `HTTP ${publicPortal.status} keys=${pp ? Object.keys(pp).join(',') : 'none'}`, publicPortal.status === 200 && pp && Object.keys(pp).sort().join(',') === 'city,id,name,welcome');
  record('anon get_public_portal leaks no system prompt/status', 'no system_prompt key', pp && !('system_prompt' in pp) ? 'absent' : 'PRESENT', Boolean(pp && !('system_prompt' in pp) && !('status' in pp)));

  const storageList = await fetch(`${URL_BASE}/storage/v1/object/list/dish-images`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: 'menus', limit: 100 }),
  });
  const listBody = await storageList.json().catch(() => null);
  record('anon list legacy menus/ prefix in dish-images', '0 objects', `HTTP ${storageList.status}, ${Array.isArray(listBody) ? listBody.length + ' objects' : ''}`, Array.isArray(listBody) && listBody.length === 0);

  const legacyDoc = await fetch(
    `${URL_BASE}/storage/v1/object/public/dish-images/menus/${HOST_RESTAURANT}/cdaaf85f-73a5-480b-9862-b8874390f935.jpg`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }
  );
  record('anon fetching a legacy menu document from the public bucket', 'denied (not 200)', `HTTP ${legacyDoc.status}`, legacyDoc.status !== 200);

  const menuList = await fetch(`${URL_BASE}/storage/v1/object/list/menu-files`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 100 }),
  });
  const menuBody = await menuList.json().catch(() => null);
  record('anon list private menu-files', '0 objects', `HTTP ${menuList.status}, ${Array.isArray(menuBody) ? menuBody.length + ' objects' : ''}`, Array.isArray(menuBody) && menuBody.length === 0);

  const probeUpload = await fetch(`${URL_BASE}/storage/v1/object/menu-files/${HOST_RESTAURANT}/__anon_probe.txt`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'text/plain' }, body: 'probe',
  });
  record('anon upload into a host folder (menu-files)', 'rejected', `HTTP ${probeUpload.status}`, probeUpload.status >= 400);

  const auditProbe = await fetch(`${URL_BASE}/storage/v1/object/dish-images/menus/6fbb17b6-06d6-4b64-b753-e20c24fa86ed/__audit_probe.txt`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const auditBody = await auditProbe.json().catch(() => null);
  const auditGone = auditProbe.status === 404 || auditBody?.statusCode === '404' || auditBody?.code === 'NoSuchKey';
  record('leftover audit probe file removed', 'gone (404 / NoSuchKey)', `HTTP ${auditProbe.status} ${JSON.stringify(auditBody)}`, Boolean(auditGone));

  const privateDoc = await fetch(
    `${URL_BASE}/storage/v1/object/public/menu-files/${HOST_RESTAURANT}/x.pdf`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }
  );
  record('anon fetching through the public URL of the private bucket', 'denied (not 200)', `HTTP ${privateDoc.status}`, privateDoc.status !== 200);

  // ---------------------------------------------------------------- SECTION 2
  section('SECTION 2 — HOST');

  const hostAuth = await signIn(HOST_EMAIL, HOST_PASS);
  if (hostAuth.status !== 200 || !hostAuth.json?.access_token) {
    record('host sign-in (Supabase Auth)', '200 + access token', `HTTP ${hostAuth.status} ${JSON.stringify(hostAuth.json).slice(0, 100)}`, false);
  } else {
    record('host sign-in (Supabase Auth)', '200 + access token', 'token issued', true);
  }
  const hostToken = hostAuth.json?.access_token;
  const hostId = hostAuth.json?.user?.id;

  if (hostToken) {
    const own = await rest('restaurants?select=id,name,owner_id,system_prompt', { token: hostToken });
    record('host sees own restaurant', 'exactly 1 row', `${Array.isArray(own.body) ? own.body.length : '?'} rows`, Array.isArray(own.body) && own.body.length === 1);
    record('host restaurant is its own (owner_id matches)', 'owner_id = own id', Array.isArray(own.body) && own.body[0]?.owner_id === hostId ? 'match' : `mismatch ${own.body?.[0]?.owner_id}`, Array.isArray(own.body) && own.body[0]?.owner_id === hostId);

    const allRestaurants = await rest('restaurants?select=id', { token: hostToken });
    record('host cannot see the other restaurants', '1 row (not 5)', `${Array.isArray(allRestaurants.body) ? allRestaurants.body.length : '?'} rows`, Array.isArray(allRestaurants.body) && allRestaurants.body.length === 1);

    const otherId = '6fbb17b6-06d6-4b64-b753-e20c24fa86ed';
    const crossRead = await rest(`restaurants?id=eq.${otherId}&select=id`, { token: hostToken });
    record("host reading another host's restaurant", '0 rows', `${Array.isArray(crossRead.body) ? crossRead.body.length : '?'} rows`, Array.isArray(crossRead.body) && crossRead.body.length === 0);

    const crossDishes = await rest('dishes?select=id,restaurant_id', { token: hostToken });
    const foreign = Array.isArray(crossDishes.body) ? crossDishes.body.filter((d) => d.restaurant_id !== HOST_RESTAURANT) : [];
    record("host reading another host's dishes", '0 foreign rows', `${foreign.length} foreign rows`, foreign.length === 0);

    const crossInsert = await rest('dishes', {
      method: 'POST', token: hostToken, prefer: 'return=representation',
      body: { restaurant_id: otherId, name: '__CROSS_PROBE__', price: '1' },
    });
    record("host INSERT a dish into another restaurant", 'rejected (403)', `HTTP ${crossInsert.status}`, crossInsert.status === 403 || crossInsert.status === 401);

    const crossUpdate = await rest(`dishes?restaurant_id=eq.${otherId}`, {
      method: 'PATCH', token: hostToken, prefer: 'return=representation', body: { name: '__CROSS_HACK__' },
    });
    record("host UPDATE another host's dishes", '0 rows', `${Array.isArray(crossUpdate.body) ? crossUpdate.body.length : '?'} rows`, Array.isArray(crossUpdate.body) && crossUpdate.body.length === 0);

    const steal = await rest(`restaurants?id=eq.${HOST_RESTAURANT}`, {
      method: 'PATCH', token: hostToken, prefer: 'return=representation',
      body: { owner_id: '00000000-0000-0000-0000-000000000000', owner_email: 'attacker@example.invalid', status: 'Blocked' },
    });
    const after = await rest(`restaurants?id=eq.${HOST_RESTAURANT}&select=owner_id,owner_email,status`, { token: hostToken });
    const row = Array.isArray(after.body) ? after.body[0] : null;
    const held = row && row.owner_id === hostId && row.status !== 'Blocked' && row.owner_email !== 'attacker@example.invalid';
    record('host tampering with owner_id / owner_email / status', 'reverted to original', held ? `owner_id unchanged, status=${row.status}` : `LEAKED: ${JSON.stringify(row)}`, Boolean(held));

    const dishImage = await fn('dish-image', { restaurantId: otherId, dishId: '00000000-0000-0000-0000-000000000000' }, hostToken);
    record("host calling dish-image for another restaurant", '403', `HTTP ${dishImage.status}`, dishImage.status === 403);

    const extract = await fn('menu-extract', { restaurantId: otherId, objectPath: `${otherId}/x.pdf` }, hostToken);
    record("host calling menu-extract for another restaurant", '403', `HTTP ${extract.status}`, extract.status === 403);

    const extractTraversal = await fn('menu-extract', { restaurantId: HOST_RESTAURANT, objectPath: `${HOST_RESTAURANT}/../${otherId}/x.pdf` }, hostToken);
    record('menu-extract path traversal attempt', '403', `HTTP ${extractTraversal.status}`, extractTraversal.status === 403);

    const extractForeign = await fn('menu-extract', { restaurantId: HOST_RESTAURANT, objectPath: `${otherId}/x.pdf` }, hostToken);
    record("menu-extract naming another host's file", '403', `HTTP ${extractForeign.status}`, extractForeign.status === 403);

    const adminAsHost = await fn('admin-api', { action: 'read' }, hostToken);
    record('host calling admin-api', '403', `HTTP ${adminAsHost.status}`, adminAsHost.status === 403);
    const adminCreate = await fn('admin-api', { action: 'createHost', email: 'x@example.invalid', password: 'password123', restaurantName: 'x', city: 'x' }, hostToken);
    record('host attempting admin createHost', '403', `HTTP ${adminCreate.status}`, adminCreate.status === 403);

    const hostCfg = await rest('app_config?select=key,value', { token: hostToken });
    const keys = Array.isArray(hostCfg.body) ? hostCfg.body.map((r) => r.key) : [];
    record('host reading app_config', 'botText only', `keys=[${keys.join(',')}]`, keys.length === 1 && keys[0] === 'botText');
    const hostCfgWrite = await rest('app_config?key=eq.botText', { method: 'PATCH', token: hostToken, body: { value: { text: '__HOST__' } }, prefer: 'return=representation' });
    record('host writing the admin bot text', 'rejected or 0 rows', `HTTP ${hostCfgWrite.status}, ${Array.isArray(hostCfgWrite.body) ? hostCfgWrite.body.length + ' rows' : ''}`, hostCfgWrite.status >= 400 || (Array.isArray(hostCfgWrite.body) && hostCfgWrite.body.length === 0));

    const hostModels = await rest('model_settings?select=*', { token: hostToken });
    record('host reading model_settings (AI keys)', '0 rows / 401', `HTTP ${hostModels.status}, ${Array.isArray(hostModels.body) ? hostModels.body.length + ' rows' : ''}`, hostModels.status === 401 || hostModels.status === 403 || (Array.isArray(hostModels.body) && hostModels.body.length === 0));

    const hostUsage = await rest('usage_events?select=restaurant_id', { token: hostToken });
    const foreignUsage = Array.isArray(hostUsage.body) ? hostUsage.body.filter((u) => u.restaurant_id && u.restaurant_id !== HOST_RESTAURANT) : [];
    record("host reading another restaurant's usage", '0 foreign rows', `${foreignUsage.length} foreign rows`, foreignUsage.length === 0);

    const hostUploadOwn = await fetch(`${URL_BASE}/storage/v1/object/menu-files/${HOST_RESTAURANT}/__host_probe.txt`, {
      method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${hostToken}`, 'Content-Type': 'text/plain' }, body: 'probe',
    });
    record('host upload into own folder', 'allowed (200)', `HTTP ${hostUploadOwn.status}`, hostUploadOwn.status === 200);
    if (hostUploadOwn.status === 200) {
      const del = await fetch(`${URL_BASE}/storage/v1/object/menu-files/${HOST_RESTAURANT}/__host_probe.txt`, {
        method: 'DELETE', headers: { apikey: ANON, Authorization: `Bearer ${hostToken}` },
      });
      record('host deleting own uploaded file (cleanup)', '200', `HTTP ${del.status}`, del.status === 200);
    }
    const hostUploadForeign = await fetch(`${URL_BASE}/storage/v1/object/menu-files/${otherId}/__host_probe.txt`, {
      method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${hostToken}`, 'Content-Type': 'text/plain' }, body: 'probe',
    });
    record("host upload into ANOTHER host's folder", 'rejected', `HTTP ${hostUploadForeign.status}`, hostUploadForeign.status >= 400);
  }

  // ---------------------------------------------------------------- SECTION 3
  section('SECTION 3 — ADMIN');

  const adminAuth = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  record('admin sign-in (Supabase Auth)', '200 + access token', `HTTP ${adminAuth.status}`, adminAuth.status === 200 && Boolean(adminAuth.json?.access_token));
  const adminToken = adminAuth.json?.access_token;

  if (adminToken) {
    const who = await fn('admin-api', { action: 'whoami' }, adminToken);
    record('admin whoami', 'isAdmin true', JSON.stringify(who.body), who.status === 200 && who.body?.isAdmin === true);

    const models = await fn('admin-api', { action: 'read' }, adminToken);
    record('admin reads AI model settings', 'no raw key returned', `hasApiKey=${models.body?.chatModel?.hasApiKey}, rawKeyPresent=${'apiKey' in (models.body?.chatModel ?? {})}`, models.status === 200 && models.body?.chatModel && !('apiKey' in models.body.chatModel));
    const keysInResponse = JSON.stringify(models.body ?? {});
    record('admin read response contains no key-shaped secret', 'no sk-/Bearer/long hex', !/(sk-[A-Za-z0-9]|Bearer [A-Za-z0-9]{10})/.test(keysInResponse) ? 'clean' : 'SECRET SHAPED DATA', !/(sk-[A-Za-z0-9]|Bearer [A-Za-z0-9]{10})/.test(keysInResponse));

    const hosts = await fn('admin-api', { action: 'hosts' }, adminToken);
    record('admin lists hosts', '5 rows', `${hosts.body?.hosts?.length} rows`, hosts.status === 200 && Array.isArray(hosts.body?.hosts) && hosts.body.hosts.length === 5);

    const usage = await fn('admin-api', { action: 'usage' }, adminToken);
    record('admin reads usage', '5 rows', `${usage.body?.usage?.length} rows`, usage.status === 200 && usage.body?.usage?.length === 5);

    const bot = await fn('admin-api', { action: 'getBotText' }, adminToken);
    record('admin reads bot text', 'non-empty string', `len=${bot.body?.text?.length}`, bot.status === 200 && typeof bot.body?.text === 'string' && bot.body.text.length > 0);

    const setStatus = await fn('admin-api', { action: 'setHostStatus', restaurantId: HOST_RESTAURANT, status: 'Active' }, adminToken);
    record('admin can set host status (idempotent, no change)', '200', `HTTP ${setStatus.status}`, setStatus.status === 200);
  }

  // ---------------------------------------------------------------- SECTION 4
  section('SECTION 4 — VISITOR CHAT');

  const badRestaurant = await fn('visitor-chat', { restaurantId: '00000000-0000-0000-0000-000000000000', message: 'hello' });
  record('visitor chat with unknown restaurant', '400/404, no model call', `HTTP ${badRestaurant.status}`, badRestaurant.status === 400 || badRestaurant.status === 404);

  const longMessage = await fn('visitor-chat', { restaurantId: HOST_RESTAURANT, message: 'x'.repeat(5000) });
  record('visitor chat with over-long message', '413', `HTTP ${longMessage.status}`, longMessage.status === 413);

  const noRestaurant = await fn('visitor-chat', { message: 'hi' });
  record('visitor chat with no restaurant', '400', `HTTP ${noRestaurant.status}`, noRestaurant.status === 400);

  const liveChat = await fn('visitor-chat', {
    restaurantId: HOST_RESTAURANT,
    message: 'What drinks do you have?',
  });
  const cards = Array.isArray(liveChat.body?.dishes) ? liveChat.body.dishes : [];
  const foreignCards = cards.filter((d) => d.restaurantId && d.restaurantId !== HOST_RESTAURANT);
  record('visitor chat answers without a sign-in', '200 + reply text', `HTTP ${liveChat.status}, reply len=${liveChat.body?.reply?.length ?? 0}`, liveChat.status === 200 && typeof liveChat.body?.reply === 'string' && liveChat.body.reply.length > 0);
  record('visitor chat returns no dishes from other restaurants', '0 foreign cards', `${cards.length} cards, ${foreignCards.length} foreign`, foreignCards.length === 0);

  // ---------------------------------------------------------------- SECTION 7
  section('SECTION 7 — SESSION VALIDITY AND REVOCATION');

  const junk = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIn0.bad-signature';
  for (const slug of ['dish-image', 'menu-extract', 'admin-api']) {
    const r = await fn(slug, { action: 'read', restaurantId: HOST_RESTAURANT, dishId: 'x', objectPath: 'x' }, junk);
    record(`${slug} with a forged/tampered token`, '401', `HTTP ${r.status}`, r.status === 401);
  }

  const session = await signIn(HOST_EMAIL, HOST_PASS);
  const refreshToken = session.json?.refresh_token;
  const accessToken = session.json?.access_token;
  if (accessToken && refreshToken) {
    const live = await rest('restaurants?select=id', { token: accessToken });
    record('fresh host session reads its restaurant', '1 row', `${live.body?.length} rows`, Array.isArray(live.body) && live.body.length === 1);

    const logout = await fetch(`${URL_BASE}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${accessToken}` },
    });
    record('host sign-out revokes the session server-side', '204', `HTTP ${logout.status}`, logout.status === 204 || logout.status === 200);

    const reuse = await fetch(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    record('revoked refresh token cannot mint a new session', '400/401', `HTTP ${reuse.status}`, reuse.status === 400 || reuse.status === 401);
  } else {
    record('host sign-out revokes the session server-side', '204', 'could not obtain a session to test', false);
  }

  // ---------------------------------------------------------------- SECTION 5
  section('SECTION 5 — RATE LIMITING (durable, server-side)');

  let limitedAt = null;
  for (let i = 1; i <= 25; i += 1) {
    const r = await fn('visitor-chat', { restaurantId: '00000000-0000-0000-0000-000000000000', message: `probe ${i}` });
    if (r.status === 429) { limitedAt = i; break; }
  }
  record('per-IP rate limit on visitor chat', '429 within 25 requests', limitedAt ? `429 at request ${limitedAt}` : 'never limited', Boolean(limitedAt));

  // ---------------------------------------------------------------- SECTION 6
  section('SECTION 6 — PASSWORD RECOVERY');

  const known = await fetch(`${URL_BASE}/auth/v1/recover`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email: ADMIN_EMAIL }),
  });
  const unknown = await fetch(`${URL_BASE}/auth/v1/recover`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email: 'definitely-not-an-account-9f8a7b@example.invalid' }),
  });
  record('recovery request for a real address', '200 (generic)', `HTTP ${known.status}`, known.status === 200);
  record('recovery request for an unknown address', '200 (same generic response)', `HTTP ${unknown.status}`, unknown.status === 200);
  record('no account enumeration in recovery', 'identical responses', `real=${known.status} unknown=${unknown.status}`, known.status === unknown.status);

  const summary = results.filter((r) => r.pass === 'FAIL');
  section(`SUMMARY — ${results.length} checks, ${summary.length} failed`);
  if (summary.length) for (const f of summary) console.log(`FAIL: ${f.name} — expected ${f.expected}, got ${f.actual}`);
  console.log(JSON.stringify({ total: results.length, failed: summary.length }));
}

main().catch((error) => { console.error('HARNESS ERROR', error); process.exit(1); });
