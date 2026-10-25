// A2 (étape 6) : réinitialisation, restauration et annulation de « déjà révisé » doivent devenir l'état de référence
// sur tous les appareils, y compris face à un appareil resté hors ligne ou à un client ancienne version (garde serveur simulée).
const H = require('./lib/h'), M = require('./lib/md');
const prog = p => p.items.map(i => H.fsr(i)).join('\n');
const empty = p => p.items.every(i => i.st == null && i.d == null);

async function run(b) {
  const t = H.suite('A2 — réinitialisation et restauration durables');

  // 1) réinitialisation pendant qu'un appareil hors ligne note encore l'ancien paquet
  for (const old of [false, true]) {
    const tag = old ? ' [appareil 2 = ancienne version, garde serveur simulée]' : '';
    const e = await M.setup({ browser: b, guardGn: old, d2: old ? { html: H.oldHtml() } : {} }), { d1, d2 } = e;
    d2.offline = true; const lg0 = await d2.page.evaluate(() => (LG().h || {})[day()] || 0);
    await H.rate(d2, 'pA', 'Q1', 3); await H.rate(d2, 'pA', 'Q4', 4); await H.leave(d2);
    await d1.page.evaluate(() => { askReset(['pA']); CF(); CF = null; AS = null }); await H.sync(d1);
    d2.offline = false; await e.both(3);
    t.ok(empty(await H.pack(d1, 'pA')) && empty(await H.pack(d2, 'pA')) && empty(e.srv.T.get('pA').data), 'réinitialisation : progression vide partout après le retour de l\'appareil hors ligne' + tag);
    t.ok(await d2.page.evaluate(() => (LG().h || {})[day()] || 0) - lg0 === 2, 'réinitialisation : le journal de l\'appareil revenu garde ses 2 révisions' + tag);
    if (!old) t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'réinitialisation : les deux appareils convergent');
    await e.close();
  }

  // 2) restauration d'une sauvegarde ancienne, face à un appareil hors ligne plus avancé
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    const backup = await d1.page.evaluate(() => JSON.parse(JSON.stringify(S.nodes.filter(n => !n.x))));
    await H.rate(d1, 'pD', 'Q1', 3); await H.rate(d1, 'pD', 'Q2', 4); await H.leave(d1); await e.both();
    d2.offline = true; await H.rate(d2, 'pD', 'Q3', 3); await H.leave(d2);
    await d1.page.evaluate(nodes => { view = 'browse'; rs = { date: 'test', np: 1, nodes }; A.rsok() }, backup); await H.sync(d1);
    d2.offline = false; await e.both(3);
    const ref = prog(backup.find(n => n.id == 'pD'));
    t.ok(prog(await H.pack(d1, 'pD')) === ref && prog(await H.pack(d2, 'pD')) === ref && prog(e.srv.T.get('pD').data) === ref, 'restauration : l\'état de la sauvegarde prévaut partout (appareil plus avancé revenu ensuite)');
    t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'restauration : les deux appareils convergent');
    await e.close();
  }

  // 3) « Marquer comme déjà révisé » puis Annuler, alors que l'autre appareil a déjà reçu le marquage
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    const before = prog(await H.pack(d1, 'pD'));
    await d1.page.evaluate(() => { askKnown(['pD']); CF(); CF = null; AS = null }); await e.both();
    await d1.page.evaluate(() => A.undo()); await e.both(3);
    t.ok(prog(await H.pack(d1, 'pD')) === before && prog(await H.pack(d2, 'pD')) === before, 'annulation de « déjà révisé » : état d\'avant partout');
    await e.close();
  }
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
