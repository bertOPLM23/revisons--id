// Verre léger (27/10/2026, choix C d'Idriss) : matière posée sur les barres, menus, feuilles et bulle ; barre du bas en une seule capsule ;
// barre du bas réduite à « Réviser » quand on descend, de retour en remontant ; les barres gonflent à l'appui, le reste s'écrase ; Mac sans flou.
const H = require('./lib/h'), D = require('./lib/data');

async function run(b) {
  const t = H.suite('Verre léger : matière, barre du bas réduite au défilement, appui');
  const d = await H.device(b, { seed: D.mk(H.dayNow()), cfg: { srs: true, nl: 20, nx: true }, dev: 'dev1' }), p = d.page;
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.evaluate(() => { const u = hlc(); for (let i = 0; i < 30; i++) S.nodes.push({ id: 'zv' + i, p: 0, k: 'f', name: 'Dossier ' + i, u }); A.cd(0) });
  await p.waitForTimeout(300);
  const cs = (s, k, ps) => p.evaluate(([s, k, ps]) => { const e = document.querySelector(s); return e ? getComputedStyle(e, ps || null)[k] : null }, [s, k, ps]);
  // 1) matière : capsule du haut et barre du bas portent le verre sur ::before, liseré irisé sur ::after
  t.ok(/conic-gradient/.test(await cs('#app .dock.nxd', 'backgroundImage', '::after')), 'barre du bas : liseré irisé');
  t.ok(/conic-gradient/.test(await cs('#app .tb .nxtg', 'backgroundImage', '::after')), 'capsule du haut : liseré irisé');
  t.ok((await cs('#app .dock.nxd .nxad', 'backgroundColor')) == 'rgba(0, 0, 0, 0)', '« + » sans fond propre : il fait partie de la capsule');
  t.ok((await p.evaluate(() => document.documentElement.dataset.desk)) == '1' && (await cs('#app .dock.nxd', 'backdropFilter', '::before')) == 'none', 'Mac (data-desk) : pas de flou en temps réel');
  // 2) barre du bas réduite en descendant, de retour en remontant et en haut de page
  const st = () => p.evaluate(() => ({ min: document.documentElement.classList.contains('rqmin'), w: Math.round(document.querySelector('#app .dock.nxd').getBoundingClientRect().width) }));
  const w0 = (await st()).w;
  for (let y = 100; y <= 800; y += 100) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(40) }
  await p.waitForTimeout(700); let s = await st();
  t.ok(s.min && s.w < w0 && (await p.evaluate(() => scrollY)) > 300, 'en descendant : barre du bas réduite', JSON.stringify({ w0, s }));
  t.ok(await p.evaluate(() => getComputedStyle(document.querySelector('#app .dock.nxd .nxad')).opacity === '0'), 'barre réduite : « + » masqué');
  const y1 = await p.evaluate(() => scrollY);
  for (let y = y1 - 30; y >= y1 - 210; y -= 30) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(40) }
  await p.waitForTimeout(700); s = await st();
  t.ok(!s.min && s.w == w0, 'en remontant : barre du bas entière', JSON.stringify(s));
  for (let y = 700; y <= 900; y += 100) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(40) }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  t.ok(!(await st()).min, 'en haut de la page : barre du bas entière');
  // 3) appui : la barre du bas et la capsule gonflent, leurs boutons ne s'écrasent pas ; une ligne s'écrase toujours
  const press = async (sel, rd) => { const r = await p.evaluate(s => { const e = document.querySelector(s).getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 } }, sel); await p.mouse.move(r.x, r.y); await p.mouse.down(); await p.waitForTimeout(300); const o = []; for (const x of rd) o.push(await cs(x, 'scale')); await p.mouse.move(5, 5); await p.mouse.up(); await p.waitForTimeout(700); return o };
  let o = await press('#app .dock.nxd .nxad', ['#app .dock.nxd', '#app .dock.nxd .nxad']);
  t.ok(o[0] == '1.035' && ['1', 'none'].includes(o[1]), 'appui sur « + » : la barre du bas gonfle, le bouton ne s\'écrase pas', o.join(' '));
  o = await press('#app .tb .nxtg>.tg', ['#app .tb .nxtg']);
  t.ok(o[0] == '1.06', 'appui dans la capsule du haut : elle gonfle', o.join(' '));
  o = await press('#app #lst .item .main', ['#app #lst .item']);
  t.ok(o[0] == '0.975', 'appui sur une ligne : elle s\'écrase toujours', o.join(' '));
  t.ok(!d.errs.length, 'aucune erreur JavaScript', d.errs.join(' | '));
  return t;
}
module.exports = { run };
