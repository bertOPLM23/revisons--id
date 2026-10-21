// A4 : un QCM sans aucune case cochée ne doit jamais être validé (bouton, Entrée, double-tap, appel direct),
// et rien ne doit changer dans les données. Une question importée sans bonne réponse peut être passée sans rien enregistrer.
const H = require('./lib/h'), D = require('./lib/data'), M = require('./lib/md');

async function run(b) {
  const t = H.suite('A4 — QCM sans réponse');
  const d = await H.device(b, { seed: D.mk(H.dayNow()), cfg: { srs: true, nl: 20, nx: true }, dev: 'dev1' }), p = d.page;
  const snap = () => p.evaluate(() => { let nw = null; try { nw = localStorage.getItem('revis-new') } catch (e) {} return JSON.stringify([S.nodes, nw]) });
  const start = i => p.evaluate(i => { cur = nid('f2'); deck = G('pB'); view = 'study'; nodue = false; startQ([i]) }, i);
  const st = () => p.evaluate(() => ({ val, idx }));
  const ways = [
    ['double-tap de fond', async () => { await p.mouse.click(30, 700); await p.waitForTimeout(60); await p.mouse.click(30, 700); await p.waitForTimeout(200) }],
    ['touche Entrée', async () => { await p.keyboard.press('Enter'); await p.waitForTimeout(100) }],
    ['clic sur Valider', async () => { await p.evaluate(() => { const b = document.querySelector('.dock [data-a="val"]'); if (b) b.click() }); await p.waitForTimeout(100) }],
    ['appel direct de A.val()', async () => { await p.evaluate(() => { try { A.val() } catch (e) {} }) }]];
  for (const [nm, act] of ways) {
    await start(0); const s0 = M.canon(JSON.parse(await snap()));
    await act();
    t.ok(!(await st()).val && M.canon(JSON.parse(await snap())) === s0, nm + ' sans case cochée : refusé, aucune donnée modifiée (cartes, progression, journal, limite du jour)');
  }
  // contrôle : avec une case cochée, la validation fonctionne toujours
  await start(0); await p.evaluate(() => { sel = { 0: true }; A.val() });
  t.ok((await st()).val, 'avec une case cochée : validation normale');
  // question importée sans aucune bonne réponse : « Passer » sans écriture
  await start(4); const s1 = M.canon(JSON.parse(await snap()));
  await p.evaluate(() => { try { A.val() } catch (e) {} });
  t.ok(!(await st()).val, 'question sans bonne réponse : validation refusée elle aussi');
  const skip = await p.evaluate(() => !!document.querySelector('[data-a="qskip"]'));
  t.ok(skip, 'question sans bonne réponse : bouton « Passer » proposé');
  if (skip) { await p.evaluate(() => document.querySelector('[data-a="qskip"]').click()); t.ok((await st()).idx === 1, '« Passer » avance à la suite') }
  t.ok(M.canon(JSON.parse(await snap())) === s1, 'question passée : aucune donnée modifiée');
  t.ok(!d.errs.length, 'aucune erreur JavaScript', d.errs.join(' | '));
  await d.ctx.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
