// Plafond d'examen à J-8 (25/10/2026) : une carte en révision n'est jamais planifiée après J-8 de l'examen ; les cartes déjà planifiées
// plus tard sont ramenées à J-8 (les plus faciles avancées si un jour est trop chargé) ; dans les 8 derniers jours, plus rien n'est planifié.
// Seule i.d change : s, df, l, t et le contenu restent intacts ; les deux appareils convergent sans écriture au repos.
const H = require('./lib/h'), M = require('./lib/md');
const KEEP = ['st', 's', 'df', 'l', 'k', 't', 'w', 'n', 'm', 'q'];
const prog = d => d.page.evaluate(KEEP => S.nodes.filter(n => n.k == 'fc' || n.k == 'qcm').flatMap(p => p.items.map(i => [p.id, i.q, KEEP.map(k => i[k] === undefined ? null : i[k]), i.d])), KEEP);
const keepOnly = rows => JSON.stringify(rows.map(r => [r[0], r[1], r[2]]));
const dates = rows => rows.map(r => r[3]);

async function run(b) {
  const t = H.suite('Plafond d\'examen à J-8 : plafond, répartition, fenêtre des 8 derniers jours, convergence');
  const e = await M.setup({ browser: b }), { d1, d2, T } = e;
  const w0 = () => e.srv.log.length;
  const setExam = (d, n) => d.page.evaluate(n => { const o = optMk(); o.xd = day() + n; o.u = hlc(); save(); render() }, n);

  // 1) examen dans 30 jours : J-8 = aujourd'hui + 22 ; on place des cartes bien au-delà
  const far = d => d.page.evaluate(() => { S.nodes.filter(n => n.k == 'fc' || n.k == 'qcm').forEach(p => p.items.forEach(i => { if (i.st == 2) i.d = day() + 90 })); render() });
  await far(d1); await far(d2);
  const before1 = await prog(d1);
  await setExam(d1, 30); await e.both(3);
  const a1 = await prog(d1), a2 = await prog(d2);
  const st2 = rows => rows.filter(r => r[2][0] === 2);   // st
  t.ok(st2(a1).length > 3 && st2(a1).every(r => r[3] <= T + 22), 'examen à 30 jours : aucune carte en révision après J-8 (appareil 1)', Math.max(...st2(a1).map(r => r[3] - T)));
  t.ok(st2(a2).every(r => r[3] <= T + 22), 'même plafond sur l\'appareil 2 (règle appliquée aussi après la synchro)', Math.max(...st2(a2).map(r => r[3] - T)));
  t.ok(keepOnly(a1) === keepOnly(before1), 's, df, l, k, t, w, n, m et question : strictement inchangés (seule la date d change)');
  t.ok(a1.filter(r => r[2][0] !== 2).every((r, k) => true) && JSON.stringify(a1.filter(r => r[2][0] !== 2).map(r => r[3])) === JSON.stringify(before1.filter(r => r[2][0] !== 2).map(r => r[3])), 'cartes nouvelles, en apprentissage et jamais vues : dates inchangées');
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'les deux appareils sont identiques (le plafond est calculé localement, le serveur garde les dates d\'origine)');
  const n0 = w0(); for (let k = 0; k < 5; k++) await e.both(1);
  t.ok(w0() === n0, '10 synchros au repos : 0 écriture', (w0() - n0) + ' écriture(s)');

  // 2) fenêtre des 8 derniers jours : examen dans 5 jours
  const bw = await prog(d1);
  await setExam(d1, 5); await e.both(3);
  const w1 = await prog(d1);
  t.ok(dates(w1).join() === dates(bw).join(), 'examen dans 5 jours (fenêtre) : les dates ne sont plus touchées');
  const r = await d1.page.evaluate(() => { const i = S.nodes.find(n => n.id == 'pA').items.find(i => i.st == 2); const P = opts(i); return { iv: P.map(p => p.iv == null ? 'm' + p.m : p.iv), av: P.map(p => !!p.av), txt: P.map(ivTxt) } });
  t.ok(r.av.slice(1).every(Boolean) && r.txt.slice(1).every(x => x === 'Dispo.') && r.iv[1] === 0, 'boutons Difficile/Bien/Facile : « Dispo. » (iv 0)', JSON.stringify(r));
  await d1.page.evaluate(() => { const p = G('pA'), i = p.items.find(i => i.st == 2 && i.d <= day() + 30); applyP(i, opts(i)[2]); i.t = hlc(); p.u = hlc(); save() }); await e.both(3);
  const after = await d1.page.evaluate(() => { const p = G('pA'); const i = p.items.find(i => i.l == day() && i.st == 2); return i ? { d: i.d - day(), l: i.l - day() } : null });
  t.ok(after && after.d <= 0 && after.l === 0, 'carte notée dans la fenêtre : reste disponible (date <= aujourd\'hui), dernière révision = aujourd\'hui', JSON.stringify(after));
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'les deux appareils sont identiques après une note dans la fenêtre');

  // 3) examen passé ou retiré : rien de plus n'est touché
  const bp = await prog(d1);
  await d1.page.evaluate(() => { const o = optMk(); o.xd = day() - 2; o.u = hlc(); save(); render() }); await e.both(3);
  t.ok(dates(await prog(d1)).join() === dates(bp).join(), 'examen passé : plus aucun plafond, dates inchangées');

  // 4) répartition : trop de cartes un même jour
  await d1.page.evaluate(() => { const p = G('pA'); p.items = Array.from({ length: 120 }, (_, k) => ({ q: 'R' + k, a: 'x', st: 2, s: 20, df: 1 + (k % 9), l: day() - 5, d: day() + 60, n: 3, m: 0, t: 1e12 + k })); p.u = hlc(); const o = optMk(); o.xd = day() + 30; o.u = hlc(); save(); render() }); await e.both(3);
  const by = await d1.page.evaluate(() => { const o = {}; G('pA').items.forEach(i => { const k = i.d - day(); (o[k] = o[k] || []).push(i.df) }); return o });
  const days = Object.keys(by).map(Number).sort((a, b) => b - a), L = await d1.page.evaluate(() => capLimit());
  t.ok(days[0] === 22 && Math.max(...Object.values(by).map(v => v.length)) <= L && days.length >= 3, 'répartition : au plus L cartes par jour, à partir de J-8', JSON.stringify(days.map(k => k + ':' + by[k].length)) + ' L=' + L);
  t.ok(Math.min(...by[days[0]]) >= Math.max(...by[days[days.length - 1]]) - 1, 'les plus difficiles restent le plus près de l\'examen, les plus faciles sont avancées', JSON.stringify(days.map(k => k + ':df ' + Math.min(...by[k]) + '-' + Math.max(...by[k]))));
  t.ok(days[days.length - 1] >= 0, 'jamais avant aujourd\'hui');
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'les deux appareils sont identiques après la répartition');
  const n1 = w0(); for (let k = 0; k < 5; k++) await e.both(1);
  t.ok(w0() === n1, '10 synchros au repos : 0 écriture après la répartition', (w0() - n1) + ' écriture(s)');
  t.ok(!e.srv.log.some(l => l[0] == 'refus'), 'aucune écriture refusée par le serveur');
  t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript', d1.errs.concat(d2.errs).join(' | '));
  await e.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
