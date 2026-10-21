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
  t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript', d1.errs.concat(d2.errs).join(' | '));
  await e.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
