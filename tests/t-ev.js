// Compteurs d'examen ev (étape 4, D3 option A) : convergence, examens simultanés, ancien client, restauration, statistiques, données historiques.
// « Ancien client » = la version d'avant l'étape 4 (b91e359), qui ignore ev.
const H = require('./lib/h'), M = require('./lib/md'), cp = require('child_process');
const OLD = require('path').join(require('os').tmpdir(), 'rev-old-b91e359.html');
if (!require('fs').existsSync(OLD)) require('fs').writeFileSync(OLD, cp.execSync('git show b91e359:index.html', { cwd: H.ROOT, maxBuffer: 1 << 26 }));
const J = M.canon;   // comparaison indépendante de l'ordre des clés
const evOf = (d, pid, q) => d.page.evaluate(([pid, q]) => { const it = G(pid).items.find(x => x.q == q); return it ? (it.ev || null) : 'absente' }, [pid, q]);
const srvEv = (e, pid, q) => { const it = e.srv.T.get(pid).data.items.find(x => x.q == q); return it ? (it.ev || null) : 'absente' };
const exam = async (d, ans) => { await d.page.evaluate(() => { cur = nid('f2'); view = 'browse'; A.exs(); A.xgo() }); await d.page.evaluate(a => { const f = eval(a); deck.items.forEach((it, j) => { const s = f(it, po(it)); if (s) ex.s[j] = s }); A.xfin() }, ans.toString()); await H.leave(d); await d.page.waitForTimeout(250) };
const good = (it, o) => Object.fromEntries(o.map((x, k) => [k, !!x.k]));

