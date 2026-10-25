// Étape 2 : horloge hybride (HLC), auteur w, départage explicite, u strictement supérieur à la version serveur avant envoi.
const H = require('./lib/h'), M = require('./lib/md'), D = require('./lib/data');
const keys = p => p.items.map(i => i.q);

async function run(b) {
  const t = H.suite('Horloge hybride et départage des versions');

  // 1) appareil en retard de 10 min : modification faite APRÈS avoir reçu la version d'un appareil en avance (pas de concurrence)
  {
    const e = await M.setup({ browser: b, d2: { off: -10 * 60e3 } }), { d1, d2 } = e;
    await d1.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'De D1', a: 'x' }); p.u = hlc(); save() }); await e.both();
    const u1 = (await H.pack(d2, 'pD')).u;
    await d2.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'De D2 (horloge en retard)', a: 'x' }); p.u = hlc(); save() });
    t.ok((await H.pack(d2, 'pD')).u > u1, 'horloge en retard : la nouvelle version locale est postérieure à celle reçue');
    await e.both();
    const ks = [keys(await H.pack(d1, 'pD')), keys(e.srv.T.get('pD').data)];
    t.ok(ks.every(k => k.includes('De D1') && k.includes('De D2 (horloge en retard)')), 'horloge en retard : la modification arrive sur l\'autre appareil et au serveur');
    t.ok(!e.srv.log.some(l => l[0] == 'refus'), 'aucune écriture refusée par le serveur', e.srv.log.filter(l => l[0] == 'refus').map(l => l.join(' ')).join(' | '));
    // une note sur l'appareil en retard porte un t postérieur à celui de la carte reçue, et son auteur
    await H.rate(d1, 'pD', 'Q2', 3); await H.leave(d1); await e.both();
    const t1 = (await H.item(d2, 'pD', 'Q2')).t;
    await H.rate(d2, 'pD', 'Q2', 1); await H.leave(d2); const x = await H.item(d2, 'pD', 'Q2');
    t.ok(x.t > t1 && x.w === 'dev2', 'note sur l\'appareil en retard : t postérieur à la version reçue, w = appareil');
    await e.both();
    t.ok(H.fsr(await H.item(d1, 'pD', 'Q2')) === H.fsr(x), 'cette note (la plus récente au sens logique) l\'emporte partout');
    const n0 = e.srv.log.length; for (let k = 0; k < 5; k++) await e.both(1);
    t.ok(e.srv.log.length === n0, '10 synchros au repos : 0 écriture', (e.srv.log.length - n0) + ' écriture(s)');
    t.ok(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv), 'appareils et serveur identiques');
    await e.close();
  }

  // 2) horloge système qui recule (ex. pile du Mac) : les versions continuent d'avancer et la modification part bien
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await d1.page.evaluate(() => { const p = G('pA'); p.name = 'Os (1re modification)'; p.u = hlc(); save() }); await e.both();
    const u0 = (await H.pack(d1, 'pA')).u;
    const mono = await d1.page.evaluate(() => { let p = hlc(), ok = true; for (let k = 0; k < 2000; k++) { if (k == 1000) window.__off -= 3600e3; const v = hlc(); if (!(v > p)) ok = false; p = v } return ok });
    t.ok(mono, 'hlc() strictement croissant, y compris quand l\'horloge système recule d\'une heure');
    await d1.page.evaluate(() => { window.__off -= 2 * 3600e3; const p = G('pA'); p.name = 'Os (renommé)'; p.u = hlc(); save() });
    t.ok((await H.pack(d1, 'pA')).u > u0, 'horloge reculée de 3 h : u du paquet modifié toujours supérieur à sa valeur précédente');
    await e.both();
    t.ok((await H.pack(d2, 'pA')).name === 'Os (renommé)', 'horloge reculée : la modification est bien envoyée et reçue');
    // une annulation de note ne fait pas reculer l'horloge (la restauration de t/u par « Annuler » relève de l'étape 3)
    const before = await d1.page.evaluate(() => hlc());
    await H.rate(d1, 'pA', 'Q8', 3); await d1.page.evaluate(() => A.rundo());
    t.ok(await d1.page.evaluate(() => hlc()) > before, 'après « Annuler la dernière note » : l\'horloge n\'a pas reculé');
    await e.close();
  }

  // 3) départage : même t, w différents → résultat déterministe ; anciennes données sans w
  {
    const d = await H.device(b, { seed: D.mk(H.dayNow()), cfg: { srs: true, nl: 20, nx: true }, dev: 'dev1' });
    const r = await d.page.evaluate(() => {
      const x = { q: 'a', st: 2, s: 5, d: 10, t: 500, w: 'devA' }, y = { q: 'a', st: 2, s: 9, d: 30, t: 500, w: 'devB' };
      const m1 = mergeItems([{ ...x }], [{ ...y }]).items[0], m2 = mergeItems([{ ...y }], [{ ...x }]).items[0];
      const l1 = { q: 'b', st: 2, s: 5, t: 500, n: 3 }, l2 = { q: 'b', st: 2, s: 9, t: 500, n: 4 };
      const n1 = mergeItems([{ ...l1 }], [{ ...l2 }]).items[0], n2 = mergeItems([{ ...l2 }], [{ ...l1 }]).items[0];
      const e1 = { q: 'c', st: 2, s: 1, d: 99, t: 500, n: 3, l: 7 }, e2 = { q: 'c', st: 2, s: 2, d: 3, t: 500, n: 3, l: 7 };
      return { det: m1.w === m2.w && m1.s === m2.s && m1.w === 'devB', fsrsIgnored: better(y, x) && !better(x, y),
        legacy: n1.n === 4 && n2.n === 4, tieKeep: !better(e1, e2) && !better(e2, e1) };
    });
    t.ok(r.det && r.fsrsIgnored, 'même t, w différents : même gagnant dans les deux sens de fusion, choisi par w (pas par les valeurs FSRS)');
    t.ok(r.legacy, 'anciennes données sans w : départage par n puis l (comme avant)');
    t.ok(r.tieKeep, 'égalité totale (t, w, n, l) : aucune des deux versions n\'écrase l\'autre (plus de comparaison des champs FSRS)');
    // une note sur une carte ancienne (sans w) pose w
    await H.rate(d, 'pA', 'Q1', 3); const q1 = await H.item(d, 'pA', 'Q1');
    t.ok(q1.w === 'dev1' && q1.t > 1e12, 'carte ancienne notée : w et t posés');
    // l'horloge démarre au-dessus de la plus grande version déjà présente dans les données
    const d2 = await H.device(b, { seed: (() => { const s = D.mk(H.dayNow()); s.nodes.find(n => n.id == 'pD').u = Date.now() + 864e5; return s })(), cfg: { srs: true, nl: 20, nx: true }, dev: 'devX' });
    t.ok(await d2.page.evaluate(() => hlc() > G('pD').u), 'au démarrage, hlc() dépasse la plus grande version présente localement');
    t.ok(!d.errs.length && !d2.errs.length, 'aucune erreur JavaScript', d.errs.concat(d2.errs).join(' | '));
    await d.ctx.close(); await d2.ctx.close();
  }
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
