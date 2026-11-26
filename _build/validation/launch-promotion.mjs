// Launch-model promotion evidence: shipped straightLine vs launch presets against every road test in the catalog + archive.
// legacy = shipped straightLine before the 25 Nov grip fix; base = straightLine now; scaled = base + opt-in inertiaScale
// candidate; perf / max = engine/launch.mjs presets (manual/DCT; automatics fall back to the converter model).
// Run: node _build/validation/launch-promotion.mjs [--json]
import { catalog } from '../../experience/catalog-data.mjs';
import { archiveCatalog } from '../../engine/archive.mjs';
import { labVehicle } from '../../engine/garage-adapter.mjs';
import { straightLine } from '../../engine/acceleration.mjs';
import { runPreset } from '../../engine/launch.mjs';

const ids = [...Object.keys(catalog), ...Object.values(archiveCatalog).filter(x => x.tier === 'simulation-ready' && !x.mergedInto).map(x => x.id)];
const rows = [];
for (const id of ids) {
  const r = labVehicle(id); if (!r || r.readiness.acceleration.status === 'blocked') continue;
  const f = (catalog[id] ?? archiveCatalog[id].record).fields;
  if (!f.testEt && !f.test60) continue;
  const v = r.vehicle;
  const pick = m => ({ et: m.et, s60: m.zeroTo60, trap: m.trap });
  const base = pick(straightLine(v, { inertiaScale: false }).magazine);
  const legacy = pick(straightLine(v, { legacyTraction: true, inertiaScale: false }).magazine);
  const scaled = pick(straightLine(v, { inertiaScale: true }).magazine);
  const perf = pick(runPreset(v, 'performance', { dt: .001 }).magazine);
  const max = pick(runPreset(v, 'maximum', { dt: .001 }).magazine);
  rows.push({ id, src: catalog[id] ? 'curated' : 'archive', trans: v.transmission, drive: v.drivetrain ?? v.drive, mu: v.grip,
    pw: v.weight / v.hp, test: { et: f.testEt?.[0], s60: f.test60?.[0], trap: f.testTrap?.[0] }, legacy, base, scaled, perf, max });
}
const stat = (sel, model, k) => {
  const e = sel.filter(r => r.test[k] != null && r[model][k] != null).map(r => r[model][k] - r.test[k]);
  if (!e.length) return null;
  const mae = e.reduce((s, x) => s + Math.abs(x), 0) / e.length, bias = e.reduce((s, x) => s + x, 0) / e.length;
  const p90 = [...e.map(Math.abs)].sort((a, b) => a - b)[Math.floor(.9 * (e.length - 1))];
  return { n: e.length, mae: +mae.toFixed(3), bias: +bias.toFixed(3), p90: +p90.toFixed(2) };
};
const groups = {
  all: rows, manual: rows.filter(r => r.trans !== 'automatic'), automatic: rows.filter(r => r.trans === 'automatic'),
  curated: rows.filter(r => r.src === 'curated'), archive: rows.filter(r => r.src === 'archive'),
  'manual, ≤10 lb/hp': rows.filter(r => r.trans !== 'automatic' && r.pw <= 10), 'manual, >10 lb/hp': rows.filter(r => r.trans !== 'automatic' && r.pw > 10),
};
const models = ['legacy', 'base', 'scaled', 'perf', 'max'];
const out = {};
for (const [g, sel] of Object.entries(groups)) out[g] = Object.fromEntries(['et', 's60', 'trap'].map(k =>
  [k, Object.fromEntries(models.map(m => [m, stat(sel, m, k)]))]));
if (process.argv.includes('--json')) console.log(JSON.stringify({ groups: out, rows }, null, 1));
else {
  for (const [g, s] of Object.entries(out)) {
    console.log(`\n## ${g} (n=${s.et.base?.n ?? 0} ET, ${s.s60.base?.n ?? 0} 0–60)`);
    for (const k of ['et', 's60', 'trap']) console.log(k.padEnd(5), models.map(m => s[k][m] ? `${m} MAE ${s[k][m].mae.toFixed(3)} bias ${s[k][m].bias.toFixed(2)}` : `${m} –`).join(' | '));
  }
  console.log('\nworst manual ET residuals (perf):');
  rows.filter(r => r.trans !== 'automatic' && r.test.et).map(r => ({ id: r.id, d: r.perf.et - r.test.et, b: r.base.et - r.test.et, mu: r.mu, pw: r.pw.toFixed(1) }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 12).forEach(x => console.log(x.id.padEnd(60), 'perf', x.d.toFixed(2), 'base', x.b.toFixed(2), 'mu', x.mu, 'lb/hp', x.pw));
}