async function run(b) {
  const t = H.suite('ev : compteurs d\'examen, convergence et compatibilité');

  // 1) examens simultanés sur deux appareils (hors ligne), puis reconnexion dans les deux ordres, synchros répétées
  for (const order of ['d1 puis d2', 'd2 puis d1']) {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    d1.offline = d2.offline = true;
    await exam(d1, good); await exam(d2, (it, o) => Object.fromEntries(o.map((x, k) => [k, !x.k])));
    d1.offline = d2.offline = false;
    const [x, y] = order == 'd1 puis d2' ? [d1, d2] : [d2, d1]; await H.sync(x); await H.sync(y); await e.both(3);
    const a = await evOf(d1, 'pB', 'QQ1'), c = await evOf(d2, 'pB', 'QQ1');
    t.ok(J(a) === J({ dev1: [1, 0], dev2: [1, 1] }) && J(a) === J(c) && J(srvEv(e, 'pB', 'QQ1')) === J(a), 'examens simultanés : les deux entrées conservées, identiques sur les deux appareils et au serveur [' + order + ']', J(a) + ' / ' + J(c));
    t.ok(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv), 'appareils et serveur identiques [' + order + ']');
    const n0 = e.srv.log.length; for (let k = 0; k < 5; k++) await e.both(1);
    t.ok(e.srv.log.length === n0, '10 synchros au repos : 0 écriture [' + order + ']', (e.srv.log.length - n0) + ' écriture(s)');
    t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript [' + order + ']', d1.errs.concat(d2.errs).join(' | '));
    await e.close();
  }

  // 2) ancien client hors ligne qui modifie le paquet pendant qu'un examen est enregistré par un client récent
  {
    const e = await M.setup({ browser: b, d2: { html: OLD } }), { d1, d2 } = e;
    d2.offline = true; await exam(d1, good); await H.sync(d1);
    await H.rateQ(d2, 'pB', 'QQ3', true); await H.leave(d2);                               // modification du paquet par l'ancien client
    d2.offline = false; await H.sync(d2);
    t.ok(J(srvEv(e, 'pB', 'QQ1')) === 'null', 'constat : l\'ancien client a bien renvoyé le paquet sans ev au serveur (le risque est réel)');
    await H.sync(d1); await H.sync(d2); await H.sync(d1);
    t.ok(J(srvEv(e, 'pB', 'QQ1')) === J({ dev1: [1, 0] }) && J(await evOf(d1, 'pB', 'QQ1')) === J({ dev1: [1, 0] }), 'ancien client : les compteurs ev sont restaurés sur le serveur par l\'appareil qui les a enregistrés', J(srvEv(e, 'pB', 'QQ1')));
    t.ok(H.fsr(await H.item(d1, 'pB', 'QQ3')) === H.fsr(await H.item(d2, 'pB', 'QQ3')), 'la révision faite par l\'ancien client est conservée');
    // l'ancien client MODIFIE LE TEXTE d'une carte examinée pendant que l'appareil récent enregistre un autre examen
    d2.offline = true; await exam(d1, good); await H.sync(d1);
    await d2.page.evaluate(() => { const p = G('pB'); p.items.find(x => x.q == 'QQ2').q = 'QQ2 corrigée'; p.u = Date.now() + 5000; save() }); await H.leave(d2);
    d2.offline = false; await H.sync(d2); await H.sync(d1); await H.sync(d2); await H.sync(d1);
    const ed = await evOf(d1, 'pB', 'QQ2 corrigée');
    t.ok(ed && ed.dev1 && ed.dev1[0] === 2 && J(srvEv(e, 'pB', 'QQ2 corrigée')) === J(ed), 'ancien client : texte d\'une carte modifié pendant l\'examen : les compteurs ev suivent la carte modifiée (appariement de secours par position)', J(ed));
    await e.close();
  }

  // 3) restauration d'une sauvegarde ancienne (sans ev) : par une version récente puis par une ancienne
  for (const [who, html] of [['version récente', undefined], ['ancienne version', OLD]]) {
    const e = await M.setup({ browser: b, d1: html ? { html } : {} }), { d1, d2 } = e;
    const backup = await d1.page.evaluate(() => JSON.parse(JSON.stringify(S.nodes.filter(n => !n.x))));   // sauvegarde AVANT l'examen : sans ev
    await exam(d2, good); await e.both(3);
    await d1.page.evaluate(nodes => { view = 'browse'; rs = { date: 'x', np: 1, nodes }; A.rsok() }, backup); await H.sync(d1);
    await e.both(3);
    const v = [J(await evOf(d1, 'pB', 'QQ1')), J(await evOf(d2, 'pB', 'QQ1')), J(srvEv(e, 'pB', 'QQ1'))];
    t.ok(v.every(x => x === J({ dev2: [1, 0] })), 'restauration d\'une sauvegarde ancienne (sans ev) par ' + who + ' : les compteurs d\'examen enregistrés par l\'autre appareil sont conservés', v.join(' / '));
    await e.close();
  }

  // 4) statistiques : anciens n, m + compteurs d'examen
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await d1.page.evaluate(() => { const p = G('pB'), it = p.items.find(x => x.q == 'QQ4'); it.n = 4; it.m = 1; it.ev = { devA: [3, 2] }; p.u = hlc(); save() });  // historique : 4 réponses, 1 erreur ; examens : 3 réponses, 2 erreurs
    const s = await d1.page.evaluate(() => { const it = G('pB').items.find(x => x.q == 'QQ4'); return { n: nOf(it), m: mOf(it), hard: hardList().some(h => h.i === it), info: (() => { render(); return document.body.innerHTML.length > 0 })(), taux: (() => { const a = packsOf(G('pB')).reduce((a, p) => { p.items.forEach(i => { a.n += nOf(i); a.m += mOf(i) }); return a }, { n: 0, m: 0 }); return a })() } });
    t.ok(s.n === 7 && s.m === 3 && s.hard, 'statistiques : n + ev = 7 réponses, m + ev = 3 erreurs ; la carte entre dans « souvent ratées » (m total ≥ 2)', J(s));
    await e.both(3);
    t.ok(await d2.page.evaluate(() => { const it = G('pB').items.find(x => x.q == 'QQ4'); return nOf(it) === 7 && mOf(it) === 3 && it.n === 4 && it.m === 1 }), 'les anciens compteurs n et m sont conservés tels quels et les mêmes chiffres s\'affichent sur l\'autre appareil');
    await e.close();
  }
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
