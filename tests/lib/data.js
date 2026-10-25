// Jeu de données fictif (aucune donnée réelle) : dossier « Cours » > « Anat » / « Bio », paquets fc et qcm aux états variés.
exports.mk = T => {
  let n = 0; const nodes = [];
  const pack = (id, p, k, name, items, x = {}) => nodes.push({ id, p, k, name, items, u: 1000 + (n++), ...x });
  const fc = (i, x = {}) => ({ q: 'Q' + i, a: 'R' + i, ...x });
  const qc = (i, x = {}) => ({ q: 'QQ' + i, o: [0, 1, 2, 3, 4].map(j => ({ t: 'p' + j, k: j < 2 })), e: '', ...x });
  const rev = (s, df, l, d, x = {}) => ({ st: 2, s, df, l: T + l, d: T + d, n: 3, m: 0, t: 1e12, ...x });
  nodes.push({ id: 'f1', p: 0, k: 'f', name: 'Cours', u: 1 }, { id: 'f2', p: 'f1', k: 'f', name: 'Anat', u: 1 }, { id: 'f3', p: 'f1', k: 'f', name: 'Bio', u: 1 });
  pack('pA', 'f2', 'fc', 'Os', [fc(1, rev(10, 5, -10, 0)), fc(2, rev(4, 6, -9, -5)), fc(3, rev(30, 4, -10, 20)), fc(4), fc(5),
    fc(6, { st: 1, s: .4, df: 6, l: T, d: T, k: 1, n: 1, m: 0, t: 1e12 }), fc(7, { st: 3, s: 1.2, df: 7, l: T - 1, d: T - 1, n: 5, m: 2, t: 1e12 }), fc(8, rev(8, 5, -3, 5)),
    // jumelles : même état de départ (test d'annulation : témoin et essai)
    fc('J1', rev(10, 5, -10, 0)), fc('J2', rev(10, 5, -10, 0))]);
  pack('pB', 'f2', 'qcm', 'Os QCM', [qc(1, rev(10, 5, -10, 0)), qc(2), qc(3), qc(4, rev(20, 5, -20, -2)),
    { q: 'QQ-sans-bonne', o: [0, 1, 2, 3, 4].map(j => ({ t: 'p' + j, k: false })), e: '' }]);
  pack('pC', 'f3', 'fc', 'Cell', [fc(1), fc(2), fc(3, rev(5, 5, -6, -1)), fc(4, rev(5, 5, -6, -1))], { h: 1 });
  pack('pD', 'f3', 'fc', 'Gen', Array.from({ length: 30 }, (_, i) => fc(i + 1)));
  return { gid: 'g-test', t: Date.now(), nodes };
};
