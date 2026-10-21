// Fondation (étape 2) : convergence déterministe malgré une horloge décalée, l'ordre de reconnexion et un écho retardé ;
// aucune écriture refusée silencieusement par le serveur.
const H = require('./lib/h'), M = require('./lib/md');
const SKEW = -10 * 60e3; // l'appareil 2 retarde de 10 minutes

async function run(b) {
  const t = H.suite('Horloges, ordre de reconnexion, échos');
  const res = [];
  for (const order of ['d1 puis d2', 'd2 puis d1']) {
    const e = await M.setup({ browser: b, d2: { off: SKEW } }), { d1, d2 } = e;
    const old = JSON.parse(JSON.stringify(e.srv.T.get('pD').data));
    d1.offline = d2.offline = true;
    // les deux appareils notent la même carte hors ligne ; l'appareil 2 ajoute aussi une carte (plus tard en temps réel)
    await H.rate(d1, 'pD', 'Q1', 3); await H.leave(d1);
    await new Promise(r => setTimeout(r, 40));
    await H.rate(d2, 'pD', 'Q1', 1); await d2.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'Ajout D2', a: 'x' }); p.u = Date.now(); save() }); await H.leave(d2);
    d1.offline = d2.offline = false;
    const [x, y] = order == 'd1 puis d2' ? [d1, d2] : [d2, d1];
    await H.sync(x); await H.sync(y); await e.both(3);
    const p1 = await H.pack(d1, 'pD'), p2 = await H.pack(d2, 'pD');
    t.ok(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv), 'appareils et serveur identiques [' + order + ']');
    t.known(p1.items.some(i => i.q == 'Ajout D2'), 'ajout hors ligne d\'un appareil à l\'horloge en retard, en concurrence avec une note ailleurs (contenu hors séance : dernier « u » gagnant) [' + order + ']', e.srv.log.filter(l => l[0] == 'refus').length + ' écriture(s) refusée(s) par le serveur');
    res.push(H.fsr(p1.items.find(i => i.q == 'Q1')));
    // écho retardé : l'ancienne version du paquet revient dans une réponse
    const before = await M.packsJSON(d1); e.srv.inject.push(old); await H.sync(d1); await e.both();
    t.ok(await M.packsJSON(d1) === before, 'un écho ancien ne modifie rien [' + order + ']');
    const n0 = e.srv.log.length; for (let k = 0; k < 5; k++) await e.both(1);
    t.ok(e.srv.log.length === n0, '10 synchros au repos : 0 écriture [' + order + ']', (e.srv.log.length - n0) + ' écriture(s)');
    await e.close();
  }
  t.ok(res[0] === res[1], 'même résultat final quel que soit l\'ordre de reconnexion (dernier écrivain, déterministe)', res.join(' / '));
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
