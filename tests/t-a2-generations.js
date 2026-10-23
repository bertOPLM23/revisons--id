// A2 : générations (gn, gw, gc), copie de récupération locale, appariement prudent.
// Remise à zéro et restauration deviennent l'état de référence sur tous les appareils (contenu, progression, ev, drapeaux, suppressions),
// journaux préservés ; ajouts hors ligne écartés → copie de récupération locale, jamais réinjectée automatiquement.
// « Ancien client » = b91e359 (avant les générations) : l'auto-réparation est testée avec des horloges à +24 h, 0 et −1 h.
const H = require('./lib/h'), M = require('./lib/md'), cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const OLD = path.join(os.tmpdir(), 'rev-old-b91e359.html');
if (!fs.existsSync(OLD)) fs.writeFileSync(OLD, cp.execSync('git show b91e359:index.html', { cwd: H.ROOT, maxBuffer: 1 << 26 }));
const J = M.canon;
const snap = d => d.page.evaluate(() => JSON.parse(JSON.stringify(S.nodes.filter(n => !n.x))));
const restore = (d, nodes) => d.page.evaluate(n => { view = 'browse'; rs = { date: 'test', np: 1, nodes: n }; return A.rsok() }, nodes);
const reset = (d, ids) => d.page.evaluate(ids => { askReset(ids); const f = CF; CF = null; AS = null; return f ? f() : null }, ids);
const exam = async d => { await d.page.evaluate(() => { cur = nid('f2'); view = 'browse'; A.exs(); A.xgo(); deck.items.forEach((it, j) => { ex.s[j] = Object.fromEntries(po(it).map((x, k) => [k, !!x.k])) }); A.xfin() }); await H.leave(d); await d.page.waitForTimeout(250) };
const prog = p => p.items.map(i => H.fsr(i) + '#' + J(i.ev || null)).join('\n');
const logsOf = d => d.page.evaluate(() => JSON.stringify(S.nodes.filter(n => n.k == 'log').sort((a, b) => a.id < b.id ? -1 : 1).map(l => [l.id, l.h, l.r])));
const nodeOf = (e, id) => e.srv.T.get(id) && e.srv.T.get(id).data;
const strip = o => JSON.parse(JSON.stringify(o, (k, v) => ['gn', 'gw', 'u', 't', 'w', 'hu', 'pu', 'ou', 'gc'].includes(k) ? undefined : v));
const recOf = d => d.page.evaluate(() => typeof REC == 'undefined' ? [] : JSON.parse(JSON.stringify(REC)));   // (tolérant : permet de rejouer le test sur une version sans récupération)
const failStore = d => d.page.evaluate(() => { window.__o = { put: IDBObjectStore.prototype.put, set: Storage.prototype.setItem }; IDBObjectStore.prototype.put = function (v, k) { if (k === 'R') throw new Error('idb'); return window.__o.put.apply(this, arguments) }; Storage.prototype.setItem = function (k, v) { if (k === 'revis-rec') throw new Error('ls'); return window.__o.set.apply(this, arguments) } });
const okStore = d => d.page.evaluate(() => { IDBObjectStore.prototype.put = window.__o.put; Storage.prototype.setItem = window.__o.set });
const quiet = async (e, t, lab) => { const n0 = e.srv.log.length; for (let k = 0; k < 5; k++) await e.both(1); t.ok(e.srv.log.length === n0, '10 synchros au repos : 0 écriture ' + lab, (e.srv.log.length - n0) + ' écriture(s)') };

