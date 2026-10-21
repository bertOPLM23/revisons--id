// A3 : « Annuler la dernière note » et « J'ai hésité » doivent résister à l'écho d'un envoi précédent.
const H = require('./lib/h'), M = require('./lib/md');
const fsr = H.fsr;

async function run(b) {
  const t = H.suite('A3 — annulation et « J\'ai hésité » face à la synchro');
  const e = await M.setup({ browser: b }), { d1, d2 } = e;
  const log = d => d.page.evaluate(() => (LG().h || {})[day()] || 0);

  // 1) annulation : témoin QJ1 (aucune synchro entre les gestes) et essai QJ2 (la synchro passe entre chaque geste)
  d2.offline = true; // l'appareil 2 ne participe pas à cette partie
  const l0 = await log(d1);
  await H.rate(d1, 'pA', 'QJ1', 4); await d1.page.evaluate(() => A.rundo()); await H.rate(d1, 'pA', 'QJ1', 1);
  await H.rate(d1, 'pA', 'QJ2', 4); await H.sync1(d1); await d1.page.evaluate(() => A.rundo()); await H.sync1(d1); await H.rate(d1, 'pA', 'QJ2', 1);
  await H.sync(d1);
  const j1 = await H.item(d1, 'pA', 'QJ1'), j2 = await H.item(d1, 'pA', 'QJ2');
  t.ok(fsr(j1) === fsr(j2) && j1.n === j2.n && j1.m === j2.m, 'annuler puis renoter : même résultat FSRS avec ou sans synchro entre les gestes', 'témoin ' + fsr(j1) + ' n=' + j1.n + ' / essai ' + fsr(j2) + ' n=' + j2.n);
  t.ok(await log(d1) - l0 === 2, 'journal : 1 révision par carte (2 au total), les notes annulées ne comptent pas', 'compté : ' + (await log(d1) - l0));
  // annulation sans renoter : l'état d'avant doit tenir après plusieurs synchros
  const q8 = await H.item(d1, 'pA', 'Q8');
  await H.rate(d1, 'pA', 'Q8', 3); await H.sync1(d1); await d1.page.evaluate(() => A.rundo());
  await d1.page.evaluate(() => { G('pA').u = Date.now(); save() }); await H.sync(d1);
  t.ok(fsr(await H.item(d1, 'pA', 'Q8')) === fsr(q8), 'annulation conservée après l\'écho de la note envoyée', fsr(q8) + ' → ' + fsr(await H.item(d1, 'pA', 'Q8')));

  // 2) « J'ai hésité » sur un seul appareil : bonne réponse envoyée, puis hésitation, puis l'écho revient
  let kept = 0; const qs = ['QQ1', 'QQ2', 'QQ3', 'QQ4'];
  for (const qq of qs) {
    await H.rateQ(d1, 'pB', qq, true); await H.sync1(d1);
    await d1.page.evaluate(() => A.hes()); const h = await H.item(d1, 'pB', qq);
    await d1.page.evaluate(() => { G('pB').u = Date.now(); save() }); await H.sync1(d1); await H.sync1(d1);
    if (fsr(await H.item(d1, 'pB', qq)) === fsr(h)) kept++;
  }
  t.ok(kept === qs.length, '« J\'ai hésité » conservé après l\'écho (1 appareil)', kept + ' / ' + qs.length);

  // 3) deux appareils : l'hésitation de l'appareil 1 doit arriver sur l'appareil 2
  d2.offline = false; await e.both();
  await H.rateQ(d1, 'pB', 'QQ2', true); await e.both();
  await d1.page.evaluate(() => A.hes()); const h1 = await H.item(d1, 'pB', 'QQ2');
  await H.rateQ(d1, 'pB', 'QQ3', true); await e.both(3);
  t.ok(fsr(await H.item(d2, 'pB', 'QQ2')) === fsr(h1) && fsr(await H.item(d1, 'pB', 'QQ2')) === fsr(h1), '« J\'ai hésité » propagé à l\'autre appareil et conservé', fsr(h1) + ' / d2 ' + fsr(await H.item(d2, 'pB', 'QQ2')));
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'les deux appareils convergent');

  // 4) marqueurs de version : l'hésitation et l'annulation créent une version nouvelle (t, w, u), jamais un retour en arrière
  await H.rateQ(d1, 'pB', 'QQ1', true); await e.both();
  const a0 = await H.item(d1, 'pB', 'QQ1'), u0 = (await H.pack(d1, 'pB')).u, sv0 = e.srv.T.get('pB').u;
  await d1.page.evaluate(() => A.hes()); const a1 = await H.item(d1, 'pB', 'QQ1'), u1 = (await H.pack(d1, 'pB')).u;
  t.ok(a1.t > a0.t && a1.w === 'dev1' && u1 > u0 && u1 > sv0 && a1.n === a0.n, '« J\'ai hésité » : nouveau t, w = appareil, u du paquet > version serveur, n inchangé (une seule réponse)');
  await H.rate(d1, 'pA', 'Q1', 3); const r1 = await H.item(d1, 'pA', 'Q1'), ru1 = (await H.pack(d1, 'pA')).u, lu1 = await d1.page.evaluate(() => LG().u);
  await d1.page.evaluate(() => A.rundo()); const r2 = await H.item(d1, 'pA', 'Q1'), ru2 = (await H.pack(d1, 'pA')).u, lu2 = await d1.page.evaluate(() => LG().u);
  t.ok(r2.t > r1.t && r2.w === 'dev1' && ru2 > ru1 && lu2 > lu1, 'Annuler : t de la carte, u du paquet et u du journal avancent (aucun recul)');

  // 5) l'annulation ne retire que la note annulée : une note antérieure reste, avec son entrée de journal
  await H.leave(d1); await e.both();
  const g0 = await log(d1), q2a = await H.item(d1, 'pA', 'Q2'), q3a = await H.item(d1, 'pA', 'Q3');
  await d1.page.evaluate(() => { deck = G('pA'); view = 'study'; const i2 = deck.items.findIndex(x => x.q == 'Q2'), i3 = deck.items.findIndex(x => x.q == 'Q3'); q = [i2, i3]; tot = 2; known = 0; back = true; order = []; A.rate(3); back = true; A.rate(4); window.__rated = JSON.parse(JSON.stringify(G('pA'))); A.rundo() });
  const q2b = await H.item(d1, 'pA', 'Q2'), q3b = await H.item(d1, 'pA', 'Q3');
  t.ok(H.fsr(q3b) === H.fsr(q3a) && q3b.n === q3a.n, 'note annulée (Q3) : état FSRS et n d\'avant la note');
  t.ok(H.fsr(q2b) !== H.fsr(q2a) && q2b.n === (q2a.n || 0) + 1, 'note antérieure (Q2) : conservée');
  t.ok(await log(d1) - g0 === 1, 'journal : seule l\'entrée de la note annulée est retirée (+1 au lieu de +2)', 'écart ' + (await log(d1) - g0));
  // 6) un écho ancien (paquet contenant la note annulée) injecté dans la réponse du serveur ne la rétablit pas
  // l'écho = le paquet tel qu'il était juste après la note de Q3 (vrai t de la note), comme si cet envoi revenait en retard
  const echo = await d1.page.evaluate(() => window.__rated);
  await H.leave(d1); e.srv.inject.push(echo); await e.both(2);
  t.ok(H.fsr(await H.item(d1, 'pA', 'Q3')) === H.fsr(q3a) && H.fsr(await H.item(d2, 'pA', 'Q3')) === H.fsr(q3a), 'écho ancien injecté : la note annulée ne revient ni sur l\'appareil 1 ni sur l\'appareil 2');
  t.ok(H.fsr(await H.item(d2, 'pA', 'Q2')) === H.fsr(q2b), 'note antérieure (Q2) propagée à l\'appareil 2');

  // 7) séquence mixte sur deux appareils : notes, hésitations, annulations, puis synchro → cohérence progression / journal
  const sum = async d => d.page.evaluate(() => S.nodes.filter(n => n.k == 'fc' || n.k == 'qcm').flatMap(n => n.items).reduce((a, i) => a + (i.n || 0), 0));
  // journal de chaque appareil lu chez son propriétaire (voir plus bas : les autres appareils n'en voient pas les mises à jour, défaut préexistant)
  const own = d => d.page.evaluate(() => Object.values(LG().h || {}).reduce((x, y) => x + y, 0));
  const tot = async () => (await own(d1)) + (await own(d2));
  const n0 = await sum(d1), l0b = await tot();
  for (const [d, qq, g, und] of [[d1, 'Q10', 3, false], [d2, 'Q11', 1, false], [d1, 'Q12', 4, true], [d2, 'Q13', 3, true], [d1, 'Q14', 2, false]]) {
    await H.rate(d, 'pD', qq, g); if (und) await d.page.evaluate(() => A.rundo()); await H.leave(d); await H.sync1(d);
  }
  await H.rateQ(d2, 'pB', 'QQ4', true); await d2.page.evaluate(() => A.hes()); await H.leave(d2);
  await e.both(3);
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv), 'séquence mixte : appareils et serveur identiques');
  t.ok((await sum(d1)) - n0 === 4 && (await tot()) - l0b === 4, 'séquence mixte : 4 réponses gardées = +4 dans les n des cartes = +4 dans les journaux', 'n +' + ((await sum(d1)) - n0) + ', journaux +' + ((await tot()) - l0b));
  const sj = id => Object.values((e.srv.T.get(id) || { data: {} }).data.h || {}).reduce((x, y) => x + y, 0);
  t.ok(sj('log-dev1') === await own(d1) && sj('log-dev2') === await own(d2), 'journaux sur le serveur = journaux de leurs appareils');
  const seen = await d1.page.evaluate(() => Object.values((G('log-dev2') || {}).h || {}).reduce((x, y) => x + y, 0));
  t.known(seen === await own(d2), 'journal de l\'appareil 2 vu par l\'appareil 1 (défaut préexistant : fixHide() traite le champ h du journal comme le drapeau « caché », la copie reste figée)', 'vu par d1 : ' + seen + ', réel : ' + await own(d2));
  const n1 = e.srv.log.length; for (let k = 0; k < 5; k++) await e.both(1);
  t.ok(e.srv.log.length === n1, '10 synchros au repos : 0 écriture', (e.srv.log.length - n1) + ' écriture(s)');
  t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript', d1.errs.concat(d2.errs).join(' | '));
  await e.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
