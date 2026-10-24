// Harnais de test de rev. : Chromium (Playwright déjà installé sur la machine), données fictives, serveur Supabase simulé.
// Aucune requête ne sort : tout ce qui n'est pas file:/data: est bloqué, WebSocket désactivé, RPC servies par le simulateur.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
let pw; for (const n of ['playwright', '/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright']) { try { pw = require(n); break } catch (e) {} }
if (!pw) throw new Error('Playwright introuvable');
const ROOT = path.resolve(__dirname, '..', '..');
const HTML = process.env.REV_HTML ? path.resolve(process.env.REV_HTML) : path.join(ROOT, 'index.html');   // REV_HTML=<fichier> : rejouer les tests sur une autre version
const CODE = 'ABCDEFGHJKLMNPQRSTUV';

// version d'origine (avant corrections) : sert de « client ancienne version »
const OLD_REV = '1f6cb44';
function oldHtml() {
  const f = path.join(os.tmpdir(), 'rev-old-' + OLD_REV + '.html');
  if (!fs.existsSync(f)) fs.writeFileSync(f, cp.execSync('git show ' + OLD_REV + ':index.html', { cwd: ROOT, maxBuffer: 1 << 26 }));
  return f;
}

async function launch() {
  const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  return pw.chromium.launch(fs.existsSync(exe) ? { executablePath: exe, args: ['--no-sandbox'] } : {});
}

// numéro de jour local à minuit (comme day() d'origine) pour construire les jeux de données
function dayNow(tz = 'Europe/Paris', now = Date.now()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).split('-').map(Number);
  return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5);
}

// serveur simulé : copie fidèle de revis_n_pull / revis_n_push / revis_n_ver (définitions lues le 21/10/2026)
// opts.guardGn : simule la garde de génération proposée (refus si data.gn < gn stocké) — n'existe pas encore en production
// opts.jsonb : simule PostgreSQL jsonb, qui réordonne les clés de TOUS les objets (y compris dans les tableaux) : clés courtes d'abord, puis ordre alphabétique ;
//   sans cette option l'ordre d'écriture est conservé (comportement historique des tests). REV_JSONB=1 active jsonb par défaut pour toute une exécution.
const jsonbOrder = v => Array.isArray(v) ? v.map(jsonbOrder) : v && typeof v == 'object' ? Object.fromEntries(Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).map(k => [k, jsonbOrder(v[k])])) : v;
function server(opts = {}) {
  if (opts.jsonb === undefined) opts = { ...opts, jsonb: process.env.REV_JSONB == '1' };
  const store = n => { const c = JSON.parse(JSON.stringify(n)); return opts.jsonb ? jsonbOrder(c) : c };
  const T = new Map(); let seq = 0; const inject = [];
  const maxRev = () => Math.max(0, ...[...T.values()].map(v => v.rev));
  const srv = { T, log: [], inject, opts,
    handle: async r => {
      const f = r.request().url().split('/rpc/')[1]; let b = {};
      try { b = JSON.parse(r.request().postData() || '{}') } catch (e) {}
      const ok = x => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (f == 'revis_n_pull') {
        const nodes = [...T.values()].filter(v => v.rev > (b.p_since || 0)).sort((a, c) => a.rev - c.rev).map(v => JSON.parse(JSON.stringify(v.data)));
        // écho retardé : une ancienne version d'un nœud rejouée dans une réponse
        while (inject.length) nodes.push(store(inject.shift()));
        return ok({ rev: maxRev(), nodes });
      }
      if (f == 'revis_n_push' && srv.failPush > 0) { srv.failPush--; return r.fulfill({ status: 500, body: '{}' }) }   // panne simulée : synchronisation interrompue
      if (f == 'revis_n_push') {
        for (const n of b.p_nodes) {
          const u = +n.u || 0, e = T.get(n.id), gn = +n.gn || 0, eg = e ? (+e.data.gn || 0) : 0;
          if (!e || (u >= e.u && (!srv.opts.guardGn || gn >= eg))) { T.set(n.id, { data: store(n), u, rev: ++seq }); srv.log.push(['put', n.id, u]) }
          else srv.log.push(['refus', n.id, u, e.u])
        }
        return ok(maxRev());
      }
      if (f == 'revis_n_ver') return ok(String(maxRev()));
      if (f == 'revis_img_put' || f == 'revis_img_del') return ok(null);
      if (f == 'revis_img_get') return ok([]);
      return r.fulfill({ status: 404, body: '{}' });
    } };
  return srv;
}