async function run(b) {
  const t = H.suite('A2 — générations, récupération locale, anciens clients');

  // ---------- R1 : remise à zéro ; l'appareil 2 est hors ligne avec progression ET examen faits AVANT de recevoir la remise à zéro ----------
  for (const order of ['d1 puis d2', 'd2 puis d1']) {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await H.rate(d2, 'pA', 'Q1', 3); await H.leave(d2); await exam(d2); await e.both();
    d2.offline = true; await H.rate(d2, 'pA', 'Q2', 3); await H.leave(d2); await exam(d2);
    const lg2 = await logsOf(d2);
    await reset(d1, ['pA', 'pB']); await H.sync(d1);
    d2.offline = false; const [x, y] = order == 'd1 puis d2' ? [d1, d2] : [d2, d1]; await H.sync(x); await H.sync(y); await e.both(3);
    const empty = p => !!(p && p.items) && p.items.every(i => i.st == null && i.d == null && i.n == null && i.ev == null);
    t.ok(empty(await H.pack(d1, 'pA')) && empty(await H.pack(d2, 'pA')) && empty(nodeOf(e, 'pA')) && empty(await H.pack(d1, 'pB')) && empty(await H.pack(d2, 'pB')) && empty(nodeOf(e, 'pB')), 'remise à zéro : progression ET compteurs ev vides partout après le retour de l\'appareil hors ligne [' + order + ']');
    const l2 = JSON.parse(await logsOf(d2)).find(l => l[0] == 'log-dev2'), l2o = JSON.parse(lg2).find(l => l[0] == 'log-dev2');
    t.ok(J(l2) === J(l2o), 'remise à zéro : le journal de l\'appareil revenu est intact (ses notes et examens restent comptés) [' + order + ']');
    t.ok(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv), 'appareils et serveur identiques [' + order + ']');
    await quiet(e, t, '[' + order + ']');
    t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript [' + order + ']', d1.errs.concat(d2.errs).join(' | '));
    await e.close();
  }

  // remise à zéro puis nouvelle note ; contenu modifié hors ligne par l'autre appareil (le contenu suit « u », la progression suit la génération)
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await H.rate(d2, 'pD', 'Q1', 3); await H.leave(d2); await e.both();
    d2.offline = true; await H.rate(d2, 'pD', 'Q2', 3); await H.leave(d2); await d2.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'Ajout D2', a: 'x' }); p.u = hlc() + 5000; save() });   // l'édition porte le u le plus récent (le contenu suit u : règle inchangée, voir A1)
    await reset(d1, ['pD']); await H.rate(d1, 'pD', 'Q3', 4); await H.leave(d1); await H.sync(d1);
    d2.offline = false; await e.both(4);
    const p = await H.pack(d1, 'pD');
    t.ok(p.items.some(i => i.q == 'Ajout D2') && p.items.find(i => i.q == 'Q3').st != null && p.items.find(i => i.q == 'Q1').st == null && p.items.find(i => i.q == 'Q2').st == null, 'remise à zéro + contenu modifié ailleurs : l\'ajout est gardé, la note faite après la remise à zéro est gardée, les notes d\'avant sont écartées');
    t.ok(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv), 'appareils et serveur identiques');
    await e.close();
  }

  // ---------- R2 : restauration ancienne ; contenu, progression, ev, drapeaux, suppressions ; journaux préservés ----------
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await exam(d1); await e.both();
    const bk = await snap(d1), refA = prog(bk.find(n => n.id == 'pA')), refB = prog(bk.find(n => n.id == 'pB'));
    await H.rate(d2, 'pA', 'Q1', 3); await H.leave(d2); await exam(d2);
    await d2.page.evaluate(() => { flagSet([G('pC')], 'pn', 'pu', true, 'épinglé'); S.nodes.push({ id: 'pNew', p: 'f2', k: 'fc', name: 'Nouveau', items: [{ q: 'N1', a: 'x' }], u: hlc() }); save() }); await e.both(3);
    const lgBefore = [await logsOf(d1), await logsOf(d2)];
    const r0 = await restore(d1, bk); await e.both(3);
    const ok = d => d.page.evaluate(([a, b]) => { const f = x => x.items.map(i => ['st', 's', 'df', 'l', 'k', 'd', 'f'].map(k => i[k] === undefined ? '' : i[k]).join('|') + '#' + JSON.stringify(i.ev || null)).join('\n'); return f(G('pA')) === a && f(G('pB')) === b }, [refA, refB]).catch(() => false);
    const okS = prog(nodeOf(e, 'pA')) === refA && prog(nodeOf(e, 'pB')) === refB;
    t.ok(await ok(d1) && await ok(d2) && okS, 'restauration : progression ET compteurs ev de la sauvegarde sur les deux appareils et au serveur (les ev d\'après la sauvegarde disparaissent)');
    t.ok(await d2.page.evaluate(() => !G('pC').pn) && await d1.page.evaluate(() => !G('pC').pn), 'restauration : drapeau « épinglé » posé après la sauvegarde retiré partout');
    t.ok(await d1.page.evaluate(() => G('pNew').x === 1) && await d2.page.evaluate(() => G('pNew').x === 1) && nodeOf(e, 'pNew').x === 1, 'restauration : paquet créé après la sauvegarde supprimé partout');
    t.ok(await logsOf(d1) === lgBefore[0] && await logsOf(d2) === lgBefore[1], 'restauration : journaux des deux appareils inchangés (même contenu avant et après)');
    t.ok(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv), 'appareils et serveur identiques');
    // restaurations répétées : même état, aucune écriture au repos, rien ne ressuscite
    const s1 = J(strip(JSON.parse(await M.packsJSON(d1))));
    await restore(d1, bk); await e.both(3); await restore(d2, bk); await e.both(3);
    t.ok(J(strip(JSON.parse(await M.packsJSON(d1)))) === s1 && await M.packsJSON(d1) === await M.packsJSON(d2), 'restaurations répétées (sur les deux appareils) : même état final, aucune résurrection');
    await quiet(e, t, '(après restaurations répétées)');
    await e.close();
  }

  // ---------- R3 : suppression par restauration ; l'appareil 2 (horloge en avance) a ajouté une carte hors ligne : copie de récupération ----------
  {
    const e = await M.setup({ browser: b, d2: { off: 3600e3 } }), { d1, d2 } = e;
    const bk = (await snap(d1)).filter(n => n.id != 'pD'); const nbk = (await snap(d1)).length;
    d2.offline = true; await d2.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'Ajout hors ligne', a: 'précieux' }); p.u = hlc(); save() }); await H.rate(d2, 'pD', 'Q1', 3); await H.leave(d2);
    await restore(d1, bk); await H.sync(d1);
    const r1 = await recOf(d1);
    t.ok(r1.length === 1 && r1[0].kind == 'avant-restauration' && r1[0].packs.some(p => p.pid == 'pD' && p.items.length == 30), 'restauration : copie de sécurité de l\'état de l\'appareil créée avant la restauration (contient le paquet supprimé)');
    d2.offline = false; await H.sync(d2); await e.both(3);
    t.ok(await d1.page.evaluate(() => G('pD').x === 1) && await d2.page.evaluate(() => G('pD').x === 1) && nodeOf(e, 'pD').x === 1, 'suppression par restauration : durable malgré une horloge en avance et une note hors ligne sur l\'autre appareil');
    const r2 = await recOf(d2);
    t.ok(r2.length === 1 && r2[0].kind == 'ancienne-generation' && r2[0].packs[0].items.some(i => i.q == 'Ajout hors ligne'), 'la carte ajoutée hors ligne est conservée dans la copie de récupération de l\'appareil 2', JSON.stringify(r2.map(x => [x.kind, x.packs.map(p => p.items.length)])));
    // survit à un redémarrage et à de nouvelles synchronisations ; jamais réinjectée
    await d2.reload(); await e.both(3);
    const r3 = await recOf(d2);
    t.ok(r3.length === 1 && J(r3[0]) === J(r2[0]), 'la copie de récupération survit au redémarrage et aux synchronisations suivantes, sans doublon');
    t.ok(await d2.page.evaluate(() => !S.nodes.some(n => n.items && n.items.some(i => i.q == 'Ajout hors ligne' && !n.x))) && await d1.page.evaluate(() => !S.nodes.some(n => n.items && n.items.some(i => i.q == 'Ajout hors ligne' && !n.x))), 'aucune réinjection automatique : la carte n\'apparaît dans aucun paquet actif');
    t.ok(!JSON.stringify([...e.srv.T.values()].map(v => v.data)).includes('précieux'), 'la copie de récupération n\'est jamais envoyée au serveur');
    // action explicite : ajout comme nouveaux paquets, puis suppression explicite
    const key = (r3[0] || {}).k;
    await d2.page.evaluate(k => { A.rca(k); const f = CF; CF = null; AS = null; f() }, key).catch(() => {});
    t.ok(await d2.page.evaluate(() => S.nodes.some(n => n.name == 'Récupération · Gen' && !n.x && n.items.some(i => i.q == 'Ajout hors ligne'))), '« Ajouter comme paquets » (geste explicite) : nouveau paquet « Récupération · … » à la racine');
    await d2.page.evaluate(k => { A.rcd(k); const f = CF; CF = null; AS = null; return f() }, key).catch(() => {}); await d2.reload();
    t.ok((await recOf(d2)).length === 0, 'suppression explicite : la copie disparaît et reste supprimée après redémarrage');
    t.ok(!d1.errs.length && !d2.errs.length, 'aucune erreur JavaScript (récupération)', d1.errs.concat(d2.errs).join(' | '));
    await e.close();
  }

  // ---------- Échecs de stockage : l'opération destructive est bloquée ----------
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    const bk = await snap(d1), before = await M.packsJSON(d1);
    await failStore(d1);
    await restore(d1, bk.filter(n => n.id != 'pA'));
    t.ok(await M.packsJSON(d1) === before && await d1.page.evaluate(() => /bloquée/.test(bm)), 'copie de sécurité impossible : la restauration est bloquée, aucune donnée modifiée');
    await reset(d1, ['pA']);
    t.ok(await M.packsJSON(d1) === before, 'copie de sécurité impossible : la remise à zéro est bloquée, aucune donnée modifiée');
    await okStore(d1);
    await reset(d1, ['pA']); await e.both(3);
    t.ok(await d1.page.evaluate(() => !!G('pA').items && G('pA').items.every(i => i.st == null)) && (await recOf(d1)).length === 1, 'stockage rétabli : la remise à zéro s\'effectue et la copie est enregistrée');
    // adoption bloquée sur l'appareil en retard si sa copie de récupération échoue
    const bk2 = (await snap(d1)).filter(n => n.id != 'pD');
    d2.offline = true; await d2.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'Ajout fragile', a: 'x' }); p.u = hlc(); save() }); await H.leave(d2);
    await restore(d1, bk2); await H.sync(d1); d2.offline = false;
    await failStore(d2); await H.sync(d2);
    t.ok(await d2.page.evaluate(() => !G('pD').x && G('pD').items.some(i => i.q == 'Ajout fragile')) && await d2.page.evaluate(() => /récupération|sécurité/i.test(sm)), 'copie de récupération impossible : la génération n\'est pas adoptée, l\'ajout reste en place, erreur de synchronisation explicite');
    await okStore(d2); await e.both(3);
    t.ok(await d2.page.evaluate(() => G('pD').x === 1) && (await recOf(d2)).some(r => r.packs[0].items.some(i => i.q == 'Ajout fragile')), 'stockage rétabli : la génération est adoptée et l\'ajout est dans la copie de récupération');
    await e.close();
  }

  // ---------- Anciens clients (b91e359) : auto-réparation, y compris avec un u supérieur à celui du serveur ----------
  for (const [op, off] of [['remise à zéro', 0], ['remise à zéro', 86400e3], ['remise à zéro', -3600e3], ['restauration', 0], ['restauration', 86400e3], ['restauration', -3600e3]]) {
    const e = await M.setup({ browser: b, d2: { html: OLD, off } }), { d1, d2 } = e, lab = 'ancien client (horloge ' + off / 3600e3 + ' h), ' + op;
    await H.rate(d1, 'pA', 'Q1', 3); await H.leave(d1); await exam(d1); await e.both();
    const bk = await snap(d1);
    d2.offline = true; await H.rate(d2, 'pA', 'Q2', 3); await H.leave(d2);
    await d2.page.evaluate(() => { const p = G('pA'); p.items.push({ q: 'Ajout de l\'ancien client', a: 'x' }); p.u = Date.now() + 1000; save() });
    if (op == 'remise à zéro') await reset(d1, ['pA', 'pB']); else { await H.rate(d1, 'pA', 'Q3', 3); await H.leave(d1); await restore(d1, bk) }
    await H.sync(d1); d2.offline = false; await e.both(4);
    const refA = op == 'remise à zéro' ? null : prog(bk.find(n => n.id == 'pA'));
    const cmp = p => op == 'remise à zéro' ? p.items.filter(i => i.q != 'Ajout de l\'ancien client').every(i => i.st == null && i.n == null && i.ev == null) : prog({ items: p.items.filter(i => i.q != 'Ajout de l\'ancien client') }) === refA;
    const good = cmp(await H.pack(d1, 'pA')) && cmp(nodeOf(e, 'pA'));
    // limite réelle : les notes hors ligne d'un ancien client dont l'horloge est EN AVANCE paraissent postérieures à l'opération (t) et ne peuvent pas être distinguées
    if (off > 0) t.known(good, lab + ' : progression d\'avant l\'opération écartée (limite : les notes d\'un ancien client dont l\'horloge est en avance paraissent plus récentes que l\'opération)');
    else t.ok(good, lab + ' : opération rétablie par l\'appareil récent (appareil et serveur conformes)');
    const inPack = (await H.pack(d1, 'pA')).items.some(i => i.q == 'Ajout de l\'ancien client'), inRec = (await recOf(d1)).some(r => r.kind == 'ancienne-generation' && r.packs.some(p => p.items.some(i => i.q == 'Ajout de l\'ancien client')));
    if (op == 'restauration' && off < 0) t.known(!inPack && inRec, lab + ' : ajout de l\'ancien client dont le u est antérieur à la restauration : le serveur refuse son envoi (u plus ancien) et l\'ancienne version n\'a pas de copie de récupération : l\'ajout n\'existe que sur cet ancien client puis est écarté par la restauration (limite des anciennes versions)');
    else if (op == 'restauration') t.ok(!inPack && inRec, lab + ' : l\'ajout de l\'ancien client n\'est plus dans le paquet restauré mais est conservé dans la copie de récupération', J([inPack, inRec]));
    else if (off >= 0) t.ok(inPack, lab + ' : son ajout de contenu (u le plus récent) est conservé');
    else t.known(inPack, lab + ' : ajout hors ligne dont le u est antérieur à la remise à zéro (contenu « dernier u gagnant » : risque A1, hors A2)');
    await e.close();
  }

  // ---------- horloges décalées : opérations concurrentes, ordres de reconnexion ----------
  {
    const finals = [];
    for (const order of ['d1 puis d2', 'd2 puis d1']) {
      const e = await M.setup({ browser: b, d1: { off: -3600e3 }, d2: { off: 3600e3 } }), { d1, d2 } = e;
      await H.rate(d1, 'pA', 'Q1', 3); await H.leave(d1); await e.both();
      const bk = await snap(d1);
      await H.rate(d1, 'pA', 'Q2', 4); await H.leave(d1); await e.both();
      d1.offline = d2.offline = true;
      await reset(d1, ['pA']);                    // horloge en retard
      await restore(d2, bk);                       // horloge en avance
      d1.offline = d2.offline = false;
      const [x, y] = order == 'd1 puis d2' ? [d1, d2] : [d2, d1]; await H.sync(x); await H.sync(y); await e.both(4);
      const f = J(strip(JSON.parse(await M.packsJSON(d1))).map(n => ({ ...n, items: (n.items || []).map(({ d, ...i }) => i) })));
      t.ok(await M.packsJSON(d1) === await M.packsJSON(d2) && await M.packsJSON(d1) === M.serverPacks(e.srv), 'horloges ±1 h, opérations concurrentes : appareils et serveur identiques [' + order + ']');
      finals.push(f); await quiet(e, t, '[' + order + ']'); await e.close();
    }
    t.ok(finals[0] === finals[1], 'horloges ±1 h : même état final quel que soit l\'ordre de reconnexion (la génération la plus élevée, départagée par l\'auteur, gagne partout)');
  }

  // ---------- paquet ouvert en séance quand l'opération arrive ----------
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await H.rate(d1, 'pD', 'Q1', 3); await H.leave(d1); await e.both();
    await d2.page.evaluate(() => { A.go('pD'); window.__c0 = deck.items[q[0]]; window.__arr = deck.items; window.__len = deck.items.length });
    await reset(d1, ['pD']); await H.sync(d1); await H.sync(d2);
    t.ok(await d2.page.evaluate(() => deck.items === window.__arr && deck.items[q[0]] === window.__c0 && deck.items.every(i => i.st == null)), 'paquet ouvert en séance : une remise à zéro reçue efface la progression sur place, les index de séance restent valides');
    const bk = (await snap(d1)).filter(n => n.id != 'pD');
    d2.offline = true; await d2.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'Ajout en séance', a: 'x' }); p.u = hlc(); save() }); d2.offline = false;
    await restore(d1, bk); await H.sync(d1);
    const n0 = e.srv.log.length; await H.sync(d2); await H.sync(d2);
    t.ok(await d2.page.evaluate(() => view == 'study' && deck.items === window.__arr && !G('pD').x), 'paquet ouvert en séance : une restauration qui supprime le paquet n\'est PAS appliquée pendant la séance (index et cartes intacts)');
    t.ok(!e.srv.log.slice(n0).some(l => l[1] == 'pD'), 'paquet ouvert en séance : le paquet local périmé n\'est pas renvoyé au serveur');
    t.ok(nodeOf(e, 'pD').x === 1, 'paquet ouvert en séance : le serveur garde la suppression');
    await H.leave(d2); await H.sync(d2); await H.sync(d2); await e.both(3);
    t.ok(await d2.page.evaluate(() => G('pD').x === 1) && (await recOf(d2)).some(r => r.packs[0].items.some(i => i.q == 'Ajout en séance')), 'à la fermeture de la séance : suppression adoptée et ajout conservé dans la copie de récupération');
    await quiet(e, t, '(après séance)');
    await e.close();
  }

  // ---------- appariement prudent : cartes dupliquées, modifiées, supprimées puis recréées (remise à zéro, contenu venant de l'autre appareil) ----------
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await d1.page.evaluate(() => { const p = G('pD'); p.items[0].q = 'Doublon'; p.items[1].q = 'Doublon'; p.items[0].a = 'a1'; p.items[1].a = 'a2'; p.u = hlc(); save() }); await e.both(3);
    await H.rate(d1, 'pD', 'Q10', 3); await H.rate(d1, 'pD', 'Doublon', 3); await H.leave(d1); await e.both(3);     // progression d'avant la remise à zéro, présente sur les deux appareils
    d2.offline = true; await H.rate(d2, 'pD', 'Q12', 3); await H.leave(d2);                                       // note hors ligne de l'appareil 2, avant de recevoir la remise à zéro
    await d2.page.evaluate(() => { const p = G('pD'); p.items[4].q = 'Q5 réécrite'; p.items.splice(6, 1); p.items.push({ q: 'Q7', a: 'recréée' }); p.u = hlc() + 5000; save() });
    await reset(d1, ['pD']); await H.rate(d1, 'pD', 'Q11', 4); await H.leave(d1); await H.sync(d1);   // note d'après
    d2.offline = false; await e.both(4);
    const p = await H.pack(d1, 'pD');
    t.ok(p.items.every(i => i.q == 'Q11' ? i.st != null : i.st == null && i.n == null), 'doublons, texte réécrit, carte supprimée puis recréée : après remise à zéro, seule la note faite après est conservée (aucun transfert hasardeux)', J(p.items.filter(i => i.st != null).map(i => i.q)));
    t.ok(p.items.filter(i => i.q == 'Doublon').length === 2 && p.items.some(i => i.q == 'Q5 réécrite') && p.items.some(i => i.q == 'Q7' && i.a == 'recréée') && !p.items.some(i => i.q == 'Q5' || (i.q == 'Q7' && i.a != 'recréée')), 'le contenu modifié par l\'autre appareil est conservé tel quel');
    t.ok(await M.packsJSON(d1) === await M.packsJSON(d2), 'les deux appareils convergent');
    await e.close();
  }

  // ---------- annulation d'une remise à zéro (< 8 s), déjà reçue par l'autre appareil : devient à son tour l'état de référence ----------
  {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await H.rate(d1, 'pA', 'Q1', 3); await H.leave(d1); await exam(d1); await e.both();
    const ref = prog(await H.pack(d1, 'pA')), refB = prog(await H.pack(d1, 'pB'));
    await reset(d1, ['pA', 'pB']); await e.both(3);
    t.ok(!(await H.pack(d2, 'pA')).items.some(i => i.st != null) , 'remise à zéro reçue par l\'autre appareil');
    await d1.page.evaluate(() => A.undo()); await e.both(4);
    t.ok(prog(await H.pack(d1, 'pA')) === ref && prog(await H.pack(d2, 'pA')) === ref && prog(nodeOf(e, 'pA')) === ref && prog(await H.pack(d2, 'pB')) === refB, 'annulation de la remise à zéro : progression et ev d\'avant rétablis partout (nouvelle génération)');
    await quiet(e, t, '(après annulation)');
    await e.close();
  }

  // ---------- S.base : mis à jour seulement après une synchronisation entièrement réussie ; sert uniquement à filtrer la récupération ----------
  for (const noBase of [false, true]) {
    const e = await M.setup({ browser: b }), { d1, d2 } = e, tag = noBase ? ' [S.base absente]' : '';
    const bk = (await snap(d1)).filter(n => n.id != 'pD');
    const baseHas = (d, k) => d.page.evaluate(k => !!((S.base || {}).pD || {})[k], k);
    await d2.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'Synchronisée A', a: 'x' }); p.u = hlc(); save() }); await e.both(3);
    t.ok(await baseHas(d2, 'synchronisee a'), 'S.base : la carte envoyée avec succès y figure après la synchronisation' + tag);
    await d2.page.evaluate(() => { const p = G('pD'); p.items.push({ q: 'Interrompue B', a: 'x' }); p.u = hlc(); save() });
    e.srv.failPush = 1; await H.sync1(d2); const failed = await d2.page.evaluate(() => syF > 0);
    t.ok(failed && !(await baseHas(d2, 'interrompue b')) && await baseHas(d2, 'synchronisee a'), 'S.base : une synchronisation interrompue ne la met pas à jour (la carte non envoyée n\'y entre pas)' + tag);
    if (noBase) await d2.page.evaluate(() => { delete S.base; persist() });
    await restore(d1, bk); await H.sync(d1);
    await H.sync(d2); await e.both(3);
    const rec = (await recOf(d2)).filter(r => r.kind == 'ancienne-generation').flatMap(r => r.packs.flatMap(p => p.items.map(i => i.q)));
    t.ok(await d2.page.evaluate(() => G('pD').x === 1), 'suppression par restauration adoptée après la synchronisation interrompue' + tag);
    if (!noBase) t.ok(rec.length === 1 && rec[0] == 'Interrompue B', 'récupération : seule la carte non synchronisée est conservée (les cartes déjà présentes à la dernière synchronisation réussie sont dans la copie de sécurité de l\'appareil qui restaure)', J(rec));
    else t.ok(rec.length === 32 && rec.includes('Interrompue B') && rec.includes('Synchronisée A') && rec.includes('Q1'), 'S.base absente : aucune base pour filtrer, toutes les cartes sans correspondance sont conservées (rien n\'est perdu)', rec.length + ' cartes');
    await quiet(e, t, tag);
    await e.close();
  }
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
