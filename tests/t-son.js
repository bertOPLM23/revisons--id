// Effets sonores (25/10/2026) ; l'espion se place sur les sons réellement joués (après vérification de l'interrupteur et de la catégorie) : désactivés par défaut ; déclencheurs (QCM juste/faux, boutons, panneaux, glisser-déposer) ; pas de son au retournement ;
// catégories et volume ; réglage synchronisé ; aucune erreur même sans audio.
const H = require('./lib/h'), M = require('./lib/md');
const spy = d => d.page.evaluate(() => { window.__s = []; Object.keys(SFXS).forEach(k => { const o = SFXS[k]; SFXS[k] = () => { __s.push(k); return o() } }) });
const got = d => d.page.evaluate(() => { const r = __s.slice(); __s.length = 0; return r });

async function run(b) {
  const t = H.suite('Effets sonores : réglages, déclencheurs, catégories, synchronisation');
  const e = await M.setup({ browser: b }), { d1, d2 } = e;
  await spy(d1);
  const eng = () => d1.page.evaluate(() => ({ ctx: !!SFXC, snd: !!cfg.snd }));
  // 1) désactivé par défaut : rien ne sonne, aucun contexte audio créé
  t.ok(!(await d1.page.evaluate(() => !!cfg.snd)), 'désactivé par défaut');
  await d1.page.evaluate(() => { A.set() }); await d1.page.evaluate(() => { document.querySelector('#app [data-a="lt"]') && 0 });
  t.ok((await eng()).ctx === false, 'aucun contexte audio créé tant que les sons sont désactivés');
  // 2) activation : les lignes de catégories et de volume apparaissent
  await d1.page.evaluate(() => A.snd());
  let ui = await d1.page.evaluate(() => ({ rows: [...document.querySelectorAll('#app [data-a="snd"],#app [data-a="sndq"],#app [data-a="snb"],#app [data-a="sndd"],#app [data-a="nxv"][data-v="sndv"]')].map(x => x.dataset.a + (x.dataset.v ? ':' + x.dataset.v : '')).join(','), txt: /Volume/.test(document.querySelector('#app').innerText) }));
  t.ok(ui.rows === 'snd,nxv:sndv,sndq,snb,sndd', 'réglages : interrupteur, trois catégories et volume affichés une fois activé', ui.rows);
  await got(d1);
  // 3) QCM juste / faux
  await d1.page.evaluate(() => { cur = nid('f2'); view = 'browse'; A.cd(nid('f2')) });
  const q = await d1.page.evaluate(() => { const p = S.nodes.find(n => n.k == 'qcm' && n.items && n.items.length); A.go(p.id); return view });
  t.ok(q === 'study', 'séance de QCM ouverte', q);
  await d1.page.evaluate(() => { const it = deck.items[order[idx]]; po(it).forEach((o, i) => { sel[i] = !!o.k }); A.val() });
  t.ok((await got(d1)).includes('ok'), 'réponse juste : son « ok »');
  await d1.page.evaluate(() => { A.nx && A.nx(); });
  // 4) catégorie désactivée
  await d1.page.evaluate(() => { A.set(); A.sndq() }); await got(d1);
  await d1.page.evaluate(() => { A.go(S.nodes.find(n => n.k == 'qcm' && n.items && n.items.length).id); const it = deck.items[order[idx]]; po(it).forEach((o, i) => { sel[i] = !o.k }); A.val() });
  t.ok(!(await got(d1)).includes('ko'), 'catégorie « Réponses des QCM » coupée : aucun son');
  // 5) boutons et panneaux, glisser-déposer (via les fonctions) et retournement muet
  await d1.page.evaluate(() => { A.cd(0); A.sndq(); }); await got(d1);
  await d1.page.evaluate(() => { A.cd(0); document.querySelector('#app [data-a="stats"]') && document.querySelector('#app [data-a="stats"]').click() });
  t.ok((await got(d1)).includes('tap'), 'bouton : petit tic');
  await d1.page.evaluate(() => { A.cd(0); AS = { k: 'nxr' }; asRender() });
  t.ok((await got(d1)).includes('panel'), 'ouverture d\'un panneau : son');
  await d1.page.evaluate(() => { A.cd(nid('f2')); const p = S.nodes.find(n => n.k == 'fc' && n.items && n.items.length); A.go(p.id) }); await got(d1);
  await d1.page.evaluate(() => A.flip && A.flip());
  t.ok(!(await got(d1)).length, 'retournement de carte : aucun son');
  await d1.page.evaluate(() => { const c = document.querySelector('#app .card[data-a="flip"]'); c && c.click() });
  const fr = await d1.page.evaluate(() => ({ back, s: __s.slice() })); await got(d1);
  t.ok(fr.back === false && !fr.s.length, 'retournement par un vrai toucher sur la carte : aucun son', JSON.stringify(fr));
  await d1.page.evaluate(() => A.back()); await got(d1);
  // 6) désactivation générale : plus rien
  await d1.page.evaluate(() => { A.set(); A.snd() }); await got(d1);
  await d1.page.evaluate(() => { AS = { k: 'nxr' }; asRender() });
  t.ok((await got(d1)).length === 0 && (await d1.page.evaluate(() => !cfg.snd)), 'interrupteur général coupé : plus aucun son');
  // 7) volume : valeurs bornées
  await d1.page.evaluate(() => { A.sndv(250); }); t.ok((await d1.page.evaluate(() => cfg.sndv)) === 100, 'volume borné à 100');
  await d1.page.evaluate(() => { A.sndv(-5); }); t.ok((await d1.page.evaluate(() => cfg.sndv)) === 0, 'volume borné à 0');
  await d1.page.evaluate(() => { A.sndv(40); A.snd(); }); await e.both(3);
  // 8) synchronisation du réglage
  const c2 = await d2.page.evaluate(() => ({ snd: !!cfg.snd, v: cfg.sndv, q: cfg.sndq }));
  t.ok(c2.snd === true && c2.v === 40, 'réglages synchronisés vers l\'autre appareil (activé, volume 40)', JSON.stringify(c2));
  const n0 = e.srv.log.length; for (let k = 0; k < 5; k++) await e.both(1);
  t.ok(e.srv.log.length === n0, '10 synchros au repos : 0 écriture', (e.srv.log.length - n0) + ' écriture(s)');
  t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript', d1.errs.concat(d2.errs).join(' | '));
  await e.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
