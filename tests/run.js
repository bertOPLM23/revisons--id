// Lance les tests de rev. : node tests/run.js [motif]   (ex. node tests/run.js sync)
// Chaque fichier t-*.js exporte run(browser) et renvoie une suite de vérifications.
const fs = require('fs'), path = require('path'), H = require('./lib/h');
async function main(files) {
  if (!files) {
    const pat = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
    files = fs.readdirSync(__dirname).filter(f => /^t-.*\.js$/.test(f) && f.includes(pat)).sort().map(f => path.join(__dirname, f));
  }
  const b = await H.launch(); let ko = 0, n = 0; const t0 = Date.now();
  for (const f of files) {
    const s0 = Date.now(); let s;
    try { s = await require(f).run(b) } catch (e) { s = { name: path.basename(f), checks: [{ ok: false, label: 'exception : ' + (e && e.stack || e) }] } }
    console.log('\n■ ' + s.name + '  (' + ((Date.now() - s0) / 1000).toFixed(1) + ' s)');
    for (const c of s.checks) { n++; if (!c.ok) ko++; console.log('  ' + (c.known ? 'CONNU' : c.ok ? 'OK   ' : 'ÉCHEC') + ' ' + c.label + ((!c.ok || c.known) && c.extra ? '\n        ' + String(c.extra).slice(0, 600).replace(/\n/g, '\n        ') : '')) }
  }
  await b.close();
  console.log('\n' + (n - ko) + ' / ' + n + ' vérifications réussies, ' + ko + ' en échec (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  process.exitCode = ko ? 1 : 0;
}
module.exports = { main };
if (require.main === module) main();
