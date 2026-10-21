// Deux (ou trois) appareils synchronisés sur le même code fictif et le même serveur simulé.
const H = require('./h'), D = require('./data');
exports.setup = async (o = {}) => {
  const b = o.browser || await H.launch(), T = H.dayNow(), srv = H.server({ guardGn: !!o.guardGn });
  const cfg = { srs: true, nl: 20, nx: true, code: H.CODE, ...(o.cfg || {}) };
  const seed = D.mk(T);
  const mk = (dev, x = {}) => H.device(b, { seed: JSON.parse(JSON.stringify(seed)), cfg, dev, srv, ...x });
  const d1 = await mk('dev1', o.d1 || {}), d2 = await mk('dev2', o.d2 || {});
  const env = { b, T, srv, d1, d2, mk, all: [d1, d2],
    both: async (r = 2) => { await H.syncAll(env.all, r); await H.sync(d1) },
    close: async () => { if (!o.browser) await b.close(); else await Promise.all(env.all.map(d => d.ctx.close())) } };
  await env.both();
  return env;
};
// état des paquets comparable entre appareils (sans les champs purement locaux)
const canon = o => o && typeof o == 'object' && !Array.isArray(o) ? '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : JSON.stringify(o === undefined ? null : o);
exports.canon = canon;
exports.packsJSON = d => d.page.evaluate(() => S.nodes.filter(n => n.k == 'fc' || n.k == 'qcm').sort((a, b) => a.id < b.id ? -1 : 1)).then(canon);
exports.serverPacks = srv => canon([...srv.T.values()].map(v => v.data).filter(n => n.k == 'fc' || n.k == 'qcm').sort((a, b) => a.id < b.id ? -1 : 1));
