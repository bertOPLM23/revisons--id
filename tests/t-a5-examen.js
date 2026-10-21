// A5 : le mode examen alimente les statistiques et le journal, mais ne touche jamais la planification FSRS,
// ni directement ni par la synchro (un résultat d'examen ne doit pas remplacer une progression FSRS faite ailleurs).
const H = require('./lib/h'), M = require('./lib/md');
const PLAN = ['st', 's', 'df', 'l', 'k', 'd', 'f', 't', 'w', 'g'];
const plan = items => JSON.stringify(items.map(i => PLAN.map(k => i[k] === undefined ? null : i[k])));
const tot = items => items.reduce((a, i) => [a[0] + (i.n || 0) + (i.en || 0), a[1] + (i.m || 0) + (i.em || 0)], [0, 0]);

async function exam(d, answer) { // examen réel sur les QCM du dossier Anat ; answer(j, it) → sélection
  await d.page.evaluate(() => { cur = nid('f2'); view = 'browse'; A.exs(); A.xgo() });
  await d.page.evaluate(src => { const f = eval(src); deck.items.forEach((it, j) => { const s = f(j, it, po(it)); if (s) ex.s[j] = s }); exSave() }, answer.toString());
}

async function run(b) {
  const t = H.suite('A5 — mode examen sans effet sur FSRS');
  const e = await M.setup({ browser: b }), { d1, d2 } = e;
  const items = d => H.pack(d, 'pB').then(p => p.items);
  const logN = d => d.page.evaluate(() => (LG().h || {})[day()] || 0);

  // 1) examen terminé normalement : QQ1, QQ2 justes, QQ3 fausse, QQ4 sans réponse, question sans bonne réponse laissée vide (comptée juste)
  let i0 = await items(d1), l0 = await logN(d1);
  await exam(d1, (j, it, o) => it.q == 'QQ1' || it.q == 'QQ2' ? Object.fromEntries(o.map((x, k) => [k, !!x.k])) : it.q == 'QQ3' ? Object.fromEntries(o.map((x, k) => [k, !x.k])) : null);
  await d1.page.evaluate(() => A.xfin());
  let i1 = await items(d1);
  t.ok(plan(i0) === plan(i1), 'examen terminé : aucun champ de planification FSRS modifié (st, s, df, l, k, d, f, t)');
  const a = tot(i0), c = tot(i1);
  t.ok(c[0] - a[0] === 5 && c[1] - a[1] === 2, 'examen terminé : 5 réponses et 2 erreurs comptées dans les statistiques (non-réponses = erreurs)', 'réponses +' + (c[0] - a[0]) + ', erreurs +' + (c[1] - a[1]));
  t.ok(await logN(d1) - l0 === 5, 'examen terminé : journal du jour +5', '+' + (await logN(d1) - l0));

  // 2) examen interrompu puis repris après la fin du chronomètre : clôturé, non-réponses = erreurs, FSRS intact
  i0 = await items(d1);
  await exam(d1, () => null);
  await d1.page.evaluate(() => { const o = JSON.parse(localStorage.getItem('revis-exam')); o.end = Date.now() - 1000; localStorage.setItem('revis-exam', JSON.stringify(o)); view = 'browse'; ex = null; render(); A.xres() });
  i1 = await items(d1);
  t.ok(plan(i0) === plan(i1), 'examen expiré puis repris : planification FSRS inchangée');
  t.ok(tot(i1)[1] - tot(i0)[1] === 4, 'examen expiré : les 4 non-réponses comptées comme erreurs (la question sans bonne réponse compte juste, comportement actuel)', 'erreurs +' + (tot(i1)[1] - tot(i0)[1]));
  await e.both();

  // 3) synchro : l'appareil 2 révise QQ3 avec FSRS ; l'appareil 1, pas encore synchronisé, passe ensuite un examen
  d1.offline = true;
  await H.rateQ(d2, 'pB', 'QQ3', true); await H.sync(d2);
  const ref = await H.item(d2, 'pB', 'QQ3');
  await new Promise(r => setTimeout(r, 30));
  await exam(d1, () => null); await d1.page.evaluate(() => A.xfin());
  d1.offline = false; await e.both(3);
  const x1 = await H.item(d1, 'pB', 'QQ3'), x2 = await H.item(d2, 'pB', 'QQ3');
  t.ok(H.fsr(x1) === H.fsr(ref) && H.fsr(x2) === H.fsr(ref), 'synchro : la révision FSRS de l\'autre appareil n\'est pas effacée par l\'examen', 'attendu ' + H.fsr(ref) + ' / d1 ' + H.fsr(x1) + ' / d2 ' + H.fsr(x2));
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'les deux appareils convergent');
  t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript', d1.errs.concat(d2.errs).join(' | '));
  await e.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
