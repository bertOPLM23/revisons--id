// Glisser-déposer en vue Colonnes (26/10/2026, demande d'Idriss) : déposer dans un dossier d'une colonne, survol 1 s qui ouvre la colonne suivante,
// lâcher dans le vide d'une colonne = son dossier, réordonner en tri manuel ; coin inférieur droit de la pile sous le pointeur. Souris (grand écran).
const H = require('./lib/h'), D = require('./lib/data');

async function run(b) {
  const t = H.suite('Glisser-déposer : vue Colonnes');
  const d = await H.device(b, { seed: D.mk(H.dayNow()), cfg: { srs: true, nl: 20, nx: true, vw: 'cols' }, dev: 'dev1' }), p = d.page;
  await p.setViewportSize({ width: 1440, height: 900 });
  const setup = so => p.evaluate(so => { ['zA', 'zB', 'zD', 'zq', 'zq1', 'zq2', 'zq3'].forEach(id => { const i = S.nodes.findIndex(n => n.id == id); if (i >= 0) S.nodes.splice(i, 1) }); const u = hlc();
    S.nodes.push({ id: 'zA', p: 0, k: 'f', name: 'Alpha', u }, { id: 'zB', p: 'zA', k: 'f', name: 'Bêta', u }, { id: 'zD', p: 0, k: 'f', name: 'Delta', u }, { id: 'zq', p: 0, k: 'fc', name: 'Paquet zéro', u, items: [{ q: 'a', a: 'b' }] },
      { id: 'zq1', p: 'zD', k: 'fc', name: 'Un', u, items: [] }, { id: 'zq2', p: 'zD', k: 'fc', name: 'Deux', u, items: [] }, { id: 'zq3', p: 'zD', k: 'fc', name: 'Trois', u, items: [] });
    cfg.vw = 'cols'; cfg.so = so || 'name'; A.cd(0) }, so);
  const cw = (id, fy = .5) => p.evaluate(([id, fy]) => { const e = document.querySelector(`#app #cols .cw[data-v="${id}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width * .35), y: Math.round(r.y + r.height * fy) } }, [id, fy]);
  const pick = async a => { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 8, a.y + 8, { steps: 2 }) };
  const P = id => p.evaluate(id => G(id).p, id);
  await setup(); await p.waitForTimeout(250);
  t.ok(await p.evaluate(() => !!document.querySelector('#app #cols .cw[data-v="zq"]')), 'vue Colonnes affichée');
  let a = await cw('zq'); await pick(a); await p.mouse.move(a.x + 30, a.y + 10, { steps: 3 });
  const gp = await p.evaluate(([x, y]) => { const g = document.querySelector('body>.ghost'); if (!g) return null; const r = g.getBoundingClientRect(); return { b: r.bottom, r: r.right, l: r.left, x, y } }, [a.x + 30, a.y + 10]);
  t.ok(gp && Math.abs(gp.b - gp.y) <= 8 && (Math.abs(gp.r - gp.x) <= 8 || gp.l <= 9), 'glisser lancé, coin inférieur droit de la pile sous le pointeur', JSON.stringify(gp));
  await p.mouse.move((await cw('zD')).x, (await cw('zD')).y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
  t.ok((await P('zq')) == 'zD', 'lâché sur un dossier d\'une colonne : déplacé dedans');
  await setup(); await p.waitForTimeout(250); a = await cw('zq'); await pick(a); const z = await cw('zA'); await p.mouse.move(z.x, z.y, { steps: 6 }); await p.waitForTimeout(1250);
  t.ok((await p.evaluate(() => cur)) == 'zA', 'survol 1 s d\'un dossier : sa colonne s\'ouvre');
  const zb = await cw('zB'); await p.mouse.move(zb.x + 10, zb.y - 12, { steps: 2 }); await p.mouse.move(zb.x, zb.y, { steps: 3 }); await p.waitForTimeout(1250);
  t.ok((await p.evaluate(() => cur)) == 'zB', 'survol d\'un sous-dossier : colonne suivante ouverte');
  const e3 = await p.evaluate(() => { const c = [...document.querySelectorAll('#app #cols .col')][2]; const r = c.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.bottom - 30) } });
  await p.mouse.move(e3.x, e3.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
  t.ok((await P('zq')) == 'zB', 'lâché dans le vide d\'une colonne : dans le dossier de cette colonne');
  await setup('manual'); await p.waitForTimeout(250); await p.evaluate(() => A.cd('zD')); await p.waitForTimeout(250);
  const ord = () => p.evaluate(() => [...[...document.querySelectorAll('#app #cols .col')][1].querySelectorAll('.cw')].map(x => x.dataset.v).join());
  const o0 = await ord(), L = o0.split(','); a = await cw(L[L.length - 1]); await pick(a); const f = await cw(L[0], .15); await p.mouse.move(f.x, f.y, { steps: 6 }); await p.waitForTimeout(200); await p.mouse.up(); await p.waitForTimeout(300);
  const o1 = await ord(); t.ok(o1.split(',')[0] == L[L.length - 1] && o1 != o0, 'tri manuel : réorganisation dans une colonne', o0 + ' → ' + o1);
  t.ok(!(await p.evaluate(() => document.querySelectorAll('body>.ghost').length)), 'aucun fantôme restant');
  t.ok(!d.errs.length, 'aucune erreur JavaScript', d.errs.join(' | '));
  await d.ctx.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
