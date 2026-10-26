// Glisser-déposer et deuxième doigt (25/10/2026, bug signalé par Idriss sur iPhone et iPad) : pendant un appui long, un 2e doigt posé sur un autre élément
// figeait le fantôme du premier (il restait affiché même en changeant d'écran) et ouvrait l'élément touché. Gestes tactiles réels envoyés par CDP.
const H = require('./lib/h'), D = require('./lib/data');

async function run(b) {
  const t = H.suite('Glisser-déposer : deuxième doigt pendant un appui long');
  const d = await H.device(b, { seed: D.mk(H.dayNow()), cfg: { srs: true, nl: 20, nx: true, vw: 'list' }, dev: 'dev1' }), p = d.page;
  const cdp = await d.ctx.newCDPSession(p); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(o => ({ x: o.x, y: o.y, id: o.id, radiusX: 5, radiusY: 5, force: 1 })) });
  const setup = () => p.evaluate(() => { ['zf1', 'zf2', 'zq'].forEach(id => { const i = S.nodes.findIndex(n => n.id == id); if (i >= 0) S.nodes.splice(i, 1) });
    S.nodes.push({ id: 'zf1', p: 0, k: 'f', name: 'Cible', u: hlc() }, { id: 'zf2', p: 0, k: 'f', name: 'Source', u: hlc() }, { id: 'zq', p: 0, k: 'qcm', name: 'Autre QCM', u: hlc(), items: [{ q: 'Q', o: [{ t: 'a', k: 1 }, { t: 'b' }, { t: 'c' }, { t: 'd' }, { t: 'e' }] }] });
    cfg.vw = 'list'; view = 'browse'; A.cd(0) });
  const box = id => p.evaluate(id => { const e = document.querySelector(`#app .item[data-id="${id}"] .main`) || document.querySelector(`#app .item[data-id="${id}"]`); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + 40, y: r.y + r.height / 2 } }, id);
  const st = () => p.evaluate(() => ({ view, on: !!(dg && dg.on), g: document.querySelectorAll('body>.ghost').length, drag: document.querySelectorAll('.dragging').length, p: G('zf2') && G('zf2').p }));
  const path = async (a, z) => { for (let k = 1; k <= 6; k++) { await T('touchMove', [{ x: a.x + (z.x - a.x) * k / 6, y: a.y + (z.y - a.y) * k / 6, id: 1 }]); await p.waitForTimeout(25) } };
  const clickOn = id => p.evaluate(id => { const e = document.querySelector(`#app .item[data-id="${id}"] .main`); e && e.click(); return view }, id);
  // 1) un doigt : inchangé
  await setup(); await p.waitForTimeout(200); let a = await box('zf2'), z = await box('zf1');
  await T('touchStart', [{ ...a, id: 1 }]); await p.waitForTimeout(550); await path(a, z); await T('touchEnd', [{ ...z, id: 1 }]); await p.waitForTimeout(300);
  let s = await st(); t.ok(s.p == 'zf1' && !s.g && !s.drag, 'un doigt : glisser-déposer inchangé', JSON.stringify(s));
  // 2) 2e doigt posé sur un paquet pendant le glisser, levé avant le 1er
  await setup(); await p.waitForTimeout(200); a = await box('zf2'); z = await box('zf1'); let q = await box('zq');
  await T('touchStart', [{ ...a, id: 1 }]); await p.waitForTimeout(550); await T('touchStart', [{ ...a, id: 1 }, { ...q, id: 2 }]); await p.waitForTimeout(80);
  await T('touchEnd', [{ ...q, id: 2 }]); const v1 = await clickOn('zq');
  await path(a, z); const mid = await st(); await T('touchEnd', [{ ...z, id: 1 }]); await p.waitForTimeout(300); s = await st();
  t.ok(mid.on && mid.g == 1, 'le glisser continue avec le premier doigt (le fantôme le suit)', JSON.stringify(mid));
  t.ok(v1 == 'browse', 'le toucher du 2e doigt n\'ouvre pas le paquet touché', v1);
  t.ok(s.p == 'zf1' && !s.g && !s.drag, 'dépôt fait, aucun fantôme restant', JSON.stringify(s));
  // 3) 2e doigt levé après le 1er
  await setup(); await p.waitForTimeout(200); a = await box('zf2'); z = await box('zf1'); q = await box('zq');
  await T('touchStart', [{ ...a, id: 1 }]); await p.waitForTimeout(550); await T('touchStart', [{ ...a, id: 1 }, { ...q, id: 2 }]); await path(a, z);
  await T('touchEnd', [{ ...z, id: 1 }]); await p.waitForTimeout(120); await T('touchEnd', [{ ...q, id: 2 }]); const v2 = await clickOn('zq'); await p.waitForTimeout(300); s = await st();
  t.ok(v2 == 'browse' && s.p == 'zf1' && !s.g && !s.drag, '2e doigt levé après le premier : dépôt fait, rien d\'ouvert, aucun fantôme', JSON.stringify({ v2, s }));
  // 4) 2e doigt avant la fin de l'appui long : pas de glisser
  await setup(); await p.waitForTimeout(200); a = await box('zf2'); q = await box('zq');
  await T('touchStart', [{ ...a, id: 1 }]); await p.waitForTimeout(150); await T('touchStart', [{ ...a, id: 1 }, { ...q, id: 2 }]); await p.waitForTimeout(450); const s4 = await st();
  await T('touchEnd', [{ ...q, id: 2 }]); await T('touchEnd', [{ ...a, id: 1 }]); await p.waitForTimeout(300); s = await st();
  t.ok(!s4.on && !s4.g && !s.g && s.p == 0, '2e doigt pendant l\'appui long : aucun glisser, rien de figé', JSON.stringify({ s4, s }));
  // 5) changement d'écran : aucun fantôme ne survit ; un toucher simple ouvre toujours un paquet
  await p.waitForTimeout(600); await setup(); await p.waitForTimeout(200); q = await box('zq');
  await T('touchStart', [{ ...q, id: 3 }]); await T('touchEnd', [{ ...q, id: 3 }]); await p.waitForTimeout(400); s = await st();
  t.ok(s.view == 'study' && !s.g, 'toucher simple sur un paquet : il s\'ouvre, aucun fantôme', JSON.stringify(s));
  t.ok(!d.errs.length, 'aucune erreur JavaScript', d.errs.join(' | '));
  await d.ctx.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
