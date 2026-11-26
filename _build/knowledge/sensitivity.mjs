// How much do the ESS-estimated inputs move the modeled quarter mile? Perturbs each commonly estimated input
// across its plausible range on every runnable published configuration and reports the median and max ET change.
import { readFileSync } from 'node:fs';
import { newSetup, resolve, straightLine } from '../../experience/models.mjs';
const K = JSON.parse(readFileSync(new URL('./vehicle-knowledge.json', import.meta.url), 'utf8'));
const cases = { grip: [.85, 1.15], cg: [.85, 1.15], cda: [.8, 1.2], front: [.95, 1.05], redline: [.92, 1], weight: [1, 1.07] };
const out = {}, estimatedShare = {};
for (const r of K.records) {
  if (!r.model?.accelerationRuns || r.model.competition) continue;
  const base = resolve(newSetup(r.model.labId), false), et0 = straightLine(base).magazine.et;
  for (const [k, [lo, hi]] of Object.entries(cases)) {
    const est = r.model.inputs[k]?.evidence === 'estimate';
    (estimatedShare[k] ??= [0, 0])[est ? 0 : 1]++;
    const d = [lo, hi].map(f => { const v = { ...base, [k]: base[k] * f }; if (k === 'weight') { v.frontLb = base.frontLb * f; v.rearLb = base.rearLb * f; }
      const m = straightLine(v); return m.issue ? 0 : Math.abs(m.magazine.et - et0); });
    (out[k] ??= []).push(Math.max(...d));
  }
}
const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, a]) => [k, { range: cases[k], cars: a.length,
  estimatedOn: estimatedShare[k][0], medianEtChange: +med(a).toFixed(3), maxEtChange: +Math.max(...a).toFixed(3) }])), null, 1));
