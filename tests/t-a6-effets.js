// A6 (suite) : effets de la journée de révision qui commence à 4 h, heure locale.
// Bornes (23:59, 00:00, 03:59, 04:00), fins de mois / d'année / 29 février, fuseaux et changements d'heure, journal et statistiques,
// échéances et intervalles FSRS, limite de nouvelles cartes, semaine du calendrier de l'activité, redessin à la bascule.
const H = require('./lib/h'), D = require('./lib/data');
const exp = (t, tz) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(t), g = k => +p.find(x => x.type == k).value; return Math.round(Date.UTC(g('year'), g('month') - 1, g('day')) / 864e5) - (g('hour') < 4 ? 1 : 0) };
const at = (d, iso) => d.page.evaluate(t => { window.__off = t - (Date.now() - window.__off) }, Date.parse(iso));
const dayOf = d => d.page.evaluate(() => day());
const ISO = n => new Date(n * 864e5).toISOString().slice(0, 10);

async function run(b) {
  const t = H.suite('A6 — effets de la bascule à 4 h (journal, statistiques, FSRS, limites)');
  const TZ = 'Europe/Paris';
  const d = await H.device(b, { seed: D.mk(H.dayNow(TZ)), cfg: { srs: true, nl: 20, nx: true }, dev: 'dev1', tz: TZ }), p = d.page;

  // 1) bornes et dates particulières (aucune règle propre à l'app : comparé à Intl)
  const marks = ['2026-12-31T23:59:00+01:00', '2027-01-01T00:00:00+01:00', '2027-01-01T03:59:00+01:00', '2027-01-01T04:00:00+01:00', '2028-02-28T23:59:00+01:00', '2028-02-29T00:00:00+01:00', '2028-02-29T03:59:00+01:00', '2028-02-29T04:00:00+01:00', '2028-03-01T03:59:00+01:00', '2028-03-01T04:00:00+01:00', '2026-10-31T23:59:00+01:00'];
  let bad = [];
  for (const iso of marks) { await at(d, iso); const g = await dayOf(d); if (g !== exp(Date.parse(iso), TZ)) bad.push(iso + ' → ' + ISO(g)) }
  t.ok(!bad.length, 'fins de mois, d\'année et 29 février : 23:59, 00:00, 03:59 et 04:00 donnent le bon jour logique', bad.join(' ; '));
  await at(d, '2027-01-01T03:59:00+01:00'); const a = await dayOf(d); await at(d, '2027-01-01T04:00:00+01:00'); const c = await dayOf(d); await at(d, '2026-12-31T23:59:00+01:00'); const z = await dayOf(d);
  t.ok(z === a && c === a + 1, '31 décembre 23:59 et 1er janvier 03:59 = même jour ; 04:00 = jour suivant', ISO(z) + ' / ' + ISO(a) + ' / ' + ISO(c));
  // une journée de 25 h (retour à l'heure d'hiver) et de 23 h (heure d'été) : un seul changement de jour logique par date du calendrier
  const walk = async (from, to) => { let n = 0; await at(d, from); let prev = await dayOf(d); for (let ms = Date.parse(from); ms <= Date.parse(to); ms += 15 * 60e3) { await at(d, new Date(ms).toISOString()); const g = await dayOf(d); if (g !== prev) { n++; if (g !== prev + 1) n += 100 } prev = g } return n };
  t.ok(await walk('2026-10-24T12:00:00Z', '2026-10-26T12:00:00Z') === 2, 'passage à l\'heure d\'hiver (25 h) : exactement 2 changements de jour logique sur 48 h, chacun de +1');
  t.ok(await walk('2027-03-27T12:00:00Z', '2027-03-29T12:00:00Z') === 2, 'passage à l\'heure d\'été (23 h) : exactement 2 changements de jour logique sur 48 h, chacun de +1');

  // 2) un même instant, deux fuseaux : chacun son jour logique, jamais décalé de plus d\'un jour
  const iso = '2026-10-22T02:30:00Z'; // 04:30 à Paris, 22:30 la veille à New York, 14:30 à Auckland
  const res = [];
  for (const tz of ['Europe/Paris', 'America/New_York', 'Pacific/Auckland', 'Asia/Kolkata']) {
    const x = await H.device(b, { seed: D.mk(H.dayNow(tz)), cfg: { srs: true, nl: 20, nx: true }, dev: 'dev1', tz }); await at(x, iso);
    res.push([tz, await dayOf(x), exp(Date.parse(iso), tz)]); await x.ctx.close();
  }
  t.ok(res.every(r => r[1] === r[2]), 'même instant dans 4 fuseaux (dont un décalage de 5 h 30) : chaque appareil donne son jour logique local', res.map(r => r[0] + ' ' + ISO(r[1])).join(', '));

  // 3) journal, série, échéances, intervalles FSRS autour de la bascule (Paris, nuit du 22 au 23 octobre 2026)
  const L = exp(Date.parse('2026-10-22T12:00:00+02:00'), TZ);   // jour logique « 22 »
  await at(d, '2026-10-22T20:00:00+02:00');
  await p.evaluate(L => { const pk = G('pD'); pk.items.slice(0, 6).forEach((i, k) => Object.assign(i, { st: 2, s: 5, df: 5, l: L - 4, d: L + 1, n: 3, m: 0, t: 1e12 + k })); pk.u = hlc(); save(); render() }, L);
  const due = () => p.evaluate(() => G('pD').items.filter(i => isDue(i) && i.st === 2).length);
  t.ok(await due() === 0, 'le 22 à 20:00 : les cartes dues « demain » (23) ne sont pas dues');
  await at(d, '2026-10-23T01:00:00+02:00');
  t.ok(await dayOf(d) === L && await due() === 0, 'le 23 à 01:00 (calendrier) : encore le jour logique 22, les cartes du 23 ne sont pas encore dues');
  await at(d, '2026-10-23T03:59:00+02:00'); t.ok(await due() === 0, 'le 23 à 03:59 : toujours pas dues');
  await at(d, '2026-10-23T04:00:00+02:00'); t.ok(await dayOf(d) === L + 1 && await due() === 6, 'le 23 à 04:00 : jour logique 23, les 6 cartes sont dues');
  // révision à 01:00 le 23 (jour logique 22) : journal et FSRS sont rattachés au 22
  await at(d, '2026-10-22T19:00:00+02:00'); await p.evaluate(L => { G('pD').items.slice(0, 6).forEach(i => { i.d = L; }); save() }, L);
  await H.rate(d, 'pD', 'Q1', 3); await H.leave(d);
  await at(d, '2026-10-23T01:00:00+02:00'); await H.rate(d, 'pD', 'Q2', 3); await H.leave(d);
  const j = await p.evaluate(() => ({ h: JSON.parse(JSON.stringify(LG().h || {})), q1: G('pD').items.find(i => i.q == 'Q1'), q2: G('pD').items.find(i => i.q == 'Q2'), L: day() }));
  t.ok(j.h[L] === 2 && !j.h[L + 1], 'révisions de 19:00 le 22 et de 01:00 le 23 : toutes deux dans le jour logique 22 du journal', JSON.stringify(j.h));
  t.ok(j.q1.l === L && j.q2.l === L && j.q2.d > L && j.q1.d > L, 'FSRS : dernière révision l = jour logique 22 pour les deux ; échéances postérieures');
  // intervalle écoulé : révision à 23:00 puis à 01:00 (même jour logique) = écoulé 0 ; puis à 04:30 le 23 = écoulé 1
  const el = await p.evaluate(() => { const i = { st: 2, s: 5, df: 5, l: day(), d: day() + 3, n: 3, t: 1e12 }; return plan(i, 3).s });
  await at(d, '2026-10-23T04:30:00+02:00');
  const el1 = await p.evaluate(L => { const i = { st: 2, s: 5, df: 5, l: L, d: L + 3, n: 3, t: 1e12 }; return { s: plan(i, 3).s, el: day() - L } }, L);
  t.ok(el1.el === 1 && el1.s !== el, 'à 04:30 le 23, une carte revue le 22 a un écoulé de 1 jour (formule FSRS à long terme), alors que revue le même jour logique il vaut 0', 'écoulé ' + el1.el + ', s ' + el1.s + ' vs ' + el);
  await at(d, '2026-10-23T03:30:00+02:00');
  const el0 = await p.evaluate(L => { const i = { st: 2, s: 5, df: 5, l: L, d: L + 3, n: 3, t: 1e12 }; return day() - L }, L);
  t.ok(el0 === 0, 'à 03:30 le 23, une carte revue le 22 au soir a un écoulé de 0 (même journée de révision)');

  // 4) série (jours d'affilée) : 21 et 22 étudiés, rien le 23 avant 04:00 → série de 2 encore vivante ; après 04:00 sans étude : toujours 2 (hier) ; après le 24 04:00 : cassée
  await p.evaluate(L => { const lg = LG(); lg.h = { [L - 2]: 3, [L - 1]: 5, [L]: 2 }; lg.u = hlc(); save() }, L);
  const sk = async iso => { await at(d, iso); return p.evaluate(() => { const logs = S.nodes.filter(n => n.k == 'log' && !n.x), cnt = x => logs.reduce((s, l) => s + ((l.h || {})[x] || 0), 0), d0 = day(); let k = 0, x = cnt(d0) ? d0 : d0 - 1; while (cnt(x) > 0) { k++; x-- } return k }) };
  t.ok(await sk('2026-10-23T02:00:00+02:00') === 3, 'le 23 à 02:00 (encore le 22 logique) : série 3 jours (20, 21, 22)'.replace('20, 21, 22', 'L-2, L-1, L'));
  t.ok(await sk('2026-10-23T05:00:00+02:00') === 3, 'le 23 à 05:00 sans étude : la série (jusqu\'à hier) est conservée');
  t.ok(await sk('2026-10-24T05:00:00+02:00') === 0, 'le 24 à 05:00 sans étude depuis le 22 : série cassée');

  // 5) limite de nouvelles cartes du jour : remise à zéro à 04:00
  await at(d, '2026-10-23T03:59:00+02:00'); await p.evaluate(() => { localStorage.removeItem('revis-new'); bumpNew(); bumpNew() });
  const n1 = await p.evaluate(() => JSON.parse(localStorage.getItem('revis-new')).n);
  await at(d, '2026-10-23T04:00:00+02:00'); await p.evaluate(() => bumpNew());
  const n2 = await p.evaluate(() => JSON.parse(localStorage.getItem('revis-new')).n);
  t.ok(n1 === 2 && n2 === 1, 'compteur local de nouvelles cartes : repart à 1 à 04:00', n1 + ' puis ' + n2);
  // première vue : f = jour logique ; la limite globale (nl) compte les cartes vues « aujourd'hui »
  await at(d, '2026-10-23T02:00:00+02:00'); await H.rate(d, 'pC', 'Q1', 3); await H.leave(d);
  const f1 = (await H.item(d, 'pC', 'Q1')).f; t.ok(f1 === L, 'carte vue pour la première fois à 02:00 le 23 : f = jour logique 22', 'f = ' + (f1 && ISO(f1)));
  await at(d, '2026-10-23T04:00:00+02:00'); const seen4 = await p.evaluate(() => TD().seen);
  await at(d, '2026-10-23T03:59:00+02:00'); const seen3 = await p.evaluate(() => TD().seen);
  t.ok(seen3 >= 1 && seen4 === 0, 'la limite de nouvelles cartes se libère à 04:00 (vues avant : ' + seen3 + ', après : ' + seen4 + ')');

  // 6) calendrier d'activité : la colonne de la semaine est celle du jour logique (mercredi 02:00 = mardi)
  const cal = async iso => { await at(d, iso); return p.evaluate(() => { view = 'stats'; render(); const cells = [...document.querySelectorAll('i[data-a="hmd"]')], on = cells.findIndex(c => c.classList.contains('on')); const r = { on, n: cells.length, v: on >= 0 ? +cells[on].dataset.v : null, wd: (new Date(day() * 864e5).getUTCDay() + 6) % 7, d: day() }; view = 'browse'; render(); return r }) };
  for (const iso2 of ['2026-10-21T02:00:00+02:00', '2026-10-21T04:30:00+02:00', '2026-10-25T03:30:00+01:00', '2026-10-26T03:30:00+01:00']) {
    const r = await cal(iso2);
    t.ok(r.on >= 0 && r.v === r.d && r.on % 7 === r.wd, 'calendrier d\'activité ' + iso2 + ' : la case du jour est celle du jour logique et sa ligne est le bon jour de la semaine', JSON.stringify(r));
  }

  // 7) la bascule redessine l'accueil, mais jamais une séance ni une saisie en cours
  try {
  await at(d, '2026-10-23T03:50:00+02:00'); await p.evaluate(() => { view = 'browse'; render() });
  const rd0 = await p.evaluate(() => RDAY);
  await at(d, '2026-10-23T04:01:00+02:00'); await p.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) });
  t.ok(await p.evaluate(() => RDAY === day()) && rd0 !== await dayOf(d), 'bascule de 04:00 avec l\'accueil affiché : redessiné (RDAY = jour courant)');
  await at(d, '2026-10-24T03:50:00+02:00'); await p.evaluate(() => { A.go('pD'); window.__arr = deck.items });
  const rdS = await p.evaluate(() => RDAY); await at(d, '2026-10-24T04:01:00+02:00'); await p.evaluate(() => dayChk());
  t.ok(await p.evaluate(rd => view == 'study' && RDAY === rd && deck.items === window.__arr, rdS), 'bascule de 04:00 pendant une séance : rien n\'est redessiné, la séance continue');
  await H.leave(d);
  t.ok(await p.evaluate(() => RDAY === day()), 'sortie de séance : l\'accueil est dessiné au jour courant');
  } catch (x) { t.ok(false, 'redessin à la bascule : ' + String(x.message).slice(0, 120)) }
  t.ok(!d.errs.length, 'aucune erreur JavaScript', d.errs.join(' | '));
  await d.ctx.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
