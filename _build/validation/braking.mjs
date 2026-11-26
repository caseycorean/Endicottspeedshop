// Claude sprint 26 Nov 2026 — hold-out validation of engine/braking.mjs (stops) and engine/cornering.mjs (skidpad)
// against every published 60/70/100–0 and skidpad figure in the vehicle knowledge records. No constant was tuned to
// these tests: every row is a hold-out. Run: node _build/validation/braking.mjs
import { readFileSync } from 'node:fs';
import { brakingStop, impliedG } from '../../engine/braking.mjs';
import { corneringLimit } from '../../engine/cornering.mjs';

const { records } = JSON.parse(readFileSync(new URL('../knowledge/vehicle-knowledge.json', import.meta.url)));
const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);

const rows = [], skid = [];
for (const r of records) {
  const tests = r.facts.filter(f => /^Braking (60|70|100)–0 mph$/.test(f.label) && Number.isFinite(f.value));
  const pads = r.facts.filter(f => f.label === 'Skidpad' && Number.isFinite(f.value));
  if (!tests.length && !pads.length) continue;
  const inp = Object.fromEntries(Object.entries(r.model?.inputs ?? {}).map(([k, x]) => [k, val(x)]));
  if (!inp.weight) { rows.push({ id: r.id, skipped: 'no model inputs' }); continue; }
  const v = { ...inp, frontLb: inp.weight * inp.front, rearLb: inp.weight * (1 - inp.front) };
  for (const f of tests) {
    const mph = +f.label.match(/(\d+)–0/)[1];
    const s = brakingStop(v, { from: mph });
    rows.push({ id: r.id, year: r.identity.year, mph, test: f.value, model: s.distance, grip: v.grip, cg: v.cg,
      err: (s.distance - f.value) / f.value, testG: impliedG(mph, f.value), modelG: s.meanG, limit: s.limit, pub: f.source?.publisher });
  }
  for (const f of pads) {
    const c = corneringLimit(v);
    skid.push({ id: r.id, test: f.value, model: c.ay, grip: v.grip, err: (c.ay - f.value) / f.value, axle: c.limitingAxle, gripOnly: c.gripOnly });
  }
}
const ok = rows.filter(r => !r.skipped);
const stats = xs => ({ n: xs.length, signed: xs.reduce((a, b) => a + b, 0) / xs.length, mad: xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length,
  within5: xs.filter(x => Math.abs(x) <= .05).length, within10: xs.filter(x => Math.abs(x) <= .10).length });
const pct = x => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

console.log('BRAKING (ABS default, rise 0.15 s, k 0.15, absEfficiency 0.95) — model distance vs published');
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
export { rows, skid };
