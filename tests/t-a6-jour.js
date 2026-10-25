// A6 (étape 7) : la journée de révision bascule à 4 h, heure locale (changements d'heure et fuseaux compris),
// et l'accueil se met à jour au retour au premier plan après la bascule.
const H = require('./lib/h'), D = require('./lib/data');
// jour logique attendu, calculé indépendamment de l'app (Intl)
const expected = (t, tz) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(t), g = k => +p.find(x => x.type == k).value; return Math.round(Date.UTC(g('year'), g('month') - 1, g('day')) / 864e5) - (g('hour') < 4 ? 1 : 0) };
const CASES = [
  ['Europe/Paris', '2026-10-22T03:59:00+02:00'], ['Europe/Paris', '2026-10-22T04:00:00+02:00'],
  ['Europe/Paris', '2026-10-25T01:59:00+02:00'], ['Europe/Paris', '2026-10-25T03:59:00+01:00'], ['Europe/Paris', '2026-10-25T04:00:00+01:00'], // passage à l'heure d'hiver
  ['Europe/Paris', '2027-03-28T03:59:00+02:00'], ['Europe/Paris', '2027-03-28T04:00:00+02:00'], // passage à l'heure d'été
  ['America/New_York', '2026-11-01T03:59:00-05:00'], ['America/New_York', '2026-11-01T04:00:00-05:00'],
  ['Pacific/Auckland', '2027-04-04T03:59:00+12:00'], ['Pacific/Auckland', '2027-04-04T04:00:00+12:00']];

async function run(b) {
  const t = H.suite('A6 — journée logique à 4 h');
  const byTz = {};
  for (const [tz, iso] of CASES) (byTz[tz] = byTz[tz] || []).push(iso);
  for (const tz of Object.keys(byTz)) {
    const d = await H.device(b, { seed: D.mk(H.dayNow(tz)), cfg: { srs: true, nl: 20, nx: true }, dev: 'dev1', tz });
    for (const iso of byTz[tz]) {
      const at = Date.parse(iso), got = await d.page.evaluate(at => { window.__off = at - (Date.now() - window.__off); return day() }, at);
      t.ok(got === expected(at, tz), tz + ' ' + iso + ' → jour logique', 'obtenu ' + new Date(got * 864e5).toISOString().slice(0, 10) + ', attendu ' + new Date(expected(at, tz) * 864e5).toISOString().slice(0, 10));
    }
    await d.ctx.close();
  }
  // retour au premier plan après la bascule de 4 h : l'accueil doit refléter le nouveau jour sans action
  const d = await H.device(b, { seed: D.mk(H.dayNow()), cfg: { srs: true, nl: 0, nx: true }, dev: 'dev1' }), p = d.page;
  await p.evaluate(at => { window.__off = at - (Date.now() - window.__off); const L = day(); G('pD').items.slice(0, 3).forEach(i => Object.assign(i, { st: 2, s: 5, df: 5, l: L - 4, d: L + 1, n: 3, m: 0, t: 1e12 })); save(); render() }, Date.parse('2026-10-22T03:58:00+02:00'));
  const dock = () => p.evaluate(() => (document.querySelector('.dock') || {}).innerText || '');
  await p.evaluate(at => { window.__off = at - (Date.now() - window.__off); document.dispatchEvent(new Event('visibilitychange')) }, Date.parse('2026-10-23T04:01:00+02:00'));
  await p.waitForTimeout(400);
  const shown = await dock(); await p.evaluate(() => render()); const fresh = await dock();
  t.ok(shown === fresh, 'retour au premier plan après 4 h : compteurs de l\'accueil à jour', 'affiché « ' + shown.replace(/\n/g, ' ') + ' », réel « ' + fresh.replace(/\n/g, ' ') + ' »');
  t.ok(!d.errs.length, 'aucune erreur JavaScript', d.errs.join(' | '));
  await d.ctx.close();
  return t;
}
module.exports = { run };
if (require.main === module) require('./run').main([__filename]);