// un « appareil » = un contexte de navigateur isolé (stockage propre)
// o : { seed, cfg, dev, srv, html, off (décalage d'horloge en ms), tz }
async function device(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 1366 }, timezoneId: o.tz || 'Europe/Paris' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() == 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console:' + m.text()) });
  await page.addInitScript(({ seed, cfg, dev, off }) => {
    const R = Date; if (window.__off == null) window.__off = off || 0;
    class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + window.__off) } static now() { return R.now() + window.__off } }
    window.Date = D; window.WebSocket = undefined;
    try { if (!localStorage.getItem('__seeded')) { if (seed) localStorage.setItem('revis-v2', JSON.stringify(seed)); if (cfg) localStorage.setItem('revis-cfg', JSON.stringify(cfg)); if (dev) localStorage.setItem('revis-dev', dev); localStorage.setItem('__seeded', '1') } } catch (e) {}
  }, { seed: o.seed, cfg: o.cfg, dev: o.dev, off: o.off || 0 });
  const d = { ctx, page, errs, offline: false, name: o.dev };
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
    if (u.includes('/rest/v1/rpc/') && o.srv) return d.offline ? r.abort() : o.srv.handle(r);
    return r.abort();
  });
  await page.goto('file://' + (o.html || HTML));
  await page.waitForFunction(() => typeof booted != 'undefined' && booted && typeof ready != 'undefined' && ready, null, { timeout: 20000 });
  d.reload = async () => { await page.reload(); await page.waitForFunction(() => typeof booted != 'undefined' && booted && ready, null, { timeout: 20000 }) };
  return d;
}

// synchro complète d'un appareil (attend la fin d'une synchro en cours)
const sync = d => d.page.evaluate(async () => { for (let k = 0; k < 3; k++) { let w = 0; while (busy && w++ < 200) await new Promise(r => setTimeout(r, 25)); await sync() } });
const sync1 = d => d.page.evaluate(async () => { let w = 0; while (busy && w++ < 200) await new Promise(r => setTimeout(r, 25)); await sync() });
async function syncAll(ds, rounds = 2) { for (let k = 0; k < rounds; k++) for (const d of ds) if (!d.offline) await sync(d) }

// gestes de révision réels (fonctions de l'app)
const rate = (d, pid, qq, g) => d.page.evaluate(([pid, qq, g]) => { deck = G(pid); view = 'study'; const i = deck.items.findIndex(x => x.q == qq); q = [i]; tot = 1; known = 0; back = true; order = []; A.rate(g) }, [pid, qq, g]);
const rateQ = (d, pid, qq, good) => d.page.evaluate(([pid, qq, good]) => { deck = G(pid); view = 'study'; const i = deck.items.findIndex(x => x.q == qq); order = [i]; idx = 0; score = 0; wrong = []; sel = {}; val = false; vprev = null; hesd = false; const it = deck.items[i]; po(it).forEach((x, j) => { if (good ? x.k : !x.k) sel[j] = true }); A.val() }, [pid, qq, good]);
const leave = d => d.page.evaluate(() => { view = 'browse'; deck = null; q = []; order = []; render() });
const item = (d, pid, qq) => d.page.evaluate(([pid, qq]) => { const p = G(pid); const it = p && p.items && p.items.find(x => x.q == qq); return it ? JSON.parse(JSON.stringify(it)) : null }, [pid, qq]);
const pack = (d, pid) => d.page.evaluate(pid => { const p = G(pid); return p ? JSON.parse(JSON.stringify(p)) : null }, pid);
const FS = ['st', 's', 'df', 'l', 'k', 'd', 'f'];
const fsr = it => it ? FS.map(k => it[k] === undefined ? '' : it[k]).join('|') : 'absente';

// vérifications
function suite(name) {
  const checks = [];
  return { name, checks, ok(c, label, extra) { checks.push({ ok: !!c, label, extra }) },
    // risque connu, hors périmètre des corrections en cours : affiché, jamais compté comme échec
    known(c, label, extra) { checks.push({ ok: true, known: !c, label, extra }) } };
}

module.exports = { jsonbOrder, launch, dayNow, server, device, sync, sync1, syncAll, rate, rateQ, leave, item, pack, fsr, suite, CODE, HTML, oldHtml, ROOT };
