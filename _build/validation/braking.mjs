// Claude sprint 26 Nov 2026 — hold-out validation of engine/braking.mjs (stops) and engine/cornering.mjs (skidpad)
// against every published 60/70/100–0 and skidpad figure in the vehicle knowledge records. No constant was tuned to
// these tests: every row is a hold-out. Run: node _build/validation/braking.mjs
import { readFileSync } from 'node:fs';
import { brakingStop, impliedG, brakingDefaults } from '../../engine/braking.mjs';
import { corneringLimit } from '../../engine/cornering.mjs';
import { rollSetup } from '../../engine/roll.mjs';

const { records } = JSON.parse(readFileSync(new URL('../knowledge/vehicle-knowledge.json', import.meta.url)));
const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);

const rows = [], skid = [];
for (const r of records) {
  const tests = r.facts.filter(f => /^Braking (60|70|100)–0 mph$/.test(f.label) && Number.isFinite(f.value));
  const pads = r.facts.filter(f => f.label === 'Skidpad' && Number.isFinite(f.value));
  if (!tests.length && !pads.length) continue;
  const inp = Object.fromEntries(Object.entries(r.model?.inputs ?? {}).map(([k, x]) => [k, val(x)]));
  if (!inp.weight) { rows.push({ id: r.id, skipped: 'no model inputs' }); continue; }
  const evidence = Object.fromEntries(Object.entries(r.model?.inputs ?? {}).map(([k, x]) => [k, x?.evidence]));
  const v = { ...inp, evidence, frontLb: inp.weight * inp.front, rearLb: inp.weight * (1 - inp.front) };
  for (const f of tests) {
    const mph = +f.label.match(/(\d+)–0/)[1];
    const s = brakingStop(v, { from: mph });
    const s1 = brakingStop(v, { from: mph, longitudinalRatio: 1 });
    const grid = {}; for (const rise of [.15, .05]) for (const L of [1, 1.04, 1.08]) grid[`${rise}|${L}`] = brakingStop(v, { from: mph, riseTime: rise, longitudinalRatio: L }).distance;
    rows.push({ id: r.id, year: r.identity.year, mph, test: f.value, model: s.distance, grip: v.grip, cg: v.cg, v, model1: s1.distance, model1G: s1.meanG, grid,
      err: (s.distance - f.value) / f.value, testG: impliedG(mph, f.value), modelG: s.meanG, limit: s.limit, pub: f.source?.publisher });
  }
  for (const f of pads) {
    const c = corneringLimit(v), rs = rollSetup(v), cr = corneringLimit(v, rs);
    skid.push({ id: r.id, test: f.value, model: c.ay, grip: v.grip, err: (c.ay - f.value) / f.value, axle: c.limitingAxle, gripOnly: c.gripOnly,
      roll: { model: cr.ay, err: (cr.ay - f.value) / f.value, axle: cr.limitingAxle, setup: rs, arch: `${v.archFront}/${v.archRear}` } });
  }
}
const ok = rows.filter(r => !r.skipped);
const stats = xs => ({ n: xs.length, signed: xs.reduce((a, b) => a + b, 0) / xs.length, mad: xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length,
  within5: xs.filter(x => Math.abs(x) <= .05).length, within10: xs.filter(x => Math.abs(x) <= .10).length });
const pct = x => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

console.log(`BRAKING (ABS default, rise 0.15 s, k 0.15, absEfficiency 0.95, longitudinalRatio ${brakingDefaults.longitudinalRatio}) — model distance vs published`);
console.log('id | mph | test ft | model ft | error | test g | model g | grip | publisher');
for (const r of ok.sort((a, b) => a.err - b.err))
  console.log(`${r.id} | ${r.mph} | ${r.test} | ${r.model.toFixed(0)} | ${pct(r.err)} | ${r.testG.toFixed(2)} | ${r.modelG.toFixed(2)} | ${r.grip} | ${r.pub}`);
for (const r of rows.filter(r => r.skipped)) console.log(`${r.id} skipped: ${r.skipped}`);
const s = stats(ok.map(r => r.err));
console.log(`\nSummary: n=${s.n} signed ${pct(s.signed)} MAD ${pct(s.mad)} within ±5%: ${s.within5}/${s.n}, ±10%: ${s.within10}/${s.n}`);
// tire-implied friction: what μ would reproduce the test (diagnostic: is the residual a tire-class question?)
console.log('\nGrip class check: mean test g ÷ model grip, by model grip value');
const byGrip = {};
for (const r of ok) (byGrip[r.grip] ??= []).push(r.testG / r.grip);
for (const [g, xs] of Object.entries(byGrip)) console.log(`  grip ${g}: n=${xs.length}, test g / grip = ${(xs.reduce((a, b) => a + b) / xs.length).toFixed(3)}`);

console.log('\nSKIDPAD — corneringLimit (k 0.15, Load Transfer calculator roll split) vs published');
console.log('id | test g | model g | error | grip | limiting axle');
for (const r of skid.sort((a, b) => a.err - b.err)) console.log(`${r.id} | ${r.test} | ${r.model.toFixed(3)} | ${pct(r.err)} | ${r.grip} | ${r.gripOnly ? 'grip-only (missing inputs)' : r.axle}`);
const k = stats(skid.map(r => r.err));
console.log(`\nSummary: n=${k.n} signed ${pct(k.signed)} MAD ${pct(k.mad)} within ±5%: ${k.within5}/${k.n}, ±10%: ${k.within10}/${k.n}`);

