// B1 : comparaisons et empreintes de contenu invariantes à l'ordre des clés JSON.
// PostgreSQL jsonb réordonne les clés de tous les objets (clés courtes d'abord, puis alphabétique), y compris à l'intérieur des tableaux :
// une carte {q,a} revient {a,q}, une proposition QCM {t,k} revient {k,t}. Aucune de ces différences n'est un changement de contenu.
// Les scénarios de synchro tournent dans les deux modes du serveur simulé : ordre conservé et ordre jsonb (vérifié effectivement exécuté).
const H = require('./lib/h'), M = require('./lib/md');
const O = H.jsonbOrder;
const qs = p => p.items.map(i => i.q);
const nodeOf = (e, id) => e.srv.T.get(id) && e.srv.T.get(id).data;
const offline = (...ds) => ds.forEach(d => { d.offline = true });
const reset = (d, ids) => d.page.evaluate(ids => { askReset(ids); const f = CF; CF = null; AS = null; return f ? f() : null }, ids);
const recs = d => d.page.evaluate(() => typeof REC == 'undefined' ? [] : JSON.parse(JSON.stringify(REC)));
// paquets créés localement, avec l'ordre de clés « natif » du navigateur (q,o,e et {t,k}) : c'est cet ordre qui diffère du serveur jsonb
const QC = (n, x = {}) => ({ q: 'Qcm' + n, o: [0, 1, 2, 3, 4].map(j => ({ t: 'prop ' + n + '.' + j, k: j < 2 })), e: 'expl ' + n, ...x });
const mkPacks = d => d.page.evaluate(([qc]) => {
  S.nodes.push({ id: 'pQ', p: 'f2', k: 'qcm', name: 'QCM local', items: qc, u: hlc() });
  S.nodes.push({ id: 'pF', p: 'f2', k: 'fc', name: 'Cartes locales', items: [1, 2, 3, 4, 5].map(i => ({ q: 'Fc' + i, a: 'réponse ' + i, c: 'cat' })), u: hlc() });
  save() }, [[1, 2, 3, 4].map(n => QC(n))]);
const setups = async (b, jsonb) => { const e = await M.setup({ browser: b, jsonb }); await mkPacks(e.d1); await e.both(3); return e };
const vers = (e, id) => Promise.all([e.d1, e.d2].map(d => d.page.evaluate(id => { const n = G(id); return [n.u, n.hu, n.pu, n.ou] }, id))).then(v => JSON.stringify([v, nodeOf(e, id).u]));
const same = async e => await M.packsJSON(e.d1) === await M.packsJSON(e.d2) && await M.packsJSON(e.d1) === M.serverPacks(e.srv);
const back = async (e, order) => { for (const d of order == 'd1 puis d2' ? [e.d1, e.d2] : [e.d2, e.d1]) { d.offline = false; await H.sync(d) } await e.both(3) };

