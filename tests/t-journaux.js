// Journaux de révision par appareil (log-<appareil>) : les mises à jour successives d'un journal doivent devenir visibles
// sur les autres appareils (sinon séries, révisions du jour et calendrier cumulés sont sous-évalués).
// Cause trouvée : fixHide() (drapeaux caché/épinglé/ordre) traitait le champ « h » du journal (historique par jour) comme le drapeau « caché ».
const H = require('./lib/h'), M = require('./lib/md');
const cum = d => d.page.evaluate(() => { const L = S.nodes.filter(n => n.k == 'log' && !n.x), d0 = day();
  return { today: L.reduce((s, l) => s + ((l.h || {})[d0] || 0), 0), total: L.reduce((s, l) => s + Object.values(l.h || {}).reduce((a, b) => a + b, 0), 0),
    ret: L.reduce((s, l) => s + Object.values(l.r || {}).reduce((a, b) => a + b[0], 0), 0), ids: L.map(l => l.id).sort().join(',') } });
const own = d => d.page.evaluate(() => { const l = LG(); return { total: Object.values(l.h || {}).reduce((a, b) => a + b, 0), ret: Object.values(l.r || {}).reduce((a, b) => a + b[0], 0) } });

async function run(b) {
  const t = H.suite('Journaux : mises à jour visibles sur les autres appareils');
  const e = await M.setup({ browser: b }), { d1, d2 } = e;
  // première synchronisation d'un journal, puis mises à jour successives
  await H.rate(d1, 'pD', 'Q1', 3); await H.leave(d1); await e.both();
  let a = await cum(d2); t.ok(a.today === 1, 'première synchro : l\'appareil 2 voit la 1re révision', 'vu ' + a.today);
  await H.rate(d1, 'pD', 'Q2', 3); await H.rate(d1, 'pD', 'Q3', 4); await H.leave(d1); await e.both();
  a = await cum(d2); t.ok(a.today === 3, 'mise à jour suivante : l\'appareil 2 voit 3 révisions', 'vu ' + a.today);
  await H.rate(d2, 'pD', 'Q4', 3); await H.rateQ(d2, 'pB', 'QQ2', true); await H.leave(d2); await e.both();
  await H.rate(d1, 'pD', 'Q5', 1); await H.leave(d1); await e.both(3);
  const c1 = await cum(d1), c2 = await cum(d2), o1 = await own(d1), o2 = await own(d2);
  t.ok(c1.total === o1.total + o2.total && c2.total === c1.total, 'cumul des journaux identique sur les deux appareils et égal à la somme des journaux propres', 'd1 ' + c1.total + ', d2 ' + c2.total + ', somme ' + (o1.total + o2.total));
  t.ok(c1.ret === o1.ret + o2.ret && c2.ret === c1.ret, 'mémorisation réelle (r) : même cumul partout', 'd1 ' + c1.ret + ', d2 ' + c2.ret + ', somme ' + (o1.ret + o2.ret));
  t.ok(c1.today === 6 && c2.today === 6, '« révisions aujourd\'hui » (compteur des statistiques) = 6 sur les deux appareils', 'd1 ' + c1.today + ', d2 ' + c2.today);
  // l'appareil 2 reste hors ligne pendant plusieurs révisions de l'appareil 1, puis revient
  d2.offline = true; await H.rate(d1, 'pD', 'Q6', 3); await H.rate(d1, 'pD', 'Q7', 3); await H.leave(d1); await H.sync(d1);
  d2.offline = false; await e.both(3);
  t.ok((await cum(d2)).total === (await cum(d1)).total && (await cum(d2)).today === 8, 'appareil revenu après une période hors ligne : cumul à jour (8 aujourd\'hui)', JSON.stringify(await cum(d2)));
  // un journal n'est écrit que par son propriétaire : aucune écriture de l'appareil 2 sur log-dev1
  t.ok((await d2.page.evaluate(() => (G('log-dev1') || {}).h)) && JSON.stringify(await d2.page.evaluate(() => G('log-dev1').h)) === JSON.stringify(await d1.page.evaluate(() => G('log-dev1').h)), 'copie du journal de l\'appareil 1 sur l\'appareil 2 identique à l\'original');
  // drapeaux caché / épinglé : fusion inchangée pour les paquets (le drapeau voyage avec une mise à jour du nœud)
  await d1.page.evaluate(() => { const n = G('pD'); flagSet([n], 'h', 'hu', true, 'caché'); n.u = hlc(); save() }); await e.both(3);
  t.ok(await d2.page.evaluate(() => G('pD').h === 1 && G('pD').hu > 0), 'drapeau « caché » (avec mise à jour du paquet) propagé');
  await d2.page.evaluate(() => { const n = G('pD'); flagSet([n], 'h', 'hu', false, 'affiché'); n.u = hlc(); save() }); await e.both(3);
  t.ok(await d1.page.evaluate(() => G('pD').h === undefined), 'drapeau « caché » retiré : propagé aussi');
  // drapeau seul : corrigé le 23/10/2026 (voir t-drapeaux.js)
  await d1.page.evaluate(() => { flagSet([G('pC')], 'pn', 'pu', true, 'épinglé') }); await e.both(3);
  t.ok(await d2.page.evaluate(() => G('pC').pn === 1), 'drapeau « épinglé » seul propagé à l\'autre appareil');
  const n0 = e.srv.log.length; for (let k = 0; k < 5; k++) await e.both(1);
  t.ok(e.srv.log.length === n0, '10 synchros au repos : 0 écriture', (e.srv.log.length - n0) + ' écriture(s)');
  t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript', d1.errs.concat(d2.errs).join(' | '));
  await e.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
