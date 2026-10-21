// Simulation longue reprise de l'audit : 45 jours de révisions réelles (flashcards + QCM, notes aléatoires) sur un appareil.
// Contrôle chaque jour : compteurs = recalcul indépendant, limite de nouvelles cartes respectée, échéances valides ;
// à la fin : somme du journal = somme des n des cartes (aucune note comptée deux fois ni perdue).
const H = require('./lib/h'), D = require('./lib/data');
async function run(b) {
  const t = H.suite('Simulation 45 jours : progression, journal, compteurs');
  const T = H.dayNow(), seed = D.mk(T); seed.nodes = seed.nodes.filter(n => !['pA', 'pB', 'pC', 'pD'].includes(n.id));
  const fcs = [], qcs = []; for (let i = 0; i < 300; i++) fcs.push({ q: 'F' + i, a: 'a' }); for (let i = 0; i < 120; i++) qcs.push({ q: 'QQ' + i, o: [0, 1, 2, 3, 4].map(j => ({ t: 'p' + j, k: j % 2 == 0 })), e: '' });
  seed.nodes.push({ id: 'cf', p: 'f2', k: 'fc', name: 'CF', items: fcs, u: 5000 }, { id: 'cq', p: 'f3', k: 'qcm', name: 'CQ', items: qcs, u: 5000 });
  const d = await H.device(b, { seed, cfg: { srs: true, nl: 20, nx: true }, dev: 'dev1' }), p = d.page;
  const res = await p.evaluate(async()=>{
  let seedr=99;const rnd=()=>{seedr=(seedr*1664525+1013904223)>>>0;return seedr/4294967296};
  const gr=()=>{const x=rnd();return x<.1?1:x<.15?2:x<.9?3:4};
  const out={days:[],viol:[],ratings:0};
  for(let day0=0;day0<45;day0++){
   // contrôles avant la séance
   const T0=day();
   const all=S.nodes.filter(n=>isPack(n)&&!n.x&&!hidRel(n,0)).flatMap(n=>n.items.map(i=>({i,k:n.k})));
   const dueIndep=all.filter(x=>x.i.d!=null&&x.i.d<=T0).length, newIndep=all.filter(x=>x.i.d==null).length;
   const cnAll=cn(S.nodes.filter(n=>isPack(n)&&!n.x&&!hidRel(n,0)));
   // r compte les cartes dues (révisions + apprentissage) ; w les nouvelles autorisées
   if(cnAll.r!==dueIndep)out.viol.push(['jour '+day0+' compteur à revoir '+cnAll.r+' != indépendant '+dueIndep]);
   const exp=Math.min(newIndep,newLeft());if(cnAll.w!==exp)out.viol.push(['jour '+day0+' compteur nouvelles '+cnAll.w+' != attendu '+exp]);
   // séance flashcards puis QCM
   for(const t of ['fc','qcm']){
    cur=0;A.all(t,'both');
    if(t=='fc'){let guard=0;while(q&&q.length&&guard++<3000){const i=deck.items[q[0]];back=true;const g=gr();A.rate(g);out.ratings++}}
    else{let guard=0;while(order&&idx<order.length&&guard++<3000){const it=deck.items[order[idx]];sel={};const ok=rnd()<.8;po(it).forEach((x,j)=>{if(ok?x.k:!x.k)sel[j]=true});A.val();out.ratings++;A.next()}}
   }
   const seen=TD().seen;if(seen>20)out.viol.push(['jour '+day0+' seen='+seen+' > 20']);
   // invisibles : ni nouvelle, ni due, ni future valide
   const bad=all.filter(x=>!(x.i.d==null||Number.isFinite(x.i.d))).length;if(bad)out.viol.push(['jour '+day0+' d invalide: '+bad]);
   const learningLeft=all.filter(x=>x.i.st==1||x.i.st==3).length;
   const stats={jour:day0,vues:seen,dues_apres:all.filter(x=>x.i.d!=null&&x.i.d<=day()).length,apprentissage_restant:learningLeft,cartes_vues_total:all.filter(x=>x.i.d!=null).length};
   out.days.push(stats);
   // fin de journée : +1 jour
   window.__off=(window.__off||0)+864e5;view='browse';render();
  }
  const logSum=S.nodes.filter(n=>n.k=='log').reduce((a,l)=>a+Object.values(l.h).reduce((x,y)=>x+y,0),0);
  out.logSum=logSum;out.nTotal=S.nodes.filter(isPack).flatMap(p=>p.items).reduce((a,i)=>a+(i.n||0),0);
  return out});
 
  t.ok(!res.viol.length, 'aucune violation des invariants quotidiens (' + res.days.length + ' jours, ' + res.ratings + ' notes)', res.viol.slice(0, 5).map(v => v[0]).join('\n'));
  t.ok(res.logSum === res.ratings && res.nTotal === res.ratings, 'journal = notes = somme des n', 'journal ' + res.logSum + ', notes ' + res.ratings + ', n ' + res.nTotal);
  t.ok(!d.errs.length, 'aucune erreur JavaScript', d.errs.join(' | '));
  await d.ctx.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
