// Étape 4 (A5 + D1 + D2) : le mode examen alimente statistiques et journal mais ne touche jamais la planification FSRS,
// ni les horodatages (t) et auteurs (w) qui départagent les versions, ni directement ni par la synchro.
// Questions sans aucune bonne réponse : exclues du score et de tout comptage. « Refaire mes erreurs » reste une révision normale.
const H = require('./lib/h'), M = require('./lib/md');
const KEEP = ['st', 's', 'df', 'l', 'k', 'd', 'f', 't', 'w', 'g', 'n', 'm'];   // un examen ne doit modifier AUCUN de ces champs
const keep = items => JSON.stringify(items.map(i => KEEP.map(k => i[k] === undefined ? null : i[k])));
const evTot = items => items.reduce((a, i) => { for (const d in (i.ev || {})) { a[0] += i.ev[d][0]; a[1] += i.ev[d][1] } return a }, [0, 0]);

async function exam(d, answer) { // examen réel sur les QCM du dossier Anat
  await d.page.evaluate(() => { cur = nid('f2'); view = 'browse'; A.exs(); A.xgo() });
  await d.page.evaluate(src => { const f = eval(src); deck.items.forEach((it, j) => { const s = f(j, it, po(it)); if (s) ex.s[j] = s }); exSave() }, answer.toString());
}

