// A1 : tirages pseudo-aléatoires (graine fixe, donc rejouables) d'ajouts, corrections, suppressions et notes faits hors ligne sur deux appareils,
// reconnexion dans un ordre tiré au sort, parfois avec un envoi qui échoue. Après chaque tour : convergence, aucun doublon, aucune perte,
// aucune suppression annulée, 0 écriture au repos. Les opérations des deux appareils portent sur des cartes différentes (pas de conflit sur la même carte :
// les conflits sont testés un par un dans t-a1-fusion.js).
const H = require('./lib/h'), M = require('./lib/md');
const rng = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const qs = p => p.items.map(i => i.q);

async function seedRun(b, t, seed, rounds) {
  const R = rng(seed), pick = a => a[Math.floor(R() * a.length)];
  const e = await M.setup({ browser: b }), { d1, d2 } = e;
  const model = new Map(), ans = new Map();      // question -> présente ; question -> réponse attendue
  (await H.pack(d1, 'pD')).items.forEach(i => { model.set(i.q, true); ans.set(i.q, i.a) });
  let bad = 0, firstBad = '';
  for (let r = 0; r < rounds; r++) {
    d1.offline = d2.offline = true;
    const ops = [];
    for (const [d, dn, parity] of [[d1, 'd1', 0], [d2, 'd2', 1]]) {
      const n = 1 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) {
        const live = [...model.keys()].filter(q => model.get(q) && /^Q\d+$/.test(q) && (+q.slice(1)) % 2 === parity);
        const kind = pick(['add', 'add', 'edit', 'del', 'rate']);
        if (kind == 'add') { const q = `Nouv ${dn} t${r}.${k}`; await d.page.evaluate(q => { const p = G('pD'); p.items.push({ q, a: 'a ' + q }); p.u = hlc(); save() }, q); model.set(q, true); ans.set(q, 'a ' + q); ops.push(dn + '+' + q) }
        else if (kind == 'edit' && live.length) { const q = pick(live), a = `corr ${dn} t${r}.${k}`; await d.page.evaluate(([q, a]) => { const p = G('pD'); p.items.find(i => i.q == q).a = a; p.u = hlc(); save() }, [q, a]); ans.set(q, a); ops.push(dn + '~' + q) }
        else if (kind == 'del' && live.length) { const q = pick(live); await d.page.evaluate(q => { const p = G('pD'); p.items = p.items.filter(i => i.q != q); p.u = hlc(); save() }, q); model.set(q, false); ops.push(dn + '-' + q) }
        else if (kind == 'rate') { const all = [...model.keys()].filter(q => model.get(q) && /^Q\d+$/.test(q) && (+q.slice(1)) % 2 === parity); if (all.length) { const q = pick(all); await H.rate(d, 'pD', q, 3); await H.leave(d); ops.push(dn + '*' + q) } }
      }
    }
    const order = pick([[d1, d2], [d2, d1]]), fail = R() < .3;
    if (fail) { e.srv.failPush = 1 }
    for (const d of order) { d.offline = false; await H.sync1(d); e.srv.failPush = 0 }
    await e.both(3);
    const ps = [await H.pack(d1, 'pD'), await H.pack(d2, 'pD'), e.srv.T.get('pD').data];
    const why = [];
    if (!(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv))) why.push('divergence');
    for (const p of ps) {
      const k = qs(p);
      if (k.length !== new Set(k).size) why.push('doublon');
      for (const [q, here] of model) {
        if (here && !k.includes(q)) why.push('perdue:' + q);
        if (!here && k.includes(q)) why.push('ressuscitée:' + q);
        if (here && k.includes(q) && p.items.find(i => i.q == q).a !== ans.get(q)) why.push('réponse:' + q);
      }
    }
    const n0 = e.srv.log.length; for (let k = 0; k < 3; k++) await e.both(1);
    if (e.srv.log.length !== n0) why.push('écritures au repos:' + (e.srv.log.length - n0));
    if (why.length) { bad++; if (!firstBad) firstBad = `tour ${r} : ${[...new Set(why)].slice(0, 6).join(', ')} | ops : ${ops.join(' ')} | ordre ${order[0] === d1 ? 'd1 puis d2' : 'd2 puis d1'}${fail ? ' + envoi échoué' : ''}` }
  }
  t.ok(!bad, `graine ${seed} : ${rounds} tours aléatoires (ajouts, corrections, suppressions, notes, coupures) sans divergence, doublon, perte, résurrection ni écriture au repos`, firstBad);
  t.ok(!d1.errs.length && !d2.errs.length, `graine ${seed} : aucune erreur JavaScript`, d1.errs.concat(d2.errs).join(' | '));
  await e.close();
}

async function run(b) {
  const t = H.suite('A1 — tirages aléatoires rejouables (convergence, aucune perte, aucune résurrection)');
  for (const seed of [11, 2026, 777, 4242, 99]) await seedRun(b, t, seed, 8);
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
