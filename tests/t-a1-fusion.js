// A1 : le contenu des cartes (ajouts, corrections, suppressions) se fusionne à trois versions (locale, distante, base = dernière synchro réussie).
// Rien de ce qui est fait sur un appareil ne doit disparaître parce que l'autre appareil a un « u » plus récent ; une suppression ne ressuscite jamais ;
// les remises à zéro et restaurations (A2) gardent leur sens ; les coupures de connexion ne perdent rien. Tout est déterministe (appareils hors ligne à la main, serveur simulé).
const H = require('./lib/h'), M = require('./lib/md');
const J = M.canon;
const qs = p => p.items.map(i => i.q);
const dup = a => a.length !== new Set(a).size;
const add = (d, pid, q, a = 'x', x = {}) => d.page.evaluate(([pid, q, a, x]) => { const p = G(pid); p.items.push({ q, a, ...x }); p.u = hlc(); save() }, [pid, q, a, x]);
const edit = (d, pid, q, f) => d.page.evaluate(([pid, q, f]) => { const p = G(pid); const i = p.items.find(x => x.q == q); Object.assign(i, f); p.u = hlc(); save() }, [pid, q, f]);
const del = (d, pid, q) => d.page.evaluate(([pid, q]) => { const p = G(pid); p.items = p.items.filter(x => x.q != q); p.u = hlc(); save() }, [pid, q]);
const offline = (...ds) => ds.forEach(d => { d.offline = true });
const snap = d => d.page.evaluate(() => JSON.parse(JSON.stringify(S.nodes.filter(n => !n.x))));
const restore = (d, nodes) => d.page.evaluate(n => { view = 'browse'; rs = { date: 'test', np: 1, nodes: n }; return A.rsok() }, nodes);
const reset = (d, ids) => d.page.evaluate(ids => { askReset(ids); const f = CF; CF = null; AS = null; return f ? f() : null }, ids);
const recs = d => d.page.evaluate(() => typeof REC == 'undefined' ? [] : JSON.parse(JSON.stringify(REC)));
const hasRec = async (ds, kind, test) => { for (const d of ds) for (const r of await recs(d)) if (r.kind == kind && r.packs.some(p => p.items.some(test))) return true; return false };
const nodeOf = (e, id) => e.srv.T.get(id) && e.srv.T.get(id).data;
const exam = async d => { await d.page.evaluate(() => { cur = nid('f2'); view = 'browse'; A.exs(); A.xgo(); deck.items.forEach((it, j) => { ex.s[j] = Object.fromEntries(po(it).map((x, k) => [k, !!x.k])) }); A.xfin() }); await H.leave(d); await d.page.waitForTimeout(50) };
// reconnexion dans un ordre donné : le premier qui revient synchronise d'abord
const back = async (e, order) => { const seq = order == 'd1 puis d2' ? [e.d1, e.d2] : [e.d2, e.d1]; for (const d of seq) { d.offline = false; await H.sync(d) } await e.both(3) };
const safe = async f => { try { await f() } catch (x) { CUR.ok(false, 'exception : ' + String(x && x.stack || x).slice(0, 400)) } };
let CUR = null;
const ORD = ['d1 puis d2', 'd2 puis d1'];
const everywhere = async (e, pid) => [['appareil 1', await H.pack(e.d1, pid)], ['appareil 2', await H.pack(e.d2, pid)], ['serveur', nodeOf(e, pid)]];
const same = async e => await M.packsJSON(e.d1) === await M.packsJSON(e.d2) && await M.packsJSON(e.d1) === M.serverPacks(e.srv);
const quiet = async (e, t, lab) => { const n0 = e.srv.log.length, j0 = await M.packsJSON(e.d1); for (let k = 0; k < 5; k++) await e.both(1); t.ok(e.srv.log.length === n0 && await M.packsJSON(e.d1) === j0, '10 synchros au repos : 0 écriture, données inchangées ' + lab, (e.srv.log.length - n0) + ' écriture(s)') };
const noerr = (t, e, lab) => t.ok(!e.d1.errs.length && !e.d2.errs.length, 'aucune erreur JavaScript ' + lab, e.d1.errs.concat(e.d2.errs).join(' | '));

