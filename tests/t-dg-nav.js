// Naviguer en glissant (26/10/2026, maquette validée par Idriss) : pendant qu'un doigt tient la pile, l'autre doigt ouvre un dossier, remonte avec ‹, ajoute un paquet
// d'un autre dossier ; la pile gardée 1 s sur un dossier l'ouvre ; lâcher hors d'un dossier dépose dans le dossier ouvert ; un rendu pendant le geste ne le fige pas. Gestes CDP.
const H = require('./lib/h'), D = require('./lib/data');

async function run(b) {
  const t = H.suite('Glisser-déposer : naviguer en tenant la pile');
  const d = await H.device(b, { seed: D.mk(H.dayNow()), cfg: { srs: true, nl: 20, nx: true, vw: 'list' }, dev: 'dev1' }), p = d.page;
  const cdp = await d.ctx.newCDPSession(p); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(o => ({ x: o.x, y: o.y, id: o.id, radiusX: 5, radiusY: 5, force: 1 })) });
  const setup = () => p.evaluate(() => { ['zA', 'zB', 'zC', 'zD', 'zq', 'zq2', 'zq3'].forEach(id => { const i = S.nodes.findIndex(n => n.id == id); if (i >= 0) S.nodes.splice(i, 1) }); const u = hlc();
    S.nodes.push({ id: 'zA', p: 0, k: 'f', name: 'Alpha', u }, { id: 'zB', p: 'zA', k: 'f', name: 'Bêta', u }, { id: 'zC', p: 'zB', k: 'f', name: 'Gamma', u }, { id: 'zD', p: 0, k: 'f', name: 'Delta', u },
      { id: 'zq', p: 'zD', k: 'qcm', name: 'QCM un', u, items: [{ q: 'Q', o: [{ t: 'a', k: 1 }, { t: 'b' }, { t: 'c' }, { t: 'd' }, { t: 'e' }] }] }, { id: 'zq2', p: 'zD', k: 'fc', name: 'Cartes deux', u, items: [{ q: 'a', a: 'b' }] }, { id: 'zq3', p: 'zA', k: 'fc', name: 'Cartes trois', u, items: [{ q: 'a', a: 'b' }] });
    cfg.vw = 'list'; cfg.so = 'name'; A.cd('zD'); scrollTo(0, 0) });
  const box = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + Math.min(40, r.width / 3), y: r.y + r.height / 2 } }, sel);
  const row = id => box(`#app .item[data-id="${id}"] .main`);
  const st = () => p.evaluate(() => ({ cur, on: !!(dg && dg.on), set: dg && dg.set ? dg.set.join() : '', g: document.querySelectorAll('body>.ghost').length, ck: document.querySelectorAll('#app .rqck').length, P: ['zq', 'zq2', 'zq3'].map(i => G(i).p).join() }));
  const tap2 = async (pt, id, F) => { await T('touchStart', [F, { ...pt, id }]); await p.waitForTimeout(70); await T('touchEnd', [{ ...pt, id }]); await p.waitForTimeout(160) };
  const mv = async (F, to) => { for (let k = 1; k <= 6; k++) { await T('touchMove', [{ x: F.x + (to.x - F.x) * k / 6, y: F.y + (to.y - F.y) * k / 6, id: 1 }]); await p.waitForTimeout(25) } return { ...to, id: 1 } };
  const empty = () => p.evaluate(() => ({ x: Math.round(innerWidth * .6), y: Math.round(innerHeight * .8) }));
  await setup(); await p.waitForTimeout(250);
  let F = { ...(await row('zq')), id: 1 }; await T('touchStart', [F]); await p.waitForTimeout(550); F = await mv(F, { x: F.x + 60, y: F.y + 5 });
  const gp = await p.evaluate(F => { const r = document.querySelector('body>.ghost').getBoundingClientRect(); return { r: r.right, b: r.bottom, l: r.left, x: F.x, y: F.y } }, F);
  t.ok(Math.abs(gp.b - gp.y) <= 8 && (Math.abs(gp.r - gp.x) <= 8 || gp.l <= 9), 'coin inférieur droit de la pile sous le doigt (bord bas à la hauteur du doigt)', JSON.stringify(gp));
  await tap2(await row('zq2'), 2, F); let s = await st(); t.ok(s.set == 'zq,zq2', '2e doigt sur un paquet : ajouté', s.set);
  await tap2(await box('#app .bk'), 3, F); s = await st(); t.ok(s.cur === 0 && s.on && s.set == 'zq,zq2', '2e doigt sur ‹ : remonte, la pile est gardée', JSON.stringify(s));
  await tap2(await row('zA'), 4, F); s = await st(); t.ok(s.cur == 'zA' && s.set == 'zq,zq2', '2e doigt sur un dossier : il s\'ouvre', JSON.stringify(s));
  await tap2(await row('zq3'), 5, F); s = await st(); t.ok(s.set == 'zq,zq2,zq3', 'paquet d\'un autre dossier ajouté à la pile', s.set);
  { const q = await row('zB'); await T('touchStart', [F, { ...q, id: 6 }]); await p.waitForTimeout(650); await T('touchEnd', [{ ...q, id: 6 }]); await p.waitForTimeout(150); s = await st();
    t.ok(s.set == 'zq,zq2,zq3,zB' && s.cur == 'zA', '2e doigt gardé 0,5 s sur un dossier : ajouté, pas ouvert', JSON.stringify(s));
    await T('touchStart', [F, { ...q, id: 7 }]); await p.waitForTimeout(650); await T('touchEnd', [{ ...q, id: 7 }]); await p.waitForTimeout(150); t.ok((await st()).set == 'zq,zq2,zq3', 'gardé à nouveau : retiré', (await st()).set) }
  F = await mv(F, { x: F.x + 15, y: F.y + 15 }); F = await mv(F, await row('zB')); await p.waitForTimeout(1250); s = await st(); t.ok(s.cur == 'zB', 'pile gardée 1 s sur un dossier : il s\'ouvre', String(s.cur));
  await p.waitForTimeout(1200); t.ok((await st()).cur == 'zB', 'doigt immobile : pas d\'ouverture en chaîne');
  F = await mv(F, { x: F.x + 20, y: F.y - 30 }); F = await mv(F, await row('zC')); await p.waitForTimeout(1250); t.ok((await st()).cur == 'zC', 'sous-dossier ouvert par survol (2e niveau)');
  F = await mv(F, await empty()); await T('touchEnd', [F]); await p.waitForTimeout(400); s = await st();
  t.ok(s.P == 'zC,zC,zC' && !s.on && !s.g && !s.ck, 'lâché hors d\'un dossier : les 3 paquets vont dans le dossier ouvert, plus de fantôme ni de cases', JSON.stringify(s));
  const fl = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => /déplacés? dans/.test(e.textContent) && e.children.length < 3).map(e => e.textContent.trim()).slice(0, 1).join());
  t.ok(/3 éléments déplacés dans « Gamma »/.test(fl), 'toast « 3 éléments déplacés dans « Gamma » »', fl);
  await p.evaluate(() => { const b = [...document.querySelectorAll('body button')].find(e => /^Annuler$/.test(e.textContent.trim()) && e.offsetParent); b && b.click() }); await p.waitForTimeout(300);
  t.ok((await st()).P == 'zD,zD,zA', '« Annuler » remet les 3 paquets en place', (await st()).P);
  // un dossier ne va jamais dans lui-même
  await setup(); await p.waitForTimeout(200); await p.evaluate(() => A.cd(0)); await p.waitForTimeout(200); F = { ...(await row('zA')), id: 1 }; await T('touchStart', [F]); await p.waitForTimeout(550);
  F = await mv(F, { x: F.x + 10, y: F.y + 10 }); await tap2(await row('zA'), 8, F); F = await mv(F, await empty()); await T('touchEnd', [F]); await p.waitForTimeout(400);
  t.ok((await p.evaluate(() => G('zA').p)) === 0, 'dossier lâché dans lui-même : refusé');
  // sans navigation : lâcher sur un vide ne bouge rien ; un rendu pendant le geste ne le fige pas
  await setup(); await p.waitForTimeout(200); F = { ...(await row('zq')), id: 1 }; await T('touchStart', [F]); await p.waitForTimeout(550);
  await p.evaluate(() => { render(); render() }); F = await mv(F, { x: F.x + 12, y: F.y - 12 }); const y0 = await p.evaluate(() => document.querySelector('body>.ghost').style.top); F = await mv(F, await empty());
  const y1 = await p.evaluate(() => document.querySelector('body>.ghost').style.top); t.ok(y0 != y1, 'rendu pendant le glisser (synchro) : la pile suit toujours le doigt', y0 + ' → ' + y1);
  await T('touchEnd', [F]); await p.waitForTimeout(300); s = await st(); t.ok(s.P == 'zD,zD,zA' && !s.g, 'sans navigation, lâché sur un vide : rien ne bouge', JSON.stringify(s));
  t.ok(!d.errs.length, 'aucune erreur JavaScript', d.errs.join(' | '));
  await d.ctx.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