console.log('\nSKIDPAD — same, with engine/roll.mjs rollSetup (per-architecture roll centres, split = front weight share + 5 %)');
console.log('id | test g | model g | error | limiting axle | front roll share | RC front/rear in | architecture | split basis');
for (const r of skid.sort((a, b) => a.roll.err - b.roll.err)) console.log(`${r.id} | ${r.test} | ${r.roll.model.toFixed(3)} | ${pct(r.roll.err)} | ${r.roll.axle} | ${r.roll.setup.frontRoll.toFixed(2)} | ${r.roll.setup.frontCenter}/${r.roll.setup.rearCenter} | ${r.roll.arch} | ${r.roll.setup.basis.split}`);
const kr = stats(skid.map(r => r.roll.err)), axles = xs => Object.entries(xs.reduce((m, a) => (m[a] = (m[a] ?? 0) + 1, m), {})).map(([a, n]) => `${a} ${n}`).join(', ');
console.log(`\nSummary: n=${kr.n} signed ${pct(kr.signed)} MAD ${pct(kr.mad)} within ±5%: ${kr.within5}/${kr.n}, ±10%: ${kr.within10}/${kr.n}`);
console.log(`Limiting axle — calculator defaults: ${axles(skid.map(r => r.axle))}; rollSetup: ${axles(skid.map(r => r.roll.axle))}`);

// Longitudinal ÷ lateral friction (basis of brakingDefaults.longitudinalRatio). Same car, same magazine:
// measured stop g ÷ measured skidpad g, against the model's own ratio with longitudinalRatio = 1.
console.log('\nSTOP g ÷ SKIDPAD g on the same car (measurement ÷ measurement) vs the model with longitudinalRatio 1');
const pairs = [];
for (const p of skid) for (const r of ok.filter(r => r.id === p.id)) pairs.push({ id: p.id, pub: r.pub, mph: r.mph, test: r.testG / p.test, model: r.model1G / p.model });
for (const p of pairs) console.log(`${p.id} | ${p.mph} | ${p.pub} | test ${p.test.toFixed(3)} | model ${p.model.toFixed(3)}`);
const median = xs => { const a = [...xs].sort((x, y) => x - y), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
const perCar = pubOnly => Object.values(pairs.filter(p => !pubOnly || p.pub === pubOnly).reduce((m, p) => ((m[p.id] ??= []).push(p.test), m), {}))
  .map(xs => xs.reduce((a, b) => a + b) / xs.length);
const cdCars = perCar('Car and Driver');
console.log(`Car and Driver cars: n=${cdCars.length}, median per-car ratio ${median(cdCars).toFixed(3)}, range ${Math.min(...cdCars).toFixed(2)}–${Math.max(...cdCars).toFixed(2)}; model ratio median ${median(pairs.map(p => p.model)).toFixed(3)}`);

// Before/after and leave-one-car-out: each car's stops use the ratio from the OTHER Car and Driver cars only.
const cdIds = [...new Set(pairs.filter(p => p.pub === 'Car and Driver').map(p => p.id))];
const ratioWithout = id => median(cdIds.filter(x => x !== id).map(x => { const xs = pairs.filter(p => p.id === x && p.pub === 'Car and Driver').map(p => p.test); return xs.reduce((a, b) => a + b) / xs.length; }));
const loo = ok.map(r => { const L = ratioWithout(r.id); const d = brakingStop(r.v, { from: r.mph, longitudinalRatio: L }).distance; return { ...r, loo: (d - r.test) / r.test, L }; });
const line = (name, xs) => { const q = stats(xs); return `${name}: n=${q.n} signed ${pct(q.signed)} MAD ${pct(q.mad)} within ±5% ${q.within5}/${q.n}, ±10% ${q.within10}/${q.n}`; };
console.log('\nSTOPS: brake build-up (riseTime; 0.05 = maneuvers.mjs roadTest convention, 0.15 = engine default) × longitudinalRatio');
for (const key of Object.keys(ok[0].grid)) { const [rise, L] = key.split('|');
  console.log(`  rise ${rise} s, ratio ${L}: ` + line('all', ok.map(r => (r.grid[key] - r.test) / r.test)) + ' | ' + line('C/D', ok.filter(r => r.pub === 'Car and Driver').map(r => (r.grid[key] - r.test) / r.test))); }
console.log('\nSTOPS before/after longitudinalRatio (engine default rise 0.15 s)');
for (const [label, f] of [['all publishers', () => true], ['Car and Driver only', r => r.pub === 'Car and Driver'], ['MotorTrend + AutoWeek', r => r.pub !== 'Car and Driver']]) {
  const xs = ok.filter(f);
  console.log(`  ${label}`);
  console.log('    ' + line('ratio 1 (default)', xs.map(r => (r.model1 - r.test) / r.test)));
  console.log('    ' + line('ratio 1.08 (median cross-maneuver ratio)', xs.map(r => (r.grid['0.15|1.08'] - r.test) / r.test)));
  console.log('    ' + line('leave-one-car-out ratio', loo.filter(f).map(r => r.loo)));
}
console.log(`  leave-one-car-out ratios used: ${Math.min(...loo.map(r => r.L)).toFixed(3)}–${Math.max(...loo.map(r => r.L)).toFixed(3)}`);
export { rows, skid };
