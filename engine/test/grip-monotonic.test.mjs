// More grip is never slower (25 Nov fix), and the fix costs no road-test accuracy. Independent of the tire UI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../../experience/catalog-data.mjs';
import { archiveCatalog } from '../archive.mjs';
import { labVehicle } from '../garage-adapter.mjs';
import { straightLine } from '../acceleration.mjs';

const ids = [...Object.keys(catalog), ...Object.values(archiveCatalog).filter(x => x.tier === 'simulation-ready' && !x.mergedInto).map(x => x.id)];
const cars = ids.map(id => [id, labVehicle(id)]).filter(([, r]) => r && r.readiness.acceleration.status !== 'blocked').map(([id, r]) => [id, r.vehicle]);
const mus = [.5, .7, .85, 1, 1.1, 1.2, 1.35, 1.5]; // spans wet street tire → drag radial on a prepped strip

test('a grippier tire never gives a slower 0–60 or quarter mile, on every runnable vehicle', () => {
  assert.ok(cars.length >= 85, `${cars.length} vehicles`);
  for (const [id, v] of cars) {
    const runs = mus.map(mu => straightLine(v, { mu }).magazine);
    // QA 25 Nov: null <= x is true in JS, so a run that stops completing would pass. Every run must finish.
    runs.forEach((r, i) => assert.ok(Number.isFinite(r.et) && Number.isFinite(r.zeroTo60), `${id} μ ${mus[i]} incomplete: et ${r.et}, 0–60 ${r.zeroTo60}`));
    for (let i = 1; i < runs.length; i++) {
      assert.ok(runs[i].et <= runs[i - 1].et + .005, `${id} ET μ ${mus[i - 1]}→${mus[i]}: ${runs[i - 1].et} → ${runs[i].et}`);
      assert.ok(runs[i].zeroTo60 <= runs[i - 1].zeroTo60 + .005, `${id} 0–60 μ ${mus[i - 1]}→${mus[i]}`);
    }
  }
});

test('the old rule was non-monotonic (regression evidence): Ranger Raptor 0.85 → 1.0 got slower', () => {
  const v = labVehicle('ford-ranger-p703--2024-raptor-3.0-a10-supercrew-4wd').vehicle;
  const at = (mu, legacy) => straightLine(v, legacy ? { mu, legacyTraction: true, inertiaScale: false } : { mu }).magazine.zeroTo60;
  assert.ok(at(1, true) > at(.85, true) + .3);
  assert.ok(at(1) <= at(.85));
});

test('road-test accuracy: no worse than the old rule overall, better on automatics (hold-out, no constant fitted)', () => {
  const err = (legacy, only = () => true) => {
    const et = [], s60 = [];
    for (const [id, v] of cars.filter(([, v]) => only(v))) {
      const f = (catalog[id] ?? archiveCatalog[id].record).fields;
      const m = straightLine(v, legacy ? { legacyTraction: true, inertiaScale: false } : {}).magazine;
      if (f.testEt && m.et) et.push(Math.abs(m.et - f.testEt[0]));
      if (f.test60 && m.zeroTo60) s60.push(Math.abs(m.zeroTo60 - f.test60[0]));
    }
    const mae = a => a.reduce((s, x) => s + x, 0) / a.length;
    return { et: mae(et), s60: mae(s60), n: et.length };
  };
  const now = err(false), old = err(true);
  assert.ok(now.n >= 70);
  assert.ok(now.et <= old.et + .005, `ET MAE ${now.et} vs ${old.et}`);
  assert.ok(now.s60 <= old.s60 + .005, `0–60 MAE ${now.s60} vs ${old.s60}`);
  const auto = v => v.transmission === 'automatic';
  assert.ok(err(false, auto).et < err(true, auto).et - .05, 'automatics ET MAE improves by > 0.05 s');
  assert.ok(now.et < .33, `all-vehicle ET MAE ${now.et}`);
});
