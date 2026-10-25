// D4 : masquer, épingler et réordonner doivent se transmettre même quand c'est la SEULE modification du nœud
// (flagSet/applyOrder ne changent que hu/pu/ou, pas u ; l'envoi ne retenait que les nœuds dont u avait augmenté).
const H = require('./lib/h'), M = require('./lib/md');
const flags = (d, id) => d.page.evaluate(id => { const n = G(id); return { h: n.h || 0, pn: n.pn || 0, o: n.o === undefined ? null : n.o } }, id);
const J = x => JSON.stringify(x);

async function run(b) {
  const t = H.suite('Drapeaux caché / épinglé / ordre : transmission et convergence');
  const e = await M.setup({ browser: b }), { d1, d2 } = e;
  const w0 = () => e.srv.log.length;

  // 1) un seul drapeau change, rien d'autre
  const u0 = await d1.page.evaluate(() => G('pD').u);
  await d1.page.evaluate(() => flagSet([G('pD')], 'h', 'hu', true, 'caché')); await e.both(3);
  t.ok(J(await flags(d2, 'pD')) === J({ h: 1, pn: 0, o: null }), 'masquage seul : transmis à l\'autre appareil', J(await flags(d2, 'pD')));
  await d1.page.evaluate(() => flagSet([G('pC')], 'pn', 'pu', true, 'épinglé')); await e.both(3);
  t.ok((await flags(d2, 'pC')).pn === 1, 'épinglage seul : transmis');
  await d1.page.evaluate(() => { const g = kidsS('f1'); applyOrder([g[1], g[0]], 'ordre') }); await e.both(3);
  const o1 = await d1.page.evaluate(() => kidsS('f1').map(n => n.id).join()), o2 = await d2.page.evaluate(() => kidsS('f1').map(n => n.id).join());
  t.ok(o1 === o2 && (await flags(d2, 'f2')).o !== null, 'ordre seul : transmis, même ordre affiché partout', o1 + ' / ' + o2);
  t.ok((await d1.page.evaluate(() => G('pD').u)) === u0, 'le contenu (u) du paquet n\'a pas été modifié par un simple drapeau');
  // retirer un drapeau
  await d2.page.evaluate(() => flagSet([G('pD')], 'h', 'hu', false, 'affiché')); await e.both(3);
  t.ok((await flags(d1, 'pD')).h === 0, 'retrait du masquage seul : transmis dans l\'autre sens');

  // 2) deux appareils changent deux drapeaux différents du même nœud en même temps : les deux sont gardés
  d1.offline = d2.offline = true;
  await d1.page.evaluate(() => flagSet([G('pA')], 'h', 'hu', true, 'caché')); await d2.page.evaluate(() => flagSet([G('pA')], 'pn', 'pu', true, 'épinglé'));
  d1.offline = d2.offline = false; await e.both(3);
  t.ok(J(await flags(d1, 'pA')) === J(await flags(d2, 'pA')) && (await flags(d1, 'pA')).h === 1 && (await flags(d1, 'pA')).pn === 1, 'drapeaux différents sur le même paquet hors ligne : les deux conservés, appareils identiques', J(await flags(d1, 'pA')) + ' / ' + J(await flags(d2, 'pA')));

  // 3) même drapeau changé sur les deux appareils : le plus récent (hlc) l'emporte, partout
  d1.offline = d2.offline = true;
  await d1.page.evaluate(() => flagSet([G('pB')], 'h', 'hu', true, 'caché')); await new Promise(r => setTimeout(r, 20)); await d2.page.evaluate(() => flagSet([G('pB')], 'h', 'hu', false, 'affiché'));
  d1.offline = d2.offline = false; await e.both(3);
  t.ok((await flags(d1, 'pB')).h === 0 && (await flags(d2, 'pB')).h === 0, 'même drapeau modifié sur les deux appareils : le plus récent l\'emporte partout');

  // 4) période hors ligne : l'appareil 2 est hors ligne pendant que l'appareil 1 change plusieurs drapeaux, puis revient
  d2.offline = true;
  await d1.page.evaluate(() => { flagSet([G('pD')], 'pn', 'pu', true, 'épinglé'); flagSet([G('pC')], 'h', 'hu', true, 'caché') }); await H.sync(d1);
  await d2.page.evaluate(() => flagSet([G('pA')], 'h', 'hu', false, 'affiché'));
  d2.offline = false; await e.both(3);
  t.ok((await flags(d2, 'pD')).pn === 1 && (await flags(d2, 'pC')).h === 1 && (await flags(d1, 'pA')).h === 0, 'appareil revenu après une période hors ligne : changements reçus et envoyés');
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv), 'appareils et serveur identiques');
  // 5) pas d'envoi inutile, et un drapeau ne remet pas en cause le contenu d'un paquet modifié ailleurs
  await d2.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'Ajout D2', a: 'x' }); p.u = hlc(); save() }); await e.both(3);
  await d1.page.evaluate(() => flagSet([G('pD')], 'h', 'hu', true, 'caché')); await e.both(3);
  const pk = await H.pack(d2, 'pD');
  t.ok(pk.items.some(i => i.q == 'Ajout D2') && pk.h === 1 && e.srv.T.get('pD').data.items.some(i => i.q == 'Ajout D2'), 'drapeau posé après une modification de contenu ailleurs : contenu et drapeau conservés partout');
  const n0 = w0(); for (let k = 0; k < 5; k++) await e.both(1);
  t.ok(w0() === n0, '10 synchros au repos : 0 écriture', (w0() - n0) + ' écriture(s)');
  t.ok(!e.srv.log.some(l => l[0] == 'refus'), 'aucune écriture refusée par le serveur', e.srv.log.filter(l => l[0] == 'refus').map(l => l.join(' ')).join(' | '));
  t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript', d1.errs.concat(d2.errs).join(' | '));
  await e.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