async function run(b) {
  const t = H.suite('A1 — fusion du contenu à trois versions, conflits, coupures'); CUR = t;

  // ---------- 1) ajouts des deux côtés, hors ligne, l\'un des deux ayant en plus noté une carte (son u est le plus récent) ----------
  for (const order of ORD) for (const last of ['d1', 'd2']) await safe(async () => {
    const lab = '[' + order + ', dernier à modifier : ' + last + ']';
    const e = await M.setup({ browser: b }), { d1, d2 } = e; offline(d1, d2);
    const A = last == 'd1' ? d2 : d1, B = last == 'd1' ? d1 : d2;            // A modifie en premier (u plus ancien), B ensuite
    await add(A, 'pD', 'Ajout A1'); await add(A, 'pD', 'Ajout A2');
    await add(B, 'pD', 'Ajout B1'); await H.rate(B, 'pD', 'Q3', 3); await H.leave(B);
    await back(e, order);
    for (const [nm, p] of await everywhere(e, 'pD')) { const k = qs(p); t.ok(['Ajout A1', 'Ajout A2', 'Ajout B1'].every(x => k.includes(x)) && !dup(k) && k.length == 33, nm + ' : les 3 ajouts des deux appareils, sans doublon ' + lab, k.slice(-4).join(', ') + ' (' + k.length + ')') }
    t.ok((await H.item(d1, 'pD', 'Q3')).st != null && (await H.item(d2, 'pD', 'Q3')).st != null, 'la note faite pendant ce temps est gardée ' + lab);
    t.ok(await same(e), 'appareils et serveur identiques ' + lab);
    await quiet(e, t, lab); noerr(t, e, lab); await e.close();
  });

  // ---------- 2) correction du texte d\'une carte sur un appareil, notation de la même carte sur l\'autre ----------
  for (const order of ORD) await safe(async () => {
    const lab = '[' + order + ']';
    const e = await M.setup({ browser: b }), { d1, d2 } = e; offline(d1, d2);
    await edit(d1, 'pD', 'Q5', { a: 'R5 corrigée' }); await edit(d1, 'pD', 'Q6', { q: 'Q6 bis' });
    await H.rate(d2, 'pD', 'Q5', 3); await H.rate(d2, 'pD', 'Q6', 3); await H.leave(d2);
    await back(e, order);
    for (const [nm, p] of await everywhere(e, 'pD')) {
      const q5 = p.items.find(i => i.q == 'Q5'), q6 = p.items.find(i => i.q == 'Q6 bis');
      t.ok(q5 && q5.a == 'R5 corrigée' && q5.st != null && q6 && q6.st != null && !qs(p).includes('Q6') && p.items.length == 30 && !dup(qs(p)), nm + ' : réponse corrigée + note gardées ; question renommée garde la note de l\'autre appareil ' + lab, JSON.stringify([q5, q6]));
    }
    t.ok(await same(e), 'appareils et serveur identiques ' + lab); await quiet(e, t, lab); noerr(t, e, lab); await e.close();
  });
  await safe(async () => { // compteurs d\'examen (ev) et explication corrigée d\'un QCM
    const e = await M.setup({ browser: b }), { d1, d2 } = e; offline(d1, d2);
    await edit(d1, 'pB', 'QQ2', { e: 'explication corrigée' }); await exam(d2);
    await back(e, 'd1 puis d2');
    const q = await H.item(d2, 'pB', 'QQ2'), q1 = await H.item(d1, 'pB', 'QQ2'), qs_ = nodeOf(e, 'pB').items.find(i => i.q == 'QQ2');
    t.ok([q, q1, qs_].every(x => x.e == 'explication corrigée' && x.ev && x.ev.dev2 && x.ev.dev2[0] >= 1), 'explication corrigée sur un appareil + examen sur l\'autre : les deux sont gardés partout', JSON.stringify([q.e, q.ev]));
    t.ok(await same(e), 'appareils et serveur identiques'); noerr(t, e, ''); await e.close();
  });

  // ---------- 3) suppression : ne ressuscite jamais, même si l\'autre appareil a noté la carte supprimée (u plus récent) ----------
  for (const order of ORD) await safe(async () => {
    const lab = '[' + order + ']';
    const e = await M.setup({ browser: b }), { d1, d2 } = e; offline(d1, d2);
    await del(d1, 'pD', 'Q7'); await del(d1, 'pD', 'Q8');
    await H.rate(d2, 'pD', 'Q7', 3); await H.rate(d2, 'pD', 'Q7', 4); await H.leave(d2); await edit(d2, 'pD', 'Q8', { a: 'R8 modifiée ailleurs' }); await add(d2, 'pD', 'Ajout D2');
    await back(e, order);
    for (const [nm, p] of await everywhere(e, 'pD')) { const k = qs(p); t.ok(!k.includes('Q7') && !k.includes('Q8') && k.includes('Ajout D2') && k.length == 29 && !dup(k), nm + ' : cartes supprimées absentes (même notée / modifiée ailleurs), ajout gardé ' + lab, k.length + ' cartes') }
    t.ok(await hasRec([d1, d2], 'conflit-contenu', i => i.q == 'Q8' && i.a == 'R8 modifiée ailleurs'), 'la modification écartée (Q8) est conservée dans la copie de récupération ' + lab);
    t.ok(!(await hasRec([d1, d2], 'conflit-contenu', i => i.q == 'Q7')), 'une simple note sur une carte supprimée n\'est pas un conflit de contenu ' + lab);
    await quiet(e, t, lab);
    await d2.reload(); await e.both(3); await d1.reload(); await e.both(3);
    for (const [nm, p] of await everywhere(e, 'pD')) t.ok(!qs(p).includes('Q7') && !qs(p).includes('Q8'), nm + ' : toujours absentes après rechargement et nouvelles synchros ' + lab);
    t.ok(await same(e), 'appareils et serveur identiques ' + lab); noerr(t, e, lab); await e.close();
  });
  await safe(async () => { // supprimer par l\'appareil qui a la progression ; l\'autre ajoute et corrige autour
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await H.rate(d1, 'pD', 'Q9', 3); await H.leave(d1); await e.both(); offline(d1, d2);
    await del(d1, 'pD', 'Q9'); await add(d2, 'pD', 'Ajout autour'); await edit(d2, 'pD', 'Q10', { a: 'R10 corrigée' });
    await back(e, 'd2 puis d1');
    for (const [nm, p] of await everywhere(e, 'pD')) t.ok(!qs(p).includes('Q9') && qs(p).includes('Ajout autour') && p.items.find(i => i.q == 'Q10').a == 'R10 corrigée', nm + ' : carte notée puis supprimée = disparue ; ajout et correction de l\'autre appareil gardés');
    t.ok(await same(e), 'appareils et serveur identiques'); await e.close();
  });

  // ---------- 4) même carte modifiée des deux côtés ; même question ajoutée des deux côtés ; cartes sans texte ----------
  for (const order of ORD) await safe(async () => {
    const lab = '[' + order + ']';
    const e = await M.setup({ browser: b }), { d1, d2 } = e; offline(d1, d2);
    await edit(d1, 'pD', 'Q11', { a: 'version appareil 1' }); await edit(d2, 'pD', 'Q11', { a: 'version appareil 2' });     // d2 est plus récent
    await add(d1, 'pD', 'Doublon', 'sens 1'); await add(d2, 'pD', 'Doublon', 'sens 2');
    await add(d1, 'pD', 'Identique', 'pareil'); await add(d2, 'pD', 'Identique', 'pareil');
    await add(d1, 'pD', '', 'vide 1'); await add(d2, 'pD', '', 'vide 2');
    await back(e, order);
    for (const [nm, p] of await everywhere(e, 'pD')) {
      const q11 = p.items.filter(i => i.q == 'Q11'), dbl = p.items.filter(i => i.q == 'Doublon'), idn = p.items.filter(i => i.q == 'Identique'), vid = p.items.filter(i => i.q === '');
      t.ok(q11.length == 1 && q11[0].a == 'version appareil 2', nm + ' : deux corrections de la même carte → une seule, la plus récente ' + lab, JSON.stringify(q11));
      t.ok(dbl.length == 1 && idn.length == 1, nm + ' : même question ajoutée des deux côtés → une seule carte (identique : pareil, différente : la plus récente) ' + lab);
      t.ok(vid.length == 2 && vid.some(i => i.a == 'vide 1') && vid.some(i => i.a == 'vide 2'), nm + ' : deux cartes sans texte ajoutées des deux côtés → les deux gardées ' + lab, JSON.stringify(vid));
    }
    t.ok(await hasRec([d1, d2], 'conflit-contenu', i => i.q == 'Q11' && i.a == 'version appareil 1'), 'la version écartée de Q11 est dans la copie de récupération ' + lab);
    t.ok(await hasRec([d1, d2], 'conflit-contenu', i => i.q == 'Doublon' && i.a == 'sens 1'), 'la version écartée de « Doublon » est dans la copie de récupération ' + lab);
    t.ok(await same(e), 'appareils et serveur identiques ' + lab); await quiet(e, t, lab); noerr(t, e, lab); await e.close();
  });

  // ---------- 5) remise à zéro (A2) en conflit avec ajouts, corrections, suppressions et notes de l\'autre appareil ----------
  for (const order of ORD) for (const late of [true, false]) await safe(async () => {
    const lab = '[' + order + ', modifications ' + (late ? 'après' : 'avant') + ' la remise à zéro]';
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await H.rate(d1, 'pD', 'Q1', 3); await H.rate(d1, 'pD', 'Q2', 3); await H.leave(d1); await e.both(); offline(d1, d2);
    const edits = async () => { await add(d2, 'pD', 'Ajout D2'); await edit(d2, 'pD', 'Q4', { a: 'R4 corrigée' }); await del(d2, 'pD', 'Q10'); await H.rate(d2, 'pD', 'Q6', 3); await H.leave(d2) };
    if (!late) await edits();
    await reset(d1, ['pD']); await H.rate(d1, 'pD', 'Q3', 4); await H.leave(d1);
    if (late) await edits();
    await back(e, order);
    for (const [nm, p] of await everywhere(e, 'pD')) {
      const k = qs(p), by = x => p.items.find(i => i.q == x);
      t.ok(k.includes('Ajout D2') && by('Q4').a == 'R4 corrigée' && !k.includes('Q10') && k.length == 30 && !dup(k), nm + ' : ajout, correction et suppression faits ailleurs gardés après la remise à zéro ' + lab, k.length + ' cartes');
      t.ok(by('Q3').st != null && ['Q1', 'Q2', 'Q6', 'Q4', 'Ajout D2'].every(x => by(x).st == null && by(x).n == null && by(x).ev == null), nm + ' : seule la note d\'après la remise à zéro subsiste, les notes d\'avant sont écartées ' + lab);
    }
    t.ok(await same(e), 'appareils et serveur identiques ' + lab); await quiet(e, t, lab); noerr(t, e, lab); await e.close();
  });

  // ---------- 6) restauration (A2) : elle fait foi pour les ajouts d\'avant ; ceux d\'après, de chaque appareil, se fusionnent ----------
  for (const order of ORD) await safe(async () => {
    const lab = '[' + order + ']';
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    const bk = await snap(d1); offline(d1, d2);
    await add(d1, 'pD', 'Ajout D1 avant'); await restore(d1, bk);
    await add(d2, 'pD', 'Ajout D2 avant'); await edit(d2, 'pD', 'Q3', { a: 'R3 hors ligne' });
    await back(e, order);
    for (const [nm, p] of await everywhere(e, 'pD')) { const k = qs(p); t.ok(k.length == 30 && !k.includes('Ajout D1 avant') && !k.includes('Ajout D2 avant') && p.items.find(i => i.q == 'Q3').a == 'R3', nm + ' : la restauration fait foi (ajouts et corrections d\'avant écartés) ' + lab) }
    t.ok(await hasRec([d1, d2], 'ancienne-generation', i => i.q == 'Ajout D2 avant') || await hasRec([d1, d2], 'ancienne-generation', i => i.q == 'Q3'), 'ce qui est écarté est dans la copie de récupération (A2 inchangé) ' + lab);
    // après la restauration, chacun ajoute / corrige : tout se fusionne
    offline(d1, d2);
    await add(d1, 'pD', 'Après D1'); await edit(d1, 'pD', 'Q2', { a: 'R2 après' }); await add(d2, 'pD', 'Après D2'); await del(d2, 'pD', 'Q20'); await H.rate(d2, 'pD', 'Q21', 3); await H.leave(d2);
    await back(e, order == 'd1 puis d2' ? 'd2 puis d1' : 'd1 puis d2');
    for (const [nm, p] of await everywhere(e, 'pD')) { const k = qs(p); t.ok(k.includes('Après D1') && k.includes('Après D2') && !k.includes('Q20') && p.items.find(i => i.q == 'Q2').a == 'R2 après' && p.items.find(i => i.q == 'Q21').st != null && k.length == 31 && !dup(k), nm + ' : après la restauration, les modifications des deux appareils se fusionnent ' + lab, k.length + ' cartes') }
    t.ok(await same(e), 'appareils et serveur identiques ' + lab); await quiet(e, t, lab); noerr(t, e, lab); await e.close();
  });

  // ---------- 7) coupures de connexion ----------
  await safe(async () => { // (a) l\'envoi échoue juste après la fusion : rien de perdu, rien en double, la base n\'avance pas
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await add(d1, 'pD', 'C1'); await H.sync(d1);
    await add(d2, 'pD', 'C2'); await edit(d2, 'pD', 'Q3', { a: 'R3 coupure' });
    const bh = await d2.page.evaluate(() => JSON.stringify(S.baseH.pD));
    e.srv.failPush = 3; await H.sync1(d2); e.srv.failPush = 0;
    t.ok(await d2.page.evaluate(b0 => JSON.stringify(S.baseH.pD) === b0, bh), '(a) envoi échoué : la base n\'avance pas');
    t.ok((qs(await H.pack(d2, 'pD'))).includes('C1') && qs(await H.pack(d2, 'pD')).includes('C2'), '(a) envoi échoué : l\'appareil garde la fusion en local');
    await add(d1, 'pD', 'C3'); await H.sync(d1); await e.both(3);
    for (const [nm, p] of await everywhere(e, 'pD')) { const k = qs(p); t.ok(['C1', 'C2', 'C3'].every(x => k.includes(x)) && !dup(k) && p.items.find(i => i.q == 'Q3').a == 'R3 coupure' && k.length == 33, nm + ' : après la coupure, C1, C2, C3 et la correction sont partout, sans doublon', k.length + ' cartes') }
    t.ok(await same(e), '(a) appareils et serveur identiques'); await quiet(e, t, '(a)'); noerr(t, e, '(a)'); await e.close();
  });
  await safe(async () => { // (b) coupures répétées, retours entrecroisés
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    for (let k = 0; k < 3; k++) {
      offline(d1, d2);
      await add(d1, 'pD', 'R' + k + 'a'); await add(d2, 'pD', 'R' + k + 'b'); await del(d1, 'pD', 'Q' + (12 + k)); await edit(d2, 'pD', 'Q' + (15 + k), { a: 'corr ' + k });
      d1.offline = false; await H.sync1(d1); d2.offline = false; e.srv.failPush = k == 1 ? 1 : 0; await H.sync1(d2); e.srv.failPush = 0; await H.sync1(d1); await H.sync1(d2);
    }
    await e.both(3);
    for (const [nm, p] of await everywhere(e, 'pD')) { const k = qs(p); t.ok([0, 1, 2].every(n => k.includes('R' + n + 'a') && k.includes('R' + n + 'b') && !k.includes('Q' + (12 + n)) && p.items.find(i => i.q == 'Q' + (15 + n)).a == 'corr ' + n) && !dup(k) && k.length == 33, nm + ' : 3 tours de coupures croisées, tout est gardé, rien en double', k.length + ' cartes') }
    t.ok(await same(e), '(b) appareils et serveur identiques'); await quiet(e, t, '(b)'); noerr(t, e, '(b)'); await e.close();
  });
  await safe(async () => { // (c) la base n\'inclut pas une modification faite PENDANT l\'envoi (instantané pris après la fusion)
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    const r = await d1.page.evaluate(() => { const sn = baseSnap(); const p = G('pD'); p.items.push({ q: 'Pendant l\'envoi', a: 'x' }); p.u = hlc(); baseUp(sn); return { has: 'kpendant l\'envoi' in S.baseH.pD } });
    t.ok(!r.has, '(c) une modification faite pendant l\'envoi n\'entre pas dans la base');
    await edit(d2, 'pD', 'Q1', { a: 'autre appareil' }); await H.sync(d2);
    await H.sync(d1); await e.both(3);
    for (const [nm, p] of await everywhere(e, 'pD')) t.ok(qs(p).includes('Pendant l\'envoi') && p.items.find(i => i.q == 'Q1').a == 'autre appareil', nm + ' : (c) la modification faite pendant l\'envoi n\'est pas perdue');
    t.ok(await same(e), '(c) appareils et serveur identiques'); await e.close();
  });

  // ---------- 8) séance ouverte (paquet en cours de révision) ----------
  await safe(async () => { // ajouts seulement : adoptés sur place, la progression de la séance est envoyée pendant la séance
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await d2.page.evaluate(() => { A.go('pD'); window.__arr = deck.items; window.__i0 = q[0]; window.__c0 = deck.items[q[0]] });
    await add(d1, 'pD', 'Ajout séance'); await H.sync(d1);
    await d2.page.evaluate(() => { back = true; A.rate(3) }); await H.sync(d2);
    t.ok(await d2.page.evaluate(() => view == 'study' && deck.items === window.__arr && deck.items[window.__i0] === window.__c0 && deck.items.some(i => i.q == 'Ajout séance')), 'séance : un ajout distant est adopté sur place, index de séance intacts');
    const ps = nodeOf(e, 'pD'); t.ok(ps.items.some(i => i.q == 'Ajout séance') && ps.items.filter(i => i.st != null).length == 1, 'séance : le serveur a l\'ajout ET la note faite pendant la séance');
    await H.leave(d2); await e.both(3); t.ok(await same(e), 'séance (ajout) : appareils et serveur identiques'); noerr(t, e, 'séance (ajout)'); await e.close();
  });
  for (const order of ['séance finie avant le retour', 'coupure pendant la séance']) await safe(async () => { // suppression + correction distantes : différées, jamais écrasées
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    await d2.page.evaluate(() => { A.go('pD'); window.__arr = deck.items; window.__i0 = q[0]; window.__c0 = deck.items[q[0]]; window.__n = deck.items.length });
    if (order != 'séance finie avant le retour') offline(d2);
    await del(d1, 'pD', 'Q29'); await edit(d1, 'pD', 'Q30', { a: 'R30 corrigée' }); await add(d1, 'pD', 'Ajout S2'); await H.sync(d1);
    await d2.page.evaluate(() => { back = true; A.rate(3) });
    if (order == 'séance finie avant le retour') { await H.sync(d2); await H.sync(d2) } else { d2.offline = false; await H.sync(d2) }
    t.ok(await d2.page.evaluate(() => view == 'study' && deck.items === window.__arr && deck.items[window.__i0] === window.__c0 && deck.items.length == window.__n), 'séance [' + order + '] : suppression/correction distantes différées, tableau et index de séance intacts');
    const ps = nodeOf(e, 'pD'); t.ok(!ps.items.some(i => i.q == 'Q29') && ps.items.find(i => i.q == 'Q30').a == 'R30 corrigée' && ps.items.some(i => i.q == 'Ajout S2'), 'séance [' + order + '] : le serveur garde la version de l\'autre appareil (non écrasée par le paquet de la séance)');
    await H.leave(d2); await e.both(4);
    for (const [nm, p] of await everywhere(e, 'pD')) { const k = qs(p); t.ok(!k.includes('Q29') && p.items.find(i => i.q == 'Q30').a == 'R30 corrigée' && k.includes('Ajout S2') && p.items.filter(i => i.st != null).length == 1 && !dup(k), nm + ' : après la séance [' + order + '] : suppression, correction, ajout ET note de la séance présents') }
    t.ok(await same(e), 'séance [' + order + '] : appareils et serveur identiques'); await quiet(e, t, '[' + order + ']'); noerr(t, e, '[' + order + ']'); await e.close();
  });

  // ---------- 9) pas de base (ancienne version / première synchro) : ancienne logique, rien ne casse, la base se reconstruit ----------
  await safe(async () => {
    const e = await M.setup({ browser: b }), { d1, d2 } = e;
    t.ok(await d1.page.evaluate(() => Object.keys(S.baseH || {}).length >= 4), 'la base est construite après la première synchro (tous les paquets)');
    for (const d of [d1, d2]) await d.page.evaluate(() => { delete S.baseH; persist() });
    offline(d1, d2); await add(d1, 'pD', 'Sans base 1'); await add(d2, 'pD', 'Sans base 2'); await H.rate(d2, 'pD', 'Q1', 3); await H.leave(d2);
    await back(e, 'd1 puis d2');
    t.ok(await same(e), 'sans base : appareils et serveur identiques (repli sur l\'ancienne règle « le plus récent gagne »)');
    t.ok(await d1.page.evaluate(() => Object.keys(S.baseH || {}).length >= 4) && await d2.page.evaluate(() => Object.keys(S.baseH || {}).length >= 4), 'sans base : la base est reconstruite à la fin de la synchro');
    await quiet(e, t, '(sans base)'); noerr(t, e, '(sans base)'); await e.close();
  });
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