async function run(b) {
  const t = H.suite('B1 — invariance à l\'ordre des clés JSON (jsonb)');

  // ---------- 1) fonctions pures (dans la page) ----------
  {
    const d = await H.device(b, { seed: require('./lib/data').mk(H.dayNow()), cfg: { srs: true, nl: 20, nx: true }, dev: 'dev1' }), p = d.page;
    const fc = { q: 'Quel os ?', a: 'Le fémur', c: 'anat', st: 2, s: 5, t: 123, ev: { devB: [1, 0], devA: [2, 1] } };
    const qc = { q: 'Q ?', o: [{ t: 'a', k: true }, { t: 'b', k: false }], e: 'x', fx: 1 };
    const deep = { q: 'x', o: [{ t: 'a', k: true, m: [{ z: 1, y: [{ b: 1, a: [3, { d: 1, c: 2 }] }] }] }], e: { n: { m: { l: [{ k: 2, j: 1 }] } } } };
    const r = await p.evaluate(([fc, qc, deep, fcR, qcR, deepR]) => {
      const hasCj = typeof cj == 'function';
      const flat = Object.fromEntries(Object.keys(fc).filter(k => PF.indexOf(k) < 0 && k != 'ev').sort().map(k => [k, fc[k]]));
      return { hasCj,
        flat: chash(fc) === chash(fcR), qcm: chash(qc) === chash(qcR),
        deepEq: hasCj && cj(deep) === cj(deepR), deepHash: chash(deep) === chash(deepR),
        itemsEq: hasCj && cj([fc, qc]) === cj([fcR, qcR]), nodeEq: hasCj && cj({ items: [fc, qc], id: 'p', u: 1 }) === cj({ u: 1, id: 'p', items: [fcR, qcR] }),
        // l'ordre des tableaux reste significatif
        arrOrder: hasCj && cj([fc, qc]) !== cj([qc, fc]), optOrder: chash(qc) !== chash({ ...qc, o: [...qc.o].reverse() }), innerArr: hasCj && cj({ a: [1, 2] }) !== cj({ a: [2, 1] }),
        // de vrais changements restent visibles à tous les niveaux
        flip: chash(qc) !== chash({ ...qc, o: [{ t: 'a', k: false }, qc.o[1]] }), txt: chash(qc) !== chash({ ...qc, o: [{ t: 'a!', k: true }, qc.o[1]] }), expl: chash(qc) !== chash({ ...qc, e: 'y' }), deepChg: chash(deep) !== chash({ ...deep, o: [{ ...deep.o[0], m: [{ z: 1, y: [{ b: 1, a: [3, { d: 1, c: 3 }] }] }] }] }),
        // valeurs JSON : undefined ignoré comme JSON.stringify, null / faux / zéro / vide / unicode distincts
        vals: hasCj && cj({ a: undefined, b: 1 }) === cj({ b: 1 }) && cj([undefined]) === '[null]' && new Set([cj(null), cj(false), cj(0), cj(''), cj([]), cj({}), cj('0')]).size === 7 && cj({ s: 'é"\\\n 😀' }) === JSON.stringify({ s: 'é"\\\n 😀' }),
        // empreintes historiques : une flashcard (objet plat) garde exactement l'empreinte d'avant
        histo: chash(fc) === recHash(JSON.stringify(flat)) }
    }, [fc, qc, deep, O(fc), O(qc), O(deep)]);
    t.ok(r.flat, 'flashcard dont les clés sont réordonnées : même empreinte');
    t.ok(r.qcm, 'QCM dont les propositions {t,k} deviennent {k,t} : même empreinte');
    t.ok(r.hasCj && r.deepEq && r.deepHash, 'objets imbriqués sur plusieurs niveaux dans des tableaux : forme canonique et empreinte identiques', JSON.stringify(r));
    t.ok(r.itemsEq && r.nodeEq, 'tableau de cartes et nœud entier : comparaison indépendante de l\'ordre des clés');
    t.ok(r.arrOrder && r.optOrder && r.innerArr, 'l\'ordre des tableaux reste significatif (cartes, propositions, tableaux internes)');
    t.ok(r.flip && r.txt && r.expl && r.deepChg, 'un vrai changement est toujours détecté (bonne réponse, texte d\'une proposition, explication, valeur profonde)');
    t.ok(r.vals, 'valeurs JSON : undefined ignoré, null / false / 0 / chaîne vide / [] / {} / "0" distincts, échappements et unicode conformes à JSON');
    t.ok(r.histo, 'empreinte d\'une flashcard (objet plat) inchangée par rapport à l\'ancienne formule : les empreintes historiques restent valables');
    t.ok(!d.errs.length, 'aucune erreur JavaScript (fonctions pures)', d.errs.join(' | '));
    await d.ctx.close();
  }

  // ---------- 2) synchronisation sans changement : aucune écriture parasite, u inchangé ----------
  for (const jsonb of [false, true]) {
    const mode = jsonb ? 'ordre jsonb' : 'ordre conservé';
    const e = await setups(b, jsonb), { d1, d2 } = e;
    const k0 = Object.keys(nodeOf(e, 'pF').items[0])[0];
    t.ok(jsonb ? k0 === 'a' : k0 === 'q', 'serveur simulé [' + mode + '] : ordre des clés effectivement ' + (jsonb ? 'réordonné (jsonb)' : 'conservé'), 'première clé du serveur : ' + k0);
    await H.rate(d1, 'pF', 'Fc2', 3); await H.rateQ(d1, 'pQ', 'Qcm2', true); await H.leave(d1); await e.both(3);
    await H.rate(d2, 'pF', 'Fc3', 3); await H.rateQ(d2, 'pQ', 'Qcm3', true); await H.leave(d2); await e.both(3);
    const ids = ['pA', 'pB', 'pC', 'pD', 'pF', 'pQ'], v0 = await Promise.all(ids.map(id => vers(e, id))), n0 = e.srv.log.length, j0 = await M.packsJSON(d1);
    for (let k = 0; k < 5; k++) await e.both(1);
    t.ok(e.srv.log.length === n0, '10 synchros sans changement [' + mode + '] : 0 écriture serveur', (e.srv.log.length - n0) + ' écriture(s) : ' + e.srv.log.slice(n0).slice(0, 6).map(l => l.slice(0, 2).join(':')).join(' '));
    t.ok(JSON.stringify(await Promise.all(ids.map(id => vers(e, id)))) === JSON.stringify(v0), '10 synchros sans changement [' + mode + '] : u inchangé sur les deux appareils et au serveur');
    t.ok(await M.packsJSON(d1) === j0 && await same(e), 'appareils et serveur identiques, données inchangées [' + mode + ']');
    t.ok(await d1.page.evaluate(() => PENDG.size === 0) && await d2.page.evaluate(() => PENDG.size === 0), 'aucun paquet en attente (PENDG) au repos [' + mode + ']');
    t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript [' + mode + ']', d1.errs.concat(d2.errs).join(' | '));
    await e.close();
  }

  // ---------- 3) QCM en séance : le retour de son propre envoi ne le met pas en attente ----------
  for (const jsonb of [false, true]) {
    const mode = jsonb ? 'ordre jsonb' : 'ordre conservé';
    const e = await setups(b, jsonb), { d1 } = e;
    // d1 détient pQ dans l'ordre de clés « natif » (q,o,e et {t,k}) avec une base calculée sur cet ordre, alors que le serveur renvoie l'ordre jsonb :
    // c'est l'état de l'appareil qui a créé ou importé le paquet
    await d1.page.evaluate(() => { const p = G('pQ'); p.items = p.items.map(i => ({ q: i.q, o: i.o.map(o => ({ t: o.t, k: o.k })), e: i.e, ...Object.fromEntries(Object.entries(i).filter(([k]) => !['q', 'o', 'e'].includes(k))) })); S.baseH[p.id] = bmap(p.items); persist() });
    t.ok(await d1.page.evaluate(() => Object.keys(G('pQ').items[0].o[0]).join()) === 't,k', 'état de départ [' + mode + '] : propositions locales dans l\'ordre natif {t,k}');
    const st = () => d1.page.evaluate(() => ({ view, pend: PENDG.size, dirty: mDirty }));
    await H.rateQ(d1, 'pQ', 'Qcm1', true);                  // laisse la séance ouverte (view = study sur pQ)
    await H.sync1(d1); await H.sync1(d1);                   // 1re : envoi ; 2e : retour de son propre envoi
    const s1 = await st(), sv = nodeOf(e, 'pQ').items.find(i => i.q == 'Qcm1');
    t.ok(s1.view === 'study' && s1.pend === 0, 'QCM en séance, retour de son propre envoi [' + mode + '] : pas de mise en attente (PENDG)', JSON.stringify(s1));
    t.ok(sv && sv.st != null, 'QCM en séance [' + mode + '] : la progression arrive au serveur pendant la séance');
    await H.rateQ(d1, 'pQ', 'Qcm2', true); await H.sync1(d1); await H.sync1(d1);
    t.ok((await st()).pend === 0 && nodeOf(e, 'pQ').items.filter(i => i.st != null).length === 2, 'QCM en séance, 2e réponse [' + mode + '] : toujours pas en attente, 2 progressions au serveur');
    await H.leave(d1); await e.both(3);
    t.ok(await same(e), 'appareils et serveur identiques après la séance [' + mode + ']'); t.ok(!e.d1.errs.length && !e.d2.errs.length, 'aucune erreur JavaScript [' + mode + ']', e.d1.errs.concat(e.d2.errs).join(' | '));
    await e.close();
  }

  // ---------- 4) vrais changements de contenu : toujours détectés et fusionnés selon A1/A2, dans les deux modes ----------
  for (const jsonb of [false, true]) for (const order of ['d1 puis d2', 'd2 puis d1']) {
    const mode = (jsonb ? 'jsonb' : 'ordre conservé') + ', ' + order;
    const e = await setups(b, jsonb), { d1, d2 } = e; offline(d1, d2);
    // d1 : texte d'une proposition, bonne réponse inversée, explication corrigée, question ajoutée, question supprimée ; d2 : note ces questions / en note d'autres
    await d1.page.evaluate(() => { const p = G('pQ'); p.items[0].o[2].t = 'proposition corrigée'; p.items[0].o[0].k = false; p.items[1].e = 'explication corrigée'; p.items.push({ q: 'Qcm5', o: [0, 1, 2, 3, 4].map(j => ({ t: 'n' + j, k: j == 0 })), e: '' }); p.items = p.items.filter(i => i.q != 'Qcm4'); p.u = hlc(); save() });
    await H.rateQ(d2, 'pQ', 'Qcm1', true); await H.rateQ(d2, 'pQ', 'Qcm2', true); await H.rateQ(d2, 'pQ', 'Qcm4', true); await H.leave(d2);
    await back(e, order);
    for (const [nm, p] of [['appareil 1', await H.pack(d1, 'pQ')], ['appareil 2', await H.pack(d2, 'pQ')], ['serveur', nodeOf(e, 'pQ')]]) {
      const q1 = p.items.find(i => i.q == 'Qcm1'), q2 = p.items.find(i => i.q == 'Qcm2');
      const opt = q1 && q1.o.find(o => o.t == 'proposition corrigée'), first = q1 && q1.o.find(o => o.t == 'prop 1.0');
      t.ok(q1 && opt && first && first.k === false && q1.st != null && q2 && q2.e == 'explication corrigée' && q2.st != null && qs(p).includes('Qcm5') && !qs(p).includes('Qcm4') && p.items.length == 4,
        nm + ' [' + mode + '] : texte de proposition, bonne réponse, explication, ajout et suppression de l\'appareil 1 + notes de l\'appareil 2, tout est présent', JSON.stringify(qs(p)));
    }
    t.ok(await same(e), 'appareils et serveur identiques [' + mode + ']');
    t.ok(!(await recs(d1)).concat(await recs(d2)).some(r => r.kind == 'conflit-contenu'), 'aucune copie de récupération de conflit : il n\'y avait pas de conflit [' + mode + ']');
    const n0 = e.srv.log.length; for (let k = 0; k < 3; k++) await e.both(1);
    t.ok(e.srv.log.length === n0, '6 synchros ensuite [' + mode + '] : 0 écriture', (e.srv.log.length - n0) + ' écriture(s)');
    t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript [' + mode + ']', d1.errs.concat(d2.errs).join(' | '));
    await e.close();
  }
  for (const jsonb of [false, true]) { // vrai conflit sur la même proposition + remise à zéro (A2) avec correction concurrente
    const mode = jsonb ? 'jsonb' : 'ordre conservé';
    const e = await setups(b, jsonb), { d1, d2 } = e; offline(d1, d2);
    await d1.page.evaluate(() => { const p = G('pQ'); p.items[2].o[3].t = 'version 1'; p.u = hlc(); save() });
    await d2.page.evaluate(() => { const p = G('pQ'); p.items[2].o[3].t = 'version 2'; p.u = hlc(); save() });
    await back(e, 'd1 puis d2');
    const q = nodeOf(e, 'pQ').items.find(i => i.q == 'Qcm3');
    t.ok(q.o[3].t === 'version 2' && await same(e), 'deux corrections de la même proposition [' + mode + '] : une seule version, la plus récente, appareils et serveur identiques', JSON.stringify(q.o[3]));
    const rc = (await recs(d1)).concat(await recs(d2));
    t.ok(rc.some(r => r.kind == 'conflit-contenu' && r.packs.some(p => p.items.some(i => i.q == 'Qcm3' && i.o[3].t == 'version 1'))), 'la version écartée est dans la copie de récupération [' + mode + ']');
    await e.close();
    const f = await setups(b, jsonb); offline(f.d1, f.d2);
    await H.rateQ(f.d1, 'pQ', 'Qcm1', true); await H.leave(f.d1);
    await f.d2.page.evaluate(() => { const p = G('pQ'); p.items[3].e = 'explication ajoutée pendant la remise à zéro'; p.u = hlc(); save() });
    await reset(f.d1, ['pQ']); await H.sync(f.d1); f.d2.offline = false; f.d1.offline = false; await f.both(4);
    const pq = nodeOf(f, 'pQ');
    t.ok(pq.items.find(i => i.q == 'Qcm4').e === 'explication ajoutée pendant la remise à zéro' && pq.items.every(i => i.st == null && i.ev == null) && await same(f), 'remise à zéro + correction concurrente [' + mode + '] : contenu gardé, progression effacée partout');
    await f.close();
  }

  // ---------- 5) chemin des générations (A2) : recevoir une remise à zéro ne provoque aucune écriture parasite (garde de non-régression : ce scénario seul ne distingue pas l'ancienne comparaison de la nouvelle) ----------
  for (const jsonb of [false, true]) {
    const mode = jsonb ? 'jsonb' : 'ordre conservé';
    const e = await setups(b, jsonb), { d1, d2 } = e;
    // d2 détient pQ dans l'ordre natif (base calculée dessus) ; d1 le remet à zéro ; d2 n'a rien modifié
    await d2.page.evaluate(() => { const p = G('pQ'); p.items = p.items.map(i => ({ q: i.q, o: i.o.map(o => ({ t: o.t, k: o.k })), e: i.e, ...Object.fromEntries(Object.entries(i).filter(([k]) => !['q', 'o', 'e'].includes(k))) })); S.baseH[p.id] = bmap(p.items); persist() });
    await H.rateQ(d1, 'pQ', 'Qcm1', true); await H.leave(d1); await e.both(3);
    await reset(d1, ['pQ']); await H.sync(d1);
    const n0 = e.srv.log.length; await H.sync1(d2);
    const w2 = e.srv.log.slice(n0).filter(l => l[0] == 'put' && l[1] == 'pQ').length;
    t.ok(w2 === 0, 'réception d\'une remise à zéro sans modification locale [' + mode + '] : l\'appareil ne réécrit pas le paquet', w2 + ' écriture(s) du paquet');
    const pd = await H.pack(d2, 'pQ');
    t.ok(pd.gn === nodeOf(e, 'pQ').gn && pd.items.every(i => i.st == null && i.ev == null), 'la remise à zéro est bien appliquée sur l\'appareil qui la reçoit [' + mode + ']');
    await e.both(3); t.ok(await same(e), 'appareils et serveur identiques [' + mode + ']'); t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript [' + mode + ']', d1.errs.concat(d2.errs).join(' | '));
    await e.close();
  }

  // ---------- 6) version du format des empreintes (BHV) : une base d'un autre format est ignorée puis reconstruite, jamais interprétée ----------
  {
    const e = await setups(b, true), { d1 } = e;
    t.ok(await d1.page.evaluate(() => S.baseHv === BHV && Object.keys(S.baseH).length >= 5), 'base au format courant après la synchro (S.baseHv = BHV, tous les paquets)');
    // base d'un autre format : empreintes d'une ancienne formule pour le QCM
    await d1.page.evaluate(() => { S.baseHv = 1; for (const id in S.baseH) for (const k in S.baseH[id]) S.baseH[id][k] = S.baseH[id][k].map(h => 'ancien-' + h); persist() });
    t.ok(await d1.page.evaluate(() => cPlan(G('pQ'), JSON.parse(JSON.stringify(G('pQ'))), false) === null), 'base d\'un autre format : aucune fusion à trois versions (ancienne règle), rien n\'est comparé à ces empreintes');
    await e.d2.page.evaluate(() => { const p = G('pQ'); p.items[0].e = 'modifié sur l\'autre appareil'; p.u = hlc(); save() }); await H.sync(e.d2);
    await H.rateQ(d1, 'pQ', 'Qcm2', true); await H.leave(d1); await e.both(3);
    t.ok(await d1.page.evaluate(() => S.baseHv === BHV && cj(S.baseH.pQ) === cj(bmap(G('pQ').items))), 'après une synchro réussie : base reconstruite au format courant');
    t.ok((await H.item(d1, 'pQ', 'Qcm2')).st != null && await same(e), 'pendant la reconstruction : la note locale est gardée, appareils et serveur identiques');
    // limite documentée (A1, point 6) : sans base exploitable, une modification de contenu concurrente suit l'ancienne règle « le paquet le plus récent gagne »
    t.known((await H.item(d1, 'pQ', 'Qcm1')).e === 'modifié sur l\'autre appareil', 'pendant la reconstruction de la base : modification de contenu faite en parallèle sur l\'autre appareil (ancienne règle « u le plus récent » : limite connue, fenêtre d\'une synchro après une mise à jour)');
    t.ok(!e.d1.errs.length && !e.d2.errs.length, 'aucune erreur JavaScript (BHV)', e.d1.errs.concat(e.d2.errs).join(' | '));
    await e.close();
  }
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
