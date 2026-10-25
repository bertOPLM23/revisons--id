// Régression FSRS : le calcul (plan, opts, applyP avec fuzz) doit rester identique à la référence enregistrée,
// et respecter ses invariants sur une marche aléatoire. Aucun navigateur : le bloc FSRS est extrait d'index.html.
// node tests/t-fsrs.js --update  → réenregistre la référence (à ne faire que si le calcul doit changer volontairement)
const fs = require('fs'), path = require('path'), H = require('./lib/h');
const REF = path.join(__dirname, 'fsrs-reference.json');

function engine() {
  const src = fs.readFileSync(H.HTML, 'utf8');
  const a = src.indexOf('// ---- FSRS-5'), b0 = src.indexOf('const applyP=', a), b = src.indexOf('\n', b0);
  if (a < 0 || b0 < 0) throw new Error('bloc FSRS introuvable dans index.html');
  let seed = 1, TODAY = 20000;
  const M = Object.create(Math); M.random = () => { seed = (seed * 1664525 + 1013904223) >>>0; return seed / 4294967296 };
  const cfg = { rt: .9, srs: true };
  const E = new Function('Math', 'cfg', 'day', 'capOf', 'INT', src.slice(a, b) + ';return {FW,fI,plan,opts,applyP,fz}')(M, cfg, () => TODAY, () => null, [1, 3, 7, 14, 30]);
  return { E, setDay: d => { TODAY = d }, setSeed: s => { seed = s }, cfg, get today() { return TODAY } };
}

function cases(X) {
  const out = [], E = X.E;
  const states = [{}];
  for (const st of [1, 3]) for (const k of [0, 1]) states.push({ st, s: .8, df: 6, l: 20000, d: 20000, k });
  for (const s of [.3, 1, 3.17, 9, 40, 400]) for (const df of [1.2, 5, 9.6]) for (const el of [0, 1, 3, 30, 400]) states.push({ st: 2, s, df, l: 20000 - el, d: 20000 });
  states.push({ b: 2, d: 20000 }, { d: 20000 }); // anciens formats
  for (const rt of [.85, .9, .95]) {
    X.cfg.rt = rt;
    states.forEach((s0, i) => {
      X.setDay(20000); out.push(['opts', rt, i, X.E.opts({ ...s0 }).map(p => [p.st, +p.s.toFixed(6), +p.df.toFixed(6), p.iv ?? null, p.m ?? null, p.k ?? null])]);
      for (let g = 1; g <= 4; g++) { X.setSeed(1000 + i * 4 + g); const it = { ...s0 }; X.E.applyP(it, X.E.opts(it)[g - 1]); out.push(['apply', rt, i, g, it]) }
    });
  }
  X.cfg.rt = .9; return out;
}

function walk(X) { // invariants sur 60 000 notations aléatoires
  const E = X.E; let s = 7; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296 }; const bad = [];
  for (let c = 0; c < 1000; c++) {
    const it = {}; let T = 20000;
    for (let k = 0; k < 60; k++) {
      T += r() < .5 ? 0 : Math.floor(r() * r() * 400); X.setDay(T);
      const P = E.opts(it), g = 1 + Math.floor(r() * 4); E.applyP(it, P[g - 1]);
      if (!(Number.isFinite(it.s) && it.s > 0 && it.df >= 1 && it.df <= 10 && Number.isFinite(it.d) && it.d >= T)) bad.push(JSON.stringify(it));
      for (let j = 1; j < 4; j++) if (P[j - 1].iv != null && P[j].iv != null && P[j].iv < P[j - 1].iv) bad.push('ordre ' + JSON.stringify(P.map(x => x.iv)));
    }
  }
  return bad;
}

async function run() {
  const t = H.suite('FSRS : référence et invariants');
  const X = engine(), cur = cases(X);
  if (process.argv.includes('--update') || !fs.existsSync(REF)) { fs.writeFileSync(REF, JSON.stringify(cur)); t.ok(true, 'référence enregistrée (' + cur.length + ' cas)') }
  else {
    const ref = JSON.parse(fs.readFileSync(REF, 'utf8')), A = cur.map(x => JSON.stringify(x));
    const diff = ref.map(x => JSON.stringify(x)).filter((x, i) => x !== A[i]);
    t.ok(ref.length === cur.length && !diff.length, 'calcul identique à la référence (' + ref.length + ' cas)', diff.slice(0, 2).join('\n'));
  }
  const bad = walk(X); t.ok(!bad.length, 'invariants sur 60 000 notations aléatoires', bad.slice(0, 2).join('\n'));
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