async function run(b) {
  const t = H.suite('Étape 4 — examen sans effet sur FSRS, questions invalides, compteurs ev');
  const e = await M.setup({ browser: b }), { d1, d2 } = e;
  const items = d => H.pack(d, 'pB').then(p => p.items);
  const logN = d => d.page.evaluate(() => (LG().h || {})[day()] || 0);

  // 1) examen terminé : QQ1, QQ2 justes ; QQ3 fausse ; QQ4 valide laissée vide (= erreur) ; « QQ-sans-bonne » invalide laissée vide
  let i0 = await items(d1), l0 = await logN(d1);
  await exam(d1, (j, it, o) => it.q == 'QQ1' || it.q == 'QQ2' ? Object.fromEntries(o.map((x, k) => [k, !!x.k])) : it.q == 'QQ3' ? Object.fromEntries(o.map((x, k) => [k, !x.k])) : null);
  await d1.page.evaluate(() => A.xfin());
  let i1 = await items(d1), r = await d1.page.evaluate(() => ({ sc: ex.sc, bad: ex.bad.length, inv: ex.inv.length, html: document.querySelector('#app').innerText }));
  t.ok(keep(i0) === keep(i1), 'examen terminé : FSRS (st, s, df, l, k, d, f), t, w et les anciens n, m strictement inchangés');
  t.ok(evTot(i1)[0] - evTot(i0)[0] === 4 && evTot(i1)[1] - evTot(i0)[1] === 2, 'compteurs ev : 4 réponses, 2 erreurs (la question valide laissée vide compte comme erreur)', JSON.stringify(evTot(i1)));
  t.ok(r.sc === 2 && r.bad === 2 && r.inv === 1 && /Score : 2 \/ 4/.test(r.html) && /50 %/.test(r.html), 'score 2 / 4 : la question sans bonne réponse est exclue du dénominateur', r.html.slice(0, 120).replace(/\n/g, ' '));
  t.ok(await logN(d1) - l0 === 4, 'journal du jour +4 (aucune entrée pour la question invalide)', '+' + (await logN(d1) - l0));
  t.ok(!(i1.find(i => i.q == 'QQ-sans-bonne').ev) && /Questions mal configurées/.test(r.html) && /Révision normale : tes réponses mettent à jour ton planning\./.test(r.html), 'question invalide : aucune écriture ; récapitulatif « mal configurée » ; mention sous « Refaire mes erreurs » (D1)');
  // bouton « Signaler à corriger » : le drapeau n'est posé que sur action explicite
  t.ok(!(await items(d1)).some(i => i.fx), 'aucun drapeau « À corriger » posé automatiquement à la fin de l\'examen');
  await d1.page.evaluate(() => document.querySelector('[data-a="xfx"]').click());
  t.ok((await items(d1)).find(i => i.q == 'QQ-sans-bonne').fx === 1 && keep(i1) === keep(await items(d1)), 'bouton « Signaler à corriger » : drapeau posé, rien d\'autre modifié');

  // 2) examen interrompu puis repris après la fin du chronomètre : clôturé, non-réponses valides = erreurs, invalide exclue
  i0 = await items(d1); const a0 = evTot(i0);
  await exam(d1, () => null);
  await d1.page.evaluate(() => { const o = JSON.parse(localStorage.getItem('revis-exam')); o.end = Date.now() - 1000; localStorage.setItem('revis-exam', JSON.stringify(o)); view = 'browse'; ex = null; render(); A.xres() });
  i1 = await items(d1);
  t.ok(keep(i0) === keep(i1), 'examen expiré puis repris : FSRS, t, w, n, m inchangés');
  t.ok(evTot(i1)[0] - a0[0] === 4 && evTot(i1)[1] - a0[1] === 4, 'examen expiré : 4 non-réponses valides comptées comme erreurs, question invalide exclue', JSON.stringify([evTot(i1)[0] - a0[0], evTot(i1)[1] - a0[1]]));
  await e.both(3);
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'les deux appareils convergent après les examens');

  // 3) synchro : l'appareil 2 révise QQ3 (FSRS) ; l'appareil 1, hors ligne et non synchronisé, passe un examen
  d1.offline = true;
  await H.rateQ(d2, 'pB', 'QQ3', true); await H.leave(d2); await H.sync(d2);   // (l'appareil 2 quitte la séance : un paquet ouvert en séance ignore le contenu reçu, anomalie A1 ouverte)
  const ref = await H.item(d2, 'pB', 'QQ3'), ev0 = evTot(await items(d1));
  await new Promise(r => setTimeout(r, 30));
  await exam(d1, (j, it, o) => Object.fromEntries(o.map((x, k) => [k, !!x.k]))); await d1.page.evaluate(() => A.xfin());
  d1.offline = false; await e.both(3);
  const x1 = await H.item(d1, 'pB', 'QQ3'), x2 = await H.item(d2, 'pB', 'QQ3');
  t.ok(H.fsr(x1) === H.fsr(ref) && H.fsr(x2) === H.fsr(ref) && x1.t === ref.t && x1.w === ref.w && x1.n === ref.n, 'synchro : la révision FSRS de l\'autre appareil (planification, t, w, n) n\'est pas effacée par l\'examen', 'attendu ' + H.fsr(ref) + ' / d1 ' + H.fsr(x1));
  t.ok(evTot(await items(d2))[0] - ev0[0] === 4 && evTot(await items(d1))[0] === evTot(await items(d2))[0], 'les compteurs ev de l\'examen arrivent sur l\'autre appareil');
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'les deux appareils convergent');

  await H.leave(d1); await d1.page.waitForTimeout(300);
  // 4) tout est invalide : « Aucune question notée », sans division par zéro
  await d1.page.evaluate(() => { const p = G('pB'); G('pB').items.forEach(i => { i.o.forEach(o => { o.k = false }) }); p.u = hlc(); save() });
  await exam(d1, () => null); await d1.page.evaluate(() => A.xfin());
  const z = await d1.page.evaluate(() => ({ t: document.querySelector('#app').innerText, sc: ex.sc }));
  t.ok(/Aucune question notée/.test(z.t) && !/NaN|Infinity/.test(z.t), '« Aucune question notée » sans NaN ni division par zéro');

  await H.leave(d1); await d1.page.waitForTimeout(300);
  // 5) « Refaire mes erreurs » : révision classique, chemin FSRS normal, effets exacts
  await d1.page.evaluate(() => { const p = G('pB'); p.items.forEach(i => i.o.forEach((o, k) => { o.k = k < 2 })); p.u = hlc(); save() });
  await exam(d1, (j, it, o) => Object.fromEntries(o.map((x, k) => [k, !x.k]))); await d1.page.evaluate(() => A.xfin());
  // carte déterministe : QQ1 (déjà en révision), pas une carte tirée au hasard
  const q0 = await d1.page.evaluate(() => { A.xredo(); idx = order.indexOf(deck.items.findIndex(x => x.q == 'QQ1')); return deck.items[order[idx]].q }), before = await H.item(d1, 'pB', q0), evB = JSON.stringify(before.ev);
  const planned = await d1.page.evaluate(q => { const it = deck.items.find(x => x.q == q); return opts(it)[2] }, q0);   // ce que le chemin FSRS normal doit appliquer pour une bonne réponse
  await d1.page.evaluate(() => { const it = deck.items[order[idx]]; sel = {}; po(it).forEach((x, k) => { if (x.k) sel[k] = true }); A.val() });
  const after = await H.item(d1, 'pB', q0);
  t.ok(after.n === (before.n || 0) + 1 && after.m === before.m, '« Refaire mes erreurs » : n augmente exactement de 1 (m inchangé : réponse juste)', 'n ' + before.n + ' → ' + after.n);
  t.ok(after.t > before.t && after.w === 'dev1', '« Refaire mes erreurs » : t strictement supérieur et w = appareil (version nouvelle)', 't ' + before.t + ' → ' + after.t);
  t.ok(after.s !== before.s && after.d !== before.d && after.s === +planned.s.toFixed(4) && after.st === planned.st, '« Refaire mes erreurs » : s et d changent exactement comme le prévoit le calcul FSRS normal (opts « Bien »)', 's ' + before.s + ' → ' + after.s + ' (attendu ' + planned.s.toFixed(4) + '), d ' + before.d + ' → ' + after.d);
  t.ok(JSON.stringify(after.ev) === evB, '« Refaire mes erreurs » : les compteurs d\'examen ev ne bougent pas (la réponse est une révision, pas un examen)');
  t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript', d1.errs.concat(d2.errs).join(' | '));
  await e.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
