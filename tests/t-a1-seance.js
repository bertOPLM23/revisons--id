// A1 : un paquet ouvert en séance sur un appareil ne doit pas faire perdre les cartes ajoutées ou modifiées ailleurs.
// Aussi : index de séance valides, rechargement pendant l'attente, 10 synchros au repos sans écriture ni doublon.
const H = require('./lib/h'), M = require('./lib/md');
const keys = p => p.items.map(i => i.q);
const dup = a => a.length !== new Set(a).size;

async function scenario(b, t, withReload) {
  const tag = withReload ? ' [rechargement pendant la séance]' : '';
  const e = await M.setup({ browser: b }), { d1, d2 } = e;
  // d2 (iPad) ouvre une séance sur pD et garde une référence à la carte affichée
  await d2.page.evaluate(() => { A.go('pD'); window.__c0 = deck.items[q[0]] });
  // d1 (Mac) ajoute 3 cartes et corrige le texte de Q5
  await d1.page.evaluate(() => { const p = G('pD'); ['Ajout A', 'Ajout B', 'Ajout C'].forEach(t => p.items.push({ q: t, a: 'x' })); p.items[4].q = 'Q5 corrigée'; p.u = Date.now(); save() });
  await e.both();
  t.ok(await d2.page.evaluate(() => view == 'study' && deck.items[q[0]] === window.__c0), 'index de séance intacts après la synchro' + tag);
  // d2 note pendant la séance (progression de la séance)
  await d2.page.evaluate(() => { back = true; A.rate(3) });
  const qr = await d2.page.evaluate(() => window.__c0.q);
  await e.both();
  if (withReload) { await d2.reload(); await H.sync(d2) }
  await H.leave(d2); await e.both();
  await H.rate(d2, 'pD', 'Q3', 3); await H.leave(d2); await e.both(3);
  const p1 = await H.pack(d1, 'pD'), p2 = await H.pack(d2, 'pD'), ps = e.srv.T.get('pD').data;
  for (const [nm, p] of [['appareil 1', p1], ['appareil 2', p2], ['serveur', ps]]) {
    const k = keys(p);
    t.ok(['Ajout A', 'Ajout B', 'Ajout C', 'Q5 corrigée'].every(x => k.includes(x)) && !k.includes('Q5') && !dup(k) && k.length == 33, nm + ' : 3 ajouts + texte corrigé, sans doublon (33 cartes)' + tag, k.slice(-6).join(', ') + ' (' + k.length + ')');
  }
  const a = await H.item(d1, 'pD', qr), c = await H.item(d1, 'pD', 'Q3');
  t.ok(a && a.st != null && c && c.st != null, 'progression faite en séance sur l\'appareil 2 présente sur l\'appareil 1' + tag);
  t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'les deux appareils sont identiques' + tag);
  // 10 synchros au repos : aucune écriture, aucun changement
  const n0 = e.srv.log.length, j0 = await M.packsJSON(d1);
  for (let k = 0; k < 5; k++) await e.both(1);
  t.ok(e.srv.log.length === n0, '10 synchros au repos : 0 écriture serveur' + tag, (e.srv.log.length - n0) + ' écriture(s)');
  t.ok(await M.packsJSON(d1) === j0, '10 synchros au repos : données inchangées' + tag);
  t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript' + tag, d1.errs.concat(d2.errs).join(' | '));
  await e.close();
}

async function run(b) {
  const t = H.suite('A1 — séance en cours et modifications reçues');
  await scenario(b, t, false);
  await scenario(b, t, true);
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
